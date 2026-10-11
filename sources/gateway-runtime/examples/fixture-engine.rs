//! Private, local-only E2E harness. Never ship this binary or its fixture key.
//! Production startup uses OS-protected credentials in src/main.rs instead.
use lumi_gateway_runtime::{
    config::GatewayConfig,
    gateway::{GatewayEngine, RouteSecret},
    json::scan_object,
};
use serde_json::{Value, json};
use std::{
    fs,
    io::{self, BufRead, IsTerminal, Read, Write},
    path::PathBuf,
};

const MAX_RPC_LINE: usize = 6 * 1024 * 1024;

fn main() {
    if run().is_err() {
        eprintln!("local fixture engine failed");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 || args[1] != "serve-engine" {
        return Err("unsupported-fixture-command".into());
    }
    if io::stdin().is_terminal() || io::stdout().is_terminal() {
        return Err("private-pipe-required".into());
    }
    let directory = PathBuf::from(&args[2]);
    if !directory.is_absolute() {
        return Err("absolute-fixture-directory-required".into());
    }
    let config_bytes =
        fs::read(directory.join("config.json")).map_err(|_| "fixture-config-unavailable")?;
    if config_bytes.len() > 1024 * 1024 {
        return Err("fixture-config-too-large".into());
    }
    scan_object(&config_bytes).map_err(|_| "invalid-fixture-config")?;
    let config: GatewayConfig =
        serde_json::from_slice(&config_bytes).map_err(|_| "invalid-fixture-config")?;
    config.validate()?;
    // This harness may contact only the local mock upstream; production permits HTTPS.
    if config.routes.iter().any(|route| {
        route.upstream.scheme() != "http"
            || !route.upstream.host_str().is_some_and(|host| {
                host.parse::<std::net::IpAddr>()
                    .is_ok_and(|address| address.is_loopback())
            })
    }) {
        return Err("fixture-upstream-must-be-loopback".into());
    }
    let route_secrets: Vec<RouteSecret> = config
        .routes
        .iter()
        .map(|route| RouteSecret {
            route_id: route.id.clone(),
            client_key: "fixture-client-key-0123456789".into(),
            upstream_key: "fixture-upstream-key-9876543210".into(),
        })
        .collect();
    // Deliberately deterministic only for isolated fixtures, never real user data.
    let mut engine = GatewayEngine::open(
        config.clone(),
        &directory.join("records.sqlite"),
        Some([1u8; 32]),
    )?;
    let mut bootstrapped = false;
    let mut input = io::stdin().lock();
    let mut output = io::stdout().lock();
    loop {
        let mut line = Vec::new();
        let count = (&mut input)
            .take((MAX_RPC_LINE + 1) as u64)
            .read_until(b'\n', &mut line)
            .map_err(|_| "fixture-input-failed")?;
        if count == 0 {
            break;
        }
        if line.len() > MAX_RPC_LINE || !line.ends_with(b"\n") {
            return Err("fixture-message-invalid".into());
        }
        let request: Value =
            serde_json::from_slice(&line).map_err(|_| "fixture-message-invalid")?;
        let id = request.get("id").cloned().unwrap_or(Value::Null);
        if !id.is_u64() {
            return Err("fixture-message-invalid".into());
        }
        let method = request.get("method").and_then(Value::as_str).unwrap_or("");
        let result = if method == "bootstrap" {
            if bootstrapped {
                Err("already-bootstrapped".into())
            } else {
                bootstrapped = true;
                Ok(json!({"config":config,"routeSecrets":route_secrets,"protocolVersion":1}))
            }
        } else if !bootstrapped {
            Err("bootstrap-required".into())
        } else {
            engine.request(method, request.get("input").cloned().unwrap_or(json!({})))
        };
        let response = match result {
            Ok(value) => json!({"id":id,"result":value}),
            Err(code) => json!({"id":id,"error":{"code":code}}),
        };
        serde_json::to_writer(&mut output, &response).map_err(|_| "fixture-output-failed")?;
        output
            .write_all(b"\n")
            .map_err(|_| "fixture-output-failed")?;
        output.flush().map_err(|_| "fixture-output-failed")?;
    }
    Ok(())
}

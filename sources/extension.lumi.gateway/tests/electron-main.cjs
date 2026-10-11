const { app, BrowserWindow, protocol } = require('electron');
const path = require('node:path'), fs = require('node:fs');
const testMode = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-mode.json'), 'utf8'));
for (const key of ['userData', 'sessionData', 'logs', 'crashDumps']) { const dir = path.join(__dirname, key); fs.mkdirSync(dir, { recursive: true }); app.setPath(key, dir); }
protocol.registerSchemesAsPrivileged([{ scheme: 'lumi-gateway-fixture', privileges: { standard: true, secure: true, supportFetchAPI: true,corsEnabled:true } }]);
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  let win;
  try {
    protocol.handle('lumi-gateway-fixture', async request => {
      const url = new URL(request.url);
      const allowed = { '/index.html': 'text/html', '/style.css': 'text/css', '/app.js': 'text/javascript', '/lumi-sdk.js': 'text/javascript','/lumi-ui.css':'text/css' };
      if (url.host !== 'app' || !allowed[url.pathname] || url.search) return new Response('', { status: 404 });
      return new Response(fs.readFileSync(path.join(__dirname, url.pathname.slice(1))), { headers: { 'content-type': allowed[url.pathname],'access-control-allow-origin':'*', 'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'" } });
    });
    win = new BrowserWindow({ width: 1280, height: 1000, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    const errors = [], blocked = [];
    win.webContents.on('console-message', (...args) => {
      const item = args.find(value => value && typeof value === 'object' && typeof value.message === 'string');
      const level = item?.level ?? args[1], message = String(item?.message ?? args[2]);
      const expectedNetworkDenial = message.includes('https://must-not-load.invalid/probe') && /Content Security Policy|connect-src 'none'/.test(message);
      if ((level >= 2 || level === 'error') && !message.includes('Electron Security Warning') && !expectedNetworkDenial) errors.push(message);
    });
    win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
      const allowed = details.url.startsWith('file:') || details.url.startsWith('lumi-gateway-fixture:') || details.url.startsWith('data:');
      if (!allowed) blocked.push(details.url);
      callback({ cancel: !allowed });
    });
    await win.loadFile(path.join(__dirname, 'host.html'));
    let frame;
    for (let attempt = 0; attempt < 100; attempt++) {
      frame = win.webContents.mainFrame.frames.find(value => value.url.startsWith('lumi-gateway-fixture:'));
      if (frame && await frame.executeJavaScript('!!window.lumiExtension?.gateway')) break;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    if (!frame) throw new Error('Gateway iframe not found');
    if(!await frame.executeJavaScript('document.body.hasAttribute("data-lumi-ui") && !!document.querySelector("link[data-lumi-ui][href=\\"lumi-ui.css\\"]") && getComputedStyle(document.querySelector(".button")).borderRadius==="9px"'))throw new Error('Host default primitives were not delivered to the iframe');
    const scenario = fs.readFileSync(path.join(__dirname, 'ui-scenario.js'), 'utf8');
    await frame.executeJavaScript('window.gatewayDenseScenario=(' + fs.readFileSync(path.join(__dirname, 'dense-ui-scenario.js'), 'utf8') + ')');
    const result = await frame.executeJavaScript('(' + scenario + ')()');
    await frame.executeJavaScript('window.scrollTo(0,0)');
    fs.writeFileSync(path.join(__dirname, 'light.png'), (await win.webContents.capturePage()).toPNG());
    await win.webContents.executeJavaScript('fixture.theme("dark")');
    await new Promise(resolve => setTimeout(resolve, 60));
    fs.writeFileSync(path.join(__dirname, 'dark.png'), (await win.webContents.capturePage()).toPNG());
    const dark = await frame.executeJavaScript('document.documentElement.dataset.theme');
    if (dark !== 'dark') throw new Error('Host dark theme was not applied');
    const hostState = await win.webContents.executeJavaScript('({errors:fixture.errors,calls:fixture.calls,exports:fixture.exports,deletes:fixture.deletes,rules:fixture.rules,recording:fixture.recording,configVersion:fixture.configVersion})');
    if (errors.length || hostState.errors.length || blocked.length) throw new Error(JSON.stringify({ errors, hostErrors: hostState.errors, blocked }));
    const configMutations = hostState.calls.filter(call => ['gateway.local.configure','gateway.routes.save','gateway.routes.delete','gateway.rules.replace','gateway.recording.config.set'].includes(call.method));
    if (hostState.configVersion !== configMutations.length + 1 || configMutations.some((call, index) => call.input.expectedVersion !== index + 1)) throw new Error('UI configuration writes used stale shared versions');
    const restores = hostState.calls.flatMap((call, index) => call.method === 'gateway.cliConfig.restore' ? [index] : []);
    if (restores.length !== 3 || hostState.calls[restores[1] + 1]?.method !== 'gateway.cliConfig.restore' || hostState.calls[restores[2] + 1]?.method !== 'gateway.listener.stop') throw new Error('Restore failure or restore-before-stop RPC order is unsafe');
    if (hostState.exports.length !== 1 || hostState.exports[0].includeBody !== false) throw new Error('Export must exclude body');
    if (!hostState.calls.some(value => value.method === 'gateway.events.unsubscribe')) throw new Error('Disconnect did not unsubscribe');
    for (const call of hostState.calls) if (/fake-(?:gui|new|rotated|not-submitted)-/.test(JSON.stringify(call))) throw new Error('Fixture audit retained plaintext credential data');
    fs.writeFileSync(path.join(__dirname, 'result.json'), JSON.stringify({ ...result, darkTheme: dark, methods: [...new Set(hostState.calls.map(call => call.method))], calls: hostState.calls.length, export: hostState.exports[0], deleted: hostState.deletes.length, sandbox: 'allow-scripts', processSandboxEnabled: testMode.processSandboxEnabled, connectSource: 'none', errors, blocked }, null, 2));
    console.log(JSON.stringify({ ok: true, result: path.join(__dirname, 'result.json'), screenshots: ['light.png', 'dark.png'] }));
    app.exit(0);
  } catch (error) { console.error(String(error.stack || error)); app.exit(1); }
});

import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [command = 'test', ...arguments_] = process.argv.slice(2);
if (!['test', 'check', 'build', 'fmt', 'clippy'].includes(command)) {
  throw new Error('支持的网关命令：test/check/build/fmt/clippy');
}
const cargoHome = path.join(repository, '.cache', 'gateway-cargo');
const environment = {...process.env};
if (existsSync(path.join(cargoHome, 'config.toml'))) environment.CARGO_HOME = cargoHome;
environment.CARGO_TARGET_DIR = path.join(repository, '.cache', 'gateway-target');
const child = spawn('cargo', [command, ...arguments_], {
  cwd: path.join(repository, 'sources', 'gateway-runtime'), env: environment, stdio: 'inherit', shell: false
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });

import {spawn, execFileSync} from 'node:child_process';
import {cp, mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const host = path.resolve(process.argv[2] || path.join(root, '../main'));
const requireHost = createRequire(path.join(host, 'package.json'));
const electron = requireHost('electron');
const output = path.join(root, '.cache/notes-ui');
await mkdir(output, {recursive: true});
const fixture = await mkdtemp(path.join(output, 'run-'));
const {extensionSdkRuntime} = await import(pathToFileURL(path.join(host, 'scripts/extension-ui.mjs')));
await cp(path.join(root, 'plugins/extension.lumi.notes'), path.join(fixture, 'plugin'), {recursive: true});
await writeFile(path.join(fixture, 'plugin/lumi-sdk.js'), await extensionSdkRuntime(host));
await cp(path.join(import.meta.dirname, 'notes-ui'), fixture, {recursive: true});
await writeFile(path.join(fixture, 'index.html'), '<!doctype html><meta charset="UTF-8"><style>body{margin:0;padding:24px;background:#eef3f0}iframe{border:0;width:100%;height:320px}</style><iframe sandbox="allow-scripts" src="plugin/index.html"></iframe><script src="host.js"></script>');

const hostPackage = JSON.parse(await readFile(path.join(host, 'package.json'), 'utf8'));
const metadata = {
  started: new Date().toISOString(), host, hostVersion: hostPackage.version,
  hostCommit: execFileSync('git', ['-c', `safe.directory=${host.replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], {cwd: host, encoding: 'utf8'}).trim(),
  fixture, scope: '真实 Electron DOM、官方 SDK 与隔离 postMessage 假存储；不访问用户数据，不覆盖实际 Lumi 存储服务或 macOS 验证'
};
const env = {...process.env};
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [path.join(fixture, 'electron-main.cjs')], {env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
let logs = '', timedOut = false;
child.stdout.on('data', chunk => { logs += chunk; });
child.stderr.on('data', chunk => { logs += chunk; });
const timeout = setTimeout(() => { timedOut = true; child.kill(); }, 45000);
try {
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  await writeFile(path.join(fixture, 'electron.log'), logs);
  let result;
  try { result = JSON.parse(await readFile(path.join(fixture, 'result.json'), 'utf8')); }
  catch { result = {passed: false, error: timedOut ? 'Electron UI check timed out' : 'Electron exited before producing a result'}; }
  const report = {...metadata, ...result, completed: new Date().toISOString(), exitCode: code};
  await writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  if (code !== 0 || !result.passed) throw new Error(result.error + '\n' + logs);
  console.log(`NOTES_UI_OK ${result.checks.length} checks; max concurrent writes: ${result.maxActiveWrites}`);
  console.log(`验证记录：${path.join(output, 'result.json')}`);
  for (const screenshot of result.screenshots) console.log(`截图：${screenshot}`);
} finally {
  clearTimeout(timeout);
}

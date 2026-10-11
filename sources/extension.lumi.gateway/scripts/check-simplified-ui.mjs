import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest=JSON.parse(await fs.readFile(path.join(source,'package-stage/plugin.json'),'utf8'));
if(manifest.id!=='extension.lumi.gateway'||manifest.name!=='模型网关'||manifest.version!=='1.0.1'||manifest.contributions.length!==2||manifest.contributions.some(view=>view.title!=='模型网关'))throw new Error('The model gateway manifest name/version/view identity is inconsistent.');
const noProcessSandbox = process.argv.includes('--no-process-sandbox');
const hostArgument = process.argv.slice(2).find(value => !value.startsWith('--'));
const host = path.resolve(hostArgument || path.join(root, '..', 'main'));
const requireHost = createRequire(path.join(host, 'package.json'));
const electron = requireHost('electron');
const sdkPath = path.join(host, 'public', 'lumi-extension-sdk.js');
const outputRoot = path.join(root, '.cache', 'gateway-plugin-ui');
await fs.access(electron);
await fs.access(sdkPath);
const {extensionSdkRuntime,extensionUiCss}=await import(pathToFileURL(path.join(host,'scripts/extension-ui.mjs')).href);
const [sdk,uiCss]=await Promise.all([extensionSdkRuntime(host),extensionUiCss(host)]);
await fs.mkdir(outputRoot, { recursive: true });
const directory = await fs.mkdtemp(path.join(outputRoot, 'run-'));
for (const name of ['index.html', 'style.css', 'app.js', 'workbench.js']) await fs.copyFile(path.join(source, 'package-stage', name), path.join(directory, name));
// The production SDK makes its custom-scheme CSS links CORS-readable. This
// alternate fixture scheme opts in up front so typography uses the same CSSOM.
const indexFile=path.join(directory,'index.html');
await fs.writeFile(indexFile,(await fs.readFile(indexFile,'utf8')).replaceAll('<link rel="stylesheet"','<link rel="stylesheet" crossorigin="anonymous"'));
const legacyPreview=process.argv.includes('--legacy-preview');
const fixtureSdk=legacyPreview?sdk.replace(",preview:input=>call('gateway.routes.models.preview',input)",''):sdk;
if(legacyPreview&&fixtureSdk===sdk)throw new Error('Legacy preview SDK fixture could not remove the new method');
await fs.writeFile(path.join(directory,'lumi-sdk.js'),fixtureSdk);
await fs.writeFile(path.join(directory,'lumi-ui.css'),uiCss);
await fs.writeFile(path.join(directory, 'test-mode.json'), JSON.stringify({ processSandboxEnabled: !noProcessSandbox,legacyPreview }));
for (const name of ['fixture-host.js','dense-ui-scenario.js','compact-overview-probe.js']) await fs.copyFile(path.join(source,'tests',name),path.join(directory,name));
await fs.copyFile(path.join(source,'tests/simplified-ui-scenario.js'),path.join(directory,'ui-scenario.js'));
// The lightweight RPC fixture has no production ExtensionFrame. Deliver its
// matching default UI theme through the same SDK envelope as the real frame.
const fixtureFile=path.join(directory,'fixture-host.js');
const fixtureSource=await fs.readFile(fixtureFile,'utf8');
const sendSource="function send(message) { frame.contentWindow.postMessage({ protocol, nonce, ...message }, '*'); }";
if(!fixtureSource.includes(sendSource))throw new Error('Fixture theme delivery hook changed');
await fs.writeFile(fixtureFile,fixtureSource.replace(sendSource,`function send(message) {
 if(message.type==='init'||message.type==='context'){
  const theme=message.context.theme,uiTheme={id:'interface.default',css:'',appearance:{},theme,typography:{fontSize:14,fontFamily:'system'}};
  document.documentElement.dataset.theme=theme;
  if(message.type==='init')message={...message,uiTheme};
  else frame.contentWindow.postMessage({protocol,nonce,type:'ui-theme',uiTheme},'*');
 }
 frame.contentWindow.postMessage({protocol,nonce,...message},'*');
}`));
await fs.copyFile(path.join(source, 'tests', 'simplified-electron-main.cjs'), path.join(directory, 'main.cjs'));
await fs.writeFile(path.join(directory, 'host.html'), '<!doctype html><html><head><meta charset="UTF-8"><link rel="stylesheet" href="lumi-ui.css"></head><body data-lumi-ui style="margin:0;overflow:hidden"><iframe id="plugin" sandbox="allow-scripts" title="Gateway fixture" src="lumi-gateway-fixture://app/index.html" style="display:block;border:0;width:100%;height:100vh"></iframe><script src="fixture-host.js"></script></body></html>', 'utf8');
const result = await new Promise(resolve => {
  const child = spawn(electron, [...(noProcessSandbox ? ['--no-sandbox'] : []), path.join(directory, 'main.cjs')], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', error => resolve({ code: 1, stderr: error.message }));
  const timer = setTimeout(() => { child.kill(); resolve({ code: 1, stderr: 'Gateway UI fixture timeout' }); }, 45000);
  child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
});
if (result.code !== 0) { console.error(result.stderr || result.stdout); process.exitCode = 1; }
else console.log(result.stdout.trim());

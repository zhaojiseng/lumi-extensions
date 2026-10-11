import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest=JSON.parse(await fs.readFile(path.join(source,'package-stage/plugin.json'),'utf8'));
if(manifest.id!=='extension.lumi.gateway'||manifest.name!=='模型网关'||manifest.version!=='1.0.1'||manifest.contributions.length!==2||manifest.contributions.some(view=>view.title!=='模型网关'))throw new Error('The model gateway manifest name/version/view identity is inconsistent.');
const noProcessSandbox = process.argv.includes('--no-process-sandbox');
const noGpuSandbox = process.argv.includes('--disable-gpu-sandbox');
const browser = process.argv.slice(2).find(value => !value.startsWith('--')) || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sdkPath = path.resolve(root, '../main/public/lumi-extension-sdk.js');
const host=path.resolve(root,'../main');
const outputRoot = path.join(root, '.cache/gateway-plugin-ui');
await fs.access(browser); await fs.access(sdkPath);
const {extensionSdkRuntime,extensionUiCss}=await import(pathToFileURL(path.join(host,'scripts/extension-ui.mjs')).href);
const [sdk,uiCss]=await Promise.all([extensionSdkRuntime(host),extensionUiCss(host)]);
await fs.mkdir(outputRoot, { recursive: true });
const directory = await fs.mkdtemp(path.join(outputRoot, 'chromium-'));
const profile = path.join(directory, 'profile');
await fs.mkdir(profile);
const assets = new Map();
for (const [url, file, type] of [
  ['/plugin/index.html', path.join(source, 'package-stage/index.html'), 'text/html'],
  ['/plugin/workbench.js', path.join(source, 'package-stage/workbench.js'), 'text/javascript'],
  ['/plugin/app.js', path.join(source, 'package-stage/app.js'), 'text/javascript'],
  ['/plugin/style.css', path.join(source, 'package-stage/style.css'), 'text/css'],
  ['/plugin/lumi-sdk.js', sdkPath, 'text/javascript'],
  ['/fixture-host.js', path.join(source, 'tests/fixture-host.js'), 'text/javascript'],
]) assets.set(url, { body: await fs.readFile(file), type });
const indexAsset=assets.get('/plugin/index.html');
indexAsset.body=Buffer.from(indexAsset.body.toString('utf8').replaceAll('<link rel="stylesheet"','<link rel="stylesheet" crossorigin="anonymous"'));
assets.set('/plugin/lumi-sdk.js',{body:Buffer.from(sdk),type:'text/javascript'});
assets.set('/plugin/lumi-ui.css',{body:Buffer.from(uiCss),type:'text/css'});
assets.set('/host-ui.css',{body:Buffer.from(uiCss),type:'text/css'});
const fixtureAsset=assets.get('/fixture-host.js'),fixtureSource=fixtureAsset.body.toString('utf8');
const sendSource="function send(message) { frame.contentWindow.postMessage({ protocol, nonce, ...message }, '*'); }";
if(!fixtureSource.includes(sendSource))throw new Error('Fixture theme delivery hook changed');
fixtureAsset.body=Buffer.from(fixtureSource.replace(sendSource,`function send(message) {
 if(message.type==='init'||message.type==='context'){
  const theme=message.context.theme,uiTheme={id:'interface.default',css:'',appearance:{},theme,typography:{fontSize:14,fontFamily:'system'}};
  document.documentElement.dataset.theme=theme;
  if(message.type==='init')message={...message,uiTheme};
  else frame.contentWindow.postMessage({protocol,nonce,type:'ui-theme',uiTheme},'*');
 }
 frame.contentWindow.postMessage({protocol,nonce,...message},'*');
}`));
assets.set('/host.html', { body: Buffer.from('<!doctype html><html><head><meta charset="UTF-8"><link rel="stylesheet" href="/host-ui.css"></head><body data-lumi-ui style="margin:0;overflow:hidden"><iframe id="plugin" sandbox="allow-scripts" title="Gateway fixture" src="/plugin/index.html" style="display:block;border:0;width:100%;height:100vh"></iframe><script src="/fixture-host.js"></script></body></html>'), type: 'text/html' });
const server = http.createServer((req, res) => {
  const asset = assets.get(req.url);
  if (!asset) { res.writeHead(404); res.end(); return; }
  const headers = { 'content-type': asset.type, 'cache-control': 'no-store','access-control-allow-origin':'*' };
  if (req.url.startsWith('/plugin/')) headers['content-security-policy'] = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'";
  res.writeHead(200, headers); res.end(asset.body);
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = 'http://127.0.0.1:' + server.address().port;
let child, client, stderr = '';
function attach(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    let next = 0;
    const pending = new Map(), listeners = new Map();
    const contexts = new Map();
    const connectTimer = setTimeout(() => { socket.close(); reject(new Error('Chromium CDP connect timeout')); }, 4000);
    socket.addEventListener('error', () => reject(new Error('Chromium debug pipe unavailable')));
    socket.addEventListener('close', () => { for (const item of pending.values()) item.reject(new Error('Chromium session closed')); pending.clear(); });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const item = pending.get(message.id); if (!item) return; pending.delete(message.id);
        message.error ? item.reject(new Error(JSON.stringify(message.error))) : item.resolve(message.result);
      } else {
        if (message.method === 'Runtime.executionContextCreated') contexts.set((message.sessionId || '') + ':' + message.params.context.id, { ...message.params.context, sessionId: message.sessionId });
        if (message.method === 'Runtime.executionContextsCleared') for (const [key, context] of contexts) if ((context.sessionId || '') === (message.sessionId || '')) contexts.delete(key);
        if (message.method === 'Runtime.executionContextDestroyed') contexts.delete((message.sessionId || '') + ':' + message.params.executionContextId);
        for (const listener of listeners.get(message.method) || []) listener(message.params, message.sessionId);
      }
    });
    socket.addEventListener('open', () => { clearTimeout(connectTimer); resolve({
      contexts,
      call(method, params = {}, sessionId) { return new Promise((resolve, reject) => { const id = ++next; const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, method === 'Runtime.evaluate' && params.awaitPromise ? 30000 : 8000); pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); },
      on(method, listener) { let items = listeners.get(method); if (!items) listeners.set(method, items = []); items.push(listener); },
      close() { socket.close(); },
    }); });
  });
}
async function evaluate(context, expression) {
  const result = await client.call('Runtime.evaluate', { contextId: context.id, expression, awaitPromise: true, returnByValue: true }, context.sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
try {
  child = spawn(browser, [...(noProcessSandbox ? ['--no-sandbox'] : []), ...(noGpuSandbox ? ['--disable-gpu-sandbox'] : []), '--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], shell: false });
  child.stderr.on('data', data => { if (stderr.length < 32768) stderr += data; });
  let spawnError; child.on('error', error => { spawnError = error; });
  let port;
  for (let attempt = 0; attempt < 200; attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error('Chromium exited during startup: ' + stderr.slice(0,3000));
    try { port = Number((await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); if (port) break; } catch {}
    await delay(25);
  }
  if (!port) throw new Error('Chromium debug port did not become ready');
  console.log('fixture: Chromium debug port ready');
  const targets = await fetch('http://127.0.0.1:' + port + '/json/list', { signal: AbortSignal.timeout(4000) }).then(response => response.json());
  const target = targets.find(value => value.type === 'page');
  client = await attach(target.webSocketDebuggerUrl); console.log('fixture: CDP connected');
  const blocked = [], errors = [];
  client.on('Fetch.requestPaused', (request, sessionId) => {
    if (request.request.url.startsWith(origin + '/')) {
      const url = new URL(request.request.url);
      const asset = assets.get(url.pathname);
      const responseHeaders = [{ name: 'content-type', value: asset?.type || 'text/plain' }, { name: 'cache-control', value: 'no-store' },{name:'access-control-allow-origin',value:'*'}];
      if (url.pathname.startsWith('/plugin/')) responseHeaders.push({ name: 'content-security-policy', value: "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'" });
      void client.call('Fetch.fulfillRequest', { requestId: request.requestId, responseCode: asset ? 200 : 404, responseHeaders, body: (asset?.body || Buffer.alloc(0)).toString('base64') }, sessionId).catch(() => {});
    } else if (request.request.url === 'about:blank' || request.request.url.startsWith('data:')) void client.call('Fetch.continueRequest', { requestId: request.requestId }, sessionId).catch(() => {});
    else { blocked.push(request.request.url); void client.call('Fetch.failRequest', { requestId: request.requestId, errorReason: 'BlockedByClient' }, sessionId).catch(() => {}); }
  });
  client.on('Target.attachedToTarget', target => {
    if (target.targetInfo.type !== 'iframe') return;
    void (async () => {
      await client.call('Runtime.enable', {}, target.sessionId);
      await client.call('Fetch.enable', { patterns: [{ urlPattern: '*' }] }, target.sessionId);
      await client.call('Runtime.runIfWaitingForDebugger', {}, target.sessionId);
    })().catch(() => {});
  });
  client.on('Runtime.exceptionThrown', value => errors.push(value.exceptionDetails.exception?.description || value.exceptionDetails.text));
  console.log('fixture: enabling fetch guard');
  await client.call('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  console.log('fixture: guard enabled');
  await client.call('Page.enable'); console.log('fixture: page enabled'); await client.call('Runtime.enable'); console.log('fixture: runtime enabled');
  await client.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await client.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await client.call('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  await client.call('Page.navigate', { url: origin + '/host.html' }); console.log('fixture: page navigated');
  let frameContext, hostContext;
  for (let attempt = 0; attempt < 200; attempt++) {
    hostContext = [...client.contexts.values()].find(value => !value.sessionId && value.auxData?.isDefault && value.origin === origin);
    for (const candidate of [...client.contexts.values()].filter(value => value.sessionId && value.auxData?.isDefault)) {
      if (await evaluate(candidate, 'location.href').catch(() => '') === origin + '/plugin/index.html') { frameContext = candidate; break; }
    }
    if (frameContext && hostContext && await evaluate(frameContext, '!!window.lumiExtension?.gateway')) break;
    await delay(25);
  }
  if (!frameContext || !hostContext) { await fs.writeFile(path.join(directory, 'context-debug.json'), JSON.stringify({contexts:[...client.contexts.values()],tree:await client.call('Page.getFrameTree')},null,2)); throw new Error('Sandboxed iframe execution context unavailable'); }
  const scenario = await fs.readFile(path.join(source, 'tests/ui-scenario.js'), 'utf8');
  await evaluate(frameContext,'window.gatewayDenseScenario=('+await fs.readFile(path.join(source,'tests/dense-ui-scenario.js'),'utf8')+')');
  for(const [file,name] of [['dense-layout-probe.js','gatewayDenseLayoutProbe'],['dense-layout-assertions.js','gatewayDenseLayoutAssert']])await evaluate(frameContext,'window.'+name+'=('+await fs.readFile(path.join(source,'tests',file),'utf8')+')');
  console.log('fixture: sandboxed contexts found');
  await evaluate(frameContext,'window.gatewayProviderCatalogScenario=('+await fs.readFile(path.join(source,'tests/provider-catalog-ui-scenario.js'),'utf8')+')');
  const result = await evaluate(frameContext, '(' + scenario + ')()'); console.log('fixture: scenario passed');
  const denseOptions={expectedRoutes:result.denseDisplay.routeCount,expectedRules:result.denseDisplay.ruleCount,selectedRoute:result.denseDisplay.selectedRoute,selectedRule:result.denseDisplay.selectedRule,hostHeight:1000};
  const screenshots = [], viewportChecks = [], screenshotGeometry = [];
  async function capture(name) {
    await evaluate(frameContext, 'document.activeElement?.blur();window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0');
    await evaluate(hostContext, 'document.activeElement?.blur();window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0');
    await delay(60);
    const geometry=await evaluate(frameContext, '({scrollY,introTop:document.querySelector(".page-intro").getBoundingClientRect().top,title:document.querySelector(".page-intro h1").textContent})');
    if(geometry.scrollY!==0||geometry.introTop<0||geometry.title!=='模型网关')throw new Error('Screenshot clipped or misnamed the model gateway header');
    screenshotGeometry.push({name,...geometry});
    await fs.writeFile(path.join(directory, name), Buffer.from((await client.call('Page.captureScreenshot', {format:'png'})).data, 'base64')); screenshots.push(name);
  }
  let mobile;const narrowPanels={};
  for(const width of [1280,600,480]){
    await client.call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await delay(50);
    for(const theme of ['light','dark']){
      await evaluate(hostContext,'fixture.theme('+JSON.stringify(theme)+')');await delay(60);
      if(!await evaluate(frameContext,'document.documentElement.dataset.theme==='+JSON.stringify(theme)+'&&document.body.dataset.theme==='+JSON.stringify(theme)))throw new Error('Default UI theme did not reach the plugin');
      for(const tab of ['gateway','rules','records','settings']){
        await evaluate(frameContext,'document.querySelector('+JSON.stringify('[data-tab="'+tab+'"]')+').click();window.scrollTo(0,0);document.querySelectorAll(".gateway-catalog-scroll").forEach(element=>{element.scrollTop=0;element.scrollLeft=0;})');await delay(30);
        const view=await evaluate(frameContext,`(()=>{
          const rect=element=>{const value=element.getBoundingClientRect();return {left:value.left,top:value.top,width:value.width,height:value.height};};
          const active=[...document.querySelectorAll('.page-tabs button.active')],current=[...document.querySelectorAll('.page-tabs [aria-current="page"]')],panels=[...document.querySelectorAll('[data-panel]')].filter(panel=>!panel.hidden);
          const result={width:innerWidth,content:document.documentElement.scrollWidth,active:active[0]?.dataset.tab,activeCount:active.length,currentCount:current.length,sameActive:active[0]===current[0],visiblePanels:panels.map(panel=>panel.dataset.panel)};
          if(result.active==='rules')result.dense=window.gatewayDenseLayoutAssert(window.gatewayDenseLayoutProbe(),${JSON.stringify(denseOptions)});
          if(result.active==='gateway')result.statsColumns=getComputedStyle(document.querySelector('.gateway-stats')).gridTemplateColumns.split(' ').length;
          if(result.active==='settings')result.settingsColumns=getComputedStyle(document.querySelector('#cli-form .gateway-two-columns')).gridTemplateColumns.split(' ').length;
          return result;
        })()`);
        if(view.active!==tab||view.activeCount!==1||view.currentCount!==1||!view.sameActive||view.visiblePanels.length!==1||view.visiblePanels[0]!==tab)throw new Error('Active tab/panel/aria state is inconsistent');
        if(view.content>view.width+1)throw new Error(theme+'/'+width+'px '+tab+' horizontal overflow');
        if(tab==='gateway'&&view.statsColumns!==(view.width<=520?1:3))throw new Error('Overview stats grid did not respond to viewport');
        if(tab==='settings'&&view.settingsColumns!==(view.width<=520?1:2))throw new Error('CLI settings grid did not respond to viewport');
        viewportChecks.push({theme,viewportWidth:width,tab,...view});
        if(width===600&&theme==='dark'){if(tab==='gateway')mobile=view;else narrowPanels[tab]=view;}
        await capture(theme+'-'+width+'-'+tab+'.png');
      }
    }
  }
  const dark=await evaluate(frameContext,'document.documentElement.dataset.theme');
  await fs.writeFile(path.join(directory,'screenshot-geometry.json'),JSON.stringify(screenshotGeometry,null,2));
  const hostState = await evaluate(hostContext, '({errors:fixture.errors,calls:fixture.calls,exports:fixture.exports,deletes:fixture.deletes,configVersion:fixture.configVersion,credentialsReceived:fixture.credentialsReceived,sandbox:document.getElementById("plugin").getAttribute("sandbox")})');
  if (hostState.sandbox !== 'allow-scripts') throw new Error('Fixture iframe sandbox tokens changed');
  const configMutations = hostState.calls.filter(call => ['gateway.local.configure','gateway.routes.save','gateway.routes.delete','gateway.rules.replace','gateway.recording.config.set'].includes(call.method));
  if (hostState.configVersion !== configMutations.length + 1 || configMutations.some((call, index) => call.input.expectedVersion !== index + 1)) throw new Error('UI configuration writes used stale shared versions');
  const restores = hostState.calls.flatMap((call, index) => call.method === 'gateway.cliConfig.restore' ? [index] : []);
  if (restores.length !== 3 || hostState.calls[restores[1] + 1]?.method !== 'gateway.cliConfig.restore' || hostState.calls[restores[2] + 1]?.method !== 'gateway.listener.stop') throw new Error('Restore failure or restore-before-stop RPC order is unsafe');
  if (errors.length || hostState.errors.length || blocked.length) throw new Error(JSON.stringify({ errors, hostErrors: hostState.errors, blocked }));
  if (hostState.exports.length !== 1 || hostState.exports[0].includeBody !== false) throw new Error('Export must exclude body');
  if (!hostState.calls.some(value => value.method === 'gateway.events.unsubscribe')) throw new Error('Disconnect did not unsubscribe');
  for (const call of hostState.calls) if (/fake-(?:gui|new|rotated|not-submitted)-/.test(JSON.stringify(call))) throw new Error('Fixture audit retained plaintext credential data');
  const denseRouteIds = ['dense-openai-secondary', 'dense-claude', 'dense-paused'];
  const originalCredentialCalls = hostState.calls.filter(call => call.method === 'gateway.local.setup' || call.method === 'gateway.routes.save' && ['codex-main', 'secondary'].includes(call.input.route.id) && call.input.credentials);
  const denseCredentialCalls = hostState.calls.filter(call => call.method === 'gateway.routes.save' && denseRouteIds.includes(call.input.route.id) && call.input.credentials);
  if (result.priorGuiCredentialsReceived !== 3 || originalCredentialCalls.length !== 3 || originalCredentialCalls.filter(call => call.method === 'gateway.local.setup').length !== 1 || originalCredentialCalls.filter(call => call.method === 'gateway.routes.save').length !== 2 || denseCredentialCalls.length !== 3 || denseRouteIds.some(id => denseCredentialCalls.filter(call => call.input.route.id === id).length !== 1) || hostState.credentialsReceived !== 6) throw new Error('Original and dense route credential submissions did not reach typed fixture methods exactly once: ' + JSON.stringify({ prior: result.priorGuiCredentialsReceived, total: hostState.credentialsReceived, original: originalCredentialCalls.map(call => ({ method: call.method, routeId: call.input.route.id })), dense: denseCredentialCalls.map(call => call.input.route.id) }));
  const version = await client.call('Browser.getVersion');
  const report = { ...result, browser: version.product, engine: 'Chrome headless', resourceDelivery: 'CDP static fixture fulfillment', electronHostVerified: false, darkTheme: dark, reducedMotion: true, narrowView: mobile, narrowPanels, viewportChecks, screenshots, methods: [...new Set(hostState.calls.map(call => call.method))], calls: hostState.calls.length, sharedConfigVersion: hostState.configVersion, configMutations: configMutations.length, guiCredentialsReceived: hostState.credentialsReceived, auditSecretsRedacted: true, exported: hostState.exports[0], deleted: hostState.deletes.length, processSandboxEnabled: !noProcessSandbox && !noGpuSandbox, rendererSandboxRequested: !noProcessSandbox, gpuSandboxRequested: !noProcessSandbox && !noGpuSandbox, processSandboxVerified: false, iframeOpaqueOrigin: true, hostDomDenied: true, nodeRequireUnavailable: true, directNetworkDenied: true, iframeSandbox: 'allow-scripts', connectSource: 'none', errors, blocked };
  await fs.writeFile(path.join(directory, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, result: path.join(directory, 'result.json'), screenshots }));
} catch (error) {
  await fs.writeFile(path.join(directory, 'failure.json'), JSON.stringify({ ok: false, error: String(error.stack || error), stderr, engine: 'Chrome headless', processSandboxEnabled: !noProcessSandbox && !noGpuSandbox, rendererSandboxRequested: !noProcessSandbox, gpuSandboxRequested: !noProcessSandbox && !noGpuSandbox, processSandboxVerified: false, electronHostVerified: false }, null, 2));
  throw error;
} finally {
  if (client) { await client.call('Browser.close').catch(() => {}); client.close(); }
  if (child && child.exitCode === null) child.kill();
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}

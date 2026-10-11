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
      const allowed = { '/index.html': 'text/html', '/style.css': 'text/css', '/app.js': 'text/javascript', '/workbench.js':'text/javascript', '/lumi-sdk.js': 'text/javascript','/lumi-ui.css':'text/css' };
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
    await frame.executeJavaScript('window.gatewayCompactProbe=('+fs.readFileSync(path.join(__dirname,'compact-overview-probe.js'),'utf8')+')');
    const result = await frame.executeJavaScript('(' + scenario + ')({legacyPreview:'+JSON.stringify(Boolean(testMode.legacyPreview))+'})');
    const overviewChecks=[],screenshots=[];
    for(const width of [1280,600,480]){win.setContentSize(width,1000);for(const theme of ['light','dark']){
     await win.webContents.executeJavaScript('fixture.theme('+JSON.stringify(theme)+')');
     await frame.executeJavaScript('document.querySelector("[data-tab=gateway]").click();document.body.scrollTop=0;document.documentElement.scrollTop=0;window.scrollTo(0,0)');
     await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,100));
     const probe=await frame.executeJavaScript('window.gatewayCompactProbe()');overviewChecks.push({theme,...probe});
     const name=theme+'-'+width+'-overview.png';fs.writeFileSync(path.join(__dirname,name),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());screenshots.push(name);
    }}
    result.overviewChecks=overviewChecks;result.screenshots=screenshots;
    const dark = await frame.executeJavaScript('document.documentElement.dataset.theme');
    if (dark !== 'dark') throw new Error('Host dark theme was not applied');
    const hostState = await win.webContents.executeJavaScript('({errors:fixture.errors,calls:fixture.calls,exports:fixture.exports,deletes:fixture.deletes,rules:fixture.rules,recording:fixture.recording,configVersion:fixture.configVersion})');
    if (errors.length || hostState.errors.length || blocked.length) throw new Error(JSON.stringify({ errors, hostErrors: hostState.errors, blocked }));
    const connects=hostState.calls.filter(call=>call.method==='gateway.connect');
    if(connects.length<3)throw new Error('Automatic retry flow did not execute');
    if(!hostState.calls.some(call=>call.method==='gateway.events.unsubscribe'))throw new Error('Old event subscription leaked');
    if(hostState.rules.length)throw new Error('Unified deletion retained the inherited tier rule');
    if(!hostState.calls.some(call=>call.method==='gateway.rectifiers.replace'))throw new Error('Native rectifier was not saved');
    for(const call of hostState.calls)if(/fixture-(?:upstream|client).*key/.test(JSON.stringify(call)))throw new Error('Fixture audit retained credentials');
    fs.writeFileSync(path.join(__dirname, 'result.json'), JSON.stringify({ ...result, darkTheme: dark, methods: [...new Set(hostState.calls.map(call => call.method))], calls: hostState.calls.length, export: hostState.exports[0], deleted: hostState.deletes.length, sandbox: 'allow-scripts', processSandboxEnabled: testMode.processSandboxEnabled, connectSource: 'none', errors, blocked }, null, 2));
    console.log(JSON.stringify({ ok: true, result: path.join(__dirname, 'result.json'), screenshots:result.screenshots }));
    app.exit(0);
  } catch (error) {if(win&&!win.isDestroyed()){try{const frames=win.webContents.mainFrame.frames,frame=frames.find(f=>f.url.startsWith('lumi-gateway-fixture:'));fs.writeFileSync(path.join(__dirname,'failure.json'),JSON.stringify({error:String(error),host:await win.webContents.executeJavaScript('({calls:fixture.calls,errors:fixture.errors})'),frame:frame?await frame.executeJavaScript('({notice:document.getElementById("status-message")?.textContent})'):null},null,2));}catch{}}console.error(String(error.stack || error)); app.exit(1); }
});

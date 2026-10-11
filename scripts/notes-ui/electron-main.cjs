const {app, BrowserWindow, protocol} = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

protocol.registerSchemesAsPrivileged([{scheme: 'lumi-extension', privileges: {standard: true, secure: true, supportFetchAPI: true, corsEnabled: true}}]);
for (const name of ['userData', 'sessionData', 'logs', 'crashDumps']) {
  const directory = path.join(__dirname, name);
  fs.mkdirSync(directory, {recursive: true});
  app.setPath(name, directory);
}
app.disableHardwareAcceleration();
const checks = [], screenshots = [], errors = [];
let win;

app.whenReady().then(async () => {
  win = new BrowserWindow({width: 760, height: 420, useContentSize: true, show: false, webPreferences: {sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false}});
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message); });
  protocol.handle('lumi-extension', request => {
    const name = new URL(request.url).pathname.slice(1);
    if (!/^(?:plugin\/)?[a-zA-Z0-9.-]+$/.test(name)) return new Response(null, {status: 404});
    const file = path.join(__dirname, name);
    if (!fs.existsSync(file)) return new Response(null, {status: 404});
    return new Response(fs.readFileSync(file), {headers: {'Content-Type': name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html'}});
  });
  await win.loadURL('lumi-extension://host/index.html');
  let frame;
  const parent = code => win.webContents.executeJavaScript(code);
  const child = code => frame.executeJavaScript(code);
  const until = async (callback, label) => {
    const deadline = Date.now() + 6000;
    while (!await callback()) {
      if (Date.now() >= deadline) throw new Error('Notes UI timeout: ' + label);
      await new Promise(resolve => setTimeout(resolve, 15));
    }
  };
  const check = async (expression, label) => { assert.equal(await child(expression), true, label); checks.push(label); };
  const input = value => child(`document.getElementById('note').value=${JSON.stringify(value)};document.getElementById('note').dispatchEvent(new Event('input',{bubbles:true}));`);
  const click = () => child("document.getElementById('save').click()");
  const screenshot = async name => {
    await child('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const file = path.join(__dirname, name + '.png');
    fs.writeFileSync(file, (await win.webContents.capturePage()).toPNG());
    screenshots.push(file);
  };

  await until(async () => {
    frame = win.webContents.mainFrame.frames.find(item => item.url.endsWith('/plugin/index.html'));
    return frame && await parent('fixture.reads.length===1');
  }, 'official SDK storage read');
  await check("typeof require==='undefined' && typeof window.lumiExtension.storage.write==='function'", 'sandbox uses the official SDK without Node access');
  await check("document.getElementById('save').disabled", 'save disabled while storage read is pending');
  await input('加载时输入的便笺\n稍后返回的旧值不能覆盖这段文字。');
  await parent('fixture.resolveRead()');
  await until(() => child("!document.getElementById('save').disabled"), 'initial load');
  await check("document.getElementById('note').value.startsWith('加载时输入') && document.getElementById('status').textContent==='未保存'", 'late initial read preserves edits');
  await screenshot('notes-light');

  await click();
  await until(() => parent('fixture.writes.length===1'), 'first write');
  await child("for(let index=0;index<30;index++){document.getElementById('note').value='第 '+index+' 稿';document.getElementById('note').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('save').click();}");
  assert.equal(await parent('fixture.writes.length'), 1);
  await parent('fixture.finishWrite(0)');
  await until(() => parent('fixture.writes.length===2'), 'coalesced next write');
  assert.equal(await parent('fixture.writes[1].input.value'), '第 29 稿');
  assert.equal(await parent('fixture.maxActiveWrites'), 1);
  checks.push('30 rapid saves coalesce into one serial follow-up write');

  await input('尚未请求保存的后续编辑');
  await parent('fixture.finishWrite(1)');
  await until(() => child("document.getElementById('status').textContent==='未保存'"), 'unsaved edit status');
  assert.equal(await parent('fixture.stored'), '第 29 稿');
  checks.push('completion does not mark later edits as saved');
  await click();
  await until(() => parent('fixture.writes.length===3'), 'failure write');
  await parent("fixture.finishWrite(2,'隔离存储暂时不可用')");
  await until(() => child("document.getElementById('status').textContent.includes('保存失败')"), 'save failure');
  await check("document.getElementById('note').value==='尚未请求保存的后续编辑'", 'failed save retains the text');
  await click();
  await until(() => parent('fixture.writes.length===4'), 'retry');
  await parent('fixture.finishWrite(3)');
  await until(() => child("document.getElementById('status').textContent==='已保存'"), 'successful retry');
  checks.push('retry writes the preserved text and reports success');

  await parent("fixture.theme('dark')");
  await until(() => child("document.documentElement.dataset.theme==='dark'"), 'dark theme');
  await check("getComputedStyle(document.querySelector('main')).backgroundColor==='rgb(23, 36, 31)'", 'official context event updates the dark theme');
  await screenshot('notes-dark');
  assert.deepEqual(errors, [], 'renderer errors');
  fs.writeFileSync(path.join(__dirname, 'result.json'), JSON.stringify({passed: true, checks, screenshots, maxActiveWrites: await parent('fixture.maxActiveWrites'), electron: process.versions.electron, chromium: process.versions.chrome}, null, 2));
  win.destroy();
  app.exit(0);
}).catch(async error => {
  fs.writeFileSync(path.join(__dirname, 'result.json'), JSON.stringify({passed: false, error: error.stack || String(error), checks, screenshots, errors}, null, 2));
  if (win && !win.isDestroyed()) win.destroy();
  app.exit(1);
});

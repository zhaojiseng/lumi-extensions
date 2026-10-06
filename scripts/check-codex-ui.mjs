import {mkdir,mkdtemp,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),host=path.resolve(process.argv[2] || '../main');
const requireHost=createRequire(path.join(host,'package.json')),electron=requireHost('electron');
const output=path.join(root,'.cache/codex-ui');await mkdir(output,{recursive:true});const fixture=await mkdtemp(path.join(output,'fixture-'));
try{
  await cp(path.join(root,'plugins/extension.lumi.codex'),path.join(fixture,'plugin'),{recursive:true});
  await writeFile(path.join(fixture,'plugin/lumi-sdk.js'),await readFile(path.join(host,'public/lumi-extension-sdk.js')));
  await writeFile(path.join(fixture,'index.html'),'<meta charset="UTF-8"><iframe sandbox="allow-scripts" src="plugin/index.html" style="width:100%;height:760px;border:0"></iframe><script src="harness.js"></script>');
  await writeFile(path.join(fixture,'harness.js'),String.raw`
window.fixture={requests:[],answers:[],subscribed:false,thread:0};
const frame=document.querySelector('iframe'),protocol='lumi-extension/1',nonce='fixture';
fixture.emit=(method,params,id)=>frame.contentWindow.postMessage({protocol,nonce,type:'event',topic:'codex.bridge',payload:{method,params,id}},'*');
addEventListener('message',event=>{const q=event.data;if(event.source!==frame.contentWindow || q?.protocol!==protocol)return;
if(q.type==='ready'){frame.contentWindow.postMessage({protocol,nonce,type:'init',context:{theme:'light',locale:'zh-CN',site:{id:'fixture',url:'https://fixture.invalid',name:'Fixture'}},view:{id:'page',slot:'sidebar'}},'*');return;}
if(q.type!=='request')return;fixture.requests.push(q);let data={};
if(q.method==='codex.bridge.subscribe')fixture.subscribed=true;
if(q.method==='codex.bridge.unsubscribe')fixture.subscribed=false;
if(q.method==='codex.bridge.respond'){fixture.answers.push(q.input);if(fixture.rejectAnswer){fixture.rejectAnswer=false;frame.contentWindow.postMessage({protocol,nonce,type:'response',id:q.id,ok:false,error:'fixture response failure'},'*');return;}}
if(q.method==='codex.bridge.chooseDirectory')data={path:'C:/fixture/project'};
if(q.method==='codex.bridge.send'){const p=q.input.params,m=q.input.method;let result={};
if(m==='model/list')result={data:[{id:'fixture-a',supportedReasoningEfforts:[{reasoningEffort:'low'}]},{id:'fixture-b',supportedReasoningEfforts:[{reasoningEffort:'high'}]}]};
if(m==='thread/list')result={data:[{id:'history',name:'旧会话',updatedAt:1}]};
if(m==='thread/start')result={thread:{id:'thread-'+(++fixture.thread),cwd:p.cwd}};
if(m==='thread/read' || m==='thread/resume')result={thread:{id:p.threadId,name:'旧会话',turns:[]}};
if(m==='turn/start')result={turn:{id:'turn-1'}};
data={result};}
frame.contentWindow.postMessage({protocol,nonce,type:'response',id:q.id,ok:true,data},'*');});`);
  await writeFile(path.join(fixture,'main.cjs'),String.raw`
const {app,BrowserWindow,protocol}=require('electron'),path=require('node:path'),fs=require('node:fs');protocol.registerSchemesAsPrivileged([{scheme:'lumi-test',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
for(const name of ['userData','sessionData','logs','crashDumps']){const dir=path.join(__dirname,name);fs.mkdirSync(dir,{recursive:true});app.setPath(name,dir);}app.disableHardwareAcceleration();
app.whenReady().then(async()=>{const win=new BrowserWindow({width:1200,height:900,show:process.platform==='darwin',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
protocol.handle('lumi-test',request=>{const name=new URL(request.url).pathname.slice(1);if(!/^(?:plugin\/)?[a-zA-Z0-9.-]+$/.test(name))return new Response(null,{status:404});return new Response(fs.readFileSync(path.join(__dirname,name)),{headers:{'Content-Type':name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html'}});});await win.loadURL('lumi-test://host/index.html');let frame;
const until=async(fn)=>{const end=Date.now()+6000;while(!await fn()){if(Date.now()>end)throw new Error('Codex UI timeout '+fn.toString()+'; '+(frame ? await frame.executeJavaScript('document.body.innerText') : '')+'; '+JSON.stringify(await win.webContents.executeJavaScript('fixture.requests')));await new Promise(r=>setTimeout(r,20));}};
await until(async()=>{frame=win.webContents.mainFrame.frames.find(f=>f.url.includes('/plugin/index.html'));return frame && await frame.executeJavaScript('!!document.getElementById("model-select").options.length');});
const child=code=>frame.executeJavaScript(code),parent=code=>win.webContents.executeJavaScript(code),check=async(code,label)=>{if(!await child(code))throw new Error(label);};
await check('!document.getElementById("send").disabled','connected composer');
await child('document.getElementById("model-select").value="fixture-b";document.getElementById("model-select").dispatchEvent(new Event("change"))');
await check('[...document.getElementById("effort-select").options].some(o=>o.value==="high")','effort tracks selected model');
await child('document.getElementById("pick-cwd").click()');await until(()=>child('document.getElementById("cwd-line").textContent.includes("fixture/project")'));
await child('document.getElementById("new-thread").click()');await until(()=>child('document.getElementById("thread-meta").textContent.includes("thread-1")'));
await child('document.getElementById("rename-thread").click();document.getElementById("rename-input").value="已重命名";document.getElementById("save-rename").click()');
await until(()=>child('document.getElementById("thread-title").textContent==="已重命名"'));
await child('document.getElementById("prompt").value="fixture task";document.getElementById("send").click()');
await until(()=>child('!document.getElementById("interrupt").disabled'));
await check('document.getElementById("new-thread").disabled','running turn prevents switching');
await parent('fixture.emit("item/agentMessage/delta",{threadId:"other",itemId:"wrong",delta:"MUST NOT APPEAR"});fixture.emit("item/agentMessage/delta",{threadId:"thread-1",itemId:"answer",delta:"流式回复"});fixture.emit("item/commandExecution/requestApproval",{threadId:"thread-1",command:"fixture command"},900)');
await until(()=>child('document.querySelector(".approval-actions button")'));
if(await parent('fixture.answers.length')!==0)throw new Error('automatic approval');
await check('!document.getElementById("conversation").textContent.includes("MUST NOT APPEAR")','events scoped to current thread');
await parent('fixture.rejectAnswer=true');await child('document.querySelector(".approval-actions button").click()');await until(()=>child('document.getElementById("status").textContent.includes("fixture response failure")'));
await check('!!document.querySelector(".approval-actions button:not(:disabled)")','failed approval stays actionable');
await child('document.querySelector(".approval-actions button").click()');await until(()=>child('!document.querySelector(".approval")'));if(!await parent('fixture.answers.at(-1).result.decision==="accept"'))throw new Error('approval response envelope');
await parent('fixture.emit("item/tool/requestUserInput",{threadId:"thread-1",questions:[{id:"q",question:"目标名称"}]},901)');
await until(()=>child('!!document.querySelector(".approval textarea")'));await child('document.querySelector(".approval textarea").value="测试答案";document.querySelector(".approval-actions button").click()');
await until(()=>parent('fixture.answers.some(a=>a.id===901 && a.result.answers.q.answers[0]==="测试答案")'));
await parent('fixture.emit("turn/completed",{threadId:"thread-1",turn:{id:"turn-1"}})');await until(()=>child('!document.getElementById("new-thread").disabled'));
await child('document.getElementById("delete-thread").click()');if(await parent('fixture.requests.some(q=>q.input?.method==="thread/delete")'))throw new Error('delete before confirmation');
await child('document.getElementById("cancel-delete").click()');await parent('fixture.emit("lumi/bridge/exited",{detail:"fixture disconnected"})');await until(()=>child('document.getElementById("send").disabled'));
await child('document.getElementById("reconnect").click()');await until(()=>child('!document.getElementById("send").disabled'));
for(const mode of ['light','dark'])for(const width of [1150,640]){win.setSize(width+20,900);await child('document.documentElement.dataset.theme='+JSON.stringify(mode));await child('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await check('document.documentElement.scrollWidth<=innerWidth+1','responsive overflow '+width);fs.writeFileSync(path.join(__dirname,'codex-'+mode+'-'+width+'.png'),(await win.webContents.capturePage()).toPNG());}
console.log('CODEX_UI_OK streaming approvals input retry reconnect models sandbox responsive');win.destroy();app.exit(0);
}).catch(error=>{console.error(error.stack);app.exit(1);});`);
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(electron,[path.join(fixture,'main.cjs')],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let outputText='';child.stdout.on('data',chunk=>outputText+=chunk);child.stderr.on('data',chunk=>outputText+=chunk);
  const timeout=setTimeout(()=>child.kill(),45000);
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});clearTimeout(timeout);
  if(code!==0)throw new Error(outputText);console.log(outputText.trim());
  for(const mode of ['light','dark'])for(const width of [1150,640])await cp(path.join(fixture,`codex-${mode}-${width}.png`),path.join(output,`codex-${mode}-${width}.png`));
}finally{await rm(fixture,{recursive:true,force:true,maxRetries:5,retryDelay:100});}

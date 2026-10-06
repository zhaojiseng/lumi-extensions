import {mkdir,mkdtemp,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),host=path.resolve(process.argv[2] || '../main'),hardware=process.argv.includes('--hardware') || process.env.LUMI_GLASS_HARDWARE==='1';
const requireHost=createRequire(path.join(host,'package.json')),electron=requireHost('electron');
const output=path.join(root,'.cache/codex-ui');await mkdir(output,{recursive:true});const fixture=await mkdtemp(path.join(output,'fixture-'));
try{
  await cp(path.join(root,'plugins/extension.lumi.codex'),path.join(fixture,'plugin'),{recursive:true});
  const {extensionUiCss,extensionSdkRuntime}=await import(pathToFileURL(path.join(host,'scripts/extension-ui.mjs')));
  await writeFile(path.join(fixture,'plugin/lumi-ui.css'),await extensionUiCss(host));
  const dreamyCss=await readFile(path.join(root,'plugins/extension.author.dreamy/interface.css'),'utf8');
  await writeFile(path.join(fixture,'themes.json'),JSON.stringify({default:{id:'interface.default',css:'',appearance:{}},dreamy:{id:'extension.author.dreamy',css:dreamyCss,appearance:{transparency:'clear',blur:'soft',distortion:'strong'}}}));
  await writeFile(path.join(fixture,'plugin/lumi-sdk.js'),await extensionSdkRuntime(host));
  await writeFile(path.join(fixture,'index.html'),'<meta charset="UTF-8"><iframe sandbox="allow-scripts" src="plugin/index.html" style="width:100%;height:760px;border:0"></iframe><script src="harness.js"></script>');
  await writeFile(path.join(fixture,'harness.js'),String.raw`
window.fixture={uiTheme:{id:'interface.default',css:'',appearance:{},theme:'light'},requests:[],answers:[],subscribed:false,thread:0,created:[]};
const frame=document.querySelector('iframe'),protocol='lumi-extension/1',nonce='fixture';
fixture.statuses={history:{type:'idle'},other:{type:'active',activeFlags:[]}};fixture.emit=(method,params,id)=>{if(method==='thread/status/changed')fixture.statuses[params.threadId]=params.status;frame.contentWindow.postMessage({protocol,nonce,type:'event',topic:'codex.bridge',payload:{method,params,id}},'*');};
fixture.respond=(q,data)=>frame.contentWindow.postMessage({protocol,nonce,type:'response',id:q.id,ok:true,data},'*');
fixture.history=Array.from({length:400},(_,index)=>({turnId:'historical-turn-'+Math.floor(index/2),item:{id:'history-item-'+index,type:index%2 ? 'agentMessage' : 'userMessage',...index%2 ? {text:'历史回复 '+index+'。这是用于验证渐进加载、气泡与滚动位置的真实渲染文本。'} : {content:[{type:'text',text:'历史任务 '+index}]}}}));
addEventListener('message',event=>{const q=event.data;if(event.source!==frame.contentWindow || q?.protocol!==protocol)return;
if(q.type==='ready'){frame.contentWindow.postMessage({protocol,nonce,type:'init',uiFeatures:{fillViewport:true},uiTheme:fixture.uiTheme,context:{theme:'light',locale:'zh-CN',site:{id:'fixture',url:'https://fixture.invalid',name:'Fixture'}},view:{id:'page',slot:'sidebar'}},'*');return;}
if(q.type!=='request')return;fixture.requests.push(q);let data={};
if(q.method==='codex.bridge.subscribe')fixture.subscribed=true;
if(q.method==='codex.bridge.unsubscribe')fixture.subscribed=false;
if(q.method==='codex.bridge.respond'){fixture.answers.push(q.input);if(fixture.rejectAnswer){fixture.rejectAnswer=false;frame.contentWindow.postMessage({protocol,nonce,type:'response',id:q.id,ok:false,error:'fixture response failure'},'*');return;}}
if(q.method==='codex.bridge.chooseDirectory')data={path:'C:/fixture/project'};
if(q.method==='codex.bridge.send'){const p=q.input.params,m=q.input.method;let result={};
if(m==='thread/resume' && fixture.activeWriter){fixture.respond(q,{error:{code:-32000,message:'thread '+p.threadId+' already has an active writer'}});return;}
if(m==='model/list')result={data:[{id:'fixture-a',supportedReasoningEfforts:[{reasoningEffort:'low'}]},{id:'fixture-b',supportedReasoningEfforts:[{reasoningEffort:'high'}]}]};
if(m==='thread/list'){
 const rows=p.cursor ? [{id:'history-extra',name:'早期自动任务',cwd:'C:/fixture/alpha',source:'exec',updatedAt:1}] : [{id:'history',name:'项目长对话',cwd:'C:/fixture/alpha',source:'cli',updatedAt:3},{id:'other',name:'另一项目',cwd:'C:/fixture/beta',source:'vscode',updatedAt:2},{id:'legacy',name:'旧存储会话',source:'cli',updatedAt:1},{id:'unsupported',name:'旧版 CLI',source:'cli',updatedAt:1},...fixture.created];
 result={data:rows.filter(row=>(!p.sourceKinds || p.sourceKinds.includes(row.source)) && (!p.searchTerm || row.name.includes(p.searchTerm)) && (!p.cwd || (Array.isArray(p.cwd) ? p.cwd.includes(row.cwd) : p.cwd===row.cwd))).map(row=>({...row,status:fixture.statuses[row.id] || {type:'notLoaded'}})),nextCursor:p.cursor || p.searchTerm || p.cwd ? null : 'thread-page-2'};
 if(fixture.holdNextList){fixture.holdNextList=false;fixture.heldList={q,data:{result}};return;}
}
if(m==='thread/start'){const thread={id:'thread-'+(++fixture.thread),name:'新会话',cwd:p.cwd,source:'appServer',updatedAt:4};fixture.created.push(thread);result={thread};}
if(m==='thread/read' || m==='thread/resume')result={thread:{id:p.threadId,name:fixture.created.find(t=>t.id===p.threadId)?.name || (p.threadId==='other' ? '另一项目' : '项目长对话'),cwd:p.threadId==='other' ? 'C:/fixture/beta' : 'C:/fixture/alpha',status:fixture.activeWriter || ['legacy','unsupported','history-extra'].includes(p.threadId) ? {type:'notLoaded'} : fixture.statuses[p.threadId] || {type:'idle'},turns:[]}};
if(m==='thread/read' && fixture.holdStatus===p.threadId){fixture.holdStatus=null;fixture.heldStatus={q,data:{result}};return;}
if(m==='thread/items/list'){
 if(['legacy','unsupported'].includes(p.threadId)){data={error:{code:-32601,message:'item pagination not supported'}};fixture.respond(q,data);return;}
 const source=p.turnId ? fixture.history.filter(e=>e.turnId===p.turnId) : fixture.history;const end=p.cursor ? Number(p.cursor) : source.length,start=Math.max(0,end-p.limit);
 result=p.sortDirection==='asc' ? {data:source.slice(0,p.limit),nextCursor:null,backwardsCursor:null} : {data:p.threadId==='history' ? source.slice(start,end).reverse() : [],nextCursor:p.threadId==='history' && start ? String(start) : null};
 if(fixture.failNextHistory){fixture.failNextHistory=false;fixture.respond(q,{error:{code:-32000,message:'history fixture failed'}});return;}
 if(fixture.repeatCursor){fixture.repeatCursor=false;result.nextCursor=p.cursor;}
 if(fixture.holdNextHistory){fixture.holdNextHistory=false;fixture.heldHistory={q,data:{result}};return;}
}
if(m==='thread/turns/list'){
 if(p.threadId==='unsupported'){fixture.respond(q,{error:{code:-32601,message:'unknown method'}});return;}
 if(p.itemsView==='notLoaded' && p.limit===1 && p.threadId!=='history')result={data:[{id:'metadata-'+p.threadId,status:fixture.turnStatuses?.[p.threadId] || (p.threadId==='history-extra' ? 'failed' : 'completed'),items:[]}],nextCursor:null};
 else if(p.threadId==='legacy')result={data:[{id:'legacy-turn',status:'completed',items:[{id:'legacy-user',type:'userMessage',content:[{type:'text',text:'旧会话任务'}]},{id:'legacy-answer',type:'agentMessage',text:'旧存储分轮加载'}]}],nextCursor:null};
 else if(p.itemsView==='summary'){const turns=[...new Set(fixture.history.map(e=>e.turnId))],start=p.cursor ? Number(p.cursor) : 0,end=Math.min(turns.length,start+p.limit);result={data:p.threadId==='history' ? turns.slice(start,end).map(id=>({id,status:'completed',items:fixture.history.filter(e=>e.turnId===id && e.item.type==='userMessage').map(e=>e.item)})) : [],nextCursor:p.threadId==='history' && end<turns.length ? String(end) : null};}
 else {const end=p.cursor ? Number(p.cursor) : 200,start=Math.max(0,end-p.limit);result={data:p.threadId==='history' ? Array.from({length:end-start},(_,offset)=>({id:'historical-turn-'+(end-1-offset),status:'completed',durationMs:end-1-offset===199 ? 65000 : 4500,items:[]})) : [],nextCursor:start ? String(start) : null};}
}
if(m==='thread/name/set'){const thread=fixture.created.find(t=>t.id===p.threadId);if(thread)thread.name=p.name;}
if(m==='turn/start')result={turn:{id:'turn-1'}};
data={result};}
fixture.respond(q,data);});`);
  await writeFile(path.join(fixture,'main.cjs'),String.raw`
const {app,BrowserWindow,protocol}=require('electron'),path=require('node:path'),fs=require('node:fs');protocol.registerSchemesAsPrivileged([{scheme:'lumi-test',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
for(const name of ['userData','sessionData','logs','crashDumps']){const dir=path.join(__dirname,name);fs.mkdirSync(dir,{recursive:true});app.setPath(name,dir);}if(!process.argv.includes('--hardware'))app.disableHardwareAcceleration();
app.whenReady().then(async()=>{const win=new BrowserWindow({width:1200,height:900,show:process.platform==='darwin',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
protocol.handle('lumi-test',request=>{const name=new URL(request.url).pathname.slice(1);if(!/^(?:plugin\/)?[a-zA-Z0-9.-]+$/.test(name))return new Response(null,{status:404});return new Response(fs.readFileSync(path.join(__dirname,name)),{headers:{'Content-Type':name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html'}});});await win.loadURL('lumi-test://host/index.html');let frame;
const until=async(fn)=>{const end=Date.now()+6000;while(!await fn()){if(Date.now()>end)throw new Error('Codex UI timeout '+fn.toString()+'; '+(frame ? await frame.executeJavaScript('document.body.innerText') : '')+'; '+JSON.stringify(await win.webContents.executeJavaScript('fixture.requests')));await new Promise(r=>setTimeout(r,20));}};
await until(async()=>{frame=win.webContents.mainFrame.frames.find(f=>f.url.includes('/plugin/index.html'));return frame && await frame.executeJavaScript('!!document.getElementById("model-select").options.length');});
const child=code=>frame.executeJavaScript(code),parent=code=>win.webContents.executeJavaScript(code),check=async(code,label)=>{try{if(!await child(code))throw new Error(label);}catch(error){throw new Error(label+': '+String(error));}};
const paint=async()=>{await child('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await win.webContents.capturePage();await child('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');};
await until(()=>child('!document.getElementById("send").disabled'));await check('!document.getElementById("send").disabled','connected composer');
await check('[...document.querySelectorAll(".project-heading strong")].map(e=>e.textContent).includes("alpha") && [...document.querySelectorAll(".project-heading strong")].map(e=>e.textContent).includes("beta")','project groups');
await until(()=>child('document.querySelector("[data-thread=legacy] .thread-state").textContent==="已完成" && document.querySelector("[data-thread=unsupported] .thread-state").textContent==="状态未知"'));
await check('state.thread===null && document.querySelector("[data-thread=history] .thread-state").textContent==="空闲" && document.querySelector("[data-thread=other] .thread-state").textContent==="工作中"','runtime and last-turn statuses available before opening any thread');
if(await parent('fixture.requests.some(q=>q.input?.method==="thread/resume" || q.input?.method==="thread/items/list" || q.input?.method==="thread/read" && q.input.params.includeTurns)'))throw Error('initial status hydration loaded bodies or resumed threads');
await child('clearTimeout(threadStatusTimer);window.statusRow=document.querySelector("[data-thread=other]");statusRow.focus();window.statusMutations=0;window.statusObserver=new MutationObserver(records=>statusMutations+=records.length);statusObserver.observe(document.getElementById("thread-list"),{subtree:true,childList:true,attributes:true,characterData:true});scheduleThreadStatusRefresh(1000)');
const pollingStart=await parent('fixture.requests.length');
await child('new Promise(r=>setTimeout(r,1150))');
await check('document.querySelector("[data-thread=other]")===statusRow && document.activeElement===statusRow && statusMutations===0','unchanged one-second tick preserves row nodes/focus and does not mutate list');
if(await parent('fixture.requests.slice('+pollingStart+').filter(q=>q.input?.method==="thread/list").length')!==1)throw Error('one-second tick did not make one bounded metadata request');
await parent('fixture.statuses.other={type:"active",activeFlags:["waitingOnApproval"]};fixture.turnStatuses={legacy:"interrupted"}');
await until(()=>child('document.querySelector("[data-thread=other] .thread-state").textContent==="待确认" && document.querySelector("[data-thread=legacy] .thread-state").textContent==="已中断"'));
await check('document.querySelector("[data-thread=other]")===statusRow','status change replaced entire row');
await child('clearTimeout(threadStatusTimer);statusObserver.disconnect();window.savedThreadRows=state.threads;const extra=Array.from({length:400},(_,i)=>({id:"offscreen-"+i,cwd:"C:/fixture/offscreen",status:{type:"notLoaded"}}));collapsedProjects.add(projectKey(extra[0]));state.threads=[...state.threads,...extra];renderThreads()');
const boundedStart=await parent('fixture.requests.length');await child('refreshThreadStatuses()');await child('clearTimeout(threadStatusTimer)');
if(await parent('fixture.requests.slice('+boundedStart+').some(q=>q.input?.params?.threadId?.startsWith("offscreen-"))'))throw Error('collapsed history triggered per-thread polling');
await child('collapsedProjects.delete(projectKey(state.threads.at(-1)));renderThreads();document.getElementById("thread-list").scrollTop=1000000;window.rowMeasurements=0;for(const row of expandedThreadRows){const measure=row.getBoundingClientRect.bind(row);row.getBoundingClientRect=()=>{rowMeasurements++;return measure()}}');
const longListStart=await parent('fixture.requests.length');await child('refreshThreadStatuses()');await child('clearTimeout(threadStatusTimer)');
await check('rowMeasurements<35','one-second tick measured the full 400-row history');
if(await parent('fixture.requests.slice('+longListStart+').filter(q=>q.method==="codex.bridge.send").length')>30)throw Error('long history made unbounded status requests');
console.log('CODEX_STATUS_PERF',JSON.stringify({historicalRows:400,layoutMeasurements:await child('rowMeasurements'),refreshRequests:await parent('fixture.requests.slice('+longListStart+').filter(q=>q.method==="codex.bridge.send").length')}));
await child('state.threads=savedThreadRows;renderThreads()');
await parent('fixture.holdNextList=true');await child('void refreshThreadStatuses()');await until(()=>parent('!!fixture.heldList'));
const heldStart=await parent('fixture.requests.length');await child('refreshThreadStatuses();refreshThreadStatuses()');
if(await parent('fixture.requests.length')!==heldStart)throw Error('slow status refresh overlapped');
await parent('fixture.emit("thread/status/changed",{threadId:"other",status:{type:"active",activeFlags:["waitingOnUserInput"]}});fixture.respond(fixture.heldList.q,fixture.heldList.data);fixture.heldList=null');
await until(()=>child('!threadStatusPending'));await child('clearTimeout(threadStatusTimer)');
await check('document.querySelector("[data-thread=other] .thread-state").textContent==="待输入"','stale poll overwrote live event');
await child('Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});document.dispatchEvent(new Event("visibilitychange"))');
const hiddenStart=await parent('fixture.requests.length');await child('refreshThreadStatuses()');await child('new Promise(r=>setTimeout(r,1050))');
if(await parent('fixture.requests.length')!==hiddenStart)throw Error('hidden window kept polling');
await child('delete document.hidden');await parent('fixture.turnStatuses={};fixture.emit("thread/status/changed",{threadId:"other",status:{type:"active",activeFlags:[]}})');
await parent('fixture.holdStatus="legacy"');await child('loadThreads()');await until(()=>parent('!!fixture.heldStatus'));
await parent('fixture.emit("thread/status/changed",{threadId:"legacy",status:{type:"active",activeFlags:["waitingOnUserInput"]}})');
await until(()=>child('document.querySelector("[data-thread=legacy] .thread-state").textContent==="待输入"'));
await parent('fixture.respond(fixture.heldStatus.q,fixture.heldStatus.data);fixture.heldStatus=null');await child('new Promise(r=>setTimeout(r,60))');
await check('document.querySelector("[data-thread=legacy] .thread-state").textContent==="待输入"','late status metadata cannot replace live event');
await parent('fixture.emit("thread/status/changed",{threadId:"legacy",status:{type:"notLoaded"}})');
await child('document.getElementById("load-threads").click()');await until(()=>child('!!document.querySelector("[data-thread=history-extra]")'));
await until(()=>child('document.querySelector("[data-thread=history-extra] .thread-state").textContent==="异常"'));
await child('document.querySelector("[data-thread=history]").click()');await until(()=>child('document.querySelectorAll("#messages .item").length===40 && !document.getElementById("send").disabled'));
await check('document.querySelector("#messages .item").dataset.key==="item:history-item-360" && document.querySelector("#messages .item:last-of-type").dataset.key==="item:history-item-399"','recent history in chronological order');
await until(()=>child('state.indexHistory?.done && !state.indexHistory.loading'));
await check('document.querySelectorAll(".turn-marker").length===200','rail only indexes loaded user messages');
await check('(()=>{const n=document.querySelector(".turn-navigation").getBoundingClientRect(),s=document.getElementById("stream-stage").getBoundingClientRect(),r=document.getElementById("turn-rail");return n.height<=s.height/2+.1 && Math.abs(n.top+n.height/2-s.top-s.height/2)<1 && r.scrollHeight<=r.clientHeight+1 && [...r.children].every(m=>{const b=m.getBoundingClientRect();return b.top>=n.top-.1 && b.bottom<=n.bottom+.1})})()','all 200 markers fit centered half-height rail');
await check('parseFloat(getComputedStyle(document.querySelector(".turn-marker"),"::before").width)===5.5','default marker half original length');
await check('(()=>{const m=document.querySelector(".turn-marker"),r=m.getBoundingClientRect(),s=document.getElementById("stream-stage").getBoundingClientRect();return Math.abs(r.left-s.left+7)<1 && document.elementFromPoint(r.left+4,r.top+r.height/2)===m})()','wide rail moves left by one third of reserved space without clipping its stroke');
await child('window.railStressIndex=new Map(state.userIndex);window.originalRailPitch=document.querySelector(".turn-marker").getBoundingClientRect().height;document.getElementById("prompt").value=Array(30).fill("multiline draft").join("\\n");resizePrompt()');
await until(()=>child('document.querySelector(".turn-marker").getBoundingClientRect().height<originalRailPitch'));
await check('document.getElementById("turn-rail").scrollHeight<=document.getElementById("turn-rail").clientHeight+1','composer growth recomputes compressed spacing');
await child('document.getElementById("prompt").value="";resizePrompt()');await until(()=>child('document.querySelector(".turn-marker").getBoundingClientRect().height===originalRailPitch'));
await child('document.querySelector(".turn-marker[data-item=history-item-360]").focus();document.querySelector(".turn-marker[data-item=history-item-360]").dispatchEvent(new FocusEvent("focus"))');
await until(()=>child('document.getElementById("turn-preview").classList.contains("visible")'));
await check('document.getElementById("turn-preview").classList.contains("visible") && document.getElementById("turn-preview-text").textContent.endsWith("360")','keyboard rail preview');
await child('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}))');await check('!document.getElementById("turn-preview").classList.contains("visible")','escape dismisses preview');
await child('document.querySelector(".turn-marker[data-item=history-item-360]").click()');
await check('document.querySelector(".turn-marker.current").dataset.item==="history-item-360" && Math.abs(document.querySelector("#messages .item").getBoundingClientRect().top-document.getElementById("conversation").getBoundingClientRect().top-16)<5','rail jump position');
const markerPoint=await child('(()=>{const r=document.querySelector(".turn-marker[data-item=history-item-360]").getBoundingClientRect();return {x:r.x+12,y:r.y+r.height/2}})()'),framePoint=await parent('(()=>{const r=document.querySelector("iframe").getBoundingClientRect();return {x:r.x,y:r.y}})()');
win.show();win.focus();win.webContents.focus();await child('new Promise(r=>setTimeout(r,100))');
win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(markerPoint.x+framePoint.x),y:Math.round(markerPoint.y+framePoint.y)});
await until(()=>child('document.getElementById("turn-preview").classList.contains("visible")'));await child('new Promise(r=>setTimeout(r,220))');
await check('parseFloat(getComputedStyle(document.querySelector(".turn-marker[data-item=history-item-360]"),"::before").width)>=22 && getComputedStyle(document.querySelector(".turn-marker[data-item=history-item-360]")).cursor==="default"','native hover animation and cursor');
await check('(()=>{const m=document.querySelector(".turn-marker[data-item=history-item-360]"),w=e=>parseFloat(getComputedStyle(e,"::before").width);let p=m.previousElementSibling,n=m.nextElementSibling;for(const expected of [17.875,13.75,9.625,5.5]){if(Math.abs(w(p)-expected)>.1 || Math.abs(w(n)-expected)>.1)return false;p=p.previousElementSibling;n=n.nextElementSibling}return true})()','symmetric neighboring markers progressively extend');
await check('(()=>{const p=document.getElementById("turn-preview").getBoundingClientRect(),s=document.getElementById("stream-stage").getBoundingClientRect();return p.left>=s.left && p.right<=s.right && p.top>=s.top && p.bottom<=s.bottom})()','preview viewport bounds');
fs.writeFileSync(path.join(__dirname,'codex-turn-rail.png'),(await win.webContents.capturePage()).toPNG());await child('hideTurnPreview();document.activeElement.blur()');
await child('new Promise(r=>setTimeout(r,220))');await check('[...document.querySelectorAll(".turn-marker")].every(m=>parseFloat(getComputedStyle(m,"::before").width)===5.5)','marker lengths reset after dismissing preview');
await child('window.savedUserIndex=state.userIndex;state.userIndex=new Map([...state.userIndex].slice(170,190));renderTurnRail()');
await child('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
await check('Math.abs(document.querySelector(".turn-marker").getBoundingClientRect().height-(2+16/3))<.02','default empty space one third of original');
await child('showTurnPreview(document.querySelector(".turn-marker[data-item=history-item-360]"));');await child('new Promise(r=>setTimeout(r,220))');
fs.writeFileSync(path.join(__dirname,'codex-turn-rail-expanded.png'),(await win.webContents.capturePage()).toPNG());
await child('state.userIndex=new Map([...savedUserIndex].slice(180,181));renderTurnRail()');
await check('(()=>{const m=document.querySelector(".turn-marker").getBoundingClientRect(),r=document.getElementById("turn-rail").getBoundingClientRect();return Math.abs(m.top+m.height/2-r.top-r.height/2)<1})()','single marker remains centered');
await child('state.userIndex=savedUserIndex;delete window.savedUserIndex;renderTurnRail();jumpLatest()');
if(await parent('fixture.requests.filter(q=>q.input?.method==="thread/items/list" && q.input.params.threadId==="history").length')!==1)throw new Error('initial history loaded more than one page');
await check('document.getElementById("messages").textContent.includes("耗时 1 分 5 秒")','historical turn duration');
if(!await parent('fixture.requests.some(q=>q.input?.method==="thread/resume" && q.input.params.threadId==="history" && q.input.params.excludeTurns)'))throw Error('idle thread not subscribed');
await parent('fixture.emit("thread/status/changed",{threadId:"other",status:{type:"active",activeFlags:["waitingOnApproval"]}})');
await until(()=>child('document.querySelector("[data-thread=other] .thread-state").textContent==="待确认"'));
await parent('fixture.emit("thread/status/changed",{threadId:"other",status:{type:"idle"}})');
await until(()=>child('document.querySelector("[data-thread=other] .thread-state").textContent==="空闲"'));
await parent('fixture.emit("thread/status/changed",{threadId:"history",status:{type:"active",activeFlags:[]}})');
await until(()=>child('document.querySelector("[data-thread=history] .thread-state").textContent==="工作中"'));
await parent('fixture.emit("thread/status/changed",{threadId:"history",status:{type:"idle"}})');await until(()=>child('!state.busy'));
await parent('fixture.emit("thread/status/changed",{threadId:"history",status:{type:"active",activeFlags:[]}})');await until(()=>child('state.busy'));
await parent('fixture.statuses.history={type:"idle"};fixture.holdStatus="history"');
await child('clearTimeout(syncTimer);void syncCurrentThread()');await until(()=>parent('!!fixture.heldStatus'));
await parent('fixture.emit("thread/status/changed",{threadId:"other",status:{type:"active",activeFlags:["waitingOnApproval"]}});fixture.respond(fixture.heldStatus.q,fixture.heldStatus.data);fixture.heldStatus=null');
await until(()=>child('!syncPending'));await child('clearTimeout(syncTimer)');await check('!state.busy && state.thread.status.type==="idle"','another thread event blocked selected thread metadata');
await parent('fixture.emit("thread/status/changed",{threadId:"other",status:{type:"idle"}})');
await parent('fixture.history.push({turnId:"external-turn",item:{id:"external-update",type:"agentMessage",text:"external live update"}})');
await child('(async()=>{clearTimeout(syncTimer);await syncCurrentThread();clearTimeout(syncTimer)})()');
await check('state.items.some(item=>item.id==="external-update")','external latest snapshot missing');
await parent('fixture.history.pop()');await child('state.items=state.items.filter(item=>item.id!=="external-update");state.itemIndex.delete("external-update");state.windowEnd=state.items.length;renderConversation()');
await parent('fixture.activeWriter=true');await child('document.querySelector("[data-thread=history]").click()');await until(()=>child('state.externalWriter && !state.switching'));
await child('state.turns.set("historical-turn-199",{id:"historical-turn-199",status:"interrupted"});renderConversation();renderStatus()');
await check('document.querySelector("[data-thread=history] .thread-state").textContent==="工作中" && document.getElementById("status").textContent.includes("其他 Codex") && !document.getElementById("messages").textContent.includes("已中断")','writer conflict shown as interrupted/unloaded');
await check('document.getElementById("send").disabled && !document.querySelector("[data-thread=other]").disabled','external writer allows browse but blocks sending');
await child('(async()=>{clearTimeout(syncTimer);await syncCurrentThread();clearTimeout(syncTimer)})()');await check('state.externalWriter && document.querySelector("[data-thread=history] .thread-state").textContent==="工作中"','notLoaded overwrote active writer');
await parent('fixture.activeWriter=false;fixture.emit("turn/completed",{threadId:"history",turn:{id:"historical-turn-199",status:"completed",durationMs:65000}})');await until(()=>child('!state.busy && !state.externalWriter'));
await child('document.querySelector("[data-thread=history]").click()');await until(()=>child('state.items.length===40 && !state.switching'));
await parent('fixture.failNextHistory=true');await child('document.getElementById("load-older").click()');await until(()=>child('document.getElementById("history-note").textContent.includes("history fixture failed")'));
await child('document.getElementById("load-older").click()');await until(()=>child('document.querySelectorAll("#messages .item").length===80'));
await child('document.getElementById("conversation").scrollTop=80');await child('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
await child('(()=>{const paneTop=document.getElementById("conversation").getBoundingClientRect().top;const anchor=[...document.getElementById("messages").children].find(e=>e.getBoundingClientRect().bottom>paneTop+10);window.historyAnchor={key:anchor.dataset.key,top:anchor.getBoundingClientRect().top};document.getElementById("load-older").click()})()');
await until(()=>child('document.querySelectorAll("#messages .item").length===120'));await child('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
await check('Math.abs([...document.getElementById("messages").children].find(e=>e.dataset.key===window.historyAnchor.key).getBoundingClientRect().top-window.historyAnchor.top)<5','history prepend moved reading anchor');
for(const count of [160,200]){await child('document.getElementById("load-older").click()');await until(()=>child('state.items.length==='+count+' && !state.history.loading'));}
await check('document.querySelectorAll("#messages .item").length<=160 && document.querySelectorAll("#messages .turn-footer").length<=80','history DOM grew without bound');

await child('jumpLatest()');const beforeCached=await parent('fixture.requests.filter(q=>q.input?.method==="thread/items/list").length');await child('document.getElementById("load-older").click()');await check('state.windowStart===0 && state.windowEnd<state.items.length','cached older window');
if(await parent('fixture.requests.filter(q=>q.input?.method==="thread/items/list").length')!==beforeCached)throw new Error('cached messages fetched again');
await parent('fixture.emit("item/completed",{threadId:"history",turnId:"historical-live",item:{id:"live-while-reading",type:"agentMessage",text:"最新消息"}})');await until(()=>child('state.items.some(item=>item.id==="live-while-reading")'));
await check('!document.querySelector("[data-key=\\"item:live-while-reading\\"]")','live message displaced older reading window');await child('jumpLatest()');await check('!!document.querySelector("[data-key=\\"item:live-while-reading\\"]")','jump to latest message');
fs.writeFileSync(path.join(__dirname,'codex-history.png'),(await win.webContents.capturePage()).toPNG());
await child('document.querySelector("[data-thread=history]").click()');await until(()=>child('state.items.length===40 && !state.switching'));
await parent('fixture.repeatCursor=true');await child('document.getElementById("load-older").click()');await until(()=>child('document.getElementById("history-note").textContent.includes("游标未前进")'));await check('state.items.length===40','repeated cursor changed history');
await child('document.getElementById("load-older").click()');await until(()=>child('state.items.length===80 && !state.history.loading'));
await parent('fixture.holdNextHistory=true');await child('document.getElementById("load-older").click()');await until(()=>parent('!!fixture.heldHistory'));
await child('document.querySelector("[data-thread=other]").click()');await until(()=>child('document.getElementById("thread-title").textContent==="另一项目" && !state.switching'));
await parent('fixture.respond(fixture.heldHistory.q,fixture.heldHistory.data);fixture.heldHistory=null');await child('new Promise(r=>setTimeout(r,100))');await check('!document.getElementById("messages").textContent.includes("历史任务")','late history crossed thread');
await child('document.querySelector("[data-thread=legacy]").click()');await until(()=>child('document.getElementById("messages").textContent.includes("旧存储分轮加载")'));
await check('document.getElementById("history-note").textContent.includes("每次载入 4 轮") && document.getElementById("messages").textContent.includes("耗时未知")','legacy page fallback fabricated duration');
await child('document.querySelector("[data-thread=unsupported]").click()');await until(()=>child('document.getElementById("history-note").textContent.includes("请更新 Codex CLI")'));
if(await parent('fixture.requests.some(q=>q.input?.method==="thread/read" && q.input.params.includeTurns || q.input?.method==="thread/resume" && !q.input.params.excludeTurns)'))throw new Error('full history requested');
await parent('fixture.savedHistory=fixture.history;fixture.history=Array.from({length:400},(_,i)=>({turnId:"one-long-turn",item:i===0 ? {id:"long-user",type:"userMessage",content:[{type:"text",text:"inspect long tool history"}]} : {id:"long-tool-"+i,type:"commandExecution",command:"git status --short",status:"completed"}}))');
await child('document.querySelector("[data-thread=history]").click()');await until(()=>child('state.indexHistory?.done && !state.indexHistory.loading && !state.switching'));
await check('state.items.length===40 && state.userIndex.size===1 && !!document.querySelector(".turn-marker[data-item=long-user]")','complete user-only index without loading tool history');
await child('document.querySelector(".turn-marker[data-item=long-user]").click()');await until(()=>child('state.detached && document.querySelector("#messages .item").dataset.key==="item:long-user"'));
await check('document.querySelectorAll("#messages .item").length<=160','targeted user navigation bounded DOM');
await child('jumpLatest()');await until(()=>child('!state.detached && state.items.length===40'));
await parent('fixture.history=fixture.savedHistory;delete fixture.savedHistory');
await child('document.getElementById("source-filter").value="vscode";document.getElementById("source-filter").dispatchEvent(new Event("change"))');await until(()=>child('document.querySelectorAll(".thread-row").length===1 && document.querySelector("[data-thread=other]")'));
await child('document.getElementById("source-filter").value="";document.getElementById("source-filter").dispatchEvent(new Event("change"))');await until(()=>child('!!document.querySelector("[data-thread=history]")'));
await parent('fixture.holdNextList=true');await child('document.getElementById("thread-search").value="alpha";document.getElementById("thread-search").dispatchEvent(new Event("input"))');await until(()=>parent('!!fixture.heldList'));
await child('document.getElementById("thread-search").value="beta";document.getElementById("thread-search").dispatchEvent(new Event("input"))');await until(()=>child('state.threads.length===1 && state.threads[0].id==="other" && !state.threadLoading'));
await parent('fixture.respond(fixture.heldList.q,fixture.heldList.data);fixture.heldList=null');await child('new Promise(r=>setTimeout(r,100))');await check('state.threads.length===1 && state.threads[0].id==="other"','late search replaced current project filter');
await child('document.getElementById("thread-search").value="";document.getElementById("thread-search").dispatchEvent(new Event("input"))');await until(()=>child('state.threads.length>1 && !state.threadLoading'));
await child('document.getElementById("thread-search").value="alpha";document.getElementById("thread-search").dispatchEvent(new Event("input"))');await until(()=>child('state.threads.length===1 && state.threads[0].id==="history" && !state.threadLoading'));
await child('document.getElementById("thread-search").value="beta";document.getElementById("thread-search").dispatchEvent(new Event("input"))');await until(()=>child('state.threads.length===1 && state.threads[0].id==="other" && !state.threadLoading'));
await child('document.getElementById("thread-search").value="";document.getElementById("thread-search").dispatchEvent(new Event("input"))');await until(()=>child('state.threads.length>1 && !state.threadLoading'));
await child('document.getElementById("model-select").value="fixture-b";document.getElementById("model-select").dispatchEvent(new Event("change"))');
await check('[...document.getElementById("effort-select").options].some(o=>o.value==="high")','effort tracks selected model');
await child('document.getElementById("pick-cwd").click()');await until(()=>child('document.getElementById("cwd-line").title.includes("fixture/project")'));
await child('document.getElementById("new-thread").click()');await until(()=>child('document.getElementById("thread-meta").textContent.includes("thread-1")'));
await child('document.getElementById("rename-thread").click();document.getElementById("rename-input").value="已重命名";document.getElementById("save-rename").click()');
await until(()=>child('document.getElementById("thread-title").textContent==="已重命名"'));
await child('document.getElementById("prompt").value="组合输入";document.getElementById("prompt").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",isComposing:true,bubbles:true}))');await check('document.getElementById("prompt").value==="组合输入"','IME Enter sent unfinished input');
await child('document.getElementById("prompt").value="fixture task";document.getElementById("send").click()');
await until(()=>child('!document.getElementById("interrupt").disabled'));
await check('document.getElementById("new-thread").disabled','running turn prevents switching');
await parent('fixture.emit("turn/started",{threadId:"thread-1",turn:{id:"turn-1",status:"inProgress"}});fixture.emit("item/agentMessage/delta",{threadId:"other",itemId:"wrong",delta:"MUST NOT APPEAR"});fixture.emit("item/agentMessage/delta",{threadId:"thread-1",itemId:"answer",delta:"流式回复"});fixture.emit("item/commandExecution/requestApproval",{threadId:"thread-1",command:"fixture command"},900)');
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
await check('document.getElementById("messages").textContent.includes("本地计时") && !document.querySelector(".role-assistant .badge")?.textContent.includes("处理中")','local timing or completed bubble status');
await child('document.getElementById("delete-thread").click()');if(await parent('fixture.requests.some(q=>q.input?.method==="thread/delete")'))throw new Error('delete before confirmation');
await child('document.getElementById("cancel-delete").click()');await parent('fixture.emit("lumi/bridge/exited",{detail:"fixture disconnected"})');await until(()=>child('document.getElementById("send").disabled'));
await child('document.getElementById("reconnect").click()');await until(()=>child('!document.getElementById("send").disabled'));
await child('document.getElementById("new-thread").click()');await until(()=>child('document.getElementById("thread-meta").textContent.includes("thread-2")'));
await parent('fixture.emit("turn/started",{threadId:"thread-2",turn:{id:"turn-demo",status:"inProgress"}});fixture.emit("item/completed",{threadId:"thread-2",turnId:"turn-demo",item:{id:"user-demo",type:"userMessage",content:[{type:"text",text:"整理项目目录，并说明修改内容。"}],status:"completed"}});fixture.emit("item/agentMessage/delta",{threadId:"thread-2",itemId:"answer-demo",delta:"已检查项目结构。\\n我会整理公共组件，保留现有配置，并执行回归检查。"});fixture.emit("item/completed",{threadId:"thread-2",item:{id:"command-demo",type:"commandExecution",command:"npm test",aggregatedOutput:"746 tests · checked",exitCode:0,durationMs:1234,status:"completed"}})');
await until(()=>child('!!document.querySelector(".role-user") && !!document.querySelector(".role-command")'));await child('window.stableUser=document.querySelector(".role-user")');await parent('fixture.emit("item/agentMessage/delta",{threadId:"thread-2",itemId:"answer-demo",delta:"\\n检查已完成。"})');await until(()=>child('document.querySelector(".role-assistant").textContent.includes("检查已完成")'));await check('document.querySelector(".role-user")===window.stableUser','streaming recreated unchanged messages');
await parent('fixture.emit("item/completed",{threadId:"thread-2",item:{id:"files-demo",type:"fileChange",status:"completed",changes:Array.from({length:4},(_,index)=>({path:"src/component-"+index+".ts",kind:{type:index ? "update" : "add"},diff:"--- old\\n+++ new\\n+const value = 1;\\n-const value = 0;"}))}});fixture.emit("item/completed",{threadId:"thread-2",item:{id:"markdown-demo",type:"agentMessage",text:"### 验证结果\\n**通过**，保留 \\u0060config\\u0060。\\n\\n| 项目 | 结果 |\\n| --- | --- |\\n| 布局 | 完成 |\\n\\n\\u0060\\u0060\\u0060js\\nconst safe = true;\\n\\u0060\\u0060\\u0060\\n<img src=x onerror=window.PWNED=true>"}});fixture.emit("turn/plan/updated",{threadId:"thread-2",turnId:"turn-demo",plan:[{step:"检查项目结构",status:"completed"},{step:"执行回归验证",status:"inProgress"}]});fixture.emit("turn/completed",{threadId:"thread-2",turn:{id:"turn-demo",status:"completed",durationMs:486000}})');
await until(()=>child('!!document.querySelector(".message-table") && document.getElementById("messages").textContent.includes("8 分 6 秒")'));await check('!window.PWNED && !document.querySelector(".message-content img[src=x]")','message HTML executed');
await check('document.querySelectorAll(".file-change").length===3 && !!document.querySelector(".more-files") && document.querySelectorAll(".plan-list li").length===2','structured special cards');
await check('document.querySelectorAll("#context-files .added").length===4 && [...document.querySelectorAll("#context-files .added")].every(e=>e.textContent==="+1") && [...document.querySelectorAll("#context-files .removed")].every(e=>e.textContent==="−1")','sidebar file change counts');
await child('upsertItem({id:"missing-diff",type:"fileChange",changes:[{path:"unknown.txt",kind:{type:"update"}}]});renderContext()');
await check('document.getElementById("context-files").textContent.includes("改动量未知")','missing diff is unknown');
await child('state.items=state.items.filter(i=>i.id!=="missing-diff");state.itemIndex.delete("missing-diff");state.windowEnd=state.items.length;renderContext()');
await child('document.querySelector(".more-files").open=true');await until(()=>child('document.querySelectorAll(".file-change").length===4'));
// Pixel comparisons control one surface at a time; pause unrelated background
// snapshots after independently verifying the real polling lifecycle above.
await child('clearTimeout(syncTimer);clearTimeout(threadStatusTimer)');await until(()=>child('!syncPending && !threadStatusPending'));await child('clearTimeout(syncTimer);clearTimeout(threadStatusTimer)');
const themes=JSON.parse(fs.readFileSync(path.join(__dirname,'themes.json'),'utf8'));let previousColor;
await child('document.querySelector(".role-command details").open=true');await until(()=>child('!!document.querySelector(".role-command details pre")'));await parent('fixture.emit("item/commandExecution/outputDelta",{threadId:"thread-2",itemId:"command-demo",delta:"\\ncompleted output"})');await until(()=>child('document.querySelector(".role-command details").open && document.querySelector(".role-command details pre").textContent.includes("completed output")'));
// Use a compact, benign turn for layout screenshots after the behavioral checks.
await child('document.getElementById("new-thread").click()');await until(()=>child('state.thread?.id==="thread-3" && !state.switching'));
await parent('fixture.emit("turn/started",{threadId:"thread-3",turn:{id:"preview-turn",status:"inProgress"}});fixture.emit("item/completed",{threadId:"thread-3",item:{id:"preview-user",type:"userMessage",content:[{type:"text",text:"整理公共组件，并说明修改内容。"}]}});fixture.emit("item/completed",{threadId:"thread-3",item:{id:"preview-answer",type:"agentMessage",text:"已整理公共组件。\\n消息与输入区复用当前皮肤，窗口变窄时可展开左侧项目列表。"}});fixture.emit("item/completed",{threadId:"thread-3",item:{id:"preview-files",type:"fileChange",status:"completed",changes:[{path:"src/components/Conversation.ts",kind:{type:"update"},diff:"+new layout\\n-old layout"},{path:"src/components/Messages.ts",kind:{type:"update"},diff:"+paged messages"},{path:"src/components/Composer.ts",kind:{type:"update"},diff:"+responsive composer"},{path:"src/styles/chat.css",kind:{type:"update"},diff:"+bubble layout"}]}});fixture.emit("turn/completed",{threadId:"thread-3",turn:{id:"preview-turn",status:"completed",durationMs:65000}})');
await until(()=>child('document.getElementById("messages").textContent.includes("耗时 1 分 5 秒")'));await child('jumpLatest()');
// Real rendered reply text underneath the preview, rather than a synthetic stripe texture.
await parent('fixture.emit("item/completed",{threadId:"thread-3",item:{id:"preview-user",type:"userMessage",content:[{type:"text",text:"桥接接口默认提供，不作为插件。同时优化 Codex 对话的显示，采用皮肤插件提供的元素组成。"}]}});fixture.emit("item/completed",{threadId:"thread-3",item:{id:"preview-answer",type:"agentMessage",text:["已整理公共组件。","","### 修改说明","","- 会话列表按项目分组显示。","- 消息正文按页载入，保持阅读位置。","- 用户输入保留气泡，模型正文靠左显示。","- 文件摘要显示新增与删除行数。","- 横条预览绑定对应的用户消息。","- 窗口变窄时可展开左侧项目列表。","- 输入框根据可用高度调整。","- 当前皮肤的材质与外观选项统一生效。"].join("\\n")}})');
await until(()=>child('document.getElementById("messages").textContent.includes("文件摘要显示新增与删除行数")'));
await check('document.getElementById("status").parentElement===document.getElementById("chat-shell")','status not in shell footer');
await check('!!document.querySelector(".turn-marker[data-item=preview-user]")','live user input updates navigation');
await child('handleEvent({method:"turn/diff/updated",params:{threadId:"thread-3",turnId:"preview-turn",diff:"diff --git a/src/components/Conversation.ts b/src/components/Conversation.ts\\n--- a/src/components/Conversation.ts\\n+++ b/src/components/Conversation.ts\\n@@ -1,1 +1,2 @@\\n-old\\n+new\\n+extra"}})');
await until(()=>child('document.querySelector("#context-files .context-file .added").textContent==="+2"'));
await child('document.querySelector(".turn-marker[data-item=preview-user]").dispatchEvent(new PointerEvent("pointerenter"));window.previewAnchor={top:document.getElementById("turn-preview").style.top,left:document.getElementById("turn-preview").style.left};document.querySelector(".turn-marker[data-item=preview-user]").dispatchEvent(new PointerEvent("pointermove",{clientX:999,clientY:999}))');
await check('document.getElementById("turn-preview").style.top===window.previewAnchor.top && document.getElementById("turn-preview").style.left===window.previewAnchor.left && document.getElementById("turn-preview").classList.contains("recharts-default-tooltip")','preview anchored to marker with trend tooltip style');
await child('new Promise(r=>setTimeout(r,220))');await check('(()=>{const p=document.getElementById("turn-preview").getBoundingClientRect(),m=document.querySelector(".turn-marker[data-item=preview-user]").getBoundingClientRect();return Math.abs(p.left-m.right-3)<1})()','preview gap reduced to three pixels');
await child('hideTurnPreview()');
await parent('document.querySelector("iframe").contentWindow.postMessage('+JSON.stringify({protocol:'lumi-extension/1',nonce:'fixture',type:'ui-theme',uiTheme:{...themes.dreamy,theme:'light'}})+',"*")');
await until(()=>child('document.body.dataset.interface==="extension.author.dreamy"'));
await child('document.querySelector(".thread-actions").open=true');
await until(()=>child('document.querySelector(".actions-menu").style.getPropertyValue("--lumi-glass-filter").includes("url")'));
await check('(()=>{const m=document.querySelector(".actions-menu"),s=getComputedStyle(m);return m.dataset.popupKind==="popover" && !m.classList.contains("panel") && s.backdropFilter.includes("blur(2px)") && s.backdropFilter.includes("url") && s.position==="absolute"})()','thread menu uses skin popup material and own refraction');
await child('new Promise(r=>setTimeout(r,220))');
await check('(()=>{const b=document.getElementById("rename-thread"),r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b})()','menu buttons painted above conversation');
const menuStyles=await child('(()=>{const d=document.getElementById("delete-thread"),r=document.getElementById("rename-thread"),s=getComputedStyle(d);return {background:s.backgroundColor,deleteColor:s.color,renameColor:getComputedStyle(r).color,disabled:d.disabled,red:s.getPropertyValue("--red"),muted:s.getPropertyValue("--text-muted"),className:d.className,noteHidden:document.getElementById("thread-actions-note").hidden}})()');
if(menuStyles.background!=="rgba(0, 0, 0, 0)" || menuStyles.deleteColor===menuStyles.renameColor || menuStyles.disabled || !menuStyles.noteHidden)throw Error('idle menu uses flat semantic delete row '+JSON.stringify(menuStyles));
await paint();fs.writeFileSync(path.join(__dirname,'codex-thread-menu.png'),(await win.webContents.capturePage()).toPNG());
await parent('fixture.emit("turn/started",{threadId:"thread-3",turn:{id:"menu-working",status:"inProgress"}})');
await until(()=>child('!document.getElementById("rename-thread").disabled && document.getElementById("archive-thread").disabled && !document.getElementById("thread-actions-note").hidden'));
await parent('document.querySelector("iframe").contentWindow.postMessage('+JSON.stringify({protocol:'lumi-extension/1',nonce:'fixture',type:'ui-theme',uiTheme:{...themes.dreamy,theme:'dark'}})+',"*")');
await child('new Promise(r=>setTimeout(r,220))');
await check('getComputedStyle(document.getElementById("delete-thread")).backgroundColor==="rgba(0, 0, 0, 0)" && getComputedStyle(document.getElementById("archive-thread")).opacity==="1"','working menu keeps disabled labels legible without button fill');
await paint();fs.writeFileSync(path.join(__dirname,'codex-thread-menu-working.png'),(await win.webContents.capturePage()).toPNG());
await parent('fixture.emit("turn/completed",{threadId:"thread-3",turn:{id:"menu-working",status:"completed"}})');
await parent('document.querySelector("iframe").contentWindow.postMessage('+JSON.stringify({protocol:'lumi-extension/1',nonce:'fixture',type:'ui-theme',uiTheme:{...themes.dreamy,theme:'light'}})+',"*")');
await child('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}))');await check('!document.querySelector(".thread-actions").open','escape closes thread menu');
await child('document.querySelector(".turn-marker[data-item=preview-user]").dispatchEvent(new PointerEvent("pointerenter"))');
await until(()=>child('document.getElementById("turn-preview").style.getPropertyValue("--lumi-glass-filter").includes("url")'));
await child('new Promise(r=>setTimeout(r,260))');
await check('document.getElementById("turn-preview").dataset.lumiGlass==="lens" && getComputedStyle(document.getElementById("turn-preview"),"::before").backdropFilter.includes("url") && getComputedStyle(document.getElementById("turn-preview")).backdropFilter==="none" && getComputedStyle(document.querySelector(".turn-preview-content")).filter==="none"','background lens leaves preview text clear');
const previewRect=await child('(()=>{const r=document.getElementById("turn-preview").getBoundingClientRect();return {x:Math.ceil(r.x),y:Math.ceil(r.y),width:Math.floor(r.width),height:Math.floor(r.height)}})()');
const iframeRect=await parent('(()=>{const r=document.querySelector("iframe").getBoundingClientRect();return {x:r.x,y:r.y}})()');previewRect.x+=iframeRect.x;previewRect.y+=iframeRect.y;
const previewOn=await win.webContents.capturePage(previewRect),glassOn=previewOn.toBitmap();fs.writeFileSync(path.join(__dirname,'codex-preview-glass-on.png'),previewOn.toPNG());
// Disable this preview only. Turning off the entire skin also changes cards underneath,
// which can yield a false positive even when this particular surface has no distortion.
await child('window.previewOffStyle=document.createElement("style");previewOffStyle.textContent="#turn-preview::before{backdrop-filter:var(--dream-popup-blur)!important}";document.head.append(previewOffStyle)');
await check('document.body.dataset.appearanceDistortion==="strong" && !getComputedStyle(document.getElementById("turn-preview"),"::before").backdropFilter.includes("url")','only preview refraction disabled for pixel comparison');
await child('new Promise(r=>setTimeout(r,100))');const previewOff=await win.webContents.capturePage(previewRect),glassOff=previewOff.toBitmap();fs.writeFileSync(path.join(__dirname,'codex-preview-glass-off.png'),previewOff.toPNG());
let changedPixels=0,interiorPixels=0;const previewSize=previewOn.getSize(),inset=Math.ceil(24*previewSize.width/previewRect.width);
for(let i=0;i<glassOn.length;i+=4)if(Math.abs(glassOn[i]-glassOff[i])+Math.abs(glassOn[i+1]-glassOff[i+1])+Math.abs(glassOn[i+2]-glassOff[i+2])>6){changedPixels++;const x=i/4%previewSize.width,y=Math.floor(i/4/previewSize.width);if(x>=inset && x<previewSize.width-inset && y>=inset && y<previewSize.height-inset)interiorPixels++;}
if(changedPixels<20 || interiorPixels<20)throw new Error('preview lens failed isolated background/interior comparison: '+JSON.stringify({changedPixels,interiorPixels}));console.log('CODEX_PREVIEW_REFRACTION_PIXELS',JSON.stringify({changedPixels,interiorPixels}));
await child('previewOffStyle.remove();delete window.previewOffStyle');
// Test painted entry and exit frames, not just a settled CSS filter. Fading a
// parent creates a backdrop root and can make its child's glass disappear for
// the entire transition even though the final frame passes the test above.
const previewMotion=[];
for(const mode of ['light','dark'])for(const opening of [true,false]){
await parent('document.querySelector("iframe").contentWindow.postMessage('+JSON.stringify({protocol:'lumi-extension/1',nonce:'fixture',type:'ui-theme',uiTheme:{...themes.dreamy,theme:mode}})+',"*")');await until(()=>child('document.documentElement.dataset.theme==='+JSON.stringify(mode)));
await child('document.body.setAttribute("data-appearance-distortion","strong");hideTurnPreview()');await child('new Promise(r=>setTimeout(r,220))');
if(!opening){await child('showTurnPreview(document.querySelector(".turn-marker[data-item=preview-user]"))');await until(()=>child('document.getElementById("turn-preview").style.getPropertyValue("--lumi-glass-filter").includes("url")'));await child('new Promise(r=>setTimeout(r,220))');}
await child('(()=>{const p=document.getElementById("turn-preview");'+(opening ? 'showTurnPreview(document.querySelector(".turn-marker[data-item=preview-user]"));' : 'hideTurnPreview();')+'window.previewMotionAnimations=p.getAnimations({subtree:true});previewMotionAnimations.forEach(a=>{a.pause();a.currentTime='+ (opening ? 90 : 45)+'});})()');
await until(()=>child('document.getElementById("turn-preview").style.getPropertyValue("--lumi-glass-filter").includes("url")'));
const motionState=await child('(()=>{const p=document.getElementById("turn-preview"),b=getComputedStyle(p,"::before"),c=getComputedStyle(p.querySelector(".turn-preview-content"));return {parentOpacity:getComputedStyle(p).opacity,backdropOpacity:Number(b.opacity),contentOpacity:Number(c.opacity),visibility:getComputedStyle(p).visibility,backdropFilter:b.backdropFilter}})()');
if(motionState.parentOpacity!=='1' || motionState.visibility!=='visible' || !(motionState.backdropOpacity>0 && motionState.backdropOpacity<1) || !(motionState.contentOpacity>0 && motionState.contentOpacity<1) || !motionState.backdropFilter.includes('url'))throw Error('Preview animation broke the background/content layer contract '+JSON.stringify({opening,...motionState}));
const motionRect=await child('(()=>{const r=document.getElementById("turn-preview").getBoundingClientRect();return {x:Math.ceil(r.x),y:Math.ceil(r.y),width:Math.floor(r.width),height:Math.floor(r.height)}})()');motionRect.x+=iframeRect.x;motionRect.y+=iframeRect.y;
await paint();
const animatedOn=await win.webContents.capturePage(motionRect),animatedPixels=animatedOn.toBitmap();
await child('window.previewOffStyle=document.createElement("style");previewOffStyle.textContent="#turn-preview::before{backdrop-filter:var(--dream-popup-blur)!important}";document.head.append(previewOffStyle)');
await paint();
await check('!getComputedStyle(document.getElementById("turn-preview"),"::before").backdropFilter.includes("url")','preview-only refraction override stays disabled during comparison');
const animatedOff=(await win.webContents.capturePage(motionRect)).toBitmap();let motionPixels=0;
for(let i=0;i<animatedPixels.length;i+=4)if(Math.abs(animatedPixels[i]-animatedOff[i])+Math.abs(animatedPixels[i+1]-animatedOff[i+1])+Math.abs(animatedPixels[i+2]-animatedOff[i+2])>2)motionPixels++;
if(motionPixels<5)throw Error('Preview glass disappears during '+(opening ? 'entry' : 'exit')+' '+motionPixels);
await child('previewOffStyle.remove();delete window.previewOffStyle');
fs.writeFileSync(path.join(__dirname,'codex-preview-glass-'+mode+'-'+(opening ? 'entry' : 'exit')+'.png'),animatedOn.toPNG());previewMotion.push({mode,opening,...motionState,motionPixels});
await child('previewMotionAnimations.forEach(a=>a.finish())');await child('new Promise(r=>setTimeout(r,30))');
if(!opening){const exitState=await child('(()=>{const p=document.getElementById("turn-preview");return {visibility:getComputedStyle(p).visibility,classes:p.className,animations:p.getAnimations({subtree:true}).map(a=>({property:a.transitionProperty,currentTime:a.currentTime,timing:a.effect.getComputedTiming()}))}})()');if(exitState.visibility!=='hidden')throw Error('preview exit did not release the visible surface '+JSON.stringify(exitState));}
}
console.log('CODEX_PREVIEW_REFRACTION_MOTION',JSON.stringify(previewMotion));
win.webContents.debugger.attach('1.3');const targets=await win.webContents.debugger.sendCommand('Target.getTargets'),pluginTarget=targets.targetInfos.find(target=>target.type==='iframe' && target.url.includes('/plugin/index.html'));
const mediaSession=pluginTarget ? (await win.webContents.debugger.sendCommand('Target.attachToTarget',{targetId:pluginTarget.targetId,flatten:true})).sessionId : undefined;
await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]},mediaSession);
await until(()=>child('matchMedia("(prefers-reduced-motion:reduce)").matches'));await child('document.body.setAttribute("data-appearance-distortion","strong");hideTurnPreview()');
await check('getComputedStyle(document.getElementById("turn-preview")).visibility==="hidden" && getComputedStyle(document.getElementById("turn-preview"),"::before").opacity==="0"','reduced motion preview failed immediate exit');
await child('showTurnPreview(document.querySelector(".turn-marker[data-item=preview-user]"))');await until(()=>child('document.getElementById("turn-preview").style.getPropertyValue("--lumi-glass-filter").includes("url")'));
await child('new Promise(r=>requestAnimationFrame(r))');
const reducedPreview=await child('(()=>{const p=document.getElementById("turn-preview");return {parentOpacity:getComputedStyle(p).opacity,backdropOpacity:getComputedStyle(p,"::before").opacity,visibility:getComputedStyle(p).visibility,animations:p.getAnimations({subtree:true}).filter(a=>{const t=a.effect.getComputedTiming();return t.duration>0 || t.delay>0}).map(a=>({property:a.transitionProperty,playState:a.playState,currentTime:a.currentTime}))}})()');
if(reducedPreview.parentOpacity!=='1' || reducedPreview.backdropOpacity!=='1' || reducedPreview.visibility!=='visible' || reducedPreview.animations.length)throw Error('reduced motion preview retained transitions or lost glass '+JSON.stringify(reducedPreview));
await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]},mediaSession);win.webContents.debugger.detach();
await child('document.body.setAttribute("data-appearance-distortion","strong");hideTurnPreview()');
await child('state.error="layout status probe";renderStatus()');await child('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
await check('document.getElementById("status").getBoundingClientRect().top>=document.getElementById("composer").getBoundingClientRect().bottom && Math.abs(document.getElementById("status").getBoundingClientRect().bottom-document.getElementById("chat-shell").getBoundingClientRect().bottom)<=1','status row geometry');
await child('state.error="";renderStatus()');
await check('document.getElementById("status").getBoundingClientRect().height>=24','empty status row collapsed');
await check('Math.abs(document.getElementById("messages").getBoundingClientRect().left-document.getElementById("composer").getBoundingClientRect().left)<=1 && Math.abs(document.getElementById("messages").getBoundingClientRect().width-document.getElementById("composer").getBoundingClientRect().width)<=1','reading width differs from composer');
await check('!document.querySelector(".role-assistant").classList.contains("surface") && document.querySelector(".role-user").classList.contains("bubble")','message bubble roles');
for(const [skin,uiTheme] of Object.entries(themes))for(const mode of ['light','dark'])for(const width of [1920,1440,1150,900,760,640,420]){win.setSize(width+20,900);await child('document.getElementById("prompt").value="skin draft";document.getElementById("prompt").focus()');await parent('document.querySelector("iframe").contentWindow.postMessage('+JSON.stringify({protocol:'lumi-extension/1',nonce:'fixture',type:'ui-theme',uiTheme:{...uiTheme,theme:mode}})+',"*")');await until(()=>child('document.body.dataset.interface==='+JSON.stringify(uiTheme.id)+' && document.documentElement.dataset.theme==='+JSON.stringify(mode)));await check('document.getElementById("prompt").value==="skin draft" && document.activeElement===document.getElementById("prompt")','skin switch lost draft/focus');await check('!!document.getElementById("lumi-ui-theme") && getComputedStyle(document.getElementById("send")).cursor==="default"','host primitives unavailable');await child('new Promise(r=>setTimeout(r,280))');const color=await child('getComputedStyle(document.getElementById("send")).backgroundColor');if(width===1150 && mode==='light'){if(skin==='dreamy' && color===previousColor)throw new Error('Skin did not style host buttons');previousColor=color;}await child('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await check('document.documentElement.scrollWidth<=innerWidth+1','responsive overflow '+width);await check('document.querySelector(".conversation-head").getBoundingClientRect().top-document.getElementById("chat-shell").getBoundingClientRect().top<12','hidden sidebar occupied narrow grid');await check('document.getElementById("composer").getBoundingClientRect().bottom<=document.getElementById("chat-shell").getBoundingClientRect().bottom+1','composer outside layout');fs.writeFileSync(path.join(__dirname,'codex-'+skin+'-'+mode+'-'+width+'.png'),(await win.webContents.capturePage()).toPNG());}
await child('document.getElementById("toggle-threads").click()');await check('!document.getElementById("threads-panel").inert && document.getElementById("toggle-threads").getAttribute("aria-expanded")==="true"','narrow sidebar unreachable');
await check('getComputedStyle(document.getElementById("sidebar-backdrop")).backdropFilter.includes("blur(2px)")','narrow sidebar blur ignored skin radius');
await child('document.body.setAttribute("data-appearance-blur","off")');await check('getComputedStyle(document.getElementById("sidebar-backdrop")).backdropFilter.includes("blur(0px)")','narrow sidebar blur ignored disabled appearance');
await child('document.body.setAttribute("data-appearance-transparency","solid")');await check('getComputedStyle(document.getElementById("sidebar-backdrop")).backdropFilter==="none"','solid narrow sidebar retained a filter');
await child('document.body.setAttribute("data-appearance-blur","soft");document.body.setAttribute("data-appearance-transparency","clear");document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}))');await check('document.getElementById("threads-panel").inert','closed sidebar remained focusable');
await parent('document.querySelector("iframe").style.height="420px"');await until(()=>child('document.getElementById("chat-shell").clientHeight===420'));await child('resizePrompt()');await child('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await check('document.getElementById("chat-shell").clientHeight===420 && document.getElementById("composer").getBoundingClientRect().bottom<=document.getElementById("chat-shell").getBoundingClientRect().bottom+1','short available height clipped composer');
for(const [width,height] of [[1920,1000],[900,360],[760,420],[420,300],[1150,600]]){
await child('window.currentRailIndex=state.userIndex;state.userIndex=railStressIndex;renderTurnRail()');
win.setSize(width+20,height+100);await parent('document.querySelector("iframe").style.height='+JSON.stringify(height+'px'));
await until(()=>child('document.getElementById("chat-shell").clientHeight==='+height));await child('resizePrompt()');await child('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
await check('document.documentElement.scrollWidth<=innerWidth+1 && document.getElementById("composer").getBoundingClientRect().bottom<=innerHeight+1 && document.getElementById("send").getBoundingClientRect().bottom<=innerHeight+1','resized input clipped '+width+'x'+height);
await check('document.querySelector(".stream").clientHeight>30','message area collapsed '+width+'x'+height);
await check('(()=>{const n=document.querySelector(".turn-navigation").getBoundingClientRect(),s=document.getElementById("stream-stage").getBoundingClientRect(),r=document.getElementById("turn-rail");return n.height<=s.height/2+.1 && r.scrollHeight<=r.clientHeight+1})()','rail half-height budget after resize '+width+'x'+height);
await check('document.querySelectorAll(".turn-marker").length===200 && document.querySelector(".turn-marker:last-child").getBoundingClientRect().bottom<=document.querySelector(".turn-navigation").getBoundingClientRect().bottom+.1','all stress markers preserved at '+width+'x'+height);
await child('state.userIndex=currentRailIndex;renderTurnRail()');
}
for(const width of [1440,640,420]){
win.setSize(width+20,800);await parent('document.querySelector("iframe").style.height="600px"');await until(()=>child('document.getElementById("chat-shell").clientHeight===600'));
await child('document.querySelector(".thread-actions").open=true');await child('new Promise(r=>setTimeout(r,100))');
await check('(()=>{const m=document.querySelector(".actions-menu").getBoundingClientRect(),b=document.getElementById("rename-thread"),r=b.getBoundingClientRect();return m.width>100 && m.left>=0 && m.right<=innerWidth && m.bottom<=innerHeight && document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b})()','menu bounds and clickable layer '+width);
await child('document.getElementById("thread-title").click()');await check('!document.querySelector(".thread-actions").open','outside click closes menu '+width);
}
await child('scheduleThreadStatusRefresh(1000);window.dispatchEvent(new Event("pagehide"))');const disposedStart=await parent('fixture.requests.filter(q=>q.method==="codex.bridge.send").length');await child('new Promise(r=>setTimeout(r,1150))');if(await parent('fixture.requests.filter(q=>q.method==="codex.bridge.send").length')!==disposedStart)throw Error('disposed chat kept polling');
console.log('CODEX_UI_OK pagination bounded-DOM project-groups timing special-cards streaming approvals input retry reconnect models sandbox responsive initial-status popup-material one-second-status no-overlap hidden-paused unchanged-DOM');win.destroy();app.exit(0);
}).catch(error=>{console.error(error?.stack || String(error));app.exit(1);});`);
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(electron,[path.join(fixture,'main.cjs'),...(hardware ? ['--hardware'] : [])],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let outputText='';child.stdout.on('data',chunk=>outputText+=chunk);child.stderr.on('data',chunk=>outputText+=chunk);
  const timeout=setTimeout(()=>child.kill(),60000);
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});clearTimeout(timeout);
  if(code!==0)throw new Error(outputText);console.log(outputText.trim());
  for(const skin of ['default','dreamy'])for(const mode of ['light','dark'])for(const width of [1920,1440,1150,900,760,640,420])await cp(path.join(fixture,`codex-${skin}-${mode}-${width}.png`),path.join(output,`codex-${skin}-${mode}-${width}.png`));
  await cp(path.join(fixture,'codex-history.png'),path.join(output,'codex-history.png'));
  await cp(path.join(fixture,'codex-turn-rail.png'),path.join(output,'codex-turn-rail.png'));
  await cp(path.join(fixture,'codex-turn-rail-expanded.png'),path.join(output,'codex-turn-rail-expanded.png'));
  await cp(path.join(fixture,'codex-thread-menu.png'),path.join(output,'codex-thread-menu.png'));
  await cp(path.join(fixture,'codex-thread-menu-working.png'),path.join(output,'codex-thread-menu-working.png'));
  for(const state of ['on','off'])await cp(path.join(fixture,'codex-preview-glass-'+state+'.png'),path.join(output,'codex-preview-glass-'+state+'.png'));
  for(const mode of ['light','dark'])for(const state of ['entry','exit'])await cp(path.join(fixture,'codex-preview-glass-'+mode+'-'+state+'.png'),path.join(output,'codex-preview-glass-'+mode+'-'+state+'.png'));
}finally{await rm(fixture,{recursive:true,force:true,maxRetries:5,retryDelay:100});}

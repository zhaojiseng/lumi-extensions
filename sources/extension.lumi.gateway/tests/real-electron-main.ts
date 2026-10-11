import {app,BrowserWindow,protocol,ipcMain,safeStorage} from 'electron';
import fs from 'node:fs/promises';
import {readFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {ExtensionHost} from './electron/extensions/host';
import {GatewayManagementService} from './electron/services/gateway-management';
import {GatewayCliConfigService} from './electron/services/gateway-cli-config';
import {GatewayLocalService} from './electron/services/gateway-local';
import {startEngine} from './electron/services/gateway-runtime/engine.mjs';
import {createManagementGateway} from './electron/services/gateway-runtime/management.mjs';
import {createModelCatalog} from './electron/services/gateway-runtime/catalog.mjs';
import {atomicWrite} from './electron/services/store';
import {EXTENSION_METHODS} from './shared/contracts/extensions';
import {z} from 'zod';

const directory=__dirname,pluginId='extension.lumi.gateway';
const config=JSON.parse(readFileSync(path.join(directory,'config.json'),'utf8'));
const calls:any[]=[],events:any[]=[],revocations:any[]=[],errors:string[]=[],blocked:string[]=[];
const screenshots:string[]=[];
const screenshotGeometry:any[]=[];
let win:BrowserWindow,host:ExtensionHost,gateway:GatewayManagementService,local:GatewayLocalService,engine:any,peer:any,commandTimer:ReturnType<typeof setInterval>|undefined;
let ready=false,commandBusy=false;const loadedFrames=new Set<number>();
let recordsAppendHeld=false,recordsAppendPending=false,releaseRecordsAppend:(()=>void)|undefined;
protocol.registerSchemesAsPrivileged([{scheme:'lumi-extension',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
for(const name of ['userData','sessionData','logs','crashDumps']){const dir=path.join(directory,name);mkdirSync(dir,{recursive:true});app.setPath(name as any,dir);}
app.disableHardwareAcceleration();
const until=async(predicate:()=>Promise<boolean>,label:string,timeout=12000)=>{const deadline=Date.now()+timeout;while(!await predicate()){if(Date.now()>deadline)throw new Error(label);await new Promise(resolve=>setTimeout(resolve,20));}};
const requestSchema=z.object({id:z.string().regex(/^extension\.[a-z][a-z0-9-]{0,39}\.[a-z][a-z0-9-]{0,39}$/),generation:z.number().int().positive(),view:z.string().regex(/^[a-z][a-z0-9.-]{0,79}$/),method:z.enum(EXTENSION_METHODS),input:z.unknown().optional()}).strict();
function trusted(event:Electron.IpcMainInvokeEvent){return event.sender===win.webContents&&event.senderFrame===event.sender.mainFrame&&event.senderFrame.url.split('#')[0]===pathToFileURL(path.join(directory,'host.html')).href;}
function handle(channel:string,action:(payload:any)=>Promise<any>|any){ipcMain.handle('lumi:'+channel,async(event,payload)=>{if(!trusted(event))return {ok:false,error:'请求来源不可信。'};try{return {ok:true,data:await action(payload)};}catch(error){return {ok:false,error:error instanceof Error?error.message:'fixture failure'};}});}
function safeAudit(value:any):any{
 if(Array.isArray(value))return value.map(safeAudit);
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='upstreamApiKey'||key==='clientApiKey'?'[REDACTED]':safeAudit(item)]));
}
function defaultStatus(){return host.statuses().find(value=>value.manifest.id===pluginId)!;}
function frame(){return win.webContents.mainFrame.frames.find(value=>!value.detached&&loadedFrames.has(value.routingId)&&value.url.startsWith('lumi-extension://'+pluginId+'/'))!;}
const run=(code:string)=>win.webContents.executeJavaScript(code);
const inFrame=async(code:string,timeoutMs=8000)=>{const target=frame();if(!target)throw new Error('Extension frame is not ready');let timer:ReturnType<typeof setTimeout>;try{return await Promise.race([target.executeJavaScript(code),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Extension frame evaluation timeout: '+code.slice(0,150))),timeoutMs);})]);}finally{clearTimeout(timer!);}};
const hostScreenshotGeometry='({scrollY,rootScroll:document.documentElement.scrollTop,bodyScroll:document.body.scrollTop,ancestors:(()=>{const result=[];let element=document.querySelector("iframe");while(element){const rect=element.getBoundingClientRect();result.push({tag:element.tagName,class:element.className,top:rect.top,height:rect.height,scrollTop:element.scrollTop});element=element.parentElement;}return result;})()})';
const frameScreenshotGeometry='({scrollY,rootScroll:document.documentElement.scrollTop,bodyScroll:document.body.scrollTop,introTop:document.querySelector(".page-intro").getBoundingClientRect().top,introBottom:document.querySelector(".page-intro").getBoundingClientRect().bottom})';
async function capture(name:string){
 const progress=async(stage:string)=>fs.writeFile(path.join(directory,'main-progress.json'),JSON.stringify({stage:'capture/'+stage,name}));
 await progress('geometry-before');
 const before={host:await run(hostScreenshotGeometry),frame:await inFrame(frameScreenshotGeometry)};
 // A hidden window may keep the previous composited frame until capture wakes
 // it. Discard that wake-up frame before recording the settled current view.
 await progress('wake');await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await progress('reset-scroll');
 await inFrame('document.activeElement?.blur();window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0');
 await run('(()=>{document.activeElement?.blur();window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0;let element=document.querySelector("iframe");while(element){element.scrollTop=0;element=element.parentElement;}})()');
 await new Promise(resolve=>setTimeout(resolve,70));
 await progress('geometry-after');const hostGeometry=await run(hostScreenshotGeometry),frameGeometry=await inFrame(frameScreenshotGeometry);
 assert.equal(hostGeometry.scrollY,0,'screenshot host document is scrolled');assert.equal(frameGeometry.scrollY,0,'screenshot iframe document is scrolled');
 assert.ok(hostGeometry.ancestors.every((element:any)=>element.scrollTop===0),'screenshot iframe ancestor is scrolled');
 assert.ok(hostGeometry.ancestors[0].top+frameGeometry.introTop>=0,'screenshot clipped the page intro');
 screenshotGeometry.push({name,before,host:hostGeometry,frame:frameGeometry});
 await fs.writeFile(path.join(directory,'screenshot-geometry.json'),JSON.stringify(screenshotGeometry,null,2));
 await progress('save');await fs.writeFile(path.join(directory,name),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 screenshots.push(name);
}
const primitiveSpecifications=[
 {name:'button',plugin:'#refresh-status',reference:'#primitive-button',properties:['font-family','font-size','font-weight','line-height','min-height','padding','border-radius','border-top-width','border-top-color','background-color','color']},
 {name:'primary',plugin:'#connect',reference:'#primitive-primary',properties:['font-family','font-size','font-weight','min-height','padding','border-radius','border-top-color','background-color','color']},
 {name:'danger',plugin:'#listener-cancel',reference:'#primitive-danger',properties:['font-family','font-size','min-height','padding','border-radius','border-top-color','background-color','color']},
 {name:'input',plugin:'#filter-model',reference:'#primitive-input',properties:['font-family','font-size','line-height','min-height','padding','border-radius','border-top-width','border-top-color','background-color','color']},
 {name:'select',plugin:'#route-protocol',reference:'#primitive-select select',properties:['font-family','font-size','line-height','min-height','padding','border-radius','border-top-width','border-top-color','background-color','color']},
 {name:'panel',plugin:'#local-settings-details',reference:'#primitive-panel',properties:['font-family','font-size','border-radius','border-top-width','border-top-color','background-color','color','box-shadow']},
 {name:'dialog',plugin:'#delete-dialog',reference:'#primitive-dialog',properties:['font-family','font-size','padding','border-radius','border-top-width','border-top-color','background-color','color','box-shadow']},
 {name:'tab',plugin:'.page-tabs button.active',reference:'#primitive-tab',properties:['font-family','font-size','font-weight','padding','border-radius','background-color','color']},
 {name:'table-heading',plugin:'.data-table th:nth-child(2)',reference:'#primitive-th',properties:['font-family','font-size','font-weight','line-height','padding','background-color','color']},
 {name:'table-cell',plugin:'.data-table tbody td:nth-child(2)',reference:'#primitive-td',properties:['font-family','font-size','line-height','padding','color']},
];
function styleProbe(selectors:{name:string;selector:string;properties:string[]}[]){
 return `JSON.parse(JSON.stringify(${JSON.stringify(selectors)}.map(item=>{
  const element=document.querySelector(item.selector);if(!element)throw new Error('Missing primitive '+item.name+' '+item.selector);
  const style=getComputedStyle(element);return {name:item.name,properties:Object.fromEntries(item.properties.map(name=>[name,style.getPropertyValue(name)]))};
 })))`;
}
async function assertDefaultPrimitives(theme:string,viewportWidth:number){
 const details=await inFrame('({ui:document.body.hasAttribute("data-lumi-ui"),sheet:!!document.querySelector("link[data-lumi-ui]"),width:innerWidth,panelPadding:getComputedStyle(document.getElementById("local-settings-details")).padding,theme:document.body.dataset.theme,pageGap:getComputedStyle(document.querySelector("main.page")).gap,pagePadding:getComputedStyle(document.querySelector("main.page")).padding})');
 assert.equal(details.ui,true);assert.equal(details.sheet,true);assert.equal(details.theme,theme);assert.equal(details.pagePadding,'0px','plugin added a second page inset');assert.equal(details.pageGap,'20px','plugin changed default page flow');
 assert.equal(details.panelPadding,details.width<=1250?'18px 17px 13px':'21px 21px 16px','plugin changed host panel spacing');
 const reference:any[]=await run(styleProbe(primitiveSpecifications.map(item=>({...item,selector:item.reference}))));
 const actual:any[]=await inFrame(styleProbe(primitiveSpecifications.map(item=>({...item,selector:item.plugin}))));
 for(let index=0;index<actual.length;index++)assert.deepEqual(actual[index],reference[index],`${theme}/${viewportWidth}px ${actual[index].name} diverged from the host primitive`);
 return {theme,viewportWidth,frameWidth:details.width,panelPadding:details.panelPadding,pageGap:details.pageGap,matched:actual.map(item=>item.name)};
}
async function assertPageLayout(tab:string,denseOptions:any){
 const view:any=await inFrame(`(()=>{
  const rect=element=>{const value=element.getBoundingClientRect();return {left:value.left,top:value.top,width:value.width,height:value.height};};
  const active=[...document.querySelectorAll('.page-tabs button.active')],current=[...document.querySelectorAll('.page-tabs [aria-current="page"]')],panels=[...document.querySelectorAll('[data-panel]')].filter(panel=>!panel.hidden);
  const result={width:innerWidth,content:document.documentElement.scrollWidth,active:active[0]?.dataset.tab,activeCount:active.length,currentCount:current.length,sameActive:active[0]===current[0],visiblePanels:panels.map(panel=>panel.dataset.panel),title:document.querySelector('.page-intro h1').textContent};
  if(result.active==='rules'){
   result.dense=window.gatewayDenseLayoutAssert(window.gatewayDenseLayoutProbe(),${JSON.stringify(denseOptions)});
  }
  if(result.active==='gateway')result.statsColumns=getComputedStyle(document.querySelector('.gateway-stats')).gridTemplateColumns.split(' ').length;
  if(result.active==='settings')result.settingsColumns=getComputedStyle(document.querySelector('#cli-form .gateway-two-columns')).gridTemplateColumns.split(' ').length;
  return result;
 })()`);
 assert.equal(view.title,'模型网关');assert.equal(view.active,tab);assert.equal(view.activeCount,1);assert.equal(view.currentCount,1);assert.equal(view.sameActive,true);assert.deepEqual(view.visiblePanels,[tab]);
 assert.ok(view.content<=view.width+1,`${tab} horizontal overflow`);
 if(tab==='gateway')assert.equal(view.statsColumns,view.width<=520?1:3);
 if(tab==='settings')assert.equal(view.settingsColumns,view.width<=520?1:2);
 return view;
}
const cliOriginal='model = "fixture-model"\nmodel_provider = "fixture"\nservice_tier = "flex"\n[model_providers.fixture]\nname = "Fixture"\nbase_url = "https://original.example/v1"\nexperimental_bearer_token = "fake-before-cli-key"\nrequires_openai_auth'+' = false\n';

let savedAccessAgents:any[]=[];
async function testCommand(method:string,input:any){
 await fs.writeFile(path.join(directory,'progress.json'),JSON.stringify({stage:method,sdkCalls:calls.length,forwarded:peer?.forwarded.length,requests:peer?.requests.length}));
 if(method==='seed-legacy-tier'){
  const ctx=calls.filter(value=>value.method==='gateway.routes.config.get').at(-1),value=await engine.request('config.get');
  await host.request({...ctx,method:'gateway.rules.replace',input:{sessionId:ctx.input.sessionId,expectedVersion:value.configVersion,rules:[{id:'inherited-tier',enabled:true,priority:100,match:{routeId:'primary'},action:{type:'override',value:'priority'}}]}});return {seeded:true};
 }
 if(method==='access-legacy'||method==='access-restore'||method==='access-legacy-routes'){
  const ctx=calls.filter(value=>value.method==='gateway.routes.config.get').at(-1),value=await engine.request('config.get');
  if(method==='access-legacy')savedAccessAgents=value.config.agents;
  const agents=method==='access-legacy-routes'?[]:method==='access-restore'?savedAccessAgents:value.config.routes.slice(0,2).map((r:any,i:number)=>({id:'legacy-'+i,name:'已有接入 '+i,credentialRef:r.id,providerIds:[r.id],enabled:true}));
  await host.request({...ctx,method:'gateway.agents.replace',input:{sessionId:ctx.input.sessionId,expectedVersion:value.configVersion,agents}});return {updated:true};
 }
 if(method==='access-snapshot'){const value=await engine.request('config.get');return {agents:value.config.agents??[],routes:value.config.routes,credentialFields:Object.keys(calls.filter(call=>call.method==='gateway.routes.save').at(-1)?.input.credentials||{}),agentWrites:calls.filter(call=>call.method==='gateway.agents.replace').length,keyWrites:calls.filter(call=>call.method==='gateway.routes.save'&&call.input.credentials?.clientApiKey).length,localWrites:calls.filter(call=>call.method==='gateway.local.configure').length};}
 if(method==='catalogContext'){await run('fixture.theme('+JSON.stringify(input.theme)+')');return {theme:input.theme};}
 if(method==='captureDraftCatalog'){await capture('draft-provider-light-1280.png');return {captured:true};}
 if(method==='captureGeneratedKey'){await capture('generated-key-saved.png');return {captured:true};}
 if(method==='draftSnapshot'){
  const current=await engine.request('config.get'),records=await engine.request('records.list.filtered',{limit:100});
  const hashes:any={};for(const file of ['config.json','secrets.bin','management.bin'])hashes[file]=createHash('sha256').update(await fs.readFile(path.join(directory,'host-data/gateway',pluginId,file))).digest('hex');
  return {configVersion:current.configVersion,routes:current.config.routes.map((r:any)=>r.id),keyWrites:calls.filter(call=>call.method==='gateway.routes.save'&&call.input.credentials).length,listening:(await local.status(pluginId)).running,records:records.records.length,hashes};
 }
 if(method==='catalogMode'){peer.setCatalogMode(input.mode);return {mode:input.mode};}
 if(method==='providerConfig'){const value=await engine.request('config.get');return value.config.routes.find((r:any)=>r.id===input.routeId);}
 if(method==='lumiSettingsClick'||method==='lumiSwitchClick'){
  await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});
  const target:any=await inFrame(`(()=>{document.querySelector('.gateway-lumi-node').scrollIntoView({block:'nearest'});const node=document.querySelector('.gateway-lumi-node'),selector=${JSON.stringify(method==='lumiSwitchClick'?'switch':input.point)},el=selector==='switch'?document.getElementById('chain-listener-toggle'):selector==='padding'?node:selector==='title'?node.querySelector('strong'):selector==='symbol'?node.querySelector('.gateway-node-symbol'):document.getElementById('chain-address'),r=el.getBoundingClientRect(),x=r.left+r.width/2,y=selector==='padding'?r.top+4:r.top+r.height/2;return {x,y,hit:document.elementFromPoint(x,y)?.id};})()`);
  assert.equal(target.hit,method==='lumiSwitchClick'?'chain-listener-toggle':'chain-lumi-settings','Lumi card controls cover each other');
  const bounds:any=await run('(()=>{const r=document.querySelector("iframe").getBoundingClientRect();return {left:r.left,top:r.top};})()');
  const x=Math.round(bounds.left+target.x),y=Math.round(bounds.top+target.y);await fs.writeFile(path.join(directory,'lumi-input.json'),JSON.stringify({point:input.point,target,bounds,x,y}));
  win.webContents.debugger.attach('1.3');try{
   await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
   await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',x,y,clickCount:1});
   await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',x,y,clickCount:1});
  }finally{win.webContents.debugger.detach();}
  if(method==='lumiSwitchClick'){assert.equal(await inFrame('document.getElementById("local-settings-dialog").open'),false,'gateway switch also opened settings');return {point:'switch',coordinateInput:true};}
  await until(()=>inFrame('document.getElementById("local-settings-dialog").open'),'coordinate Lumi card click did not open settings',4000);return {point:input.point,coordinateInput:true};
 }
 if(method==='overviewProbe'){await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,40));return inFrame('window.gatewayCompactProbe()');}
 if(method==='overviewBaseline'){await capture('baseline-default-light-1280-overview.png');const baseline:any=await inFrame('window.gatewayCompactProbe()');assert.ok(baseline.providerCount===1&&baseline.modelCount===1&&baseline.bottomInset>=15.5&&baseline.bottomInset<=18.5,'single-supplier overview does not fill its available space');await fs.writeFile(path.join(directory,'baseline-layout.json'),JSON.stringify(baseline,null,2));return baseline;}
 if(method==='wakeFrame'){await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});return {frameAwake:true};}
 if(method==='v2Config'){const value=await engine.request('config.get');const route=value.config.routes.find((r:any)=>r.id==='primary');return {models:route.models,upstreamEndpoint:route.upstreamEndpoint,entryEndpoints:route.entryEndpoints,forwarded:peer.forwarded.length};}
 if(method==='v2Chain'){const scope=calls.filter(value=>value.method==='gateway.routes.config.get').at(-1);return host.request({...scope,method:'gateway.chain.snapshot',input:{sessionId:scope.input.sessionId}});}
 if(method==='v2Send'){
  const before=peer.forwarded.length,response:any=await peer.send(input.address,input.body,{routeId:input.routeId,endpoint:input.endpoint,clientKey:input.clientKey??'fixture-client-key-0123456789'});
  if(response.status===200)await until(async()=>{const value=await engine.request('records.list.filtered',{limit:100});return value.records.some((r:any)=>r.chain?.upstreamModel===JSON.parse(peer.forwarded.at(-1).body.toString()).model&&r.status==='completed');},'v2 request did not complete');
  const sent=peer.forwarded.length>before?JSON.parse(peer.forwarded.at(-1).body.toString()):null;
  return {status:response.status,body:response.body,forwarded:peer.forwarded.length-before,sent,sentBody:sent?peer.forwarded.at(-1).body.toString():null};
 }
 if(method==='sdkSnapshot')return {counts:Object.fromEntries([...new Set(calls.map(value=>value.method))].map(method=>[method,calls.filter(value=>value.method===method).length])),lastRulesWrite:calls.filter(value=>value.method==='gateway.rules.replace').at(-1)?.input.rules||[]};
 if(method==='recordsSnapshot')return {listCalls:calls.filter(value=>value.method==='gateway.records.list').length,appendPending:recordsAppendPending,events:events.length};
 if(method==='holdRecordsAppend'){recordsAppendHeld=true;return {armed:true};}
 if(method==='releaseRecordsAppend'){recordsAppendHeld=false;releaseRecordsAppend?.();releaseRecordsAppend=undefined;return {released:true};}
 if(method==='populatePagination'){
  const before=peer.forwarded.length;
  for(let offset=0;offset<51;offset+=8){
   const responses=await Promise.all(Array.from({length:Math.min(8,51-offset)},(_,index)=>peer.send(input.address,{model:'fixture-pagination-model',input:'隔离分页回归 '+(offset+index)})));
   for(const response of responses)assert.equal(response.status,200);
  }
  await until(async()=>{const value=await engine.request('records.list.filtered',{limit:100,filter:{model:'fixture-pagination-model'}});return value.records.length===51&&value.records.every((record:any)=>record.status==='completed');},'pagination fixture requests did not settle');
  assert.equal(peer.forwarded.length,before+51);return {records:51,isolatedUpstreamRequests:51};
 }
 if(method==='emitRecordSummary'){
  const listing=calls.filter(value=>value.method==='gateway.records.list').at(-1);
  await until(async()=>events.some(event=>event.payload?.type==='status'&&event.payload.sessionId===listing.input.sessionId),'actual event subscription context unavailable');
  const context=events.filter(event=>event.payload?.type==='status'&&event.payload.sessionId===listing.input.sessionId).at(-1);
  const output:any=await host.request({...listing,input:{sessionId:listing.input.sessionId,limit:1,filter:{model:'fixture-pagination-model'}}});
  assert.equal(output.records.length,1);assert.equal(output.records[0].model,'fixture-pagination-model');
  // The production service currently polls status events only. This fixed test
  // event exercises record-summary delivery through the production preload/SDK.
  const event={...context,payload:{subscriptionId:context.payload.subscriptionId,sessionId:context.payload.sessionId,type:'record-summary',record:output.records[0]}};
  events.push(event);win.webContents.send('lumi:extensionEvent',event);return {recordSummaryFixture:true,productionEventDelivery:true};
 }
 if(method==='clearPagination'){
  const value=await engine.request('records.list.filtered',{limit:100,filter:{model:'fixture-pagination-model'}});assert.equal(value.records.length,51);
  await engine.request('records.delete.selection',{selection:{recordIds:value.records.map((record:any)=>record.id)}});return {deleted:51};
 }
 if(method==='ports')return {setup:peer.setupPorts,next:peer.nextPorts,occupiedManagementPort:peer.occupiedManagementPort};
 if(method==='assertOffline'){
  const localStatus=await local.status(pluginId);assert.equal(localStatus.configured,true);assert.equal(localStatus.running,false);assert.equal(localStatus.managementPort,peer.occupiedManagementPort);
  return {configured:true,running:false,credentialsSaved:true,repairableInGui:true};
 }
 if(method==='assertLocal'){
  const localStatus=await local.status(pluginId);assert.equal(localStatus.configured,true);assert.equal(localStatus.running,true);
  const value=await engine.request('config.get');
  assert.equal(value.config.listen,'127.0.0.1:'+peer.nextPorts.listenPort);assert.equal(value.config.maxRequestBytes,Math.round(2.5*1048576));assert.equal(value.config.maxConcurrency,16);assert.equal(value.config.routes.length,1);assert.equal(value.config.routes[0].id,'primary');
  const body=await fs.readFile(path.join(directory,'host-data/gateway/'+pluginId+'/secrets.bin'));
  assert.ok(!body.includes(Buffer.from('fixture-upstream-key'))&&!body.includes(Buffer.from('fixture-client-key')),'managed credentials persisted plaintext');
  return {configured:true,portsChanged:true,routes:1,credentialsEncrypted:true};
 }
 if(method==='assertCatalog'){
  assert.equal(peer.catalogs.length,input.count);assert.equal(peer.forwarded.length,0,'catalog must not send inference POST');assert.equal(peer.requests.length,0,'catalog must not act as a data request');
  const last=peer.catalogs.at(-1);assert.equal(last.method,'GET');assert.equal(last.path,'/v1/models');assert.equal(last.bodyBytes,0);
  assert.equal(last.authorization,input.routeId==='secondary'?'Bearer fixture-secondary-rotated-upstream-key-9876543210':'Bearer fixture-upstream-key-9876543210');
  const records=await engine.request('records.list.filtered',{limit:100});assert.equal(records.records.length,0,'catalog read must not create inference records');
  await capture(input.routeId==='secondary'?'model-catalog-rotated.png':'model-catalog-primary.png');
  return {catalogReads:peer.catalogs.length,method:'GET',savedAuthenticationUsed:true,inferencePosts:0,recordedRequests:0};
 }
 if(method==='assertManagedRoute'){
  const before=peer.forwarded.length;
  const response=await peer.send(input.address,'{"model":"fixture-model","input":"GUI 密钥更换"}',{routeId:'secondary',clientKey:'fixture-secondary-rotated-client-key-0123456789'});
  assert.equal(response.status,200);assert.equal(peer.forwarded.length,before+1);assert.equal(peer.forwarded.at(-1).authorization,'Bearer fixture-secondary-rotated-upstream-key-9876543210');
  await until(async()=>{const value=await engine.request('records.list.filtered',{limit:100});return value.records.some((record:any)=>record.route_id==='secondary'&&record.status==='completed');},'managed route request did not finish');
  const value=await engine.request('records.list.filtered',{limit:100});
  await engine.request('records.delete.selection',{selection:{recordIds:value.records.filter((record:any)=>record.route_id==='secondary').map((record:any)=>record.id)}});
  peer.requests.splice(0);peer.forwarded.splice(0);
  return {routeAccepted:true,rotatedCredentialsUsed:true};
 }
 if(method==='send'){
  const before=peer.forwarded.length,response=await peer.send(input.address,input.body);
  await until(async()=>{const value=await engine.request('records.list.filtered',{limit:100});return value.records.length>=peer.requests.length&&value.records.every((record:any)=>record.status!=='forwarding');},'Rust request did not finish');
  assert.equal(peer.forwarded.length,before+1,'one request must cause exactly one upstream request');
  const sent=peer.forwarded[before],parsed=JSON.parse(sent.body.toString('utf8'));
  assert.equal(sent.authorization,'Bearer fixture-upstream-key-9876543210');assert.equal(sent.headers.cookie,undefined);
  return {httpStatus:response.status,reported:JSON.parse(response.body).service_tier,responseError:JSON.parse(response.body).error?.code,forwardedTier:Object.hasOwn(parsed,'service_tier')?parsed.service_tier:null,nested:parsed.nested?.service_tier,largeExact:!input.body.includes('large')||sent.body.includes(Buffer.from('123456789012345678901234567890'))};
 }
 if(method==='assertRecords'){
  const value=await engine.request('records.list.filtered',{limit:100});assert.equal(value.records.length,input.count);
  for(const record of value.records){assert.equal(record.reported.value,'default');assert.equal(record.input_tokens,11);assert.equal(record.output_tokens,5);assert.equal(record.cache_read_tokens,null);}
  return {records:value.records.length};
 }
 if(method==='assertCustomRecords'){
  const value=await engine.request('records.list.filtered',{limit:100});
  assert.equal(value.records.length,6);assert.equal(peer.forwarded.length,6);
  for(const [tier,status] of [['provider_custom-2026',200],['provider_rejected-2026',400]] as const){
   const record=value.records.find((record:any)=>record.effective.state==='string'&&record.effective.value===tier);
   assert.ok(record,'custom tier record missing '+tier);assert.deepEqual(record.original,{state:'string',value:'flex'});
   assert.equal(record.http_status,status);assert.equal(record.status,status===200?'completed':'upstream-error');
   if(status===200){assert.deepEqual(record.reported,{state:'string',value:'default'});assert.equal(record.input_tokens,11);assert.equal(record.output_tokens,5);}
   else {assert.deepEqual(record.reported,{state:'missing'});assert.equal(record.input_tokens,null);assert.equal(record.output_tokens,null);}
  }
  return {records:6,upstreamRequests:6,rejectedRequests:1,noRetry:true};
 }
 if(method==='assertCli'){
  const text=await fs.readFile(path.join(directory,'home/.codex/config.toml'),'utf8');
  assert.match(text,/model = "fixture-model"/);assert.match(text,/service_tier = "flex"/);
  if(input.state==='applied'){assert.ok(text.includes('http://'+input.address+'/primary/v1'));assert.ok(text.includes('fixture-client-key-0123456789'));}else assert.equal(text,cliOriginal);
  return {state:input.state,modelPreserved:true,tierPreserved:true};
 }
 throw new Error('fixed test command unavailable');
}
async function pollCommands(){
 if(commandBusy||!frame())return;commandBusy=true;
 try{const queue:any[]=await inFrame('window.gatewayFixtureQueue?.splice(0) || []');
  for(const command of queue){let result;try{result={type:'gateway-fixture-result',id:command.id,ok:true,result:await testCommand(command.method,command.input)};}catch(error){result={type:'gateway-fixture-result',id:command.id,ok:false,error:String(error)};}await inFrame('window.postMessage('+JSON.stringify(result)+', "*")');}
 }catch(error){errors.push(String(error));}finally{commandBusy=false;}
}

app.whenReady().then(async()=>{
 try{
  assert.equal(app.commandLine.hasSwitch('no-sandbox'),false,'process sandbox must remain enabled');
  assert.equal(safeStorage.isEncryptionAvailable(),true,'actual Electron secure storage unavailable');
  const cipher={available:()=>safeStorage.isEncryptionAvailable(),encrypt:(text:string)=>safeStorage.encryptString(text).toString('base64'),decrypt:(text:string)=>safeStorage.decryptString(Buffer.from(text,'base64'))};
  const imported=await import(pathToFileURL(config.peerModule).href);peer=await imported.createRealUiPeer(directory);
  const hostDirectory=path.join(directory,'host-data');await fs.mkdir(hostDirectory,{recursive:true});
  await fs.mkdir(path.join(directory,'home/.codex'),{recursive:true});await fs.writeFile(path.join(directory,'home/.codex/config.toml'),cliOriginal);
  local=new GatewayLocalService({dataDir:hostDirectory,binaryPath:config.binaryPath,allowFixtureUpstream:true,
   factories:{startEngine:async options=>{const started=await startEngine(options);engine=started;return started;},
    createManagementGateway:options=>createManagementGateway({...options,modelCatalog:createModelCatalog({
     lookup:(hostname,_options,callback)=>{if(hostname!=='upstream.example'){callback(new Error('test-fixed-catalog-host-only'));return;}callback(null,[{address:'93.184.216.34',family:4}]);},
     request:https.request,
    })})}});
  gateway=new GatewayManagementService({directory:hostDirectory,cipher,atomicWrite,local,
   emit:event=>{events.push(structuredClone(event));if(win&&!win.isDestroyed())win.webContents.send('lumi:extensionEvent',event);},
   chooseExport:async()=>path.join(directory,'export.jsonl'),writeExport:async(file,content)=>atomicWrite(file,content)});
  await gateway.load();
  const cli=new GatewayCliConfigService(cipher,hostDirectory,{homeDir:path.join(directory,'home'),environment:()=>({}),resolveTarget:(input,owner)=>gateway.resolveCliTarget(input,owner),assertContext:(input,owner)=>gateway.assertCliContext(input,owner),isToolRunning:async()=>false,atomicWrite});
  gateway.setCliBridge(cli);
  const gatewayBridge={request:gateway.request.bind(gateway),revoke:async(owner:any,reason:any)=>{revocations.push({owner,reason});await gateway.revoke(owner,reason);}};
  const sdk=await fs.readFile(path.join(config.host,'dist-electron/lumi-extension-sdk.js'));
  const uiCss=await fs.readFile(path.join(config.host,'dist-electron/extension-ui.css'));
  const hostPrimitiveCssSha256=createHash('sha256').update(uiCss).digest('hex');
  await fs.writeFile(path.join(directory,'host-ui.css'),uiCss);
  const sourceSdk=await fs.readFile(path.join(config.host,'public/lumi-extension-sdk.js'),'utf8');
  assert.ok(sdk.toString('utf8').trimEnd().endsWith(sourceSdk.trimEnd()),'built SDK must include the current SDK after its generated UI runtime');
  host=new ExtensionHost({directory:path.join(directory,'packages'),settingsDirectory:hostDirectory,cipher,sdk,uiCss,hostVersion:JSON.parse(await fs.readFile(path.join(config.host,'package.json'),'utf8')).version,context:()=>({theme:'light',locale:'zh-CN',site:{id:'fixture',name:'Fixture',url:'https://example.invalid'}}),scope:()=> 'fixture',read:async()=>{throw new Error('unrequested fixture method');},gateway:gatewayBridge});
  await host.start();assert.ok(host.has(pluginId),JSON.stringify(host.inventory().diagnostics));await host.setEnabled(pluginId,true);
  protocol.handle('lumi-extension',request=>{const asset=host.asset(request.url);if(!asset)return new Response('',{status:404});return new Response(asset.body,{headers:{'content-type':asset.type,'content-security-policy':asset.csp,'cache-control':'no-store','access-control-allow-origin':'*','x-content-type-options':'nosniff'}});});
  win=new BrowserWindow({width:1280,height:1000,show:false,webPreferences:{preload:path.join(config.host,'dist-electron/preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,backgroundThrottling:false}});
  win.webContents.on('did-frame-finish-load',(_event,_main,_process,routingId)=>loadedFrames.add(routingId));
  const prefs=win.webContents.getLastWebPreferences();assert.equal(prefs.sandbox,true);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.nodeIntegration,false);
  win.webContents.on('console-message',(...args:any[])=>{const item=args.find(value=>typeof value==='object'&&typeof value?.message==='string');const level=item?.level??args[1],message=item?.message??args[2];if((level>=2||level==='error')&&!String(message).includes('Content Security Policy')&&!String(message).includes('Electron Security Warning'))errors.push(String(message));});
  win.webContents.session.webRequest.onBeforeRequest((details,callback)=>{const allowed=details.url.startsWith('file:')||details.url.startsWith('lumi-extension:')||details.url.startsWith('data:');if(!allowed)blocked.push(details.url);callback({cancel:!allowed});});
  handle('extensionInventory',()=>host.inventory());handle('listPlugins',()=>host.statuses());
  handle('extensionRequest',async raw=>{const input=requestSchema.parse(raw);calls.push(safeAudit(input));if(input.method==='gateway.records.list'&&(input.input as any)?.cursor&&recordsAppendHeld){recordsAppendPending=true;await new Promise<void>(resolve=>{releaseRecordsAppend=resolve;});recordsAppendPending=false;}const output=await host.request(input);assert.ok(!/fixture-(?:upstream|client|secondary).*key/.test(JSON.stringify(output)),'SDK output reflected credential data');return output;});
  await win.loadFile(path.join(directory,'host.html'));
  await until(async()=>!!frame()&&await inFrame('!!window.lumiExtension?.gateway'),'real ExtensionFrame SDK did not initialize');
  // Only test driver queues invoke the fixed local fake upstream. Plugin methods
  // still use the actual production preload -> ExtensionHost -> TLS service.
  await inFrame("window.gatewayFixtureQueue=[];addEventListener('message',event=>{if(event.source===window && event.data?.type==='gateway-fixture-command')window.gatewayFixtureQueue.push(event.data);});");
  commandTimer=setInterval(()=>{void pollCommands();},10);
  if(config.simplified){
   ready=true;
   const setupPorts=(await testCommand('ports',{})).setup;
   const scenario=await fs.readFile(path.join(directory,'simplified-ui-scenario.js'),'utf8');
   const control=`(command,value)=>{const id=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('real fixture control timeout')),8000);const receive=e=>{if(e.source!==window||e.data?.type!=='gateway-fixture-result'||e.data.id!==id)return;clearTimeout(timer);removeEventListener('message',receive);if(e.data.ok)resolve(e.data.result);else reject(new Error(e.data.error));};addEventListener('message',receive);window.postMessage({type:'gateway-fixture-command',id,method:command,input:value||{}},'*');});}`;
   await inFrame('window.gatewayCompactProbe=('+await fs.readFile(path.join(directory,'compact-overview-probe.js'),'utf8')+')');
   const result:any=await inFrame('('+scenario+')({real:true,ports:'+JSON.stringify(setupPorts)+',control:'+control+'})',60000);
   clearInterval(commandTimer);commandTimer=undefined;
   const status=await engine.request('config.get');assert.equal(status.config.rules.length,0);assert.equal(status.config.rectifiers.length,2);
   const viewChecks:any[]=[],overviewChecks:any[]=[];
   const dreamyManifest=JSON.parse(await fs.readFile(path.join(config.host,'../extensions/plugins/extension.author.dreamy/plugin.json'),'utf8'));
   const dreamy={id:dreamyManifest.id,css:await fs.readFile(path.join(config.host,'../extensions/plugins/extension.author.dreamy/interface.css'),'utf8'),appearanceGroups:dreamyManifest.appearanceGroups};
   for(const interfaceName of ['default','dreamy']){
    await run('fixture.interfaceStyle('+JSON.stringify(interfaceName==='dreamy'?dreamy:null)+')');
    for(const width of [1280,600,480]){win.setContentSize(width,1000);
     for(const theme of ['light','dark']){
      await run('fixture.theme('+JSON.stringify(theme)+')');
      await until(()=>inFrame('document.documentElement.dataset.theme==='+JSON.stringify(theme)),'theme was not delivered');
      await new Promise(resolve=>setTimeout(resolve,100));
      await inFrame('window.scrollTo(0,0);document.querySelector("[data-tab=gateway]").click()');
      await capture(interfaceName+'-'+theme+'-'+width+'-overview.png');
      overviewChecks.push({interfaceName,theme,width,catalogScrolled:false,...await inFrame('window.gatewayCompactProbe()')});
      await inFrame('document.body.scrollTop=document.body.scrollHeight');await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,40));
      const bottomProbe:any=await inFrame('window.gatewayCompactProbe()');
      await fs.writeFile(path.join(directory,'bottom-scroll-probe.json'),JSON.stringify({bottomProbe,geometry:await inFrame('({bodyScroll:document.body.scrollTop,rootScroll:document.documentElement.scrollTop,scrollY,bodyHeight:document.body.clientHeight,bodyScrollHeight:document.body.scrollHeight,bodyCss:getComputedStyle(document.body).height,bodyMin:getComputedStyle(document.body).minHeight,bodyOverflow:getComputedStyle(document.body).overflow,htmlOverflow:getComputedStyle(document.documentElement).overflow})')},null,2));
      assert.ok(bottomProbe.pageScrollTop>0&&bottomProbe.catalogHeight>320,'long model graph did not use the page scrolling area: '+JSON.stringify(bottomProbe));
      const finalModel:any=await inFrame('(()=>{const el=[...document.querySelectorAll("[data-chain-model-id]")].at(-1),r=el.getBoundingClientRect(),add=document.getElementById("chain-catalog-add").getBoundingClientRect();return {top:r.top,bottom:r.bottom,addBottom:add.bottom,height:innerHeight};})()');
      assert.ok(finalModel.top>=-2&&finalModel.bottom<=finalModel.height+2&&finalModel.addBottom<=finalModel.height+2,'last model or add row cannot be reached through page scrolling');
      overviewChecks.push({interfaceName,theme,width,pageScrolled:true,finalModel,...bottomProbe});
      const bottomName=interfaceName+'-'+theme+'-'+width+'-overview-bottom.png';await fs.writeFile(path.join(directory,bottomName),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());screenshots.push(bottomName);
      await inFrame('document.body.scrollTop=0');
      for(const dialogName of ['provider','local']){
       const open=dialogName==='provider'?'document.querySelector("[data-chain-provider-id=primary]").click()':'document.getElementById("chain-lumi-settings").click()';
       const id=dialogName==='provider'?'provider-editor-dialog':'local-settings-dialog',close=dialogName==='provider'?'provider-dialog-close':'local-dialog-close';
       await inFrame(open);await until(()=>inFrame('document.getElementById('+JSON.stringify(id)+').open'),'dialog did not open');
       const probe:any=await inFrame(`(()=>{const el=document.getElementById(${JSON.stringify(id)}),body=el.querySelector('.gateway-dialog-body'),r=el.getBoundingClientRect(),br=body.getBoundingClientRect(),nested=body.firstElementChild,cs=getComputedStyle(el),ns=getComputedStyle(nested);return {id:el.id,outer:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},body:{left:br.left,right:br.right,top:br.top,bottom:br.bottom,clientHeight:body.clientHeight,scrollHeight:body.scrollHeight,clientWidth:body.clientWidth,scrollWidth:body.scrollWidth},viewport:{width:innerWidth,height:innerHeight},skin:{border:cs.borderTopWidth,radius:cs.borderRadius,overflow:cs.overflow,background:cs.backgroundColor,backdrop:cs.backdropFilter,nestedBorder:ns.borderTopWidth,nestedRadius:ns.borderRadius,nestedShadow:ns.boxShadow,nestedBackground:ns.backgroundColor,nestedBackdrop:ns.backdropFilter}};})()`);
       assert.ok(probe.outer.left>=-2&&probe.outer.right<=probe.viewport.width+2,'dialog horizontal viewport overflow');
       const outer:any=await run('({frameTop:document.querySelector("iframe").getBoundingClientRect().top,height:innerHeight})');
       assert.ok(probe.outer.top+outer.frameTop>=-2&&probe.outer.bottom+outer.frameTop<=outer.height+2,'dialog outside desktop viewport');
       assert.equal(probe.skin.overflow,'hidden');assert.equal(probe.skin.nestedBorder,'0px');assert.equal(probe.skin.nestedRadius,'0px');assert.equal(probe.skin.nestedShadow,'none');assert.equal(probe.skin.nestedBackdrop,'none');
       assert.ok(probe.body.scrollWidth<=probe.body.clientWidth+2,'dialog content overflowed horizontally');
       if(dialogName==='provider')assert.ok(probe.body.scrollHeight>probe.body.clientHeight+100,'long provider form did not use its inner scrolling area');
       viewChecks.push({interfaceName,theme,width,dialogName,...probe});
       await capture(interfaceName+'-'+theme+'-'+width+'-'+dialogName+'-top.png');
       if(dialogName==='provider'){await inFrame('document.querySelector("#provider-editor-dialog .gateway-dialog-body").scrollTop=100000');await capture(interfaceName+'-'+theme+'-'+width+'-provider-bottom.png');}
       await inFrame('document.getElementById('+JSON.stringify(close)+').click()');assert.equal(await inFrame('document.getElementById('+JSON.stringify(id)+').open'),false);
      }
     }
    }
   }
   await run('fixture.interfaceStyle(null);fixture.theme("light")');
   for(const height of [700,1200]){win.setContentSize(1280,height);await inFrame('document.body.scrollTop=0;document.documentElement.scrollTop=0;window.scrollTo(0,0)');await capture('default-light-1280-'+height+'-overview.png');overviewChecks.push({interfaceName:'default',theme:'light',height,catalogScrolled:false,...await inFrame('window.gatewayCompactProbe()')});}
   win.setContentSize(1280,1000);await run('fixture.interfaceStyle(null);fixture.theme("light")');
   const before=await engine.request('config.get');const provider=before.config.routes.find((r:any)=>r.id==='primary'),model=provider.models[0];
   const data=await peer.send(before.config.listen,{model:model.id,input:'isolated automatic-connection regression',service_tier:'default'},{routeId:'primary',clientKey:'fixture-client-key-0123456789'});
   assert.equal(data.status,200);assert.equal(JSON.parse(peer.forwarded.at(-1).body.toString()).service_tier,'flex');
   // Observe two actual concurrent TLS SSE calls through production chain DTOs and UI polling.
   const liveModels=provider.models.filter((m:any)=>m.enabled).slice(0,2);assert.equal(liveModels.length,2);
   const liveSession=calls.filter(value=>value.method==='gateway.routes.config.get').at(-1).input.sessionId;
   const liveSnapshot=()=>inFrame('window.lumiExtension.gateway.chain.snapshot({sessionId:'+JSON.stringify(liveSession)+'})');
   const promises=liveModels.map((m:any,i:number)=>peer.send(before.config.listen,{model:m.id,input:'isolated window '+(i?'b':'a'),stream:true},{routeId:'primary',clientKey:'fixture-client-key-0123456789'}));
   await until(async()=>peer.streamReady('isolated window a')&&peer.streamReady('isolated window b'),'concurrent TLS streams did not start');
   peer.emitStream('isolated window a','文😀');peer.emitStream('isolated window b','xyz');
   await until(()=>inFrame('document.querySelectorAll("#chain-flow svg path.is-active[data-edge=model]").length===2&&document.querySelectorAll("#chain-requests [data-active=true]").length===2'),'real concurrent model lines or request cards did not light up');
   const initial:any=await liveSnapshot(),active=initial.traces.filter((t:any)=>t.phase!=='finished');assert.equal(active.length,2);
   const liveA=active.find((t:any)=>t.requestedModel===liveModels[0].id),liveB=active.find((t:any)=>t.requestedModel===liveModels[1].id);
   assert.equal(liveA.rateWindow.outputChars,2);assert.equal(liveB.rateWindow.outputChars,3);assert.equal(liveA.rateWindow.source,'content-delta');
   assert.equal(await inFrame('document.querySelectorAll("#chain-flow svg path.is-active[data-edge=selection]").length'),1);
   const capacity:any=await inFrame('({count:document.getElementById("chain-requests").children.length,capacity:Number(document.getElementById("chain-requests").dataset.capacity)})');assert.equal(capacity.count,capacity.capacity);
   const liveFirstElapsed=liveA.elapsedMs;await capture('default-light-1280-active-concurrent.png');
   await inFrame('document.body.scrollTop=document.body.scrollHeight');await new Promise(resolve=>setTimeout(resolve,60));const activeBottom='default-light-1280-active-concurrent-bottom.png';await fs.writeFile(path.join(directory,activeBottom),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());screenshots.push(activeBottom);await inFrame('document.body.scrollTop=0');
   await new Promise(resolve=>setTimeout(resolve,5200));
   const idle:any=await liveSnapshot(),idleA=idle.traces.find((t:any)=>t.id===liveA.id);assert.equal(idle.revision,initial.revision);assert.ok(idleA.elapsedMs>liveFirstElapsed+5000);assert.equal(idleA.rateWindow.outputChars,0);assert.equal(idleA.rateWindow.charsPerSecond,0);
   peer.emitStream('isolated window a','新123');await until(()=>inFrame('(()=>{const card=[...document.querySelectorAll("#chain-requests [data-active=true]")].find(el=>el.querySelector("strong").textContent==='+JSON.stringify(liveModels[0].upstreamModel)+');return card?.querySelector("[data-metric=rate]").textContent==="0.8 字符/s";})()'),'same-revision UI polling did not update the 5s window');
   peer.finishStream('isolated window b');assert.equal((await promises[1]).status,200);
   await until(()=>inFrame('document.querySelectorAll("#chain-flow svg path.is-active[data-edge=model]").length===1&&document.querySelectorAll("#chain-requests [data-active=true]").length===1'),'one completed stream removed another live model line');
   peer.finishStream('isolated window a');assert.equal((await promises[0]).status,200);
   await until(()=>inFrame('!document.querySelector("#chain-flow svg path.is-active")&&!document.querySelector("#chain-requests [data-active=true]")'),'real completed model paths stayed highlighted');
   const ended:any=await liveSnapshot(),endedA=ended.traces.find((t:any)=>t.id===liveA.id);assert.equal(endedA.rateWindow.charsPerSecond,0.8);assert.equal(endedA.record.outputTokens,77);
   await new Promise(resolve=>setTimeout(resolve,80));const frozen:any=await liveSnapshot();assert.deepEqual(frozen.traces.find((t:any)=>t.id===liveA.id).rateWindow,endedA.rateWindow);assert.equal(frozen.traces.find((t:any)=>t.id===liveA.id).elapsedMs,endedA.elapsedMs);
   const activeChecks={concurrent:2,initialChars:[2,3],windowMs:5000,idleExpiresToZero:true,updatedWithoutRevision:true,finalRate:endedA.rateWindow.charsPerSecond,unit:'Unicode code points/s',reportedTokensKeptSeparate:77,finishedFrozen:true,capacity:capacity.capacity,allPathsWithdrawn:true};
   const generation=defaultStatus().generation,sessionId=calls.filter(value=>value.method==='gateway.connect').length;
   const oldSessionId=calls.filter(value=>value.method==='gateway.routes.config.get').at(-1).input.sessionId;
   await run('fixture.visible(false)');await until(()=>run('!document.querySelector("iframe")'),'view did not unmount');
   await until(async()=>calls.some(value=>value.method==='gateway.disconnect'&&value.input.sessionId===oldSessionId),'view did not release the old session');
   const owner={id:pluginId,generation,view:'gateway',signal:new AbortController().signal};
   await assert.rejects(()=>gateway.request('gateway.listener.start',{sessionId:oldSessionId},owner),/revoked/);
   const visibleStatus:any=await gateway.request('gateway.status',{},owner);assert.equal(visibleStatus.pairings[0].connected,false);assert.equal(visibleStatus.pairings[0].listening,true,'view exit stopped the listener');
   await run('fixture.visible(true)');await until(async()=>!!frame()&&await inFrame('document.getElementById("connection-badge").textContent==="已连接" && document.getElementById("listener-state").textContent==="正在监听"'),'frame remount did not automatically reconnect to live gateway');
   assert.ok(calls.filter(value=>value.method==='gateway.connect').length>sessionId);assert.equal(defaultStatus().generation,generation);
   await host.setEnabled(pluginId,false);await until(async()=>{const current=await local.status(pluginId);return !current.running;},'plugin disable did not stop the managed runtime');
   assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(blocked.length,0,JSON.stringify(blocked));
   for(const call of calls)assert.ok(!/fixture-(?:upstream|client).*key/.test(JSON.stringify(call)),'audit exposed credential');
   const report={...result,ok:true,realExtensionHost:true,realExtensionFrame:true,productionPreload:true,productionSdk:true,realTlsManagement:true,realRustEngine:true,actualSecureStorage:true,hostSourcesModified:false,activeChecks,coreBinary:{path:config.binaryPath,sha256:config.binarySha256},processSandboxEnabled:true,iframeSandbox:'allow-scripts',viewChecks,overviewChecks,screenshots,actualTierForwarding:true,automaticRemount:true,disabledRuntimeStopped:true,methods:[...new Set(calls.map(value=>value.method))],calls:calls.length,events:events.length,errors,blocked};
   await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,result:path.join(directory,'result.json')}));
   await gateway.shutdown();await peer.close();host.dispose();win.destroy();app.exit(0);return;
  }
  for(const [file,name] of [['dense-ui-scenario.js','gatewayDenseScenario'],['dense-layout-probe.js','gatewayDenseLayoutProbe'],['dense-layout-assertions.js','gatewayDenseLayoutAssert'],['v2-ui-scenario.js','gatewayV2Scenario'],['overview-ui-scenario.js','gatewayOverviewScenario'],['provider-catalog-ui-scenario.js','gatewayProviderCatalogScenario']])await inFrame('window.'+name+'=('+await fs.readFile(path.join(directory,file),'utf8')+')');
  const scenario=(await fs.readFile(path.join(directory,'real-ui-scenario.js'),'utf8')).replace("parent.postMessage({type:'gateway-fixture-command'","window.postMessage({type:'gateway-fixture-command'").replace("event.source!==parent","event.source!==window");
  const result:any=await inFrame('('+scenario+')()',60000);clearInterval(commandTimer);commandTimer=undefined;ready=true;
  await inFrame('document.querySelector("[data-tab=rules]").click();document.querySelector("#routes-list button[data-route-id=primary]").click()');
  const clientTarget:any=await inFrame('({url:document.getElementById("route-client-url").textContent,modelsUrl:document.getElementById("route-models-url").textContent,address:document.getElementById("listener-address").textContent,managementPort:document.getElementById("local-management-port").value})');
  assert.equal(clientTarget.url,'http://'+clientTarget.address+'/primary/v1','saved route shows the wrong client API URL');
  assert.equal(clientTarget.modelsUrl,clientTarget.url+'/models','saved route shows the wrong model GET URL');
  assert.ok(!clientTarget.url.includes(':'+clientTarget.managementPort+'/'),'client API URL used the internal management port');
  const denseOptions={expectedRoutes:result.denseDisplay.routeCount,expectedRules:result.denseDisplay.ruleCount,selectedRoute:result.denseDisplay.selectedRoute,selectedRule:result.denseDisplay.selectedRule,hostHeight:1000};
  // Recreate the actual ExtensionFrame to prove visibility is stored by the
  // host, rather than surviving only in the old document's JavaScript state.
  const oldOverviewFrame=frame();await fs.writeFile(path.join(directory,'main-progress.json'),JSON.stringify({stage:'remount/hide'}));await run('fixture.visible(false)');await until(async()=>!await run('!!document.querySelector("iframe")')&&!win.webContents.mainFrame.frames.some(f=>!f.detached&&f.frameTreeNodeId===oldOverviewFrame.frameTreeNodeId),'overview remount did not release old view');
  await fs.writeFile(path.join(directory,'main-progress.json'),JSON.stringify({stage:'remount/show'}));await run('fixture.visible(true)');await until(async()=>!!frame()&&await inFrame('document.getElementById("connection-badge").textContent==="未连接"'),'overview remount did not create fresh document');
  for(const [file,name] of [['dense-ui-scenario.js','gatewayDenseScenario'],['dense-layout-probe.js','gatewayDenseLayoutProbe'],['dense-layout-assertions.js','gatewayDenseLayoutAssert'],['v2-ui-scenario.js','gatewayV2Scenario'],['overview-ui-scenario.js','gatewayOverviewScenario'],['provider-catalog-ui-scenario.js','gatewayProviderCatalogScenario']])await inFrame('window.'+name+'=('+await fs.readFile(path.join(directory,file),'utf8')+')');
  await fs.writeFile(path.join(directory,'main-progress.json'),JSON.stringify({stage:'remount/connect'}));await inFrame('document.getElementById("connect").click()');await until(()=>inFrame('document.getElementById("connection-badge").textContent==="已连接"&&document.getElementById("listener-state").textContent==="正在监听"&&document.getElementById("status-message").textContent.includes("路由、规则与记录已从模型网关读取")'),'overview remount could not reconnect');
  assert.equal(await inFrame(`!!document.querySelector('[data-chain-model-id="ui-model-b"][data-provider-id="primary"]')&&!document.querySelector('[data-chain-model-id="ui-model-a"][data-provider-id="primary"]')`),true,'visibility lost after real document remount');
  await fs.writeFile(path.join(directory,'main-progress.json'),JSON.stringify({stage:'remount/open-supplier'}));await inFrame(`document.querySelector('[data-chain-provider-id="primary"]').click()`);await until(()=>inFrame('document.getElementById("provider-editor-dialog").open'),'remounted supplier did not open');
  assert.equal(await inFrame('document.getElementById("provider-model-0-overviewHidden").checked'),true,'remounted supplier lost hidden checkbox');await capture('overview-supplier-edit-light-1280.png');
  await inFrame('document.getElementById("provider-dialog-close").click();document.getElementById("chain-listener-toggle").click()');await until(()=>inFrame('document.getElementById("listener-stop-dialog").open'),'remount switch did not request stop');
  await inFrame('document.getElementById("listener-stop-confirm").click()');await until(()=>inFrame('document.getElementById("listener-state").textContent==="已停止"&&!document.getElementById("chain-listener-toggle").disabled'),'remount switch did not stop');
  await inFrame('document.getElementById("chain-listener-toggle").click()');await until(()=>inFrame('document.getElementById("listener-state").textContent==="正在监听"&&!document.getElementById("chain-listener-toggle").disabled'),'remount switch did not restart');
  await inFrame('document.querySelector("[data-tab=rules]").click();document.querySelector('+JSON.stringify('button[data-rule-id="'+denseOptions.selectedRule+'"]')+').click();document.querySelectorAll("details").forEach(el=>el.open=false)');
  result.overview.fullViewRemount=true;
  const primitiveChecks:any[]=[],viewportChecks:any[]=[];
  for(const width of [1280,600,480]){
   win.setContentSize(width,1000);await new Promise(resolve=>setTimeout(resolve,80));
   for(const theme of ['light','dark']){
    await run('fixture.theme('+JSON.stringify(theme)+')');
    await until(()=>inFrame('document.documentElement.dataset.theme==='+JSON.stringify(theme)+'&&document.body.dataset.theme==='+JSON.stringify(theme)),'real host theme not delivered');
    await until(()=>run('document.documentElement.dataset.theme==='+JSON.stringify(theme)),'host reference theme not applied');
    // Host buttons animate theme background changes for 180 ms. Compare their
    // settled styles, rather than different frames of two independent documents.
    // Hidden BrowserWindows may defer that transition until a compositor frame
    // is requested. Wake the surface before counting its settling time.
    await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});
    await new Promise(resolve=>setTimeout(resolve,250));
    primitiveChecks.push(await assertDefaultPrimitives(theme,width));
    for(const tab of ['gateway','rules','rectify','agents','records','settings']){
     await inFrame('document.querySelector('+JSON.stringify('[data-tab="'+tab+'"]')+').click();window.scrollTo(0,0);document.querySelectorAll(".gateway-catalog-scroll").forEach(element=>{element.scrollTop=0;element.scrollLeft=0;})');
     await run('document.querySelector(".content-scroll").scrollTo(0,0)');await new Promise(resolve=>setTimeout(resolve,50));
     const view:any=await assertPageLayout(tab,denseOptions);
     let overviewFlow:any;
     if(tab==='gateway'){
      await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,35));
      overviewFlow=await inFrame(`(()=>{const rect=el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};const root=document.getElementById('chain-catalog');return {width:innerWidth,switchInsideLumi:!!document.getElementById('chain-listener-toggle').closest('.gateway-lumi-node'),root:rect(root),scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,additions:['chain-provider-add','chain-model-add'].map(id=>({id,rect:rect(document.getElementById(id)),reference:rect(root.querySelector(id==='chain-provider-add'?'[data-chain-provider-id]':'[data-chain-model-id]'))})),addRowLast:root.lastElementChild.id==='chain-catalog-add',thumbBackground:getComputedStyle(document.querySelector('.gateway-switch-track'),'::after').backgroundColor,edges:[...root.querySelectorAll('path')].map(path=>{const group=path.closest('.gateway-provider-group'),svg=rect(path.ownerSVGElement),provider=rect(group.querySelector('[data-chain-provider-id]')),model=rect([...group.querySelectorAll('[data-chain-model-id]')].find(el=>el.dataset.chainModelId===path.dataset.modelId)),first=path.getPointAtLength(0),last=path.getPointAtLength(path.getTotalLength());return {providerId:group.dataset.providerId,modelId:path.dataset.modelId,first:{x:first.x+svg.left,y:first.y+svg.top},last:{x:last.x+svg.left,y:last.y+svg.top},provider,model};})};})()`);
      assert.equal(overviewFlow.switchInsideLumi,true);assert.equal(overviewFlow.edges.length,1);assert.ok(overviewFlow.scrollWidth<=overviewFlow.clientWidth+2);
      assert.notEqual(overviewFlow.thumbBackground,'rgba(0, 0, 0, 0)','gateway switch thumb is transparent');assert.equal(overviewFlow.addRowLast,true);for(const add of overviewFlow.additions){assert.equal(add.rect.height,30);assert.ok(Math.abs(add.rect.left-add.reference.left)<2&&Math.abs(add.rect.width-add.reference.width)<2,'bottom plus node diverged from its column');}
      for(const edge of overviewFlow.edges){assert.equal(edge.providerId,'primary');assert.equal(edge.modelId,'ui-model-b');assert.ok(Math.abs(edge.first.x-edge.provider.right)<2&&Math.abs(edge.first.y-(edge.provider.top+edge.provider.height/2))<2&&Math.abs(edge.last.x-edge.model.left)<2&&Math.abs(edge.last.y-(edge.model.top+edge.model.height/2))<2,'resized supplier/model edge disconnected');}
     }
     viewportChecks.push({theme,viewportWidth:width,tab,...view,...(overviewFlow?{overviewFlow}:{})});await capture(theme+'-'+width+'-'+tab+'.png');
     if(tab==='gateway'){
      await inFrame(`document.getElementById('chain-catalog').scrollTop=document.getElementById('chain-catalog').scrollHeight`);await capture(theme+'-'+width+'-gateway-add.png');await inFrame(`document.getElementById('chain-catalog').scrollTop=0`);
      await inFrame(`document.querySelector('[data-chain-provider-id="primary"]').click()`);await until(()=>inFrame('document.getElementById("provider-editor-dialog").open'),'supplier dialog did not open for viewport');
      const dialog:any=await inFrame(`(()=>{const el=document.getElementById('provider-editor-dialog'),r=el.getBoundingClientRect();return {left:r.left,right:r.right,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,width:innerWidth};})()`);assert.ok(dialog.left>=-2&&dialog.right<=dialog.width+2&&dialog.scrollWidth<=dialog.clientWidth+2,'supplier editor overflowed viewport');
      await capture(theme+'-'+width+'-supplier-edit.png');
      const positioned:any=await inFrame(`(()=>{const r=document.getElementById('provider-editor-dialog').getBoundingClientRect();return {top:r.top,bottom:r.bottom};})()`),outer:any=await run(`({frameTop:document.querySelector('iframe').getBoundingClientRect().top,height:innerHeight})`);assert.ok(positioned.top+outer.frameTop>=-2&&positioned.bottom+outer.frameTop<=outer.height+2,'supplier dialog is outside the visible desktop viewport');
      await inFrame('document.getElementById("provider-dialog-close").click();document.getElementById("chain-lumi-settings").click()');await until(()=>inFrame('document.getElementById("local-settings-dialog").open'),'Lumi settings dialog did not open for viewport');
      const localDialog:any=await inFrame(`(()=>{const el=document.getElementById('local-settings-dialog'),r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,width:innerWidth};})()`);
      assert.ok(localDialog.left>=-2&&localDialog.right<=localDialog.width+2&&localDialog.scrollWidth<=localDialog.clientWidth+2&&localDialog.top+outer.frameTop>=-2&&localDialog.bottom+outer.frameTop<=outer.height+2,'Lumi settings overflowed the desktop viewport');
      viewportChecks.push({theme,viewportWidth:width,localDialog});await capture(theme+'-'+width+'-lumi-settings.png');await inFrame('document.getElementById("local-dialog-close").click()');
     }
    }
   }
  }
  const generation=defaultStatus().generation;
  const oldSessionId=calls.filter(value=>value.method==='gateway.listener.start').at(-1).input.sessionId;
  // Verify the real ExtensionFrame's method-specific envelope budget, including
  // UTF-8 bytes and the unchanged legacy character limit. The valid 32-route DTO
  // reaches strict Host/TLS management and is safely refused by configuration constraints.
  const largeInput={sessionId:oldSessionId,expectedVersion:0,routes:Array.from({length:32},(_,index)=>({id:'route-'+index,clientAlias:'fixture-'+index,protocol:'openai',upstreamBase:'https://api.example.com/'+ 'p'.repeat(2010),credentialRef:'route-'+index,capabilities:{serviceTier:true},enabled:true}))};
  const largeBytes=Buffer.byteLength(JSON.stringify(largeInput));assert.ok(largeBytes>65536&&largeBytes<=256*1024);
  const beforeLarge=calls.length;
  const largeError=await inFrame('window.lumiExtension.gateway.routes.config.set('+JSON.stringify(largeInput)+').then(()=>null,error=>error.message)');
  assert.ok(!String(largeError).includes('扩展请求过大'),'valid gateway >64K input blocked in frame');
  assert.equal(calls.slice(beforeLarge).filter(value=>value.method==='gateway.routes.config.set').length,1,'large valid gateway input did not reach host');
  const beforeUtf8=calls.length;
  const utf8Error=await inFrame('window.lumiExtension.gateway.rules.replace({sessionId:'+JSON.stringify(oldSessionId)+',expectedVersion:0,rules:[],probe:"私".repeat(90000)}).then(()=>null,error=>error.message)');
  assert.equal(utf8Error,'扩展请求过大。');assert.equal(calls.length,beforeUtf8,'overbudget UTF8 gateway input reached main');
  const beforeLegacy=calls.length;
  const legacyError=await inFrame('window.lumiExtension.storage.read("x".repeat(65540)).then(()=>null,error=>error.message)');
  assert.equal(legacyError,'扩展请求过大。');assert.equal(calls.length,beforeLegacy,'legacy overbudget input reached main');
  const beforeLegacyUtf8=calls.length;
  await inFrame('window.lumiExtension.storage.write("probe","私".repeat(60000)).then(()=>null,error=>error.message)');
  assert.equal(calls.slice(beforeLegacyUtf8).filter(value=>value.method==='storage.write').length,1,'legacy character budget unexpectedly became UTF8-byte budget');
  const requestBudgets={gatewayLargeAcceptedBytes:largeBytes,gatewayUtf8OversizeRejected:true,legacyOversizeRejected:true,legacyMultibyteCharacterBudgetPreserved:true};
  await run('fixture.visible(false)');await until(()=>run('!document.querySelector("iframe")'),'view did not unmount');
  await until(async()=>calls.some(value=>value.method==='gateway.disconnect'&&value.input.sessionId===oldSessionId),'view did not release real session');
  const owner={id:pluginId,generation,view:'gateway',signal:new AbortController().signal};
  await assert.rejects(()=>gateway.request('gateway.listener.start',{sessionId:oldSessionId},owner),/revoked/);
  const visibleStatus:any=await gateway.request('gateway.status',{},owner);assert.equal(visibleStatus.pairings[0].connected,false);assert.equal(visibleStatus.pairings[0].listening,true,'view exit must not stop managed listener');
  const settledEvents=events.length;await new Promise(resolve=>setTimeout(resolve,1200));assert.equal(events.length,settledEvents,'view event subscription leaked');
  await host.setEnabled(pluginId,false);
  await assert.rejects(()=>host.request({id:pluginId,generation,view:'gateway',method:'gateway.status',input:{}}),/停用/);
  assert.equal(host.asset('lumi-extension://'+pluginId+'/'+generation+'/index.html'),undefined);
  assert.equal((await local.status(pluginId)).running,false,'disabled plugin left managed core running');assert.ok(revocations.some(value=>value.reason==='disabled'));
  await host.setEnabled(pluginId,true);await run('fixture.statuses('+JSON.stringify(host.statuses())+');fixture.visible(true)');
  await until(async()=>!!frame()&&await inFrame('!!window.lumiExtension?.gateway && document.getElementById("connection-badge").textContent==="未连接"'),'new generation did not remount empty');
  const summary:any=await gateway.request('gateway.status',{}, {id:pluginId,generation:defaultStatus().generation,view:'gateway',signal:new AbortController().signal});assert.equal(summary.pairings[0].listening,false,'disable did not stop actual data listener');
  await capture('new-generation-dark.png');
  assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(blocked.length,0,JSON.stringify(blocked));
  for(const call of calls)assert.ok(!JSON.stringify(call).includes('fixture-client-key')&&!JSON.stringify(call).includes('fixture-upstream-key'));
  const vault=await fs.readFile(path.join(hostDirectory,'gateway-pairings.json'),'utf8');assert.ok(!vault.includes('fixture-client-key')&&!vault.includes('fixture-upstream-key'),'managed credentials leaked into pairing metadata');
  const report={...result,ok:true,engine:'Electron',electron:process.versions.electron,chromium:process.versions.chrome,realExtensionHost:true,realExtensionFrame:true,productionPreload:true,productionSdk:true,realTlsManagement:true,realRustEngine:true,actualSecureStorage:true,guiOnlySetup:true,hostManagedLifecycle:true,auditSecretsRedacted:true,coreBinary:{path:config.binaryPath,sha256:config.binarySha256},upstream:'fixed test-only HTTPS dial to local TLS mock; CA verification enabled',processSandboxEnabled:true,iframeSandbox:'allow-scripts',sandboxWebPreferences:prefs.sandbox,contextIsolation:prefs.contextIsolation,nodeIntegration:prefs.nodeIntegration,methods:[...new Set(calls.map(value=>value.method))],calls:calls.length,events:events.length,requestBudgets,hostPrimitives:{source:'built dist-electron/extension-ui.css, shared with the default host reference DOM',sha256:hostPrimitiveCssSha256,checks:primitiveChecks,viewportChecks,clientApiUsesDataPort:true},modelCatalog:{getRequests:peer.catalogs.length,primarySavedAuthentication:true,rotatedSavedAuthentication:true,noInferencePostsDuringDetection:true,noInferenceRecordsDuringDetection:true},viewRelease:{sessionsReleased:true,eventsReleased:true,managedListenerContinued:true},generation:{old:generation,new:defaultStatus().generation,oldDenied:true,disabledStopped:true},errors,blocked,screenshots};
  await fs.writeFile(path.join(directory,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,result:path.join(directory,'result.json')}));
  await gateway.shutdown();await peer.close();host.dispose();win.destroy();app.exit(0);
 }catch(error){if(commandTimer)clearInterval(commandTimer);if(ready&&win&&!win.isDestroyed()&&frame()){try{await fs.writeFile(path.join(directory,'dense-layout-failure.json'),JSON.stringify(await inFrame('window.gatewayDenseLayoutProbe()'),null,2));await capture('dense-layout-failure.png');}catch{}}await fs.writeFile(path.join(directory,'failure.json'),JSON.stringify({ok:false,error:String(error),stack:(error as Error)?.stack,ready,calls:calls.map(value=>({method:value.method,input:value.input})),errors,blocked},null,2));console.error((error as Error)?.stack||String(error));await gateway?.shutdown().catch(()=>{});host?.dispose();await peer?.close().catch(()=>{});if(win&&!win.isDestroyed())win.destroy();app.exit(1);}
});

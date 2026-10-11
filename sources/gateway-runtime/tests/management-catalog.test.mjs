import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import https from 'node:https';
import http from 'node:http';
import tls from 'node:tls';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {createManagementGateway} from '../dev/management.mjs';
import {createModelCatalog} from '../dev/catalog.mjs';
import {createTlsIdentity} from '../dev/tls-identity.mjs';

const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const fixtureRoot=path.join(repository,'.cache','gateway-catalog-management-tests');
const certificate=createTlsIdentity();
const checkedAtMs=1791580800000;
const owner={hostId:'catalog-fixture-host-a',pluginId:'extension.lumi.gateway'};
const otherOwner={hostId:'catalog-fixture-host-b',pluginId:'extension.lumi.gateway'};
const routeSecrets=[
 {routeId:'primary',clientKey:'fixture-client-openai-0123456789',upstreamKey:'fixture-upstream-openai-9876543210'},
 {routeId:'secondary',clientKey:'fixture-client-anthropic-0123456789',upstreamKey:'fixture-upstream-anthropic-9876543210'},
];

async function listen(server){
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve();});});
 return server.address().port;
}
async function close(server){server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));}
async function unusedPort(){const server=net.createServer();const port=await listen(server);await close(server);return port;}
async function within(promise,message,timeoutMs=1200){
 let timer;
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),timeoutMs);})]);}
 finally{clearTimeout(timer);}
}
async function until(predicate,message){
 const deadline=Date.now()+2500;
 while(Date.now()<deadline){if(predicate())return;await delay(5);}
 assert.fail(message);
}
function fakeEngine(initial){
 let current=structuredClone(initial);
 const calls=[];
 return {calls,
  mutate(change){change(current);},
  async request(method,input){
   calls.push({method,input:structuredClone(input)});
   if(method==='config.get')return {config:structuredClone(current),configVersion:current.configVersion};
   if(method==='status')return {pending:0};
   if(method==='config.validate')return {valid:true};
   if(method==='config.replace'){
    if(input.expectedVersion!==current.configVersion)throw Object.assign(new Error('config-conflict'),{code:'config-conflict',status:409});
    current=structuredClone(input.config);return {configVersion:current.configVersion};
   }
   // Detection must never enter the private request/observation/recording paths.
   throw new Error('unexpected-engine-method-'+method);
  },
 };
}

/** Both peers use real TLS. Constructor hooks route only this fake public host to the local fixture. */
async function fixture({hold=false,disabled=false,singleRoute=false,bothEnabled=false}={}){
 await fs.mkdir(fixtureRoot,{recursive:true});
 const dataDir=await fs.mkdtemp(path.join(fixtureRoot,'peer-'));
 const requests=[],attempts=[];
 const recordingSentinel=Buffer.from('isolated recording fixture; never modified by catalog GETs');
 const config={schemaVersion:1,configVersion:1,listen:'127.0.0.1:0',routes:[
  {id:'primary',client:'codex',protocol:'openai',enabled:!disabled,upstream:'https://catalog.example/openai/v1',serviceTier:true},
  {id:'secondary',client:'claude-code',protocol:'anthropic',enabled:false,upstream:'https://catalog.example/anthropic',serviceTier:false},
 ],rules:[],recording:{bodies:true,retentionDays:7,maxRecords:10000,maxBytes:1024**3,captureBytes:1024**2},maxConcurrency:4,maxRequestBytes:2*1024*1024};
 if(singleRoute)config.routes=config.routes.slice(0,1);
 if(bothEnabled)for(const route of config.routes)route.enabled=true;
 await fs.writeFile(path.join(dataDir,'config.json'),JSON.stringify(config));
 await fs.writeFile(path.join(dataDir,'records.sqlite'),recordingSentinel);
 const engine=fakeEngine(config);
 const upstream=https.createServer({key:certificate.privateKeyPem,cert:certificate.certificatePem,minVersion:'TLSv1.2'},(req,res)=>{
  void (async()=>{
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const captured={method:req.method,path:req.url,headers:req.headers,body:Buffer.concat(chunks),closed:false,
    respond(value,status=200){const bytes=Buffer.from(JSON.stringify(value??(req.url.startsWith('/anthropic/')?
      {data:[{id:'claude-fixture',display_name:'Private metadata must stay upstream'}],has_more:false}:
      {data:[{id:'fixture-model-b',owned_by:'fixture'},{id:'fixture-model-a'},{id:'fixture-model-b'}]})));
     res.writeHead(status,{'content-type':'application/json','content-length':bytes.length});res.end(bytes);},
   };
   res.once('close',()=>{captured.closed=true;});requests.push(captured);
   if(!hold)captured.respond();
  })().catch(()=>res.destroy());
 });
 let management;
 try{
  const upstreamPort=await listen(upstream);
  const identity={instanceId:randomUUID(),alias:'isolated catalog TLS fixture',port:await unusedPort(),...certificate,token:randomBytes(32).toString('hex')};
  const catalog=createModelCatalog({now:()=>checkedAtMs,timeoutMs:3000,
   lookup(host,options,callback){assert.equal(host,'catalog.example');assert.deepEqual(options,{all:true,verbatim:true});callback(null,[{address:'8.8.8.8',family:4}]);},
   request(target,options,callback){
    attempts.push({url:target.href,method:options.method,headers:{...options.headers}});
    assert.equal(target.hostname,'catalog.example');assert.equal(options.rejectUnauthorized,true);assert.equal(options.agent,false);
    options.lookup(target.hostname,{},(error,address,family)=>{assert.ifError(error);assert.equal(address,'8.8.8.8');assert.equal(family,4);});
    const local=new URL(target);local.hostname='127.0.0.1';local.port=String(upstreamPort);
    return https.request(local,{...options,lookup:undefined,ca:certificate.certificatePem,servername:''},callback);
   },
  });
  let catalogCalls=0;
  const modelCatalog={detect(input){catalogCalls++;return catalog.detect(input);}};
  management=await createManagementGateway({dataDir,engine,identity,routeSecrets,allowFixtureUpstream:true,modelCatalog});
  let disposed=false;
  return {dataDir,management,identity,engine,requests,attempts,get catalogCalls(){return catalogCalls;},
   async assertRecordsUntouched(){assert.deepEqual(await fs.readFile(path.join(dataDir,'records.sqlite')),recordingSentinel);
    assert.ok(engine.calls.every(call=>['config.get','status','config.validate','config.replace'].includes(call.method)));
    assert.equal(management.metrics().recordingFailures,0);},
   async dispose(){if(disposed)return;disposed=true;await management.close();await close(upstream);
    const checkedRoot=await fs.realpath(fixtureRoot),checkedDir=await fs.realpath(dataDir);
    assert.equal(path.dirname(checkedDir),checkedRoot);await fs.rm(checkedDir,{recursive:true,force:true});},
  };
 }catch(error){await management?.close().catch(()=>{});await close(upstream).catch(()=>{});
  const checkedRoot=await fs.realpath(fixtureRoot),checkedDir=await fs.realpath(dataDir);
  assert.equal(path.dirname(checkedDir),checkedRoot);await fs.rm(checkedDir,{recursive:true,force:true});throw error;}
}

function startCall(item,method,input={},options={}){
 const body=Buffer.from(JSON.stringify({protocolVersion:1,instanceId:item.identity.instanceId,owner:options.owner??owner,input}));
 let req;
 const result=new Promise((resolve,reject)=>{
  req=https.request({host:'127.0.0.1',port:item.identity.port,path:'/management/v1/'+method,method:'POST',agent:false,
   ca:item.identity.certificatePem,servername:'',minVersion:'TLSv1.2',rejectUnauthorized:true,
   checkServerIdentity(host,peer){return tls.checkServerIdentity(host,peer)??
    (createHash('sha256').update(peer.raw).digest('hex')===item.identity.fingerprintSha256?undefined:new Error('fixture-certificate-pin-mismatch'));},
   headers:{host:'127.0.0.1:'+item.identity.port,authorization:'Bearer '+item.identity.token,
    'content-type':'application/json','content-length':body.length,...options.headers}},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.once('error',reject);res.once('end',()=>{
    try{resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks).toString('utf8'))});}catch(error){reject(error);}
   });
  });req.once('error',reject);req.end(body);
 });
 // Close/disconnect tests intentionally keep this request pending before awaiting it.
 void result.catch(()=>{});
 return {req,result};
}
async function success(item,method,input={},options={}){
 const value=await startCall(item,method,input,options).result;
 assert.equal(value.status,200,JSON.stringify(value.body));assert.equal(value.body.protocolVersion,1);assert.equal(value.body.instanceId,item.identity.instanceId);
 return value.body.result;
}
async function rejected(item,input,code,status,options={}){
 const value=await startCall(item,'routes.models.detect',input,options).result;
 assert.equal(value.status,status,JSON.stringify(value.body));assert.deepEqual(value.body,{error:{code}});
 return value;
}
function assertCatalogResult(value,routeId,models,configVersion=1){
 assert.deepEqual(value,{routeId,configVersion,checkedAtMs,source:'catalog',models:models.map(id=>({id})),truncated:false});
}

test('authenticated TLS detection uses only saved routes and credentials while stopped or disabled, without recording', {timeout:10000},async()=>{
 const item=await fixture({disabled:true});
 try{
  assert.equal((await success(item,'listener.status')).state,'stopped');
  const configBefore=await fs.readFile(path.join(item.dataDir,'config.json'));
  assertCatalogResult(await success(item,'routes.models.detect',{routeId:'primary',expectedVersion:1},{headers:{'x-api-key':('caller-auth-'+'must-not-forward'),'x-arbitrary-header':'caller-header'}}),
   'primary',['fixture-model-b','fixture-model-a']);
  assertCatalogResult(await success(item,'routes.models.detect',{routeId:'secondary',expectedVersion:1}),'secondary',['claude-fixture']);
  assert.equal(item.requests.length,2);assert.equal(item.catalogCalls,2);
  assert.deepEqual(item.attempts.map(value=>value.url),['https://catalog.example/openai/v1/models','https://catalog.example/anthropic/v1/models?limit=100']);
  for(const request of item.requests){assert.equal(request.method,'GET');assert.equal(request.body.length,0);assert.equal(request.headers['x-arbitrary-header'],undefined);
   assert.ok(!JSON.stringify(request.headers).includes(item.identity.token));assert.ok(!JSON.stringify(request.headers).includes(('caller-auth-'+'must-not-forward')));
   assert.ok(routeSecrets.every(secret=>!JSON.stringify(request.headers).includes(secret.clientKey)));}
  assert.equal(item.requests[0].headers.authorization,'Bearer '+routeSecrets[0].upstreamKey);assert.equal(item.requests[0].headers['x-api-key'],undefined);
  assert.equal(item.requests[1].headers.authorization,undefined);assert.equal(item.requests[1].headers['x-api-key'],routeSecrets[1].upstreamKey);
  assert.equal(item.requests[1].headers['anthropic-version'],'2023-06-01');
  assert.deepEqual(await fs.readFile(path.join(item.dataDir,'config.json')),configBefore);await item.assertRecordsUntouched();
 }finally{await item.dispose();}
});

test('malformed input, unknown route, version conflict and another listener owner reject before catalog invocation',{timeout:10000},async()=>{
 const item=await fixture();
 try{
  for(const input of [{routeId:'primary'},{routeId:'primary',expectedVersion:1,upstream:'https://caller.example'},
   {routeId:'primary',expectedVersion:1,headers:{authorization:'caller-key'}},{routeId:'../primary',expectedVersion:1},
   {routeId:'primary',expectedVersion:-1},{routeId:'primary',expectedVersion:1.5},{routeId:'primary',expectedVersion:'1'}]){
   await rejected(item,input,'invalid-input',400);
  }
  await rejected(item,{routeId:'missing',expectedVersion:1},'unknown-route',404);
  await rejected(item,{routeId:'primary',expectedVersion:0},'config-conflict',409);
  await rejected(item,{routeId:'primary',expectedVersion:2},'config-conflict',409);
  assert.equal((await success(item,'listener.start')).state,'listening');
  await rejected(item,{routeId:'primary',expectedVersion:1},'listener-owned-by-another-host',403,{owner:otherOwner});
  assert.equal(item.catalogCalls,0);assert.equal(item.requests.length,0);
  assertCatalogResult(await success(item,'routes.models.detect',{routeId:'primary',expectedVersion:1}),'primary',['fixture-model-b','fixture-model-a']);
  await success(item,'listener.stop',{mode:'cancel'});await item.assertRecordsUntouched();
 }finally{await item.dispose();}
});

test('TLS management returns at most 500 catalog IDs and finite errors without upstream bodies or reflected credentials',{timeout:10000},async()=>{
 const item=await fixture({hold:true});
 try{
  const bounded=startCall(item,'routes.models.detect',{routeId:'primary',expectedVersion:1});
  await until(()=>item.requests.length===1,'catalog GET did not reach TLS upstream');
  item.requests[0].respond({data:Array.from({length:501},(_,index)=>({id:'fixture-model-'+index,untrustedMetadata:'ignored'}))});
  const result=await bounded.result;assert.equal(result.status,200);assert.equal(result.body.result.models.length,500);assert.equal(result.body.result.truncated,true);
  assert.deepEqual(result.body.result.models[499],{id:'fixture-model-499'});assert.ok(Buffer.byteLength(JSON.stringify(result.body))<128*1024);
  const authFailure=startCall(item,'routes.models.detect',{routeId:'primary',expectedVersion:1});
  await until(()=>item.requests.length===2,'second catalog GET did not reach TLS upstream');
  item.requests[1].respond({error:{message:'private-upstream-body-'+routeSecrets[0].upstreamKey}},401);
  assert.deepEqual((await authFailure.result).body,{error:{code:'models-auth-failed'}});
  const reflected=startCall(item,'routes.models.detect',{routeId:'primary',expectedVersion:1});
  await until(()=>item.requests.length===3,'third catalog GET did not reach TLS upstream');
  item.requests[2].respond({data:[{id:'reflected-'+item.identity.token}]});
  assert.deepEqual((await reflected.result).body,{error:{code:'models-credentials-reflected'}});await item.assertRecordsUntouched();
 }finally{await item.dispose();}
});

test('held catalog I/O allows listener stop and configuration update, then rejects its stale result',{timeout:10000},async()=>{
 const item=await fixture({hold:true});
 try{
  await success(item,'listener.start');
  const pending=startCall(item,'routes.models.detect',{routeId:'primary',expectedVersion:1});
  await until(()=>item.requests.length===1,'catalog GET did not reach TLS upstream');
  const stopped=await within(success(item,'listener.stop',{mode:'cancel'}),'catalog network work blocked listener stop');assert.equal(stopped.state,'stopped');
  const routes=await within(success(item,'routes.config.get'),'catalog network work blocked route reads');
  const updated=await within(success(item,'routes.config.set',{expectedVersion:1,routes:routes.routes.map(route=>({...route,enabled:false}))}),
   'catalog network work blocked configuration replacement');assert.equal(updated.configVersion,2);
  item.requests[0].respond();
  const result=await within(pending.result,'stale catalog request did not settle');assert.equal(result.status,409);assert.deepEqual(result.body,{error:{code:'config-conflict'}});
  await item.assertRecordsUntouched();
 }finally{await item.dispose();}
});

test('final freshness guard rejects a changed saved route even if its version is unexpectedly unchanged',{timeout:10000},async()=>{
 const item=await fixture({hold:true});
 try{
  const pending=startCall(item,'routes.models.detect',{routeId:'primary',expectedVersion:1});
  await until(()=>item.requests.length===1,'catalog GET did not reach TLS upstream');
  item.engine.mutate(config=>{config.routes[0].upstream='https://different.example/v1';});
  item.requests[0].respond();
  const result=await pending.result;assert.equal(result.status,409);assert.deepEqual(result.body,{error:{code:'config-conflict'}});
  assert.equal(item.attempts.length,1);await item.assertRecordsUntouched();
 }finally{await item.dispose();}
});

test('two held detections reserve bounded slots and a third is busy; completed slots are reusable',{timeout:10000},async()=>{
 const item=await fixture({hold:true});
 try{
  const first=startCall(item,'routes.models.detect',{routeId:'primary',expectedVersion:1});
  const second=startCall(item,'routes.models.detect',{routeId:'secondary',expectedVersion:1});
  await until(()=>item.requests.length===2,'both catalog GETs did not reach TLS upstream');
  await rejected(item,{routeId:'primary',expectedVersion:1},'models-busy',429);assert.equal(item.catalogCalls,2);assert.equal(item.attempts.length,2);
  for(const request of item.requests)request.respond();
  assert.equal((await first.result).status,200);assert.equal((await second.result).status,200);
  const replacement=startCall(item,'routes.models.detect',{routeId:'primary',expectedVersion:1});
  await until(()=>item.requests.length===3,'completed catalog slot was not reusable');item.requests[2].respond();
  assertCatalogResult((await replacement.result).body.result,'primary',['fixture-model-b','fixture-model-a']);await item.assertRecordsUntouched();
 }finally{await item.dispose();}
});

test('HTTP peer disconnect aborts its upstream catalog request and frees the detection slot',{timeout:10000},async()=>{
 const item=await fixture({hold:true});
 try{
  const first=startCall(item,'routes.models.detect',{routeId:'primary',expectedVersion:1});
  const second=startCall(item,'routes.models.detect',{routeId:'secondary',expectedVersion:1});
  await until(()=>item.requests.length===2,'catalog GETs did not reach TLS upstream');
  first.req.destroy(new Error('fixture-peer-disconnected'));await assert.rejects(first.result,/fixture-peer-disconnected/);
  await until(()=>item.requests.some(request=>request.path.startsWith('/openai/')&&request.closed),'disconnect did not abort upstream catalog GET');
  const replacement=startCall(item,'routes.models.detect',{routeId:'primary',expectedVersion:1});
  await until(()=>item.requests.length===3,'disconnected catalog slot was not released');item.requests[2].respond();assert.equal((await replacement.result).status,200);
  item.requests.find(request=>request.path.startsWith('/anthropic/')).respond();assert.equal((await second.result).status,200);await item.assertRecordsUntouched();
 }finally{await item.dispose();}
});

test('host prepareConfiguration aborts held catalog work without waiting for a response',{timeout:10000},async()=>{
 const item=await fixture({hold:true});
 try{
  const pending=startCall(item,'routes.models.detect',{routeId:'primary',expectedVersion:1});
  await until(()=>item.requests.length===1,'catalog GET did not reach TLS upstream');
  const current=await within(item.management.prepareConfiguration(1),'catalog I/O blocked the host configuration barrier');assert.equal(current.configVersion,1);
  await until(()=>item.requests[0].closed,'configuration barrier did not abort upstream catalog GET');
  const result=await within(pending.result,'cancelled management request did not settle');assert.deepEqual(result.body,{error:{code:'models-cancelled'}});
  await item.assertRecordsUntouched();
 }finally{await item.dispose();}
});

test('management close aborts both held upstream catalog requests promptly',{timeout:10000},async()=>{
 const item=await fixture({hold:true});
 try{
  const first=startCall(item,'routes.models.detect',{routeId:'primary',expectedVersion:1});
  const second=startCall(item,'routes.models.detect',{routeId:'secondary',expectedVersion:1});
  await until(()=>item.requests.length===2,'catalog GETs did not reach TLS upstream');
  await within(item.management.close(),'management close waited for held catalog I/O');
  await until(()=>item.requests.every(request=>request.closed),'management close left catalog GETs open');
  const results=await Promise.allSettled([first.result,second.result]);
  for(const result of results)if(result.status==='fulfilled')assert.deepEqual(result.value.body,{error:{code:'models-cancelled'}});
  await item.assertRecordsUntouched();
 }finally{await item.dispose();}
});

function dataCall(address,path='/primary/v1/models',headers={}){
 let req;
 const result=new Promise((resolve,reject)=>{
  const requestHeaders={authorization:'Bearer '+routeSecrets[0].clientKey,...headers};
  for(const key of Object.keys(requestHeaders))if(requestHeaders[key]===undefined)delete requestHeaders[key];
  req=http.request('http://'+address,{method:'GET',path,agent:false,headers:requestHeaders},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.once('error',reject);res.once('aborted',()=>reject(new Error('fixture-data-response-aborted')));
   res.once('end',()=>{try{resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(Buffer.concat(chunks).toString('utf8'))});}catch(error){reject(error);}});
  });req.once('error',reject);req.end();
 });void result.catch(()=>{});return {req,result};
}

test('management-started data listener reuses strict TLS catalog for prefixed and single-route bare GET without recording',{timeout:10000},async()=>{
 const item=await fixture({singleRoute:true});
 try{
  const listening=await success(item,'listener.start');assert.equal(listening.state,'listening');
  for(const pathname of ['/primary/v1/models','/v1/models']){
   const value=await dataCall(listening.address,pathname,{'x-arbitrary-header':'caller-data-header',cookie:'caller-cookie'}).result;
   assert.equal(value.status,200);assert.deepEqual(value.body,{object:'list',data:[{id:'fixture-model-b',object:'model'},{id:'fixture-model-a',object:'model'}],lumi_truncated:false});
   assert.equal(value.headers['x-lumi-models-truncated'],'false');assert.ok(value.body.data.every(model=>Object.keys(model).sort().join(',')==='id,object'));
  }
  assert.equal(item.catalogCalls,2);assert.equal(item.requests.length,2);
  for(const received of item.requests){assert.equal(received.method,'GET');assert.equal(received.path,'/openai/v1/models');assert.equal(received.body.length,0);
   assert.equal(received.headers.authorization,'Bearer '+routeSecrets[0].upstreamKey);assert.equal(received.headers.cookie,undefined);assert.equal(received.headers['x-arbitrary-header'],undefined);assert.equal(received.headers['x-api-key'],undefined);
   assert.ok(!JSON.stringify(received.headers).includes(routeSecrets[0].clientKey)&&!JSON.stringify(received.headers).includes(item.identity.token));}
  assert.equal((await success(item,'listener.status')).activeRequests,0);await item.assertRecordsUntouched();
 }finally{await item.dispose();}
});

test('data catalog authentication follows both route protocols and bare GET does not guess among saved routes',{timeout:10000},async()=>{
 const item=await fixture({bothEnabled:true});
 try{
  const listening=await success(item,'listener.start');
  assert.equal((await dataCall(listening.address,'/v1/models').result).status,404);
  for(const headers of [{authorization:'Bearer wrong'},{authorization:undefined,'x-api-key':routeSecrets[0].clientKey},{'x-api-key':routeSecrets[1].clientKey}])assert.equal((await dataCall(listening.address,'/primary/v1/models',headers).result).status,401);
  assert.equal(item.catalogCalls,0);assert.equal(item.requests.length,0);
  const primary=await dataCall(listening.address).result;assert.equal(primary.status,200);
  const secondary=await dataCall(listening.address,'/secondary/v1/models',{authorization:undefined,'x-api-key':routeSecrets[1].clientKey,'anthropic-version':'caller-untrusted-version','x-arbitrary-header':'caller-data-header'}).result;
  assert.equal(secondary.status,200);assert.deepEqual(secondary.body.data,[{id:'claude-fixture',object:'model'}]);
  assert.equal(item.requests[1].method,'GET');assert.equal(item.requests[1].path,'/anthropic/v1/models?limit=100');assert.equal(item.requests[1].headers['x-api-key'],routeSecrets[1].upstreamKey);assert.equal(item.requests[1].headers.authorization,undefined);assert.equal(item.requests[1].headers['anthropic-version'],'2023-06-01');assert.equal(item.requests[1].headers['x-arbitrary-header'],undefined);
  await item.assertRecordsUntouched();
 }finally{await item.dispose();}
 const disabledAlternative=await fixture();
 try{const listening=await success(disabledAlternative,'listener.start');assert.equal((await dataCall(listening.address,'/v1/models').result).status,404);assert.equal(disabledAlternative.catalogCalls,0);await disabledAlternative.assertRecordsUntouched();}
 finally{await disabledAlternative.dispose();}
});

test('matching dual client headers read real TLS catalogs for both protocols without forwarding either client credential',{timeout:10000},async()=>{
 const item=await fixture({bothEnabled:true});
 try{
  const listening=await success(item,'listener.start');
  for(const secret of routeSecrets){
   const value=await dataCall(listening.address,'/'+secret.routeId+'/v1/models',{authorization:'Bearer '+secret.clientKey,'x-api-key':secret.clientKey}).result;
   assert.equal(value.status,200);assert.ok(value.body.data.length>0);
  }
  assert.equal(item.catalogCalls,2);assert.equal(item.requests.length,2);
  for(let index=0;index<item.requests.length;index++){
   const request=item.requests[index],secret=routeSecrets[index];assert.equal(request.method,'GET');assert.equal(request.body.length,0);
   assert.equal(request.headers.authorization,index===0?'Bearer '+secret.upstreamKey:undefined);
   assert.equal(request.headers['x-api-key'],index===1?secret.upstreamKey:undefined);
   assert.ok(routeSecrets.every(value=>!JSON.stringify(request.headers).includes(value.clientKey)));
   assert.ok(!JSON.stringify(request.headers).includes(item.identity.token));
  }
  await item.assertRecordsUntouched();
 }finally{await item.dispose();}
});

test('management status counts data catalog reads and normal drain preserves their successful response',{timeout:10000},async()=>{
 const item=await fixture({hold:true,singleRoute:true});
 try{
  const listening=await success(item,'listener.start');const pending=dataCall(listening.address);
  await until(()=>item.requests.length===1,'data GET did not reach TLS catalog');
  const status=await success(item,'listener.status');assert.equal(status.activeRequests,1);assert.equal((await item.engine.request('status')).pending,0);
  let stopped=false;const stopping=success(item,'listener.stop',{mode:'drain'}).then(value=>{stopped=true;return value;});await delay(30);assert.equal(stopped,false);
  item.requests[0].respond();assert.equal((await pending.result).status,200);assert.equal((await within(stopping,'drain did not finish after catalog response')).state,'stopped');await item.assertRecordsUntouched();
 }finally{await item.dispose();}
});

test('management cancel stops the actual data catalog TLS socket without recording or retries',{timeout:10000},async()=>{
 const item=await fixture({hold:true,singleRoute:true});
 try{
  const listening=await success(item,'listener.start');const pending=dataCall(listening.address);await until(()=>item.requests.length===1,'data GET did not reach TLS catalog');
  assert.equal((await success(item,'listener.stop',{mode:'cancel'})).state,'stopped');const terminal=await pending.result.catch(()=>null);assert.ok(terminal===null||terminal.status===499);
  await until(()=>item.requests[0].closed,'data stop did not close TLS catalog socket');assert.equal(item.requests.length,1);await item.assertRecordsUntouched();
 }finally{await item.dispose();}
});

test('configuration freshness rejects a held data catalog after a rules update',{timeout:10000},async()=>{
 const item=await fixture({hold:true,singleRoute:true});
 try{
  const listening=await success(item,'listener.start');const pending=dataCall(listening.address);await until(()=>item.requests.length===1,'data GET did not reach TLS catalog');
  assert.equal((await success(item,'rules.replace',{expectedVersion:1,rules:[]})).policyVersion,2);item.requests[0].respond();
  const rejected=await pending.result;assert.equal(rejected.status,409);assert.deepEqual(rejected.body,{error:{code:'models-route-changed'}});await item.assertRecordsUntouched();
 }finally{await item.dispose();}
});

test('data catalog returns bounded partial lists and finite errors without private management or route credentials',{timeout:10000},async()=>{
 const item=await fixture({hold:true,singleRoute:true});
 try{
  const listening=await success(item,'listener.start');const partial=dataCall(listening.address);await until(()=>item.requests.length===1,'data GET did not reach TLS catalog');
  item.requests[0].respond({data:Array.from({length:501},(_,index)=>({id:'fixture-model-'+index,owned_by:'upstream-only'}))});
  const result=await partial.result;assert.equal(result.status,200);assert.equal(result.body.data.length,500);assert.equal(result.body.lumi_truncated,true);assert.equal(result.headers['x-lumi-models-truncated'],'true');assert.ok(Buffer.byteLength(JSON.stringify(result.body))<=128*1024);
  const auth=dataCall(listening.address);await until(()=>item.requests.length===2,'data auth GET did not reach TLS catalog');item.requests[1].respond({error:{message:'private-'+routeSecrets[0].upstreamKey}},401);
  assert.deepEqual((await auth.result).body,{error:{code:'models-auth-failed'}});
  const reflected=dataCall(listening.address);await until(()=>item.requests.length===3,'data reflected GET did not reach TLS catalog');item.requests[2].respond({data:[{id:'private-'+item.identity.token}]});
  const rejected=await reflected.result;assert.equal(rejected.status,502);assert.deepEqual(rejected.body,{error:{code:'models-credentials-reflected'}});
  assert.ok(!JSON.stringify(rejected).includes(item.identity.token)&&routeSecrets.every(secret=>!JSON.stringify(rejected).includes(secret.clientKey)&&!JSON.stringify(rejected).includes(secret.upstreamKey)));await item.assertRecordsUntouched();
 }finally{await item.dispose();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {createGateway} from '../dev/transport.mjs';

const clientKey='fixture-data-client-0123456789';
const upstreamKey='fixture-data-upstream-9876543210';
const otherClient='fixture-other-client-0123456789';
const otherUpstream='fixture-other-upstream-9876543210';
const row=id=>({id});
function result(input,models=[row('fixture-model')],truncated=false){return {routeId:input.route.id,configVersion:input.configVersion,checkedAtMs:1,source:'catalog',models,truncated};}
function heldCatalog(){
 const calls=[];
 return {calls,service:{detect(input){return new Promise((resolve,reject)=>{
  const abort=()=>reject(Object.assign(new Error('models-cancelled'),{code:'models-cancelled'}));
  input.signal.addEventListener('abort',abort,{once:true});
  if(input.signal.aborted){abort();return;}
  calls.push({input,resolve(models,truncated){input.signal.removeEventListener('abort',abort);resolve(result(input,models,truncated));},reject(code){input.signal.removeEventListener('abort',abort);reject(Object.assign(new Error('private-upstream-message-'+upstreamKey),{code}));}});
 });}}};
}
async function fixture(t,options={}){
 const calls=[],engine={async request(method,input){calls.push({method,input});throw new Error('unexpected-engine-call-'+method);}};
 const config={schemaVersion:1,configVersion:1,listen:'127.0.0.1:0',maxRequestBytes:1048576,maxConcurrency:2,rules:[],recording:{bodies:true},
  routes:[{id:'primary',client:'codex',protocol:'openai',enabled:true,serviceTier:true,upstream:'https://catalog.example/v1'}],...options.config};
 const catalog=options.catalog??{async detect(input){options.detectCalls?.push(input);await input.assertFresh();return result(input,options.models,options.truncated);}};
 const gateway=await createGateway({config,routeSecrets:options.secrets??[{routeId:'primary',clientKey,upstreamKey}],engine,modelCatalog:catalog,
  drainTimeoutMs:options.drainTimeoutMs??100,catalogPrivateValues:options.privateValues??[],allowBareModelsAlias:options.allowBareModelsAlias});
 t.after(()=>gateway.stop({mode:'cancel'}));return {gateway,config,calls};
}
function start(gateway,options={}){
 let req;
 const pending=new Promise((resolve,reject)=>{
  const headers={authorization:'Bearer '+clientKey,...options.headers};
  for(const key of Object.keys(headers))if(headers[key]===undefined)delete headers[key];
  req=http.request('http://'+gateway.address,{path:options.path??'/primary/v1/models',method:options.method??'GET',agent:false,headers},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.once('error',reject);res.once('aborted',()=>reject(new Error('client-response-aborted')));
   res.once('end',()=>resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
  });req.once('error',reject);req.end(options.body);
 });void pending.catch(()=>{});return {req,pending};
}
async function until(predicate,message){const end=Date.now()+1500;while(!predicate()){assert.ok(Date.now()<end,message);await delay(5);}}
async function raw(gateway,headers){
 const socket=net.connect(Number(gateway.address.split(':').at(-1)),'127.0.0.1');await once(socket,'connect');const chunks=[];
 socket.on('data',chunk=>chunks.push(chunk));socket.write('GET /primary/v1/models HTTP/1.1\r\nHost: '+gateway.address+'\r\n'+headers+'Connection: close\r\n\r\n');await once(socket,'end');socket.destroy();return Buffer.concat(chunks).toString('utf8');
}

test('prefixed and single-route bare model GET return a bounded OpenAI list without inference or recording',async t=>{
 const detectCalls=[];const {gateway,calls}=await fixture(t,{detectCalls});
 for(const path of ['/primary/v1/models','/v1/models']){
  const value=await start(gateway,{path,headers:{cookie:'must-not-forward','x-arbitrary-header':'must-not-forward'}}).pending;
  assert.equal(value.status,200);assert.deepEqual(value.body,{object:'list',data:[{id:'fixture-model',object:'model'}],lumi_truncated:false});
  assert.equal(value.headers['x-lumi-models-truncated'],'false');assert.equal(value.headers['cache-control'],'no-store');
  assert.equal(value.body.data[0].created,undefined);assert.equal(value.body.data[0].owned_by,undefined);
 }
 assert.equal(detectCalls.length,2);assert.equal(detectCalls[0].upstreamKey,upstreamKey);assert.ok(detectCalls[0].privateValues.includes(clientKey));
 assert.deepEqual(calls,[]);assert.equal(gateway.metrics.recordingFailures,0);assert.equal(gateway.activeRequests(),0);
});

test('bare GET never guesses between saved routes and disabled routes cannot be read',async t=>{
 const primary={id:'primary',client:'codex',protocol:'openai',enabled:true,upstream:'https://catalog.example/v1'};
 const secondary={id:'secondary',client:'claude',protocol:'anthropic',enabled:false,upstream:'https://catalog.example/anthropic'};
 const detectCalls=[];const {gateway}=await fixture(t,{detectCalls,config:{routes:[primary,secondary]},secrets:[{routeId:'primary',clientKey,upstreamKey},{routeId:'secondary',clientKey:otherClient,upstreamKey:otherUpstream}]});
 assert.equal((await start(gateway,{path:'/v1/models'}).pending).status,404);
 assert.equal((await start(gateway,{path:'/secondary/v1/models',headers:{authorization:undefined,'x-api-key':otherClient}}).pending).status,404);
 assert.equal((await start(gateway,{path:'/primary/v1/models'}).pending).status,200);assert.equal(detectCalls.length,1);
 const onlyEnabled=await fixture(t,{config:{routes:[primary]},allowBareModelsAlias:false});
 assert.equal((await start(onlyEnabled.gateway,{path:'/v1/models'}).pending).status,404);
});

test('existing protocol authentication rejects wrong, duplicate and conflicting credentials before catalog invocation',async t=>{
 const detectCalls=[];const {gateway}=await fixture(t,{detectCalls});
 for(const headers of [{authorization:'Bearer wrong'},{authorization:undefined,'x-api-key':clientKey},{'x-api-key':otherClient}])assert.equal((await start(gateway,{headers}).pending).status,401);
 for(const headers of ['Authorization: Bearer '+clientKey+'\r\nAuthorization: Bearer '+clientKey+'\r\n','X-api-key: '+clientKey+'\r\nX-api-key: '+clientKey+'\r\n'])assert.ok((await raw(gateway,headers)).startsWith('HTTP/1.1 401 '));
 assert.equal(detectCalls.length,0);
 const anthropic=await fixture(t,{detectCalls,config:{routes:[{id:'primary',client:'claude',protocol:'anthropic',enabled:true,upstream:'https://catalog.example/anthropic'}]}});
 assert.equal((await start(anthropic.gateway,{headers:{authorization:undefined,'x-api-key':clientKey}}).pending).status,200);
 assert.equal((await start(anthropic.gateway).pending).status,200);assert.equal(detectCalls.length,2);
});

test('model GET accepts matching dual headers for both protocols while rejecting wrong, malformed and duplicated pairs',async t=>{
 for(const protocol of ['openai','anthropic']){
  const detectCalls=[];const {gateway,calls}=await fixture(t,{detectCalls,config:{routes:[{id:'primary',client:protocol==='openai'?'codex':'claude',protocol,enabled:true,upstream:'https://catalog.example/v1'}]}});
  for(const headers of [
   {authorization:'Bearer wrong','x-api-key':'wrong'},
   {authorization:'Bearer wrong','x-api-key':clientKey},
   {'x-api-key':otherClient},{'x-api-key':''},
   {authorization:'','x-api-key':clientKey},{authorization:'Bearer ','x-api-key':clientKey},
   {authorization:'bearer '+clientKey,'x-api-key':clientKey},{authorization:'Basic '+clientKey,'x-api-key':clientKey},
   {authorization:'Bearer  '+clientKey,'x-api-key':clientKey},
  ])assert.equal((await start(gateway,{headers}).pending).status,401);
  const authorization='Authorization: Bearer '+clientKey+'\r\n',apiKey='X-api-key: '+clientKey+'\r\n';
  for(const headers of [authorization.repeat(2)+apiKey,authorization+apiKey.repeat(2)])assert.ok((await raw(gateway,headers)).startsWith('HTTP/1.1 401 '));
  assert.equal(detectCalls.length,0);assert.deepEqual(calls,[]);
  for(const path of ['/primary/v1/models','/v1/models']){
   const value=await start(gateway,{path,headers:{'x-api-key':clientKey}}).pending;
   assert.equal(value.status,200);assert.deepEqual(value.body.data,[{id:'fixture-model',object:'model'}]);
  }
  assert.equal(detectCalls.length,2);assert.ok(detectCalls.every(call=>call.upstreamKey===upstreamKey));assert.deepEqual(calls,[]);
 }
});

test('model GET keeps Host, Origin, method, exact path and zero-body restrictions',async t=>{
 const detectCalls=[];const {gateway,calls}=await fixture(t,{detectCalls});
 for(const option of [{path:'/primary/v1/models?after_id=caller'},{path:'/primary/v1/models/'},{path:'/missing/v1/models'},{path:'//primary/v1/models'},
  {headers:{host:'attacker.invalid'}},{headers:{origin:'https://attacker.invalid'}},{method:'POST'},{method:'HEAD'},
  {body:'x',headers:{'content-length':'1'}},{headers:{'transfer-encoding':'chunked'}}]){
  // HEAD suppresses the JSON response body by HTTP definition.
  if(option.method==='HEAD'){const value=await new Promise(resolve=>{const req=http.request('http://'+gateway.address+'/primary/v1/models',{method:'HEAD',headers:{authorization:'Bearer '+clientKey}},res=>{res.resume();res.once('end',()=>resolve(res.statusCode));});req.end();});assert.equal(value,405);continue;}
  const value=await start(gateway,option).pending;assert.ok(value.status>=400,JSON.stringify(option));
 }
 assert.deepEqual(calls,[]);assert.equal(detectCalls.length,0);
});

test('catalog occupies the shared request limit before inference preparation',async t=>{
 const held=heldCatalog();const {gateway,calls}=await fixture(t,{catalog:held.service,config:{maxConcurrency:1}});
 const first=start(gateway);await until(()=>held.calls.length===1,'catalog did not enter active request set');assert.equal(gateway.activeRequests(),1);
 assert.equal((await start(gateway).pending).status,429);
 assert.equal((await start(gateway,{method:'POST',path:'/primary/v1/responses',body:'{}',headers:{'content-length':'2','content-type':'application/json'}}).pending).status,429);
 held.calls[0].resolve();assert.equal((await first.pending).status,200);assert.deepEqual(calls,[]);
});

test('catalog IDs remain text, reject private values and omit arbitrary upstream metadata',async t=>{
 const safe=await fixture(t,{models:[{id:'<img src="https://must-not-load.invalid" onerror="alert(1)">',owned_by:upstreamKey,created:1}]});
 const value=await start(safe.gateway).pending;assert.equal(value.status,200);assert.deepEqual(Object.keys(value.body.data[0]).sort(),['id','object']);assert.ok(!JSON.stringify(value.body).includes(upstreamKey));
 const privateToken='fixture-private-management-token-123456';
 for(const id of [upstreamKey,clientKey,privateToken]){const item=await fixture(t,{privateValues:[privateToken],models:[row('reflected-'+id)]});const rejected=await start(item.gateway).pending;assert.equal(rejected.status,502);assert.deepEqual(rejected.body,{error:{code:'models-credentials-reflected'}});assert.ok(!JSON.stringify(rejected).includes(id));}
});

test('client response remains at most 128 KiB with an explicit truncation marker',async t=>{
 const models=Array.from({length:500},(_,index)=>row('catalog-'+index+'-'+ 'x'.repeat(240)));
 const {gateway,calls}=await fixture(t,{models});const value=await start(gateway).pending;
 assert.equal(value.status,200);assert.equal(value.body.lumi_truncated,true);assert.equal(value.headers['x-lumi-models-truncated'],'true');
 assert.ok(value.body.data.length>0&&value.body.data.length<500);assert.ok(Buffer.byteLength(JSON.stringify(value.body))<=128*1024);assert.deepEqual(calls,[]);
 const upstreamPartial=await fixture(t,{truncated:true});assert.equal((await start(upstreamPartial.gateway).pending).body.lumi_truncated,true);
});

test('catalog errors expose only finite codes and never upstream error text',async t=>{
 const held=heldCatalog();const {gateway,calls}=await fixture(t,{catalog:held.service});
 for(const [code,status,output] of [['models-auth-failed',502,'models-auth-failed'],['models-endpoint-unavailable',404,'models-endpoint-unavailable'],['models-timeout',504,'models-timeout'],['unknown-'+upstreamKey,502,'models-unavailable']]){
  const value=start(gateway);await until(()=>held.calls.length>0,'catalog not invoked');held.calls.shift().reject(code);
  const rejected=await value.pending;assert.equal(rejected.status,status);assert.deepEqual(rejected.body,{error:{code:output}});assert.ok(!JSON.stringify(rejected).includes(upstreamKey));
 }
 assert.deepEqual(calls,[]);assert.equal(gateway.metrics.recordingFailures,0);
});

test('configuration replacement withdraws a late catalog while preserving subsequent requests',async t=>{
 const held=heldCatalog();const {gateway,config,calls}=await fixture(t,{catalog:held.service});const value=start(gateway);await until(()=>held.calls.length===1,'catalog not invoked');
 gateway.updateConfig({...config,configVersion:2,rules:[]});held.calls[0].resolve();const rejected=await value.pending;
 assert.equal(rejected.status,409);assert.deepEqual(rejected.body,{error:{code:'models-route-changed'}});assert.deepEqual(calls,[]);
});

test('normal drain waits for an admitted catalog and returns its successful list',async t=>{
 const held=heldCatalog();const {gateway,calls}=await fixture(t,{catalog:held.service,drainTimeoutMs:500});const value=start(gateway);await until(()=>held.calls.length===1,'catalog not invoked');
 let stopped=false;const stopping=gateway.stop({mode:'drain'}).then(()=>{stopped=true;});await delay(25);assert.equal(stopped,false);assert.equal(held.calls[0].input.signal.aborted,false);
 held.calls[0].resolve();assert.equal((await value.pending).status,200);await stopping;assert.equal(stopped,true);assert.deepEqual(calls,[]);assert.equal(gateway.metrics.recordingFailures,0);
});

test('cancel stop and drain timeout abort catalogs and never count them as recording failures',async t=>{
 for(const mode of ['cancel','drain']){
  const held=heldCatalog();const {gateway,calls}=await fixture(t,{catalog:held.service,drainTimeoutMs:25});const value=start(gateway);await until(()=>held.calls.length===1,'catalog not invoked');
  await gateway.stop({mode});await until(()=>held.calls[0].input.signal.aborted,'stop did not cancel catalog network');
  const terminal=await value.pending.catch(()=>null);assert.ok(terminal===null||terminal.status===499);assert.equal(gateway.activeRequests(),0);assert.equal(gateway.metrics.recordingFailures,0);assert.deepEqual(calls,[]);
 }
});

test('client disconnect aborts catalog work and prevents late response or inference calls',async t=>{
 const held=heldCatalog();const {gateway,calls}=await fixture(t,{catalog:held.service});const value=start(gateway);await until(()=>held.calls.length===1,'catalog not invoked');value.req.destroy();await value.pending.catch(()=>{});
 await until(()=>held.calls[0].input.signal.aborted&&gateway.activeRequests()===0,'client disconnect did not release catalog');assert.deepEqual(calls,[]);assert.equal(gateway.metrics.recordingFailures,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {setTimeout as delay} from 'node:timers/promises';
import {createModelCatalog} from '../dev/catalog.mjs';

const UPSTREAM_KEY='fixture-upstream-key-0123456789';
const CLIENT_KEY='fixture-client-key-9876543210';
const MANAGEMENT_TOKEN='fixture-management-token-0246813579';
const public4={address:'8.8.8.8',family:4};
const public6={address:'2606:4700:4700::1111',family:6};
const route={id:'primary',protocol:'openai',upstream:'https://API.example/prefix/v1/'};
const context={route,upstreamKey:UPSTREAM_KEY,configVersion:7,assertFresh:async()=>true,privateValues:[CLIENT_KEY,MANAGEMENT_TOKEN]};
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
function catalogFixture(t,replies=[],options={}){
 const calls=[],dnsCalls=[],timers=[];
 const lookup=options.lookup??((host,input,callback)=>{dnsCalls.push({host,input});callback(null,[public4,public6]);});
 const request=(target,requestOptions,onResponse)=>{
  const reply=replies[calls.length]??{json:{data:[]}};
  const item={target:new URL(target),options:requestOptions,endCount:0,destroyCount:0};calls.push(item);
  const outgoing=new EventEmitter();item.request=outgoing;
  outgoing.destroy=()=>{item.destroyCount++;item.response?.destroy();};
  outgoing.end=()=>{
   item.endCount++;
   const run=()=>{
    if(reply.error){outgoing.emit('error',new Error(reply.error));return;}
    const incoming=new PassThrough();incoming.statusCode=reply.status??200;incoming.headers=reply.headers??{'content-type':'application/json'};item.response=incoming;
    // Test fixtures never perform a real DNS or TLS connection. The callback
    // shape still exercises the production response parser and cancellation.
    onResponse(incoming);
    if(incoming.destroyed||reply.stall)return;
    if(reply.interrupted){incoming.emit('aborted');return;}
    if(reply.chunks){for(const chunk of reply.chunks)incoming.write(chunk);incoming.end();}
    else incoming.end(reply.body??Buffer.from(JSON.stringify(reply.json??{data:[]})));
   };
   if(reply.delayMs)timers.push(setTimeout(run,reply.delayMs));else queueMicrotask(run);
  };
  return outgoing;
 };
 t.after(()=>{for(const timer of timers)clearTimeout(timer);for(const item of calls)item.response?.destroy();});
 const catalog=createModelCatalog({lookup,request,now:()=>123456,...(options.timeoutMs?{timeoutMs:options.timeoutMs}:{})});
 return {catalog,calls,dnsCalls,detect:input=>catalog.detect({...context,...input})};
}
async function rejectsSafe(promise,code){await assert.rejects(promise,error=>{
 assert.ok(error instanceof Error);assert.equal(error.code,code);assert.equal(error.message,code);
 for(const value of [UPSTREAM_KEY,CLIENT_KEY,MANAGEMENT_TOKEN])assert.equal(error.message.includes(value),false);
 return true;
});}

test('OpenAI detection uses saved route path and upstream authentication, returns bounded model IDs only',async t=>{
 const f=catalogFixture(t,[{json:{object:'list',data:[{id:'gpt-fixture',owned_by:UPSTREAM_KEY,display_name:CLIENT_KEY},{id:'gpt-second'},{id:'gpt-fixture'}],unknown:MANAGEMENT_TOKEN}}]);
 const result=await f.detect();assert.deepEqual(result,{routeId:'primary',configVersion:7,checkedAtMs:123456,source:'catalog',models:[{id:'gpt-fixture'},{id:'gpt-second'}],truncated:false});
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].target.href,'https://api.example/prefix/v1/models');assert.equal(f.calls[0].options.method,'GET');
 assert.deepEqual(f.calls[0].options.headers,{accept:'application/json','accept-encoding':'identity',authorization:'Bearer '+UPSTREAM_KEY});
 assert.equal(f.calls[0].options.agent,false);assert.equal(f.calls[0].options.rejectUnauthorized,true);assert.equal(f.calls[0].options.minVersion,'TLSv1.2');
 assert.equal(JSON.stringify(result).includes(UPSTREAM_KEY),false);assert.equal(JSON.stringify(f.calls[0].options.headers).includes(CLIENT_KEY),false);
});

test('catalog endpoint reuses the gateway base-path joining rule without duplicating v1',async t=>{
 for(const [upstream,pathname] of [['https://api.example','/v1/models'],['https://api.example/v1','/v1/models'],['https://api.example/v1/','/v1/models'],['https://api.example/prefix','/prefix/v1/models'],['https://api.example/prefix/v1/','/prefix/v1/models']]){
  const f=catalogFixture(t);await f.detect({route:{...route,upstream}});assert.equal(f.calls[0].target.pathname,pathname);
 }
});

test('Anthropic detection follows validated last_id pages with fixed version and x-api-key',async t=>{
 const f=catalogFixture(t,[
  {json:{data:[{id:'claude-first'},{id:'cursor?&=/%+中文'}],has_more:true,last_id:'cursor?&=/%+中文'}},
  {json:{data:[{id:'claude-first'},{id:'claude-last'}],has_more:false,last_id:'claude-last'}},
 ]);
 const result=await f.detect({route:{...route,protocol:'anthropic'}});
 assert.deepEqual(result.models,[{id:'claude-first'},{id:'cursor?&=/%+中文'},{id:'claude-last'}]);assert.equal(result.truncated,false);
 assert.equal(f.calls.length,2);assert.equal(f.calls[0].target.search,'?limit=100');
 assert.equal(f.calls[1].target.searchParams.get('after_id'),'cursor?&=/%+中文');assert.equal([...f.calls[1].target.searchParams].length,2);
 for(const item of f.calls)assert.deepEqual(item.options.headers,{accept:'application/json','accept-encoding':'identity','x-api-key':UPSTREAM_KEY,'anthropic-version':'2023-06-01'});
 assert.equal(f.dnsCalls.length,2);
});

test('real empty catalogs succeed and compatible OpenAI has_more is reported as incomplete',async t=>{
 for(const protocol of ['openai','anthropic']){
  const f=catalogFixture(t,[{json:{data:[],...(protocol==='anthropic'?{has_more:false,last_id:null}:{})}}]);
  const result=await f.detect({route:{...route,protocol}});assert.deepEqual(result.models,[]);assert.equal(result.truncated,false);
 }
 const f=catalogFixture(t,[{json:{data:[{id:'partial'}],has_more:true,last_id:'partial'}}]);
 const result=await f.detect();assert.equal(result.truncated,true);assert.equal(f.calls.length,1);assert.equal(f.calls[0].target.search,'');
});

test('all DNS answers must be public and every catalog page pins the newly resolved socket address',async t=>{
 let attempts=0;
 const f=catalogFixture(t,[{json:{data:[{id:'first'}],has_more:true,last_id:'first'}},{json:{data:[{id:'last'}],has_more:false}}],{
  lookup:(host,options,callback)=>{assert.equal(host,'api.example');assert.deepEqual(options,{all:true,verbatim:true});callback(null,[++attempts===1?public4:{address:'1.1.1.1',family:4},public6]);},
 });
 await f.detect({route:{...route,protocol:'anthropic'}});assert.equal(attempts,2);
 for(const [index,item] of f.calls.entries()){
  assert.equal(item.target.hostname,'api.example');assert.equal(item.options.family,4);assert.equal(item.options.autoSelectFamily,false);
  const selected=await new Promise((resolve,reject)=>item.options.lookup('API.example',{},(error,address,family)=>error?reject(error):resolve({address,family})));
  assert.deepEqual(selected,index===0?public4:{address:'1.1.1.1',family:4});
  const all=await new Promise((resolve,reject)=>item.options.lookup('api.example',{all:true},(error,value)=>error?reject(error):resolve(value)));assert.deepEqual(all,[selected]);
  await rejectsSafe(new Promise((resolve,reject)=>item.options.lookup('attacker.example',{},error=>error?reject(error):resolve())),'models-address-changed');
 }
});

test('private, reserved, loopback and mixed public/private targets receive no credential-bearing request',async t=>{
 for(const upstream of ['http://127.0.0.1','https://127.0.0.1','https://[::1]',('https://'+'169.254.169.254'),'https://localhost','https://api.example.',('https://user'+':password@api.example'),'https://api.example/v1?x=1','https://api.example/v1#x']){
  const f=catalogFixture(t);await rejectsSafe(f.detect({route:{...route,upstream}}),'models-invalid-upstream');assert.equal(f.calls.length,0);
 }
 const f=catalogFixture(t,[],{lookup:(_host,_options,callback)=>callback(null,[public4,{address:'10.0.0.1',family:4}])});
 await rejectsSafe(f.detect(),'models-invalid-upstream');assert.equal(f.calls.length,0);
 const rebind=catalogFixture(t,[{json:{data:[{id:'first'}],has_more:true,last_id:'first'}}],{lookup:(()=>{let index=0;return (_host,_options,callback)=>callback(null,++index===1?[public4]:[{address:'192.168.1.1',family:4}]);})()});
 await rejectsSafe(rebind.detect({route:{...route,protocol:'anthropic'}}),'models-invalid-upstream');assert.equal(rebind.calls.length,1);
});

test('redirects and HTTP error bodies are discarded without retry or credential echo',async t=>{
 for(const [status,code] of [[301,'models-redirect-not-allowed'],[401,'models-auth-failed'],[403,'models-auth-failed'],[404,'models-endpoint-unavailable'],[405,'models-endpoint-unavailable'],[429,'models-rate-limited'],[500,'models-http-failed']]){
  const f=catalogFixture(t,[{status,body:Buffer.from(UPSTREAM_KEY+CLIENT_KEY+MANAGEMENT_TOKEN),headers:{location:'https://attacker.example','content-type':'application/json'}}]);
  await rejectsSafe(f.detect(),code);assert.equal(f.calls.length,1);assert.equal(f.calls[0].destroyCount,1);
 }
});

test('total catalog response bytes are bounded across pages and declared oversized bodies are rejected',async t=>{
 const oversized=catalogFixture(t,[{json:{data:[]},headers:{'content-type':'application/json','content-length':String(1024*1024+1)}}]);
 await rejectsSafe(oversized.detect(),'models-response-too-large');
 const body=id=>Buffer.from(JSON.stringify({data:[{id}],has_more:true,last_id:id,padding:'x'.repeat(540000)}));
 const f=catalogFixture(t,[{body:body('first')},{body:body('second')}]);
 await rejectsSafe(f.detect({route:{...route,protocol:'anthropic'}}),'models-response-too-large');assert.equal(f.calls.length,2);
});

test('model and IPC byte caps return explicit partial results without changing identifiers',async t=>{
 const f=catalogFixture(t,[{json:{data:Array.from({length:501},(_,index)=>({id:'model-'+index}))}}]);
 const result=await f.detect();assert.equal(result.models.length,500);assert.equal(result.truncated,true);
 const escaped=catalogFixture(t,[{json:{data:Array.from({length:500},(_,index)=>({id:'\\'.repeat(240)+String(index).padStart(3,'0')}))}}]);
 const large=await escaped.detect();assert.ok(large.models.length<500);assert.equal(large.truncated,true);assert.ok(Buffer.byteLength(JSON.stringify(large))<=128*1024);
 const exact=catalogFixture(t,[{json:{data:[{id:'界'.repeat(85)+'a'}]}}]);assert.equal((await exact.detect()).models[0].id,'界'.repeat(85)+'a');
 const tooLong=catalogFixture(t,[{json:{data:[{id:'界'.repeat(86)}]}}]);await rejectsSafe(tooLong.detect(),'models-response-invalid');
});

test('Anthropic pagination stops at five pages or 500 models and labels the result incomplete',async t=>{
 const pages=Array.from({length:6},(_,page)=>({json:{data:Array.from({length:100},(_,index)=>({id:'page-'+page+'-'+index})),has_more:true,last_id:'page-'+page+'-99'}}));
 const f=catalogFixture(t,pages);const result=await f.detect({route:{...route,protocol:'anthropic'}});
 assert.equal(result.models.length,500);assert.equal(f.calls.length,5);assert.equal(result.truncated,true);
 const shorter=catalogFixture(t,Array.from({length:6},(_,page)=>({json:{data:[{id:'single-'+page}],has_more:true,last_id:'single-'+page}})));
 const partial=await shorter.detect({route:{...route,protocol:'anthropic'}});assert.equal(partial.models.length,5);assert.equal(partial.truncated,true);assert.equal(shorter.calls.length,5);
});

test('malformed and cycling pagination cannot loop or interpolate arbitrary upstream URLs',async t=>{
 for(const json of [
  {data:[{id:'first'}],has_more:true,last_id:'not-in-data'},
  {data:[],has_more:true,last_id:'empty'},
  {data:[{id:'first'}],has_more:true,last_id:'bad\nvalue'},
  {data:[{id:'first'}],has_more:true,last_id:UPSTREAM_KEY},
 ]){
  const f=catalogFixture(t,[{json}]);await rejectsSafe(f.detect({route:{...route,protocol:'anthropic'}}),'models-pagination-invalid');assert.equal(f.calls.length,1);
 }
 const cycle=catalogFixture(t,[{json:{data:[{id:'first'}],has_more:true,last_id:'first'}},{json:{data:[{id:'first'}],has_more:true,last_id:'first'}}]);
 await rejectsSafe(cycle.detect({route:{...route,protocol:'anthropic'}}),'models-pagination-invalid');assert.equal(cycle.calls.length,2);
 const malformed=catalogFixture(t,[{json:{data:[{id:'first'}],has_more:'yes',last_id:'first'}}]);await rejectsSafe(malformed.detect({route:{...route,protocol:'anthropic'}}),'models-response-invalid');
});

test('malformed content, schema, UTF8 and transport errors never expose raw upstream text',async t=>{
 for(const reply of [
  {body:Buffer.from(UPSTREAM_KEY)},
  {body:Buffer.from([0xc3,0x28])},
  {json:{data:{id:'wrong'}}},{json:{data:[{}]}},{json:{data:[{id:''}]}},{json:{data:[{id:' \t '}]}},{json:{data:[{id:'line\nfeed'}]}},{json:{data:[{id:'c1\u0085control'}]}},{json:{data:[{id:'unpaired\ud800'}]}},{json:{data:[{id:1}]}},
  {headers:{'content-type':'text/html'},body:Buffer.from(UPSTREAM_KEY)},
  {headers:{'content-type':'application/json','content-encoding':'gzip'},json:{data:[]}},
 ]){
  const f=catalogFixture(t,[reply]);await rejectsSafe(f.detect(),'models-response-invalid');
 }
 const transport=catalogFixture(t,[{error:UPSTREAM_KEY}]);await rejectsSafe(transport.detect(),'models-connection-failed');
 const interrupted=catalogFixture(t,[{interrupted:true}]);await rejectsSafe(interrupted.detect(),'models-response-interrupted');
 const dns=catalogFixture(t,[],{lookup:(_host,_options,callback)=>callback(new Error(UPSTREAM_KEY))});await rejectsSafe(dns.detect(),'models-dns-failed');
});

test('a model ID containing any saved private value fails without returning the reflected secret',async t=>{
 for(const value of [UPSTREAM_KEY,CLIENT_KEY,MANAGEMENT_TOKEN]){
  const f=catalogFixture(t,[{json:{data:[{id:'valid'},{id:'prefix-'+value+'-suffix'}]}}]);await rejectsSafe(f.detect(),'models-credentials-reflected');
 }
 const many=catalogFixture(t,[{json:{data:[{id:'valid'},{id:'prefix-saved-secret-64-suffix'}]}}]);
 await rejectsSafe(many.detect({privateValues:Array.from({length:65},(_,index)=>'saved-secret-'+index)}),'models-credentials-reflected');
});

test('abort cancels DNS or response reading and late results cannot resume the request',async t=>{
 let callback;
 const controller=new AbortController(),f=catalogFixture(t,[],{lookup:(_host,_options,done)=>{callback=done;}});
 const pending=f.detect({signal:controller.signal});const rejected=rejectsSafe(pending,'models-cancelled');
 for(let attempt=0;!callback&&attempt<30;attempt++)await delay(1);assert.equal(typeof callback,'function');controller.abort();callback(null,[public4]);await rejected;assert.equal(f.calls.length,0);
 const readingController=new AbortController(),reading=catalogFixture(t,[{stall:true}]);
 const read=reading.detect({signal:readingController.signal});const readRejected=rejectsSafe(read,'models-cancelled');
 for(let attempt=0;!reading.calls[0]?.response&&attempt<30;attempt++)await delay(1);readingController.abort();await readRejected;assert.equal(reading.calls[0].destroyCount,1);
 const early=new AbortController();early.abort();const before=catalogFixture(t);await rejectsSafe(before.detect({signal:early.signal}),'models-cancelled');assert.equal(before.calls.length,0);
});

test('one total timeout covers stalled DNS, slow response and asynchronous freshness checks',async t=>{
 const dns=catalogFixture(t,[],{timeoutMs:15,lookup:()=>{}});await rejectsSafe(dns.detect(),'models-timeout');assert.equal(dns.calls.length,0);
 const body=catalogFixture(t,[{stall:true}],{timeoutMs:15});await rejectsSafe(body.detect(),'models-timeout');assert.equal(body.calls[0].destroyCount,1);
 const freshness=catalogFixture(t,[],{timeoutMs:15});await rejectsSafe(freshness.detect({assertFresh:()=>new Promise(()=>{})}),'models-timeout');assert.equal(freshness.calls.length,0);
});

test('freshness is awaited after DNS, between pages and before returning models',async t=>{
 const gate=deferred();let checks=0;
 const f=catalogFixture(t,[{json:{data:[{id:'first'}],has_more:true,last_id:'first'}},{json:{data:[{id:'last'}],has_more:false}}]);
 const pending=f.detect({route:{...route,protocol:'anthropic'},assertFresh:async()=>{checks++;if(checks===2)await gate.promise;return true;}});
 await delay(5);assert.equal(f.calls.length,0);gate.resolve();await pending;assert.equal(checks,7);
 let current=0;const changed=catalogFixture(t);await rejectsSafe(changed.detect({assertFresh:async()=>++current!==2}),'models-route-changed');assert.equal(changed.calls.length,0);
 const stale=catalogFixture(t);await rejectsSafe(stale.detect({assertFresh:async()=>{throw Object.assign(new Error(UPSTREAM_KEY),{code:'config-conflict'});}}),'config-conflict');
 const unknown=catalogFixture(t);await rejectsSafe(unknown.detect({assertFresh:async()=>{throw new Error(UPSTREAM_KEY);}}),'models-route-changed');
});

test('route identity is captured before asynchronous work and invalid private context never performs a request',async t=>{
 const gate=deferred(),f=catalogFixture(t),mutable={...route};let count=0;
 const result=f.detect({route:mutable,assertFresh:async()=>{if(++count===1)await gate.promise;return true;}});
 mutable.id='other';mutable.upstream='https://attacker.example';gate.resolve();assert.equal((await result).routeId,'primary');assert.equal(f.calls[0].target.hostname,'api.example');
 for(const input of [{configVersion:0},{configVersion:1.5},{upstreamKey:'key\r\nheader'},{privateValues:[1]},{assertFresh:undefined},{route:{...route,protocol:'unknown'}}]){
  const invalid=catalogFixture(t);await rejectsSafe(invalid.detect(input),'models-invalid-input');assert.equal(invalid.calls.length,0);
 }
});

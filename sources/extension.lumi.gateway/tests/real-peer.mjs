// Test-only HTTPS provider. GUI setup and all credentials use the real managed host.
import https from 'node:https';
import http from 'node:http';
import net from 'node:net';
import {createTlsIdentity} from '../../gateway-runtime/dev/tls-identity.mjs';

async function listen(server){await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return server.address().port;}
async function close(server){server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));}
async function unusedPort(){const server=net.createServer();const port=await listen(server);await close(server);return port;}

/** Fixed HTTPS test dial, no arbitrary hostname or disabled certificate checks. */
export async function createRealUiPeer(){
 const forwarded=[],requests=[],catalogs=[],streams=new Map();let catalogMode="normal";
 const occupiedManagement=net.createServer();
 const upstreamIdentity=createTlsIdentity();
 const upstream=https.createServer({key:upstreamIdentity.privateKeyPem,cert:upstreamIdentity.certificatePem,minVersion:'TLSv1.2'},(req,res)=>{void(async()=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
  if(req.method==='GET'&&req.url==='/v1/models'){
   catalogs.push({method:req.method,path:req.url,authorization:req.headers.authorization,bodyBytes:body.length});
   const mode=catalogMode;if(mode==='delayed'||mode==='delayed-error')await new Promise(resolve=>setTimeout(resolve,250));
   const status=mode==='auth'?401:mode==='unavailable'?404:mode==='error'||mode==='delayed-error'?503:200;
   if(status!==200){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify({error:'isolated catalog failure'}));return;}
   const data=mode==='empty'?[]:mode==='truncated'?Array.from({length:501},(_,index)=>({id:'fixture-model-'+index,object:'model'})):mode==='merge'?[{id:'fixture-model'},{id:'model-alias-collision'},{id:'catalog-new-model'}]:[{id:'fixture-model',object:'model'},{id:'provider/catalog-model-2026',object:'model'},{id:'<img src="https://must-not-load.invalid/catalog" onerror="alert(1)">',object:'model'}];
   const catalog=Buffer.from(JSON.stringify({object:'list',data}));
   res.writeHead(200,{'content-type':'application/json','content-length':catalog.length});res.end(catalog);return;
  }
  forwarded.push({path:req.url,authorization:req.headers.authorization,body,headers:req.headers});
  const incoming=JSON.parse(body.toString('utf8'));
  if(incoming.input==='isolated upstream 404'){
   const bytes=Buffer.from(JSON.stringify({message:'Not Found',type:'bad_response_status_code',param:'',code:'bad_response_status_code'}));
   res.writeHead(404,{'content-type':'application/json','content-length':bytes.length,'x-fixture-error-origin':'upstream'});res.end(bytes);return;
  }
  if(['isolated window a','isolated window b'].includes(incoming.input)&&incoming.stream===true){
   const response={id:'resp_live_'+incoming.input.at(-1),object:'response',status:'in_progress',model:incoming.model,output:[]};
   const event=value=>'data: '+JSON.stringify(value)+'\n\n';let text='';
   res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache'});res.write(event({type:'response.created',response}));
   streams.set(incoming.input,{emit(delta){text+=delta;res.write(event({type:'response.output_text.delta',delta}));},finish(){response.status='completed';response.output=[{type:'message',role:'assistant',content:[{type:'output_text',text}]}];response.usage={input_tokens:11,output_tokens:77};res.end(event({type:'response.completed',response}));streams.delete(incoming.input);}});
   res.once('close',()=>streams.delete(incoming.input));return;
  }
  const rejected=incoming.service_tier==='provider_rejected-2026';
  const response=Buffer.from(JSON.stringify(rejected
   ? {error:{message:'fixture unsupported service_tier',code:'unsupported_service_tier'}}
   : {id:'resp_ui_fixture',object:'response',status:'completed',model:JSON.parse(body.toString('utf8')).model,output:[{id:'msg_ui_fixture',type:'message',role:'assistant',content:[{type:'output_text',text:'真实 TLS 夹具回答',annotations:[]}]}],service_tier:'default',output_text:'真实 TLS 夹具回答',authorization:'fake-body-secret',usage:{input_tokens:11,output_tokens:5}}));
  res.writeHead(rejected?400:200,{'content-type':'application/json','content-length':response.length});res.end(response);
 })().catch(()=>res.destroy());});
 const originalRequest=https.request;
 try{
  const upstreamPort=await listen(upstream);
  const occupiedManagementPort=await listen(occupiedManagement);
  const setupPorts={listenPort:await unusedPort(),managementPort:await unusedPort()};
  while(setupPorts.managementPort===setupPorts.listenPort)setupPorts.managementPort=await unusedPort();
  const nextPorts={listenPort:await unusedPort(),managementPort:await unusedPort()};
  while(new Set(Object.values({...setupPorts,nextListenPort:nextPorts.listenPort,nextManagementPort:nextPorts.managementPort})).size!==4){nextPorts.listenPort=await unusedPort();nextPorts.managementPort=await unusedPort();}
  https.request=function(target,options,...rest){
   if(target instanceof URL && target.hostname==='upstream.example'){
    if(target.protocol!=='https:'||target.port||!['/v1/responses','/v1/models'].includes(target.pathname)||target.search||target.hash)throw new Error('test-fixed-upstream-dial-only');
    return originalRequest.call(this,new URL('https://127.0.0.1:'+upstreamPort+target.pathname),{...options,ca:upstreamIdentity.certificatePem,rejectUnauthorized:true},...rest);
   }
   return originalRequest.call(this,target,options,...rest);
  };
  return {forwarded,requests,catalogs,streamReady(label){return streams.has(label);},emitStream(label,text){const stream=streams.get(label);if(!stream)throw new Error('test-stream-not-ready');stream.emit(text);},finishStream(label){const stream=streams.get(label);if(!stream)throw new Error('test-stream-not-ready');stream.finish();},setCatalogMode(mode){if(!['normal','merge','empty','truncated','delayed','delayed-error','auth','unavailable','error'].includes(mode))throw new Error('test-catalog-mode');catalogMode=mode;},setupPorts,nextPorts,occupiedManagementPort,async send(address,body,{routeId='primary',clientKey='fixture-client-key-0123456789',endpoint='/v1/responses'}={}){
   const bytes=Buffer.from(typeof body==='string'?body:JSON.stringify(body));
   const response=await new Promise((resolve,reject)=>{const req=http.request('http://'+address+(routeId?'/'+routeId:'')+endpoint,{method:'POST',agent:false,headers:{authorization:'Bearer '+clientKey,'content-type':'application/json','content-length':bytes.length}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.once('error',reject);res.once('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}));});req.once('error',reject);req.setTimeout(10000,()=>req.destroy(new Error('isolated peer response timeout')));req.end(bytes);});
   requests.push(response);return response;
  },async close(){https.request=originalRequest;await close(upstream);await close(occupiedManagement);}};
 }catch(error){https.request=originalRequest;await close(upstream).catch(()=>{});await close(occupiedManagement).catch(()=>{});throw error;}
}

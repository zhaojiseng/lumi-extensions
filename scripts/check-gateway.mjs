import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const started=new Date().toISOString(),checks=[];
async function run(name,args){
 const start=Date.now();
 const code=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:repository,stdio:'inherit',windowsHide:true,shell:false});child.on('error',()=>resolve(1));child.on('exit',code=>resolve(code??1));});
 checks.push({name,code,durationMs:Date.now()-start});
 if(code)throw new Error(name+' 失败');
}
try{
 await run('Rust tests',['scripts/gateway-tool.mjs','test','--locked']);
 await run('Rust lint',['scripts/gateway-tool.mjs','clippy','--locked','--all-targets','--','-D','warnings']);
 await run('Runtime and isolated fixture build',['scripts/gateway-tool.mjs','build','--locked','--bins','--example','fixture-engine']);
 await run('Node data/management regressions',['--test','sources/gateway-runtime/tests/engine-pipe.test.mjs','sources/gateway-runtime/tests/transport.test.mjs','sources/gateway-runtime/tests/data-models.test.mjs','sources/gateway-runtime/tests/public-upstream.test.mjs','sources/gateway-runtime/tests/end-to-end.test.mjs','sources/gateway-runtime/tests/management.test.mjs','sources/gateway-runtime/tests/catalog.test.mjs','sources/gateway-runtime/tests/management-catalog.test.mjs']);
}finally{
 const directory=path.join(repository,'.cache/gateway-validation');await mkdir(directory,{recursive:true});
 await writeFile(path.join(directory,'result.json'),JSON.stringify({started,completed:new Date().toISOString(),checks,scope:'隔离运行时、实际 loopback TLS/HTTP 与假上游；不含真实 CLI/付费请求/实际 Electron 集成/macOS'},null,2));
}

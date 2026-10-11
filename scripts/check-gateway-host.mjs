import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const host=path.resolve(repository,'../main');
const started=new Date().toISOString(),checks=[];
async function run(name,args){
 const start=Date.now();let stdout='',stderr='';
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:host,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});child.on('error',reject);child.stdout.on('data',bytes=>{stdout+=bytes;process.stdout.write(bytes);});child.stderr.on('data',bytes=>{stderr+=bytes;process.stderr.write(bytes);});child.on('exit',value=>resolve(value??1));});
 checks.push({name,code,durationMs:Date.now()-start,stdout,stderr});if(code)throw new Error(name+' 失败');
}
try{
 await run('Actual host TypeScript',[path.join(host,'node_modules/typescript/bin/tsc'),'--noEmit']);
 await run('Actual host gateway contracts and services',['--import','tsx','--test',
  'tests/gateway-extension-contract.test.ts','tests/gateway-management.test.ts','tests/gateway-pairing.test.ts',
  'tests/gateway-cli-config.test.ts','tests/gateway-cli-process.test.ts']);
}finally{
 const directory=path.join(repository,'.cache');await mkdir(directory,{recursive:true});
 await writeFile(path.join(directory,'gateway-host-validation.json'),JSON.stringify({started,completed:new Date().toISOString(),host,checks,scope:'实际相邻 main 的完整类型检查及网关隔离回归；不含真实 CLI、付费请求、主程序全量测试或桌面链路验证'},null,2));
}

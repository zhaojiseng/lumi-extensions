import {spawn} from 'node:child_process';
import {mkdir,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,randomBytes} from 'node:crypto';
import {createTlsIdentity} from './tls-identity.mjs';
const [dataDir,portText,...extra]=process.argv.slice(2);
const port=Number(portText);
if(!dataDir || !path.isAbsolute(dataDir) || !Number.isInteger(port) || port<1 || port>65535
 || extra.length!==0 && (extra.length!==2 || extra[0]!=='--pairing-file' || !path.isAbsolute(extra[1])))throw new Error('用法：node dev/setup-management.mjs <独立数据目录> <管理端口> [--pairing-file <新配对文件绝对路径>]');
if(!(await stat(dataDir)).isDirectory())throw new Error('请先完成网关初始化。');
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const binary=path.join(repository,'.cache/gateway-target/debug/lumi-gateway-runtime'+(process.platform==='win32'?'.exe':''));
const identity=createTlsIdentity();
const secrets={instanceId:randomUUID(),alias:'本机录制网关',port,...identity,token:randomBytes(32).toString('base64url')};
const payload=Buffer.from(JSON.stringify(secrets));
try{
 await new Promise((resolve,reject)=>{
  const child=spawn(binary,['protect-management',dataDir],{stdio:['pipe','pipe','pipe'],windowsHide:true,shell:false});
  const fail=()=>reject(new Error('无法保存管理身份；请检查系统加密存储和目录。'));
  child.on('error',fail);child.stdin.on('error',fail);child.stdout.on('error',fail);child.stderr.on('error',fail);
  child.stdout.resume();child.stderr.resume();child.on('exit',code=>code===0?resolve():fail());child.stdin.end(payload);
 });
 if(extra.length){
  const file=extra[1];
  await mkdir(path.dirname(file),{recursive:true,mode:0o700});
  await writeFile(file,JSON.stringify({version:1,instanceId:secrets.instanceId,alias:secrets.alias,port,certificatePem:secrets.certificatePem,fingerprintSha256:secrets.fingerprintSha256,token:secrets.token}),{flag:'wx',mode:0o600});
  console.log('已写入用户指定的新配对文件。该文件含管理授权；在 Lumi 导入后请删除或妥善保管。');
 }
 console.log('管理身份已保存到系统保护的 management.bin；没有输出密钥。');
}finally{payload.fill(0);secrets.privateKeyPem='';secrets.token='';}

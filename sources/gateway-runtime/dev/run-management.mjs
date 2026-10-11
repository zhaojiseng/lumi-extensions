import path from 'node:path';
import {startEngine} from './engine.mjs';
import {createManagementGateway} from './management.mjs';
const dataDir=process.argv[2];
if(process.argv.length!==3 || !path.isAbsolute(dataDir??''))throw new Error('用法：node dev/run-management.mjs <独立数据目录绝对路径>');
const engine=await startEngine({dataDir});
let management;
try{
 if(!engine.bootstrap.management)throw new Error('管理身份尚未初始化。');
 management=await createManagementGateway({dataDir,engine,identity:engine.bootstrap.management,routeSecrets:engine.bootstrap.routeSecrets});
 console.log('本地 TLS 管理端已监听：127.0.0.1:'+management.port+'；数据监听由 Lumi 网关控制页启动。');
}catch{await engine.close();throw new Error('管理网关启动失败，请检查系统加密存储、管理身份和端口。');}
let stopping=false,warned=0;
const health=setInterval(()=>{const failures=management.metrics().recordingFailures;if(failures>warned){warned=failures;console.error('检测到本地录制不完整。累计失败：'+warned);}},1000);health.unref();
async function stop(){if(stopping)return;stopping=true;clearInterval(health);await management.close();await engine.close();}
process.once('SIGINT',()=>{void stop().catch(()=>{process.exitCode=1;});});
process.once('SIGTERM',()=>{void stop().catch(()=>{process.exitCode=1;});});

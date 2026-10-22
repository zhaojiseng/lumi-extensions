import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';

// Synthetic geometry only: no Electron, account, session or network access.
const host=process.argv[2] && path.resolve(process.argv[2]);
const option=name=>{const at=process.argv.indexOf(name);if(at<0)return undefined;const value=process.argv[at+1];if(!value || value.startsWith('--'))throw Error(name+' 缺少路径。');return path.resolve(value);};
const baseline=option('--baseline-runtime'),candidate=option('--runtime') || (host && path.join(host,'src/host/glass-refraction.ts'));
if(!host || !existsSync(path.join(host,'package.json')) || !baseline || !candidate || !existsSync(baseline) || !existsSync(candidate))throw Error('用法：node scripts/benchmark-dreamy-glass.mjs <Lumi checkout> --baseline-runtime <旧 glass-refraction.ts> [--runtime <新 glass-refraction.ts>] [--output <JSON 路径>]');
const {build}=createRequire(path.join(host,'package.json'))('esbuild');
const compiled=await build({stdin:{contents:`export {glassDisplacement as before} from ${JSON.stringify(baseline)};export {glassDisplacement as after} from ${JSON.stringify(candidate)};`,resolveDir:host},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {before,after}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'));
let equivalentCases=0;
for(const [width,height] of [[2,2],[13,47],[101,27],[240,120],[400,240],[1200,800],[2000,1000],[139.5,51.25]])for(const radius of [0,7,20,2000])for(const maxSize of [32,384])for(const lens of [false,true])for(const surface of [false,true]){
  const args=[width,height,radius,maxSize,lens,surface];
  assert.deepEqual(after(...args),before(...args),'位移图发生变化：'+JSON.stringify(args));equivalentCases++;
}
const results=[];
for(const [name,args] of [['workspace',[1200,800,24,384,false,true]],['model-card',[300,220,20,384,false,true]],['popup',[680,520,24,384,false,false]],['selection',[160,36,12,384,true,false]]]){
  for(let i=0;i<5;i++){before(...args);after(...args);}
  const samples={before:[],after:[]};
  for(let i=0;i<15;i++)for(const [label,fn] of i%2 ? [['after',after],['before',before]] : [['before',before],['after',after]]){
    const start=performance.now();for(let j=0;j<5;j++)fn(...args);samples[label].push((performance.now()-start)/5);
  }
  const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
  const baselineMs=median(samples.before),candidateMs=median(samples.after);
  results.push({name,baselineMs,candidateMs,reductionPercent:100*(1-candidateMs/baselineMs)});
}
const bundleSha256=createHash('sha256').update(compiled.outputFiles[0].contents).digest('hex');
const result={node:process.version,platform:process.platform,arch:process.arch,baseline,candidate,bundleSha256,equivalentCases,warmups:5,samples:15,iterationsPerSample:5,results,limitations:['仅测量 CPU 位移图生成，不代表整帧耗时、GPU 占用或整机性能。','同一进程交替执行基线与候选，耗时不设跨机器阈值。','逐字节相同不能替代主题切换、滚动、弹窗和退出生命周期的真实画面验证。']};
const output=option('--output');if(output){await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result,null,2));

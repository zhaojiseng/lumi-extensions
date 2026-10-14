import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import path from 'node:path';

// Compare the committed and working Dreamy CSS in one document, using the real
// host popup/picker components. The selected host checkout is read-only.
const root=path.resolve(import.meta.dirname,'..'),host=process.argv[2] && path.resolve(process.argv[2]);
if(!host || !existsSync(path.join(host,'src/components/ui.tsx')))throw Error('请指定已准备的 Lumi checkout。');
const requireHost=createRequire(path.join(host,'package.json')),{build}=requireHost('esbuild'),electron=requireHost('electron');
if(!existsSync(electron))throw Error('宿主 Electron 尚未准备。');
const option=name=>{const index=process.argv.indexOf(name);if(index<0)return undefined;const value=process.argv[index+1];if(!value || value.startsWith('--'))throw Error(name+' 缺少参数值。');return value;};
const selectedScene=option('--scene'),selectedMode=option('--mode'),baselineRef=option('--baseline-ref') || 'HEAD';
const scenes=['modal','details','popover','multi','toast','trend','donut','picker'],modes=['light','dark'];
if(selectedScene && !scenes.includes(selectedScene))throw Error('--scene 必须为 '+scenes.join('、')+'。');
if(selectedMode && !modes.includes(selectedMode))throw Error('--mode 必须为 light 或 dark。');
const execFileAsync=promisify(execFile),relative='plugins/extension.author.dreamy/interface.css';
const {stdout:baselineCommitText}=await execFileAsync('git',['rev-parse','--verify',baselineRef+'^{commit}'],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:1024*1024});
const baselineCommit=baselineCommitText.trim();
if(!/^[0-9a-f]{40,64}$/.test(baselineCommit))throw Error('无法解析旧版 CSS 的完整提交。');
const [{stdout:baselineCss},candidateCss,manifestJson,hostJson]=await Promise.all([
  execFileAsync('git',['show',baselineCommit+':'+relative],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:10*1024*1024}),
  readFile(path.join(root,relative),'utf8'),readFile(path.join(root,'plugins/extension.author.dreamy/plugin.json'),'utf8'),readFile(path.join(host,'package.json'),'utf8')
]);
// HEAD is convenient while reviewing an uncommitted optimization. Once the
// optimized CSS is committed, select its actual predecessor explicitly.
const solidFilterBlocks=[...baselineCss.matchAll(/[^{}]*data-appearance-transparency\s*=\s*["']solid["'][^{}]*\{([^{}]*)\}/g)];
const optimizedBaseline=solidFilterBlocks.some(([rule,body])=>/\.modal\b|\.toast\b|\[data-popup-kind|\.multi-popover\b|\.recharts-default-tooltip\b|\.donut-tooltip\b|::picker\(select\)/.test(rule.slice(0,rule.indexOf('{'))) && /backdrop-filter\s*:\s*(?:none|blur\(0px\))/.test(body));
if(optimizedBaseline || !/backdrop-filter\s*:\s*var\(--dream-popup-blur\)\s+var\(--lumi-glass-filter/.test(baselineCss))throw Error('基线 CSS 已移除旧版浮层模糊或不含旧滤镜；提交优化后请使用 --baseline-ref <优化前提交>。');
const manifest=JSON.parse(manifestJson),hostManifest=JSON.parse(hostJson),hardware=process.argv.includes('--hardware');
const sha=value=>createHash('sha256').update(value).digest('hex');
const baselineCssSha256=sha(baselineCss),candidateCssSha256=sha(candidateCss);
const output=path.join(root,'.cache/dreamy-solid-ui');await mkdir(output,{recursive:true});
const directory=await mkdtemp(path.join(output,'fixture-'));
const fixtureRelative=path.relative(output,directory);
if(!fixtureRelative || fixtureRelative.startsWith('..') || path.isAbsolute(fixtureRelative))throw Error('测试夹具必须位于输出目录内。');
try{
  const built=await build({stdin:{resolveDir:host,loader:'tsx',contents:`
import React,{useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
import {Modal,Select} from './src/components/ui';import {PopupLayer} from './src/components/Popup';
import {MultiSelect} from './src/components/StatisticsFilter';import {scopedInterfaceSheet} from './src/host/interface';
import {defaultInterfaceLayout} from './plugins/interface.default/layout';import {installGlassRefraction} from './src/host/glass-refraction';
const baseline=${JSON.stringify(baselineCss)},candidate=${JSON.stringify(candidateCss)},id=${JSON.stringify(manifest.id)};
window.fixture={errors:[]};addEventListener('error',event=>fixture.errors.push(event.message));addEventListener('unhandledrejection',event=>fixture.errors.push(String(event.reason)));
fixture.apply=(variant,mode)=>{const shell=document.querySelector('.desktop-shell');document.documentElement.dataset.theme=mode;shell.dataset.theme=mode;shell.style.colorScheme=mode;shell.dataset.appearanceTransparency='solid';shell.dataset.appearanceBlur='strong';shell.dataset.appearanceDistortion='strong';const layout=new CSSStyleSheet();layout.replaceSync(defaultInterfaceLayout);document.adoptedStyleSheets=[layout,scopedInterfaceSheet({id,css:variant==='baseline' ? baseline : candidate})];};
function App(){const [scene,setScene]=useState(''),[open,setOpen]=useState(true),[selected,setSelected]=useState('standard'),[models,setModels]=useState([]);fixture.show=name=>{setScene(name);setOpen(true);};fixture.close=()=>setOpen(false);
useEffect(()=>{fixture.apply('candidate','light');fixture.dispose=installGlassRefraction(document.querySelector('.desktop-shell'));fixture.ready=true;return()=>fixture.dispose();},[]);
return <div className="desktop-shell platform-win32" data-interface={id}><div className="fixture-background" aria-hidden="true">{Array.from({length:32},(_,i)=><p key={i}>工作台背景 {i} · 真实文字与高频背景 · 128K / $2.40 / 模型统计</p>)}</div>
{scene==='modal' || scene==='details' ? <Modal title={scene==='details' ? '插件详情' : '普通弹窗'} className={scene==='details' ? 'plugin-details-modal' : ''} subtitle="不透明玻璃材质像素回归" open={open} exitMs={60000} onClose={()=>setOpen(false)}><div className={scene==='details' ? 'plugin-details-page' : 'fixture-dialog-content'}><h3>保持清晰的内容</h3><p>输入 128K · 输出 12K · 最近消费 $2.40</p><p>完整不透明的填充应遮住背景滤镜。</p><Select label="弹窗模型" value={selected} onChange={setSelected}><option value="standard">标准模型</option><option value="fast">Fast · 长上下文</option></Select></div></Modal> : null}
{scene==='popover' ? <PopupLayer kind="popover" label="普通浮层" className="fixture-popover" open={open} onClose={()=>setOpen(false)} style={{position:'fixed',left:370,top:230,width:320,padding:24}}><h3>普通浮层</h3><p>保留高光、边框、投影和清晰文字。</p></PopupLayer> : null}
{scene==='multi' ? <div className="fixture-trigger"><MultiSelect label="模型" value={models} onApply={setModels} options={[{value:'standard',label:'标准模型 / 128K'},{value:'fast',label:'Fast / 输入 $2.40 / 缓存计费'}]}/></div> : null}
{scene==='toast' ? <div className="toast"><span>设置已保存 · 保持材质不变</span></div> : null}
{scene==='trend' ? <div className="fixture-tooltip recharts-default-tooltip"><p>10:30 · 用量趋势</p><ul><li>消费：$2.40</li><li>Tokens：12,800</li></ul></div> : null}
{scene==='donut' ? <div className="fixture-tooltip donut-tooltip"><strong>模型用量</strong><p>gpt-6 · 12,800 Tokens · 45%</p></div> : null}
{scene==='picker' ? <div className="fixture-picker"><Select label="不透明下拉" value={selected} onChange={setSelected}><option value="standard">标准模型 · 128K</option><option value="fast">Fast · $2.40 / 1M Tokens</option><option value="long">长上下文 · 272K</option></Select></div> : null}
</div>;
}
createRoot(document.getElementById('root')).render(<App/>);`},bundle:true,platform:'browser',format:'esm',target:'chrome140',write:false,loader:{'.css':'empty','.svg':'text'},define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
  await writeFile(path.join(directory,'app.js'),built.outputFiles[0].contents);
  const styles=await Promise.all(['styles.css','workbench.css','select.css','theme-tokens.css','theme.css','updates-trends.css','filters-tools-motion.css','platform-logs.css','host/extension-layout.css'].map(file=>readFile(path.join(host,'src',file),'utf8')));
  await writeFile(path.join(directory,'style.css'),styles.join('\n')+String.raw`
html,body{margin:0;overflow:hidden!important}#root>.desktop-shell{display:block!important;width:100vw!important;height:100vh!important;padding:0!important;position:relative;overflow:hidden}.fixture-background{position:absolute;inset:0;padding:24px;background:repeating-linear-gradient(115deg,#284769 0 12px,#cfdfef 12px 24px,#7094ae 24px 36px);color:#17243a;font:16px/1.6 monospace}.fixture-background p{margin:4px 0}.fixture-dialog-content,.plugin-details-page{padding:8px}.fixture-dialog-content>.select-wrap,.plugin-details-page>.select-wrap{width:260px}.fixture-trigger,.fixture-picker{position:fixed;left:370px;top:220px;width:340px}.fixture-tooltip{position:fixed!important;left:370px;top:230px;width:300px;padding:24px;border-radius:14px}.fixture-tooltip ul{margin:0;padding:0 0 0 18px}.toast{animation:none!important}.fixture-popover{border-radius:16px}
`);
  await writeFile(path.join(directory,'index.html'),'<html><head><meta charset="UTF-8"><link rel="stylesheet" href="style.css"></head><body><div id="root"></div><script type="module" src="app.js"></script></body></html>');
  await writeFile(path.join(directory,'main.cjs'),String.raw`
const {app,BrowserWindow,nativeImage}=require('electron'),fs=require('node:fs'),path=require('node:path');
const config=JSON.parse(process.argv[2]);for(const name of ['userData','sessionData','logs','crashDumps']){const target=path.join(__dirname,name);fs.mkdirSync(target,{recursive:true});app.setPath(name,target);}if(!config.hardware)app.disableHardwareAcceleration();app.commandLine.appendSwitch('force-device-scale-factor','1');
app.whenReady().then(async()=>{
const win=new BrowserWindow({width:1100,height:760,useContentSize:true,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:!config.hardware}});
const run=async(fn,...args)=>{const result=await win.webContents.executeJavaScript('(async()=>{try{return {ok:true,value:await ('+fn.toString()+')(...'+JSON.stringify(args)+')}}catch(error){return {ok:false,error:error.stack||String(error)}}})()');if(!result.ok)throw Error(result.error);return result.value;};
const paint=async()=>{const frames=()=>run(()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('像素绘制超时')),6000);requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timer);resolve();}));}));await frames();await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await frames();};
const settle=async()=>{await run(()=>new Promise(resolve=>setTimeout(resolve,220)));await paint();};
const ready=()=>run(async()=>{const end=performance.now()+7000;while(!fixture.ready){if(performance.now()>end)throw Error('Solid fixture not ready');await new Promise(resolve=>setTimeout(resolve,10));}});
const load=async(mode,scene)=>{await win.loadFile(path.join(__dirname,'index.html'));await ready();await run((mode,scene)=>{fixture.apply('baseline',mode);fixture.show(scene);},mode,scene);};
const pause=async fraction=>{await run(async fraction=>{const end=performance.now()+6000;while(!document.querySelector('.modal-overlay')){if(performance.now()>end)throw Error('Modal did not render');await new Promise(resolve=>setTimeout(resolve,5));}const overlay=document.querySelector('.modal-overlay'),animations=overlay.getAnimations({subtree:true});if(!animations.length)throw Error('Real modal animation absent');animations.forEach(animation=>animation.pause());await Promise.all(animations.map(animation=>animation.ready));fixture.animations=animations;animations.forEach(animation=>animation.currentTime=animation.effect.getTiming().duration*.5);},fraction);await paint();await run(fraction=>fixture.animations.forEach(animation=>animation.currentTime=animation.effect.getTiming().duration*fraction),fraction);await paint();};
const targets={modal:['.modal',null],details:['.modal.plugin-details-modal','::before'],popover:['[data-popup-kind="popover"]',null],multi:['.multi-popover',null],toast:['.toast',null],trend:['.recharts-default-tooltip',null],donut:['.donut-tooltip',null],picker:['select[aria-label="不透明下拉"]','::picker(select)']};
const inspect=scene=>run((scene,targets)=>{const [selector,pseudo]=targets[scene],element=document.querySelector(selector);if(!element)throw Error('Material target absent '+scene);const style=getComputedStyle(element,pseudo),elementStyle=getComputedStyle(element),overlay=document.querySelector('.modal-overlay'),background=overlay ? getComputedStyle(overlay,'::before') : null;if(scene==='picker' && !element.matches(':open'))throw Error('Native picker is closed');if(document.querySelector('[data-lumi-glass-defs] filter'))throw Error('Opaque mode allocated displacement filters');if(fixture.errors.length)throw Error(fixture.errors.join(';'));
 const matrix=new DOMMatrixReadOnly(elementStyle.transform==='none' ? undefined : elementStyle.transform);
 let rect=element.getBoundingClientRect(),scaleX=Math.hypot(matrix.a,matrix.b),scaleY=Math.hypot(matrix.c,matrix.d);
 if(scene==='picker'){const options=[...element.options].map(option=>option.getBoundingClientRect()).filter(box=>box.width && box.height);rect={left:Math.min(...options.map(box=>box.left))-1,top:Math.min(...options.map(box=>box.top))-1,right:Math.max(...options.map(box=>box.right))+1,bottom:Math.max(...options.map(box=>box.bottom))+1};rect.width=rect.right-rect.left;rect.height=rect.bottom-rect.top;scaleX=scaleY=1;}
 const foreground=[],walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const node=walker.currentNode;if(!node.textContent.trim() || getComputedStyle(node.parentElement).visibility!=='visible')continue;const range=document.createRange();range.selectNodeContents(node);for(const box of range.getClientRects())if(box.width && box.height)foreground.push({left:box.left,top:box.top,right:box.right,bottom:box.bottom});}
 for(const node of element.querySelectorAll('svg,input,select')){const box=node.getBoundingClientRect();if(box.width && box.height)foreground.push({left:box.left,top:box.top,right:box.right,bottom:box.bottom});}
 return {selector,pseudo,filter:style.backdropFilter,background:style.backgroundColor,overlayFilter:background?.backdropFilter,overlayOpacity:background?.opacity,dialogOpacity:overlay ? getComputedStyle(document.querySelector('.modal')).opacity : undefined,geometry:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height,transform:elementStyle.transform,radiusX:parseFloat(style.borderTopLeftRadius)*scaleX,radiusY:parseFloat(style.borderTopLeftRadius)*scaleY},foreground};},scene,targets);
const crop=scene=>run((scene,targets)=>{const element=document.querySelector(targets[scene][0]);let box=element.getBoundingClientRect();if(scene==='picker'){const options=[...element.options].map(option=>option.getBoundingClientRect());const visible=options.filter(rect=>rect.width && rect.height);if(!visible.length)throw Error('Native picker option boxes absent');box={left:Math.min(...visible.map(rect=>rect.left))-2,top:Math.min(...visible.map(rect=>rect.top))-2,right:Math.max(...visible.map(rect=>rect.right))+2,bottom:Math.max(...visible.map(rect=>rect.bottom))+2};}const margin=100,x=Math.max(0,Math.floor(box.left)-margin),y=Math.max(0,Math.floor(box.top)-margin);return {x,y,width:Math.max(1,Math.min(innerWidth-x,Math.ceil(box.right)+margin-x)),height:Math.max(1,Math.min(innerHeight-y,Math.ceil(box.bottom)+margin-y))};},scene,targets);
const difference=(a,b,rect,state)=>{const first=a.toBitmap(),second=b.toBitmap(),size=a.getSize();if(first.length!==second.length)throw Error('Compared image dimensions differ');const regions=Object.fromEntries(['boundary','interior','foreground','exterior'].map(name=>[name,{pixels:0,total:0,maxChannelDifference:0,maxAlphaDifference:0,changedPixels:0,nonzeroPixels:0}])),diff=Buffer.alloc(first.length),g=state.geometry;
 const radius=Math.min(g.radiusX || 0,g.radiusY || 0,g.width/2,g.height/2),distance=(x,y)=>{const qx=Math.abs(x-(g.left+g.right)/2)-(g.width/2-radius),qy=Math.abs(y-(g.top+g.bottom)/2)-(g.height/2-radius);return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-radius;};
 let total=0,max=0,maxAlpha=0,changed=0;for(let y=0;y<size.height;y++)for(let x=0;x<size.width;x++){const i=(y*size.width+x)*4,px=rect.x+(x+.5)*rect.width/size.width,py=rect.y+(y+.5)*rect.height/size.height,d=distance(px,py),ink=state.foreground.some(box=>px>=box.left-1 && px<=box.right+1 && py>=box.top-1 && py<=box.bottom+1),region=ink ? 'foreground' : Math.abs(d)<=2 ? 'boundary' : d<0 ? 'interior' : 'exterior',stats=regions[region];const deltas=[0,1,2].map(channel=>Math.abs(first[i+channel]-second[i+channel])),delta=Math.max(...deltas),alphaDelta=Math.abs(first[i+3]-second[i+3]),sum=deltas.reduce((a,b)=>a+b,0);stats.pixels++;stats.total+=sum;stats.maxChannelDifference=Math.max(stats.maxChannelDifference,delta);stats.maxAlphaDifference=Math.max(stats.maxAlphaDifference,alphaDelta);if(delta>3 || alphaDelta)stats.changedPixels++;if(delta || alphaDelta)stats.nonzeroPixels++;max=Math.max(max,delta);maxAlpha=Math.max(maxAlpha,alphaDelta);if(delta>3 || alphaDelta)changed++;total+=sum;const intensity=Math.min(255,Math.max(delta,alphaDelta)*32),color=region==='foreground' ? [0,0,intensity] : region==='boundary' ? [0,intensity,0] : region==='interior' ? [intensity,0,intensity] : [intensity,0,0];diff[i]=color[0];diff[i+1]=color[1];diff[i+2]=color[2];diff[i+3]=255;}
 for(const stats of Object.values(regions)){stats.meanRgbDifference=stats.pixels ? stats.total/(stats.pixels*3) : 0;stats.changedPixelFraction=stats.pixels ? stats.changedPixels/stats.pixels : 0;delete stats.total;}
 return {metrics:{meanRgbDifference:total/(first.length/4*3),maxChannelDifference:max,maxAlphaDifference:maxAlpha,changedPixelFraction:changed/(first.length/4),regions},diff:nativeImage.createFromBitmap(diff,size)};};
const scenarios=[];
const compare=async(mode,scene,direction='steady',fraction=1)=>{
 await run(mode=>fixture.apply('baseline',mode),mode);await paint();const baselineState=await inspect(scene),rect=await crop(scene);const before=await win.webContents.capturePage(rect,{stayHidden:true,stayAwake:true});
 await run(mode=>fixture.apply('candidate',mode),mode);await paint();const candidateState=await inspect(scene);const after=await win.webContents.capturePage(rect,{stayHidden:true,stayAwake:true}),{metrics,diff}=difference(before,after,rect,baselineState);
 const name=[scene,mode,direction,String(fraction).replace('.','-'),config.hardware ? 'gpu' : 'software'].join('-');fs.writeFileSync(path.join(config.output,name+'-baseline.png'),before.toPNG());fs.writeFileSync(path.join(config.output,name+'-candidate.png'),after.toPNG());fs.writeFileSync(path.join(config.output,name+'-diff.png'),diff.toPNG());
 if(!baselineState.filter.includes('blur(18px)'))throw Error('Committed baseline did not exercise floating blur '+JSON.stringify({scene,baselineState}));
 if(candidateState.filter!=='blur(0px)')throw Error('Opaque floating material retains a blur kernel '+JSON.stringify({scene,candidateState}));
 if(baselineState.background!==candidateState.background || baselineState.overlayFilter!==candidateState.overlayFilter || baselineState.overlayOpacity!==candidateState.overlayOpacity || baselineState.dialogOpacity!==candidateState.dialogOpacity || JSON.stringify(baselineState.geometry)!==JSON.stringify(candidateState.geometry) || JSON.stringify(baselineState.foreground)!==JSON.stringify(candidateState.foreground))throw Error('Opaque optimization changed material, geometry or animation '+JSON.stringify({mode,scene,direction,fraction,baselineState,candidateState}));
 if(scene==='modal' || scene==='details'){const expected=direction==='closing' ? fraction<1 : fraction>0;if(expected && !/blur\((?!0px)[\d.]+px\)/.test(candidateState.overlayFilter || ''))throw Error('Visible full-window backdrop blur disappeared '+JSON.stringify(candidateState));}
 // Zero-radius blur preserves the backdrop root; replacing the blur kernel can
 // change partial coverage only at the rounded antialias boundary. Constrain
 // that two-pixel boundary in amplitude and area. Fill, foreground, outside
 // shadow and animation geometry must remain byte-identical; no full-window
 // average is allowed to hide a local content regression.
 const targetPixels=Math.max(1,baselineState.geometry.width*baselineState.geometry.height),boundaryChangedFraction=metrics.regions.boundary.changedPixels/targetPixels;
 if(['interior','foreground','exterior'].some(region=>metrics.regions[region].nonzeroPixels) || metrics.regions.boundary.maxChannelDifference>26 || metrics.maxAlphaDifference || boundaryChangedFraction>.02)throw Error('Opaque material pixels changed outside the bounded antialias boundary '+JSON.stringify({mode,scene,direction,fraction,rect,boundaryChangedFraction,metrics}));
 const result={mode,scene,direction,fraction,rect,boundaryChangedFraction,baselineState,candidateState,...metrics};scenarios.push(result);console.log('DREAMY_SOLID_PIXELS '+JSON.stringify(result));
};
for(const mode of config.selectedMode ? [config.selectedMode] : ['light','dark']){
 for(const scene of ['modal','details'].filter(scene=>!config.selectedScene || config.selectedScene===scene)){
  await load(mode,scene);await pause(.5);
  for(const fraction of [0,.5,1]){await run(fraction=>fixture.animations.forEach(animation=>animation.currentTime=animation.effect.getTiming().duration*fraction),fraction);await paint();await compare(mode,scene,'opening',fraction);}
  await run(()=>fixture.close());await pause(.5);
  for(const fraction of [0,.5,1]){await run(fraction=>fixture.animations.forEach(animation=>animation.currentTime=animation.effect.getTiming().duration*fraction),fraction);await paint();await compare(mode,scene,'closing',fraction);}
  await run(()=>fixture.animations.forEach(animation=>animation.finish()));await settle();await run(()=>{if(document.querySelector('.modal-overlay') && !document.querySelector('.modal-overlay').hidden)throw Error('Finished modal exit retained its visible layer');});
 }
 for(const scene of ['popover','multi','toast','trend','donut','picker'].filter(scene=>!config.selectedScene || config.selectedScene===scene)){
  await load(mode,scene);await settle();
  if(scene==='multi'){await run(()=>document.querySelector('.multi-trigger').click());await settle();}
  if(scene==='picker'){const point=await run(()=>{const rect=document.querySelector('select[aria-label="不透明下拉"]').getBoundingClientRect();return {x:Math.round(rect.left+rect.width/2),y:Math.round(rect.top+rect.height/2)};});win.webContents.sendInputEvent({type:'mouseMove',...point});win.webContents.sendInputEvent({type:'mouseDown',button:'left',...point});win.webContents.sendInputEvent({type:'mouseUp',button:'left',...point});await settle();}
  await compare(mode,scene);
 }
}
if(!scenarios.length)throw Error('未执行任何不透明浮层场景。');
const result={pluginVersion:config.pluginVersion,hostVersion:config.hostVersion,hardware:config.hardware,baselineRef:config.baselineRef,baselineCommit:config.baselineCommit,baselineCssSha256:config.baselineCssSha256,candidateCssSha256:config.candidateCssSha256,comparison:'resolved baseline commit versus working CSS in one document',acceptance:{byteIdenticalRegions:['interior','foreground','exterior'],shadowMarginLogicalPixels:100,boundaryWidth:2,boundaryMaxChannelDifference:26,boundaryChangedTargetPixelFraction:.02},scenarios};fs.writeFileSync(path.join(config.output,'result-'+(config.hardware ? 'gpu' : 'software')+'.json'),JSON.stringify(result,null,2)+'\n');console.log('DREAMY_SOLID_OK '+JSON.stringify({scenarios:scenarios.length,hardware:config.hardware,baselineCommit:config.baselineCommit}));win.destroy();app.exit(0);
}).catch(error=>{console.error(error.stack || error);app.exit(1);});
`);
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(electron,[path.join(directory,'main.cjs'),JSON.stringify({output,hardware,pluginVersion:manifest.version,hostVersion:hostManifest.version,selectedScene,selectedMode,baselineRef,baselineCommit,baselineCssSha256,candidateCssSha256})],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let log='';child.stdout.on('data',chunk=>{log+=chunk;process.stdout.write(chunk);});child.stderr.on('data',chunk=>{log+=chunk;process.stderr.write(chunk);});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});if(code!==0)throw Error('不透明玻璃像素回归失败。\n'+log.slice(-5000));
  console.log('截图及结果：'+output);
}finally{await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}

import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// UI checks use an explicitly selected, prepared Lumi checkout. The package
// validator remains pinned; this script neither installs nor bundles the host.
const root=fileURLToPath(new URL('../',import.meta.url)),host=process.argv[2] && path.resolve(process.argv[2]);
if(!host || !existsSync(path.join(host,'src/components/ui.tsx')))throw new Error('用法：npm run check:dreamy-ui -- <Lumi 源码目录>；宿主需已安装依赖和 Electron。');
const requireHost=createRequire(path.join(host,'package.json')),{build}=requireHost('esbuild'),electron=requireHost('electron');
if(!existsSync(electron))throw new Error('宿主 Electron 尚未准备，请先在宿主运行 npm run setup:electron。');
const themeCss=await readFile(path.join(root,'plugins/extension.author.dreamy/interface.css'),'utf8');
const manifest=JSON.parse(await readFile(path.join(root,'plugins/extension.author.dreamy/plugin.json'),'utf8')),hostManifest=JSON.parse(await readFile(path.join(host,'package.json'),'utf8'));
const output=path.join(root,'.cache/dreamy-ui');await mkdir(output,{recursive:true});
const fixture=await mkdtemp(path.join(output,'fixture-'));
const fixtureRelative=path.relative(output,fixture);
if(!fixtureRelative || fixtureRelative.startsWith('..') || path.isAbsolute(fixtureRelative))throw new Error('临时夹具目录必须位于检查输出目录内。');
try{
  const built=await build({stdin:{resolveDir:host,loader:'tsx',contents:`
import React,{useState,useEffect} from 'react';import {createRoot} from 'react-dom/client';
import {Modal,Select,Button,SegmentedSwitch} from './src/components/ui';import {TrendChart} from './src/components/charts';import {ModalPresence} from './src/components/ModalPresence';
import {MultiSelect} from './src/components/StatisticsFilter';import {scopedInterfaceSheet} from './src/host/interface';
import {defaultInterfaceLayout} from './plugins/interface.default/layout';import {installGlassRefraction} from './src/host/glass-refraction';
const themeCss=${JSON.stringify(themeCss)},id=${JSON.stringify(manifest.id)};
window.fixture={errors:[],setTheme:(mode,blur=true)=>{const shell=document.querySelector('.desktop-shell');shell.dataset.theme=mode;document.documentElement.dataset.theme=mode;shell.style.colorScheme=mode;const layout=new CSSStyleSheet();layout.replaceSync(defaultInterfaceLayout);document.adoptedStyleSheets=[layout,scopedInterfaceSheet({id,css:themeCss+(blur ? '' : '\\n.modal-overlay::before{backdrop-filter:none;animation:none}')})];}};
addEventListener('error',event=>fixture.errors.push(event.message));addEventListener('unhandledrejection',event=>fixture.errors.push(String(event.reason)));
function App(){const [parent,setParent]=useState(false),[child,setChild]=useState(false),[search,setSearch]=useState(false),[mode,setMode]=useState('normal'),[models,setModels]=useState([]);
fixture.setParent=setParent;
useEffect(()=>installGlassRefraction(document.querySelector('.desktop-shell')),[]);
return <div className="desktop-shell platform-win32" data-interface={id} data-theme="light"><div className="titlebar"><span>Dreamy UI 验证</span></div><aside className="sidebar"><h2>浮梦</h2><p>本地模拟数据</p><div className="sidebar-navigation"><button className="nav-item active">工作台</button><button className="nav-item">设置</button></div></aside><main className="main-area"><div className="content-scroll"><div className="content-container"><h1>弹层背景虚化</h1><div className="fixture-actions"><Button onClick={()=>setParent(true)}>打开插件详情</Button><Button onClick={()=>setSearch(true)}>打开搜索</Button><MultiSelect label="模型" value={models} onApply={setModels} options={[{value:'standard',label:'标准模型'},{value:'long',label:'带有很长名称的模型选项 / 272K / Fast / 缓存计费说明'}]}/></div><section className="fixture-materials models-market"><h2>液态玻璃控件</h2><SegmentedSwitch label="模型请求状态">{['normal','fast','long'].map(v=><button key={v} aria-pressed={mode===v} onClick={()=>setMode(v)}><span>{v==='normal' ? '普通' : v==='fast' ? 'Fast' : '长上下文'}</span></button>)}</SegmentedSwitch><Select label="玻璃下拉选项" value={mode} onChange={setMode}><option value="normal">普通</option><option value="fast">Fast</option><option value="long">长上下文 / 完整缓存计费说明</option></Select><article className="surface panel"><h3>用量趋势</h3><TrendChart symbol="$" data={[{label:'09:00',cost:1.2,tokens:1200,requests:2},{label:'10:00',cost:2.4,tokens:2400,requests:4},{label:'11:00',cost:1.8,tokens:1800,requests:3},{label:'12:00',cost:3.6,tokens:3600,requests:6}]}/></article></section><div id="checker"/><div className="fixture-cards">{Array.from({length:12},(_,i)=><article className="surface panel" key={i}><h3>用量与模型 {i+1}</h3><p>输入 128K · 输出 12K · 净速率 48 token/s</p><p>背景文字应虚化，弹窗文字保持清晰。</p></article>)}</div></div></div></main>
<div className="fixture-narrow"><MultiSelect label="模型" value={models} onApply={setModels} options={Array.from({length:20},(_,i)=>({value:'narrow-'+i,label:'模型 '+(i+1)+' / 272K / Fast / 完整缓存计费说明与较长名称'}))}/></div>
<ModalPresence exitMs={fixture.motionChecks ? 60000 : 240}>{parent && <Modal title="插件详情" subtitle="历史价格与工具选项" portal onClose={()=>setParent(false)}><p>普通输入 $2 / 1M Tokens，输出 $10 / 1M Tokens。</p><label className="field-label">请求模式</label><Select label="请求模式" value={mode} onChange={setMode}><option value="normal">普通 · 默认</option><option value="fast">Fast · 倍率 ×2</option><option value="long">包含完整缓存、上下文及长名称的计费档位选项</option></Select><label className="field-label">未保存草稿</label><input aria-label="未保存草稿" className="text-input" defaultValue="草稿应清晰"/><div className="modal-actions"><Button onClick={()=>setChild(true)}>编辑站点</Button><Button onClick={()=>setParent(false)}>关闭详情</Button></div><ModalPresence>{child && <Modal title="编辑站点" onClose={()=>setChild(false)}><label className="field-label">站点名称</label><input className="text-input" aria-label="站点名称" defaultValue="Fixture"/><p>子弹窗清晰，后方的父弹窗虚化。</p><div className="modal-actions"><Button onClick={()=>setChild(false)}>完成编辑</Button></div></Modal>}</ModalPresence></Modal>}</ModalPresence>
<ModalPresence>{search && <Modal title="随时找到你需要的" subtitle="搜索页面、模型或开发工具" portal onClose={()=>setSearch(false)}><div className="search-input command-search"><input aria-label="搜索工作台内容" placeholder="搜索工作台…"/><kbd>ESC</kbd></div><div className="command-results"><button><div><strong>模型广场</strong><span>查看上下文档位与 Fast 价格</span></div></button></div></Modal>}</ModalPresence></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
`},bundle:true,platform:'browser',format:'esm',target:'chrome140',write:false,loader:{'.css':'empty','.svg':'text'},define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
  await writeFile(path.join(fixture,'app.js'),built.outputFiles[0].contents);
  const styleFiles=['components/segmented-switch.css','styles.css','workbench.css','select.css','theme-tokens.css','theme.css','updates-trends.css','filters-tools-motion.css','platform-logs.css','models-market.css'];
  const css=await Promise.all(styleFiles.map(file=>readFile(path.join(host,'src',file),'utf8')));
  await writeFile(path.join(fixture,'style.css'),css.join('\n')+'\n.fixture-materials{display:none}html[data-fixture-materials] .fixture-materials{display:grid;gap:16px}html[data-fixture-materials] .fixture-cards,html[data-fixture-materials] #checker{display:none}html[data-fixture-materials] .fixture-materials>.select-wrap{width:260px}.fixture-actions{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}.fixture-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.fixture-cards p{font-size:13px;line-height:1.6}#checker{position:fixed;left:270px;top:100px;width:100px;height:80px;background:repeating-linear-gradient(90deg,#111 0 4px,#fafafa 4px 8px);pointer-events:none}.fixture-narrow{display:none}html[data-fixture-narrow] body{min-width:0}html[data-fixture-narrow] .fixture-narrow{display:block;position:fixed;left:8px;top:8px;z-index:80}html[data-fixture-narrow] .desktop-shell>:is(.titlebar,.sidebar,.main-area){visibility:hidden}');
  await writeFile(path.join(fixture,'index.html'),'<html data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"></head><body><div id="root"></div><script type="module" src="app.js"></script></body></html>');
  const configuration={output,version:manifest.version,hostVersion:hostManifest.version,narrowOnly:process.argv.includes('--narrow-only'),motionOnly:process.argv.includes('--motion-only'),pixelsOnly:process.argv.includes('--pixels-only'),hardware:process.argv.includes('--hardware'),materialsOnly:process.argv.includes('--materials-only'),refractionOnly:process.argv.includes('--refraction-only')};
  await writeFile(path.join(fixture,'main.cjs'),String.raw`
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
const config=JSON.parse(process.argv[2]);
for(const name of ['userData','sessionData','logs','crashDumps']){const dir=path.join(__dirname,name);fs.mkdirSync(dir,{recursive:true});app.setPath(name,dir);}if(!config.hardware)app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
const win=new BrowserWindow({width:1280,height:900,useContentSize:true,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:!config.hardware}});await win.loadFile(path.join(__dirname,'index.html'));win.webContents.focus();
const run=async(fn,...args)=>{const result=await win.webContents.executeJavaScript('(async()=>{try{return {ok:true,value:await ('+fn.toString()+')(...'+JSON.stringify(args)+')}}catch(error){return {ok:false,error:error.stack||String(error)}}})()');if(!result.ok)throw new Error(result.error);return result.value;};
const ready=async()=>run(async()=>{const end=performance.now()+7000;while(!document.querySelector('.fixture-actions')){if(performance.now()>end)throw new Error('Fixture not ready');await new Promise(r=>setTimeout(r,20));}});
const settle=async()=>run(async()=>{await new Promise(r=>setTimeout(r,260));await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('UI frame did not settle within 6000ms')),6000);requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timeout);resolve();}));});});
const capture=async name=>fs.writeFileSync(path.join(config.output,name+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
const measure=async()=>{const data=(await win.webContents.capturePage({x:280,y:110,width:80,height:50},{stayHidden:true,stayAwake:true})).toBitmap();let sum=0,squares=0,count=0;for(let i=0;i<data.length;i+=4){const v=(data[i]+data[i+1]+data[i+2])/3;sum+=v;squares+=v*v;count++;}return Math.sqrt(Math.max(0,squares/count-(sum/count)**2));};
const check=async(fn,...args)=>run(fn,...args);
const paint=async()=>{const frames=()=>run(async()=>{await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Pixel frame did not paint within 6000ms')),6000);requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timeout);resolve();}));});});await frames();await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await frames();};
await ready();const results=[],narrowResults=[],motionResults=[],pixelResults=[];
const materialResults=[];

if(!config.narrowOnly && !config.materialsOnly && !config.refractionOnly){
await win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});win.webContents.debugger.detach();
for(const mode of ['light','dark']){
await win.loadFile(path.join(__dirname,'index.html'));await ready();
await run(mode=>{fixture.setTheme(mode,true);fixture.motionChecks=true;},mode);
await settle();
await run(()=>document.querySelector('#checker').style.visibility='hidden');
await capture('dreamy-theme-'+mode);
await run(()=>document.querySelector('#checker').style.visibility='');
for(const opening of [true,false]){
await run(async opening=>{
 const end=performance.now()+6000;fixture.setParent(opening);
 while(document.querySelector('.modal-overlay')?.dataset.modalPhase!==(opening ? 'open' : 'exiting')){if(performance.now()>end)throw new Error('Pixel fixture phase not ready');await new Promise(r=>setTimeout(r,10));}
 const overlay=document.querySelector('.modal-overlay'),animations=overlay.getAnimations({subtree:true});if(!animations.length)throw new Error('Pixel fixture has no animations');animations.forEach(a=>a.pause());await Promise.all(animations.map(a=>a.ready));fixture.pixelPhase={overlay,animations};
},opening);
// Commit a nonzero paused frame before seeking to an endpoint. Chromium may
// otherwise reuse the pre-pause compositor frame when currentTime is already 0.
await run(()=>fixture.pixelPhase.animations.forEach(a=>a.currentTime=a.effect.getTiming().duration*.5));await paint();
const samples=[];
for(const fraction of [0,.25,.5,.75,1]){
const state=await run(fraction=>{const {overlay,animations}=fixture.pixelPhase;animations.forEach(a=>a.currentTime=a.effect.getTiming().duration*fraction);const style=getComputedStyle(overlay,'::before');return {blur:style.backdropFilter,opacity:getComputedStyle(overlay).opacity,backdropOpacity:style.opacity};},fraction);
await paint();const blurred=await measure();
await run(()=>{const o=fixture.pixelPhase.overlay;o.style.setProperty('--modal-backdrop-filter','blur(0px)');if(parseFloat(getComputedStyle(o,'::before').backdropFilter.replace('blur(','') || '0')>0)throw new Error('Unfiltered pixel baseline did not disable blur');});
await paint();const baseline=await measure();await run(()=>fixture.pixelPhase.overlay.style.removeProperty('--modal-backdrop-filter'));
if(baseline<5)throw new Error('Pixel baseline lacks visible checker contrast '+baseline);
samples.push({fraction,...state,blurredContrast:blurred,baselineContrast:baseline,ratio:blurred/baseline});
if(fraction===.5)await capture('dreamy-blur-mid-'+mode+'-'+(opening ? 'open' : 'close')+(config.hardware ? '-gpu' : '-software'));
}
console.log('DREAMY_BLUR_PIXELS '+JSON.stringify({mode,direction:opening ? 'open' : 'close',samples}));
if(samples.slice(1,-1).some(sample=>sample.ratio>.94))throw new Error('Rendered backdrop snaps instead of blurring at intermediate frames '+JSON.stringify({mode,opening,samples}));
if((opening ? samples.at(-1) : samples[0]).ratio>.2)throw new Error('Rendered backdrop never reaches full blur '+JSON.stringify(samples));
if((opening ? samples[0] : samples.at(-1)).ratio<.98)throw new Error('Rendered backdrop is not clear at its unblurred endpoint '+JSON.stringify(samples));
pixelResults.push({mode,direction:opening ? 'open' : 'close',samples});
await run(async opening=>{fixture.pixelPhase.animations.forEach(a=>a.finish());if(!opening){const end=performance.now()+6000;while(document.querySelector('.modal-overlay')){if(performance.now()>end)throw new Error('Pixel fixture did not close');await new Promise(r=>setTimeout(r,10));}}delete fixture.pixelPhase;},opening);
}
await run(()=>fixture.motionChecks=false);
}
}
if(!config.narrowOnly && !config.pixelsOnly && !config.materialsOnly && !config.refractionOnly){
for(const mode of ['light','dark'])for(const custom of [false,true]){
const probe=await run(async(mode,custom)=>{
 const until=async fn=>{const end=performance.now()+6000;while(!fn()){if(performance.now()>end)throw new Error('Motion state did not settle '+fn);await new Promise(r=>setTimeout(r,10));}};
 fixture.setTheme(mode,true);fixture.motionChecks=true;const shell=document.querySelector('.desktop-shell');
 if(custom){shell.style.setProperty('--modal-enter-duration','320ms');shell.style.setProperty('--modal-exit-duration','280ms');shell.style.setProperty('--modal-enter-easing','linear');shell.style.setProperty('--modal-exit-easing','linear');}
 const phase=async opening=>{
  fixture.setParent(opening);await until(()=>document.querySelector('.modal-overlay')?.dataset.modalPhase===(opening ? 'open' : 'exiting'));
  const overlay=document.querySelector('.modal-overlay'),dialog=overlay.querySelector('.modal'),suffix=opening ? 'in' : 'out',names=['modal-backdrop-'+suffix,'modal-dialog-'+suffix,'modal-backdrop-filter-'+suffix],animations=overlay.getAnimations({subtree:true});
  const chosen=names.map(name=>animations.find(a=>a.animationName===name));if(chosen.some(a=>!a))throw new Error('Missing synchronized animations '+JSON.stringify(animations.map(a=>a.animationName)));
  const timing=chosen.map(a=>a.effect.getTiming()),easing=chosen.map(a=>a.effect.getKeyframes()[0].easing);if(timing.some(t=>t.duration!==timing[0].duration) || easing.some(value=>value!==easing[0]))throw new Error('Backdrop/dialog duration or easing differs '+JSON.stringify({timing,easing}));
  const expectedEasing=custom ? 'linear' : opening ? 'cubic-bezier(0.2, 0.8, 0.2, 1)' : 'ease-in';if(easing[0]!==expectedEasing)throw new Error('Motion easing does not inherit '+easing[0]+'/'+expectedEasing);
  const duration=timing[0].duration,expected=custom ? opening ? 320 : 280 : opening ? 180 : 160;if(duration!==expected)throw new Error('Motion duration does not inherit '+duration+'/'+expected);
  chosen.forEach(a=>a.pause());await Promise.all(chosen.map(a=>a.ready));
  const radius=()=>{const value=getComputedStyle(overlay,'::before').backdropFilter,match=/^blur\(([\d.]+)px\)$/.exec(value);if(!match)throw new Error('Invalid backdrop blur '+value);return Number(match[1]);};
  const samples=[];
  for(const fraction of [0,.25,.5,.75,1]){chosen.forEach(a=>a.currentTime=duration*fraction);const blur=radius();samples.push({fraction,blur});if(fraction>0 && fraction<1 && !(blur>0 && blur<12))throw new Error('Backdrop blur jumps instead of interpolating '+JSON.stringify(samples));}
  for(let i=1;i<samples.length;i++)if(opening ? samples[i].blur<=samples[i-1].blur : samples[i].blur>=samples[i-1].blur)throw new Error('Backdrop blur is not monotonic '+JSON.stringify(samples));
  if(Math.abs(samples[0].blur-(opening ? 0 : 12))>.01 || Math.abs(samples.at(-1).blur-(opening ? 12 : 0))>.01)throw new Error('Incorrect backdrop endpoints '+JSON.stringify(samples));
  if(getComputedStyle(dialog).filter!=='none')throw new Error('Animation blurs dialog content');
  if(!opening && (!overlay.inert || getComputedStyle(overlay).pointerEvents!=='none'))throw new Error('Closing blur layer remains interactive');
  chosen.forEach(a=>a.finish());
  if(!opening)await until(()=>!document.querySelector('.modal-overlay'));
  return {direction:opening ? 'open' : 'close',duration,easing:easing[0],samples};
 };
 const opening=await phase(true),closing=await phase(false);
 for(const name of ['--modal-enter-duration','--modal-exit-duration','--modal-enter-easing','--modal-exit-easing'])shell.style.removeProperty(name);fixture.motionChecks=false;
 return {mode,custom,opening,closing};
},mode,custom);motionResults.push(probe);console.log('DREAMY_MOTION '+JSON.stringify(probe));
}
}
for(const mode of config.narrowOnly || config.motionOnly || config.pixelsOnly || config.materialsOnly || config.refractionOnly ? [] : ['light','dark'])for(const reduce of [false,true]){
await win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduce ? 'reduce' : 'no-preference'}]});win.webContents.debugger.detach();
await run((mode)=>{fixture.setTheme(mode,false);document.querySelector('.fixture-actions button').click();},mode);await settle();const baseline=await measure();
await run(mode=>fixture.setTheme(mode,true),mode);await settle();const blurred=await measure();
if(!(blurred<baseline*.6))throw new Error('Backdrop did not blur checker '+JSON.stringify({mode,reduce,baseline,blurred}));
await check((reduce)=>{const d=document.querySelector('[role=dialog][aria-label="插件详情"]'),o=d.closest('.modal-overlay'),b=getComputedStyle(o,'::before'),style=getComputedStyle(d);if(!b.backdropFilter.includes('12px') || b.pointerEvents!=='none')throw new Error('Missing separate backdrop blur');if(style.filter!=='none' || !style.backdropFilter.includes('url('))throw new Error('Dialog content has a blur layer');if(reduce && o.getAnimations().length)throw new Error('Reduced motion animates the overlay');const box=d.getBoundingClientRect();if(box.left<0 || box.right>innerWidth || box.top<0 || box.bottom>innerHeight)throw new Error('Dialog outside viewport');},reduce);
await capture('dreamy-popup-'+mode+(reduce ? '-reduced' : ''));
await run(()=>[...document.querySelector('[aria-label="插件详情"]').querySelectorAll('button')].find(button=>button.textContent.includes('编辑站点')).click());await settle();
await check(()=>{const p=document.querySelector('[aria-label="插件详情"]'),d=document.querySelector('[aria-label="编辑站点"]'),o=d.closest('.modal-overlay');if(!d.contains(document.activeElement))throw new Error('Nested focus lost');if(getComputedStyle(d).filter!=='none' || !getComputedStyle(d).backdropFilter.includes('url('))throw new Error('Nested content blurred');if(!getComputedStyle(o,'::before').backdropFilter.includes('12px'))throw new Error('Nested backdrop not blurred');const box=d.getBoundingClientRect();if(Math.abs((box.left+box.right)/2-innerWidth/2)>2 || Math.abs((box.top+box.bottom)/2-innerHeight/2)>2)throw new Error('Nested dialog not centered');if(Number(getComputedStyle(o).zIndex)<=Number(getComputedStyle(p.closest('.modal-overlay')).zIndex))throw new Error('Nested layer not on top');});
await capture('dreamy-nested-'+mode+(reduce ? '-reduced' : ''));
win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});await settle();
await check(()=>{if(document.querySelector('[aria-label="编辑站点"]') || !document.querySelector('[aria-label="插件详情"]').contains(document.activeElement))throw new Error('Nested Escape/focus restoration failed');});
const point=await run(()=>{const s=document.querySelector('select[aria-label="请求模式"]'),r=s.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};});win.webContents.sendInputEvent({type:'mouseDown',button:'left',...point});win.webContents.sendInputEvent({type:'mouseUp',button:'left',...point});await settle();
await check(()=>{const s=document.querySelector('select[aria-label="请求模式"]');if(!s.matches(':open'))throw new Error('Native picker not open');if(!getComputedStyle(s,'::picker(select)').backdropFilter.includes('12px'))throw new Error('Native picker lost local glass');});await capture('dreamy-picker-'+mode+(reduce ? '-reduced' : ''));
win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});await settle();
await check(()=>{if(document.querySelector('select[aria-label="请求模式"]').matches(':open') || !document.querySelector('[aria-label="插件详情"]'))throw new Error('Picker Escape closed parent');});
await run(()=>[...document.querySelector('[aria-label="插件详情"]').querySelectorAll('button')].find(button=>button.textContent.includes('关闭详情')).click());await settle();
await run(()=>document.querySelector('.fixture-actions button:nth-child(2)').click());await settle();
await run(()=>document.querySelector('.command-search input').focus());await settle();
await check(()=>{const d=document.querySelector('[aria-label="随时找到你需要的"]'),s=d.querySelector('.command-search'),input=s.querySelector('input');if(getComputedStyle(d).filter!=='none' || getComputedStyle(s).filter!=='none')throw new Error('Search content blurred');if(!getComputedStyle(d.closest('.modal-overlay'),'::before').backdropFilter.includes('12px'))throw new Error('Search backdrop unfiltered');if(!s.matches(':focus-within') || getComputedStyle(input).outlineStyle!=='none' || getComputedStyle(s).boxShadow==='none')throw new Error('Search rounded focus indicator invalid');});await capture('dreamy-search-'+mode+(reduce ? '-reduced' : ''));
win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});await settle();
await run(()=>document.querySelector('.fixture-actions .multi-trigger').click());await settle();
await check(()=>{const p=document.querySelector('.multi-popover');if(!p || getComputedStyle(p).filter!=='none' || !getComputedStyle(p).backdropFilter.includes('12px'))throw new Error('Popover local glass/content invalid');if(p.querySelector('.modal-overlay'))throw new Error('Popover unexpectedly blurs full screen');const r=p.getBoundingClientRect(),a=document.querySelector('.fixture-actions .multi-trigger').getBoundingClientRect();if(r.left<8 || r.top<8 || r.right>innerWidth-7 || r.bottom>innerHeight-7 || Math.abs(r.left-a.left)>2)throw new Error('Popover lost anchor or viewport bounds '+JSON.stringify({left:r.left,top:r.top,anchorLeft:a.left}));});await capture('dreamy-popover-'+mode+(reduce ? '-reduced' : ''));
win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});await settle();
await check(()=>{if(document.querySelector('.multi-popover') || fixture.errors.length)throw new Error('Popover close or renderer errors '+fixture.errors);});results.push({mode,reduce,baselineContrast:baseline,blurredContrast:blurred});
}
await win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});win.webContents.debugger.detach();
win.setContentSize(320,240);
for(const mode of config.motionOnly || config.pixelsOnly || config.materialsOnly || config.refractionOnly ? [] : ['light','dark']){
await run(mode=>{document.documentElement.dataset.fixtureNarrow='true';fixture.setTheme(mode,true);},mode);await settle();
await run(()=>document.querySelector('.fixture-narrow .multi-trigger').click());await settle();
const measurements=await check(()=>{const p=document.querySelector('.multi-popover'),s=p.querySelector('.search-input'),i=s.querySelector('input'),f=p.querySelector('.multi-actions'),b=f.querySelector('.button.primary'),list=p.querySelector('.multi-options'),r=p.getBoundingClientRect(),sr=s.getBoundingClientRect(),ir=i.getBoundingClientRect(),fr=f.getBoundingClientRect(),br=b.getBoundingClientRect();if(Math.abs(innerWidth-320)>2 || Math.abs(innerHeight-240)>2)throw new Error('Unexpected narrow viewport '+JSON.stringify({width:innerWidth,height:innerHeight}));if(r.left<7 || r.top<7 || r.right>innerWidth-7 || r.bottom>innerHeight-7)throw new Error('Narrow popover outside viewport '+JSON.stringify(r));if(Math.abs(sr.height-34)>.5 || ir.left<sr.left || ir.right>sr.right || ir.top<sr.top || ir.bottom>sr.bottom)throw new Error('Narrow search shrank or input overflowed '+JSON.stringify({search:sr,input:ir}));if(!s.matches(':focus-within') || getComputedStyle(i).outlineStyle!=='none' || !getComputedStyle(s).boxShadow.includes('0px 0px 0px 2px') || parseFloat(getComputedStyle(s).borderRadius)<8)throw new Error('Narrow search lost rounded focus '+JSON.stringify({focused:s.matches(':focus-within'),outline:getComputedStyle(i).outlineStyle,shadow:getComputedStyle(s).boxShadow,radius:getComputedStyle(s).borderRadius}));if(fr.top<sr.bottom || fr.bottom>r.bottom || br.bottom>innerHeight-8 || !br.height || list.scrollHeight<=list.clientHeight)throw new Error('Narrow footer hidden or list cannot scroll '+JSON.stringify({panel:r,footer:fr,apply:br,clientHeight:list.clientHeight,scrollHeight:list.scrollHeight}));return {width:innerWidth,height:innerHeight,searchHeight:sr.height,footerBottom:br.bottom,optionsHeight:list.clientHeight};});await capture('dreamy-popover-narrow-'+mode);narrowResults.push({mode,...measurements});
await run(()=>document.querySelector('.multi-actions>button:first-child').click());await settle();
await run(()=>document.querySelector('.multi-options input').click());await settle();
await run(()=>document.querySelector('.multi-actions .button.primary').click());await settle();
await check(()=>{if(document.querySelector('.multi-popover') || !document.querySelector('.fixture-narrow .multi-trigger').textContent.includes('模型 · 1'))throw new Error('Narrow footer apply failed');});
}
await run(()=>delete document.documentElement.dataset.fixtureNarrow);win.setContentSize(1280,900);
await check(()=>{if(fixture.errors.length)throw new Error('Renderer errors '+fixture.errors);});
if(!config.narrowOnly && !config.motionOnly && !config.pixelsOnly && !config.refractionOnly){
for(const mode of ['light','dark']){
// Load a fresh scene so prior popup focus, native pickers and measured hidden sliders
// cannot carry state into material checks.
await win.loadFile(path.join(__dirname,'index.html'));await ready();
await run(mode=>{fixture.setTheme(mode,true);document.documentElement.dataset.fixtureMaterials='true';},mode);await settle();
await run(()=>document.querySelector('.fixture-materials .model-mode-selector button:nth-of-type(2)').click());await settle();
await run(async()=>{const deadline=performance.now()+6000;while(true){const button=document.querySelector('.fixture-materials button[aria-pressed="true"]'),thumb=document.querySelector('.fixture-materials .segmented-thumb'),a=button.getBoundingClientRect(),b=thumb.getBoundingClientRect();if(Math.abs(a.left-b.left)<=1 && Math.abs(a.width-b.width)<=1)break;if(performance.now()>deadline)throw new Error('Glass selection measurement did not settle');await new Promise(resolve=>setTimeout(resolve,30));}});
const selection=await check(()=>{const button=document.querySelector('.fixture-materials button[aria-pressed="true"]'),thumb=document.querySelector('.fixture-materials .segmented-thumb'),style=getComputedStyle(thumb),a=button.getBoundingClientRect(),b=thumb.getBoundingClientRect();if(!style.backdropFilter.includes('url(') || style.zIndex!=='2' || getComputedStyle(thumb,'::after').pointerEvents!=='none')throw new Error('Selection lacks noninteractive glass');if(Math.abs(a.left-b.left)>1 || Math.abs(a.width-b.width)>1 || !button.textContent.includes('Fast'))throw new Error('Glass selection lost measured alignment '+JSON.stringify({button:a,thumb:b,text:button.textContent}));return {background:style.backgroundColor,blur:style.backdropFilter};});
const chart=await run(()=>{const r=document.querySelector('.fixture-materials .recharts-wrapper').getBoundingClientRect();return {x:Math.round(r.left+r.width*.65),y:Math.round(r.top+r.height*.35)};});
win.webContents.sendInputEvent({type:'mouseMove',x:chart.x-30,y:chart.y});await settle();win.webContents.sendInputEvent({type:'mouseMove',...chart});await settle();
const tooltip=await check(()=>{const t=document.querySelector('.fixture-materials .recharts-default-tooltip');if(!t || getComputedStyle(t.closest('.recharts-tooltip-wrapper')).visibility==='hidden')throw new Error('Actual trend hover did not show tooltip');const s=getComputedStyle(t);if(!s.backdropFilter.includes('12px') || s.boxShadow==='none' || !s.backgroundImage.includes('gradient') || !t.textContent.includes('$'))throw new Error('Trend inline style defeated glass or formatted value disappeared');const alpha=Number(s.backgroundColor.match(/,\s*([\d.]+)\)$/)?.[1] || 1);if(alpha>=.9)throw new Error('Trend glass is opaque '+s.backgroundColor);return {background:s.backgroundColor,blur:s.backdropFilter,text:t.textContent};});
await capture('dreamy-materials-'+mode);
const picker=await run(()=>{const s=document.querySelector('.fixture-materials select'),r=s.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};});
win.webContents.sendInputEvent({type:'mouseMove',...picker});win.webContents.sendInputEvent({type:'mouseDown',button:'left',...picker});win.webContents.sendInputEvent({type:'mouseUp',button:'left',...picker});await settle();
await check(()=>{const s=document.querySelector('.fixture-materials select'),p=getComputedStyle(s,'::picker(select)'),option=s.querySelector('option:checked');if(!s.matches(':open') || !p.backdropFilter.includes('12px') || !p.backdropFilter.includes('url(') || !getComputedStyle(option).backgroundImage.includes('gradient'))throw new Error('Native dropdown lacks glass refraction or checked sheen');});
await capture('dreamy-materials-picker-'+mode);
win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});await settle();
materialResults.push({mode,selection,tooltip});
await run(()=>{document.querySelector('.fixture-materials .model-mode-selector button:first-of-type').click();delete document.documentElement.dataset.fixtureMaterials;});await settle();
}
console.log('DREAMY_MATERIALS '+JSON.stringify(materialResults));
}

const refractionResults=[];
const selectionLensResults=[];
if(config.refractionOnly){
await win.loadFile(path.join(__dirname,'index.html'));await ready();
await run(()=>{
fixture.setTheme('light',true);const shell=document.querySelector('.desktop-shell');shell.dataset.appearanceTransparency='clear';shell.dataset.appearanceBlur='off';shell.dataset.appearanceDistortion='off';
const scene=document.createElement('div');scene.id='refraction-scene';scene.style.cssText='position:fixed;left:400px;top:300px;width:260px;height:140px;z-index:900;background:repeating-linear-gradient(90deg,#182233 0 7px,#edf4ff 7px 17px,#438fba 17px 26px)';
const glass=document.createElement('div');glass.className='multi-popover';glass.id='refraction-probe';glass.style.cssText='position:absolute;inset:10px;width:240px;height:120px;max-height:none;padding:0;border:0;border-radius:20px;box-shadow:none;background:transparent';scene.append(glass);shell.append(scene);
});await settle();
const bitmap=async()=>{const image=await win.webContents.capturePage({x:410,y:310,width:240,height:120},{stayHidden:true,stayAwake:true});return {data:Buffer.from(image.toBitmap()),...image.getSize()};};
const settings=await check(()=>{
const shell=document.querySelector('.desktop-shell'),probe=document.querySelector('#refraction-probe');
const alphas=[];for(const option of ['clear','balanced','solid']){shell.dataset.appearanceTransparency=option;const color=getComputedStyle(shell).getPropertyValue('--dream-floating-glass');const swatch=document.createElement('span');swatch.style.backgroundColor=color;shell.append(swatch);const resolved=getComputedStyle(swatch).backgroundColor;swatch.remove();alphas.push(resolved);}
const blurs=[];for(const option of ['off','soft','standard','strong']){shell.dataset.appearanceBlur=option;blurs.push(getComputedStyle(probe).backdropFilter);}
if(!alphas[0].includes('0.46') || !alphas[1].includes('0.72') || alphas[2].includes('rgba'))throw new Error('Transparency presets do not independently change opacity '+alphas);
for(const [i,radius] of [0,2,12,18].entries())if(!blurs[i].includes('blur('+radius+'px)'))throw new Error('Blur preset does not resolve '+JSON.stringify(blurs));
shell.dataset.appearanceTransparency='clear';shell.dataset.appearanceBlur='off';return {alphas,blurs};
});await settle();
const baseline=await bitmap();await capture('dreamy-refraction-off');
for(const option of ['mild','standard','strong']){
await run(option=>document.querySelector('.desktop-shell').dataset.appearanceDistortion=option,option);await settle();await paint();
const filter=await check(()=>{const s=getComputedStyle(document.querySelector('#refraction-probe'));if(!s.backdropFilter.includes('url('))throw new Error('Host did not attach refraction');return s.backdropFilter;});
const current=await bitmap();let edge=0,center=0,edgeCount=0,centerCount=0;
for(let y=0;y<current.height;y++)for(let x=0;x<current.width;x++){const i=(y*current.width+x)*4,px=x/current.width*240,py=y/current.height*120,d=Math.abs(current.data[i]-baseline.data[i])+Math.abs(current.data[i+1]-baseline.data[i+1])+Math.abs(current.data[i+2]-baseline.data[i+2]);if(px<18 || px>=222 || py<18 || py>=102){edge+=d;edgeCount++;}if(px>=50 && px<190 && py>=40 && py<80){center+=d;centerCount++;}}
const measurement={option,filter,edgeDifference:edge/edgeCount,centerDifference:center/centerCount};
if(measurement.edgeDifference<3 || measurement.centerDifference>2)throw new Error('Refraction did not bend the actual background while preserving center '+JSON.stringify(measurement));
refractionResults.push(measurement);await capture('dreamy-refraction-'+option);
}
await run(()=>document.querySelector('.desktop-shell').dataset.appearanceDistortion='off');await settle();
await check(()=>{if(document.querySelector('#refraction-probe').style.getPropertyValue('--lumi-glass-filter') || document.querySelector('[data-lumi-glass-defs] filter'))throw new Error('Disabled refraction leaked filters');});
// Verify real label refraction on the unchanged, untextured marketplace track.
await run(()=>{document.documentElement.dataset.fixtureMaterials='true';document.querySelector('#refraction-scene').remove();const track=document.querySelector('.fixture-materials .model-mode-selector');track.querySelector('button:nth-of-type(2)').click();document.querySelector('.desktop-shell').dataset.appearanceBlur='soft';});await settle();
const labelSamples=[];
for(const mode of ['light','dark']){
await run(mode=>{fixture.setTheme(mode,true);document.querySelector('.desktop-shell').dataset.appearanceDistortion='off';},mode);await settle();
const thumbRect=await run(()=>{const r=document.querySelector('.fixture-materials .segmented-thumb').getBoundingClientRect();return {x:Math.floor(r.x),y:Math.floor(r.y),width:Math.ceil(r.width),height:Math.ceil(r.height)};});
const thumbPixels=async()=>{await paint();return Buffer.from((await win.webContents.capturePage(thumbRect,{stayHidden:true,stayAwake:true})).toBitmap());};
const thumbBaseline=await thumbPixels();await run(()=>document.querySelector('.desktop-shell').dataset.appearanceDistortion='strong');await settle();const thumbDistorted=await thumbPixels();
await check(()=>{const shell=document.querySelector('.desktop-shell'),thumb=document.querySelector('.fixture-materials .segmented-thumb');shell.dataset.appearanceTransparency='solid';if(getComputedStyle(thumb).zIndex!=='0' || getComputedStyle(thumb).backdropFilter!=='none')throw new Error('Opaque glass obscures selection labels');shell.dataset.appearanceTransparency='clear';});
let thumbDifference=0;for(let i=0;i<thumbBaseline.length;i+=4)thumbDifference+=Math.abs(thumbBaseline[i]-thumbDistorted[i])+Math.abs(thumbBaseline[i+1]-thumbDistorted[i+1])+Math.abs(thumbBaseline[i+2]-thumbDistorted[i+2]);thumbDifference/=thumbBaseline.length/4;
if(thumbDifference<2)throw new Error('Actual marketplace thumb did not refract label pixels '+thumbDifference);
await check(()=>{const track=document.querySelector('.fixture-materials .model-mode-selector'),button=track.querySelector('button[aria-pressed="true"]'),thumb=track.querySelector('.segmented-thumb');if(Number(getComputedStyle(thumb).zIndex)<=Number(getComputedStyle(button).zIndex) || getComputedStyle(thumb).pointerEvents!=='none' || getComputedStyle(thumb).backdropFilter.includes('blur(2px)'))throw new Error('Selection lens layering or sharp label contract failed');});
await capture('dreamy-selected-refraction-'+mode);labelSamples.push({mode,thumbDifference});selectionLensResults.push({mode,thumbDifference});
const stops=await run(()=>[...document.querySelectorAll('.fixture-materials .model-mode-selector button')].map(button=>{const r=button.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};}));
win.webContents.sendInputEvent({type:'mouseMove',...stops[0]});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...stops[0]});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...stops[0]});await settle();
await check(()=>{if(!document.querySelector('.fixture-materials .model-mode-selector button:first-of-type').matches('[aria-pressed="true"]'))throw new Error('Lens blocked native selection click');});
win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...stops[0]});await new Promise(resolve=>setTimeout(resolve,30));win.webContents.sendInputEvent({type:'mouseMove',modifiers:['leftButtonDown'],...stops[1]});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...stops[1]});await settle();
await check(()=>{if(!document.querySelector('.fixture-materials .model-mode-selector button:nth-of-type(2)').matches('[aria-pressed="true"]'))throw new Error('Lens blocked native selection drag');});
}
console.log('DREAMY_REFRACTION '+JSON.stringify({settings,samples:refractionResults,labelSamples}));
}
const result={pluginVersion:config.version,hostVersion:config.hostVersion,hardware:config.hardware,refractionScenarios:refractionResults,selectionLensScenarios:selectionLensResults,materialScenarios:materialResults,pixelScenarios:pixelResults,motionScenarios:motionResults,scenarios:results,narrowScenarios:narrowResults};fs.writeFileSync(path.join(config.output,config.refractionOnly ? 'result-refraction-'+(config.hardware ? 'gpu' : 'software')+'.json' : config.materialsOnly ? 'result-materials.json' : config.narrowOnly ? 'result-narrow.json' : config.pixelsOnly ? 'result-pixels-'+(config.hardware ? 'gpu' : 'software')+'.json' : config.motionOnly ? 'result-motion.json' : 'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));win.destroy();app.exit(0);
}).catch(error=>{console.error(error.stack || error);app.exit(1);});
`);
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(electron,[path.join(fixture,'main.cjs'),JSON.stringify(configuration)],{env,windowsHide:true,stdio:'inherit'});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
  if(code!==0)throw new Error('梦幻界面 Chromium 验证失败。');
  console.log('截图及结果：'+output);
}finally{await rm(fixture,{recursive:true,force:true,maxRetries:5,retryDelay:100});}

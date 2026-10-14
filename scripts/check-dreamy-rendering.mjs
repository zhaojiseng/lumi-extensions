import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// This diagnostic uses the selected checkout's real components, CSS scoping,
// popup lifecycle and glass installer. All account data and Electron state are
// synthetic and stay below .cache. It never edits or starts the normal app.
const root=fileURLToPath(new URL('../',import.meta.url));
const host=process.argv[2] && path.resolve(process.argv[2]);
if(!host || !existsSync(path.join(host,'src/host/glass-refraction.ts')))throw new Error('用法：node scripts/check-dreamy-rendering.mjs <Lumi 源码目录> [--baseline | --baseline-ref <Git ref>] [--hardware] [--hidden] [--quick] [--solid-only] [--compare <旧结果目录>] [--runtime <备用 glass-refraction.ts>] [--output <.cache 内目录>]；宿主依赖和 Electron 必须已准备。');
const baseline=process.argv.includes('--baseline') || process.argv.includes('--baseline-ref'),hardware=process.argv.includes('--hardware');
const execFileAsync=promisify(execFile),requireHost=createRequire(path.join(host,'package.json'));
const {build}=requireHost('esbuild'),electron=requireHost('electron');
if(!existsSync(electron))throw new Error('宿主 Electron 尚未准备，请在宿主运行 npm run setup:electron。');
const option=name=>{const at=process.argv.indexOf(name);if(at<0)return undefined;const value=process.argv[at+1];if(!value || value.startsWith('--'))throw new Error(name+' 缺少参数。');return value;};
const runtimePath=option('--runtime') ? path.resolve(option('--runtime')) : path.join(host,'src/host/glass-refraction.ts');
if(!existsSync(runtimePath))throw new Error('--runtime 备用源码不存在。');
const duration=Number(option('--duration-ms') || (process.argv.includes('--quick') ? 650 : hardware ? 6000 : 2200));
if(!Number.isFinite(duration) || duration<500 || duration>15000)throw new Error('--duration-ms 必须为 500–15000。');
const gitIn=(dir,args)=>execFileAsync('git',['-c','safe.directory='+dir.replaceAll('\\','/'),...args],{cwd:dir,encoding:'utf8',windowsHide:true,maxBuffer:1024*1024});
const baselineRef=baseline ? option('--baseline-ref') || 'HEAD' : null;
const baselineRevision=baseline ? (await gitIn(root,['rev-parse','--verify','--end-of-options',baselineRef+'^{commit}'])).stdout.trim() : null;
if(baselineRevision && !/^[a-f0-9]{40,64}$/.test(baselineRevision))throw new Error('基线引用未解析为完整提交 SHA。');
const readThemeFile=async name=>{const file='plugins/extension.author.dreamy/'+name;return baseline ? (await gitIn(root,['show',baselineRevision+':'+file])).stdout : readFile(path.join(root,file),'utf8');};
const [css,manifestText,hostManifestText,runtime]=await Promise.all([readThemeFile('interface.css'),readThemeFile('plugin.json'),readFile(path.join(host,'package.json'),'utf8'),readFile(runtimePath,'utf8')]);
const manifest=JSON.parse(manifestText),hostManifest=JSON.parse(hostManifestText);
const revision=async dir=>(await gitIn(dir,['rev-parse','HEAD'])).stdout.trim();
const [pluginRevision,hostRevision]=await Promise.all([revision(root),revision(host)]);
const sha=value=>createHash('sha256').update(value).digest('hex');
const probeSha256=sha(await readFile(fileURLToPath(import.meta.url)));
const output=option('--output') ? path.resolve(option('--output')) : path.join(root,'.cache/dreamy-rendering'+(baseline ? '-baseline' : '')+(hardware ? '-gpu' : '-software'));
const outputRelative=path.relative(path.join(root,'.cache'),output);
if(!outputRelative || outputRelative.startsWith('..') || path.isAbsolute(outputRelative))throw new Error('--output 必须为本插件仓库 .cache 内的独立目录。');
const compare=option('--compare') ? path.resolve(option('--compare')) : baseline ? null : path.join(root,'.cache/dreamy-rendering-baseline'+(hardware ? '-gpu' : '-software'));
await mkdir(output,{recursive:true});
await writeFile(path.join(output,'interface.css'),css);
await writeFile(path.join(output,'plugin.json'),manifestText);
const fixture=await mkdtemp(path.join(output,'fixture-'));
const fixtureRelative=path.relative(output,fixture);
if(!fixtureRelative || fixtureRelative.startsWith('..') || path.isAbsolute(fixtureRelative))throw new Error('隔离夹具必须位于输出目录内。');
const config={output,compare,baseline,baselineRef,baselineRevision,themeSource:baseline ? 'git-commit' : 'working-tree',themeSourceRevision:baselineRevision || pluginRevision,hardware,duration,hidden:process.argv.includes('--hidden'),solidOnly:process.argv.includes('--solid-only'),pluginVersion:manifest.version,manifestSha256:sha(manifestText),hostVersion:hostManifest.version,pluginRevision,hostRevision,cssSha256:sha(css),runtimePath,runtimeSha256:sha(runtime),probeSha256,alternateRuntime:!!option('--runtime'),failOnMissing:process.argv.includes('--fail-on-missing')};
try{
  // Newer hosts replace their static preview-script module with a bundled
  // sandbox runtime. Older matching hosts need no adapter; code stays host-owned.
  const previewBuilder=path.join(host,'scripts/appearance-preview-build.ts');
  const hostBuildPlugins=existsSync(previewBuilder) ? [(await import(pathToFileURL(previewBuilder).href)).appearancePreviewEsbuildPlugin(host)] : [];
  const built=await build({stdin:{resolveDir:host,loader:'tsx',contents:`
import React,{useState,useEffect} from 'react';import {createRoot} from 'react-dom/client';
import {Modal,Button,SegmentedSwitch,Select} from './src/components/ui';
import {PopupLayer} from './src/components/Popup';
import {ModalPresence} from './src/components/ModalPresence';import {MultiSelect} from './src/components/StatisticsFilter';
import {ModelCardFrame} from './src/components/ModelCardFrame';import {defaultInterfaceLayout} from './plugins/interface.default/layout';
import {scopedInterfaceSheet} from './src/host/interface';import {installGlassRefraction} from './src/host/glass-refraction';
const css=${JSON.stringify(css)},id=${JSON.stringify(manifest.id)};
window.fixture={errors:[],setTheme:mode=>{const shell=document.querySelector('.desktop-shell');shell.dataset.theme=mode;document.documentElement.dataset.theme=mode;shell.style.colorScheme=mode;},reset:()=>{fixture.setPopup(false);fixture.setSolidPopup(false);document.querySelector('.desktop-shell').dataset.appearanceTransparency='clear';document.querySelectorAll('[data-scroll-root]').forEach(element=>element.scrollTop=0);fixture.setTab(0);}};
const base=new CSSStyleSheet();base.replaceSync(defaultInterfaceLayout);document.adoptedStyleSheets=[base,scopedInterfaceSheet({id,css})];
addEventListener('error',event=>fixture.errors.push(event.message));addEventListener('unhandledrejection',event=>fixture.errors.push(String(event.reason)));
function Card({index,prefix}){return <div className="diagnostic-stripes"><ModelCardFrame name={prefix+'-'+String(index+1).padStart(2,'0')} vendor="OpenAI" className="diagnostic-card"><p>输入 128K · 输出 12K</p><p>净速率 48 token/s · 本地模拟</p></ModelCardFrame></div>}
function App(){const [tab,setTab]=useState(0),[popup,setPopup]=useState(false),[solidPopup,setSolidPopup]=useState(false),[choice,setChoice]=useState('one'),[models,setModels]=useState([]);fixture.setTab=setTab;fixture.setPopup=setPopup;fixture.setSolidPopup=setSolidPopup;
useEffect(()=>installGlassRefraction(document.querySelector('.desktop-shell')),[]);
return <div className="desktop-shell platform-win32" data-interface={id} data-theme="light" data-appearance-transparency="clear" data-appearance-blur="soft" data-appearance-distortion="strong">
<header className="titlebar">浮梦 · 渲染诊断（隔离数据）</header><aside className="sidebar"><h2>浮梦</h2><div className="sidebar-navigation"><button className="nav-item active">工作台</button><button className="nav-item">模型广场</button></div><p>夹具不连接网络或账户。</p></aside>
<main className="main-area"><div className="content-scroll" data-scroll-root="workspace"><div className="content-container">
<h1>真实组件与多层滚动</h1><div className="diagnostic-actions"><Button onClick={()=>setPopup(true)}>打开弹窗</Button><MultiSelect label="模型" value={models} onApply={setModels} options={Array.from({length:18},(_,i)=>({value:'model-'+i,label:'模拟模型 '+(i+1)}))}/><Select label="原生下拉选项" value={choice} onChange={setChoice}><option value="one">普通</option><option value="two">Fast</option><option value="three">长上下文</option></Select></div>
<section className="diagnostic-controls">{['page-tabs','metric-tabs','settings-subnav','preview-file-tabs','local-session-tabs','market-kinds'].map(name=><SegmentedSwitch key={name} label={name} className={name}>{['概览','详情','高级'].map((label,index)=><button key={label} className={tab===index ? 'active' : ''} aria-pressed={tab===index} onClick={()=>setTab(index)}>{label}</button>)}</SegmentedSwitch>)}<div className="diagnostic-stripes"><button className="model-choice selected diagnostic-choice">允许模型</button><button className="favorite-filter active diagnostic-choice">收藏</button></div></section>
<div className="diagnostic-columns">{['left','right'].map(prefix=><section className="diagnostic-column" key={prefix}><h2>{prefix==='left' ? '模型列表' : '历史模型'}</h2><div className="diagnostic-nested-scroll" data-scroll-root={prefix}>{Array.from({length:54},(_,index)=><Card key={index} index={index} prefix={prefix}/>)}</div></section>)}</div>
<h2>页面滚动列表</h2><div className="diagnostic-page-cards">{Array.from({length:48},(_,index)=><Card key={index} index={index} prefix="workspace"/>)}</div>
</div></div></main><ModalPresence>{popup && <Modal title="真实弹窗" subtitle="模糊背景与独立扭曲" portal onClose={()=>setPopup(false)}><div className="diagnostic-stripes diagnostic-popup-stripes"><SegmentedSwitch label="弹窗内选项">{['概览','详情','高级'].map((label,index)=><button key={label} aria-pressed={tab===index} onClick={()=>setTab(index)}>{label}</button>)}</SegmentedSwitch><Select label="弹窗请求模式" value={choice} onChange={setChoice}><option value="one">普通</option><option value="two">Fast</option><option value="three">长上下文</option></Select><div className="diagnostic-popup-scroll" data-scroll-root="popup">{Array.from({length:18},(_,index)=><article className="surface panel" key={index}><h3>弹窗子容器 {index+1}</h3><p>正文始终保持清晰。</p></article>)}</div></div><div className="modal-actions"><Button onClick={()=>setPopup(false)}>关闭</Button></div></Modal>}</ModalPresence>{solidPopup && <PopupLayer kind="popover" label="固定位点不透明多选诊断" className="multi-popover diagnostic-solid-popover" closeOnScroll={false} closeOnResize={false} dismissOutside={false} onClose={()=>setSolidPopup(false)} style={{top:205,left:440,width:430,maxHeight:440}}><div className="multi-heading"><strong>固定位点多选</strong><span>背景滚动</span></div><div className="search-input"><input aria-label="固定位点多选搜索" placeholder="搜索本地模型"/></div><div className="multi-options">{Array.from({length:18},(_,index)=><label key={index}><input type="checkbox" defaultChecked={index===2}/><span className="multi-check">✓</span><span>模拟模型 {index+1}</span></label>)}</div><div className="multi-actions"><span>隔离渲染诊断</span><Button onClick={()=>setSolidPopup(false)}>关闭</Button></div></PopupLayer>}</div>;
}
createRoot(document.getElementById('root')).render(<App/>);
`},bundle:true,platform:'browser',format:'esm',target:'chrome140',write:false,loader:{'.css':'empty','.svg':'text'},define:{'process.env.NODE_ENV':'"production"'},plugins:[...hostBuildPlugins,...option('--runtime') ? [{name:'diagnostic-alternate-glass-runtime',setup(builder){builder.onLoad({filter:/[\\/]src[\\/]host[\\/]glass-refraction\.ts$/},async()=>({contents:runtime,loader:'ts',resolveDir:path.dirname(runtimePath)}));}}] : []],logLevel:'silent'});
  await writeFile(path.join(fixture,'app.js'),built.outputFiles[0].contents);
  const files=['components/segmented-switch.css','styles.css','workbench.css','select.css','theme-tokens.css','theme.css','updates-trends.css','filters-tools-motion.css','platform-logs.css','models-market.css'];
  const styles=await Promise.all(files.map(name=>readFile(path.join(host,'src',name),'utf8')));
  await writeFile(path.join(fixture,'style.css'),styles.join('\n')+String.raw`
html,body{margin:0;height:100%;overflow:hidden}.desktop-shell{height:100vh}.diagnostic-actions{display:flex;align-items:center;gap:12px;margin:16px 0}.diagnostic-actions>.select-wrap{width:200px}.diagnostic-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}.diagnostic-controls>.diagnostic-stripes{grid-column:1/-1;display:flex;gap:18px;padding:10px}.diagnostic-choice{position:relative;width:160px;min-height:42px}.diagnostic-columns{display:grid;grid-template-columns:1fr 1fr;gap:20px}.diagnostic-column h2{font-size:14px;margin:8px 0}.diagnostic-nested-scroll{height:390px;overflow:auto;border-radius:16px;overscroll-behavior:contain}.diagnostic-stripes{background:repeating-linear-gradient(113deg,#183047 0 9px,#bfd5df 9px 22px,#40577c 22px 34px);padding:10px;border-radius:18px}.diagnostic-nested-scroll>.diagnostic-stripes{margin-bottom:10px}.diagnostic-card{min-height:126px;box-sizing:border-box;padding:16px!important}.diagnostic-card p{font-size:12px;line-height:1.5;margin:6px 0}.diagnostic-page-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.diagnostic-popup-stripes{padding:16px}.diagnostic-popup-stripes>.select-wrap{width:230px;margin:16px 0}.diagnostic-popup-scroll{height:310px;overflow:auto;overscroll-behavior:contain}.diagnostic-popup-scroll>.surface.panel{min-height:90px;margin:12px 0;padding:16px;border-radius:16px}.diagnostic-popup-scroll h3{font-size:14px}.diagnostic-popup-scroll p{font-size:12px}@keyframes diagnostic-opacity-entry{from{opacity:0}to{opacity:1}}
`);
  await writeFile(path.join(fixture,'index.html'),'<html data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"></head><body><div id="root"></div><script type="module" src="app.js"></script></body></html>');
  await writeFile(path.join(fixture,'main.cjs'),String.raw`
const {app,BrowserWindow,contentTracing,nativeImage}=require('electron'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const config=JSON.parse(process.argv[2]);
for(const name of ['userData','sessionData','logs','crashDumps']){const dir=path.join(__dirname,name);fs.mkdirSync(dir,{recursive:true});app.setPath(name,dir);}if(!config.hardware)app.disableHardwareAcceleration();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
const win=new BrowserWindow({width:1320,height:980,useContentSize:true,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:!config.hardware}});
if(config.hardware && !config.hidden)win.showInactive();
const run=async(fn,...args)=>{const result=await win.webContents.executeJavaScript('(async()=>{try{return {ok:true,value:await ('+fn.toString()+')(...'+JSON.stringify(args)+')}}catch(error){return {ok:false,error:error.stack||String(error)}}})()');if(!result.ok)throw new Error(result.error);return result.value;};
await win.loadFile(path.join(__dirname,'index.html'));await run(async()=>{const end=performance.now()+8000;while(!document.querySelector('.diagnostic-card')){if(performance.now()>end)throw Error('Rendering fixture not ready '+fixture.errors);await new Promise(r=>setTimeout(r,20));}});
win.webContents.debugger.attach('1.3');
await win.webContents.debugger.sendCommand('Performance.enable',{timeDomain:'timeTicks'});
await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled',{enabled:true});
await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'},{name:'prefers-reduced-transparency',value:'no-preference'},{name:'forced-colors',value:'none'}]});
const settle=async()=>{await delay(300);await run(async()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Compositor frame timeout')),7000);requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timer);resolve();}));}));};
const paint=async()=>{await settle();await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await settle();};
await settle();
await run(()=>{
  const mutations={filters:0,references:0,dom:0};fixture.mutations=mutations;
  const observer=new MutationObserver(records=>{for(const record of records){if(record.target instanceof Element && (record.target.closest('[data-lumi-glass-defs]') || record.target.matches('[data-lumi-glass-defs]')))mutations.filters++;else if(record.type==='attributes' && record.attributeName==='style' && record.target.getAttribute('style')?.includes('--lumi-glass-filter'))mutations.references++;else mutations.dom++;}});
  observer.observe(document.querySelector('.desktop-shell'),{subtree:true,attributes:true,childList:true});fixture.mutationObserver=observer;
  fixture.snapshot=()=>{
    const root=document.querySelector('.desktop-shell'),all=[...root.querySelectorAll('.sidebar,.content-scroll,.segmented-thumb,.model-choice.selected,.favorite-filter.active,.model-card,.surface.panel:not(.modal),.stat-card,.tool-config-card,.token-overview-card,.model-toolbar,.statistics-filter,.welcome-hero,.modal,.multi-popover,[data-popup-kind="popover"],.toast,.select-wrap select,[data-lumi-glass]')];
    const clipped=element=>{if(!element.getClientRects().length)return false;const r=element.getBoundingClientRect();let x=Math.max(0,r.left),y=Math.max(0,r.top),right=Math.min(innerWidth,r.right),bottom=Math.min(innerHeight,r.bottom);for(let p=element;p;p=p.parentElement){const s=getComputedStyle(p);if(s.visibility!=='visible' || Number(s.opacity)===0)return false;if(p!==element){const a=p.getBoundingClientRect();if(['hidden','clip','auto','scroll'].includes(s.overflowX)){x=Math.max(x,a.left);right=Math.min(right,a.right);}if(['hidden','clip','auto','scroll'].includes(s.overflowY)){y=Math.max(y,a.top);bottom=Math.min(bottom,a.bottom);}}}return right>x && bottom>y;};
    const rows=all.map((element,index)=>{
      const picker=element instanceof HTMLSelectElement,style=getComputedStyle(element),before=getComputedStyle(element,'::before'),ref=element.style.getPropertyValue('--lumi-glass-filter'),visible=picker ? element.matches(':open') : clipped(element),pseudo=picker ? '::picker(select)' : before.content!=='none' && before.backdropFilter!=='none' ? '::before' : null;
      const optical=getComputedStyle(element,pseudo),filter=optical.backdropFilter,match=/url\("?#([^\s"\)]+)/.exec(ref),exists=!!(match && document.getElementById(match[1])),usesUrl=filter.includes('url('),expected=root.dataset.appearanceTransparency!=='solid' && visible && filter!=='none' && (picker || element.matches('.segmented-thumb,.model-choice.selected,.favorite-filter.active,.sidebar,.content-scroll,.model-card,.modal,.multi-popover,[data-popup-kind="popover"],.surface.panel,.stat-card,.tool-config-card,.token-overview-card,.model-toolbar,.statistics-filter,.welcome-hero') || element.hasAttribute('data-lumi-glass'));
      return {index,className:element.className,label:element.getAttribute('aria-label') || element.querySelector('h3')?.textContent || '',visible,pseudo,filter,inlineReference:ref,filterExists:exists,expected,missing:expected && (!usesUrl || !exists),offscreenReference:!visible && !!match,rect:element.getBoundingClientRect().toJSON(),blur:optical.backdropFilter,foregroundFilter:style.filter};
    });
    return {filterDefinitions:root.querySelectorAll('[data-lumi-glass-defs] filter').length,totalCandidates:rows.length,visibleCandidates:rows.filter(row=>row.visible).length,visibleReferences:rows.filter(row=>row.visible && row.filterExists).length,missing:rows.filter(row=>row.missing),offscreenReferences:rows.filter(row=>row.offscreenReference),foregroundFilters:rows.filter(row=>row.foregroundFilter!=='none'),rows,scrollRoots:[...document.querySelectorAll('[data-scroll-root]')].map(element=>({name:element.dataset.scrollRoot,scrollTop:element.scrollTop,clientHeight:element.clientHeight,scrollHeight:element.scrollHeight})),mutations:{...fixture.mutations}};
  };
});
const snapshots=[],pixels=[],comparisons=[],workloads=[],entranceAnimations=[];
let comparisonMetadata;const oldResult=config.compare && path.join(config.compare,'result.json');
if(oldResult && fs.existsSync(oldResult)){const previous=JSON.parse(fs.readFileSync(oldResult,'utf8'));comparisonMetadata={output:config.compare,pluginVersion:previous.pluginVersion,hostVersion:previous.hostVersion,baselineRevision:previous.baselineRevision,themeSourceRevision:previous.themeSourceRevision,cssSha256:previous.cssSha256,runtimeSha256:previous.runtimeSha256,sameRuntime:previous.runtimeSha256===config.runtimeSha256,sameCss:previous.cssSha256===config.cssSha256,sameHardwareMode:previous.hardware===config.hardware,sameDuration:previous.duration===config.duration};}
const capture=async name=>{
  const current=await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true}),filename=name+'.png';fs.writeFileSync(path.join(config.output,filename),current.toPNG());
  const previous=config.compare && path.join(config.compare,filename);if(previous && fs.existsSync(previous)){
    const old=nativeImage.createFromPath(previous),a=current.toBitmap(),b=old.toBitmap(),size=current.getSize();
    if(a.length===b.length && size.width===old.getSize().width && size.height===old.getSize().height){let sum=0,changed=0,max=0;const diff=Buffer.alloc(a.length);for(let i=0;i<a.length;i+=4){let d=0;for(let channel=0;channel<3;channel++){const value=Math.abs(a[i+channel]-b[i+channel]);sum+=value;d+=value;max=Math.max(max,value);diff[i+channel]=Math.min(255,value*4);}diff[i+3]=255;if(d)changed++;}const measurement={screenshot:filename,baseline:previous,pixels:a.length/4,changedPixels:changed,changedPercent:100*changed/(a.length/4),meanChannelDifference:sum/(a.length/4*3),maximumChannelDifference:max};comparisons.push(measurement);fs.writeFileSync(path.join(config.output,name+'-difference.png'),nativeImage.createFromBitmap(diff,size).toPNG());}
    else comparisons.push({screenshot:filename,error:'截图尺寸不同，无法逐像素比较。'});
  }
  return filename;
};
const snapshot=async name=>{const data=await run(()=>fixture.snapshot());snapshots.push({name,...data});return data;};
const crop=async rect=>{const r={x:Math.max(0,Math.ceil(rect.x)),y:Math.max(0,Math.ceil(rect.y)),width:Math.max(1,Math.min(Math.floor(rect.width),1320-Math.ceil(rect.x))),height:Math.max(1,Math.min(Math.floor(rect.height),980-Math.ceil(rect.y)))};return {image:await win.webContents.capturePage(r,{stayHidden:true,stayAwake:true}),rect:r};};
// Pixel pairs change only the distortion option. Blur, tint, sheen and label
// state stay identical; a computed url alone cannot prove visible refraction.
const pixelProbe=async(name,selector)=>{
  await run(()=>document.querySelector('.desktop-shell').dataset.appearanceDistortion='off');await paint();
  const geometry=await run(selector=>{const element=document.querySelector(selector);if(!element)throw Error('Missing pixel target '+selector);let r=element.getBoundingClientRect(),pseudo=null;if(element instanceof HTMLSelectElement){const rects=[...element.options].map(option=>option.getBoundingClientRect()).filter(rect=>rect.width && rect.height),style=getComputedStyle(element,'::picker(select)'),padX=(parseFloat(style.paddingLeft)||0)+(parseFloat(style.borderLeftWidth)||0),padY=(parseFloat(style.paddingTop)||0)+(parseFloat(style.borderTopWidth)||0);if(!element.matches(':open') || !rects.length)return null;r=new DOMRect(Math.min(...rects.map(rect=>rect.left))-padX,Math.min(...rects.map(rect=>rect.top))-padY,Math.max(...rects.map(rect=>rect.right))-Math.min(...rects.map(rect=>rect.left))+2*padX,Math.min(Math.max(...rects.map(rect=>rect.bottom))-Math.min(...rects.map(rect=>rect.top))+2*padY,parseFloat(style.maxHeight)||Infinity));pseudo='::picker(select)';}else if(getComputedStyle(element,'::before').content!=='none')pseudo='::before';if(r.width<8 || r.height<8 || r.left<0 || r.top<0 || r.right>innerWidth || r.bottom>innerHeight)return null;return {rect:r.toJSON(),radius:parseFloat(getComputedStyle(element,pseudo).borderTopLeftRadius)||0};},selector);
  if(!geometry){pixels.push({name,selector,skipped:'目标未完整位于视口内。'});await run(()=>document.querySelector('.desktop-shell').dataset.appearanceDistortion='strong');await settle();return;}
  const clear=await crop(geometry.rect),a=clear.image.toBitmap();
  await run(()=>document.querySelector('.desktop-shell').dataset.appearanceDistortion='strong');await paint();
  const distorted=await crop(geometry.rect),b=distorted.image.toBitmap(),size=distorted.image.getSize();
  const computed=await run(selector=>{const element=document.querySelector(selector),before=getComputedStyle(element,'::before'),pseudo=element instanceof HTMLSelectElement ? '::picker(select)' : before.content!=='none' && before.backdropFilter!=='none' ? '::before' : null;return {pseudo,filter:getComputedStyle(element,pseudo).backdropFilter,inlineReference:element.style.getPropertyValue('--lumi-glass-filter')};},selector);
  let edge=0,center=0,edgeCount=0,centerCount=0,changed=0,detail=0;const diff=Buffer.alloc(a.length);
  for(let y=0;y<size.height;y++)for(let x=0;x<size.width;x++){const i=(y*size.width+x)*4;let d=0;for(let channel=0;channel<3;channel++){const value=Math.abs(a[i+channel]-b[i+channel]);d+=value;diff[i+channel]=Math.min(255,value*4);}diff[i+3]=255;if(d)changed++;const boundary=Math.min(x,y,size.width-1-x,size.height-1-y);if(boundary<Math.min(18,size.width/4,size.height/4)){edge+=d;edgeCount++;}else{center+=d;centerCount++;}if(x>0)for(let c=0;c<3;c++)detail+=Math.abs(a[i+c]-a[i+c-4]);}
  const measurement={name,selector,...computed,rect:clear.rect,edgeMeanRgbDifference:edge/Math.max(1,edgeCount),centerMeanRgbDifference:center/Math.max(1,centerCount),changedPixels:changed,backgroundDetail:detail/(size.width*size.height),pixels:size.width*size.height,renderedRefraction:changed>0 && edge/Math.max(1,edgeCount)>.05};
  pixels.push(measurement);fs.writeFileSync(path.join(config.output,name+'-off.png'),clear.image.toPNG());fs.writeFileSync(path.join(config.output,name+'-strong.png'),distorted.image.toPNG());fs.writeFileSync(path.join(config.output,name+'-distortion-difference.png'),nativeImage.createFromBitmap(diff,size).toPNG());return measurement;
};
const probeEntrance=async mode=>{
  await run(async()=>{
    fixture.reset();const scene=document.createElement('div');scene.id='diagnostic-entry-scene';scene.className='diagnostic-stripes';scene.style.cssText='position:fixed;left:470px;top:470px;width:280px;height:130px;z-index:900';
    const panel=document.createElement('article');panel.id='diagnostic-entry';panel.className='surface panel';panel.innerHTML='<h3>从 opacity 0 开始的容器</h3><p>动画途中必须及时得到背景扭曲。</p>';panel.style.cssText='width:260px;height:110px;padding:14px;border-radius:16px;animation:diagnostic-opacity-entry 1000ms linear both';scene.append(panel);document.querySelector('.desktop-shell').append(scene);
    const animation=panel.getAnimations()[0];if(!animation)throw Error('Opacity entrance has no real CSS animation');animation.pause();await animation.ready;animation.currentTime=0;fixture.entranceAnimation=animation;
  });await settle();
  const samples=[];for(const currentTime of [0,100,500,900]){
    await run(time=>fixture.entranceAnimation.currentTime=time,currentTime);await settle();
    const row=await run(()=>{const element=document.querySelector('#diagnostic-entry'),style=getComputedStyle(element,'::before');return {opacity:Number(getComputedStyle(element).opacity),inlineReference:element.style.getPropertyValue('--lumi-glass-filter'),filter:style.backdropFilter,hasRefraction:style.backdropFilter.includes('url(')};});samples.push({currentTime,...row});
    if(currentTime===500)await capture(mode+'-opacity-entry-mid');
  }
  await run(()=>fixture.entranceAnimation.finish());await settle();
  const final=await run(()=>{const element=document.querySelector('#diagnostic-entry');return {opacity:Number(getComputedStyle(element).opacity),inlineReference:element.style.getPropertyValue('--lumi-glass-filter'),filter:getComputedStyle(element,'::before').backdropFilter};});
  entranceAnimations.push({mode,samples,final,visibleIntermediateMissing:samples.some(sample=>sample.opacity>0 && !sample.hasRefraction),note:'暂停同一个真实 CSS opacity 动画以重现初始帧为 0 的边界；只推进 currentTime，不触发额外 DOM/style 变化来替宿主补更新。'});
  await run(()=>{document.querySelector('#diagnostic-entry-scene').remove();delete fixture.entranceAnimation;});await settle();
};
const performanceMetrics=async()=>Object.fromEntries((await win.webContents.debugger.sendCommand('Performance.getMetrics')).metrics.map(metric=>[metric.name,metric.value]));
const summarizeTrace=trace=>{
  const events=trace.traceEvents || [],threads=new Map(),byName=new Map();for(const e of events){if(e.ph==='M' && e.name==='thread_name')threads.set(e.pid+':'+e.tid,e.args?.name);if(e.ph==='X' && e.dur && /Paint|Raster|Composite|DrawFrame|Commit|Layout|UpdateLayer|PrePaint|BeginMainThreadFrame|RunTask|GPUTask|GpuTask|SubmitCompositorFrame/.test(e.name)){const key=e.name,value=byName.get(key)||{name:key,count:0,cpuDurationMs:0,threadNames:new Set()};value.count++;value.cpuDurationMs+=e.dur/1000;value.threadNames.add(threads.get(e.pid+':'+e.tid)||String(e.tid));byName.set(key,value);}}
  return {events:events.length,slices:[...byName.values()].map(value=>({...value,threadNames:[...value.threadNames]})).sort((a,b)=>b.cpuDurationMs-a.cpuDurationMs),gpuHardwareDurationMs:null,gpuTimeExplanation:'Chromium trace 的 GPU/Viz/GpuTask 时长是 CPU 提交与调度时间；此诊断无法读取 GPU 硬件执行时间或 GPU 使用率，不将其冒充 GPU 占用。',overlapNote:'嵌套与跨线程 slice 有重叠，不能相加作为总帧时间。'};
};
// Windows WDDM counters are actual engine-utilization observations. Restrict
// their output to this isolated Electron's GPU PID; never collect other apps'
// process data. Separate physical engines are reported separately.
const startGpuSampler=async()=>{
  if(!config.hardware)return {stop:async()=>({available:false,reason:'软件合成模式不采样硬件 GPU。'})};
  if(process.platform!=='win32')return {stop:async()=>({available:false,reason:'当前脚本的 GPU Engine counter 采样仅支持 Windows。'})};
  if(config.duration<3000)return {stop:async()=>({available:false,reason:'采样区间少于 3 秒；--quick 只用于功能冒烟，不能作为 GPU 性能测量。'})};
  const pid=app.getAppMetrics().find(item=>item.type==='GPU')?.pid;
  if(!Number.isSafeInteger(pid) || pid<1)return {stop:async()=>({available:false,reason:'Electron 未提供隔离 GPU 进程 PID。'})};
  const command="$ErrorActionPreference='Stop';try{Get-Counter -Counter '\\GPU Engine(pid_"+pid+"_*)\\Utilization Percentage','\\GPU Engine(pid_"+pid+"_*)\\Running Time' -SampleInterval 1 -MaxSamples 30 | ForEach-Object { $batch=$_; $samples=@($batch.CounterSamples | Where-Object {$_.InstanceName -match '^pid_"+pid+"_'} | ForEach-Object { [PSCustomObject]@{instance=$_.InstanceName;path=$_.Path;value=$_.CookedValue;rawValue=$_.RawValue.ToString();timeBase=$_.TimeBase;counterType=$_.CounterType.ToString()} }); [PSCustomObject]@{timestamp=$batch.Timestamp.ToUniversalTime().ToString('o');samples=$samples} | ConvertTo-Json -Depth 4 -Compress }}catch{[PSCustomObject]@{error=$_.Exception.Message}|ConvertTo-Json -Compress;exit 1}";
  const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,stdio:['ignore','pipe','pipe']}),batches=[];let pending='',error='',closed=false,resolveReady;
  const ready=new Promise(resolve=>resolveReady=resolve),done=new Promise(resolve=>child.once('close',()=>{closed=true;resolve();resolveReady();}));
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stderr.on('data',value=>error+=value);
  child.on('error',value=>{error=String(value);resolveReady();});child.stdout.on('data',value=>{pending+=value;let end;while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end).trim();pending=pending.slice(end+1);if(!line)continue;try{const batch=JSON.parse(line);if(batch.error)error=batch.error;else batches.push(batch);}catch(value){error=String(value);}resolveReady();}});
  await Promise.race([ready,delay(6000)]);if(batches.length)await delay(1000);
  return {stop:async(start,end)=>{
    if(!closed)child.kill();await Promise.race([done,delay(1000)]);
    if(!batches.length)return {available:false,pid,reason:error || 'GPU Engine counter 超时或没有可读样本。'};
    const during=batches.filter(batch=>Date.parse(batch.timestamp)>=start && Date.parse(batch.timestamp)<=end),groups=new Map();
    for(const batch of during)for(const sample of batch.samples || [])if(sample.path.toLowerCase().endsWith('utilization percentage')){
      const match=/_luid_(.+?)_phys_(\d+)_eng_(\d+)_engtype_(.+)$/.exec(sample.instance),key=match ? match.slice(1).join(':') : sample.instance;
      let group=groups.get(key);if(!group){group={engine:key,adapterLuid:match?.[1],physicalAdapter:match ? Number(match[2]) : null,engineIndex:match ? Number(match[3]) : null,engineType:match?.[4],values:[]};groups.set(key,group);}group.values.push({timestamp:batch.timestamp,percent:sample.value});
    }
    const engines=[...groups.values()].map(group=>({...group,sampleCount:group.values.length,meanPercent:group.values.reduce((sum,row)=>sum+row.percent,0)/group.values.length,maximumPercent:Math.max(...group.values.map(row=>row.percent))}));
    const runtime=[];const perInstance=new Map();for(const batch of batches)for(const sample of batch.samples || [])if(sample.path.toLowerCase().endsWith('running time')){let rows=perInstance.get(sample.instance);if(!rows){rows=[];perInstance.set(sample.instance,rows);}rows.push({timestamp:batch.timestamp,...sample});}
    for(const [instance,rows] of perInstance){const before=rows.filter(row=>Date.parse(row.timestamp)<=start).at(-1),last=rows.filter(row=>Date.parse(row.timestamp)<=end).at(-1);if(before && last)runtime.push({instance,start:before.timestamp,end:last.timestamp,rawRuntimeDelta:(BigInt(last.rawValue)-BigInt(before.rawValue)).toString(),timeBase:last.timeBase,counterType:last.counterType,unit:'Windows counter 原始单位；不在未验证单位时换算为 GPU 毫秒。'});}
    return {available:engines.length>0,validForComparison:during.length>=3 && engines.some(engine=>engine.sampleCount>=3),pid,sampleIntervalMs:1000,warmupMs:1000,measurementStart:new Date(start).toISOString(),measurementEnd:new Date(end).toISOString(),samples:during.length,engines,runtime,reason:engines.length ? during.length<3 ? '少于 3 个有效样本，不足以比较 GPU 占用幅度。' : undefined : error || '目标 GPU PID 在测量窗口无硬件引擎样本。',notes:['利用率是目标 GPU 进程的 WDDM 物理引擎 counter，和 CPU/trace 时间分开。','不同物理引擎可能同时执行；不把各引擎百分比相加作为整块 GPU 占用。','原始 Running Time 数值保留 counter metadata，不用不确定单位宣称 GPU 执行毫秒。']};
  }};
};
const measureWorkload=async(mode,name)=>{
  await run(()=>fixture.reset());await settle();
  if(name==='solid-popover-scroll'){await run(()=>{document.querySelector('.desktop-shell').dataset.appearanceTransparency='solid';fixture.setSolidPopup(true);});await settle();await snapshot(mode+'-solid-popover');await capture(mode+'-solid-popover');}
  await run(()=>{for(const key of Object.keys(fixture.mutations))fixture.mutations[key]=0;});
  const gpuSampler=await startGpuSampler();
  const state=async()=>({...await run(()=>({devicePixelRatio,innerWidth,innerHeight,visibilityState:document.visibilityState,documentHidden:document.hidden})),visible:win.isVisible(),minimized:win.isMinimized(),offscreen:win.webContents.isOffscreen()});
  const windowStart=await state();
  const before=await performanceMetrics(),processBefore=app.getAppMetrics();
  const tracePath=path.join(config.output,mode+'-'+name+'-trace.json');
  await contentTracing.startRecording({included_categories:['devtools.timeline','blink','cc','viz','gpu','toplevel'],excluded_categories:['*']});
  const measurementStart=Date.now();
  const timeline=await run(async(name,duration)=>{
    const start=performance.now(),frames=[],longTasks=[];let previous=start,count=0;
    const observer=new PerformanceObserver(list=>{longTasks.push(...list.getEntries().map(entry=>({startTime:entry.startTime,duration:entry.duration})));});observer.observe({type:'longtask',buffered:false});
    if(name==='idle')await new Promise(resolve=>setTimeout(resolve,duration));
    else await new Promise(resolve=>{const step=now=>{frames.push(now-previous);previous=now;count++;const elapsed=now-start;if(name==='scroll' || name==='solid-popover-scroll'){for(const [index,element] of [...document.querySelectorAll('[data-scroll-root]')].entries())element.scrollTop=(Math.sin(elapsed/450+index)*.5+.5)*Math.min(1600,element.scrollHeight-element.clientHeight);}else if(name==='switching' && count%4===0)document.querySelectorAll('.diagnostic-controls .segmented-switch')[Math.floor(count/4)%6]?.querySelectorAll('button')[Math.floor(count/4)%3]?.click();if(elapsed<duration)requestAnimationFrame(step);else resolve();};requestAnimationFrame(step);});
    observer.disconnect();const sorted=[...frames].sort((a,b)=>a-b),at=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))] ?? null;return {wallMs:performance.now()-start,frames:frames.length,frameIntervalMedianMs:at(.5),frameIntervalP95Ms:at(.95),framesOver33Ms:frames.filter(value=>value>33.34).length,longTasks,mutations:{...fixture.mutations}};
  },name,config.duration);
  const measurementEnd=Date.now(),windowEnd=await state();
  await contentTracing.stopRecording(tracePath);
  const after=await performanceMetrics(),processAfter=app.getAppMetrics(),delta={};for(const key of ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount','JSHeapUsedSize','Nodes'])if(Number.isFinite(after[key]) && Number.isFinite(before[key]))delta[key]=after[key]-before[key];
  const gpuCounters=await gpuSampler.stop(measurementStart,measurementEnd);
  const validityReasons=[];
  if(config.hardware && (!windowStart.visible || !windowEnd.visible || windowStart.minimized || windowEnd.minimized || windowStart.documentHidden || windowEnd.documentHidden))validityReasons.push('硬件性能窗口隐藏或最小化。');
  if(name!=='idle' && (timeline.frames<config.duration/50 || timeline.frameIntervalMedianMs>50))validityReasons.push('持续操作 rAF 被节流或帧样本不足，不能和前台工作负载比较。');
  const workloadValid={valid:validityReasons.length===0,reasons:validityReasons,windowStart,windowEnd};
  if(gpuCounters.available && validityReasons.length){gpuCounters.validForComparison=false;gpuCounters.workloadInvalidReason=validityReasons.join(' ');}
  if(name==='solid-popover-scroll'){await run(()=>document.querySelectorAll('[data-scroll-root]').forEach((element,index)=>element.scrollTop=Math.min((index+1)*275,element.scrollHeight-element.clientHeight)));await settle();await snapshot(mode+'-solid-popover-after-scroll');await capture(mode+'-solid-popover-after-scroll');await run(()=>fixture.reset());await settle();}
  const trace=summarizeTrace(JSON.parse(fs.readFileSync(tracePath,'utf8')));
  const row={mode,name,durationMs:config.duration,...timeline,workloadValid,cdpDelta:delta,gpuCounters,processCpu:processAfter.map(item=>({type:item.type,pid:item.pid,cpuPercent:item.cpu?.percentCPUUsage,cumulativeCpuUsage:item.cpu?.cumulativeCPUUsage,previousCumulativeCpuUsage:processBefore.find(previous=>previous.pid===item.pid)?.cpu?.cumulativeCPUUsage})),trace:tracePath,traceSummary:trace};workloads.push(row);
  console.log('DREAMY_RENDER_WORKLOAD '+JSON.stringify({mode,name,wallMs:timeline.wallMs,frames:timeline.frames,frameIntervalMedianMs:timeline.frameIntervalMedianMs,frameIntervalP95Ms:timeline.frameIntervalP95Ms,mutations:timeline.mutations,cdpDelta:delta,gpuCounters:{available:gpuCounters.available,validForComparison:gpuCounters.validForComparison,reason:gpuCounters.reason,samples:gpuCounters.samples,engines:gpuCounters.engines?.map(engine=>({engine:engine.engine,meanPercent:engine.meanPercent,maximumPercent:engine.maximumPercent,sampleCount:engine.sampleCount}))},traceSlices:trace.slices.filter(slice=>['Document::UpdateStyleAndLayout','LocalFrameView::UpdateStyleAndLayout','DirectRenderer::DrawFrame','Paint','RasterTask'].includes(slice.name))}));
};
for(const mode of ['light','dark']){
  await run(mode=>{fixture.reset();fixture.setTheme(mode);},mode);await settle();
  if(config.solidOnly){await measureWorkload(mode,'solid-popover-scroll');continue;}
  await snapshot(mode+'-workspace-top');await capture(mode+'-workspace-top');
  await pixelProbe(mode+'-model-card','.diagnostic-nested-scroll .model-card');
  await pixelProbe(mode+'-selection-lens','.diagnostic-controls .segmented-thumb');
  await pixelProbe(mode+'-selected-model','.diagnostic-choice.model-choice');
  await run(()=>document.querySelectorAll('.diagnostic-nested-scroll').forEach((element,index)=>element.scrollTop=index ? 900 : 1400));await settle();
  await snapshot(mode+'-nested-scroll');await capture(mode+'-nested-scroll');
  await run(()=>{document.querySelector('[data-scroll-root="workspace"]').scrollTop=650;});await settle();await snapshot(mode+'-workspace-scroll');await capture(mode+'-workspace-scroll');
  await run(()=>{fixture.reset();fixture.setPopup(true);});await settle();await snapshot(mode+'-popup');await capture(mode+'-popup');
  await pixelProbe(mode+'-popup-lens','.modal .segmented-thumb');
  await run(()=>document.querySelector('[data-scroll-root="popup"]').scrollTop=800);await settle();await snapshot(mode+'-popup-scroll');await capture(mode+'-popup-scroll');
  await run(()=>fixture.setPopup(false));await settle();
  await run(()=>document.querySelector('.diagnostic-actions .multi-trigger').click());await settle();await snapshot(mode+'-multi-popover');await capture(mode+'-multi-popover');
  await pixelProbe(mode+'-multi-popover','.multi-popover');
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});await settle();
  const point=await run(()=>{fixture.reset();const r=document.querySelector('select[aria-label="原生下拉选项"]').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};});await settle();
  win.webContents.sendInputEvent({type:'mouseMove',...point});win.webContents.sendInputEvent({type:'mouseDown',button:'left',...point});win.webContents.sendInputEvent({type:'mouseUp',button:'left',...point});await settle();
  const pickerOpen=await run(()=>document.querySelector('select[aria-label="原生下拉选项"]').matches(':open'));await snapshot(mode+'-native-picker');await capture(mode+'-native-picker');
  if(!pickerOpen)throw Error('原生下拉未打开，不能将该场景记为已验证。');
  await pixelProbe(mode+'-native-picker','select[aria-label="原生下拉选项"]');
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});await settle();
  await probeEntrance(mode);
  for(const name of ['idle','scroll','switching','solid-popover-scroll'])await measureWorkload(mode,name);
}
await run(()=>fixture.reset());await settle();
const errors=await run(()=>fixture.errors);if(errors.length)throw Error('Fixture runtime errors '+JSON.stringify(errors));
let gpuInfo,gpuInfoComplete;try{gpuInfo=await app.getGPUInfo('basic');}catch(error){gpuInfo={error:String(error)};}
try{gpuInfoComplete=await Promise.race([app.getGPUInfo('complete'),delay(8000).then(()=>({error:'complete GPUInfo 请求 8 秒内未返回。'}))]);}catch(error){gpuInfoComplete={error:String(error)};}
const gpuProcess=app.getAppMetrics().find(item=>item.type==='GPU');
const windowState=await run(()=>({devicePixelRatio,innerWidth,innerHeight,visibilityState:document.visibilityState,documentHidden:document.hidden}));
if(comparisonMetadata){const previous=JSON.parse(fs.readFileSync(oldResult,'utf8'));comparisonMetadata.sameProbe=previous.probeSha256===config.probeSha256;comparisonMetadata.sameViewport=previous.windowState?.innerWidth===windowState.innerWidth && previous.windowState?.innerHeight===windowState.innerHeight;comparisonMetadata.sameDpr=previous.windowState?.devicePixelRatio===windowState.devicePixelRatio;comparisonMetadata.sameWindowState=previous.windowState?.visible===win.isVisible() && previous.windowState?.minimized===win.isMinimized() && previous.windowState?.offscreen===win.webContents.isOffscreen();comparisonMetadata.performanceComparable=comparisonMetadata.sameProbe && comparisonMetadata.sameViewport && comparisonMetadata.sameDpr && comparisonMetadata.sameWindowState && comparisonMetadata.sameHardwareMode && comparisonMetadata.sameDuration;comparisonMetadata.note='截图差异是诊断输出，未设置像素门禁；算法/样式有意变化可单独比较，性能参数一致仅表示测量条件可比，不证明统计显著。';}
const result={...config,generatedAt:new Date().toISOString(),electron:process.versions.electron,chromium:process.versions.chrome,windowState:{...windowState,visible:win.isVisible(),minimized:win.isMinimized(),offscreen:win.webContents.isOffscreen(),contentBounds:win.getContentBounds()},gpuFeatureStatus:app.getGPUFeatureStatus(),gpuInfo,gpuInfoComplete,gpuProcess,snapshots,pixels,comparisons,comparisonMetadata,entranceAnimations,workloads,limitations:['夹具复用真实组件和宿主链路，页面数据为本地模拟；不等同于完整用户账户场景。','--baseline 固定 HEAD 插件 CSS，宿主 runtime 使用指定 checkout 当前源码；比较时必须核对 runtimeSha256。','关闭扭曲的像素对照保留模糊、色调和亮边。零像素差也可能由平坦或已经模糊的背景造成，应结合背景细节与截图判读。','Performance / trace / app metrics 测量的是 CPU 与帧调度开销；GPU 进程 CPU 百分比不代表 GPU 使用率。Windows GPU counters 单独报告真实物理引擎利用率。','此脚本未测量 GPU 显存占用，不根据 filter 数量或纹理尺寸虚构显存下降。','录制 trace 增加测量开销；A/B 必须使用相同硬件/软件模式、窗口大小、持续时间和宿主 runtime。']};
fs.writeFileSync(path.join(config.output,'result.json'),JSON.stringify(result,null,2)+'\n');
console.log('DREAMY_RENDER_SUMMARY '+JSON.stringify({output:config.output,baseline:config.baseline,hardware:config.hardware,missing:snapshots.map(row=>({name:row.name,missing:row.missing.length,offscreenReferences:row.offscreenReferences.length,filterDefinitions:row.filterDefinitions})),pixels:pixels.map(row=>({name:row.name,renderedRefraction:row.renderedRefraction,edgeMeanRgbDifference:row.edgeMeanRgbDifference})),entranceAnimations,comparisons}));
const missing=snapshots.some(row=>row.missing.length) || entranceAnimations.some(row=>row.visibleIntermediateMissing);win.webContents.debugger.detach();win.destroy();app.exit(config.failOnMissing && missing ? 2 : 0);
}).catch(error=>{console.error(error.stack || error);app.exit(1);});
`);
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(electron,[path.join(fixture,'main.cjs'),JSON.stringify(config)],{env,windowsHide:true,stdio:'inherit'});
  const timeout=setTimeout(()=>child.kill(),240000);timeout.unref();
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});clearTimeout(timeout);
  if(code!==0)throw new Error('梦幻渲染诊断失败，退出码 '+code+'；已有截图和 trace 保留于 '+output);
  console.log('截图、差异、原始 trace 及 JSON：'+output);
}finally{await rm(fixture,{recursive:true,force:true,maxRetries:5,retryDelay:100});}

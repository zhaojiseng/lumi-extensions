import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),host=path.resolve(process.argv[2] || '../main');
process.chdir(host);
const requireHost=createRequire(path.join(host,'package.json'));
const {build}=requireHost('esbuild');
const previewAdapter=path.join(host,'scripts/appearance-preview-build.ts');
const previewPlugins=existsSync(previewAdapter) ? [(await import(pathToFileURL(previewAdapter))).appearancePreviewEsbuildPlugin(host)] : [];

test('Dreamy real marketplace keeps headings and cards sharp with iframe previews',{timeout:90000},async t=>{
  const electron=requireHost('electron');if(!existsSync(electron))throw new Error('请先在宿主运行 npm run setup:electron。');
  await mkdir('.test-data',{recursive:true});const directory=await mkdtemp(path.resolve('.test-data/market-ui-'));t.after(()=>rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100}));
  const packages=await Promise.all(['extension.author.dreamy','extension.lumi.compact','extension.lumi.notes'].map(async id=>{
    const directory=path.join(root,'plugins',id),manifest=JSON.parse(await readFile(path.join(directory,'plugin.json'),'utf8'));
    return {manifest:{permissions:[],networkOrigins:[],contributions:[],...manifest},sourceUrl:'https://github.com/zhaojiseng/lumi-extensions',preview:manifest.interface ? {id,css:await readFile(path.join(directory,manifest.interface.stylesheet),'utf8'),appearanceGroups:manifest.interface.appearanceGroups} : undefined};
  }));
  const dreamyCss=packages[0].preview.css;
  const script=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {createRoot} from 'react-dom/client';import {DEFAULT_PREFERENCES} from './shared/types';import {builtinManifests} from './plugins/manifests';import {extensionStatus} from './shared/contracts/extensions';
window.fixture={errors:[],catalog:{revision:'${'1'.repeat(40)}',fetchedAt:Date.now(),plugins:${JSON.stringify(packages)},diagnostics:[]},installed:[],failRead:true,failInstall:false,storage:{note:'keep'},listeners:new Set()};
addEventListener('error',event=>fixture.errors.push(event.message));addEventListener('unhandledrejection',event=>fixture.errors.push(String(event.reason)));
const prefs=structuredClone(DEFAULT_PREFERENCES),stub=()=>()=>{},inventory=()=>({directory:'fixture',plugins:structuredClone(fixture.installed),diagnostics:[]}),statuses=()=>[...builtinManifests.map(manifest=>({manifest,state:['provider.newapi','provider.codex','surface.widget'].includes(manifest.id) ? 'disabled' : 'active'})),...fixture.installed.map(pkg=>({...extensionStatus(pkg.manifest,pkg.enabled,1),origin:'external'}))];
window.lumi={bootstrap:async()=>({preferences:prefs,desktop:true,platform:'win32',version:'fixture',configs:[],secureStorage:true}),inspectConfigs:async()=>[],listPlugins:async()=>statuses(),extensionInventory:async()=>inventory(),reloadExtensions:async()=>inventory(),extensionMarket:async()=>{if(fixture.failRead){fixture.failRead=false;throw new Error('fixture market offline');}return structuredClone(fixture.catalog);},installExtension:async input=>{if(fixture.failInstall)throw new Error('fixture install failure');if(input.revision!==fixture.catalog.revision)throw new Error('stale revision');const item=fixture.catalog.plugins.find(pkg=>pkg.manifest.id===input.id);fixture.installed=fixture.installed.filter(pkg=>pkg.manifest.id!==input.id).concat({manifest:structuredClone(item.manifest),digest:'fixture',removable:true,enabled:false});return inventory();},removeExtension:async id=>{fixture.installed=fixture.installed.filter(pkg=>pkg.manifest.id!==id);return inventory();},setPluginEnabled:async(id,enabled)=>{fixture.installed.find(pkg=>pkg.manifest.id===id).enabled=enabled;return statuses();},syncSurfaceTheme:async()=>{},onNavigate:stub,onRefresh:stub,onWidgetVisibility:stub,onUpdate:stub,onReviewUpdate:stub,onToolRuntime:stub,onConfigProgress:stub,onAppLog:stub,updateStatus:async()=>({phase:'unsupported',currentVersion:'fixture'}),appCache:async()=>({categories:[],totalBytes:0,browserBytes:0,updateBytes:0,protectedBytes:0,warnings:[],scannedAt:Date.now()}),windowControl:async()=>{},openExternal:async url=>{fixture.opened=url;}};
const {default:App}=await import('./src/App');createRoot(document.getElementById('root')).render(<App/>);
const {scopedInterfaceSheet}=await import('./src/host/interface');const {installGlassRefraction}=await import('./src/host/glass-refraction');const {defaultInterfaceLayout}=await import('./plugins/interface.default/layout');
fixture.applyGlass=(mode,blur)=>{const shell=document.querySelector('.desktop-shell');shell.dataset.interface='extension.author.dreamy';shell.dataset.theme=mode;shell.dataset.appearanceBlur=blur;shell.dataset.appearanceDistortion='strong';shell.dataset.appearanceTransparency='clear';document.documentElement.dataset.theme=mode;shell.style.colorScheme=mode;const layout=new CSSStyleSheet();layout.replaceSync(defaultInterfaceLayout);document.adoptedStyleSheets=[layout,scopedInterfaceSheet({id:'extension.author.dreamy',css:${JSON.stringify(dreamyCss)}})];};
fixture.installGlass=()=>installGlassRefraction(document.querySelector('.desktop-shell'));`},plugins:previewPlugins,bundle:true,platform:'browser',format:'esm',write:false,loader:{'.css':'empty','.svg':'text'},define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
  await writeFile(path.join(directory,'app.js'),script.outputFiles[0].contents);
  const styles=await Promise.all(['components/segmented-switch.css','styles.css','workbench.css','select.css','theme-tokens.css','theme.css','updates-trends.css','filters-tools-motion.css','platform-logs.css','app-cache.css','host/extension-market.css'].map(file=>readFile(path.resolve('src',file),'utf8')));await writeFile(path.join(directory,'style.css'),styles.join('\n')+'\n*{animation:none!important;transition:none!important}');
  await writeFile(path.join(directory,'index.html'),'<html><head><meta charset="UTF-8"><link rel="stylesheet" href="style.css"></head><body><div id="root"></div><script type="module" src="app.js"></script></body></html>');
  await writeFile(path.join(directory,'main.cjs'),String.raw`
const {app,BrowserWindow,nativeImage}=require('electron'),path=require('node:path'),fs=require('node:fs');for(const name of ['userData','sessionData','logs','crashDumps']){const dir=path.join(__dirname,name);fs.mkdirSync(dir,{recursive:true});app.setPath(name,dir);}if(!process.argv.includes('--hardware'))app.disableHardwareAcceleration();app.whenReady().then(async()=>{
const win=new BrowserWindow({width:1280,height:720,useContentSize:true,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:!process.argv.includes('--hardware')}});await win.loadFile(path.join(__dirname,'index.html'));
await win.webContents.executeJavaScript('('+async function(){
const until=async fn=>{const end=performance.now()+6000;while(!fn()){if(performance.now()>end)throw new Error('Market UI timeout: '+fn+' '+fixture.errors);await new Promise(r=>setTimeout(r,15));}};
await until(()=>document.querySelector('.desktop-shell'));document.dispatchEvent(new KeyboardEvent('keydown',{key:',',ctrlKey:true,bubbles:true}));await until(()=>document.querySelector('.settings-page') && document.querySelector('[aria-label="余额提醒阈值"]'));
const settings=document.querySelector('.settings-page'),threshold=document.querySelector('[aria-label="余额提醒阈值"]'),scroll=document.querySelector('.content-scroll');
Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(threshold,'123.4');threshold.dispatchEvent(new Event('input',{bubbles:true}));scroll.scrollTop=80;
const open=()=>[...document.querySelectorAll('.plugin-settings-overview>.section-heading button')].find(button=>button.textContent.includes('插件市场')).click();open();await until(()=>document.querySelector('.extension-market [role=alert]'));
document.querySelector('.extension-market [role=alert] button').click();await until(()=>document.querySelectorAll('.market-item').length===3);
await until(()=>document.querySelectorAll('.extension-market .theme-preview iframe').length===2);fixture.installGlass();return {};
}.toString()+')()');
const output=${JSON.stringify(path.join(root,'.cache/dreamy-market-ui'))};fs.mkdirSync(output,{recursive:true});
const run=async(fn,...args)=>win.webContents.executeJavaScript('('+fn.toString()+')(...'+JSON.stringify(args)+')');
const settle=async()=>{await new Promise(r=>setTimeout(r,300));await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await run(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
const textSnapshot=()=>run(()=>({
 viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
 scrollTop:document.querySelector('.extension-market').scrollTop,
 headings:[...document.querySelectorAll('.extension-market h2,.extension-market h3')].map((n,index)=>{
  const range=document.createRange();range.selectNodeContents(n);
  const ink=range.getBoundingClientRect(),box=n.getBoundingClientRect(),dialog=n.closest('.modal').getBoundingClientRect(),style=getComputedStyle(n);
  // The text range excludes unused heading width; paired captures below remove
  // visible background detail even inside the glyph rectangle and its holes.
  const x=Math.floor(ink.x)-1,y=Math.floor(ink.y)-1,right=Math.ceil(ink.right)+1,bottom=Math.ceil(ink.bottom)+1;
  return {index,text:n.textContent,weight:Number(style.fontWeight),font:style.font,fontSize:parseFloat(style.fontSize),color:style.color,filter:style.filter,visible:box.y>=dialog.y && box.bottom<=dialog.bottom && x>=0 && y>=0 && right<=innerWidth && bottom<=innerHeight,rect:{x,y,width:right-x,height:bottom-y}};
 }).filter(heading=>heading.visible)
}));
const sharpness=async(snapshot)=>{
 const current=await textSnapshot();
 if(JSON.stringify(current)!==JSON.stringify(snapshot))throw Error('Marketplace text geometry or viewport changed between paired captures');
 const capture=async()=>nativeImage.createFromBuffer((await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG()).resize({width:snapshot.viewport.width,height:snapshot.viewport.height});
 const full=await capture();let withoutInk;
 await run(()=>{const sheet=document.createElement('style');sheet.id='market-foreground-probe';sheet.textContent='.extension-market h2,.extension-market h3{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}';document.head.append(sheet);});
 try{await settle();withoutInk=await capture();}
 finally{await run(()=>document.getElementById('market-foreground-probe')?.remove());await settle();}
 const restored=await textSnapshot();if(JSON.stringify(restored)!==JSON.stringify(snapshot))throw Error('Marketplace foreground probe changed text layout or scroll');
 return snapshot.headings.map(heading=>{
  const image=full.crop(heading.rect),a=image.toBitmap(),b=withoutInk.crop(heading.rect).toBitmap(),width=image.getSize().width,height=image.getSize().height,difference=new Float64Array(a.length/4);let inkPixels=0,contrast=0,edge=0;
  for(let i=0;i<a.length;i+=4){const value=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;difference[i/4]=value;contrast+=value;if(value>12)inkPixels++;}
  for(let i=0;i<difference.length;i++){if(i%width)edge+=Math.abs(difference[i]-difference[i-1]);if(i>=width)edge+=Math.abs(difference[i]-difference[i-width]);}
  // The production heading uses weight 550. The paired snapshot comparison
  // verifies its font/style against the no-backdrop baseline without inventing
  // a heavier product font requirement; pixels still prove visible sharp ink.
  if(!heading.text.trim() || !Number.isFinite(heading.weight) || heading.weight<=0 || heading.fontSize<12 || heading.filter!=='none' || inkPixels<30 || contrast/Math.max(1,inkPixels)<16)throw Error('Marketplace heading missing, weak or foreground-filtered '+JSON.stringify({heading,inkPixels,contrast}));
  return {index:heading.index,text:heading.text,rect:heading.rect,edge:edge/(width*height),inkPixels,contrastPerInk:contrast/inkPixels};
 });
};
const scenarios=[];
for(const mode of ['light','dark'])for(const blur of ['soft','strong'])for(const scroll of ['top','bottom']){
 await run((mode,blur,scroll)=>{fixture.applyGlass(mode,blur);const dialog=document.querySelector('.extension-market');dialog.scrollTop=scroll==='top' ? 0 : dialog.scrollHeight;},mode,blur,scroll);await settle();
 const snapshot=await textSnapshot(),filtered=await sharpness(snapshot);fs.writeFileSync(path.join(output,mode+'-'+blur+'-'+scroll+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 await run(()=>{const sheet=new CSSStyleSheet();sheet.replaceSync('.modal-overlay::before,.modal{backdrop-filter:none!important}');document.adoptedStyleSheets.push(sheet);});await settle();const reference=await sharpness(snapshot);
 const ratios=filtered.map((v,i)=>v.edge/reference[i].edge);if(!ratios.length || reference.some(v=>v.edge<1) || ratios.some(v=>v<.8))throw new Error('Marketplace text blurred '+JSON.stringify({mode,blur,scroll,filtered,reference,ratios}));
 const scrollTop=await run(()=>document.querySelector('.extension-market').scrollTop);
 if(scroll==='bottom' && scrollTop<=0)throw new Error('Scroll scenario did not scroll');
 scenarios.push({mode,blur,scroll,scrollTop,ratios,foreground:{filtered,reference}});
}
await run(()=>{document.querySelector('[data-market-plugin="extension.author.dreamy"] .text-link').click();});await settle();
if(!await run(()=>document.querySelector('.market-detail') && !fixture.errors.length))throw new Error('Marketplace detail or renderer failed');
fs.writeFileSync(path.join(output,'result'+(process.argv.includes('--hardware') ? '-gpu' : '-software')+'.json'),JSON.stringify(scenarios,null,2));
console.log('MARKET_RESULT '+JSON.stringify(scenarios));win.destroy();app.exit(0);}).catch(error=>{console.error(error.stack || error);app.exit(1);});`);
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const child=spawn(electron,[path.join(directory,'main.cjs'),...(process.argv.includes('--hardware') ? ['--hardware'] : [])],{env,windowsHide:true,stdio:['ignore','pipe','pipe'],signal:t.signal});let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});assert.equal(code,0,stderr+stdout);assert.match(stdout,/MARKET_RESULT/);console.log(stdout.trim());
});

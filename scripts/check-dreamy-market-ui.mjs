import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {spawn} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),host=path.resolve(process.argv[2] || '../main');
process.chdir(host);
const requireHost=createRequire(path.join(host,'package.json'));
const {build}=requireHost('esbuild');

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
fixture.installGlass=()=>installGlassRefraction(document.querySelector('.desktop-shell'));`},bundle:true,platform:'browser',format:'esm',write:false,loader:{'.css':'empty','.svg':'text'},define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
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
const sharpness=async()=>{
 const rects=await run(()=>[...document.querySelectorAll('.extension-market h2,.extension-market h3')].map(n=>{const r=n.getBoundingClientRect(),d=n.closest('.modal').getBoundingClientRect();return {x:Math.ceil(r.x),y:Math.ceil(r.y),width:Math.floor(r.width),height:Math.floor(r.height),visible:r.y>=d.y && r.bottom<=d.bottom};}).filter(r=>r.visible));
 // Measure crops from the full rendered frame, normalized to CSS pixels for DPI.
 const viewport=await run(()=>({width:innerWidth,height:innerHeight}));const full=nativeImage.createFromBuffer((await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG()).resize(viewport);const values=[];for(const rect of rects){delete rect.visible;const img=full.crop(rect),bitmap=img.toBitmap(),width=img.getSize().width;let edge=0;for(let i=4;i<bitmap.length;i+=4){if((i/4)%width===0)continue;edge+=Math.abs(bitmap[i]-bitmap[i-4])+Math.abs(bitmap[i+1]-bitmap[i-3])+Math.abs(bitmap[i+2]-bitmap[i-2]);}values.push(edge/(bitmap.length/4));}return values;
};
const scenarios=[];
for(const mode of ['light','dark'])for(const blur of ['soft','strong'])for(const scroll of ['top','bottom']){
 await run((mode,blur,scroll)=>{fixture.applyGlass(mode,blur);const dialog=document.querySelector('.extension-market');dialog.scrollTop=scroll==='top' ? 0 : dialog.scrollHeight;},mode,blur,scroll);await settle();
 const filtered=await sharpness();fs.writeFileSync(path.join(output,mode+'-'+blur+'-'+scroll+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 await run(()=>{const sheet=new CSSStyleSheet();sheet.replaceSync('.modal-overlay::before,.modal{backdrop-filter:none!important}');document.adoptedStyleSheets.push(sheet);});await settle();const reference=await sharpness();
 const ratios=filtered.map((v,i)=>v/reference[i]);if(!ratios.length || reference.some(v=>v<1) || ratios.some(v=>v<.8))throw new Error('Marketplace text blurred '+JSON.stringify({mode,blur,scroll,filtered,reference,ratios}));
 const scrollTop=await run(()=>document.querySelector('.extension-market').scrollTop);
 if(scroll==='bottom' && scrollTop<=0)throw new Error('Scroll scenario did not scroll');
 scenarios.push({mode,blur,scroll,scrollTop,ratios});
}
await run(()=>{document.querySelector('[data-market-plugin="extension.author.dreamy"] .text-link').click();});await settle();
if(!await run(()=>document.querySelector('.market-detail') && !fixture.errors.length))throw new Error('Marketplace detail or renderer failed');
fs.writeFileSync(path.join(output,'result'+(process.argv.includes('--hardware') ? '-gpu' : '-software')+'.json'),JSON.stringify(scenarios,null,2));
console.log('MARKET_RESULT '+JSON.stringify(scenarios));win.destroy();app.exit(0);}).catch(error=>{console.error(error.stack || error);app.exit(1);});`);
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const child=spawn(electron,[path.join(directory,'main.cjs'),...(process.argv.includes('--hardware') ? ['--hardware'] : [])],{env,windowsHide:true,stdio:['ignore','pipe','pipe'],signal:t.signal});let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});assert.equal(code,0,stderr+stdout);assert.match(stdout,/MARKET_RESULT/);console.log(stdout.trim());
});

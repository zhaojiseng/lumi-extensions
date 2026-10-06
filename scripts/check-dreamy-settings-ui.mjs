import {mkdir,mkdtemp,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'..'),host=path.resolve(process.argv[2] || '../main'),hardware=process.argv.includes('--hardware');
const requireHost=createRequire(path.join(host,'package.json')),{build}=requireHost('esbuild'),electron=requireHost('electron');
const output=path.join(root,'.cache/dreamy-settings-ui');await mkdir(output,{recursive:true});
const directory=await mkdtemp(path.join(output,'fixture-'));
try {
  const skinSource=await readFile(path.join(root,'plugins/extension.author.dreamy/interface.css'),'utf8');
  const skin=process.argv.includes('--without-fix') ? skinSource.replace(/\/\* The glass belongs[\s\S]*?(?=\/\* Mask the light)/,'') : skinSource;
  const {extensionSdkRuntime,extensionUiCss}=await import(pathToFileURL(path.join(host,'scripts/extension-ui.mjs')));
  await cp(path.join(root,'plugins/extension.lumi.codex'),path.join(directory,'plugin'),{recursive:true});
  await writeFile(path.join(directory,'plugin/lumi-sdk.js'),await extensionSdkRuntime(host));
  await writeFile(path.join(directory,'plugin/lumi-ui.css'),await extensionUiCss(host));
  await writeFile(path.join(directory,'style.css'),(await Promise.all(['theme-tokens.css','styles.css','workbench.css','select.css','theme.css','filters-tools-motion.css','platform-logs.css','host/extension-layout.css'].map(file=>readFile(path.join(host,'src',file),'utf8')))).join('\n')+'\nbody{min-width:0}.desktop-shell{height:100vh;display:block;padding:0}.fixture-background{position:absolute;inset:0;padding:30px;overflow:hidden;font:18px/2 monospace}.fixture-background p{margin:12px 0}');
  const renderer=await build({stdin:{resolveDir:host,loader:'tsx',contents:`
import React,{useState,useEffect} from 'react';import {createRoot} from 'react-dom/client';
import {Modal} from './src/components/ui';import {scopedInterfaceSheet} from './src/host/interface';import {installGlassRefraction} from './src/host/glass-refraction';
const css=${JSON.stringify(skin)},nonce='settings-fixture';
window.fixture={errors:[],theme:{id:'extension.author.dreamy',css,appearance:{transparency:'clear',blur:'soft',distortion:'strong'},theme:'dark'}};
addEventListener('error',e=>fixture.errors.push(e.message));addEventListener('unhandledrejection',e=>fixture.errors.push(String(e.reason)));
document.adoptedStyleSheets=[scopedInterfaceSheet(fixture.theme)];
const shell=document.querySelector('.desktop-shell');fixture.dispose=installGlassRefraction(shell);
fixture.apply=(mode,blur)=>{fixture.theme={...fixture.theme,theme:mode,appearance:{...fixture.theme.appearance,blur}};shell.dataset.theme=mode;shell.dataset.appearanceBlur=blur;document.documentElement.dataset.theme=mode;shell.style.colorScheme=mode;document.querySelector('iframe')?.contentWindow.postMessage({protocol:'lumi-extension/1',nonce,type:'ui-theme',uiTheme:fixture.theme},'*');};
function Host(){const [open,setOpen]=useState(true),[height,setHeight]=useState(240);fixture.open=()=>setOpen(true);
useEffect(()=>{const receive=e=>{if(e.source!==document.querySelector('iframe')?.contentWindow || e.data?.protocol!=='lumi-extension/1')return;if(e.data.type==='ready')e.source.postMessage({protocol:'lumi-extension/1',nonce,type:'init',context:{theme:fixture.theme.theme},view:{id:'settings',slot:'settingsTab'},uiTheme:fixture.theme},'*');else if(e.data.type==='resize' && e.data.nonce===nonce && Number.isFinite(e.data.height))setHeight(Math.max(120,Math.min(3000,e.data.height)));};addEventListener('message',receive);return()=>removeEventListener('message',receive);},[]);
return <Modal className="plugin-details-modal" title="Codex 对话 插件设置" subtitle="额外插件 · 设置层级回归" open={open} onClose={()=>setOpen(false)}><div className="plugin-details-page" data-plugin-details="extension.lumi.codex">
<div className="plugin-details-heading"><span>启用状态</span><span>已启用</span></div>
<section className="plugin-details-section"><h3>插件介绍</h3><p>经主程序的 Codex 桥接，与本机 app-server 会话交互：流式回复、命令执行、文件改动、计划与审批。沙箱与审批由 Codex 自身配置决定。</p></section>
<section className="plugin-details-section plugin-own-settings"><h3>插件自身设置</h3><div className="plugin-own-setting-section"><h4>Codex 对话</h4><section className="extension-view"><iframe title="Codex 设置" sandbox="allow-scripts" src="plugin/index.html" style={{width:'100%',height,border:0,display:'block'}}/></section></div></section>
<section className="plugin-details-section"><h3>声明权限</h3><div className="plugin-permission-list"><span>codex.bridge</span></div></section>
<dl className="plugin-details-metadata"><div><dt>作者</dt><dd>Lumi contributors</dd></div><div><dt>许可证</dt><dd>MIT</dd></div></dl>
</div></Modal>;}
createRoot(document.getElementById('root')).render(<Host/>);`},bundle:true,platform:'browser',format:'esm',write:false,loader:{'.css':'empty','.svg':'text'},define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
  await writeFile(path.join(directory,'app.js'),renderer.outputFiles[0].contents);
  await writeFile(path.join(directory,'index.html'),'<meta charset="UTF-8"><link rel="stylesheet" href="style.css"><div class="desktop-shell" data-interface="extension.author.dreamy" data-theme="dark" data-appearance-transparency="clear" data-appearance-blur="soft" data-appearance-distortion="strong"><div class="fixture-background" aria-hidden="true">'+Array.from({length:30},(_,i)=>'<p>工作台背景 '+i+' · 会话列表 · 文件改动摘要 · 界面设置</p>').join('')+'</div><div id="root"></div></div><script type="module" src="app.js"></script>');
  await writeFile(path.join(directory,'main.cjs'),String.raw`
const {app,BrowserWindow,protocol}=require('electron'),fs=require('node:fs'),path=require('node:path');
protocol.registerSchemesAsPrivileged([{scheme:'lumi-settings-test',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
for(const name of ['userData','sessionData','logs','crashDumps']){const p=path.join(__dirname,name);fs.mkdirSync(p,{recursive:true});app.setPath(name,p);}if(!process.argv.includes('--hardware'))app.disableHardwareAcceleration();app.commandLine.appendSwitch('force-device-scale-factor','1');
app.whenReady().then(async()=>{
protocol.handle('lumi-settings-test',request=>{const relative=new URL(request.url).pathname.slice(1);if(!/^(?:plugin\/)?[a-zA-Z0-9.-]+$/.test(relative))return new Response(null,{status:404});return new Response(fs.readFileSync(path.join(__dirname,relative)),{headers:{'Content-Type':relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':'text/html'}});});
const win=new BrowserWindow({show:false,width:1100,height:800,useContentSize:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});await win.loadURL('lumi-settings-test://host/index.html');
const run=code=>win.webContents.executeJavaScript(code),frame=()=>win.webContents.mainFrame.frames.find(f=>f.url.includes('/plugin/index.html'));
const paint=async()=>{await run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await win.webContents.capturePage();await run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');};
const until=async(fn,label)=>{const end=Date.now()+7000;while(!await fn()){if(Date.now()>end)throw Error(label);await new Promise(r=>setTimeout(r,20));}};
await until(()=>frame()?.executeJavaScript('document.body.dataset.lumiView==="settingsTab" && document.getElementById("view-settings").offsetHeight>300'),'real Codex settings did not initialize');
const results=[];
for(const mode of ['light','dark'])for(const blur of ['soft','moderate','strong'])for(const [width,height] of [[1100,800],[680,620],[480,420]]){
win.setContentSize(width,height);await run('fixture.apply('+JSON.stringify(mode)+','+JSON.stringify(blur)+')');await new Promise(r=>setTimeout(r,180));
await run('document.querySelector(".plugin-details-page").scrollTop=0');
const before=await run('(()=>{const m=document.querySelector(".plugin-details-modal"),h=m.querySelector(".modal-heading").getBoundingClientRect();return {height:m.clientHeight,scrollHeight:m.scrollHeight,headingTop:h.top,headingBottom:h.bottom}})()');
await run('document.querySelector(".plugin-details-page").scrollTop=100000');await new Promise(r=>setTimeout(r,80));
const geometry=await run('(()=>{const m=document.querySelector(".plugin-details-modal"),p=m.querySelector(".plugin-details-page"),b=m.getBoundingClientRect(),h=m.querySelector(".modal-heading").getBoundingClientRect(),d=m.querySelector(".plugin-details-metadata").getBoundingClientRect(),s=getComputedStyle(m,"::before");return {modalScroll:m.scrollTop,contentScroll:p.scrollTop,scrollHeight:p.scrollHeight,contentHeight:p.clientHeight,headingTop:h.top,headingBottom:h.bottom,backgroundHeight:parseFloat(s.height),modalHeight:m.clientHeight,modalWidth:m.clientWidth,pageLeft:p.getBoundingClientRect().left,pageRight:p.getBoundingClientRect().right,box:{left:b.left,top:b.top,right:b.right,bottom:b.bottom},metadata:{x:d.x,y:d.y,width:d.width,height:d.height},filter:s.backdropFilter,errors:fixture.errors}})()');
if(geometry.modalScroll!==0 || geometry.contentScroll<=0 || geometry.backgroundHeight<geometry.modalHeight-2 || Math.abs(before.headingTop-geometry.headingTop)>1 || geometry.metadata.y+geometry.metadata.height>geometry.box.bottom || geometry.box.left<0 || geometry.box.right>width+1 || geometry.box.top<0 || geometry.box.bottom>height+1 || geometry.errors.length)throw Error('dialog background/content scroll contract failed '+JSON.stringify({mode,blur,width,height,before,geometry}));
if(!geometry.filter.includes('blur('+({soft:2,moderate:6,strong:18}[blur])+'px)'))throw Error('dialog blur preset differs '+JSON.stringify({blur,filter:geometry.filter}));
if(!await frame().executeJavaScript('getComputedStyle(document.getElementById("view-settings"),"::before").backdropFilter==="none"'))throw Error('iframe content unexpectedly blurred');
const rect={x:Math.ceil(geometry.metadata.x),y:Math.ceil(geometry.metadata.y),width:Math.floor(geometry.metadata.width),height:Math.floor(geometry.metadata.height)};
await paint();const actual=await win.webContents.capturePage(rect);await run('var clear=document.createElement("style");clear.textContent=".plugin-details-modal::before{backdrop-filter:none!important}";document.head.append(clear)');await paint();const plain=await win.webContents.capturePage(rect);await run('clear.remove()');await paint();
const on=actual.toBitmap(),off=plain.toBitmap(),ink=await run('getComputedStyle(document.querySelector(".plugin-details-metadata")).color');const rgb=ink.match(/[\d.]+/g).slice(0,3).map(Number);let reference=0,preserved=0;
for(let i=0;i<off.length;i+=4){if(Math.abs(off[i]-rgb[2])+Math.abs(off[i+1]-rgb[1])+Math.abs(off[i+2]-rgb[0])<24){reference++;if(Math.abs(on[i]-rgb[2])+Math.abs(on[i+1]-rgb[1])+Math.abs(on[i+2]-rgb[0])<36)preserved++;}}
if(reference<20 || preserved/reference<.9){fs.writeFileSync(path.resolve(__dirname,'../settings-failure.png'),(await win.webContents.capturePage()).toPNG());fs.writeFileSync(path.resolve(__dirname,'../settings-metadata-on.png'),actual.toPNG());fs.writeFileSync(path.resolve(__dirname,'../settings-metadata-off.png'),plain.toPNG());throw Error('metadata text lost foreground pixels '+JSON.stringify({reference,preserved,mode,blur,width,ink,geometry}));}
fs.writeFileSync(path.join(__dirname,'settings-'+mode+'-'+blur+'-'+width+'.png'),(await win.webContents.capturePage()).toPNG());results.push({mode,blur,width,height,contentScroll:geometry.contentScroll,foregroundRatio:preserved/reference});
}
await run('document.querySelector("[aria-label=关闭弹窗]").click()');await until(()=>run('!document.querySelector(".plugin-details-modal") || document.querySelector(".plugin-details-modal").closest("[hidden],[inert]")'),'dialog did not close');
console.log('DREAMY_SETTINGS_UI_OK '+JSON.stringify(results));win.destroy();app.exit(0);
}).catch(e=>{console.error(e.stack);app.exit(1)});`);
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(electron,[path.join(directory,'main.cjs'),...(hardware?['--hardware']:[])],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',data=>log+=data);child.stderr.on('data',data=>log+=data);
  const timeout=setTimeout(()=>child.kill(),60000);const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});clearTimeout(timeout);if(code!==0)throw Error(log);console.log(log.trim());
  for(const mode of ['light','dark'])for(const blur of ['soft','moderate','strong'])for(const width of [1100,680,480])await cp(path.join(directory,'settings-'+mode+'-'+blur+'-'+width+'.png'),path.join(output,'settings-'+mode+'-'+blur+'-'+width+'.png'));
} finally {await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}

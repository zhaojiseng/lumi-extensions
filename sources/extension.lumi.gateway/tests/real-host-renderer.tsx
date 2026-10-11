import React,{useState,useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {ExtensionFrame} from './src/host/extension-frame';
import {PluginSettingsProvider} from './src/host/plugins';
import {AppContext} from './src/context';
import {DEFAULT_PREFERENCES} from './shared/types';
import {Button,Select} from './src/components/ui';
import {applyDocumentTypography,disposeDocumentTypography} from './src/host/typography';

declare global {interface Window {fixture:any;}}
window.fixture={events:[],visible:null,statuses:null,theme:null};
window.lumi.onExtensionEvent(event=>window.fixture.events.push({id:event.id,generation:event.generation,view:event.view,topic:event.topic,payload:event.payload}));
async function start(){
 // The integration builder intentionally discards CSS imports. Load the exact
 // built host primitive sheet prepared by the Electron fixture instead.
 document.querySelector('head style')?.remove();
 const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='host-ui.css';
 await new Promise<void>((resolve,reject)=>{sheet.addEventListener('load',()=>resolve(),{once:true});sheet.addEventListener('error',()=>reject(new Error('Default host UI stylesheet unavailable')),{once:true});document.head.append(sheet);});
 const layoutSheet=document.createElement('link');layoutSheet.rel='stylesheet';layoutSheet.href='host-layout.css';
 await new Promise<void>((resolve,reject)=>{layoutSheet.addEventListener('load',()=>resolve(),{once:true});layoutSheet.addEventListener('error',()=>reject(new Error('Host extension layout stylesheet unavailable')),{once:true});document.head.append(layoutSheet);});
 document.body.dataset.lumiUi='';
 const geometry=document.createElement('style');geometry.textContent='html,body,#root{height:100%;min-height:0;margin:0}.main-area{height:100vh;max-height:100vh;min-height:0}.content-scroll{height:100vh;max-height:100vh;min-height:0;overflow:auto}.content-container{min-height:0}.extension-view{width:100%;min-height:0}';document.head.append(geometry);
 const inventory=await window.lumi.extensionInventory();
 const statuses=await window.lumi.listPlugins();
 const manifest=inventory.plugins.find(plugin=>plugin.manifest.id==='extension.lumi.gateway')!.manifest;
 const view=manifest.contributions.find(value=>value.id==='gateway')!;
 function Host(){
  const [visible,setVisible]=useState(true),[plugins,setPlugins]=useState(statuses),[theme,setTheme]=useState('light'),[interfaceStyle,setInterfaceStyle]=useState<any>(null);
  window.fixture.visible=setVisible;window.fixture.statuses=setPlugins;window.fixture.theme=setTheme;window.fixture.interfaceStyle=setInterfaceStyle;
  const preferences={...DEFAULT_PREFERENCES,theme,fontSize:14,fontFamily:'system'};
  useLayoutEffect(()=>{document.documentElement.dataset.theme=theme;document.body.dataset.theme=theme;applyDocumentTypography(document,{fontSize:preferences.fontSize,fontFamily:preferences.fontFamily});},[theme]);
  useLayoutEffect(()=>()=>disposeDocumentTypography(document),[]);
  const settings={items:[],statuses:plugins,extensions:{...inventory,interfaceStyle:interfaceStyle||inventory.interfaceStyle},loading:false,busyId:null,error:'',setEnabled:async()=>{},setView:async()=>{}};
  return <AppContext.Provider value={{preferences} as any}><PluginSettingsProvider value={settings as any}><div className="main-area"><div className="content-scroll"><div className="content-container">{visible&&<ExtensionFrame pluginId={manifest.id} view={view as any}/>}</div></div></div>
   <div aria-hidden="true" style={{position:'fixed',left:-10000,top:0,width:600,pointerEvents:'none'}}>
    <Button id="primitive-button">默认按钮</Button><Button id="primitive-primary" variant="primary">主按钮</Button><Button id="primitive-danger" variant="danger">危险操作</Button>
    <input id="primitive-input" className="text-input" aria-label="默认输入参照"/>
    <div id="primitive-select"><Select label="默认选择参照" decorated={false} value="fixture" onChange={()=>{}}><option value="fixture">参考</option></Select></div>
    <section id="primitive-panel" className="surface panel">默认面板</section>
    <div id="primitive-dialog" className="modal surface"><div className="modal-heading"><h2>默认弹窗</h2></div><div className="modal-actions"><Button>保留</Button></div></div>
    <nav className="page-tabs"><button id="primitive-tab" className="active" aria-current="page">默认页面</button></nav>
    <table className="data-table"><thead><tr><th>选择</th><th id="primitive-th">字段</th></tr></thead><tbody><tr><td>选择</td><td id="primitive-td">内容</td></tr></tbody></table>
   </div>
  </PluginSettingsProvider></AppContext.Provider>;
 }
 createRoot(document.getElementById('root')!).render(<Host/>);
}
void start();

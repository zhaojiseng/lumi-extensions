async ({check,until,set,click,press,submit,modelsMode,contextChanged,openProvider,routeId,passed}) => {
 const $=id=>document.getElementById(id),models=()=>JSON.parse($('route-models-config').value),done=()=>!$('provider-model-fetch').disabled&&!$('provider-model-status').textContent.includes('正在从');
 const saved=()=>!$('provider-editor-dialog').open&&!$('route-form').querySelector('[data-submit]').disabled&&$('status-message').textContent.includes('供应商、模型与显示设置已保存');
 const fetch=async mode=>{await modelsMode(mode);click('provider-model-fetch');await until(done,'provider catalog did not finish '+mode);};
 const baseline=models(),firstActual=baseline[0].upstreamModel;
 check(baseline.length>0,'automatic catalog import is empty');
 set('provider-model-0-id','catalog-friendly-alias');press($('provider-model-0-enabled'));press($('provider-model-0-overviewHidden'));
 click('provider-model-add');let index=models().length-1;set('provider-model-'+index+'-id','model-alias-collision');set('provider-model-'+index+'-upstreamModel','manual-real-model');
 await fetch('merge');let merged=models();
 check(merged[0].id==='catalog-friendly-alias'&&merged[0].upstreamModel===firstActual&&!merged[0].enabled&&merged[0].overviewHidden,'catalog overwrote alias, enabled or hidden state');
 check(merged.filter(m=>m.upstreamModel===firstActual).length===1&&merged.find(m=>m.id==='model-alias-collision').upstreamModel==='manual-real-model'&&merged.some(m=>m.id==='catalog-new-model'),'catalog duplicate/alias collision/new-model merge failed');
 check($('provider-model-status').textContent.includes('名称与现有别名冲突'),'alias conflict was silent');
 const once=JSON.stringify(merged);await fetch('merge');check(JSON.stringify(models())===once,'repeated catalog fetch duplicated models');
 for(const mode of ['empty','auth','unavailable','error']){await fetch(mode);check(JSON.stringify(models())===once,'empty/error directory deleted models '+mode);check(!$('provider-model-add').disabled&&(mode==='error'?/无法连接|暂时不可用/.test($('provider-model-status').textContent):$('provider-model-status').textContent.includes(mode==='empty'?'空目录':mode==='auth'?'认证失败':'未提供')),'directory failure did not leave a manual fallback '+mode+' · '+$('provider-model-status').textContent);}
 await fetch('truncated');check(models().length===128&&$('provider-model-status').textContent.includes('128')&&$('provider-model-status').textContent.includes('截断')&&models()[0].id==='catalog-friendly-alias','large catalog did not enforce the model capacity explicitly');click('route-cancel');
 openProvider();check(JSON.stringify(models())===JSON.stringify(baseline),'cancel persisted imported/edited/capacity-limited model drafts');
 // Model edits made during GET are merged from the latest draft. API edits cancel it.
 await modelsMode('delayed');click('provider-model-fetch');await until(()=>$('provider-model-status').textContent.includes('正在从'),'delayed import did not start');
 set('provider-model-0-id','alias-edited-during-fetch');await until(done,'delayed model import did not settle');check(models()[0].id==='alias-edited-during-fetch','catalog replaced a model edit made during its request');click('route-cancel');openProvider();
 for(const mode of ['delayed','delayed-error']){
  await modelsMode(mode);click('provider-model-fetch');await until(()=>$('provider-model-status').textContent.includes('正在从'),'stale-source import did not start');
  const original=$('route-upstream').value;set('route-upstream',original+'/unsaved');check($('provider-model-fetch').disabled,'uncommitted API source permitted catalog fetch');set('route-upstream',original);
  const message=$('provider-model-status').textContent;await new Promise(resolve=>setTimeout(resolve,320));check(JSON.stringify(models())===JSON.stringify(baseline)&&$('provider-model-status').textContent===message,'late catalog success/error crossed an API draft change');
 }
 await modelsMode('delayed');click('provider-model-fetch');await until(()=>$('provider-model-status').textContent.includes('正在从'),'context catalog did not start');await contextChanged('dark');await until(()=>!$('provider-model-status').textContent.includes('正在从'),'context did not withdraw catalog synchronously');await new Promise(resolve=>setTimeout(resolve,320));check(JSON.stringify(models())===JSON.stringify(baseline)&&!$('provider-model-status').textContent.includes('模型目录：'),'old page context imported model rows');await contextChanged('light');
 await modelsMode('delayed');click('provider-model-fetch');await until(()=>$('provider-model-status').textContent.includes('正在从'),'cancelled catalog did not start');click('provider-dialog-close');openProvider();
 await new Promise(resolve=>setTimeout(resolve,320));check(JSON.stringify(models())===JSON.stringify(baseline)&&!$('provider-model-status').textContent.includes('模型目录：'),'closed/reopened supplier accepted an old catalog result');
 await modelsMode('delayed');click('provider-model-fetch');await until(()=>$('provider-model-status').textContent.includes('正在从'),'disconnected catalog did not start');click('provider-dialog-close');click('disconnect');click('connect');
 await until(()=>$('connection-badge').textContent==='已连接'&&$('listener-state').textContent==='已停止','catalog reconnect did not settle');openProvider();await new Promise(resolve=>setTimeout(resolve,320));check(JSON.stringify(models())===JSON.stringify(baseline)&&!$('provider-model-status').textContent.includes('模型目录：'),'old session imported models after reconnect');
 await modelsMode('merge');set('provider-model-0-id','catalog-friendly-alias');press($('provider-model-0-overviewHidden'));await fetch('merge');submit('route-form');await until(saved,'imported models did not persist via typed host save');
 openProvider();check(models()[0].id==='catalog-friendly-alias'&&models()[0].enabled&&models()[0].overviewHidden&&models().some(m=>m.id==='catalog-new-model'),'import save/reload lost alias, visibility or new models');click('provider-dialog-close');await modelsMode('normal');
 passed.push('catalog-import/automatic-GET/alias-enabled-visibility-preserved/dedup/conflict/empty-errors/manual-fallback/128-cap/cancel/live-model-edit/source-ticket/close-reopen/session-ticket/context-ticket/typed-save');
 return {routeId,upstreamModel:firstActual,alias:'catalog-friendly-alias',savedModels:baseline.length+2,capacity:128,aliasPreserved:true,settingsPreserved:true,lateResultsRevoked:true};
}

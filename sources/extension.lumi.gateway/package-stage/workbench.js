/* Supplier/model configuration and real request-chain UI. All privileged work uses fixed SDK methods. */
'use strict';
window.createGatewayWorkbench = ({sdk,getState,requireSession,current,action,notice,failLocal,requireStopped,reload,showTab,routeDraftChanged,editProvider,providerBusy,upstreamFailureHint}) => {
 const $=id=>document.getElementById(id),node=(tag,value,className)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=value;if(className)el.className=className;return el;};
 const supported=Boolean(sdk?.gateway?.agents?.get&&sdk?.gateway?.rectifiers?.list&&sdk?.gateway?.chain?.snapshot);
 const endpoints=['/v1/responses','/v1/chat/completions','/v1/messages'],entryIds=['route-entry-responses','route-entry-chat','route-entry-messages'];
 const actionNames={preserve:'保留',remove:'删除','set-if-missing':'缺失补入',override:'覆盖',map:'按值映射',clamp:'范围限制',reject:'拒绝'};
 const fields=[['/service_tier','服务档位'],['/reasoning/effort','Responses 推理强度'],['/reasoning_effort','Chat 推理强度'],['/thinking','Anthropic 思考配置'],['/thinking/type','思考方式'],['/thinking/budget_tokens','思考预算'],['/output_config/effort','Anthropic effort'],['/max_tokens','Messages 输出上限'],['/max_output_tokens','Responses 输出上限'],['/max_completion_tokens','Chat 输出上限'],['/temperature','Temperature'],['/top_p','Top P'],['/top_k','Top K'],['/stop','停止条件'],['/stop_sequences','Messages 停止序列'],['/tool_choice','工具选择'],['/parallel_tool_calls','并行工具'],['/response_format','Chat 输出格式'],['/text/format','Responses 输出格式'],['/output_config/format','Messages 输出格式'],['/store','Responses 存储'],['/prompt_cache_key','缓存键'],['/prompt_cache_retention','缓存保留'],['/cache_control','顶层缓存策略'],['/system/*/cache_control','系统内容缓存标记'],['/messages/*/content/*/cache_control','消息内容缓存标记'],['/tools/*/cache_control','工具缓存标记'],['/input/*/content/*/cache_control','Responses 内容缓存标记'],['/stream_options/include_usage','流式用量'],['/metadata','元数据'],['/reasoning','推理配置'],['/reasoning/summary','推理摘要'],['/output_config','输出配置'],['/text','文本配置'],['/text/verbosity','文本详细程度'],['/stream_options','流配置']];
 const wb={version:0,agents:[],rectifiers:[],nativeRectifiers:[],legacyIds:new Map(),accessPrefs:null,accessPromise:null,editingRule:null,ruleDirty:false,ruleBase:'',previewTicket:0,timer:null,pollBusy:false,snapshot:null,selectedTrace:null,pendingDelete:null,entryTouched:false,overviewPrefs:null,prefsPromise:null,catalogKey:null,catalogObserver:null,requestObserver:null,wireFrame:null,activeProviders:new Set(),activeModels:new Set(),hasActive:false};
 const known=(v,suffix='')=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('zh-CN')+suffix:'未知';
 const tier=f=>f?.state==='string'?f.value:f?.state==='missing'?'缺失':f?.state==='null'?'null':'未知';
 const signature=id=>JSON.stringify([...$(id).querySelectorAll('input,select,textarea')].map(el=>[el.id,el.type==='checkbox'?el.checked:el.value]));
 const option=(value,label)=>{const el=node('option',label);el.value=value;return el;};
 const invalidate=()=>{wb.previewTicket++;$('rectifier-preview-result').replaceChildren();$('rectifier-preview-status').textContent='配置或输入变化后需重新计算。';};
 const labelRoute=r=>r.name||r.id;
 function routeOptions(id,all){const value=$(id).value;$(id).replaceChildren(...(all?[option('',all)]:[]),...getState().routes.map(r=>option(r.id,labelRoute(r))));if([...$(id).options].some(o=>o.value===value))$(id).value=value;}
 function modelRows(){const models=JSON.parse($('route-models-config').value||'[]');const list=$('provider-model-list');list.replaceChildren();
  models.forEach((m,index)=>{const row=node('div',undefined,'gateway-provider-model-row');row.dataset.modelIndex=String(index);
   for(const [property,title]of [['id','对外模型名称'],['upstreamModel','实际模型 ID']]){const field=node('div',undefined,'gateway-field'),input=node('input');input.type='text';input.className='text-input';input.maxLength=256;input.value=m[property];input.id='provider-model-'+index+'-'+property;input.dataset.modelControl='';input.dataset.providerControl='';input.setAttribute('aria-label',title+' '+(index+1));const label=node('label',title,'field-label');label.htmlFor=input.id;
    input.addEventListener('input',()=>{m[property]=input.value;storeModels(models);});field.append(label,input);row.append(field);}
   const checks=node('div',undefined,'gateway-model-checks');
   for(const [property,title]of [['enabled','启用'],['overviewHidden','隐藏于概况']]){const label=node('label',undefined,'checkbox-label'),check=node('input');check.type='checkbox';check.checked=Boolean(m[property]);check.id='provider-model-'+index+'-'+property;check.dataset.modelControl='';check.dataset.providerControl='';check.setAttribute('aria-label',title+' '+(index+1));check.addEventListener('change',()=>{m[property]=check.checked;storeModels(models);});label.append(check,node('span',title));checks.append(label);}
   const remove=node('button','移除','button danger');remove.type='button';remove.dataset.providerControl='';remove.setAttribute('aria-label','移除模型 '+(index+1));remove.addEventListener('click',()=>{requireSession();models.splice(index,1);storeModels(models);modelRows();});row.append(checks,remove);list.append(row);
  });updateButtons();
 }
 function storeModels(models){$('route-models-config').value=JSON.stringify(models);routeDraftChanged();invalidate();}
 function editRoute(route){if(!supported)return;wb.entryTouched=false;$('route-name').value=route?.name||route?.id||'';$('route-upstream-endpoint').value=route?.upstreamEndpoint||(route?.protocol==='anthropic'?'/v1/messages':'');
  const allowed=route?.entryEndpoints?.length?route.entryEndpoints:route?.protocol==='anthropic'?['/v1/messages']:['/v1/responses','/v1/chat/completions'];
  entryIds.forEach((id,i)=>$(id).checked=allowed.includes(endpoints[i]));$('route-models-config').value=JSON.stringify((route?.models||[]).map(m=>({...m,overviewHidden:hiddenModels(route?.id).includes(m.id)})));modelRows();}
 function routeValues(){if(!supported)return{};const models=JSON.parse($('route-models-config').value||'[]').map(({overviewHidden,...m})=>({...m,id:m.id.trim(),upstreamModel:m.upstreamModel.trim()}));
  if(models.some(m=>!m.id||!m.upstreamModel)||new Set(models.map(m=>m.id)).size!==models.length)failLocal('模型名称与实际 ID 必须填写完整，对外模型名称不能重复。');
  const entryEndpoints=endpoints.filter((_,i)=>$(entryIds[i]).checked);if(!entryEndpoints.length)failLocal('至少允许一个对外接口。');
  const upstreamEndpoint=$('route-upstream-endpoint').value,protocol=$('route-protocol').value;
  if(upstreamEndpoint && (upstreamEndpoint==='/v1/messages')!==(protocol==='anthropic'))failLocal('上游推理接口须与供应商协议一致。');
  return {name:$('route-name').value.trim()||$('route-id').value.trim(),models,entryEndpoints,...(upstreamEndpoint?{upstreamEndpoint}:{})};
 }
 function updateButtons(){if(!supported)return;upstreamPreview();const s=getState(),editable=s.session&&!s.localChanging&&!providerBusy(),stopped=editable&&s.listener?.state==='stopped'&&s.listener.activeRequests===0;
  for(const el of document.querySelectorAll('[data-provider-control]'))el.disabled=!editable;
  $('chain-provider-add').disabled=Boolean(!s.supported||s.localChanging||providerBusy()||s.providerModelsLoading||s.local?.configured&&(!editable||s.routes.length>=32));$('chain-model-add').disabled=Boolean(!s.supported||s.localChanging||providerBusy()||s.providerModelsLoading||s.local?.configured&&!editable);
  for(const el of document.querySelectorAll('[data-chain-provider-id],[data-chain-model-id]'))el.disabled=!editable;
  $('chain-model-picker-confirm').disabled=!editable;$('chain-model-provider').disabled=!editable;
  for(const id of ['rectifier-new','rectifier-save','rectifier-preview-run'])$(id).disabled=!s.session||s.localChanging;
  $('rectifier-delete').disabled=!s.session||!wb.editingRule||s.localChanging;
  const inherited=wb.legacyIds.has(wb.editingRule);$('rectifier-stage').disabled=inherited;$('rectifier-field').disabled=inherited;$('rectifier-value-type').disabled=inherited;
 }
 function rows(){
  const list=$('rectifier-list'),search=$('rectifier-filter').value.trim().toLowerCase(),stage=$('rectifier-filter-stage').value;list.replaceChildren();
  wb.rectifiers.filter(r=>(!stage||r.stage===stage)&&JSON.stringify(r).toLowerCase().includes(search)).forEach(r=>{
   const row=node('div',undefined,'gateway-workbench-row'),description=node('div');description.append(node('strong',r.id),node('p',(r.stage==='entry'?'Agent → Lumi':'供应商 → 模型')+' · '+r.field+' · '+actionNames[r.action.type]+' · 优先级 '+r.priority+' · '+(r.enabled?'已启用':'已停用'),'field-help'));
   description.append(node('p',[r.match.routeId||'全部供应商',r.match.clientAlias||'全部 Agent',r.match.model||'全部模型',r.match.endpoint||'全部接口'].join(' / '),'small-text muted'));
   const edit=node('button','编辑','button default');edit.type='button';edit.dataset.rectifierId=r.id;edit.addEventListener('click',()=>editRule(r));row.append(description,edit);list.append(row);
  });if(!list.childNodes.length)list.append(node('p','暂无匹配的整流规则。','field-help'));

 }
 function setDirty(){wb.ruleDirty=signature('rectifier-form')!==wb.ruleBase;$('rectifier-draft').textContent=wb.ruleDirty?'有未保存的更改；请保存或取消后再切换。':'';}
 function ruleValueState(){const field=$('rectifier-field').value,select=$('rectifier-action'),inherited=wb.legacyIds.has(wb.editingRule);for(const option of select.options)option.disabled=inherited?!['preserve','remove','set-if-missing','override'].includes(option.value):field.includes('*')?!['preserve','remove'].includes(option.value):field==='/service_tier'&&option.value==='clamp';if(select.selectedOptions[0]?.disabled)select.value='remove';const type=select.value;$('rectifier-value-wrap').hidden=!['override','set-if-missing'].includes(type);$('rectifier-map-wrap').hidden=type!=='map';$('rectifier-clamp-wrap').hidden=type!=='clamp';$('rectifier-reject-wrap').hidden=type!=='reject';}
 function editRule(r,force=false){if(wb.ruleDirty&&!force){notice('整流规则有未保存的更改，请先保存或取消。','warning');return;}wb.editingRule=r?.id??null;
  for(const [id,value]of [['rectifier-id',r?.id||''],['rectifier-priority',r?.priority??0],['rectifier-stage',r?.stage||$('rectifier-filter-stage').value||'entry'],['rectifier-provider',r?.match.routeId||''],['rectifier-agent',r?.match.clientAlias||''],['rectifier-model',r?.match.model||''],['rectifier-endpoint',r?.match.endpoint||''],['rectifier-field',r?.field||'/service_tier'],['rectifier-action',r?.action.type||'preserve']])$(id).value=value;
  $('rectifier-id').readOnly=Boolean(r);$('rectifier-enabled').checked=r?.enabled??true;const a=r?.action||{},value=a.value;
  const type=value===null?'null':typeof value==='number'?'number':typeof value==='boolean'?'boolean':value&&typeof value==='object'?'json':'string';$('rectifier-value-type').value=type;$('rectifier-value').value=type==='json'?JSON.stringify(value,null,2):value===undefined?'':String(value);
  $('rectifier-map').value=a.values?JSON.stringify(a.values,null,2):'';$('rectifier-min').value=a.min??'';$('rectifier-max').value=a.max??'';$('rectifier-reject').value=a.code||'';
  ruleValueState();wb.ruleBase=signature('rectifier-form');wb.ruleDirty=false;$('rectifier-draft').textContent='';$('rectifier-editor').open=true;$('rectifier-editor').scrollIntoView({block:'start'});updateButtons();
 }
 function parseJson(value,message){try{return JSON.parse(value);}catch{failLocal(message);}}
 function readRule(){const type=$('rectifier-action').value;let result={type};
  if(['override','set-if-missing'].includes(type)){const raw=$('rectifier-value').value,kind=$('rectifier-value-type').value;let value=raw;
   if(kind==='number'){value=Number(raw);if(!raw.trim()||!Number.isFinite(value))failLocal('请填写有效数值。');}else if(kind==='boolean'){if(!['true','false'].includes(raw.trim()))failLocal('布尔值请输入 true 或 false。');value=raw.trim()==='true';}else if(kind==='null')value=null;else if(kind==='json')value=parseJson(raw,'参数对象或数组必须是有效 JSON。');result.value=value;
  }else if(type==='map'){const values=parseJson($('rectifier-map').value,'映射表必须是有效 JSON 对象。');if(!values||Array.isArray(values)||typeof values!=='object')failLocal('映射表必须是对象。');result.values=values;}
  else if(type==='clamp'){const min=Number($('rectifier-min').value),max=Number($('rectifier-max').value);if(!$('rectifier-min').value||!$('rectifier-max').value||!Number.isFinite(min)||!Number.isFinite(max)||min>max)failLocal('请填写有效的最小值和最大值。');result={type,min,max};}
  else if(type==='reject')result.code=$('rectifier-reject').value.trim();
  const match={};for(const [key,id]of [['routeId','rectifier-provider'],['clientAlias','rectifier-agent'],['model','rectifier-model'],['endpoint','rectifier-endpoint']])if($(id).value.trim())match[key]=$(id).value.trim();
  return {id:$('rectifier-id').value.trim(),enabled:$('rectifier-enabled').checked,priority:Number($('rectifier-priority').value),stage:$('rectifier-stage').value,field:$('rectifier-field').value,match,action:result};
 }
 async function saveRule(){if(!$('rectifier-form').reportValidity())return;const snapshot=requireSession(),rule=readRule();if(!wb.editingRule&&wb.rectifiers.some(r=>r.id===rule.id))failLocal('规则 ID 已存在。');
  const oldId=wb.legacyIds.get(wb.editingRule);
  if(oldId){
   const updated={id:oldId,enabled:rule.enabled,priority:rule.priority,match:rule.match,action:rule.action};
   await sdk.gateway.rules.replace({sessionId:snapshot.sessionId,expectedVersion:getState().configVersion,rules:getState().rules.map(r=>r.id===oldId?updated:r)});
  }else{
   const next=wb.nativeRectifiers.filter(r=>r.id!==wb.editingRule),index=wb.nativeRectifiers.findIndex(r=>r.id===wb.editingRule);if(index<0)next.push(rule);else next.splice(index,0,rule);
   await sdk.gateway.rectifiers.replace({sessionId:snapshot.sessionId,expectedVersion:getState().configVersion,rectifiers:next});
  }
  if(!current(snapshot))return;wb.ruleDirty=false;await reload();if(!current(snapshot))return;editRule(rule,true);notice('整流规则已保存，后续请求使用新配置。','success');
 }
 function askDelete(kind,id){wb.pendingDelete={kind,id,scope:requireSession(),version:getState().configVersion};$('workbench-delete-text').textContent='将删除'+(kind==='rule'?'整流规则 ':'Agent ')+id+'，已有请求记录保留。';$('workbench-delete-dialog').showModal();}
 async function deleteRule(confirmed=false){if(!wb.editingRule)return;if(wb.ruleDirty)failLocal('先保存或取消未保存的规则更改。');if(!confirmed){askDelete('rule',wb.editingRule);return;}
  const snapshot=requireSession(),oldId=wb.legacyIds.get(wb.editingRule);
  if(oldId)await sdk.gateway.rules.replace({sessionId:snapshot.sessionId,expectedVersion:getState().configVersion,rules:getState().rules.filter(r=>r.id!==oldId)});
  else await sdk.gateway.rectifiers.replace({sessionId:snapshot.sessionId,expectedVersion:getState().configVersion,rectifiers:wb.nativeRectifiers.filter(r=>r.id!==wb.editingRule)});
  if(!current(snapshot))return;wb.editingRule=null;await reload();editRule(null,true);notice('整流规则已删除。','success');
 }
 const accessPrefsKey='gateway.access-agent.v1';
 async function loadAccessPrefs(){if(wb.accessPromise)return wb.accessPromise;wb.accessPromise=(async()=>{const saved=await sdk.storage.read(accessPrefsKey);wb.accessPrefs=saved?.version===1&&typeof saved.id==='string'&&typeof saved.credentialRef==='string'?saved:null;})();try{await wb.accessPromise;}catch(error){wb.accessPromise=null;throw error;}}
 function preferredAccess(){return wb.agents.find(a=>a.enabled&&a.id===wb.accessPrefs?.id)?.credentialRef||wb.agents.find(a=>a.enabled)?.credentialRef||getState().routes[0]?.id;}
 function accessChoices(){return getState().routes.filter(route=>!wb.agents.length||wb.agents.some(a=>a.credentialRef===route.id)).map(route=>{const agents=wb.agents.filter(a=>a.credentialRef===route.id),managed=agents.some(a=>a.id===wb.accessPrefs?.id);return {id:route.id,label:managed?'统一接入':agents.length?'已有接入 · '+agents.map(a=>a.name).join('、'):'供应商专属入口 · '+labelRoute(route)};});}
 function needsAccessSync(){const routes=getState().routes;if(!supported||!routes.length)return false;if(!wb.agents.length)return routes.length===1;const managed=wb.agents.find(a=>a.id===wb.accessPrefs?.id&&a.credentialRef===wb.accessPrefs?.credentialRef);return Boolean(managed&&(managed.providerIds.length!==routes.length||routes.some(r=>!managed.providerIds.includes(r.id))));}
 async function synchronizeAccess({excludeProviderId}={}){
  if(!supported||!sdk.gateway.agents.replace)return false;const s=getState();
  if(!s.session||!s.routes.length)return false;
  const scope=requireSession();await loadAccessPrefs();if(!current(scope))return false;
  let managed=wb.agents.find(a=>a.id===wb.accessPrefs?.id&&a.credentialRef===wb.accessPrefs?.credentialRef);
  if(!wb.agents.length&&!excludeProviderId&&s.routes.length===1){
   managed={id:'lumi-access',name:'Agent',credentialRef:s.routes[0].id,providerIds:[],enabled:true};
   const marker={version:1,id:managed.id,credentialRef:managed.credentialRef};
   await sdk.storage.write(accessPrefsKey,marker);if(!current(scope))return false;wb.accessPrefs=marker;
  }
  if(!managed)return false;
  if(excludeProviderId===managed.credentialRef)failLocal('此供应商保存统一接入 API Key，当前需保留它；可停用供应商或移除模型。');
  const providerIds=s.routes.filter(r=>r.id!==excludeProviderId).map(r=>r.id);
  if(managed.providerIds.length===providerIds.length&&providerIds.every(id=>managed.providerIds.includes(id)))return false;
  const updated={...managed,providerIds},agents=wb.agents.length?wb.agents.map(a=>a.id===managed.id?updated:a):[updated];
  const result=await sdk.gateway.agents.replace({sessionId:scope.sessionId,expectedVersion:s.configVersion,agents});
  if(!current(scope))return false;s.configVersion=result.configVersion;wb.agents=agents;return true;
 }
 async function preview(){const snapshot=requireSession(),ticket=++wb.previewTicket,input={sessionId:snapshot.sessionId,routeId:$('rectifier-preview-provider').value,endpoint:$('rectifier-preview-endpoint').value,body:$('rectifier-preview-body').value,...($('rectifier-preview-agent').value.trim()?{clientAlias:$('rectifier-preview-agent').value.trim()}:{})};parseJson(input.body,'模拟请求必须是有效 JSON。');$('rectifier-preview-result').replaceChildren();$('rectifier-preview-status').textContent='计算中…';
  try{const result=await sdk.gateway.rectifiers.preview(input);if(!current(snapshot)||ticket!==wb.previewTicket)return;for(const [title,value]of [['Agent 原始请求',result.originalBody],['入口整流后',result.entryBody],['发给供应商',result.sentBody]]){const col=node('div');col.append(node('strong',title),node('pre',value));$('rectifier-preview-result').append(col);}$('rectifier-preview-status').textContent=(result.modified?'请求有整流或协议转换。':'请求保持原样。')+(result.chain?' 供应商：'+result.chain.providerName+'；实际模型：'+(result.chain.upstreamModel||'未知')+'；发送接口：'+result.chain.upstreamEndpoint:'');}
  catch(error){if(current(snapshot)&&ticket===wb.previewTicket)$('rectifier-preview-status').textContent='未生成发送结果，请检查所需字段和目标协议。';throw error;}
 }
 const catalogAdd=$('chain-catalog-add');
 const prefsKey='gateway.overview-models.v1';
 function hiddenModels(id){return Object.hasOwn(wb.overviewPrefs?.hiddenModels||{},id)?wb.overviewPrefs.hiddenModels[id]:[];}
 async function loadOverviewPrefs(){if(wb.prefsPromise)return wb.prefsPromise;wb.prefsPromise=(async()=>{
  try{const saved=await sdk.storage.read(prefsKey),entries=saved?.version===1&&saved.hiddenModels&&typeof saved.hiddenModels==='object'&&!Array.isArray(saved.hiddenModels)?Object.entries(saved.hiddenModels):[];
   wb.overviewPrefs={version:1,hiddenModels:Object.fromEntries(entries.filter(([id,models])=>/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id)&&Array.isArray(models)).slice(0,32).map(([id,models])=>[id,models.filter(m=>typeof m==='string'&&m.length<=256).slice(0,128)]))};
  }catch{wb.prefsPromise=null;throw Object.assign(new Error('overview-preferences-unavailable'),{localMessage:'无法读取模型显示设置，请重新连接后再编辑供应商。'});}
 })();return wb.prefsPromise;}
 async function saveOverviewRoute(id){await loadOverviewPrefs();const scope=requireSession(),models=JSON.parse($('route-models-config').value||'[]'),hidden=models.filter(m=>m.overviewHidden).map(m=>m.id.trim()),next={version:1,hiddenModels:{...wb.overviewPrefs.hiddenModels,[id]:hidden}};
  await sdk.storage.write(prefsKey,next);if(!current(scope))return;wb.overviewPrefs=next;wb.catalogKey=null;
 }
 function addModel(){requireSession();const models=JSON.parse($('route-models-config').value||'[]');if(models.length>=128){notice('一个供应商最多配置 128 个模型。','warning');return false;}models.push({id:'',upstreamModel:'',enabled:true,overviewHidden:false});storeModels(models);modelRows();const input=$('provider-model-'+(models.length-1)+'-id');input.focus();input.scrollIntoView({block:'nearest'});return true;}
 function importModels(catalog){requireSession();const models=JSON.parse($('route-models-config').value||'[]'),knownUpstream=new Set(models.map(m=>m.upstreamModel.trim())),names=new Set(models.map(m=>m.id.trim()));let added=0,existing=0,conflicts=0,capacity=0;
  for(const item of catalog){const id=item.id;if(knownUpstream.has(id)){existing++;continue;}if(names.has(id)){conflicts++;continue;}if(models.length>=128){capacity++;continue;}models.push({id,upstreamModel:id,enabled:true,overviewHidden:false});names.add(id);knownUpstream.add(id);added++;}
  if(added){storeModels(models);modelRows();}return {added,existing,conflicts,capacity};
 }
 function wire(svg,box,from,to,{edge,providerId,modelId,vertical=false}={}) {
  const x1=(vertical?from.left+from.width/2:from.right)-box.left,y1=(vertical?from.bottom:from.top+from.height/2)-box.top;
  const x2=(vertical?to.left+to.width/2:to.left)-box.left,y2=(vertical?to.top:to.top+to.height/2)-box.top;
  const path=document.createElementNS('http://www.w3.org/2000/svg','path'),bend=vertical?(y1+y2)/2:(x1+x2)/2;
  path.setAttribute('d',vertical?'M '+x1+' '+y1+' C '+x1+' '+bend+', '+x2+' '+bend+', '+x2+' '+y2:'M '+x1+' '+y1+' C '+bend+' '+y1+', '+bend+' '+y2+', '+x2+' '+y2);
  path.dataset.edge=edge;if(providerId)path.dataset.providerId=providerId;if(modelId)path.dataset.modelId=modelId;
  path.classList.toggle('is-active',Boolean(edge==='entry'?wb.hasActive:edge==='selection'?wb.activeProviders.has(providerId):wb.activeModels.has(providerId+'\0'+modelId)));
  path.classList.toggle('is-selected',Boolean(wb.selectedProvider&&(edge==='entry'||providerId===wb.selectedProvider&&(!modelId||modelId===wb.selectedModel))));
  svg.append(path);
 }
 function drawWires(){
  wb.wireFrame=null;if($('tab-gateway').hidden)return;
  const flow=$('chain-flow'),svg=$('chain-flow-wires'),box=flow.getBoundingClientRect();svg.replaceChildren();if(!box.width||!box.height)return;
  svg.setAttribute('viewBox','0 0 '+box.width+' '+box.height);
  const agent=flow.querySelector('.gateway-agent-node').getBoundingClientRect(),lumi=flow.querySelector('.gateway-lumi-node').getBoundingClientRect();
  wire(svg,box,agent,lumi,{edge:'entry'});
  for(const group of $('chain-catalog').querySelectorAll('.gateway-provider-group')){
   const provider=group.querySelector('[data-chain-provider-id]'),origin=provider.getBoundingClientRect(),vertical=origin.left<lumi.right-2;
   wire(svg,box,lumi,origin,{edge:'selection',providerId:provider.dataset.chainProviderId,vertical});
   const groupSvg=group.querySelector('svg'),groupBox=group.getBoundingClientRect();groupSvg.replaceChildren();if(!groupBox.width||!groupBox.height)continue;
   groupSvg.setAttribute('viewBox','0 0 '+groupBox.width+' '+groupBox.height);
   for(const model of group.querySelectorAll('[data-chain-model-id]'))wire(groupSvg,groupBox,origin,model.getBoundingClientRect(),{edge:'model',providerId:provider.dataset.chainProviderId,modelId:model.dataset.chainModelId});
  }
 }
 function scheduleWires(){if(wb.wireFrame===null)wb.wireFrame=requestAnimationFrame(drawWires);}
 function renderCatalog(){const s=getState(),key=JSON.stringify([s.session?.sessionId,s.configVersion,wb.overviewPrefs,[...wb.activeModels]]);if(key===wb.catalogKey)return;wb.catalogKey=key;const list=$('chain-catalog'),scrollTop=list.scrollTop;list.replaceChildren();wb.catalogObserver?.disconnect();
  for(const route of s.routes){const group=node('div',undefined,'gateway-provider-group'),provider=node('button',undefined,'gateway-provider-node');group.dataset.providerId=route.id;provider.type='button';provider.dataset.chainProviderId=route.id;provider.setAttribute('aria-label','编辑供应商 '+labelRoute(route));provider.append(node('span','▱','gateway-node-symbol'),node('strong',labelRoute(route)),node('span',(route.protocol==='anthropic'?'Anthropic':'OpenAI 兼容')+' · '+(route.enabled?'已启用':'已停用'),'small-text muted'));provider.addEventListener('click',()=>void action(provider,()=>editProvider(route.id)));
   const models=node('div',undefined,'gateway-model-nodes'),all=route.models||[],hidden=hiddenModels(route.id),visible=all.filter(m=>!hidden.includes(m.id)||wb.activeModels.has(route.id+'\0'+m.id));
   for(const model of visible){const button=node('button',undefined,'gateway-model-node');button.type='button';button.dataset.chainModelId=model.id;button.dataset.providerId=route.id;button.setAttribute('aria-label','编辑模型 '+model.id+'，供应商 '+labelRoute(route));button.append(node('strong',model.id),node('span',model.upstreamModel,'small-text muted'));if(!model.enabled)button.append(node('span','已停用','small-text muted'));button.addEventListener('click',()=>void action(button,()=>editProvider(route.id,{focusModel:model.id})));models.append(button);}
   if(!visible.length)models.append(node('p',all.length?'全部模型已隐藏':'尚未添加模型','gateway-model-empty small-text muted'));
   if(all.length-visible.length)models.append(node('span','已隐藏 '+(all.length-visible.length)+' 个模型','gateway-model-hidden small-text muted'));
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('gateway-catalog-wires');svg.setAttribute('aria-hidden','true');group.append(provider,models,svg);list.append(group);
  }
  if(!s.routes.length)list.append(node('p',s.local?.configured?'连接后显示供应商与模型。':'点击下方供应商“＋”完成首次设置。','gateway-catalog-empty field-help'));
  list.append(catalogAdd);list.scrollTop=scrollTop;if(wb.catalogObserver){for(const el of [list,$('chain-flow'),document.querySelector('.gateway-agent-node'),document.querySelector('.gateway-lumi-node'),...list.children])wb.catalogObserver.observe(el);}scheduleWires();updateButtons();
 }
 function activeChains(){const traces=wb.snapshot?.traces||[];wb.hasActive=traces.some(t=>t.phase!=='finished');wb.activeProviders=new Set();wb.activeModels=new Set();for(const t of traces){if(t.phase==='finished'||!t.chain)continue;wb.activeProviders.add(t.chain.providerId);if(t.chain.requestedModel)wb.activeModels.add(t.chain.providerId+'\0'+t.chain.requestedModel);}}
 function highlightCatalog(trace){wb.selectedProvider=trace?.providerId||null;wb.selectedModel=trace?.chain?.requestedModel||trace?.requestedModel||null;scheduleWires();for(const el of $('chain-catalog').querySelectorAll('[data-chain-provider-id],[data-chain-model-id]')){const providerId=el.dataset.chainProviderId||el.dataset.providerId,selected=providerId===trace?.providerId&&(!el.dataset.chainModelId||el.dataset.chainModelId===(trace?.chain?.requestedModel||trace?.requestedModel)),active=el.dataset.chainModelId?wb.activeModels.has(providerId+'\0'+el.dataset.chainModelId):wb.activeProviders.has(providerId);el.classList.toggle('is-selected',selected);el.classList.toggle('is-active',active);if(selected)el.setAttribute('aria-current','true');else el.removeAttribute('aria-current');}}
 function newOverviewModel(){const s=getState();if(!s.routes.length){return editProvider(null,{addModel:true});}if(s.routes.length===1)return editProvider(s.routes[0].id,{addModel:true});const select=$('chain-model-provider');select.replaceChildren(...s.routes.map(r=>option(r.id,labelRoute(r))));if(s.routes.some(r=>r.id===s.editingRoute))select.value=s.editingRoute;$('chain-model-picker-dialog').showModal();}
 function upstreamPreview(){const preview=$('route-upstream-preview');preview.replaceChildren();let base;try{base=new URL($('route-upstream').value.trim());}catch{return;}
  if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)return;
  const selected=$('route-upstream-endpoint').value,protocol=$('route-protocol').value,paths=selected?[selected]:protocol==='anthropic'?['/v1/messages']:['/v1/responses','/v1/chat/completions'];
  preview.append(node('span',selected?'按当前设置发送：':'按 Agent 入口选择发送路径：'));
  for(const endpoint of paths){const target=new URL(base),prefix=target.pathname.replace(/\/+$/,'');target.pathname=prefix.endsWith('/v1')?prefix+endpoint.slice(3):prefix+endpoint;preview.append(node('code',target.href));}
 }
 function requestMetrics(trace){const ended=trace.phase==='finished',elapsed=ended?trace.record?.durationMs??trace.elapsedMs:trace.rateWindow?trace.elapsedMs:Math.max(trace.elapsedMs,Date.now()-trace.startedAtMs),window=trace.rateWindow,rate=window?.windowMs===5000&&window.source!=='unavailable'&&typeof window.charsPerSecond==='number'&&Number.isFinite(window.charsPerSecond)&&window.charsPerSecond>=0?window.charsPerSecond:null;
  return {elapsed:typeof elapsed==='number'&&Number.isFinite(elapsed)&&elapsed>=0?(elapsed/1000).toLocaleString('zh-CN',{minimumFractionDigits:1,maximumFractionDigits:1})+' s':'未知',rate:rate===null?'未知':rate.toLocaleString('zh-CN',{maximumFractionDigits:1})+' 字符/s'};
 }
 function renderRequests(traces=wb.snapshot?.traces||[],selected){const list=$('chain-requests');list.hidden=!traces.length;const style=getComputedStyle(list),gap=parseFloat(style.columnGap)||0,innerWidth=list.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0),capacity=Math.max(1,Math.floor((innerWidth+gap)/(206+gap))),active=traces.filter(t=>t.phase!=='finished'),history=traces.filter(t=>t.phase==='finished');traces=[...active,...history].slice(0,capacity);list.dataset.capacity=String(capacity);list.setAttribute('aria-label','最近请求，显示窗口 '+capacity+' 条，进行中的请求优先');if(!selected)selected=traces.find(t=>t.id===wb.selectedTrace)||traces[0];const existing=new Map([...list.children].map(el=>[el.dataset.traceId,el])),cards=[];
  for(const row of traces){let button=existing.get(row.id);if(!button){button=node('button',undefined,'gateway-request-card');button.type='button';button.dataset.traceId=row.id;const model=node('span',undefined,'gateway-request-model');model.append(node('i',undefined,'gateway-request-status'),node('strong'));const metrics=node('span',undefined,'gateway-request-metrics');for(const [key,label]of [['rate','5s速率'],['elapsed','耗时']]){const field=node('span',label+' '),value=node('b');value.dataset.metric=key;field.append(value);metrics.append(field);}button.append(model,metrics);button.addEventListener('click',()=>{wb.selectedTrace=row.id;renderChain();});}
   const model=row.chain?.upstreamModel||row.requestedModel||'未知模型',status=row.phase==='finished'?(row.errorCode||row.httpStatus>=400?'错误':'已结束'):'进行中',metrics=requestMetrics(row);button.querySelector('strong').textContent=model;button.querySelector('[data-metric=rate]').textContent=metrics.rate;button.querySelector('[data-metric=elapsed]').textContent=metrics.elapsed;button.dataset.phase=row.phase;button.dataset.active=String(row.phase!=='finished');button.dataset.error=String(Boolean(row.errorCode||row.httpStatus>=400));button.setAttribute('aria-pressed',String(row.id===selected?.id));button.setAttribute('aria-label',model+'，'+status+'，速率 '+metrics.rate+'，耗时 '+metrics.elapsed);button.title=model+' · '+status+'\n速率为最近5秒实际输出字符数 / 观测时长；不足5秒按已观测时长计算。字符不等于token。结束后保留结束时的窗口与实际耗时，旧宿主缺少窗口观测时为未知。';cards.push(button);
  }
  if(cards.length!==list.children.length||cards.some((card,index)=>card!==list.children[index]))list.replaceChildren(...cards);
 }
 const phaseNames={received:'收到 Agent 请求',prepared:'完成模型选择与整流',upstream:'开始请求供应商',streaming:'收到上游响应',finished:'请求结束'};
 function renderChain(){if(!supported)return;const s=getState(),snapshot=wb.snapshot;activeChains();renderCatalog();$('chain-live').textContent=!s.session?'未连接':snapshot?'实际请求快照':'等待快照';
  for(const [id,key]of [['chain-total','requests'],['chain-attempts','upstreamAttempts'],['chain-rectified','rectified'],['chain-rerouted','rerouted'],['chain-errors','errors']])$(id).textContent=known(snapshot?.totals[key]);
  const traces=snapshot?.traces||[];if(wb.selectedTrace&&!traces.some(t=>t.id===wb.selectedTrace))wb.selectedTrace=null;const t=traces.find(t=>t.id===wb.selectedTrace)||traces[0];highlightCatalog(t);
  renderRequests(traces,t);
  $('chain-requests').hidden=!traces.length;$('chain-diagnostics').hidden=!traces.length;if(!traces.length)$('chain-diagnostics').open=false;document.querySelector('.gateway-chain-selection').hidden=!t;$('chain-events').replaceChildren();$('chain-changes').replaceChildren();$('chain-events').hidden=!t;$('chain-changes').hidden=!t;
  if(!t){$('chain-title').textContent='等待请求';$('chain-agent').textContent='等待客户端';$('chain-provider').textContent='等待选择';$('chain-model').textContent='等待请求';$('chain-result').textContent='暂无实际请求。';return;}
  $('chain-title').textContent=t.phase==='finished'?t.errorCode||t.httpStatus>=400?'请求出现错误':'请求已结束':phaseNames[t.phase];$('chain-agent').textContent=wb.agents.find(a=>a.id===t.agentId)?.name||t.agentId;$('chain-provider').textContent=t.chain?.providerName||t.providerId;$('chain-model').textContent=t.chain?.upstreamModel||t.requestedModel||'未知';
  const rec=t.record,hint=upstreamFailureHint(rec);$('chain-result').textContent=(t.chain?.routeReason==='model-match'?'按模型名称选择唯一供应商':'使用指定供应商')+' · '+known(t.elapsedMs,' ms')+' · HTTP '+(t.httpStatus??'等待响应')+(t.errorCode?' · '+t.errorCode:'')+(hint?' · '+hint:'');
  for(const e of t.events)$('chain-events').append(node('li',phaseNames[e.phase]+' · '+known(e.elapsedMs,' ms')+(e.errorCode?' · '+e.errorCode:'')));
  if(t.chain){$('chain-changes').append(node('span','请求模型：'+(t.chain.requestedModel||'未知')+'；入口：'+t.chain.entryEndpoint+'；上游：'+t.chain.upstreamEndpoint));for(const c of t.chain.changes)$('chain-changes').append(node('span',(c.stage==='entry'?'入口':'模型')+' · '+c.field+' · '+c.ruleId+' · '+(actionNames[c.action]||c.action)+' · '+(c.changed?'已修改':'保持原值')));if(t.chain.changesTruncated)$('chain-changes').append(node('span','命中规则较多，此处只显示前 16 项。'));}
  if(rec){$('chain-changes').append(node('span','档位：原始 '+tier(rec.original)+' → 入口 '+tier(t.chain?.entryTier)+' → 发送 '+tier(rec.effective)+' → 上游报回 '+tier(rec.reported)));
   $('chain-changes').append(node('span','上游首字 '+known(rec.firstContentMs,' ms')+'；Agent 首段 '+known(t.clientFirstResponseMs,' ms')+'；输入 '+known(rec.inputTokens)+'；输出 '+known(rec.outputTokens)));
  }if(snapshot.truncated)$('chain-changes').append(node('span','快照达到大小上限，部分较早请求未显示。'));
 }
 function schedule(){clearTimeout(wb.timer);if(!supported||!getState().session)return;wb.timer=setTimeout(()=>void poll(),800);}
 async function poll(){if(wb.pollBusy||!getState().session){schedule();return;}if(getState().activeTab!=='gateway'||document.hidden||getState().localChanging){schedule();return;}const scope=requireSession();wb.pollBusy=true;
  try{const result=await sdk.gateway.chain.snapshot({sessionId:scope.sessionId});if(!current(scope))return;const changed=wb.snapshot?.snapshotId!==result.snapshotId||wb.snapshot?.revision!==result.revision;wb.snapshot=result;if(changed)renderChain();else renderRequests();$('chain-live').textContent='实际请求快照';}
  catch{if(current(scope))$('chain-live').textContent='快照暂不可用';}finally{wb.pollBusy=false;schedule();}
 }
 async function getConfig(scope){if(!supported)return null;await Promise.all([loadOverviewPrefs(),loadAccessPrefs()]);const [agents,rectifiers]=await Promise.all([sdk.gateway.agents.get({sessionId:scope.sessionId}),sdk.gateway.rectifiers.list({sessionId:scope.sessionId})]);return {agents,rectifiers};}
 function accept(extra){if(!supported||!extra)return;const changed=wb.version!==extra.agents.configVersion;wb.version=extra.agents.configVersion;wb.agents=extra.agents.agents;wb.nativeRectifiers=extra.rectifiers.rectifiers;wb.legacyIds.clear();
  const used=new Set(wb.nativeRectifiers.map(r=>r.id));const inherited=getState().rules.map((r,index)=>{let id=r.id;if(used.has(id))id='tier-'+index+'-'+r.id.slice(0,48);while(used.has(id))id+='x';used.add(id);wb.legacyIds.set(id,r.id);return {...r,id,stage:'model',field:'/service_tier'};});
  wb.rectifiers=[...wb.nativeRectifiers,...inherited];
  routeOptions('rectifier-provider','全部供应商');routeOptions('rectifier-preview-provider');
  rows();if(changed)invalidate();const port=getState().local?.listenPort;$('agent-openai-url').textContent=port?'http://127.0.0.1:'+port+'/v1':'连接后显示';$('agent-anthropic-url').textContent=port?'http://127.0.0.1:'+port:'连接后显示';updateButtons();renderChain();schedule();
 }
 function clear({preserveDrafts=false}={}){wb.pendingDelete=null;$('workbench-delete-dialog').close();$('chain-model-picker-dialog').close();clearTimeout(wb.timer);wb.timer=null;invalidate();wb.snapshot=null;wb.selectedTrace=null;if(!preserveDrafts){wb.agents=[];wb.rectifiers=[];wb.nativeRectifiers=[];wb.legacyIds.clear();wb.ruleDirty=false;wb.editingRule=null;wb.version=0;}renderChain();}
 if(supported){
  wb.requestObserver=new ResizeObserver(()=>renderRequests());wb.requestObserver.observe($('chain-requests'));
  wb.catalogObserver=new ResizeObserver(scheduleWires);$('chain-catalog').addEventListener('scroll',scheduleWires,{passive:true});
  $('chain-provider-add').addEventListener('click',()=>void action($('chain-provider-add'),()=>editProvider(null)));
  $('chain-model-add').addEventListener('click',()=>void action($('chain-model-add'),newOverviewModel));
  $('chain-model-picker-cancel').addEventListener('click',()=>$('chain-model-picker-dialog').close());
  $('chain-model-picker-confirm').addEventListener('click',()=>void action($('chain-model-picker-confirm'),()=>{const id=$('chain-model-provider').value;$('chain-model-picker-dialog').close();return editProvider(id,{addModel:true});}));
  for(const el of document.querySelectorAll('[data-v2]'))el.hidden=false;fields.forEach(([value,label])=>$('rectifier-field').append(option(value,label+' · '+value)));
  $('provider-model-add').addEventListener('click',()=>{try{addModel();}catch(error){notice(error.localMessage||'暂时无法添加模型。','error');}});
  entryIds.forEach(id=>$(id).addEventListener('change',()=>wb.entryTouched=true));
  $('route-protocol').addEventListener('change',()=>{if(!wb.entryTouched){const allowed=$('route-protocol').value==='anthropic'?['/v1/messages']:['/v1/responses','/v1/chat/completions'];entryIds.forEach((id,i)=>$(id).checked=allowed.includes(endpoints[i]));}const e=$('route-upstream-endpoint').value;if(e&&(e==='/v1/messages')!==($('route-protocol').value==='anthropic'))$('route-upstream-endpoint').value='';});
  for(const [id,callback]of [['rectifier-new',()=>editRule(null)],['rectifier-save',saveRule],['rectifier-delete',deleteRule],['rectifier-cancel',()=>editRule(wb.rectifiers.find(r=>r.id===wb.editingRule)||null,true)],['rectifier-preview-run',preview]])$(id).addEventListener('click',()=>void action($(id),callback));
  for(const [form,kind]of [['rectifier-form','rule']]){for(const type of ['input','change'])$(form).addEventListener(type,()=>{setDirty(kind);ruleValueState();});$(form).addEventListener('submit',e=>e.preventDefault());}
  for(const type of ['input','change'])$('rectifier-preview-form').addEventListener(type,invalidate);$('rectifier-preview-form').addEventListener('submit',e=>e.preventDefault());
  $('rectifier-filter').addEventListener('input',rows);$('rectifier-filter-stage').addEventListener('change',rows);
  for(const [id,stage]of [['chain-entry-rules','entry'],['chain-model-rules','model']])$(id).addEventListener('click',()=>{showTab('rectify');$('rectifier-filter-stage').value=stage;rows();});
  $('workbench-delete-cancel').addEventListener('click',()=>{wb.pendingDelete=null;$('workbench-delete-dialog').close();});
  $('workbench-delete-dialog').addEventListener('cancel',()=>wb.pendingDelete=null);
  $('workbench-delete-confirm').addEventListener('click',()=>void action($('workbench-delete-confirm'),async()=>{
   const pending=wb.pendingDelete;wb.pendingDelete=null;$('workbench-delete-dialog').close();if(!pending||!current(pending.scope))return;
   if(pending.version!==getState().configVersion||pending.id!==wb.editingRule)failLocal('配置或选择已变化，请重新发起删除。');
   await deleteRule(true);
  }));
  document.addEventListener('visibilitychange',()=>{schedule();scheduleWires();});
 }
 return {supported,getConfig,accept,hasConfiguredAgents:()=>Boolean(wb.agents.length),preferredAccess,accessChoices,needsAccessSync,synchronizeAccess,editRoute,routeValues,restoreRoute:()=>{if(supported)modelRows();},saveOverviewRoute,addModel,importModels,updateButtons,renderChain,clear,refreshChain:()=>{scheduleWires();void poll();}};
};

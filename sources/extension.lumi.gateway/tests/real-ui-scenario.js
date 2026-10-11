async () => {
 const $=id=>document.getElementById(id);
 const check=(condition,message)=>{if(!condition)throw new Error(message);};
 const until=async(predicate,message)=>{const deadline=performance.now()+10000;while(!predicate()){if(performance.now()>deadline)throw new Error(message+' · '+JSON.stringify({connection:$('connection-badge')?.textContent,listener:$('listener-state')?.textContent,active:$('active-count')?.textContent,startDisabled:$('listener-start')?.disabled,listenerHint:$('listener-control-hint')?.textContent,notice:$('status-message')?.textContent,tab:document.querySelector('.page-tabs .active')?.dataset.tab,routeDraft:$('route-draft-status')?.textContent}));await new Promise(resolve=>setTimeout(resolve,15));}};
 const visibleAction=element=>{
  check(Boolean(element),'action element is missing');
  const panel=element.closest('[data-panel]');
  check(!panel||!panel.hidden&&document.querySelector('.page-tabs .active')?.dataset.tab===panel.dataset.panel,'action is outside current page: '+(element.id||element.textContent));
  const details=[];for(let ancestor=element.parentElement;ancestor;ancestor=ancestor.parentElement)if(ancestor.tagName==='DETAILS')details.unshift(ancestor);
  for(const detail of details)if(!detail.open)detail.querySelector(':scope > summary').click();
  check(element.checkVisibility({checkVisibilityCSS:true})&&!element.closest('[hidden]'),'action is not visible: '+(element.id||element.textContent));element.scrollIntoView({block:'center',inline:'nearest'});return element;
 };
 const press=element=>visibleAction(element).click();
 const click=id=>press($(id==='listener-start'?'chain-listener-toggle':id));
 const tab=name=>{
  press(document.querySelector('[data-tab="'+name+'"]'));
  const active=[...document.querySelectorAll('.page-tabs button.active')],current=[...document.querySelectorAll('.page-tabs [aria-current="page"]')],panels=[...document.querySelectorAll('[data-panel]')].filter(panel=>!panel.hidden);
  check(active.length===1&&current.length===1&&active[0]===current[0]&&active[0].dataset.tab===name&&panels.length===1&&panels[0].dataset.panel===name,'active tab/panel/aria state inconsistent: '+name);
 };
 const set=(id,value)=>{const element=visibleAction($(id));check(!element.disabled,'cannot edit a disabled input: '+id);element.value=value;element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));};
 const submit=id=>press($(id).querySelector('[data-submit]'));
 const command=async(method,input={})=>{
  const id=crypto.randomUUID();
  const pending=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{removeEventListener('message',receive);reject(new Error('fixture command timeout '+method));},10000);function receive(event){if(event.source!==parent||event.data?.type!=='gateway-fixture-result'||event.data.id!==id)return;clearTimeout(timer);removeEventListener('message',receive);event.data.ok?resolve(event.data.result):reject(new Error(event.data.error));}addEventListener('message',receive);});
  parent.postMessage({type:'gateway-fixture-command',id,method,input},'*');return pending;
 };
  const routeButton = id => $('routes-list').querySelector('button[data-route-id="' + CSS.escape(id) + '"]');
  const ruleButton = id => $('rules-list').querySelector('button[data-rule-id="' + CSS.escape(id) + '"]');
 const checkDefaultDisclosures=()=>{for(const id of ['route-models-details','route-settings-details','rule-settings-details','preview-details']){const detail=$(id),content=detail?.querySelector('form,section');check(detail&&!detail.open&&content&&!content.checkVisibility({checkVisibilityCSS:true}),'actual default disclosure exposes long content: '+id);}};
 const passed=[],modeChecks=[];
 check(origin==='null','plugin origin is not opaque');
 check(typeof require==='undefined' && typeof process==='undefined','plugin exposes Node');
 let denied=false;try{void parent.document;}catch{denied=true;}check(denied,'plugin can read parent DOM');
 let networkDenied=false;try{await fetch('https://must-not-load.invalid/probe');}catch{networkDenied=true;}check(networkDenied,'CSP did not deny direct network');
 await until(()=>!$('setup-form').hidden&&!$('setup-form').querySelector('[data-submit]').disabled,'SDK and first setup state not ready');
 check(document.title==='模型网关'&&document.querySelector('.page-intro h1').textContent==='模型网关','model gateway document/header name mismatch');
 check([...document.querySelectorAll('.page-tabs button')].map(button=>button.textContent).join('|')==='运行概况|供应商与模型|整流规则|Agent 接入|请求记录|接入与设置','model gateway navigation labels mismatch');
 for(const [id,page] of [['setup-form','gateway'],['local-form','gateway'],['route-form','rules'],['rule-form','rules'],['preview-form','rules'],['filter-form','records'],['record-detail','records'],['cli-form','settings'],['recording-form','settings']])check($(id).closest('[data-panel]')?.dataset.panel===page,'feature placed in wrong page: '+id);
 check(Boolean($('cli-form').compareDocumentPosition($('recording-form'))&Node.DOCUMENT_POSITION_FOLLOWING),'CLI access must precede recording settings');
 check(!$('pair')&&!$('pairing-select'),'GUI requires technical manual pairing');
 const {setup:setupPorts,next:nextPorts,occupiedManagementPort}=await command('ports');
 set('setup-alias','GUI 内置网关');set('setup-port',String(setupPorts.listenPort));set('setup-management-port',String(occupiedManagementPort));
 set('setup-route-id','primary');set('setup-client','fixture-cli');set('setup-upstream','https://upstream.example/v1');
 set('setup-upstream-key','fixture-upstream-key-9876543210');set('setup-client-key','fixture-client-key-0123456789');
 check($('setup-upstream-key').type==='password'&&$('setup-client-key').type==='password','setup secret fields are not masked');
 submit('setup-form');check(!$('setup-upstream-key').value&&!$('setup-client-key').value,'setup secrets not cleared before awaiting host');
 await until(()=>$('setup-form').hidden&&!$('local-form').hidden&&$('status-message').classList.contains('error-banner')&&!$('local-form').querySelector('[data-submit]').disabled,'failed occupied-port setup did not offer GUI repair');
 check(!$('setup-upstream-key').value&&!$('setup-client-key').value&&$('connection-badge').textContent==='未连接','failed setup retained credentials or false connection');
 await command('assertOffline');
 set('local-alias','GUI 内置网关');set('local-port',String(setupPorts.listenPort));set('local-management-port',String(setupPorts.managementPort));submit('local-form');
 await until(()=>$('connection-badge').textContent==='已连接'&&routeButton('primary')&&$('setup-form').hidden&&$('body-state').textContent==='仅元数据'&&!$('local-form').querySelector('[data-submit]').disabled&&$('status-message').textContent.includes('已保存并重新连接'),'actual GUI setup did not connect');
 await until(()=>$('listener-state').textContent==='已停止','actual managed stopped status not observed');
 set('local-alias','GUI 更新网关');set('local-port',String(nextPorts.listenPort));set('local-management-port',String(nextPorts.managementPort));set('local-request-mib','2.5');set('local-concurrency','16');submit('local-form');
 await until(()=>$('connection-badge').textContent==='已连接'&&$('status-message').textContent.includes('已保存并重新连接')&&!$('local-form').querySelector('[data-submit]').disabled&&$('local-port').value===String(nextPorts.listenPort)&&$('local-management-port').value===String(nextPorts.managementPort),'actual GUI configuration did not reconnect');
 await until(()=>$('listener-state').textContent==='已停止'&&!$('route-new').disabled,'managed runtime did not report stopped after configure');
 await command('assertLocal');
 passed.push('GUI-setup/occupied-port-repair-without-secret-reentry/real-private-init/ports-configure/host-managed-auto-start');
 tab('rules');checkDefaultDisclosures();press(routeButton('primary'));checkDefaultDisclosures();click('rule-new');set('rule-id','reconnect-draft-only');
 for(const mode of ['override','set-if-missing']){
  set('rule-action',mode);set('rule-value','draft-'+mode);
  tab('gateway');set('local-alias','GUI 重连规则草稿 · '+mode);submit('local-form');
  await until(()=>$('connection-badge').textContent==='已连接'&&!$('local-form').querySelector('[data-submit]').disabled&&$('status-message').textContent.includes('已保存并重新连接'),'actual local configure did not reconnect a dirty rule '+mode);
  await until(()=>$('listener-state').textContent==='已停止','actual stopped state missing after dirty-rule reconnect');
  tab('rules');
  check($('rule-id').value==='reconnect-draft-only'&&$('rule-action').value===mode&&$('rule-value').value==='draft-'+mode&&!$('rule-value-label').hidden&&$('rule-draft-status').textContent.includes('未保存'),'actual reconnect lost a value-bearing rule draft or hid its value '+mode);
  set('rule-value','editable-after-reconnect-'+mode);check($('rule-value').value==='editable-after-reconnect-'+mode,'actual restored rule value was not editable '+mode);
 }
 click('rule-cancel');check(!$('rule-id').value&&!ruleButton('tier-rule'),'actual reconnect saved an unsaved rule draft');
 passed.push('actual-drafts/reconnect-override-and-set-if-missing/value-visible-editable/no-rule-write');

 tab('rules');press(routeButton('primary'));
 check(!$('route-models-detect').disabled,'saved primary catalog detection was disabled while stopped');click('route-models-detect');
 await until(()=>$('route-models-status').textContent.includes('模型目录：3 项')&&!$('route-models-detect').disabled,'actual primary model catalog did not load');
 check($('route-models-status').textContent.includes('检测时间')&&$('route-models-list').querySelectorAll('button').length===3,'actual catalog timestamp or list missing');
 check(!$('route-models-list').querySelector('img,script')&&$('route-models-list').textContent.includes('<img'),'actual model catalog IDs interpreted markup');
 press($('route-models-list').querySelectorAll('button')[1]);check($('preview-model').value==='provider/catalog-model-2026'&&$('preview-route').value==='primary','actual model catalog did not fill only local rule preview');
 $('route-models').scrollIntoView({block:'center'});await command('assertCatalog',{routeId:'primary',count:1});window.scrollTo(0,0);
 passed.push('actual-models-GET/saved-auth/no-inference/no-recording/text-safe/click-local-preview');
 tab('rules');click('route-new');set('route-id','secondary');set('route-client','second-cli');set('route-upstream','https://upstream.example/v1');
 set('route-upstream-key','fixture-secondary-upstream-key-9876543210');set('route-client-key','fixture-secondary-client-key-0123456789');check(!$('route-form').querySelector('[data-submit]').disabled,'actual new route submit was not enabled');submit('route-form');
 check(!$('route-upstream-key').value&&!$('route-client-key').value,'new route credentials were not cleared immediately');
 await until(()=>$('routes-list').querySelectorAll('button[data-route-id]').length===2&&!$('route-form').querySelector('[data-submit]').disabled&&$('status-message').textContent.includes('供应商、模型与显示设置已保存'),'actual GUI route did not save');
 set('route-upstream-key','fixture-secondary-rotated-upstream-key-9876543210');set('route-client-key','fixture-secondary-rotated-client-key-0123456789');submit('route-form');
 check(!$('route-upstream-key').value&&!$('route-client-key').value,'changed credentials remained visible');
 await until(()=>!$('route-form').querySelector('[data-submit]').disabled&&$('status-message').textContent.includes('供应商、模型与显示设置已保存'),'actual credential rotation failed');
 click('route-models-detect');await until(()=>$('route-models-status').textContent.includes('模型目录：3 项')&&!$('route-models-detect').disabled,'rotated saved route catalog did not load');
 $('route-models').scrollIntoView({block:'center'});await command('assertCatalog',{routeId:'secondary',count:2});window.scrollTo(0,0);
 check($('listener-state').textContent==='已停止','catalog detection unexpectedly started data listener');
 passed.push('actual-models-GET/rotated-saved-auth/no-listener-required');
 tab('gateway');click('listener-start');await until(()=>$('listener-state').textContent==='正在监听','managed listener did not start for rotated credentials');
 const rotatedAddress=$('listener-address').textContent;await command('assertManagedRoute',{address:rotatedAddress});
 check($('route-new').disabled&&$('route-delete').disabled,'listening did not lock route changes');
 click('listener-stop');click('listener-stop-confirm');await until(()=>$('listener-state').textContent==='已停止','managed listener did not stop after route probe');
 tab('rules');press(routeButton('secondary'));set('route-upstream-key','fixture-not-submitted-secret');tab('gateway');
 check(!$('route-upstream-key').value&&!$('route-client-key').value,'leaving route page did not clear credentials');
 tab('rules');click('route-cancel');press(routeButton('secondary'));click('route-delete');check($('route-delete-dialog').open,'route deletion did not confirm');click('route-delete-confirm');
 await until(()=>$('routes-list').querySelectorAll('button[data-route-id]').length===1&&$('status-message').textContent.includes('路由及其认证已删除'),'actual route deletion failed');
 await command('assertLocal');
 passed.push('GUI-route-create/credentials-rotate/actual-forward/delete/secrets-withdrawn');

 tab('gateway');click('listener-start');await until(()=>$('listener-state').textContent==='正在监听','actual data listener did not start');
 const address=$('listener-address').textContent;check(/^127\.0\.0\.1:\d+$/.test(address),'real loopback address missing');
 check(address==='127.0.0.1:'+nextPorts.listenPort,'configured data port did not take effect');
 passed.push('actual-TLS-connect/listener');

 tab('rules');click('rule-new');set('rule-id','tier-rule');set('rule-priority','100');set('rule-route','primary');set('rule-action','preserve');submit('rule-form');
 await until(()=>ruleButton('tier-rule')&&!$('rule-form').querySelector('[data-submit]').disabled&&$('status-message').textContent.includes('规则已保存'),'GUI initial rule did not save');
 press(ruleButton('tier-rule'));
 check($('route-new').disabled&&$('route-delete').disabled,'route mutations not locked while listening');
 press(routeButton('primary'));
 check($('route-id').readOnly&&!$('route-credential'),'route ID should be fixed while saved credential reference stays internal');
 for(const mode of ['preserve','remove','set-if-missing','override']){
  set('rule-action',mode);if(['set-if-missing','override'].includes(mode))set('rule-value','priority');
  submit('rule-form');await until(()=>!$('rule-form').querySelector('[data-submit]').disabled&&$('status-message').textContent.includes('规则已保存'),'rule did not save '+mode);
  const hasOriginal=mode!=='set-if-missing';
  set('preview-state',hasOriginal?'string':'missing');if(hasOriginal)set('preview-value','flex');submit('preview-form');await until(()=>$('preview-output').textContent.includes('命中规则'),'preview missing '+mode);
  const sent=await command('send',{address,mode,body:hasOriginal?'{"model":"fixture-model","service_tier":"flex","input":"原始请求","large":123456789012345678901234567890,"nested":{"service_tier":"untouched"}}':'{"model":"fixture-model","input":"原始请求","large":123456789012345678901234567890,"nested":{"service_tier":"untouched"}}'});
  check(sent.httpStatus===200&&sent.reported==='default','actual upstream response missing');
  check(sent.forwardedTier===(mode==='preserve'?'flex':mode==='remove'?null:'priority'),'actual outbound tier mismatch '+mode);
  check(sent.nested==='untouched'&&sent.largeExact,'non-top-level bytes were edited');
  modeChecks.push({mode,original:hasOriginal?'flex':'missing',forwarded:sent.forwardedTier,reported:sent.reported});
 }
 passed.push('four-tier-actions/outbound/exact-large-and-nested-bytes');

 tab('records');await until(()=>$('records-body').querySelectorAll('button').length===4,'actual records did not appear');
 check($('records-body').textContent.includes('flex → priority → default'),'three actual tier values missing');
 check($('records-body').textContent.includes('11 入 / 5 出'),'actual usage missing');
 await command('assertRecords',{count:4});
 press($('records-body').querySelector('button'));await until(()=>!$('record-detail').hidden,'actual details missing');
 visibleAction($('detail-body-toggle')).checked=true;$('detail-body-toggle').dispatchEvent(new Event('change',{bubbles:true}));await until(()=>$('status-message').textContent.includes('操作未完成')||$('detail-body-info').textContent.includes('没有'),'metadata-only record unexpectedly loaded body');
 check($('detail-body').hidden,'body existed before consent');
 passed.push('three-tier-values/actual-records/default-metadata');

 const customChecks=[];
 tab('rules');press(ruleButton('tier-rule'));
 for(const [value,httpStatus] of [['provider_custom-2026',200],['provider_rejected-2026',400]]){
  set('rule-action','override');set('rule-value',value);submit('rule-form');
  await until(()=>!$('rule-form').querySelector('[data-submit]').disabled&&$('status-message').textContent.includes('规则已保存')&&$('rule-value').value===value,'custom tier did not persist '+value);
  set('preview-state','string');set('preview-value','flex');submit('preview-form');
  await until(()=>$('preview-output').textContent.includes('发送：'+value),'custom tier preview missing '+value);
  const sent=await command('send',{address,mode:'custom',body:'{"model":"fixture-model","service_tier":"flex","input":"自定义档位请求"}'});
  check(sent.forwardedTier===value&&sent.httpStatus===httpStatus,'custom tier actual request/status mismatch '+value);
  if(httpStatus===200)check(sent.reported==='default','custom request fabricated returned tier');
  else check(sent.responseError==='unsupported_service_tier'&&sent.reported===undefined,'unsupported custom value did not return original upstream refusal');
  customChecks.push({value,httpStatus,forwarded:sent.forwardedTier,reported:sent.reported??'missing'});
 }
 const customRecords=await command('assertCustomRecords');
 check(customRecords.noRetry&&customRecords.upstreamRequests===6,'unsupported tier retried or fell back');
 passed.push('custom-tier-values/outbound/recording/upstream-refusal-no-retry');
 set('rule-value','provider_custom-2026');submit('rule-form');
 await until(()=>!$('rule-form').querySelector('[data-submit]').disabled&&$('status-message').textContent.includes('规则已保存')&&$('rule-value').value==='provider_custom-2026','custom tier reset failed');

 tab('settings');visibleAction($('recording-bodies')).checked=true;$('recording-bodies').dispatchEvent(new Event('change',{bubbles:true}));submit('recording-form');await until(()=>$('status-message').textContent.includes('请先确认'),'body enable missing consent');
 visibleAction($('recording-consent')).checked=true;submit('recording-form');await until(()=>$('body-state').textContent==='加密正文'&&!$('recording-form').querySelector('[data-submit]').disabled,'actual body setting failed');
 await command('send',{address,mode:'body',body:JSON.stringify({model:'fixture-model',service_tier:'flex',input:'脱敏记录正文',api_key:('fake-request-'+'body-secret')})});
 tab('records');click('records-refresh');await until(()=>$('records-body').querySelectorAll('button').length===7,'body record missing after explicit refresh');
 press($('records-body').querySelector('button'));await until(()=>!$('record-detail').hidden,'body detail missing');
 visibleAction($('detail-body-toggle')).checked=true;$('detail-body-toggle').dispatchEvent(new Event('change',{bubbles:true}));await until(()=>!$('detail-body').hidden&&$('detail-body').textContent.includes('脱敏记录正文'),'real encrypted body did not load');
 check($('detail-body').textContent.includes('[REDACTED]')&&!$('detail-body').textContent.includes('fake-request-body-secret')&&!$('detail-body').textContent.includes('fake-body-secret'),'record body was not redacted');
 check(!$('detail-body').querySelector('script'),'body interpreted HTML');
 passed.push('body-consent/encrypted-redacted-body');

 tab('settings');submit('cli-form');await until(()=>!$('cli-preview').hidden&&!$('cli-apply').disabled,'real CLI preview failed');
 check(!$('cli-differences').textContent.includes('fixture-client-key'),'CLI preview leaked key');
 click('cli-apply');await until(()=>!$('cli-recovery').hidden&&$('cli-recovery-description').textContent.includes('已应用'),'real CLI apply failed');
 await command('assertCli',{state:'applied',address});
 tab('gateway');click('listener-restore-stop');await until(()=>$('listener-state').textContent==='已停止'&&$('cli-recovery-description').textContent.includes('已恢复'),'restore-before-stop failed');
 await command('assertCli',{state:'restored',address});
 check($('listener-restore-stop').disabled,'restored transaction still actionable');
 click('listener-start');await until(()=>$('listener-state').textContent==='正在监听','listener restart failed');
 passed.push('real-CLI-preview/apply/restore-before-stop');
 const pagination=await command('populatePagination',{address});check(pagination.records===51&&pagination.isolatedUpstreamRequests===51,'actual first-page pagination fixture missing');
 tab('records');set('filter-model','fixture-pagination-model');submit('filter-form');
 await until(()=>$('records-body').querySelectorAll('button').length===50&&!$('records-more').disabled,'actual 50-row first page missing');
 check($('record-detail').hidden&&!$('record-selected-count').textContent.includes('选中 1'),'actual append must begin without a detail or selection');
 const beforeAppend=await command('recordsSnapshot');await command('holdRecordsAppend');click('records-more');
 const heldAppend=await command('recordsSnapshot');check(heldAppend.appendPending&&heldAppend.listCalls===beforeAppend.listCalls+1&&$('records-more').disabled,'actual first append was not held in flight');
 const eventProof=await command('emitRecordSummary');check(eventProof.recordSummaryFixture&&eventProof.productionEventDelivery,'record summary fixture missed production event delivery');
 await new Promise(resolve=>setTimeout(resolve,220));
 const afterEvent=await command('recordsSnapshot');
 check(afterEvent.appendPending&&afterEvent.listCalls===beforeAppend.listCalls+1&&$('records-body').querySelectorAll('button').length===50&&!$('records-update-note').hidden,'record summary raced actual first append with an automatic first-page request');
 await command('releaseRecordsAppend');await until(()=>$('records-body').querySelectorAll('button').length===51&&$('records-more').hidden,'actual first append was withdrawn by the record summary');
 check((await command('recordsSnapshot')).listCalls===beforeAppend.listCalls+1&&!$('records-update-note').hidden,'record summary replaced the actual appended page or lost its notice');
 await command('clearPagination');click('filter-reset');await until(()=>$('records-body').querySelectorAll('button').length===7&&!$('filter-reset').disabled,'pagination fixtures did not return to the original request scope');
 passed.push('actual-records/50-row-first-append-in-flight/fixture-summary-production-delivery/no-first-page-race');

 const denseDisplay=await window.gatewayDenseScenario({control:async(method,input)=>command(method==='snapshot'?'sdkSnapshot':method,input),check,until,tab,set,click,press,visibleAction,submit,routeId:'primary',passed});
 const workbench=await window.gatewayV2Scenario({check,until,tab,set,click,press,visibleAction,submit,command,passed});
 const overview=await window.gatewayOverviewScenario({check,until,tab,set,click,press,visibleAction,submit,command,passed});
 return {overview,workbench,passed,modeChecks,customChecks,opaqueOrigin:true,nodeUnavailable:true,hostDomDenied:true,directNetworkDenied:true,rendered:true,defaultDisclosuresClosed:true,denseDisplay};
}

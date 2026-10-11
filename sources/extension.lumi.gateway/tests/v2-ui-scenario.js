async ({check,until,tab,set,click,press,visibleAction,submit,command,passed}) => {
 const $=id=>document.getElementById(id);
 tab('gateway');click('listener-stop');click('listener-stop-confirm');await until(()=>$('listener-state').textContent==='已停止'&&$('active-count').textContent==='0','v2 requires stopped listener');
 tab('rules');press($('routes-list').querySelector('[data-route-edit="primary"]'));
 set('route-name','页面供应商');set('route-upstream-endpoint','/v1/responses');
 for(const id of ['route-entry-responses','route-entry-chat','route-entry-messages']){const box=visibleAction($(id));if(!box.checked)press(box);}
 for(const [index,id,actual]of [[0,'ui-model-a','actual-ui-model-a'],[1,'ui-model-b','actual-ui-model-b']]){click('provider-model-add');set('provider-model-'+index+'-id',id);set('provider-model-'+index+'-upstreamModel',actual);}
 submit('route-form');await until(()=>$('status-message').textContent.includes('供应商、模型与显示设置已保存')&&!$('route-form').querySelector('[data-submit]').disabled,'v2 provider save failed');
 check($('route-name').value==='页面供应商'&&$('provider-model-list').children.length===2,'supplier model configuration was not restored');
 const stored=await command('v2Config');check(stored.models.length===2&&stored.upstreamEndpoint==='/v1/responses'&&stored.entryEndpoints.length===3,'provider/model controls did not persist through actual host');
 passed.push('v2/provider-owned-url-auth-protocol/two-model-aliases/three-entry-endpoints');
 tab('agents');click('agent-new');set('agent-id','ui-agent');set('agent-name','页面 Agent');set('agent-credential','primary');
 for(const box of $('agent-providers').querySelectorAll('input')){visibleAction(box);if(box.checked!==(box.value==='primary'))press(box);}
 click('agent-save');await until(()=>$('agent-list').textContent.includes('页面 Agent')&&!$('agent-save').disabled&&$('status-message').textContent.includes('Agent 接入范围已保存'),'v2 Agent save failed');
 set('agent-name','未保存 Agent');click('agent-new');check($('agent-name').value==='未保存 Agent'&&$('status-message').textContent.includes('未保存'),'dirty Agent was replaced');click('agent-cancel');check($('agent-name').value==='页面 Agent','Agent cancel failed');
 passed.push('v2/actual-Agent-config/credential-reference/provider-scope/unsaved-draft');
 tab('rectify');click('rectifier-new');set('rectifier-id','ui-temperature');set('rectifier-stage','entry');set('rectifier-priority','100');set('rectifier-agent','ui-agent');set('rectifier-field','/temperature');set('rectifier-action','clamp');set('rectifier-min','0');set('rectifier-max','0.4');click('rectifier-save');
 await until(()=>$('rectifier-list').textContent.includes('ui-temperature')&&!$('rectifier-save').disabled&&$('status-message').textContent.includes('已保存'),'entry rectifier save failed');
 click('rectifier-new');set('rectifier-id','ui-tier');set('rectifier-stage','model');set('rectifier-priority','100');set('rectifier-provider','primary');set('rectifier-agent','ui-agent');set('rectifier-field','/service_tier');set('rectifier-action','override');set('rectifier-value-type','string');set('rectifier-value','priority');click('rectifier-save');
 await until(()=>$('rectifier-list').textContent.includes('ui-tier')&&!$('rectifier-save').disabled&&$('status-message').textContent.includes('已保存'),'model rectifier save failed');
 set('rectifier-preview-provider','primary');set('rectifier-preview-agent','ui-agent');set('rectifier-preview-endpoint','/v1/responses');
 const request={model:'ui-model-a',temperature:0.9,input:'隔离页面整流验证',max_output_tokens:128};const large='123456789012345678901234567890';const requestBody=JSON.stringify(request).replace(/}$/,' ,"opaque_number":'+large+'}');set('rectifier-preview-body',requestBody);const before=await command('v2Config');click('rectifier-preview-run');
 await until(()=>$('rectifier-preview-result').querySelectorAll('pre').length===3&&!$('rectifier-preview-run').disabled,'v2 preview failed');
 const preview=[...$('rectifier-preview-result').querySelectorAll('pre')].map(el=>JSON.parse(el.textContent));
 check(preview[0].temperature===0.9&&preview[1].temperature===0.4&&preview[2].model==='actual-ui-model-a'&&preview[2].service_tier==='priority','v2 preview stage values wrong');
 check((await command('v2Config')).forwarded===before.forwarded,'preview sent upstream request');
 set('rectifier-preview-body',JSON.stringify({...request,temperature:0.7}));check(!$('rectifier-preview-result').childNodes.length,'changed preview input retained stale result');set('rectifier-preview-body',requestBody);click('rectifier-preview-run');await until(()=>$('rectifier-preview-result').querySelectorAll('pre').length===3&&!$('rectifier-preview-run').disabled,'fresh preview did not finish');const previewBodies=[...$('rectifier-preview-result').querySelectorAll('pre')].map(el=>el.textContent);check(previewBodies.every(body=>body.includes(large)),'preview display lost large numeric bytes');
 passed.push('v2/two-stage-rule-controls/typed-clamp/string-override/preview-no-request/preview-withdrawal');
 tab('gateway');click('listener-start');await until(()=>$('listener-state').textContent==='正在监听','v2 listener did not start');
 const address=$('listener-address').textContent;
 const native=await command('v2Send',{address,body:requestBody,routeId:null,endpoint:'/v1/responses'});
 check(native.status===200&&native.forwarded===1&&native.sentBody===previewBodies[2],'actual request differs from preview: '+JSON.stringify({native,preview:preview[2]}));
 await until(()=>$('chain-agent').textContent==='页面 Agent'&&$('chain-model').textContent==='actual-ui-model-a'&&$('chain-events').children.length===5,'actual request chain did not render');
 check($('chain-provider').textContent==='页面供应商'&&$('chain-changes').textContent.includes('/temperature')&&$('chain-changes').textContent.includes('/service_tier')&&$('chain-changes').textContent.includes('default'),'actual chain lacks provider/rules/reported-tier');
 click('chain-entry-rules');check($('rectifier-filter-stage').value==='entry'&&$('rectifier-list').textContent.includes('ui-temperature')&&!$('rectifier-list').textContent.includes('ui-tier'),'entry link did not filter the entry rules');
 tab('gateway');click('chain-model-rules');check($('rectifier-filter-stage').value==='model'&&$('rectifier-list').textContent.includes('ui-tier')&&!$('rectifier-list').textContent.includes('ui-temperature'),'model link did not filter the model rules');set('rectifier-filter-stage','');
 const chat=await command('v2Send',{address,routeId:null,endpoint:'/v1/chat/completions',body:{model:'ui-model-b',temperature:0.6,messages:[{role:'user',content:'隔离转换验证'}],max_completion_tokens:128}});
 check(chat.status===200&&chat.forwarded===1&&chat.sent.model==='actual-ui-model-b'&&chat.sent.temperature===0.4&&chat.sent.service_tier==='priority'&&JSON.parse(chat.body).choices[0].message.content.includes('真实 TLS'),'actual Chat to Responses conversion failed');
 const denied=await command('v2Send',{address,routeId:'dense-openai-secondary',endpoint:'/v1/responses',body:{model:'ui-model-a',input:'不允许的供应商'}});check(denied.status===403&&denied.forwarded===0,'Agent provider scope did not reject before upstream');
 tab('gateway');await until(()=>$('chain-model').textContent==='actual-ui-model-b'&&$('chain-events').children.length===5,'second real request chain missing');
 const snapshot=await command('v2Chain');check(snapshot.traces.some(row=>row.agentId==='ui-agent'&&row.chain?.upstreamModel==='actual-ui-model-b')&&!JSON.stringify(snapshot).includes('隔离转换验证'),'chain snapshot missing actual request or leaked body');
 passed.push('v2/unified-authenticated-entry/preview-equals-real-send/Chat-to-Responses/Agent-provider-denial/real-five-event-chain');
 tab('rectify');click('rectifier-new');set('rectifier-id','ui-delete-probe');set('rectifier-action','preserve');click('rectifier-save');await until(()=>$('rectifier-list').textContent.includes('ui-delete-probe')&&!$('rectifier-save').disabled,'delete probe was not saved');click('rectifier-delete');check($('workbench-delete-dialog').open,'delete did not ask confirmation');click('workbench-delete-cancel');check($('rectifier-list').textContent.includes('ui-delete-probe'),'cancelled delete removed rule');await until(()=>!$('rectifier-delete').disabled,'delete action remained locked');click('rectifier-delete');await until(()=>$('workbench-delete-dialog').open,'second delete did not open confirmation');click('workbench-delete-confirm');await until(()=>!$('rectifier-list').textContent.includes('ui-delete-probe')&&$('status-message').textContent.includes('已删除'),'confirmed rule delete failed');
 press($('rectifier-list').querySelector('[data-rectifier-id="ui-tier"]'));set('rectifier-preview-body',requestBody);click('rectifier-preview-run');await until(()=>$('rectifier-preview-result').querySelectorAll('pre').length===3&&!$('rectifier-preview-run').disabled,'final preview missing');
 passed.push('v2/actual-rule-delete/explicit-confirmation/cancel-preserves');
 tab('rules');for(const id of ['route-models-details','route-settings-details','rule-settings-details','preview-details'])$(id).open=false;
 return {provider:'primary',models:stored.models,agent:'ui-agent',rectifiers:2,realRequests:2,deniedBeforeUpstream:true,previewMatches:true};
}

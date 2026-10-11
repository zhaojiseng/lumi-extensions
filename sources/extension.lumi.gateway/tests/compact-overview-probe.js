() => {
 const $=id=>document.getElementById(id),check=(condition,label)=>{if(!condition)throw new Error(label);};
 const rect=el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
 const close=(a,b)=>Math.abs(a-b)<2.5,root=$('chain-flow'),flow=rect(root),header=rect($('gateway-overview-header')),addresses=rect($('gateway-overview-addresses')),panel=rect($('chain-panel')),clip=rect($('chain-catalog'));
 check($('chain-listener-toggle').closest('.gateway-lumi-node')&&!$('chain-listener-toggle').closest('#gateway-overview-header'),'gateway switch is outside the Lumi node');
 const pageRightGap=innerWidth-panel.right,bodyStyle=getComputedStyle(document.body),switchBounds=rect($('chain-listener-toggle')),switchHit=document.elementFromPoint(switchBounds.left+switchBounds.width/2,switchBounds.top+switchBounds.height/2);
 check(pageRightGap>=11.5,'overview border is covered by the right scrolling edge: '+JSON.stringify({pageRightGap,panel,innerWidth,bodyWidth:document.body.clientWidth,padding:bodyStyle.paddingInlineEnd,gutter:bodyStyle.scrollbarGutter,layout:document.body.dataset.lumiLayout}));
 check(bodyStyle.scrollbarGutter==='stable'&&parseFloat(bodyStyle.paddingInlineEnd)>=12,'page scroll area has no stable right inset');
 const switchInView=switchBounds.top>=0&&switchBounds.bottom<=innerHeight;
 if(switchInView)check(switchHit?.id==='chain-listener-toggle','Lumi settings target covers the gateway switch');
 check(header.bottom<=addresses.top+2&&addresses.bottom<=flow.top+2,'status and connection addresses are not above the graph');
 check(document.body.scrollWidth<=innerWidth+2&&document.documentElement.scrollWidth<=innerWidth+2,'overview overflows the viewport');
 const agent=root.querySelector('.gateway-agent-node'),lumi=root.querySelector('.gateway-lumi-node'),providerNodes=[...root.querySelectorAll('[data-chain-provider-id]')],models=[...root.querySelectorAll('[data-chain-model-id]')];
 const edges=[];for(const path of root.querySelectorAll('svg path')){
  const kind=path.dataset.edge,svg=rect(path.ownerSVGElement),first=path.getPointAtLength(0),last=path.getPointAtLength(path.getTotalLength()),from=kind==='entry'?agent:kind==='selection'?lumi:providerNodes.find(p=>p.dataset.chainProviderId===path.dataset.providerId),to=kind==='entry'?lumi:kind==='selection'?providerNodes.find(p=>p.dataset.chainProviderId===path.dataset.providerId):models.find(m=>m.dataset.providerId===path.dataset.providerId&&m.dataset.chainModelId===path.dataset.modelId);
  check(from&&to,'wire has no corresponding node');const a=rect(from),b=rect(to),vertical=kind==='selection'&&b.left<a.right-2,start={x:first.x+svg.left,y:first.y+svg.top},end={x:last.x+svg.left,y:last.y+svg.top};
  check(path.getAttribute('d').includes(' C '),'module connection is not a curve');
  check(close(start.x,vertical?a.left+a.width/2:a.right)&&close(start.y,vertical?a.bottom:a.top+a.height/2)&&close(end.x,vertical?b.left+b.width/2:b.left)&&close(end.y,vertical?b.top:b.top+b.height/2),'curve is detached from actual node edges');
  check(getComputedStyle(path.ownerSVGElement).pointerEvents==='none','curve intercepts node clicks');
  edges.push({kind,providerId:path.dataset.providerId||null,modelId:path.dataset.modelId||null,vertical,selected:path.classList.contains('is-selected')});
 }
 const catalogStyle=getComputedStyle($('chain-catalog'));
 check(catalogStyle.maxHeight==='none'&&catalogStyle.overflowY==='visible','model catalog still has a fixed clipping/scrolling area');
 check($('chain-catalog').scrollHeight<=$('chain-catalog').clientHeight+2,'catalog content was truncated');
 for(const model of models){const bounds=rect(model);check(bounds.top>=clip.top-2&&bounds.bottom<=clip.bottom+2,'model is outside its natural catalog bounds');}
 const cardRow=$('chain-requests'),cards=[...cardRow.children],cardStyle=getComputedStyle(cardRow),cardChecks=[];
 check(cardStyle.flexDirection==='row'&&cardStyle.flexWrap==='nowrap','recent requests did not remain in one row');
 for(const card of cards){const bounds=rect(card);check(bounds.height>=60&&bounds.height<=68&&close(bounds.top,rect(cards[0]).top),'request cards are tall or stacked');check(bounds.left>=rect(cardRow).left-1&&bounds.right<=rect(cardRow).right+1,'visible request card was partially clipped');check(card.querySelector('strong')&&card.querySelector('[data-metric=rate]')&&card.querySelector('[data-metric=elapsed]'),'request card lacks model/rate/time');cardChecks.push({model:card.querySelector('strong').textContent,rate:card.querySelector('[data-metric=rate]').textContent,elapsed:card.querySelector('[data-metric=elapsed]').textContent,height:bounds.height});}
 if(cards.length)check(!$('chain-diagnostics').open,'diagnostics unexpectedly expanded the compact request area');
 check(edges.filter(e=>e.kind==='entry').length===1,'missing Agent to Lumi curve');
 check(edges.filter(e=>e.kind==='selection').length===providerNodes.length,'missing Lumi to supplier curve');
 check(edges.filter(e=>e.kind==='model').length===models.length,'model ownership curves are missing');
 const pageBottomGap=innerHeight-panel.bottom,tabBounds=rect($('tab-gateway')),footer=document.querySelector('.page-footer'),footerBounds=footer?rect(footer):null,bottomInset=innerHeight-(footerBounds?.bottom??panel.bottom),pageGap=parseFloat(getComputedStyle(document.querySelector('.gateway-page')).rowGap);
 check(Math.abs(panel.height-tabBounds.height)<2.5,'overview panel did not occupy its available tab space');
 check(parseFloat(bodyStyle.paddingBlockEnd)>=16,'page has no bottom inset');
 if(document.body.scrollHeight<=document.body.clientHeight+2){check(bottomInset>=15.5&&bottomInset<=18.5,'overview does not fill the viewport with its bottom gap: '+JSON.stringify({pageBottomGap,bottomInset,panel,footerBounds,innerHeight}));if(footerBounds)check(Math.abs(footerBounds.top-panel.bottom-pageGap-parseFloat(getComputedStyle(footer).marginTop))<2.5,'overview leaves unused space before the page footer: '+JSON.stringify({panel,footerBounds,pageGap,footerMargin:getComputedStyle(footer).marginTop}));}
 check($('gateway-overview-addresses').children.length===2&&!$('chain-panel').querySelector('.gateway-runtime-strip,.gateway-overview-connection'),'overview did not simplify to two addresses');
 check(!document.querySelector('#chain-panel #listener-address'),'runtime details still occupy the overview');
 for(const id of ['chain-requests','chain-events','chain-changes'])if(!$(id).children.length)check($(id).hidden,'empty request region still occupies layout');
 return {width:innerWidth,height:innerHeight,pageBottomGap,bottomInset,pageRightGap,bodyRightPadding:bodyStyle.paddingInlineEnd,scrollbarGutter:bodyStyle.scrollbarGutter,switchHit:switchHit?.id||null,switchInView,catalogHeight:clip.height,pageScrollTop:document.body.scrollTop,cardChecks,panelHeight:panel.height,headerHeight:header.height,edges,openai:$('overview-openai-url').textContent,anthropic:$('overview-anthropic-url').textContent,management:$('overview-management-address').textContent,providerCount:providerNodes.length,modelCount:models.length};
}

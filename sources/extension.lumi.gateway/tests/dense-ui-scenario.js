async ({ control, check, until, tab, set, click, press, visibleAction, submit, routeId, passed }) => {
  const $ = id => document.getElementById(id);
  const routeButton = id => $('routes-list').querySelector('button[data-route-id="' + CSS.escape(id) + '"]');
  const ruleButton = id => $('rules-list').querySelector('button[data-rule-id="' + CSS.escape(id) + '"]');
  const row = (kind, id) => $(kind + 's-list').querySelector('tr[data-' + kind + '-id="' + CSS.escape(id) + '"]');
  const ids = kind => [...$(kind + 's-list').querySelectorAll('button[data-' + kind + '-id]')].map(button => button.dataset[kind + 'Id']);
  const snapshot = () => control('snapshot');
  const calls = value => Object.values(value.counts).reduce((sum, count) => sum + count, 0);
  const selected = kind => [...$(kind + 's-list').querySelectorAll('button[data-' + kind + '-id][aria-pressed="true"]')].map(button => button.dataset[kind + 'Id']);
  const setChecked = (id, value) => { const input = visibleAction($(id)); check(!input.disabled, 'dense fixture checkbox disabled: ' + id); input.checked = value; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); };
  const closeDetails = () => { for (const id of ['route-models-details', 'route-settings-details', 'rule-settings-details', 'preview-details']) if ($(id).open) press($(id).querySelector(':scope > summary')); };
  const checkClosedContents = () => {
    for (const id of ['route-models-details', 'route-settings-details', 'rule-settings-details', 'preview-details']) {
      const detail = $(id), content = detail.querySelector('form, section');
      check(!detail.open && content && !content.checkVisibility({ checkVisibilityCSS: true }), 'closed dense disclosure still exposes its content: ' + id);
    }
  };
  const checkRevealedEditor = id => {
    const detail = $(id), summary = detail.querySelector(':scope > summary'), rect = summary.getBoundingClientRect();
    check(detail.open && summary.checkVisibility({ checkVisibilityCSS: true }) && rect.top >= -1 && rect.bottom <= window.innerHeight + 1, 'explicit edit did not reveal its editor in the viewport: ' + id + ' ' + JSON.stringify({ top: rect.top, bottom: rect.bottom, height: window.innerHeight }));
  };
  const selectWithoutReveal = (kind, id) => {
    const button = visibleAction(kind === 'route' ? routeButton(id) : ruleButton(id));
    const scrollBefore = { x: window.scrollX, y: window.scrollY };
    button.click();
    checkClosedContents();
    check(window.scrollX === scrollBefore.x && window.scrollY === scrollBefore.y, 'ordinary ' + kind + ' selection scrolled to a hidden editor');
  };
  tab('gateway');
  if ($('listener-state').textContent === '正在监听') { click('listener-stop'); click('listener-stop-confirm'); await until(() => $('listener-state').textContent === '已停止', 'dense fixtures require a stopped listener'); }
  await until(() => !$('route-new').disabled, 'route editor did not become ready for dense fixtures');
  tab('rules'); press(routeButton(routeId)); press(ruleButton('tier-rule'));
  const baseRoute = { id: routeId, clientAlias: $('route-client').value, protocol: $('route-protocol').value, upstreamBase: $('route-upstream').value, enabled: $('route-enabled').checked };
  const baseRule = { id: 'tier-rule', enabled: $('rule-enabled').checked, priority: Number($('rule-priority').value), match: {}, action: { type: $('rule-action').value } };
  for (const [key, id] of [['routeId', 'rule-route'], ['clientAlias', 'rule-client'], ['model', 'rule-model'], ['endpoint', 'rule-endpoint']]) if ($(id).value) baseRule.match[key] = $(id).value;
  if (['override', 'set-if-missing'].includes(baseRule.action.type)) baseRule.action.value = $('rule-value').value;
  const routes = [baseRoute,
    { id: 'dense-openai-secondary', clientAlias: 'dense-openai-client', protocol: 'openai', upstreamBase: 'https://upstream.example/v1/dense-openai', enabled: true },
    { id: 'dense-claude', clientAlias: 'dense-claude-client', protocol: 'anthropic', upstreamBase: 'https://upstream.example/anthropic', enabled: true },
    { id: 'dense-paused', clientAlias: 'dense-paused-client', protocol: 'openai', upstreamBase: 'https://upstream.example/v1/paused', enabled: false },
  ];
  for (const route of routes.slice(1)) {
    click('route-new'); checkRevealedEditor('route-settings-details');
    set('route-id', route.id); set('route-client', route.clientAlias); set('route-protocol', route.protocol); set('route-upstream', route.upstreamBase); setChecked('route-enabled', route.enabled);
    set('route-upstream-key', 'fixture-dense-upstream-key-9876543210'); set('route-client-key', 'fixture-dense-client-key-0123456789'); submit('route-form');
    await until(() => routeButton(route.id) && !$('route-form').querySelector('[data-submit]').disabled && $('status-message').textContent.includes('供应商、模型与显示设置已保存'), 'dense route did not save: ' + route.id);
  }
  const completeMatch = { routeId, clientAlias: 'dense-matching-client', model: 'provider/full-model-2026', endpoint: '/v1/responses' };
  const rules = [baseRule,
    { id: 'dense-specific-complete', enabled: true, priority: 80, match: completeMatch, action: { type: 'override', value: 'provider_custom-2026' } },
    { id: 'dense-disabled-high', enabled: false, priority: 200, match: { routeId: 'dense-claude', clientAlias: 'dense-claude-client', model: 'claude-sonnet-2026', endpoint: '/v1/messages' }, action: { type: 'preserve' } },
    { id: 'dense-universal-preserve', enabled: true, priority: 10, match: {}, action: { type: 'preserve' } },
    { id: 'dense-tie-remove', enabled: true, priority: 80, match: completeMatch, action: { type: 'remove' } },
    { id: 'dense-missing-priority', enabled: true, priority: 30, match: { routeId, model: '<img src="https://must-not-load.invalid/rule" onerror="alert(1)">', endpoint: '/v1/responses' }, action: { type: 'set-if-missing', value: 'priority' } },
  ];
  for (const rule of rules.slice(1)) {
    click('rule-new'); checkRevealedEditor('rule-settings-details');
    set('rule-id', rule.id); set('rule-priority', String(rule.priority)); setChecked('rule-enabled', rule.enabled);
    for (const [key, id] of [['routeId', 'rule-route'], ['clientAlias', 'rule-client'], ['model', 'rule-model'], ['endpoint', 'rule-endpoint']]) set(id, rule.match[key] || '');
    set('rule-action', rule.action.type); if (rule.action.value) set('rule-value', rule.action.value); submit('rule-form');
    await until(() => ruleButton(rule.id) && !$('rule-form').querySelector('[data-submit]').disabled && $('status-message').textContent.includes('规则已保存'), 'dense rule did not save: ' + rule.id);
  }
  closeDetails(); checkClosedContents();
  press($('rules-list').querySelector('button[data-rule-edit="dense-disabled-high"]'));
  checkRevealedEditor('rule-settings-details');
  check($('rule-endpoint').value === '/v1/messages', 'editing a saved Messages rule lost its endpoint condition');
  submit('rule-form'); await until(() => !$('rule-form').querySelector('[data-submit]').disabled && $('status-message').textContent.includes('规则已保存'), 'saved Messages rule did not save again');
  const savedMessages = (await snapshot()).lastRulesWrite.find(rule => rule.id === 'dense-disabled-high');
  check(savedMessages?.match.endpoint === '/v1/messages' && savedMessages.action.type === 'preserve' && savedMessages.enabled === false, 'saving an existing Messages rule dropped its endpoint/preserve/disabled fields');
  closeDetails(); checkClosedContents();
  check(ids('route').join('|') === routes.map(route => route.id).join('|') && ids('rule').join('|') === rules.map(rule => rule.id).join('|'), 'dense lists changed the stored route or rule order');
  for (const route of routes) {
    const item = row('route', route.id);
    check(item?.querySelectorAll('td').length === 6 && [route.id, route.clientAlias, route.upstreamBase, route.protocol === 'openai' ? 'OpenAI' : 'Anthropic'].every(text => item.textContent.includes(text)), 'dense route summary lost saved fields: ' + route.id);
    check(!/fixture-dense-(upstream|client)-key/.test(item.textContent), 'route summary exposed a credential');
    const applicable = rules.filter(rule => !rule.match.routeId || rule.match.routeId === route.id), enabled = applicable.filter(rule => rule.enabled).length;
    check(item.cells[4].textContent.includes('已启用 ' + enabled + ' 条') && item.cells[4].textContent.includes('共 ' + applicable.length + ' 条，按路由范围'), 'route summary lost enabled/total rule counts by route scope: ' + route.id);
  }
  for (const [index, rule] of rules.entries()) {
    const item = row('rule', rule.id);
    check(item?.querySelectorAll('td').length === 6 && item.textContent.includes(rule.id) && item.textContent.includes(String(rule.priority)) && Object.values(rule.match).every(value => item.textContent.includes(value)) && (!rule.action.value || item.textContent.includes(rule.action.value)), 'dense rule summary lost a complete condition/action: ' + rule.id);
    check(Number(item.querySelector('td').textContent.match(/列表第\s*(\d+)\s*条/)?.[1]) === index + 1, 'rule list sequence does not represent its original array position: ' + rule.id);
  }
  check(!$('rules-list').querySelector('img,script'), 'rule conditions were interpreted as markup');
  const fullOrder = ids('rule').join('|'), beforeFilters = await snapshot();
  set('route-search', 'DENSE-CLAUDE'); check(ids('route').join('|') === 'dense-claude', 'route search did not match its ID case-insensitively');
  check($('route-count').textContent.includes('显示 1 / 4'), 'route count did not reflect the local filtered result');
  set('route-search', 'dense-openai-client'); check(ids('route').join('|') === 'dense-openai-secondary', 'route search lost the client alias');
  set('route-search', 'not-a-saved-route'); check(!ids('route').length && $('routes-list').textContent.trim(), 'route search empty state missing'); click('route-search-reset');
  check(!$('route-search').value && ids('route').length === routes.length, 'route search reset did not restore the full list');
  set('rule-search', 'DENSE-MATCHING-CLIENT'); check(ids('rule').join('|') === 'dense-specific-complete|dense-tie-remove', 'rule search omitted a full client condition');
  set('rule-search', 'provider/full-model-2026'); check(ids('rule').join('|') === 'dense-specific-complete|dense-tie-remove', 'rule search omitted a full model condition');
  check($('rule-count').textContent.includes('显示 2 / 6'), 'rule count did not reflect the local filtered result');
  check(Number(row('rule', 'dense-specific-complete').querySelector('td').textContent.match(/列表第\s*(\d+)\s*条/)?.[1]) === 2 && Number(row('rule', 'dense-tie-remove').querySelector('td').textContent.match(/列表第\s*(\d+)\s*条/)?.[1]) === 5, 'filtered rule rows were renumbered');
  set('rule-search', '/v1/messages'); check(ids('rule').join('|') === 'dense-disabled-high', 'rule search omitted an endpoint condition');
  click('rule-search-reset'); set('rule-filter-route', 'dense-claude');
  check(ids('rule').join('|') === 'dense-disabled-high|dense-universal-preserve', 'route scope filter omitted a general rule or included another route');
  set('rule-filter-status', 'enabled'); check(ids('rule').join('|') === 'dense-universal-preserve', 'enabled filter did not compose with route scope');
  set('rule-filter-status', 'disabled'); check(ids('rule').join('|') === 'dense-disabled-high', 'disabled filter did not compose with route scope');
  set('rule-search', 'no-matching-rule'); check(!ids('rule').length && $('rules-list').textContent.trim(), 'combined rule filter empty state missing'); click('rule-search-reset');
  check(!$('rule-search').value && !$('rule-filter-route').value && !$('rule-filter-status').value && ids('rule').join('|') === fullOrder, 'rule filter reset did not restore fields and original order');
  check(calls(await snapshot()) === calls(beforeFilters), 'local route/rule search or scope/status filtering made a host request');
  passed.push('dense-lists/full-route-and-rule-summaries/text-safe/global-sequence/local-filter-no-RPC');

  closeDetails(); selectWithoutReveal('route', 'dense-claude'); selectWithoutReveal('rule', 'dense-specific-complete');
  check(selected('route').join('|') === 'dense-claude' && selected('rule').join('|') === 'dense-specific-complete', 'ordinary selection did not retain exactly one selected row');
  press($('rules-list').querySelector('button[data-rule-edit="dense-specific-complete"]')); checkRevealedEditor('rule-settings-details');
  set('rule-priority', '81'); set('rule-value', 'dense-unsaved-custom-value');
  const beforeDirtyFilters = await snapshot(); set('rule-search', 'dense-disabled-high');
  check($('rule-id').value === 'dense-specific-complete' && $('rule-priority').value === '81' && $('rule-value').value === 'dense-unsaved-custom-value', 'filtering away a selected rule discarded the dirty editor');
  press(ruleButton('dense-disabled-high'));
  check($('rule-id').value === 'dense-specific-complete' && $('rule-priority').value === '81' && $('status-message').textContent.includes('先保存'), 'dirty rule selection was overwritten by a filtered row');
  click('rule-search-reset'); check(selected('rule').join('|') === 'dense-specific-complete' && $('rule-value').value === 'dense-unsaved-custom-value', 'rule reset lost selection or its dirty value');
  check(calls(await snapshot()) === calls(beforeDirtyFilters), 'dirty rule filters or blocked row selection made a host request'); click('rule-cancel');
  await until(() => !$('rule-new').disabled, 'dense dirty rule cancel did not finish');
  press($('routes-list').querySelector('button[data-route-edit="dense-claude"]')); checkRevealedEditor('route-settings-details');
  set('route-client', 'dense-unsaved-client'); const beforeRouteDraft = await snapshot(); set('route-search', 'dense-openai-secondary');
  check($('route-id').value === 'dense-claude' && $('route-client').value === 'dense-unsaved-client', 'filtering away a route discarded its dirty editor'); press(routeButton('dense-openai-secondary'));
  check($('route-id').value === 'dense-claude' && $('route-client').value === 'dense-unsaved-client' && $('status-message').textContent.includes('先保存'), 'dirty route selection was overwritten by a filtered row');
  click('route-search-reset'); check(selected('route').join('|') === 'dense-claude' && $('route-client').value === 'dense-unsaved-client', 'route search reset lost selection or its draft');
  check(calls(await snapshot()) === calls(beforeRouteDraft), 'dirty route filters or blocked row selection made a host request'); click('route-cancel');
  await until(() => !$('route-new').disabled, 'dense dirty route cancel did not finish');
  passed.push('dense-lists/select-without-open/explicit-edit-open/filtered-drafts-and-selection-preserved');

  press(ruleButton('dense-specific-complete')); set('rule-search', 'dense-specific-complete'); click('rule-down');
  await until(() => !$('rule-down').disabled && $('status-message').textContent.includes('列表顺序已保存'), 'dense filtered rule move did not finish');
  check(Number(row('rule', 'dense-specific-complete').querySelector('td').textContent.match(/列表第\s*(\d+)\s*条/)?.[1]) === 3, 'filtered rule movement used the filtered position');
  check((await snapshot()).lastRulesWrite.map(rule => rule.id).join('|') === [rules[0], rules[2], rules[1], ...rules.slice(3)].map(rule => rule.id).join('|'), 'filtered move changed an unexpected rule in the persisted array');
  click('rule-up'); await until(() => !$('rule-up').disabled && $('status-message').textContent.includes('列表顺序已保存'), 'dense filtered rule move back did not finish');
  click('rule-search-reset'); check(ids('rule').join('|') === fullOrder, 'filtered movement failed to restore the original array order');
  closeDetails(); checkClosedContents(); press(routeButton(routeId)); press(ruleButton('dense-specific-complete')); checkClosedContents();
  passed.push('dense-lists/filtered-reorder-retains-original-array-position/closed-content-invisible');
  tab('gateway'); click('listener-start'); await until(() => $('listener-state').textContent === '正在监听', 'listener did not restart after dense isolated configuration');
  return { routeCount: routes.length, ruleCount: rules.length, routeIds: routes.map(route => route.id), ruleIds: rules.map(rule => rule.id), summariesComplete: true, localFiltersWithoutRpc: true, filteredDraftsRetained: true, filteredSequenceRetained: true, closedContentsInvisible: true, selectedRoute: routeId, selectedRule: 'dense-specific-complete' };
}

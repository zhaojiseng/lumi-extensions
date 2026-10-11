async (options = {}) => {
  const $ = id => document.getElementById(id);
  const check = (value, message) => { if (!value) throw new Error('Gateway resource regression: ' + message); };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async (predicate, message, timeout = 10000) => {
    const deadline = performance.now() + timeout;
    while (!await predicate()) {
      check(performance.now() < deadline, message);
      await sleep(25);
    }
  };
  const control = (command, value) => {
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { removeEventListener('message', receive); reject(new Error('Resource fixture control timed out')); }, 3000);
      const receive = event => {
        if (event.source !== parent || event.data?.type !== 'fixture-control-result' || event.data.requestId !== requestId) return;
        clearTimeout(timer); removeEventListener('message', receive); resolve(event.data.result);
      };
      addEventListener('message', receive);
      parent.postMessage({ protocol: 'lumi-extension/1', type: 'fixture-control', command, value, requestId }, '*');
    });
  };
  const count = async () => (await control('snapshot')).counts['gateway.chain.snapshot'] || 0;
  const tab = name => document.querySelector('[data-tab="' + name + '"]').click();
  const cards = () => [...$('chain-requests').querySelectorAll('[data-trace-id]')];
  const card = id => cards().find(element => element.dataset.traceId === id);
  const selection = () => {
    const selected = cards().filter(element => element.getAttribute('aria-pressed') === 'true');
    check(selected.length === 1, 'the visible request window must contain exactly one selected card');
    const expected = selected[0].querySelector('strong').textContent;
    check($('chain-model').textContent === expected, 'request details do not match the selected visible card');
    return selected[0].dataset.traceId;
  };
  const refresh = async traces => {
    tab('rectify');
    await control('request-cards', traces);
    const before = await count(), start = performance.now();
    tab('gateway');
    await until(async () => await count() > before, 'returning to overview did not immediately fetch a snapshot', 1500);
    check(performance.now() - start < 1200, 'overview resumed at the old idle interval');
    await sleep(60);
  };

  // The Electron driver resizes the actual viewport between these two phases.
  if (options.phase === 'narrow') {
    const saved = window.gatewayResourceScenarioState;
    check(saved, 'wide viewport phase did not run');
    await until(() => Number($('chain-requests').dataset.capacity) < saved.wideCapacity, 'request capacity did not follow the narrower viewport');
    check(cards().length === Number($('chain-requests').dataset.capacity), 'narrow viewport retained clipped extra cards');
    check(cards().every(element => element.dataset.active === 'true'), 'history displaced active requests in the narrow viewport');
    const selected = selection();
    check(selected !== saved.wideSelected, 'shrinking the viewport left details on a hidden request');
    return { narrowCapacity: cards().length, narrowSelected: selected, selectionAndDetailsVisible: true };
  }

  const passed = [];
  tab('gateway');
  const models = [...document.querySelectorAll('[data-chain-model-id][data-provider-id="primary"]')].slice(0, 2);
  check(models.length === 2, 'resource fixture needs two displayed primary models');
  const modelIds = models.map(element => element.dataset.chainModelId);
  const trace = (id, index, finished = false) => {
    const requestedModel = modelIds[index % modelIds.length];
    const chain = { providerId: 'primary', providerName: '资源回归供应商', requestedModel, upstreamModel: requestedModel, entryEndpoint: '/v1/responses', upstreamEndpoint: '/v1/responses', entryTier: { state: 'missing' }, configVersion: 1, changes: [], changesTruncated: false, routeReason: 'model-match' };
    return { id, providerId: 'primary', agentId: 'fixture-cli', requestedModel, entryEndpoint: '/v1/responses', startedAtMs: Date.now() - 2000, phase: finished ? 'finished' : 'streaming', elapsedMs: 2000, httpStatus: 200, errorCode: null, chain, rateWindow: { windowMs: 5000, coveredMs: 2000, outputChars: 24, charsPerSecond: 12, source: 'content-delta' }, events: [{ phase: finished ? 'finished' : 'streaming', elapsedMs: 2000, errorCode: null }] };
  };
  const ended = trace('resource-ended', 0, true);
  await refresh([ended]);
  await until(() => !!card(ended.id), 'completed request fixture did not render');

  const idleMutations = { cardContent: 0, wireGeometry: 0 };
  const idleObserver = new MutationObserver(records => { idleMutations.cardContent += records.length; });
  idleObserver.observe($('chain-requests'), { childList: true, characterData: true, subtree: true });
  const wireObserver = new MutationObserver(records => { idleMutations.wireGeometry += records.length; });
  for (const svg of $('chain-flow').querySelectorAll('svg')) wireObserver.observe(svg, { childList: true, subtree: true, attributes: true, attributeFilter: ['d', 'viewBox'] });
  const idleTimes = [], initialCount = await count();
  let lastCount = initialCount, lastTime = performance.now();
  try {
    await until(async () => {
      const current = await count();
      if (current > lastCount) { const now = performance.now(); idleTimes.push(Math.round(now - lastTime)); lastTime = now; lastCount = current; }
      return idleTimes.length === 3;
    }, 'idle polling stopped instead of backing off', 16000);
    await sleep(60);
  } finally { idleObserver.disconnect(); wireObserver.disconnect(); }
  check(idleTimes[2] > idleTimes[0] * 1.5, 'idle RPC intervals did not progressively back off: ' + idleTimes.join(', '));
  check(idleMutations.cardContent === 0, 'unchanged completed snapshots rewrote card content');
  check(idleMutations.wireGeometry === 0, 'unchanged completed snapshots rebuilt SVG geometry');
  passed.push('idle-RPC-backoff/unchanged-completed-card-content-and-SVG-stable');

  tab('rectify');
  await sleep(100);
  const awayCount = await count();
  await sleep(1800);
  check(await count() === awayCount, 'non-overview tab continued polling chain snapshots');
  const liveA = trace('resource-live-a', 0), liveB = trace('resource-live-b', 1);
  await refresh([liveA]);
  await until(() => card(liveA.id)?.dataset.active === 'true', 'active request did not replace completed history');
  const activeCount = await count(), activeStart = performance.now();
  await until(async () => await count() >= activeCount + 2, 'active requests lost the responsive polling cadence', 2600);
  const activeTwoPollsMs = Math.round(performance.now() - activeStart);
  check(activeTwoPollsMs < 2200, 'active request polling retained idle backoff');
  passed.push('non-overview-no-chain-RPC/return-immediate-refresh/active-polling-cadence');

  // An always-hidden test window reports visible when background throttling is
  // disabled. Explicitly simulate this browser signal; DOM/RPC assertions still
  // execute in the real sandboxed Chromium renderer, without exposing internals.
  const ownHidden = Object.getOwnPropertyDescriptor(document, 'hidden');
  try {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    await sleep(100);
    const hiddenCount = await count();
    await control('request-cards', [liveB]);
    await sleep(1800);
    check(await count() === hiddenCount, 'simulated hidden document continued polling chain snapshots');
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    const resumed = performance.now();
    document.dispatchEvent(new Event('visibilitychange'));
    await until(() => !!card(liveB.id), 'document visibility did not immediately refresh the snapshot', 1500);
    check(performance.now() - resumed < 1200, 'document visibility resumed at the previous timer interval');
  } finally {
    if (ownHidden) Object.defineProperty(document, 'hidden', ownHidden); else delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  }
  passed.push('simulated-document-visibility/no-chain-RPC/immediate-resume');

  await sleep(100);
  const focused = document.querySelector('[data-chain-model-id="' + CSS.escape(modelIds[0]) + '"][data-provider-id="primary"]');
  focused.focus({ preventScroll: true });
  check(document.activeElement === focused, 'model did not receive keyboard focus');
  const paths = [...$('chain-flow').querySelectorAll('svg path')], pathData = paths.map(path => path.getAttribute('d'));
  check(paths.length > 0, 'overview has no rendered connection paths');
  const activeMutations = { geometry: 0 };
  const activeObserver = new MutationObserver(records => { activeMutations.geometry += records.length; });
  for (const svg of $('chain-flow').querySelectorAll('svg')) activeObserver.observe(svg, { childList: true, subtree: true, attributes: true, attributeFilter: ['d', 'viewBox'] });
  try {
    await control('request-cards', [liveA]);
    await until(() => !!card(liveA.id), 'active model switch did not render');
    await sleep(80);
    check(document.activeElement === focused && focused.isConnected, 'active model switch rebuilt the catalog and lost keyboard focus');
    const next = [...$('chain-flow').querySelectorAll('svg path')];
    check(paths.length === next.length && paths.every((path, index) => path === next[index] && pathData[index] === path.getAttribute('d')), 'status-only updates replaced or moved SVG paths');
    check(activeMutations.geometry === 0, 'status-only updates rewrote SVG geometry');
  } finally { activeObserver.disconnect(); }
  check(document.querySelector('svg path.is-active[data-model-id="' + CSS.escape(modelIds[0]) + '"]'), 'reused path did not receive the new active status');
  passed.push('active-model-switch/catalog-focus-preserved/SVG-path-identity-and-geometry-reused');

  const history = Array.from({ length: 10 }, (_, index) => trace('resource-history-' + index, index, true));
  const live = Array.from({ length: 10 }, (_, index) => trace('resource-active-' + index, index));
  await refresh([...history, ...live]);
  await until(() => cards().every(element => element.dataset.traceId.startsWith('resource-active-')), 'unordered snapshot did not prioritize active cards');
  const wideCapacity = Number($('chain-requests').dataset.capacity);
  check(wideCapacity > 1 && cards().length === wideCapacity, 'wide viewport did not fill the active request window');
  selection();
  cards().at(-1).click();
  const wideSelected = selection();
  passed.push('unordered-snapshot/active-priority/selected-card-and-details-in-visible-window');
  window.gatewayResourceScenarioState = { wideCapacity, wideSelected };
  return { passed, idlePollIntervalsMs: idleTimes, activeTwoPollsMs, idleMutations, wideCapacity, wideSelected, visibility: 'simulated-document-hidden-property-and-visibilitychange' };
}

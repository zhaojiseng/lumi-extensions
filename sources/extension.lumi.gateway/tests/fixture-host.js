'use strict';
(() => {
  const protocol = 'lumi-extension/1';
  const nonce = 'gateway-ui-fixture';
  const frame = document.getElementById('plugin');
  const now = Date.now();
  const fixture = window.fixture = {
    calls: [], errors: [], exports: [], deletes: [], connected: false, listening: false,
    configured: false, alias: null, listenPort: null, managementPort: null, maxRequestBytes: 2 * 1048576, maxConcurrency: 32, credentialsReceived: 0,
    configVersion: 1, connections: 0, failConnections: 0,
    routes: [], agents: [], rectifiers: [], storage: {}, traces: [], traceRevision: 0,
    rules: [{ id: 'tier-rule', enabled: true, priority: 100, match: { routeId: 'codex-main' }, action: { type: 'override', value: 'priority' } }],
    recording: { bodies: false, retentionDays: 7, maxBytes: 1024 * 1024 * 1024, maxRecords: 10000, captureBytes: 1024 * 1024, policyVersion: 1 },
    records: [], delayedDetail: false, restoreFails: false, modelsMode: 'normal', modelsRequests: 0,
    previewMode: 'normal', recordsFailNext: false, recordsAppendHeld: false, recordsAppendPending: false, recordsAppendRelease: null, cliFixtureRoutes: null,
  };
  for (const [id, model, routeId] of [['record-a', 'fixture-model', 'codex-main'], ['record-b', '<img src="https://must-not-load.invalid/x" onerror="alert(1)">', 'other'], ['record-stale', 'delayed-record', 'codex-main']]) fixture.records.push({
    id, startedAtMs: now, routeId, clientAlias: 'fixture-cli', endpoint: '/v1/responses', model,
    status: id === 'record-b' ? 'execution-unknown' : 'completed', httpStatus: id === 'record-b' ? null : 200,
    original: { state: 'string', value: 'old' }, effective: { state: 'string', value: 'priority' }, reported: id === 'record-b' ? { state: 'unavailable' } : { state: 'string', value: 'default' }, ruleId: 'tier-rule',
    requestBytes: 88, responseBytes: 130, durationMs: 12, firstResponseMs: 5, firstContentMs: 7,
    inputTokens: id === 'record-b' ? null : 12, outputTokens: id === 'record-b' ? null : 4,
    cacheReadTokens: null, cacheWriteTokens: null, recordingPartial: id === 'record-b', errorCode: null,
  });
  addEventListener('error', event => fixture.errors.push(event.message));
  addEventListener('unhandledrejection', event => fixture.errors.push(String(event.reason)));
  function send(message) { frame.contentWindow.postMessage({ protocol, nonce, ...message }, '*'); }
  function status() { return { state: fixture.listening ? 'listening' : 'stopped', address: fixture.listening ? '127.0.0.1:' + fixture.listenPort : null, owned: true, activeRequests: 0 }; }
  fixture.theme = value => send({ type: 'context', context: { theme: value, locale: 'zh-CN', site: { id: 'fixture', name: 'Fixture', url: 'https://example.invalid' } } });
  fixture.event = payload => send({ type: 'event', topic: 'gateway', payload: { sessionId: 'fixture-session', subscriptionId: 'fixture-subscription', ...payload } });
  function safeAudit(value) {
    if (Array.isArray(value)) return value.map(safeAudit);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === 'upstreamApiKey' || key === 'clientApiKey' ? '[REDACTED]' : safeAudit(item)]));
  }
  async function request(method, input) {
    fixture.calls.push({ method, input: safeAudit(input) });
    switch (method) {
      case 'storage.read': return structuredClone(fixture.storage[input.key]??null);
      case 'storage.write': fixture.storage[input.key]=structuredClone(input.value);return null;
      case 'gateway.agents.get': return {configVersion:fixture.configVersion,agents:structuredClone(fixture.agents)};
      case 'gateway.rectifiers.list': return {configVersion:fixture.configVersion,rectifiers:structuredClone(fixture.rectifiers)};
      case 'gateway.agents.replace': if(input.expectedVersion!==fixture.configVersion)throw new Error('config-conflict');fixture.agents=structuredClone(input.agents);return {configVersion:++fixture.configVersion};
      case 'gateway.rectifiers.replace': if(input.expectedVersion!==fixture.configVersion)throw new Error('config-conflict');fixture.rectifiers=structuredClone(input.rectifiers);return {configVersion:++fixture.configVersion};
      case 'gateway.chain.snapshot': return {snapshotId:'fixture-snapshot',revision:fixture.traceRevision,traces:structuredClone(fixture.traces).map(t=>({...t,elapsedMs:t.phase==='finished'?t.elapsedMs:Math.max(t.elapsedMs,Date.now()-t.startedAtMs)})),truncated:false,totals:{requests:fixture.traces.length,upstreamAttempts:fixture.traces.length,rectified:0,rerouted:0,errors:0}};

      case 'gateway.local.status': return { configured: fixture.configured, running: fixture.connected, pairingId: fixture.configured ? 'fixture-pairing' : null, alias: fixture.alias, listenPort: fixture.listenPort, managementPort: fixture.managementPort, configVersion: fixture.configured ? fixture.configVersion : null, maxRequestBytes: fixture.maxRequestBytes, maxConcurrency: fixture.maxConcurrency };
      case 'gateway.local.setup': {
        if (fixture.configured) throw new Error('already-configured');
        if (input.listenPort === input.managementPort || !input.credentials.upstreamApiKey || input.credentials.clientApiKey.length < 16) throw new Error('fixture-invalid-setup');
        fixture.credentialsReceived += 1; fixture.configured = true; fixture.alias = input.alias; fixture.listenPort = input.listenPort; fixture.managementPort = input.managementPort; fixture.maxRequestBytes = input.maxRequestBytes ?? fixture.maxRequestBytes; fixture.maxConcurrency = input.maxConcurrency ?? fixture.maxConcurrency;
        fixture.routes = [{ ...structuredClone(input.route), credentialRef: input.route.id, credentialPresent: true }];
        await new Promise(resolve => setTimeout(resolve, 40));
        return { pairingId: 'fixture-pairing', configVersion: fixture.configVersion };
      }
      case 'gateway.local.configure': {
        if (input.expectedVersion !== fixture.configVersion) throw new Error('version-conflict');
        fixture.alias = input.alias; fixture.listenPort = input.listenPort; fixture.managementPort = input.managementPort; fixture.maxRequestBytes = input.maxRequestBytes ?? fixture.maxRequestBytes; fixture.maxConcurrency = input.maxConcurrency ?? fixture.maxConcurrency; fixture.connected = false;
        return { configVersion: ++fixture.configVersion };
      }
      case 'gateway.routes.save': {
        if (input.expectedVersion !== fixture.configVersion) throw new Error('version-conflict');
        const index = fixture.routes.findIndex(route => route.id === input.route.id);
        if (index < 0 && (!input.credentials?.upstreamApiKey || !input.credentials?.clientApiKey)) throw new Error('fixture-missing-credentials');
        if (input.credentials) fixture.credentialsReceived += 1;
        const route = { ...structuredClone(input.route), credentialRef: input.route.id, credentialPresent: true };
        if (index < 0) fixture.routes.push(route); else fixture.routes[index] = route;
        await new Promise(resolve => setTimeout(resolve, 40));
        return { configVersion: ++fixture.configVersion };
      }
      case 'gateway.routes.models.detect':
      case 'gateway.routes.models.preview': {
        if (Object.keys(input).sort().join(',') !== (method==='gateway.routes.models.preview'?'expectedVersion,protocol,routeId,sessionId,upstreamApiKey,upstreamBase':'expectedVersion,routeId,sessionId')) { fixture.errors.push('model detection received extra fields'); throw new Error('models-invalid-input'); }
        if (input.sessionId !== 'fixture-session' || !fixture.connected || input.expectedVersion !== fixture.configVersion || method==='gateway.routes.models.detect' && !fixture.routes.some(route => route.id === input.routeId)) throw new Error('models-route-changed');
        fixture.modelsRequests += 1;
        const mode = fixture.modelsMode;
        const result = { routeId: input.routeId, configVersion: fixture.configVersion, checkedAtMs: Date.now(), source: 'catalog', models: mode === 'merge' ? [{id: input.routeId + '-catalog-model'}, {id:'model-alias-collision'}, {id:'catalog-new-model'}] : mode === 'empty' ? [] : mode === 'truncated' ? Array.from({ length: 500 }, (_, index) => ({ id: 'fixture-model-' + index })) : [{ id: input.routeId + '-catalog-model' }, { id: '<img src="https://must-not-load.invalid/model" onerror="alert(1)">' }, { id: '<script>alert(1)</script>' }, { id: 'x'.repeat(256) }], truncated: mode === 'truncated' };
        if (mode === 'delayed' || mode === 'delayed-error') await new Promise(resolve => setTimeout(resolve, 250));
        if (mode === 'auth') throw new Error('models-auth-failed');
        if (mode === 'unavailable') throw new Error('models-endpoint-unavailable');
        if (mode === 'error' || mode === 'delayed-error') throw new Error('models-connection-failed');
        return result;
      }
      case 'gateway.routes.delete': {
        if(fixture.holdDelete){fixture.holdDelete=false;fixture.event({type:'status',status:status()});await new Promise(resolve=>setTimeout(resolve,250));}
        if (input.expectedVersion !== fixture.configVersion) throw new Error('version-conflict');
        if (fixture.rules.some(rule => rule.match.routeId === input.routeId)) throw new Error('route-in-use');
        fixture.routes = fixture.routes.filter(route => route.id !== input.routeId);
        return { configVersion: ++fixture.configVersion };
      }
      case 'gateway.status': return { pairings: [{ pairingId: 'fixture-pairing', alias: '本机测试实例', instanceId: 'fixture-instance', protocolVersion: 1, connected: fixture.connected, listening: fixture.listening, activeRequests: 0 }] };
      case 'gateway.pair': return { pairingId: 'fixture-pairing' };
      case 'gateway.connect': if(fixture.failConnections>0){fixture.failConnections--;throw new Error('not-connected');}fixture.connected = true; fixture.connections += 1; return { sessionId: 'fixture-session', instanceId: 'fixture-instance', protocolVersion: 1 };
      case 'gateway.disconnect': fixture.connected = false; return { disconnected: true };
      case 'gateway.events.subscribe': setTimeout(() => fixture.event({ type: 'status', status: status() }), 15); return { subscriptionId: 'fixture-subscription' };
      case 'gateway.events.unsubscribe': return { unsubscribed: true };
      case 'gateway.listener.start': fixture.listening = true; return status();
      case 'gateway.listener.stop': fixture.listening = false; return status();
      case 'gateway.routes.config.get': return { configVersion: fixture.configVersion, routes: structuredClone(fixture.routes) };
      case 'gateway.routes.config.set': if (input.expectedVersion !== fixture.configVersion || input.routes.length !== fixture.routes.length || input.routes.some(route => route.credentialRef !== route.id)) throw new Error('fixture-config-conflict'); fixture.routes = structuredClone(input.routes); return { configVersion: ++fixture.configVersion };
      case 'gateway.rules.list': return { policyVersion: fixture.configVersion, rules: structuredClone(fixture.rules) };
      case 'gateway.rules.replace': if (input.expectedVersion !== fixture.configVersion) throw new Error('fixture-config-conflict'); fixture.rules = structuredClone(input.rules); return { policyVersion: ++fixture.configVersion };
      case 'gateway.rules.preview': {
        const mode = fixture.previewMode;
        const rule = fixture.rules.filter(rule => rule.enabled).sort((a, b) => b.priority - a.priority).find(rule => !rule.match.routeId || rule.match.routeId === input.routeId);
        const original = input.originalTier;
        let effective = structuredClone(original);
        if (rule?.action.type === 'remove') effective = { state: 'missing' };
        if (rule?.action.type === 'override' || (rule?.action.type === 'set-if-missing' && original.state === 'missing')) effective = { state: 'string', value: rule.action.value };
        const result = { original, effective, ruleId: rule?.id || null, modified: JSON.stringify(original) !== JSON.stringify(effective), compatible: true };
        if (mode === 'delayed' || mode === 'delayed-error') await new Promise(resolve => setTimeout(resolve, 250));
        if (mode === 'delayed-error') throw new Error('fixture-delayed-preview-failure');
        return result;
      }
      case 'gateway.recording.config.get': return { configVersion: fixture.configVersion, recording: { ...structuredClone(fixture.recording), policyVersion: fixture.configVersion }, encryptionAvailable: true };
      case 'gateway.recording.config.set': if (input.expectedVersion !== fixture.configVersion) throw new Error('fixture-config-conflict'); fixture.recording = structuredClone(input.recording); return { configVersion: ++fixture.configVersion, encryptionAvailable: true };
      case 'gateway.records.list': {
        if (fixture.recordsFailNext) { fixture.recordsFailNext = false; throw new Error('fixture-record-list-failure'); }
        if (input.cursor && fixture.recordsAppendHeld) {
          fixture.recordsAppendPending = true;
          await new Promise(resolve => { fixture.recordsAppendRelease = resolve; });
          fixture.recordsAppendPending = false;
        }
        let rows = fixture.records;
        if (input.filter?.routeId) rows = rows.filter(record => record.routeId === input.filter.routeId);
        if (input.filter?.model) rows = rows.filter(record => record.model === input.filter.model);
        if (input.filter?.status) rows = rows.filter(record => record.status === input.filter.status);
        return input.cursor ? { records: rows.slice(2), nextCursor: null } : { records: rows.slice(0, 2), nextCursor: rows.length > 2 ? 'fixture-page-2' : null };
      }
      case 'gateway.records.get': {
        const record = fixture.records.find(record => record.id === input.recordId);
        if (input.recordId === 'record-stale') await new Promise(resolve => setTimeout(resolve, 250));
        return { record: structuredClone(record), body: input.includeBody ? { text: input.bodyCursor ? '第二段脱敏正文' : '第一段脱敏正文 <script>恶意内容只显示文本</script>', nextCursor: input.bodyCursor ? null : 'fixture-body-2', redacted: true, encrypted: true, truncated: false, complete: Boolean(input.bodyCursor) } : null };
      }
      case 'gateway.records.delete': fixture.deletes.push(structuredClone(input)); fixture.records = fixture.records.filter(record => !input.selection.recordIds.includes(record.id)); return { deleted: input.selection.recordIds.length };
      case 'gateway.records.export': fixture.exports.push(structuredClone(input)); return { exported: input.selection.recordIds.length, cancelled: false };
      case 'gateway.cliConfig.preview': {
        const route = fixture.routes.find(route => route.id === input.routeId);
        if (!route || !route.enabled || route.credentialPresent === false || route.protocol !== (input.tool === 'codex' ? 'openai' : 'anthropic')) { fixture.errors.push('CLI preview reached an incompatible route'); throw new Error('fixture-invalid-cli-route'); }
        return { transactionId: 'fixture-transaction', fingerprint: 'fixture-before', expiresAtMs: Date.now() + 60000, tool: input.tool, differences: [{ label: 'base URL', before: 'https://old.example/v1', after: 'http://127.0.0.1:' + fixture.listenPort + '/' + route.id + (route.protocol === 'openai' ? '/v1' : '') }, { label: '认证', before: '已隐藏', after: '网关客户端凭据（已隐藏）' }], conflicts: [], recoverable: true };
      }
      case 'gateway.cliConfig.apply': return { transactionId: input.transactionId, fingerprint: 'fixture-after', state: 'applied', recoverable: true };
      case 'gateway.cliConfig.restore': if (fixture.restoreFails) { fixture.restoreFails = false; throw new Error('fixture-restore-conflict'); } return { transactionId: input.transactionId, fingerprint: 'fixture-restored', state: 'restored', recoverable: false };
      default: throw new Error('fixture-unsupported-method');
    }
  }
  addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.data?.protocol !== protocol) return;
    const message = event.data;
    if (message.type === 'fixture-control') {
      if(message.command==='request-cards'){fixture.traces=structuredClone(message.value);fixture.traceRevision++;}
      if(message.command==='access-legacy'){fixture.savedAccessAgents=structuredClone(fixture.agents);fixture.agents=fixture.routes.slice(0,2).map((r,i)=>({id:'legacy-'+i,name:'已有接入 '+i,credentialRef:r.id,providerIds:[r.id],enabled:true}));fixture.configVersion++;}
      if(message.command==='hold-provider-delete')fixture.holdDelete=true;
      if(message.command==='access-legacy-routes'){fixture.agents=[];fixture.configVersion++;}
      if(message.command==='access-restore'){fixture.agents=fixture.savedAccessAgents;fixture.configVersion++;}
      if(message.command==='draftSnapshot'){send({type:'fixture-control-result',requestId:message.requestId,result:{configVersion:fixture.configVersion,routes:fixture.routes.map(r=>r.id),keyWrites:fixture.calls.filter(call=>call.method==='gateway.routes.save'&&call.input.credentials).length,listening:fixture.listening}});return;}
      if(message.command==='access-snapshot'){send({type:'fixture-control-result',requestId:message.requestId,result:{agents:structuredClone(fixture.agents),routes:structuredClone(fixture.routes),credentialFields:Object.keys(fixture.calls.filter(call=>call.method==='gateway.routes.save').at(-1)?.input.credentials||{}),agentWrites:fixture.calls.filter(call=>call.method==='gateway.agents.replace').length,keyWrites:fixture.calls.filter(call=>call.method==='gateway.routes.save'&&call.input.credentials?.clientApiKey).length,localWrites:fixture.calls.filter(call=>call.method==='gateway.local.configure').length}});return;}
      if(message.command==='seed-legacy-tier'){fixture.rules=[{id:'inherited-tier',enabled:true,priority:100,match:{routeId:'primary'},action:{type:'override',value:'priority'}}];fixture.configVersion++;}
      if(message.command==='fail-reconnect'){fixture.failConnections=1;fixture.connected=false;fixture.event({type:'status',status:{state:'unknown',address:null,owned:true,activeRequests:null}});}
      if (message.command === 'models-mode') fixture.modelsMode = message.value;
      if (message.command === 'models-context') fixture.theme(message.value || 'light');
      if (message.command === 'fail-next-restore') fixture.restoreFails = true;
      if (message.command === 'stale-status') fixture.event({ sessionId: 'stale-session', type: 'status', status: { state: 'listening', address: '127.0.0.1:19000', owned: true, activeRequests: 9 } });
      if (message.command === 'current-status') fixture.event({ type: 'status', status: status() });
      if (message.command === 'preview-mode') fixture.previewMode = message.value;
      if (message.command === 'records-fail-next') fixture.recordsFailNext = true;
      if (message.command === 'records-hold-append') fixture.recordsAppendHeld = true;
      if (message.command === 'records-release-append') { fixture.recordsAppendHeld = false; fixture.recordsAppendRelease?.(); fixture.recordsAppendRelease = null; }
      if (message.command === 'record-event') fixture.event({ type: 'record-summary', record: structuredClone(fixture.records[0]) });
      if (message.command === 'cli-route-fixture') {
        if (message.value === 'restore') {
          fixture.routes = fixture.cliFixtureRoutes; fixture.cliFixtureRoutes = null;
        } else {
          fixture.cliFixtureRoutes = structuredClone(fixture.routes);
          const route = fixture.routes[0];
          fixture.routes.push(...[
            { ...route, id: 'fixture-disabled', credentialRef: 'fixture-disabled', enabled: false },
            { ...route, id: 'fixture-no-auth', credentialRef: 'fixture-no-auth', credentialPresent: false },
            { ...route, id: 'fixture-anthropic', credentialRef: 'fixture-anthropic', protocol: 'anthropic', capabilities: { serviceTier: false } },
          ]);
        }
      }
      if (message.requestId) send({ type: 'fixture-control-result', requestId: message.requestId, result: { counts: Object.fromEntries([...new Set(fixture.calls.map(call => call.method))].map(method => [method, fixture.calls.filter(call => call.method === method).length])), configVersion: fixture.configVersion, credentialsReceived: fixture.credentialsReceived, recordsAppendPending: fixture.recordsAppendPending, lastRulesWrite: fixture.calls.filter(call => call.method === 'gateway.rules.replace').at(-1)?.input.rules || [] } });
      return;
    }
    if (message.type === 'ready') { send({ type: 'init', context: { theme: 'light', locale: 'zh-CN', site: { id: 'fixture', name: 'Fixture', url: 'https://example.invalid' } }, view: { id: 'gateway', slot: 'sidebar' } }); return; }
    if (message.nonce !== nonce || message.type !== 'request') return;
    request(message.method, message.input).then(data => send({ type: 'response', id: message.id, ok: true, data }), error => send({ type: 'response', id: message.id, ok: false, error: ['gateway.routes.models.detect','gateway.routes.models.preview'].includes(message.method) && /^models-/.test(error.message) ? error.message : 'fixture-error' }));
  });
})();

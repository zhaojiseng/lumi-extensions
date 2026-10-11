'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const sdk = window.lumiExtension;
  const state = {
    supported: false, session: null, epoch: 0, contextRevision: 0, generatedClientKey: null, local: null, localTicket: 0, localChanging: false, listener: null, configVersion: 0, configTicket: 0,
    routes: [], routeVersion: 0, editingRoute: null, routeCreating: false, previousRoute: null,
    providerModelsTicket: 0, providerModelsLoading: false, providerModelsMessage: '', providerModelsKind: '',
    rules: [], ruleVersion: 0, connecting: false, connectionPromise: null, reconnectTimer: null, connectionFailures: 0, disposed: false,
    recording: null, recordingVersion: 0, encryptionAvailable: false,
    records: [], nextCursor: null, selection: new Set(), recordsTicket: 0, recordsPages: 0, recordsUpdated: false, recordsRevision: 0,
    detail: null, bodyCursor: null, detailTicket: 0, detailLoading: false,
    cliPreview: null, cliTransaction: null, cliTicket: 0, activeTab: 'gateway', previewTicket: 0, listenerChanging: false, listenerTicket: 0,
    drafts: Object.fromEntries(['route', 'recording', 'local', 'access'].map(name => [name, { base: null, values: null, dirty: false, secretsCleared: false }])),
    unsubscribe: null, refreshTimer: null, pendingDelete: null, pendingStop: null, pendingRouteDelete: null,
  };
  const workbench=window.createGatewayWorkbench({sdk,getState:()=>state,requireSession,current,action,notice,failLocal,requireStopped,reload:()=>loadConfiguration(),showTab,routeDraftChanged:()=>{draftChanged('route');},editProvider:openOverviewProvider,providerBusy:()=>editorBusy('route'),upstreamFailureHint});
  const busy = new WeakSet();
  const providerPlaceholder=document.createComment('supplier-editor-home');$('route-settings-details').before(providerPlaceholder);
  const localPlaceholder=document.createComment('local-settings-home'),setupPlaceholder=document.createComment('setup-home');$('local-settings-details').before(localPlaceholder);$('setup-form').before(setupPlaceholder);
  const statusNames = {
    forwarding: '进行中', completed: '已完成', 'upstream-error': '上游错误',
    'gateway-rejected': '网关拒绝', 'client-aborted': '客户端取消',
    interrupted: '已中断', 'execution-unknown': '执行结果未知',
  };
  const actionNames = { preserve: '透传', remove: '删除', 'set-if-missing': '缺失时补入', override: '强制覆盖' };
  const errorNames = {
    'version-conflict': '配置已被其他操作修改，请重新读取后保存。',
    'conflict': '配置发生冲突，请重新读取并检查差异。',
    'fingerprint-mismatch': 'CLI 配置已变化，请重新预览，现有内容保持不变。',
    'expired-transaction': '配置预览已过期，请重新预览。',
    'transaction-expired': '配置预览已过期，请重新预览。',
    'secure-storage-unavailable': '系统安全存储不可用，无法开启正文或保存敏感配置。',
    'permission-denied': '宿主未授予此操作权限。',
    'unsupported-tool': '当前工具或配置版本尚不支持安全接管。',
    'unsupported-provider': '此 Codex provider 的认证行为无法安全接管。请先使用具有显式 provider 表与受支持认证设置的配置，再重新预览。',
    'identity-mismatch': '模型网关连接校验失败，请重新连接。',
    'certificate-mismatch': '模型网关连接校验失败，请重新连接。',
    'not-connected': '管理连接已断开，请重新连接。',
    'listener-active': '请先停止监听并等待请求结束，再保存设置。',
    'route-in-use': '路由仍被规则或 CLI 使用，请先解除引用再删除。',
    'route-not-found': '路由已不存在，请重新读取。',
    'already-configured': '模型网关已设置，请重新读取后编辑。',
    'listener-port-unavailable': '数据端口被占用，原监听与配置已保留。',
    'management-port-unavailable': '管理端口被占用，原连接与配置已保留。',
    'configuration-busy': '另一项配置正在保存，请稍后重试。',
    'port-in-use': '端口被占用，请选择其他端口。',
    'local-runtime-unavailable': '此 Lumi 构建未提供完整模型网关资源。',
    'local-gateway-unavailable': '此 Lumi 构建未提供完整模型网关资源。',
    'local-not-configured': '请先完成首次设置。',
    'local-gateway-not-configured': '请先完成首次设置。',
    'local-already-configured': '模型网关已设置，请刷新后编辑。',
    'config-conflict': '配置已被其他操作修改，请重新读取后保存。',
    'stop-listener-before-changing-routes': '请先停止监听并等待请求结束，再修改路由。',
    'active-requests': '仍有请求进行中，请等待结束后再修改。',
    'local-last-route': '至少保留一条路由，不能删除最后一条。',
    'missing-route-credentials': '新增路由须填写两项认证。',
    'route-limit': '路由数量已达上限。',
    'models-auth-failed': '上游认证失败，请检查本次使用的 API Key。',
    'models-endpoint-unavailable': '此上游未提供可读取的模型目录。可手动填写模型进行规则预览。',
    'models-rate-limited': '上游限制了目录请求，请稍后重试。',
    'models-timeout': '读取模型目录超时，请稍后重试。',
    'models-response-invalid': '上游返回的模型目录格式无效。',
    'models-credentials-reflected': '上游返回的模型目录格式无效。',
    'model-catalog-invalid': '上游返回的模型目录格式无效。',
    'models-response-too-large': '上游模型目录过大，无法安全读取。',
    'models-result-too-large': '上游模型目录过大，无法安全读取。',
    'models-busy': '此路由正在读取模型目录，请稍后重试。',
    'models-route-changed': '路由配置已变化，请重新读取后检测。',
    'models-http-failed': '上游模型目录暂时不可用，请稍后重试。',
    'models-connection-failed': '无法连接上游模型目录，请检查已保存的地址后重试。',
    'models-dns-failed': '无法解析上游地址，请检查已保存的地址后重试。',
  };
  function notice(text, kind = '') {
    const message = document.createElement('span'); message.textContent = text;
    $('status-message').replaceChildren($('unsupported').querySelector('svg').cloneNode(true), message);
    $('status-message').className = (kind === 'error' ? 'warning-banner error-banner' : kind === 'warning' ? 'warning-banner' : 'info-note') + ' gateway-notice';
    $('status-message').hidden = !text;
    if($('provider-editor-dialog').open&&kind){$('provider-dialog-notice').textContent=text;$('provider-dialog-notice').hidden=!text;}
    if($('local-settings-dialog').open&&kind){$('local-dialog-notice').textContent=text;$('local-dialog-notice').hidden=!text;}
  }
  function safeError(error) {
    const message=typeof error?.message==='string'?error.message:'',hostCode=message.match(/^(?:网关操作失败|本机网关操作失败)（([a-z0-9-]+)）。/)?.[1];
    const code=typeof error?.code==='string'&&Object.hasOwn(errorNames,error.code)?error.code:hostCode||message;
    return Object.hasOwn(errorNames,code)?errorNames[code]:'操作未完成。请检查模型网关状态、权限或配置，再重试。';
  }
  function failLocal(message) { const error = new Error(message); error.localMessage = message; throw error; }
  async function action(button, callback) {
    if (button && busy.has(button)) return;
    if (button) { busy.add(button); button.disabled = true; updateButtons(); }
    try { await callback(); }
    catch (error) { if (!error?.stale) notice(error?.localMessage || safeError(error), 'error'); }
    finally { if (button) { busy.delete(button); button.disabled = false; } updateButtons(); }
  }
  function listen(id, type, callback) {
    if (type === 'submit') {
      const form = $(id), button = form.querySelector('[data-submit]');
      const invoke = event => {
        event.preventDefault(); if (button.disabled) return;
        if (form.reportValidity()) { if (!form.querySelector('[data-secret]')) clearSecrets(); void action(button, () => callback(event)); }
        else clearSecrets();
      };
      button.addEventListener('click', invoke);
      form.addEventListener('submit', event => event.preventDefault());
      form.addEventListener('keydown', event => { if (event.key === 'Enter' && event.target.tagName === 'INPUT' && event.target.type !== 'checkbox') invoke(event); });
      return;
    }
    $(id).addEventListener(type, event => { void action($(id), () => callback(event)); });
  }
  function requireSession() {
    if (!state.session) failLocal('请先设置并连接模型网关。');
    return { sessionId: state.session.sessionId, epoch: state.epoch };
  }
  function current(snapshot) { return snapshot.epoch === state.epoch && snapshot.sessionId === state.session?.sessionId; }
  function assertCurrent(snapshot) { if (!current(snapshot)) throw Object.assign(new Error('stale'), { stale: true }); }
  function text(tag, value, className) {
    const element = document.createElement(tag);
    element.textContent = value;
    if (className) element.className = className;
    return element;
  }
  function option(value, label) { const element = text('option', label); element.value = value; return element; }
  function tier(value) {
    if (!value || value.state === 'unavailable') return '未知';
    if (value.state === 'missing') return '缺失';
    if (value.state === 'null') return 'null';
    if (value.state === 'invalid') return '其他类型';
    return typeof value.value === 'string' ? value.value : '未知';
  }
  function known(value, suffix = '') { return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('zh-CN') + suffix : '未知'; }
  function time(value) { return typeof value === 'number' && Number.isFinite(value) ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未知'; }
  function short(value, length = 64) { return String(value ?? '').length > length ? String(value).slice(0, length) + '…' : String(value ?? ''); }
  function formValues(name) {
    return [...$(name + '-form').querySelectorAll('input,select,textarea')]
      .filter(input => !input.hasAttribute('data-secret') && !input.hasAttribute('data-model-control'))
      .map(input => [input.id, input.type === 'checkbox' ? input.checked : input.value]);
  }
  function restoreDraft(name) {
    for (const [id, value] of state.drafts[name].values || []) {
      const input = $(id);
      if (input.type === 'checkbox') input.checked = value;
      else input.value = value;
    }
    if(name==='route')workbench.restoreRoute();
  }
  function resetDraft(name) {
    const values = formValues(name);
    state.drafts[name] = { base: JSON.stringify(values), values, dirty: false, secretsCleared: false };
    renderDraft(name);
  }
  function draftChanged(name) {
    const draft = state.drafts[name]; draft.values = formValues(name);
    const hasSecrets = [...$(name + '-form').querySelectorAll('[data-secret]')].some(input => Boolean(input.value));
    draft.dirty = draft.secretsCleared || hasSecrets || JSON.stringify(draft.values) !== draft.base;
    renderDraft(name);
  }
  function renderDraft(name) {
    const draft = state.drafts[name], status = $(name + '-draft-status');
    status.textContent = draft.secretsCleared ? '有未保存的更改。认证输入已清空；如需更换认证，请重新填写，取消编辑可恢复已保存设置。' : draft.dirty ? '有未保存的更改；保存后生效，取消编辑可恢复已保存设置。' : '';
    status.hidden = !draft.dirty;
    if (name === 'route') $('route-settings-summary').firstChild.textContent = (state.routeCreating ? '填写新路由' : '路由设置与认证') + (draft.dirty ? ' · 未保存' : '');
  }
  function clearSecrets() {
    const cleared = new Set();
    for (const input of document.querySelectorAll('[data-secret]')) {
      for (const name of ['route', 'access']) if (input.value && input.closest('#' + name + '-form')) cleared.add(name);
      input.value = '';
      if(input.id==='setup-client-key'||input.id==='access-key')input.type='password';
    }
    for (const name of cleared) { state.drafts[name].secretsCleared = true; draftChanged(name); }
  }
  function randomClientKey() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  function renderGeneratedClientKey() {
    const generated=state.generatedClientKey;
    $('generated-client-key').hidden=!generated?.saved;
    $('generated-client-key-value').value=generated?.saved?generated.value:'';
    $('generated-key-copy').disabled=!generated?.saved||busy.has($('generated-key-copy'));
  }
  function clearGeneratedClientKey() {
    state.generatedClientKey=null;
    $('setup-client-key').type='password';$('access-key').type='password';
    renderGeneratedClientKey();
  }
  function rememberGeneratedClientKey(value,source,saved=false,routeId=null) {
    state.generatedClientKey={value,source,saved,routeId};renderGeneratedClientKey();
  }
  function copyClientKey(source) {
    const input=$(source==='saved'?'generated-client-key-value':source==='setup'?'setup-client-key':'access-key');
    if(!input.value)failLocal('请先生成或填写接入 API Key。');
    input.focus();input.select();let copied=false;
    try{copied=!!document.execCommand?.('copy');}catch{}
    notice(copied?'已复制接入 API Key。':'已选中接入 API Key，可用系统复制快捷键复制。',copied?'success':'warning');
  }
  function generateClientKey(prefix) {
    if(prefix==='access'){requireSession();if(!$('access-route').value)failLocal('接入入口尚未准备好。');}
    const input=$(prefix==='access'?'access-key':'setup-client-key');
    clearGeneratedClientKey();input.type='text';input.value=randomClientKey();
    rememberGeneratedClientKey(input.value,prefix);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    input.focus();
  }
  function takeCredentials(prefix, required) {
    const upstreamApiKey = $(prefix + '-upstream-key').value;
    const providedClientApiKey=$(prefix+'-client-key')?.value;
    const clientApiKey = providedClientApiKey || (required ? randomClientKey() : '');
    clearSecrets();
    if (required && (!upstreamApiKey || !clientApiKey)) failLocal('请填写上游 API key。接入 API Key 可在 Lumi 设置中指定。');
    for (const value of [upstreamApiKey, clientApiKey]) if (value && /[\u0000-\u0020\u007f]/.test(value)) failLocal('认证密钥不能包含空白或控制字符。');
    if (clientApiKey && clientApiKey.length < 16) failLocal('客户端认证密钥至少需要 16 个字符。');
    if(prefix==='setup'&&required&&!providedClientApiKey)rememberGeneratedClientKey(clientApiKey,'setup');
    const credentials = {};
    if (upstreamApiKey) credentials.upstreamApiKey = upstreamApiKey;
    if (clientApiKey) credentials.clientApiKey = clientApiKey;
    return Object.keys(credentials).length ? credentials : undefined;
  }
  function stopped() { return state.listener?.state === 'stopped' && state.listener.activeRequests === 0; }
  function canStartListener() { return ['stopped', 'failed'].includes(state.listener?.state) && state.listener.activeRequests === 0; }
  function requireStopped() { if (!stopped()) failLocal('请先停止监听并等待请求结束，再修改设置。'); }
  function ports(prefix) {
    const listenPort = Number($(prefix + '-port').value), managementPort = Number($(prefix + '-management-port').value);
    if (![listenPort, managementPort].every(value => Number.isInteger(value) && value >= 1024 && value <= 65535)) failLocal('端口须为 1024–65535 的整数。');
    if (listenPort === managementPort) failLocal('数据端口与连接端口不能相同。');
    const maxRequestBytes = Number($(prefix + '-request-mib').value) * 1048576, maxConcurrency = Number($(prefix + '-concurrency').value);
    if (!Number.isInteger(maxRequestBytes) || maxRequestBytes < 1 || maxRequestBytes > 4 * 1048576) failLocal('最大请求大小须对应 1 字节至 4 MiB 的整数个字节。');
    if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1 || maxConcurrency > 128) failLocal('并发上限须为 1–128 的整数。');
    return { alias: $(prefix + '-alias').value.trim(), listenPort, managementPort, maxRequestBytes, maxConcurrency };
  }
  function publicUpstream(value) {
    let url; try { url = new URL(value.trim()); } catch { failLocal('请输入有效的 HTTPS 上游地址。'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) failLocal('上游必须是无凭据、查询与 fragment 的 HTTPS 地址。');
    return url.href;
  }
  function selectedRoute() { return state.routes.find(route => route.id === state.editingRoute); }
  function compatibleCliRoutes() {
    const protocol = $('cli-tool').value === 'codex' ? 'openai' : 'anthropic';
    return state.routes.filter(route => route.protocol === protocol && route.enabled && route.credentialPresent !== false);
  }
  function fillCliRoutes() {
    const select = $('cli-route'), previous = select.value;
    const routes = compatibleCliRoutes();
    select.replaceChildren(...routes.map(route => option(route.id, route.clientAlias + ' · ' + route.id)));
    if (routes.some(route => route.id === previous)) select.value = previous;
    if (select.value !== previous) clearCliPreview();
    $('cli-route-hint').textContent = !state.session ? '连接模型网关后，选择与工具协议匹配的已启用路由。' : !routes.length ? '暂无与此工具协议匹配、已启用且保存认证的路由。请先添加或启用兼容路由。' : '只列出与此工具协议匹配的已启用路由。入口接管保留模型与本地 service_tier。';
  }
  function editorBusy(name) {
    const submit = $(name + '-form').querySelector('[data-submit]');
    if (busy.has(submit)) return true;
    if (name === 'route') return busy.has($('route-delete-confirm'));
    return false;
  }
  function updateButtons() {
    for (const element of document.querySelectorAll('[data-session]')) element.disabled = !state.session || !state.supported || state.localChanging || busy.has(element);
    $('refresh-status').disabled=!state.supported||state.localChanging||busy.has($('refresh-status'));
    const setupSubmit=$('setup-form').querySelector('[data-submit]'),localSubmit=$('local-form').querySelector('[data-submit]');
    setupSubmit.disabled=!state.supported||state.localChanging||Boolean(state.local?.configured)||busy.has(setupSubmit);
    localSubmit.disabled=!state.supported||!state.local?.configured||state.localChanging||busy.has(localSubmit);
    const listenerState=state.listener?.state,owned=state.listener?.owned===true,listenerBusy=state.localChanging||state.listenerChanging||Boolean(state.pendingStop);
    const listening=['listening','draining'].includes(listenerState);
    $('chain-lumi-settings').disabled=!state.supported||!state.local||state.localChanging;
    $('chain-listener-toggle').checked=listening;
    $('chain-listener-toggle').disabled=!state.session||listenerBusy||busy.has($('chain-listener-toggle'))||(listening?!owned||listenerState!=='listening':!canStartListener());
    $('chain-listener-label').textContent=state.session?({listening:'已开启',stopped:'已关闭',draining:'正在关闭',failed:'启动失败'}[listenerState]||'读取状态中'):state.connecting?'正在连接':state.local?.configured?'等待连接':'尚未设置';
    $('setup-key-generate').disabled=setupSubmit.disabled||busy.has($('setup-key-generate'));
    for(const prefix of ['setup','access'])$(prefix+'-key-copy').disabled=!$(prefix==='setup'?'setup-client-key':'access-key').value||busy.has($(prefix+'-key-copy'));
    renderGeneratedClientKey();
    for(const [id,enabled]of [['listener-start',canStartListener()],['listener-stop',owned&&listenerState==='listening'],['listener-cancel',owned&&['listening','draining'].includes(listenerState)]])$(id).disabled=!state.session||listenerBusy||!enabled||busy.has($(id));
    $('listener-start').hidden=workbench.supported;
    const routeBusy=editorBusy('route'),cliBusy=['cli-apply','cli-restore','listener-restore-stop'].some(id=>busy.has($(id)));
    $('cli-apply').disabled=!state.session||!state.cliPreview||state.localChanging||cliBusy;
    $('cli-restore').disabled=!state.session||!state.cliTransaction?.recoverable||state.localChanging||cliBusy;
    $('listener-restore-stop').disabled=!state.session||!owned||listenerBusy||cliBusy||!state.cliTransaction?.recoverable;
    for(const input of $('route-form').querySelectorAll('input,select'))input.disabled=!state.session||state.localChanging||routeBusy;
    $('route-upstream-key').required=state.routeCreating;
    for(const input of $('local-form').querySelectorAll('input'))input.disabled=!state.supported||!state.local?.configured||state.localChanging||editorBusy('local');
    $('route-form').querySelector('[data-submit]').disabled=!state.session||state.localChanging||routeBusy||state.providerModelsLoading;
    $('route-delete').disabled=!state.session||state.localChanging||routeBusy||!state.editingRoute;
    $('provider-model-fetch').disabled=!state.supported||state.localChanging||routeBusy||state.providerModelsLoading||!providerModelSource();
    $('provider-model-status').textContent=state.providerModelsMessage||providerModelHint();$('provider-model-status').className='field-help model-status '+(state.providerModelsKind||'');
    $('route-cancel').disabled=!state.session||state.localChanging||routeBusy;
    for (const input of $('access-form').querySelectorAll('input,select')) input.disabled=!state.session||state.localChanging||editorBusy('access');
    $('access-form').querySelector('[data-submit]').disabled=!state.session||state.localChanging||editorBusy('access')||!$('access-route').value;
    $('access-key-generate').disabled=$('access-key').disabled||!$('access-route').value||busy.has($('access-key-generate'));
    $('access-cancel').disabled=state.localChanging||editorBusy('access')||!state.drafts.access.dirty;
    $('local-cancel').disabled=!state.local?.configured||state.localChanging||editorBusy('local')||!state.drafts.local.dirty;
    $('recording-cancel').disabled=!state.session||state.localChanging||editorBusy('recording')||!state.drafts.recording.dirty;
    $('recording-refresh').disabled=!state.session||state.localChanging||editorBusy('recording')||busy.has($('recording-refresh'));
    const cliSubmit=$('cli-form').querySelector('[data-submit]');cliSubmit.disabled=!state.session||state.localChanging||!compatibleCliRoutes().some(route=>route.id===$('cli-route').value)||busy.has(cliSubmit);
    $('cli-route').disabled=!state.session||state.localChanging||!compatibleCliRoutes().length;
    $('records-update-apply').disabled=!state.session||state.localChanging||busy.has($('records-update-apply'));
    for(const select of document.querySelectorAll('.select-wrap select'))select.parentElement.toggleAttribute('data-disabled',select.disabled);
    for(const name of Object.keys(state.drafts))renderDraft(name);
    workbench.updateButtons();
  }
  function showTab(name) {
    if (state.activeTab !== name) {clearProviderCatalog();clearGeneratedClientKey();}
    clearSecrets();
    state.activeTab = name;
    workbench.refreshChain();
    for (const panel of document.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== name;
    for (const button of document.querySelectorAll('[data-tab]')) {
      button.classList.toggle('active', button.dataset.tab === name);
      if (button.dataset.tab === name) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    if (name === 'records' && state.session && !state.records.length) void action(null, () => loadRecords(false));
    updateButtons();
  }
  function clearDetail() {
    state.detailTicket += 1; state.detail = null; state.bodyCursor = null; state.detailLoading = false;
    $('record-detail').hidden = true; $('detail-summary').replaceChildren();
    $('detail-body').textContent = ''; $('detail-body').hidden = true;
    $('detail-body-info').textContent = ''; $('detail-body-toggle').checked = false;
    $('detail-more').hidden = true;
    renderRecordsUpdate();
  }
  function clearCliPreview() {
    state.cliTicket += 1; state.cliPreview = null;
    $('cli-preview').hidden = true; $('cli-differences').replaceChildren();
    $('cli-conflicts').textContent = ''; $('cli-conflicts').hidden = true;
    updateButtons();
  }
  function clearSession({ preserveDrafts = false } = {}) {
    closeProviderDialog(true);clearProviderCatalog();clearGeneratedClientKey();
    workbench.clear({preserveDrafts});

    clearSecrets();
    state.epoch += 1;
    if (state.unsubscribe) { state.unsubscribe(); state.unsubscribe = null; }
    clearTimeout(state.refreshTimer); state.refreshTimer = null;
    state.session = null; state.listener = null; state.routes = []; state.rules = [];
    state.listenerChanging = false; state.listenerTicket += 1;
    state.configTicket += 1; state.configVersion = 0; state.recording = null; state.encryptionAvailable = false; state.pendingDelete = null; state.pendingStop = null; state.pendingRouteDelete = null;
    $('delete-dialog').close(); $('listener-stop-dialog').close(); $('route-delete-dialog').close();
    for (const name of ['route', 'recording']) {
      if (preserveDrafts && state.drafts[name].dirty) continue;
      $(name + '-form').reset(); resetDraft(name);
      if (name === 'route') { $('route-id').readOnly = false; state.editingRoute = null; state.routeCreating = false; state.previousRoute = null; }
    }
    $('body-consent-panel').hidden = true;
    state.records = []; state.nextCursor = null; state.selection.clear(); state.recordsTicket += 1; state.recordsPages = 0; state.recordsUpdated = false; state.recordsRevision += 1;
    state.cliTransaction = null; $('cli-recovery').hidden = true;
    clearCliPreview(); clearDetail(); renderListener(); renderRoutes(); renderRecords();
    if (preserveDrafts) for (const name of ['route', 'recording']) if (state.drafts[name].dirty) restoreDraft(name);
    $('body-state').textContent = '未知'; $('encryption-state').textContent = '连接后读取系统加密状态';
    $('recording-security').textContent = '连接后检查系统安全存储。';
    $('route-settings-details').open = preserveDrafts && state.drafts.route.dirty;
    updateButtons();
  }
  async function refreshStatus() {
    clearSecrets();
    const ticket = ++state.localTicket;
    const response = await sdk.gateway.local.status({});
    if (ticket !== state.localTicket) return;
    state.local = response;
    $('setup-form').hidden = response.configured;
    $('local-form').hidden = !response.configured;
    $('local-settings-details').hidden = !response.configured;
    if (response.configured && !state.session && (!response.running || response.errorCode)) $('local-settings-details').open = true;
    if (response.configured && !state.drafts.local.dirty) renderLocalSettings(response);
    if (response.errorCode) notice(errorNames[response.errorCode] || '模型网关暂不可用，请检查设置后重新连接。', 'warning');
    renderListener();
  }
  function renderLocalSettings(response) {
    $('local-alias').value = response.alias || '';
    $('local-port').value = response.listenPort ?? 18080;
    $('local-management-port').value = response.managementPort ?? 18081;
    $('local-request-mib').value = (response.maxRequestBytes ?? 2 * 1048576) / 1048576;
    $('local-concurrency').value = response.maxConcurrency ?? 32;
    resetDraft('local');
  }
  function renderAccessSettings() {
    const select=$('access-route'),previous=select.value,choices=workbench.accessChoices();
    select.replaceChildren(...choices.map(item=>option(item.id,item.label)));
    if(choices.some(item=>item.id===previous))select.value=previous;
    else select.value=workbench.preferredAccess()||choices[0]?.id||'';
    $('access-route-field').hidden=choices.length<=1;
    if(state.generatedClientKey?.saved&&state.generatedClientKey.routeId!==select.value)clearGeneratedClientKey();
    renderAccessAddress();
    if(!state.drafts.access.dirty)resetDraft('access');
  }
  function renderAccessAddress() {
    const port=state.local?.listenPort,route=state.routes.find(r=>r.id===$('access-route').value),shared=workbench.hasConfiguredAgents(),base=state.session&&port&&route?'http://127.0.0.1:'+port+(shared?'':'/'+route.id):null;
    $('agent-openai-url').textContent=base?base+'/v1':'连接后显示';$('agent-anthropic-url').textContent=base||'连接后显示';
    $('overview-openai-url').textContent=$('agent-openai-url').textContent;$('overview-anthropic-url').textContent=$('agent-anthropic-url').textContent;
    $('access-key-hint').textContent=(shared?'用于所选接入，已有授权范围保持。':'此旧配置使用所选供应商的专属入口。')+'自动生成后明文显示并可复制；保存后保留本次生成结果。手动 Key 至少 16 个字符。';
  }
  function cancelAccess() {
    $('access-key').value='';clearGeneratedClientKey();resetDraft('access');updateButtons();
  }
  async function saveAccess() {
    const clientApiKey=$('access-key').value;
    const generated=state.generatedClientKey?.source==='access'&&state.generatedClientKey.value===clientApiKey?state.generatedClientKey:null;
    clearSecrets();requireSession();const snapshot=requireSession();
    if(clientApiKey.length<16||clientApiKey.length>8192||/[\u0000-\u0020\u007f]/.test(clientApiKey))failLocal('接入 API Key 须为 16–8192 个字符，不能包含空白或控制字符。');
    const saved=state.routes.find(route=>route.id===$('access-route').value);
    if(!saved)failLocal('接入入口已变化，请刷新后重试。');
    const {credentialRef,credentialPresent,...route}=saved;
    try{await sdk.gateway.routes.save({sessionId:snapshot.sessionId,expectedVersion:state.configVersion,route,credentials:{clientApiKey}});}
    catch(error){if(generated&&current(snapshot)&&state.generatedClientKey===generated){$('access-key').value=clientApiKey;$('access-key').type='text';state.drafts.access.secretsCleared=false;draftChanged('access');}throw error;}
    if(!current(snapshot))return;
    resetDraft('access');clearCliPreview();await loadConfiguration();
    if(current(snapshot)){if(generated&&state.generatedClientKey===generated)rememberGeneratedClientKey(clientApiKey,'access',true,saved.id);notice('接入 API Key 已保存。客户端请使用新 Key；CLI 接管配置可重新预览和应用。','success');}
  }
  function cancelLocal() {
    if (!state.local?.configured) return;
    cancelAccess();renderLocalSettings(state.local);closeLocalDialog(true); updateButtons(); notice('网关参数编辑已取消，已恢复保存的设置。');
  }
  function cancelRecording() {
    if (!state.recording) return;
    renderRecording({ recording: state.recording, encryptionAvailable: state.encryptionAvailable });
    notice('录制设置编辑已取消，已恢复保存的设置。');
  }
  async function setup() {
    const credentials = takeCredentials('setup', true);
    const generated=state.generatedClientKey?.source==='setup'&&state.generatedClientKey.value===credentials.clientApiKey?state.generatedClientKey:null;
    const contextRevision=state.contextRevision,activeTab=state.activeTab;
    const epoch = state.epoch;
    const protocol = $('setup-protocol').value;
    const input = { ...ports('setup'), route: { id: $('setup-route-id').value.trim(), clientAlias: $('setup-client').value.trim(), protocol, upstreamBase: publicUpstream($('setup-upstream').value), enabled: true, capabilities: { serviceTier: protocol === 'openai' && $('setup-tier').checked } }, credentials };
    try { await sdk.gateway.local.setup(input); }
    catch (error) { await refreshStatus().catch(() => {}); $('local-settings-details').open = Boolean(state.local?.configured); throw error; }
    if (state.epoch !== epoch) return;
    await refreshStatus();
    if (state.epoch !== epoch) return;
    await connect();
    if(generated&&state.session&&!state.disposed&&state.contextRevision===contextRevision&&state.activeTab===activeTab){rememberGeneratedClientKey(credentials.clientApiKey,'access',true,input.route.id);showLocalSettings();}
    else closeLocalDialog(true);
    notice('模型网关已设置并连接，可启动监听。', 'success');
  }
  async function configureLocal() {
    if(state.drafts.access.dirty)failLocal('请先保存或取消接入 API Key 的更改，再保存网关参数。');
    clearSecrets();
    const snapshot = state.session ? requireSession() : null;
    const epoch = state.epoch;
    if (snapshot) requireSession();
    else if (!state.local?.configured || state.local.running) failLocal('请先连接管理端后再修改设置。');
    const expectedVersion = snapshot ? state.configVersion : state.local.configVersion;
    if (!Number.isInteger(expectedVersion)) failLocal('无法读取配置版本，请先刷新。');
    const input = { ...ports('local'), expectedVersion };
    state.localChanging = true; updateButtons(); notice('正在保存网关设置并重新连接…');
    try {
      await sdk.gateway.local.configure(input);
      if (snapshot ? !current(snapshot) : state.epoch !== epoch) return;
      resetDraft('local');
      clearSession({ preserveDrafts: true }); await refreshStatus(); await connect({ preserveDrafts: true });
      closeLocalDialog(true);notice('网关设置已保存并重新连接。', 'success');
    } finally { state.localChanging = false; updateButtons(); }
  }
  function renderListener() {
    const active = Boolean(state.session);
    $('connection-badge').textContent = active ? '已连接' : state.connecting ? '正在连接' : state.local?.configured ? '正在重连' : '尚未设置';
    $('connection-badge').className = 'pill ' + (active ? 'green' : 'muted');
    const names = { listening: '正在监听', stopped: '已停止', draining: '等待请求结束', failed: '监听失败', unknown: '读取状态中' };
    $('listener-state').textContent = active ? names[state.listener?.state] || '读取状态中' : '未连接';
    $('listener-address').textContent = state.listener?.address || (active ? state.listener?.state === 'stopped' ? '尚未启动监听' : '等待读取监听地址' : '—');
    $('active-count').textContent = active ? known(state.listener?.activeRequests) : '—';
    $('runtime-badge').textContent = active ? names[state.listener?.state] || '读取状态中' : state.local?.configured ? '未连接' : state.local ? '尚未设置' : '读取设置中';
    $('runtime-badge').className = 'pill ' + (active && state.listener?.state === 'listening' ? 'green' : 'muted');
    $('listener-state').className='pill '+(active&&state.listener?.state==='listening'?'green':'muted');
    $('gateway-overview-name').textContent=state.local?.alias||'模型网关';
    $('overview-management-address').textContent=state.local?.managementPort?'https://127.0.0.1:'+state.local.managementPort:'尚未设置';
    renderAccessAddress();
    $('listener-control-hint').textContent = !active ? '先连接管理端以确认监听状态；断开管理连接不会自动停止数据监听。' : state.listener?.state === 'unknown' ? '等待读取真实监听状态后才能启停。' : canStartListener() ? state.listener.state === 'failed' ? '监听失败。确认没有进行中的请求后可重试启动，由宿主核验监听归属。' : '监听已停止。可修改路由或参数，准备好后启动监听。' : !state.listener?.owned ? '此监听不属于当前管理连接，停止与取消操作不可用。' : state.listener.state === 'draining' ? '正在等待请求结束；有进行中的请求时可以取消并停止。' : state.listener.state === 'listening' ? '监听已运行。配置可直接保存；新请求使用新设置，进行中的请求继续完成。' : '等待读取真实监听状态与进行中的请求数量。';
    workbench.renderChain();
    updateButtons();
  }
  function retryConnection() {
    if(state.disposed||!state.local?.configured||state.reconnectTimer)return;
    state.reconnectTimer=setTimeout(()=>{state.reconnectTimer=null;void connect({preserveDrafts:true}).catch(()=>retryConnection());},Math.min(5000,500*2**Math.min(state.connectionFailures,4)));
  }
  async function connect({preserveDrafts=true}={}) {
    if(state.disposed||!state.local?.configured)return;
    if(state.connectionPromise)return state.connectionPromise;
    const previous=state.session?.sessionId;
    clearSession({preserveDrafts});const epoch=state.epoch;
    state.connecting=true;renderListener();
    const pending=(async()=>{
      if(previous)await sdk.gateway.disconnect({sessionId:previous}).catch(()=>{});
      let session;
      try {
        session=await sdk.gateway.connect({});
        if(state.disposed||state.epoch!==epoch){await sdk.gateway.disconnect({sessionId:session.sessionId}).catch(()=>{});return;}
        state.session=session;const snapshot=requireSession();
        const summary=await sdk.gateway.status(),status=summary.pairings.find(value=>value.instanceId===session.instanceId);
        state.listener={state:status?.listening===true?'listening':status?.listening===false?'stopped':'unknown',address:status?.listening&&state.local?.listenPort?'127.0.0.1:'+state.local.listenPort:null,activeRequests:status?.activeRequests??null,owned:false};renderListener();
        await Promise.all([loadConfiguration(),loadRecords(false)]);if(!current(snapshot))return;
        const dispose=await sdk.gateway.events.subscribe({sessionId:session.sessionId},event=>{
          if(!current(snapshot)||event.sessionId!==snapshot.sessionId)return;
          if(event.type==='status'){
            state.listener=event.status;renderListener();
            if(stopped()&&workbench.needsAccessSync()&&!state.localChanging&&!state.listenerChanging&&!editorBusy('route')&&!editorBusy('access')&&!busy.has($('refresh-status')))void action(null,async()=>{
              state.localChanging=true;updateButtons();
              try{await loadConfiguration();}finally{state.localChanging=false;updateButtons();}
            });
            if(event.status.state==='unknown')retryConnection();else {clearTimeout(state.reconnectTimer);state.reconnectTimer=null;}
          }else if(event.type==='warning')notice('网关报告异常，请检查监听状态与录制完整性。','warning');
          else if(event.type==='record-summary'){
            state.recordsRevision++;state.recordsUpdated=true;renderRecordsUpdate();
            if(state.activeTab!=='records')return;
            clearTimeout(state.refreshTimer);state.refreshTimer=setTimeout(()=>{
              if(!current(snapshot)||state.activeTab!=='records')return;
              if(recordsInUse())renderRecordsUpdate();else void action(null,()=>loadRecords(false,{automatic:true}));
            },150);
          }
        });
        if(current(snapshot))state.unsubscribe=dispose;else dispose();
        state.connectionFailures=0;clearTimeout(state.reconnectTimer);state.reconnectTimer=null;
        if(current(snapshot))notice('已自动连接。供应商、整流规则与记录已读取。','success');
      }catch(error){
        if(session)await sdk.gateway.disconnect({sessionId:session.sessionId}).catch(()=>{});
        if(!state.disposed&&state.epoch===epoch){clearSession({preserveDrafts:true});state.connectionFailures++;notice('自动连接暂未完成，将重试。可在 Lumi 设置中检查端口。','warning');retryConnection();}
        throw error;
      }
    })();
    state.connectionPromise=pending;
    try{return await pending;}finally{if(state.connectionPromise===pending)state.connectionPromise=null;state.connecting=false;renderListener();}
  }
  function requestStop(mode) {
    state.pendingStop = { ...requireSession(), mode };
    $('listener-stop-description').textContent = mode === 'cancel' ? '将取消进行中的请求并停止监听。取消或断流不能证明上游未执行，仍可能产生 token 或费用。' : '将等待进行中的请求结束后停止监听。';
    $('listener-stop-dialog').showModal();
    updateButtons();
  }
  async function confirmStop() {
    const pending = state.pendingStop; state.pendingStop = null; $('listener-stop-dialog').close();
    if (pending && current(pending)) await listenerCommand(pending.mode);
  }
  async function listenerCommand(mode) {
    const snapshot = requireSession();
    if (state.listenerChanging || (mode === 'start' ? !canStartListener() : !state.listener?.owned)) return;
    const ticket = ++state.listenerTicket; state.listenerChanging = true; updateButtons();
    try {
      const result = mode === 'start' ? await sdk.gateway.listener.start({ sessionId: snapshot.sessionId }) : await sdk.gateway.listener.stop({ sessionId: snapshot.sessionId, mode });
      if (!current(snapshot)) return;
      state.listener = result; renderListener();
      notice(mode === 'start' ? '监听状态已更新。' : '停止请求已提交，请以实际监听状态为准。', 'success');
    } finally { if (ticket === state.listenerTicket) { state.listenerChanging = false; updateButtons(); } }
  }
  function savedProviderModelSource() {
    const route=state.routes.find(r=>r.id===state.editingRoute);
    if(!state.session||!route||state.routeCreating||state.drafts.route.secretsCleared||$('route-upstream-key').value)return null;
    return $('route-id').value.trim()===route.id&&$('route-protocol').value===route.protocol&&$('route-upstream').value.trim()===route.upstreamBase?route:null;
  }
  function providerModelSource(){
    const saved=savedProviderModelSource();if(saved&&sdk?.gateway?.routes?.models?.detect)return {kind:'saved',routeId:saved.id};
    if(!state.session||!sdk?.gateway?.routes?.models?.preview)return null;
    const upstreamApiKey=$('route-upstream-key').value,protocol=$('route-protocol').value;
    if(!/^[\x21-\x7e]{1,8192}$/.test(upstreamApiKey)||!['openai','anthropic'].includes(protocol))return null;
    try{return {kind:'draft',routeId:$('route-id').value.trim()||'draft-provider',protocol,upstreamBase:publicUpstream($('route-upstream').value),upstreamApiKey};}catch{return null;}
  }
  function providerModelHint(){
    const source=providerModelSource();
    if(source?.kind==='saved')return '使用已保存认证读取模型目录；新模型加入待保存列表，保留已有别名、启用与隐藏设置。';
    if(source?.kind==='draft')return '使用本次填写的 API 与 Key 获取模型，结果保留在草稿中，保存供应商后生效。';
    if(!sdk?.gateway?.routes?.models?.preview)return '当前 Lumi 构建尚不支持保存前获取模型；已保存的供应商可读取目录，也可手动添加。';
    return '填写有效的 HTTPS API 地址、协议与 API Key 后即可获取模型，无需先保存供应商。';
  }
  function clearProviderCatalog(){state.providerModelsTicket++;state.providerModelsLoading=false;state.providerModelsMessage='';state.providerModelsKind='';}
  function validateModelCatalog(result,snapshot){
    if(!result||result.routeId!==snapshot.routeId||result.configVersion!==snapshot.configVersion||result.source!=='catalog'||!Number.isFinite(result.checkedAtMs)||typeof result.truncated!=='boolean'||!Array.isArray(result.models)||result.models.length>500||result.models.some(model=>typeof model?.id!=='string'||!model.id.length||new TextEncoder().encode(model.id).length>256||/[\u0000-\u001f\u007f-\u009f]/.test(model.id)))throw new Error('model-catalog-invalid');
  }
  async function fetchProviderModels(){
    const source=providerModelSource();if(!source||state.localChanging||editorBusy('route')||state.providerModelsLoading)return;
    const snapshot={...requireSession(),routeId:source.routeId,configVersion:state.configVersion},ticket=++state.providerModelsTicket,sourceSignature=JSON.stringify(source);
    const captureCurrent=()=>current(snapshot)&&ticket===state.providerModelsTicket&&snapshot.configVersion===state.configVersion&&JSON.stringify(providerModelSource())===sourceSignature;
    state.providerModelsLoading=true;state.providerModelsMessage='正在从供应商读取模型目录…';state.providerModelsKind='';updateButtons();
    try{
      const {kind,...query}=source;const result=await sdk.gateway.routes.models[kind==='draft'?'preview':'detect']({sessionId:snapshot.sessionId,expectedVersion:snapshot.configVersion,...query});
      if(!captureCurrent())return;validateModelCatalog(result,snapshot);
      const merged=workbench.importModels(result.models);
      state.providerModelsMessage='模型目录：'+result.models.length+' 项 · 新增 '+merged.added+' 个'+(merged.added?'，保存后生效':'')+' · 已配置 '+merged.existing+' 个'+(merged.conflicts?' · '+merged.conflicts+' 个名称与现有别名冲突，未添加':'')+(merged.capacity?' · 达到 128 个模型上限，'+merged.capacity+' 个未添加':'')+(result.truncated?' · 上游目录已截断':'')+(!result.models.length?' · 上游返回空目录，现有模型保留':'');
      state.providerModelsKind=merged.conflicts||merged.capacity||result.truncated?'warning':'';
    }catch(error){if(captureCurrent()){state.providerModelsMessage=safeError(error)+' 可手动添加模型。';state.providerModelsKind='error';}}
    finally{if(captureCurrent()){state.providerModelsLoading=false;updateButtons();}}
  }
  function fillRouteSelects() {
    for (const select of document.querySelectorAll('.route-select')) {
      if (select.id === 'cli-route') continue;
      const previous = select.value;
      select.replaceChildren();
      if (select.dataset.allowAll) select.append(option('', '全部路由'));
      for (const route of state.routes) select.append(option(route.id, route.clientAlias + ' · ' + route.id));
      if (previous && !state.routes.some(route => route.id === previous) && (select.id === 'filter-route')) select.append(option(previous, previous + ' · 原路由'));
      if ([...select.options].some(value => value.value === previous)) select.value = previous;
    }
    fillCliRoutes();
  }
  function searchTokens(id) { return $(id).value.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean); }
  function searchMatches(tokens, values) {
    const haystack = values.filter(value => value !== undefined && value !== null).map(String).join('\n').toLocaleLowerCase();
    return tokens.every(token => haystack.includes(token));
  }
  function tableCell(label, ...content) {
    const cell = document.createElement('td'); cell.dataset.label = label; cell.append(...content); return cell;
  }
  function revealEditor(id) {
    const details = $(id); details.open = true;
    details.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
  }
  function showLocalSettings(){
    if(!state.local)return;const configured=state.local.configured,content=$(configured?'local-settings-details':'setup-form');
    $('local-dialog-body').append(content);if(configured)content.open=true;
    $('local-dialog-title').textContent=configured?'网关设置':'首次网关设置';
    $('local-dialog-description').textContent=configured?'运行中可保存接入 API Key、名称、端口与请求限制。新请求使用新设置，进行中的请求继续完成。':'填写供应商 API 与认证，保存后即可连接网关。';
    $('local-dialog-notice').textContent='';$('local-dialog-notice').hidden=true;
    if(!$('local-settings-dialog').open)$('local-settings-dialog').showModal();
    const input=$(configured?'local-alias':'setup-alias');if(!input.disabled)input.focus();
  }
  function closeLocalDialog(force=false){
    const dialog=$('local-settings-dialog');if(!dialog.open)return true;
    if(!force&&(editorBusy('local')||editorBusy('access')||state.drafts.local.dirty||state.drafts.access.dirty||busy.has($('setup-form').querySelector('[data-submit]')))){
      $('local-dialog-notice').textContent=editorBusy('local')||editorBusy('access')||busy.has($('setup-form').querySelector('[data-submit]'))?'正在保存网关设置，请稍候。':'更改尚未保存，请保存或取消编辑后关闭。';$('local-dialog-notice').hidden=false;return false;
    }
    clearSecrets();clearGeneratedClientKey();dialog.close();const details=$('local-settings-details');localPlaceholder.after(details);setupPlaceholder.after($('setup-form'));details.open=state.drafts.local.dirty;return true;
  }
  function showProviderDialog(){
    const dialog=$('provider-editor-dialog'),details=$('route-settings-details');$('provider-dialog-body').append(details);details.open=true;
    $('provider-dialog-title').textContent=state.routeCreating?'添加供应商':'编辑供应商 · '+($('route-name').value||state.editingRoute||'');
    $('provider-dialog-notice').textContent='';$('provider-dialog-notice').hidden=true;
    if(!dialog.open)dialog.showModal();
  }
  function closeProviderDialog(force=false){
    const dialog=$('provider-editor-dialog');if(!dialog.open)return true;
    if(!force&&(state.drafts.route.dirty||editorBusy('route'))){$('provider-dialog-notice').textContent=editorBusy('route')?'正在保存供应商，请稍候。':'更改尚未保存，请保存或取消编辑后关闭。';$('provider-dialog-notice').hidden=false;return false;}
    clearProviderCatalog();dialog.close();const details=$('route-settings-details');providerPlaceholder.after(details);details.open=false;return true;
  }
  async function openOverviewProvider(id,{addModel=false,focusModel=null}={}){
    if(!state.local?.configured){showTab('gateway');$('setup-form').scrollIntoView({block:'start'});$('setup-upstream').focus();return;}
    requireSession();
    if(state.drafts.route.dirty&&(id!==state.editingRoute||state.routeCreating)){
      showProviderDialog();notice('供应商有未保存的更改，请先保存或取消，再切换。','warning');return;
    }
    if(id===null){
      newRoute();if(!state.routeCreating)return;
      let number=1;while(state.routes.some(r=>r.id==='provider-'+number))number++;
      $('route-id').value='provider-'+number;$('route-client').value='provider-'+number;resetDraft('route');
    }else{const route=state.routes.find(r=>r.id===id);if(!route)failLocal('供应商已变化，请刷新后重新选择。');chooseRoute(route);}
    showProviderDialog();
    if(addModel){if(providerModelSource())await fetchProviderModels();else workbench.addModel();}
    else if(focusModel){const index=JSON.parse($('route-models-config').value||'[]').findIndex(m=>m.id===focusModel),input=$('provider-model-'+index+'-id');input?.focus();input?.scrollIntoView({block:'nearest'});}
    else $('route-name').focus();
  }
  function cellStack(...content) { const group = text('div', '', 'gateway-cell-stack'); group.append(...content); return group; }
  function emptyTable(body, message) {
    const row = document.createElement('tr'), cell = text('td', message, 'gateway-empty muted'); cell.colSpan = 6; row.append(cell); body.append(row);
  }
  function renderRoutes() { fillRouteSelects(); workbench.renderChain(); }
  function chooseRoute(route, { openEditor = false } = {}) {
    if (editorBusy('route') || state.localChanging) return;
    if (route.id === state.editingRoute && !state.routeCreating) {
      if (openEditor || state.drafts.route.dirty) revealEditor('route-settings-details');
      return;
    }
    if (state.drafts.route.dirty) { notice('路由有未保存的更改，请先保存或取消编辑，再切换路由。', 'warning'); revealEditor('route-settings-details'); return; }
    editRoute(route, { openEditor });
  }
  function newRoute() {
    if (editorBusy('route') || state.localChanging) return;
    if (state.drafts.route.dirty) { notice('路由有未保存的更改，请先保存或取消编辑，再添加路由。', 'warning'); revealEditor('route-settings-details'); return; }
    state.previousRoute = state.editingRoute;
    editRoute(null, { creating: true });
  }
  function cancelRoute() {
    const id = state.routeCreating ? state.previousRoute : state.editingRoute;
    const route = state.routes.find(value => value.id === id) || state.routes[0];
    editRoute(route || null, { creating: false });
    closeProviderDialog(true);
    notice('供应商编辑已取消，已恢复保存的设置。');
  }
  function editRoute(route, { creating = !route, openEditor = creating } = {}) {
    clearProviderCatalog();
    clearSecrets();
    state.editingRoute = route?.id || null;
    state.routeCreating = creating;
    $('route-form-heading').textContent = route ? '编辑供应商' : '添加供应商';
    workbench.editRoute(route);
    $('route-id').value = route?.id || ''; $('route-id').readOnly = Boolean(route);
    $('route-client').value = route?.clientAlias || '';
    $('route-protocol').value = route?.protocol || 'openai'; $('route-upstream').value = route?.upstreamBase || '';
    $('route-enabled').checked = route?.enabled ?? true;
    $('route-tier').checked = route?.capabilities?.serviceTier ?? true;
    $('route-key-hint').textContent = route ? '留空保持已保存的认证；填写新值即可更换。不会显示已保存内容，提交或离开页面即清空输入。' : '填写供应商的上游 API key；Agent 接入 API Key 在 Lumi 节点的设置中管理。提交或离开页面即清空输入。';
    $('route-settings-details').open = openEditor;
    resetDraft('route');
    renderRoutes({ updateOptions: false });
    updateButtons();
    if (openEditor) revealEditor('route-settings-details');
  }
  async function loadConfiguration({ reset = [] } = {}) {
    clearSecrets(); clearProviderCatalog();
    const snapshot = requireSession(); const ticket = ++state.configTicket;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const [routes, rules, recording, extra] = await Promise.all([
        sdk.gateway.routes.config.get({ sessionId: snapshot.sessionId }),
        sdk.gateway.rules.list({ sessionId: snapshot.sessionId }),
        sdk.gateway.recording.config.get({ sessionId: snapshot.sessionId }),
        workbench.getConfig(snapshot),
      ]);
      if (!current(snapshot) || ticket !== state.configTicket) return;
      if (routes.configVersion !== rules.policyVersion || routes.configVersion !== recording.configVersion || extra && (extra.agents.configVersion!==routes.configVersion || extra.rectifiers.configVersion!==routes.configVersion)) continue;
      const withdrawBody = state.recording?.bodies && !recording.recording.bodies;
      state.configVersion = routes.configVersion;
      state.routeVersion = state.ruleVersion = state.recordingVersion = state.configVersion;
      state.routes = routes.routes; state.rules = rules.rules;
      state.recording = recording.recording; state.encryptionAvailable = recording.encryptionAvailable;
      workbench.accept(extra);
      if(await workbench.synchronizeAccess())continue;
      renderAccessSettings();
      const route = state.routes.find(value => value.id === state.editingRoute) || (!state.routeCreating ? state.routes[0] : null);
      renderRoutes();
      if (!state.drafts.route.dirty || reset.includes('route')) editRoute(route || null, { creating: state.routeCreating && !route });
      else { restoreDraft('route'); $('route-settings-details').open = true; }
      renderRecording(recording, { preserveDraft: state.drafts.recording.dirty && !reset.includes('recording') });
      if (withdrawBody) clearDetail();
      updateButtons(); return;
    }
    failLocal('配置读取期间有并发修改，请重新读取后操作。');
  }
  async function loadRoutes() {
    if (state.drafts.route.dirty) { notice('路由草稿尚未保存，请先取消编辑后重新读取。', 'warning'); return; }
    await loadConfiguration();
  }
  async function saveRoute() {

    const credentials = takeCredentials('route', !state.editingRoute);
    requireSession();
    const snapshot = requireSession();
    const id = $('route-id').value.trim();
    if (!state.editingRoute && state.routes.some(route => route.id === id)) failLocal('路由 ID 已存在，请选择已有路由编辑。');
    const protocol = $('route-protocol').value;
    const route = { id, clientAlias: $('route-client').value.trim(), protocol, upstreamBase: publicUpstream($('route-upstream').value), enabled: $('route-enabled').checked, capabilities: { serviceTier: protocol === 'openai' && $('route-tier').checked },...workbench.routeValues() };
    const input = { sessionId: snapshot.sessionId, expectedVersion: state.configVersion, route };
    if (credentials) input.credentials = credentials;
    await sdk.gateway.routes.save(input);
    if (!current(snapshot)) return;
    state.editingRoute = id;
    state.routeCreating = false;
    let displaySaved=true;
    if(workbench.supported){try{await workbench.saveOverviewRoute(id);}catch{displaySaved=false;}}
    if(!current(snapshot))return;
    await loadConfiguration({ reset: ['route'] }); clearCliPreview();
    if(displaySaved){closeProviderDialog(true);notice('供应商、模型与显示设置已保存。', 'success');}
    else notice('供应商与模型已保存，但隐藏设置未能保存。请重新编辑并重试。', 'warning');
  }
  function requestRouteDelete() {
    clearProviderCatalog();
    clearSecrets(); requireSession();
    if (!state.editingRoute) return;
    state.pendingRouteDelete = { ...requireSession(), routeId: state.editingRoute, expectedVersion: state.configVersion };
    $('route-delete-description').textContent = '将删除路由 ' + short(state.editingRoute) + ' 及其已保存认证。历史记录保持原样。';
    $('route-delete-dialog').showModal();
  }
  async function confirmRouteDelete() {
    const pending = state.pendingRouteDelete; state.pendingRouteDelete = null; $('route-delete-dialog').close();
    if (!pending || !current(pending)) return;
     clearSecrets(); requireSession(); clearCliPreview();
    if(pending.expectedVersion!==state.configVersion)failLocal('配置已变化，请重新发起删除。');
    await workbench.synchronizeAccess({excludeProviderId:pending.routeId});
    try { await sdk.gateway.routes.delete({ sessionId: pending.sessionId, expectedVersion: state.configVersion, routeId: pending.routeId }); }
    catch(error){if(current(pending))await loadConfiguration();throw error;}
    if (!current(pending)) return;
    closeProviderDialog(true);state.editingRoute = null; state.routeCreating = false; await loadConfiguration({ reset: ['route'] });
    notice('路由及其认证已删除。', 'success');
  }
  function filterInput() {
    const filter = {};
    for (const [key, element] of [['routeId', 'filter-route'], ['model', 'filter-model'], ['status', 'filter-status'], ['tier', 'filter-tier']]) if ($(element).value.trim()) filter[key] = $(element).value.trim();
    for (const [key, element] of [['fromMs', 'filter-from'], ['toMs', 'filter-to']]) if ($(element).value) filter[key] = new Date($(element).value).getTime();
    if (filter.fromMs && filter.toMs && filter.fromMs > filter.toMs) failLocal('起始时间不能晚于结束时间。');
    return filter;
  }
  function filtersChanged() {
    state.recordsTicket += 1; state.records = []; state.nextCursor = null; state.selection.clear(); state.recordsPages = 0; state.recordsUpdated = false; clearDetail(); renderRecords();
  }
  function recordsInUse() { return Boolean(state.selection.size || state.recordsPages > 1 || busy.has($('records-more')) || state.detail || state.detailLoading || state.pendingDelete || $('delete-dialog').open || busy.has($('delete-confirm'))); }
  function renderRecordsUpdate() {
    $('records-update-note').hidden = !state.recordsUpdated;
    $('records-update-message').textContent = recordsInUse() ? '有新请求或状态更新。当前选择与详情保持不变；显示最新记录会返回首批并清除选择。' : '有新请求或状态更新，可显示最新记录。';
  }
  async function loadRecords(append, { automatic = false } = {}) {
    if (automatic && recordsInUse()) { state.recordsUpdated = true; renderRecordsUpdate(); return false; }
    const snapshot = requireSession(); const ticket = ++state.recordsTicket;
    const revision = state.recordsRevision;
    const filter = filterInput();
    const input = { sessionId: snapshot.sessionId, filter, limit: 50 };
    if (append && state.nextCursor) input.cursor = state.nextCursor;
    const result = await sdk.gateway.records.list(input);
    if (!current(snapshot) || ticket !== state.recordsTicket) return false;
    if (automatic && recordsInUse()) { state.recordsUpdated = true; renderRecordsUpdate(); return false; }
    if (!append) state.selection.clear();
    state.records = append ? state.records.concat(result.records.filter(record => !state.records.some(old => old.id === record.id))) : result.records;
    state.recordsPages = append ? state.recordsPages + 1 : 1;
    state.recordsUpdated = revision !== state.recordsRevision;
    state.nextCursor = result.nextCursor; renderRecords(); return true;
  }
  function renderRecords() {
    const tbody = $('records-body'); tbody.replaceChildren();
    if (!state.records.length) { const row = document.createElement('tr'); const cell = text('td', state.session ? '当前筛选下没有记录。' : '连接后显示记录', 'gateway-empty muted'); cell.colSpan = 6; row.append(cell); tbody.append(row); }
    for (const record of state.records) {
      const row = document.createElement('tr'); const selected = document.createElement('input'); selected.type = 'checkbox'; selected.checked = state.selection.has(record.id); selected.setAttribute('aria-label', '选择记录 ' + record.id);
      selected.addEventListener('change', () => { if (selected.checked) state.selection.add(record.id); else state.selection.delete(record.id); updateSelection(); });
      const check = document.createElement('td'); check.append(selected); row.append(check);
      const first = document.createElement('td'); first.append(text('span', time(record.startedAtMs)), text('span', record.model || '模型未知', 'minor muted small-text')); row.append(first);
      const route = document.createElement('td'); route.append(text('span', record.routeId + ' · ' + (statusNames[record.status] || '未知状态')), text('span', record.recordingPartial ? '录制不完整' : '观测完整', 'minor muted small-text')); row.append(route);
      const tiers = document.createElement('td'); tiers.append(text('span', short(tier(record.original)) + ' → ' + short(tier(record.effective)) + ' → ' + short(tier(record.reported)), 'tier')); row.append(tiers);
      const timing = document.createElement('td'); timing.append(text('span', known(record.inputTokens) + ' 入 / ' + known(record.outputTokens) + ' 出'), text('span', known(record.durationMs, ' ms'), 'minor muted small-text')); row.append(timing);
      const detail = document.createElement('td'); const button = text('button', '详情', 'button default'); button.type = 'button'; button.addEventListener('click', () => void action(button, () => loadDetail(record.id, false))); detail.append(button); row.append(detail); tbody.append(row);
    }
    $('records-more').hidden = !state.nextCursor; updateSelection();
  }
  function updateSelection() {
    $('record-count').textContent = '已显示 ' + state.records.length + ' 条';
    $('record-selected-count').textContent = '选中 ' + state.selection.size + ' 条';
    $('select-all').checked = state.records.length > 0 && state.records.every(record => state.selection.has(record.id));
    $('select-all').indeterminate = state.selection.size > 0 && !$('select-all').checked;
    $('select-all').disabled = !state.session || !state.records.length || state.localChanging;
    renderRecordsUpdate(); updateButtons();
  }
  function upstreamFailureHint(record) {
    if(record?.status!=='upstream-error'||record.httpStatus!==404)return '';
    return '供应商返回 HTTP 404；Lumi 已转发请求。请核对该供应商的 API 前缀、上游推理接口及模型 ID，并确认当前 Key 有权使用该模型。模型目录可见不代表推理接口可用。';
  }
  function renderDetail(record) {
    const summary = $('detail-summary'); summary.replaceChildren();
    const entries = [
      ['请求 ID', record.id], ['时间', time(record.startedAtMs)], ['路由 / 客户端', record.routeId + ' / ' + record.clientAlias], ['接口 / 模型', record.endpoint + ' / ' + (record.model || '未知')],
      ['状态 / HTTP', (statusNames[record.status] || '未知') + ' / ' + known(record.httpStatus)], ['客户端原值', tier(record.original)], ['发送值', tier(record.effective)], ['上游报回值', tier(record.reported)], ['命中规则', record.ruleId || '默认透传'],
      ['输入 / 输出 token', known(record.inputTokens) + ' / ' + known(record.outputTokens)], ['缓存读取 / 写入', known(record.cacheReadTokens) + ' / ' + known(record.cacheWriteTokens)], ['首响应 / 首内容', known(record.firstResponseMs, ' ms') + ' / ' + known(record.firstContentMs, ' ms')], ['总耗时', known(record.durationMs, ' ms')], ['请求 / 响应字节', known(record.requestBytes) + ' / ' + known(record.responseBytes)], ['录制完整性', record.recordingPartial ? '不完整，部分观测或正文缺失' : '已观测完整'],
    ];
    if(record.chain)entries.push(['Agent 接口',record.chain.entryEndpoint],['上游推理接口',record.chain.upstreamEndpoint],['实际上游模型',record.chain.upstreamModel||'未知']);
    const hint=upstreamFailureHint(record);if(hint)entries.push(['错误来源',hint]);
    for (const [label, value] of entries) { summary.append(text('dt', label), text('dd', value)); }
  }
  async function loadDetail(recordId, includeBody, append = false) {
    const snapshot = requireSession();
    if (!append && state.detail?.id !== recordId) clearDetail();
    const ticket = ++state.detailTicket;
    state.detailLoading = true;
    if (!append) {
      $('detail-body').textContent = ''; $('detail-body').hidden = true;
      $('detail-body-info').textContent = ''; $('detail-more').hidden = true; state.bodyCursor = null;
    }
    const input = { sessionId: snapshot.sessionId, recordId, includeBody };
    if (append && state.bodyCursor) input.bodyCursor = state.bodyCursor;
    try {
      const result = await sdk.gateway.records.get(input);
      if (!current(snapshot) || ticket !== state.detailTicket) return;
      state.detail = result.record; renderDetail(result.record); $('record-detail').hidden = false;
      $('detail-body-toggle').checked = includeBody;
      if (includeBody && result.body) {
        $('detail-body').textContent = result.body.text; $('detail-body').hidden = false;
        $('detail-body-info').textContent = (result.body.encrypted ? '来自加密记录' : '记录数据') + ' · 已脱敏' + (result.body.truncated ? ' · 原始捕获已截断' : '') + (result.body.complete ? ' · 正文已到末尾' : ' · 尚有内容或观测缺失');
        state.bodyCursor = result.body.nextCursor;
      } else {
        $('detail-body').hidden = true; $('detail-body-info').textContent = includeBody ? '此请求没有可读取的正文。' : '';
        state.bodyCursor = null;
      }
      $('detail-more').hidden = !state.bodyCursor; updateButtons();
    } finally { if (current(snapshot) && ticket === state.detailTicket) { state.detailLoading = false; renderRecordsUpdate(); } }
  }
  async function deleteRecords() {
    const snapshot = state.pendingDelete; state.pendingDelete = null;
    if (!snapshot || !current(snapshot)) return;
    const recordIds = snapshot.recordIds;
    if (!recordIds.length) return;
    clearDetail();
    const result = await sdk.gateway.records.delete({ sessionId: snapshot.sessionId, selection: { recordIds } });
    if (!current(snapshot)) return;
    clearDetail();
    await loadRecords(false); notice('已删除 ' + result.deleted + ' 条记录。', 'success');
  }
  async function exportRecords() {
    const snapshot = requireSession(); const recordIds = [...state.selection];
    if (!recordIds.length) return;
    const result = await sdk.gateway.records.export({ sessionId: snapshot.sessionId, selection: { recordIds }, format: 'jsonl', includeBody: false });
    if (!current(snapshot)) return;
    notice(result.cancelled ? '已取消导出。' : '已导出 ' + result.exported + ' 条脱敏元数据记录。', result.cancelled ? '' : 'success');
  }
  async function loadRecording() { await loadConfiguration({ reset: ['recording'] }); }
  function renderRecording(result, { preserveDraft = false } = {}) {
    if (preserveDraft) restoreDraft('recording');
    else {
      $('recording-bodies').checked = result.recording.bodies; $('recording-days').value = result.recording.retentionDays;
      $('recording-count').value = result.recording.maxRecords; $('recording-megabytes').value = result.recording.maxBytes / 1024 / 1024;
      $('recording-kilobytes').value = result.recording.captureBytes / 1024;
      $('recording-consent').checked = false; resetDraft('recording');
    }
    $('body-consent-panel').hidden = !$('recording-bodies').checked || Boolean(result.recording.bodies);
    $('body-state').textContent = result.recording.bodies ? '加密正文' : '仅元数据';
    $('encryption-state').textContent = result.encryptionAvailable ? '系统安全存储可用' : '系统安全存储不可用';
    $('recording-security').textContent = result.encryptionAvailable ? '系统安全存储可用，正文保存在专用加密记录库。' : '系统安全存储不可用，不能开启正文录制。'; updateButtons();
  }
  async function saveRecording() {

    const snapshot = requireSession();
    const bodies = $('recording-bodies').checked;
    if (bodies && !state.recording?.bodies && !$('recording-consent').checked) failLocal('请先确认了解正文录制的内容与保存方式。');
    const recording = { bodies, retentionDays: Number($('recording-days').value), maxRecords: Number($('recording-count').value), maxBytes: Number($('recording-megabytes').value) * 1024 * 1024, captureBytes: Number($('recording-kilobytes').value) * 1024, policyVersion: state.recording?.policyVersion ?? 0 };
    await sdk.gateway.recording.config.set({ sessionId: snapshot.sessionId, expectedVersion: state.configVersion, recording });
    if (!current(snapshot)) return;
    await loadRecording(); notice('录制设置已保存，仅影响后续请求。', 'success');
  }
  async function previewCli() {
    const snapshot = requireSession(); const ticket = ++state.cliTicket;
    if (!compatibleCliRoutes().some(route => route.id === $('cli-route').value)) failLocal('没有可用的兼容路由，请先添加或启用与工具协议匹配的路由。');
    state.cliPreview = null; $('cli-preview').hidden = true;
    const result = await sdk.gateway.cliConfig.preview({ sessionId: snapshot.sessionId, tool: $('cli-tool').value, routeId: $('cli-route').value });
    if (!current(snapshot) || ticket !== state.cliTicket) return;
    state.cliPreview = result; $('cli-preview').hidden = false; $('cli-differences').replaceChildren();
    for (const difference of result.differences) { const row = text('div', '', 'gateway-difference'); row.append(text('strong', difference.label), text('span', difference.before), text('span', difference.after)); $('cli-differences').append(row); }
    if (!result.differences.length) $('cli-differences').append(text('p', '无需修改配置。', 'field-help'));
    $('cli-expiry').textContent = '预览到期：' + time(result.expiresAtMs) + ' · 认证值已隐藏';
    $('cli-conflicts').textContent = result.conflicts.length ? '存在冲突：' + result.conflicts.map(value => short(value)).join('；') : '';
    $('cli-conflicts').hidden = !result.conflicts.length; updateButtons();
  }
  async function applyCli() {
    const snapshot = requireSession(); const preview = state.cliPreview;
    if (!preview || preview.conflicts.length || Date.now() >= preview.expiresAtMs) failLocal('预览已过期或存在冲突，请重新预览。');
    const result = await sdk.gateway.cliConfig.apply({ transactionId: preview.transactionId, expectedFingerprint: preview.fingerprint });
    if (!current(snapshot)) return;
    state.cliTransaction = result; clearCliPreview(); renderCliRecovery(); notice('CLI 网关入口已应用，模型与本地 service_tier 保持原值。', 'success');
  }
  function renderCliRecovery() {
    $('cli-recovery').hidden = !state.cliTransaction;
    $('cli-recovery-description').textContent = state.cliTransaction?.recoverable ? '入口配置已应用。你可以恢复本次事务改动的字段；外部修改会先进行冲突检查。' : '本次事务已恢复。'; updateButtons();
  }
  async function restoreCli(stopAfter = false) {
    const snapshot = requireSession(); const transaction = state.cliTransaction;
    if (!transaction?.recoverable) return;
    if (stopAfter && (!state.listener?.owned || state.listenerChanging)) return;
    const ticket = stopAfter ? ++state.listenerTicket : null;
    if (stopAfter) { state.listenerChanging = true; updateButtons(); }
    try {
      const result = await sdk.gateway.cliConfig.restore({ transactionId: transaction.transactionId, expectedFingerprint: transaction.fingerprint });
      if (!current(snapshot)) return;
      state.cliTransaction = result; renderCliRecovery();
      if (stopAfter) {
        if (result.state !== 'restored' || result.recoverable) failLocal('配置未确认恢复，监听保持运行。');
        if (!stopped()) {
          const listener = await sdk.gateway.listener.stop({ sessionId: snapshot.sessionId, mode: 'drain' });
          if (!current(snapshot)) return;
          state.listener = listener; renderListener();
        }
        notice('CLI 入口已恢复，等待进行中的请求结束后停止监听。', 'success');
      } else notice('本次 CLI 配置改动已恢复。监听状态保持原样。', 'success');
    } finally { if (stopAfter && ticket === state.listenerTicket) { state.listenerChanging = false; updateButtons(); } }
  }
  for (const button of document.querySelectorAll('[data-tab]')) button.addEventListener('click', () => showTab(button.dataset.tab));
  listen('refresh-status','click',async()=>{await refreshStatus();if(!state.session)await connect();else await loadConfiguration();});
  listen('access-form','submit',saveAccess);listen('access-cancel','click',cancelAccess);
  listen('access-key-generate','click',()=>generateClientKey('access'));listen('setup-key-generate','click',()=>generateClientKey('setup'));
  listen('setup-form', 'submit', setup); listen('local-form', 'submit', configureLocal); listen('local-cancel', 'click', cancelLocal);
  $('setup-protocol').addEventListener('change', () => { if ($('setup-protocol').value === 'anthropic') $('setup-tier').checked = false; $('setup-tier').disabled = $('setup-protocol').value === 'anthropic'; });
  listen('chain-listener-toggle','change',()=>state.listener?.state==='listening'?requestStop('drain'):listenerCommand('start'));
  listen('chain-lumi-settings','click',showLocalSettings);
  $('local-dialog-close').addEventListener('click',()=>closeLocalDialog());
  $('local-settings-dialog').addEventListener('cancel',event=>{event.preventDefault();closeLocalDialog();});
  listen('provider-model-fetch','click',fetchProviderModels);
  for(const id of ['route-id','route-protocol','route-upstream','route-upstream-key'])for(const type of ['input','change'])$(id).addEventListener(type,()=>{clearProviderCatalog();updateButtons();});
  $('access-route').addEventListener('change',()=>{clearSecrets();clearGeneratedClientKey();resetDraft('access');renderAccessAddress();updateButtons();});
  $('provider-dialog-close').addEventListener('click',()=>closeProviderDialog());
  $('provider-editor-dialog').addEventListener('cancel',event=>{event.preventDefault();closeProviderDialog();});
  listen('listener-start', 'click', () => listenerCommand('start')); listen('listener-stop', 'click', () => requestStop('drain')); listen('listener-cancel', 'click', () => requestStop('cancel'));
  listen('listener-restore-stop', 'click', () => restoreCli(true));
  $('listener-stop-abort').addEventListener('click', () => { state.pendingStop = null; $('listener-stop-dialog').close(); updateButtons(); });
  $('listener-stop-dialog').addEventListener('cancel', () => { state.pendingStop = null; updateButtons(); });
  listen('listener-stop-confirm', 'click', confirmStop);
  listen('route-form', 'submit', saveRoute); listen('route-cancel', 'click', cancelRoute);
  listen('route-delete', 'click', requestRouteDelete); listen('route-delete-confirm', 'click', confirmRouteDelete);
  $('route-delete-abort').addEventListener('click', () => { state.pendingRouteDelete = null; $('route-delete-dialog').close(); });
  $('route-delete-dialog').addEventListener('cancel', () => { state.pendingRouteDelete = null; });
  $('route-upstream-endpoint').addEventListener('change',()=>{const endpoint=$('route-upstream-endpoint').value;if(endpoint)$('route-protocol').value=endpoint==='/v1/messages'?'anthropic':'openai';if($('route-protocol').value==='anthropic')$('route-tier').checked=false;draftChanged('route');clearProviderCatalog();updateButtons();});
  $('route-protocol').addEventListener('change', () => { if ($('route-protocol').value === 'anthropic') $('route-tier').checked = false; updateButtons(); });
  listen('filter-form', 'submit', () => loadRecords(false)); listen('records-refresh', 'click', () => loadRecords(false)); listen('records-more', 'click', () => loadRecords(true));
  listen('records-update-apply', 'click', async () => { if (await loadRecords(false)) { clearDetail(); renderRecordsUpdate(); } });
  for (const element of $('filter-form').querySelectorAll('input,select')) element.addEventListener('input', filtersChanged);
  listen('filter-reset', 'click', () => { $('filter-form').reset(); filtersChanged(); return loadRecords(false); });
  $('select-all').addEventListener('change', () => { state.selection.clear(); if ($('select-all').checked) for (const record of state.records) state.selection.add(record.id); renderRecords(); });
  listen('record-export', 'click', exportRecords);
  listen('record-delete', 'click', () => { state.pendingDelete = { ...requireSession(), recordIds: [...state.selection] }; $('delete-description').textContent = '将删除选中的 ' + state.selection.size + ' 条本机记录及其正文。'; $('delete-dialog').showModal(); });
  $('delete-cancel').addEventListener('click', () => { state.pendingDelete = null; $('delete-dialog').close(); renderRecordsUpdate(); });
  $('delete-dialog').addEventListener('cancel', () => { state.pendingDelete = null; renderRecordsUpdate(); });
  listen('delete-confirm', 'click', async () => { $('delete-dialog').close(); await deleteRecords(); });
  $('detail-close').addEventListener('click', clearDetail);
  listen('detail-body-toggle', 'change', () => state.detail && loadDetail(state.detail.id, $('detail-body-toggle').checked));
  listen('detail-more', 'click', () => state.detail && loadDetail(state.detail.id, true, true));
  listen('recording-refresh', 'click', loadRecording); listen('recording-form', 'submit', saveRecording); listen('recording-cancel', 'click', cancelRecording);
  $('recording-bodies').addEventListener('change', () => { $('body-consent-panel').hidden = !$('recording-bodies').checked || Boolean(state.recording?.bodies); });
  $('cli-tool').addEventListener('change', () => { clearCliPreview(); fillCliRoutes(); updateButtons(); });
  $('cli-route').addEventListener('change', clearCliPreview);
  listen('cli-form', 'submit', previewCli); listen('cli-apply', 'click', applyCli); listen('cli-restore', 'click', () => restoreCli(false));
  for (const name of Object.keys(state.drafts)) {
    resetDraft(name);
    for (const input of $(name + '-form').querySelectorAll('input,select,textarea')) {
      for (const type of ['input', 'change']) input.addEventListener(type, () => {
        draftChanged(name);
        updateButtons();
      });
    }
  }
  window.addEventListener('pagehide', () => { state.disposed=true;clearTimeout(state.reconnectTimer);state.reconnectTimer=null;const sessionId = state.session?.sessionId; clearSession(); if (sessionId) void sdk?.gateway?.disconnect({ sessionId }).catch(() => {}); });
  for(const prefix of ['setup','access']) {
    listen(prefix+'-key-copy','click',()=>copyClientKey(prefix));
    const input=$(prefix==='setup'?'setup-client-key':'access-key');
    input.addEventListener('input',()=>{const generated=state.generatedClientKey;if(!generated||generated.source!==prefix||generated.saved||generated.value!==input.value){clearGeneratedClientKey();input.type='password';}updateButtons();});
  }
  listen('generated-key-copy','click',()=>copyClientKey('saved'));
  $('generated-client-key-value').addEventListener('click',event=>event.target.select());
  updateButtons();
  if (!sdk?.gateway?.local || !sdk.ready) { $('unsupported').hidden = false; return; }
  sdk.ready.then(async ({ context, view }) => {
    document.documentElement.dataset.theme = context.theme;
    sdk.onContext(next=>{state.contextRevision++;document.documentElement.dataset.theme=next.theme;clearGeneratedClientKey();clearSecrets();clearProviderCatalog();clearDetail();});
    state.supported = true; updateButtons();
    if (view.slot === 'settingsTab') showTab('settings');
    else {document.documentElement.dataset.gatewayViewport='fill';document.body.dataset.lumiLayout='fill';}
    await refreshStatus();if(state.local?.configured)await connect();
  }).catch(error => { notice(safeError(error), 'error'); });
})();

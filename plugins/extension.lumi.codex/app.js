const sdk = window.lumiExtension;
const $ = id => document.getElementById(id);

const state = {
  slot: '', initialized: false, threads: [], thread: null, turnId: null, busy: false, switching: false,
  models: [], model: '', effort: '', efforts: [], cwd: '', items: [], approvals: [], error: '', search: '',
};
let initialization, unsubscribe, selection = 0, connected = false;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function messageOf(error) {
  return error instanceof Error ? error.message : '操作失败。';
}

async function rpc(method, params) {
  const response = await sdk.codex.bridge.send({method, params: params === undefined ? {} : params});
  if (response && response.error) throw new Error(response.error.message || 'Codex 请求失败。');
  return response ? response.result : undefined;
}

function notify(method, params) {
  return sdk.codex.bridge.send({method, params: params === undefined ? {} : params, notify: true});
}

async function ensureInitialized() {
  if (state.initialized) return;
  initialization ||= (async()=>{await rpc('initialize', {clientInfo: {name: 'lumi_codex_extension', title: 'Lumi Codex', version: '2.0.1'}});await notify('initialized', {});state.initialized = true;})();
  try { await initialization; } finally { initialization = undefined; }
}

function itemById(id) {
  return state.items.find(item => item.id === id);
}

function upsertItem(item) {
  if (!item || typeof item.id !== 'string') return;
  const existing = itemById(item.id);
  if (existing) Object.assign(existing, item);
  else state.items.push({...item});
}

function appendDelta(id, key, delta) {
  if (typeof id !== 'string' || typeof delta !== 'string') return;
  let item = itemById(id);
  if (!item) { item = {id, type: key === 'output' ? 'commandExecution' : 'agentMessage', status: 'inProgress'}; state.items.push(item); }
  item[key] = (item[key] || '') + delta;
}

/* ---------------- rendering ---------------- */

let frame = 0;
function scheduleRender() {
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; renderConversation(); renderStatus(); });
}

function renderStatus() {
  const status = $('status');
  if (!status) return;
  status.textContent = state.error || (state.busy ? 'Codex 正在处理…' : '');
  const interrupt = $('interrupt'), steer = $('steer'), send = $('send');
  if (interrupt) interrupt.disabled = !state.turnId;
  if (steer) steer.disabled = !state.turnId;
  if (send) send.disabled = !connected || state.busy || state.switching;
  for (const id of ['new-thread','rename-thread','archive-thread','delete-thread','model-select','effort-select','pick-cwd']) if ($(id)) $(id).disabled = !connected || state.busy || state.switching;
  for (const row of document.querySelectorAll('.thread-row')) row.disabled = state.busy || state.switching;
  const title = $('thread-title');
  if (title) title.textContent = state.thread ? (state.thread.name || state.thread.preview || '未命名会话') : '新会话';
  const meta = $('thread-meta');
  if (meta) meta.textContent = state.thread ? (state.thread.id + (state.thread.modelProvider ? ' · ' + state.thread.modelProvider : '')) : '';
  const cwdLine = $('cwd-line');
  if (cwdLine) cwdLine.textContent = state.cwd ? '工作目录：' + state.cwd : '未选择工作目录，使用 Codex 默认目录（可在上方选择）。';
}

function textBlock(className, text) {
  const pre = el('pre', className);
  pre.textContent = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
  return pre;
}

function renderItem(item) {
  const article = el('article', 'item ' + (item.type || 'unknown'));
  const role = {userMessage: 'user', agentMessage: 'assistant', reasoning: 'reasoning', plan: 'plan', commandExecution: 'command', fileChange: 'diff', mcpToolCall: 'tool', dynamicToolCall: 'tool', webSearch: 'search', enteredReviewMode: 'review', exitedReviewMode: 'review', contextCompaction: 'event', error: 'error'}[item.type] || 'event';
  article.classList.add('role-' + role);
  const head = el('div', 'item-head');
  head.append(el('span', 'role', role));
  if (item.status) head.append(el('span', 'badge', item.status));
  article.append(head);
  if (item.type === 'userMessage') {
    for (const part of item.content || []) if (part && part.type === 'text') article.append(el('p', 'text', part.text));
  } else if (item.type === 'agentMessage' || item.type === 'plan') {
    article.append(el('p', 'text', item.text || ''));
  } else if (item.type === 'reasoning') {
    const details = el('details');
    details.append(el('summary', '', '思考过程'));
    details.append(textBlock('', (item.summary || []).join('\n') || item.content || ''));
    article.append(details);
  } else if (item.type === 'commandExecution') {
    const line = el('div', 'command-line');
    line.append(el('code', '', item.command || ''));
    article.append(line);
    if (item.cwd) article.append(el('p', 'muted small', item.cwd));
    if (item.aggregatedOutput || item.output) article.append(textBlock('output', item.aggregatedOutput || item.output));
    if (item.exitCode !== undefined && item.exitCode !== null) article.append(el('p', 'muted small', '退出码 ' + item.exitCode));
  } else if (item.type === 'fileChange') {
    for (const change of item.changes || []) {
      article.append(el('p', 'muted small', (change.kind || 'update') + ' · ' + change.path));
      if (change.diff) article.append(textBlock('diff', change.diff));
    }
  } else if (item.type === 'mcpToolCall' || item.type === 'dynamicToolCall') {
    article.append(el('p', 'text', (item.server ? item.server + ' · ' : '') + (item.tool || item.name || '')));
    if (item.arguments) article.append(textBlock('', item.arguments));
    if (item.result || item.error) article.append(textBlock('', item.error || item.result));
  } else if (item.type === 'webSearch') {
    article.append(el('p', 'text', '搜索：' + (item.query || '')));
  } else if (item.type === 'exitedReviewMode' || item.type === 'enteredReviewMode') {
    article.append(el('p', 'text', item.review || ''));
  } else {
    article.append(textBlock('', item.text || item.message || item));
  }
  return article;
}

function renderConversation() {
  const container = $('conversation');
  if (!container) return;
  const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 40;
  container.textContent = '';
  for (const item of state.items) container.append(renderItem(item));
  if (state.error) container.append(el('p', 'error-text', state.error));
  if (atBottom) container.scrollTop = container.scrollHeight;
}

function renderThreads() {
  const list = $('thread-list');
  if (!list) return;
  list.textContent = '';
  const term = state.search.trim().toLowerCase();
  const rows = state.threads.filter(thread => !term || JSON.stringify([thread.name, thread.preview, thread.id]).toLowerCase().includes(term));
  if (!rows.length) list.append(el('li', 'muted small', '暂无会话'));
  for (const thread of rows) {
    const li = el('li', thread.id === (state.thread && state.thread.id) ? 'active' : '');
    const button = el('button', 'thread-row');
    button.append(el('strong', '', thread.name || thread.preview || '未命名会话'));
    button.append(el('span', 'muted small', new Date((thread.updatedAt || thread.createdAt || 0) * 1000).toLocaleString('zh-CN')));
    button.addEventListener('click', () => void openThread(thread.id));
    li.append(button);
    list.append(li);
  }
}

function renderModels() {
  const select = $('model-select');
  if (!select) return;
  select.textContent = '';
  select.append(new Option('默认模型', ''));
  for (const model of state.models) select.append(new Option(model.displayName || model.id, model.id));
  select.value = state.model;
  const effort = $('effort-select');
  effort.textContent = '';
  effort.append(new Option('默认强度', ''));
  for (const option of state.efforts) effort.append(new Option(option, option));
  effort.value = state.effort;
}

function renderApprovals() {
  const container = $('approvals');
  if (!container) return;
  container.textContent = '';
  for (const approval of state.approvals) {
    const card = el('div', 'approval');
    card.append(el('strong', '', approval.title));
    card.append(el('p', 'muted small', approval.detail || ''));
    if (approval.command) card.append(el('code', '', approval.command));
    if (approval.permissions) card.append(textBlock('',approval.permissions));
    const answers = {};
    if (approval.questions) for (const question of approval.questions) {
      const label=el('label','',question.question || question.header || question.id);
      const input=question.options?.length ? el('select') : question.isSecret ? el('input') : el('textarea');
      if (question.isSecret) { input.type='password';input.setAttribute('autocomplete','off'); }
      if (question.options?.length) for (const option of question.options) input.append(new Option(option.label,option.label));
      input.setAttribute('aria-label',question.question || question.id);
      label.append(input);card.append(label);answers[question.id]=input;
    }
    const row = el('div', 'approval-actions');
    for (const action of approval.actions) {
      const button = el('button', action.tone === 'danger' ? 'danger' : action.tone === 'primary' ? '' : 'ghost', action.label);
      button.disabled=!!approval.pending;
      button.addEventListener('click', () => {
        let result=action.result;
        if(action.input)result={answers:Object.fromEntries(Object.entries(answers).map(([id,input])=>[id,{answers:[input.value]}]))};
        if(action.mcp){const content={};for(const question of approval.questions){const value=answers[question.id].value;if(question.required && !value.trim()){state.error='请填写：'+question.question;scheduleRender();return;}if(!value.trim() && !question.required)continue;content[question.id]=question.valueType==='boolean' ? value==='true' : ['number','integer'].includes(question.valueType) ? Number(value) : value;if(typeof content[question.id]==='number' && (!Number.isFinite(content[question.id]) || question.valueType==='integer' && !Number.isInteger(content[question.id]))){state.error='请输入有效数字：'+question.question;scheduleRender();return;}}result={action:'accept',content};}
        void answerApproval(approval,{...action,result});
      });
      row.append(button);
    }
    card.append(row);
    container.append(card);
  }
}

/* ---------------- approvals ---------------- */

function describeApproval(message) {
  const params = message.params || {};
  const method = message.method;
  if (method === 'item/tool/requestUserInput' || method === 'tool/requestUserInput') return {title:'Codex 需要补充信息',detail:'填写答案后提交给当前任务。',questions:params.questions || [],actions:[{label:'提交答案',tone:'primary',input:true},{label:'取消',tone:'danger'}]};
  if (method === 'item/commandExecution/requestApproval') {
    return {
      title: params.networkApprovalContext ? '允许访问网络' : '允许执行命令',
      detail: params.reason || (params.networkApprovalContext ? (params.networkApprovalContext.host || '') : 'Codex 请求运行以下命令'),
      command: params.networkApprovalContext ? undefined : params.command,
      actions: [
        {label: '允许一次', tone: 'primary', result: 'accept'},
        {label: '本次会话都允许', result: 'acceptForSession'},
        {label: '拒绝', tone: 'danger', result: 'decline'},
        {label: '取消', tone: 'danger', result: 'cancel'},
      ],
    };
  }
  if (method === 'item/fileChange/requestApproval') {
    return {
      title: '允许修改文件',
      detail: params.reason || 'Codex 请求应用文件改动',
      actions: [
        {label: '允许一次', tone: 'primary', result: 'accept'},
        {label: '本次会话都允许', result: 'acceptForSession'},
        {label: '拒绝', tone: 'danger', result: 'decline'},
        {label: '取消', tone: 'danger', result: 'cancel'},
      ],
    };
  }
  if (method === 'item/permissions/requestApproval') {
    return {
      title: '授予权限',
      detail: params.reason || 'Codex 请求临时权限',
      permissions: params.permissions,
      actions: [
        {label: '本次允许', tone: 'primary', result: {permissions: params.permissions || {}, scope: 'turn'}},
        {label: '会话内允许', result: {permissions: params.permissions || {}, scope: 'session'}},
        {label: '拒绝', tone: 'danger', result: {permissions: {}}},
      ],
    };
  }
  if (method === 'mcpServer/elicitation/request') {
    const schema=params.requestedSchema,fields=Object.entries(schema?.properties || {});
    const supported=['form','openai/form','openaiForm'].includes(params.mode) && schema?.type==='object' && fields.every(([,field])=>['string','boolean','number','integer'].includes(field.type));
    return {
      title: 'MCP 请求确认',
      detail: params.message || params.serverName || '',
      questions:supported ? fields.map(([id,field])=>({id,question:field.title || field.description || id,required:schema.required?.includes(id),valueType:field.type,options:field.type==='boolean' ? [{label:'false'},{label:'true'}] : field.enum?.map(label=>({label})) || field.oneOf?.map(option=>({label:option.const}))})) : undefined,
      actions: [
        ...supported ? [{label:'提交并接受',tone:'primary',mcp:true}] : [],
        {label: '拒绝', tone: 'danger', result: {action: 'decline', content: null}},
        {label: '取消', tone: 'danger', result: {action: 'cancel', content: null}},
      ],
    };
  }
  return {
    title: 'Codex 请求确认',
    detail: method,
    actions: [{label: '拒绝不支持的请求', tone: 'danger', result: undefined}],
  };
}

async function answerApproval(approval, action) {
  if (approval.pending) return;
  approval.pending = true;
  renderApprovals();
  try {
    if (action.result === undefined) await sdk.codex.bridge.respond({id: approval.id, error: {code: -32603, message: 'Declined by user'}});
    else await sdk.codex.bridge.respond({id: approval.id, result: typeof action.result==='string' ? {decision:action.result} : action.result});
    state.approvals = state.approvals.filter(entry => entry !== approval);
  } catch (error) {
    approval.pending = false;
    state.error = messageOf(error);
    scheduleRender();
  }
  renderApprovals();
}

/* ---------------- events ---------------- */

function handleEvent(message) {
  if (!message || typeof message !== 'object') return;
  const method = message.method;
  const params = message.params || {};
  if (method === 'lumi/bridge/exited') {connected=false;state.initialized=false;initialization=undefined;++selection;state.busy=false;state.switching=false;state.turnId=null;state.approvals=[];state.error=params.detail || '连接已关闭，请重新连接。';renderApprovals();scheduleRender();return;}
  if (params.threadId && params.threadId !== state.thread?.id) return;
  if (method === undefined) {
    if (message.error) { state.error = message.error.message || 'Codex 返回错误。'; scheduleRender(); }
    return;
  }
  if (message.id !== undefined) {
    state.approvals.push({id: message.id, ...describeApproval(message)});
    renderApprovals();
    return;
  }
  switch (method) {
    case 'thread/started': break;
    case 'turn/started':
      state.turnId = params.turn && params.turn.id; state.busy = true; state.error = ''; scheduleRender(); break;
    case 'turn/completed':
      state.turnId = null; state.busy = false;
      if (params.turn && params.turn.error) state.error = params.turn.error.message || '本轮失败。';
      scheduleRender(); break;
    case 'item/started':
      upsertItem(params.item); scheduleRender(); break;
    case 'item/completed':
      upsertItem(params.item); scheduleRender(); break;
    case 'item/agentMessage/delta': appendDelta(params.itemId, 'text', params.delta); scheduleRender(); break;
    case 'item/plan/delta': appendDelta(params.itemId, 'text', params.delta); scheduleRender(); break;
    case 'item/commandExecution/outputDelta': appendDelta(params.itemId, 'output', params.delta); scheduleRender(); break;
    case 'item/reasoning/summaryTextDelta': {
      const item = itemById(params.itemId) || {id: params.itemId, type: 'reasoning', summary: []};
      if (!itemById(params.itemId)) state.items.push(item);
      item.summary = item.summary || [];
      item.summary[params.summaryIndex || 0] = (item.summary[params.summaryIndex || 0] || '') + params.delta;
      scheduleRender(); break;
    }
    case 'item/reasoning/textDelta': appendDelta(params.itemId, 'content', params.delta); scheduleRender(); break;
    case 'turn/plan/updated': {
      const item = itemById('turn:' + params.turnId) || {id: 'turn:' + params.turnId, type: 'plan'};
      if (!itemById(item.id)) state.items.push(item);
      item.text = (params.explanation ? params.explanation + '\n' : '') + (params.plan || []).map(step => '[' + step.status + '] ' + step.step).join('\n');
      scheduleRender(); break;
    }
    case 'turn/diff/updated': {
      const item = itemById('diff:' + params.turnId) || {id: 'diff:' + params.turnId, type: 'fileChange', changes: []};
      if (!itemById(item.id)) state.items.push(item);
      item.changes = [{kind: 'turn', path: '本轮改动', diff: params.diff || ''}];
      scheduleRender(); break;
    }
    case 'warning':
      state.error = params.message || 'Codex 警告。'; scheduleRender(); break;
    case 'error':
      state.error = (params.error && params.error.message) || params.message || 'Codex 错误。'; scheduleRender(); break;
    case 'serverRequest/resolved':
      state.approvals = state.approvals.filter(entry => entry.id !== params.requestId); renderApprovals(); break;
    default: break;
  }
}

/* ---------------- operations ---------------- */

async function loadModels() {
  try {
    const result = await rpc('model/list', {limit: 50, includeHidden: false});
    state.models = (result && result.data) || [];
    renderModels();
  } catch { /* Model list is optional. */ }
}

async function loadThreads() {
  const result = await rpc('thread/list', {limit: 50, sortKey: 'updated_at'});
  state.threads = (result && result.data) || [];
  renderThreads();
}

function flattenTurns(thread) {
  const items = [];
  for (const turn of (thread && thread.turns) || []) for (const item of turn.items || []) items.push(item);
  return items;
}

async function openThread(threadId) {
  if (state.busy || state.switching || !connected) return;
  const version=++selection;state.switching=true;renderStatus();
  state.error = '';
  try {
    const read = await rpc('thread/read', {threadId, includeTurns: true});
    const thread = read && read.thread;
    const resumed = await rpc('thread/resume', {threadId});
    if (version!==selection) return;
    state.thread = {...(resumed && resumed.thread), ...thread};
    state.items = flattenTurns(thread);
    const active=(resumed?.thread?.turns || []).find(turn=>turn.status==='inProgress');
    state.turnId = active?.id || null; state.busy = !!active;state.approvals=[];renderApprovals();
    if (state.thread && state.thread.cwd) state.cwd = state.thread.cwd;
    renderThreads(); scheduleRender();
  } catch (error) {
    if(version===selection){state.error = messageOf(error); scheduleRender();}
  }
  finally {if(version===selection){state.switching=false;scheduleRender();}}
}

async function newThread() {
  if (state.busy || state.switching || !connected) return;
  const version=++selection;state.switching=true;renderStatus();
  state.error = '';
  try {
    const params = {};
    if (state.cwd) params.cwd = state.cwd;
    if (state.model) params.model = state.model;
    const result = await rpc('thread/start', params);
    if(version!==selection)return;
    state.thread = result && result.thread;
    state.items = []; state.turnId = null; state.busy = false; state.approvals = [];
    renderApprovals(); renderThreads(); scheduleRender();
    if (state.thread) void loadThreads();
  } catch (error) {
    if(version===selection){state.error = messageOf(error); scheduleRender();}
  }
  finally {if(version===selection){state.switching=false;scheduleRender();}}
}

async function startTurn(text) {
  if (!connected || state.busy || state.switching) return;
  if (!state.thread) await newThread();
  if (!state.thread) return;
  const params = {threadId: state.thread.id, input: [{type: 'text', text}]};
  if (state.model) params.model = state.model;
  if (state.effort) params.effort = state.effort;
  if (state.cwd) params.cwd = state.cwd;
  state.busy = true; state.error = ''; scheduleRender();
  try {
    const result = await rpc('turn/start', params);
    if (state.busy) state.turnId = result && result.turn && result.turn.id;
  } catch (error) {
    state.busy = false; state.error = messageOf(error);
  }
  scheduleRender();
}

async function steerTurn(text) {
  if (!state.turnId || !state.thread) return;
  try { await rpc('turn/steer', {threadId: state.thread.id, expectedTurnId: state.turnId, input: [{type: 'text', text}]}); }
  catch (error) { state.error = messageOf(error); scheduleRender(); }
}

async function interruptTurn() {
  if (!state.turnId || !state.thread) return;
  try { await rpc('turn/interrupt', {threadId: state.thread.id, turnId: state.turnId}); }
  catch (error) { state.error = messageOf(error); scheduleRender(); }
}

async function renameThread() {
  if (!state.thread) return;
  const name = $('rename-input').value;
  if (!name.trim()) return;
  try { await rpc('thread/name/set', {threadId: state.thread.id, name: name.trim()}); state.thread.name = name.trim(); renderThreads(); scheduleRender(); }
  catch (error) { state.error = messageOf(error); scheduleRender(); }
}

async function archiveThread() {
  if (!state.thread) return;
  try { await rpc('thread/archive', {threadId: state.thread.id}); state.thread = null; state.items = []; void loadThreads(); scheduleRender(); }
  catch (error) { state.error = messageOf(error); scheduleRender(); }
}

async function deleteThread() {
  if (!state.thread) return;
  try { await rpc('thread/delete', {threadId: state.thread.id}); state.thread = null; state.items = []; void loadThreads(); scheduleRender(); }
  catch (error) { state.error = messageOf(error); scheduleRender(); }
}

async function pickDirectory() {
  try {
    const result = await sdk.codex.bridge.chooseDirectory();
    if (result && result.path) { state.cwd = result.path; renderStatus(); }
  } catch (error) { state.error = messageOf(error); scheduleRender(); }
}

/* ---------------- wiring ---------------- */

function wireChat() {
  $('new-thread').addEventListener('click', () => void newThread());
  $('refresh-threads').addEventListener('click', () => void loadThreads().catch(error => { state.error = messageOf(error); scheduleRender(); }));
  $('thread-search').addEventListener('input', event => { state.search = event.target.value; renderThreads(); });
  $('model-select').addEventListener('change', event => { state.model = event.target.value;state.effort='';state.efforts=(state.models.find(model=>model.id===state.model)?.supportedReasoningEfforts || []).map(option=>option.reasoningEffort);renderModels(); });
  $('effort-select').addEventListener('change', event => { state.effort = event.target.value; });
  $('pick-cwd').addEventListener('click', () => void pickDirectory());
  $('rename-thread').addEventListener('click', () => {$('rename-form').hidden=false;$('rename-input').value=state.thread?.name || '';$('rename-input').focus();});
  const saveRename=()=>{if(!$('rename-input').value.trim())return;$('rename-form').hidden=true;void renameThread();};
  $('save-rename').addEventListener('click',saveRename);
  $('rename-input').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();saveRename();}});
  $('cancel-rename').addEventListener('click',()=>{$('rename-form').hidden=true;});
  $('archive-thread').addEventListener('click', () => void archiveThread());
  $('delete-thread').addEventListener('click', () => {$('delete-confirm').hidden=false;});
  $('confirm-delete').addEventListener('click',()=>{$('delete-confirm').hidden=true;void deleteThread();});
  $('cancel-delete').addEventListener('click',()=>{$('delete-confirm').hidden=true;});
  $('reconnect').addEventListener('click',()=>void connectChat());
  $('interrupt').addEventListener('click', () => void interruptTurn());
  $('steer').addEventListener('click', () => { const prompt = $('prompt'); const text = prompt.value.trim(); if (text) { prompt.value = ''; void steerTurn(text); } });
  const sendPrompt=()=>{if(!connected || state.busy || state.switching)return;const prompt=$('prompt'),text=prompt.value.trim();if(!text)return;prompt.value='';void startTurn(text);};
  $('send').addEventListener('click',sendPrompt);
  $('prompt').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault();sendPrompt(); } });
}

async function startChat() {
  wireChat();
  window.addEventListener('pagehide', () => {unsubscribe?.();unsubscribe=undefined;});
  await connectChat();
}

async function connectChat() {
  if (state.switching || state.busy) return;
  unsubscribe?.();const version=++selection;unsubscribe=sdk.codex.bridge.subscribe(handleEvent);state.initialized=false;state.thread=null;state.items=[];state.approvals=[];state.turnId=null;connected=false;state.error='正在连接…';renderApprovals();scheduleRender();
  renderStatus();
  try {
    await ensureInitialized();
    if(version!==selection)return;
    connected=true;state.error='';
    await Promise.all([loadModels().catch(() => {}), loadThreads()]);
    scheduleRender();
  } catch (error) {
    state.error = /无效|unsupported|codex\.bridge/i.test(messageOf(error)) ? '需要更新 Lumi：当前版本缺少 Codex 桥接能力。' : messageOf(error);
    scheduleRender();
  }
}

async function startConnection() {
  const status = $('conn-status');
  const refresh = async () => {
    status.textContent = '正在检测…';
    try {
      const result = await sdk.codex.bridge.status();
      status.textContent = result.installed ? '已发现 Codex CLI，桥接状态：' + result.state + (result.detail ? ' · ' + result.detail : '') : '未发现 Codex CLI，请先安装并在终端运行 codex login。';
    } catch (error) {
      status.textContent = '无法使用 Codex 桥接，请确认已启用内置“Codex 桥接”，并更新 Lumi。(' + messageOf(error) + ')';
    }
  };
  $('conn-refresh').addEventListener('click', () => void refresh());
  await refresh();
}

async function start() {
  const {context, view} = await sdk.ready;
  state.slot = view.slot;
  document.documentElement.dataset.theme = context.theme;
  sdk.onContext(next => { document.documentElement.dataset.theme = next.theme; });
  $('view-chat').hidden = view.slot !== 'sidebar';
  $('view-connection').hidden = view.slot !== 'connection';
  $('view-settings').hidden = view.slot !== 'settingsTab';
  if (view.slot === 'sidebar') await startChat();
  else if (view.slot === 'connection') await startConnection();
}

start().catch(error => {
  document.body.textContent = messageOf(error);
});

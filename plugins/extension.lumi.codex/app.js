const {node: el, renderItem, renderTurnFooter, formatDuration, sourceKind, sourceLabel, projectKey, projectName} = window.lumiCodexDisplay;
const sdk = window.lumiExtension;
const $ = id => document.getElementById(id);

const state = {
  slot: '', initialized: false, threads: [], thread: null, turnId: null, busy: false, switching: false,
  models: [], model: '', effort: '', efforts: [], cwd: '', items: [], approvals: [], error: '', search: '',
  sourceFilter: '', threadCursor: null, threadLoading: false, threadError: '', threadsVersion: 0, knownProjects: new Set(),
  history: null, turns: new Map(), itemIndex: new Map(), windowStart: 0, windowEnd: 0, resumed: false,
  externalWriter: false,
  writerTurnMarker: null,
  userIndex: new Map(), indexHistory: null, detached: false,
};
let initialization, unsubscribe, selection = 0, connectionEpoch = 0, connected = false;
let syncTimer, syncPending = false, syncEpoch = 0;
let threadStatusTimer, statusClock, threadStatusPending = false, threadSummaryLoading = 0, chatDisposed = false;
const threadStatuses = new Map();
const threadStatusVersions = new Map(), threadSummaries = new Map();
const threadBadges = new Map();
let expandedThreadRows = [];
function observedThreadStatus(threadId,status) {
  if (state.thread?.id === threadId && (state.busy || state.externalWriter) && status?.type === 'notLoaded') {
    const known = threadStatuses.get(threadId);
    return known?.type === 'active' ? known : {type:'active',activeFlags:[]};
  }
  return status;
}
function updateThreadStatus(threadId, status) {
  if (!threadId || !status) return;
  threadStatusVersions.set(threadId, (threadStatusVersions.get(threadId) || 0) + 1);
  status = observedThreadStatus(threadId,status);
  threadStatuses.set(threadId, status);
  const row = state.threads.find(thread => thread.id === threadId);if (row) row.status = status;
  if (state.thread?.id === threadId) state.thread.status = status;
  renderThreadBadge(threadId);
}
function threadState(thread) {
  const status = threadStatuses.get(thread.id) || thread.status;
  if (status?.type === 'active') {
    if (status.activeFlags?.includes('waitingOnApproval')) return ['waiting','待确认'];
    if (status.activeFlags?.includes('waitingOnUserInput')) return ['waiting','待输入'];
    return ['active','工作中'];
  }
  if (status?.type === 'systemError') return ['error','异常'];
  if (status?.type === 'idle') return ['idle','空闲'];
  const summary = threadSummaries.get(thread.id);
  if (summary?.loading) return ['unknown','读取中'];
  return {inProgress:['active','工作中'],completed:['idle','已完成'],interrupted:['unknown','已中断'],failed:['error','异常']}[summary?.status] || ['unknown','状态未知'];
}

function renderThreadBadge(threadId) {
  const badge = threadBadges.get(threadId);if (!badge) return;
  const thread = {id:threadId,status:threadStatuses.get(threadId)};
  const [kind,label] = threadState(thread);
  const title = threadSummaries.get(threadId)?.status && (!thread.status || thread.status.type === 'notLoaded') ? '最近一轮的保存状态；每秒检查更新' : 'Codex 返回的会话状态；每秒检查更新';
  if (badge.textContent !== label) badge.textContent = label;
  if (badge.dataset.state !== kind) badge.dataset.state = kind;
  if (badge.title !== title) badge.title = title;
}

async function loadThreadSummaries(threads, version, connection) {
  ++threadSummaryLoading;
  const current = () => version === state.threadsVersion && connection === connectionEpoch;
  const pending = threads.filter(thread => !thread.status || thread.status.type === 'notLoaded');
  const revisions = new Map(pending.map(thread => [thread.id,threadStatusVersions.get(thread.id) || 0]));
  for (const thread of pending) threadSummaries.set(thread.id, {loading:true});
  renderThreads();
  let index = 0;
  const worker = async () => {
    while (current() && index < pending.length) {
      const thread = pending[index++], unchanged = () => current() && revisions.get(thread.id) === (threadStatusVersions.get(thread.id) || 0);
      try {
        const read = await rpc('thread/read',{threadId:thread.id,includeTurns:false});
        if (!unchanged()) continue;
        const status = read?.thread?.status;
        if (status && status.type !== 'notLoaded') {threadSummaries.delete(thread.id);updateThreadStatus(thread.id,status);continue;}
        const result = await rpc('thread/turns/list',{threadId:thread.id,limit:1,sortDirection:'desc',itemsView:'notLoaded'});
        if (!unchanged()) continue;
        const turn = result?.data?.[0];
        threadSummaries.set(thread.id,{status:turn?.status});
      } catch {
        if (unchanged()) threadSummaries.set(thread.id,{});
      } finally {
        if (current()) {const summary = threadSummaries.get(thread.id);if (summary?.loading) threadSummaries.delete(thread.id);renderThreadBadge(thread.id);}
      }
    }
  };
  try {await Promise.all(Array.from({length:Math.min(4,pending.length)}, worker));}
  finally {--threadSummaryLoading;}
}

function scheduleThreadStatusRefresh(delay = 1000) {
  clearTimeout(threadStatusTimer);
  if (!chatDisposed && connected && !document.hidden) threadStatusTimer = setTimeout(() => void refreshThreadStatuses(),delay);
}
async function refreshThreadStatuses() {
  if (threadStatusPending) return;
  if (chatDisposed || !connected || document.hidden) return;
  const started = performance.now(), connection = connectionEpoch, version = state.threadsVersion;
  const current = () => !chatDisposed && connected && !document.hidden && connection === connectionEpoch && version === state.threadsVersion;
  threadStatusPending = true;
  try {
    const panel = $('threads-panel'), list = $('thread-list');
    if (panel.inert || state.threadLoading || threadSummaryLoading) return;
    const bounds = list.getBoundingClientRect(), visible = new Set();
    // Rows are vertically ordered; locate the visible slice without measuring
    // every loaded historical row on each tick. Collapsed groups are excluded.
    let low = 0, high = expandedThreadRows.length;
    while (low < high) {const middle = (low + high) >>> 1;if (expandedThreadRows[middle].getBoundingClientRect().bottom <= bounds.top) low = middle + 1;else high = middle;}
    for (let index = low;index < expandedThreadRows.length;index++) {
      const row = expandedThreadRows[index];
      const rect = row.getBoundingClientRect();
      if (rect.top >= bounds.bottom) break;
      if (rect.width && rect.height && rect.bottom > bounds.top && rect.top < bounds.bottom) visible.add(row.dataset.thread);
    }
    if (!visible.size) return;
    const revisions = new Map(threadStatusVersions);
    const unchanged = id => current() && (revisions.get(id) || 0) === (threadStatusVersions.get(id) || 0);
    // A single bounded metadata page supplies runtime status for the usual case.
    // Only visible unloaded/older rows need individual lightweight fallback reads.
    const result = await rpc('thread/list',{limit:100,sortKey:'updated_at'});
    if (!current()) return;
    const listed = new Map((result?.data || []).map(thread => [thread.id,thread]));
    let selectedChanged = false;
    const apply = (id,status) => {
      if (!status || !unchanged(id)) return;
      status = observedThreadStatus(id,status);
      if (JSON.stringify(threadStatuses.get(id)) === JSON.stringify(status)) return;
      updateThreadStatus(id,status);
      revisions.set(id,threadStatusVersions.get(id));
      if (state.thread?.id === id && status.type !== 'notLoaded') {
        state.busy = status.type === 'active';
        if (!state.busy) {state.turnId = null;state.externalWriter = false;}
        selectedChanged = true;
      }
    };
    for (const thread of state.threads) {
      const snapshot = listed.get(thread.id);
      if (snapshot?.status) apply(thread.id,snapshot.status);
    }
    const pending = [...visible].filter(id => {
      const snapshot = listed.get(id);
      return unchanged(id) && !threadSummaries.get(id)?.loading && (!snapshot || !snapshot.status || snapshot.status.type === 'notLoaded');
    });
    let index = 0;
    const worker = async () => {
      while (current() && index < pending.length) {
        const id = pending[index++];
        if (!unchanged(id)) continue;
        try {
          if (!listed.has(id)) {
            const read = await rpc('thread/read',{threadId:id,includeTurns:false});
            if (!unchanged(id)) continue;
            apply(id,read?.thread?.status);
            if (read?.thread?.status && read.thread.status.type !== 'notLoaded') continue;
          }
          const recent = await rpc('thread/turns/list',{threadId:id,limit:1,sortDirection:'desc',itemsView:'notLoaded'});
          if (!unchanged(id)) continue;
          const status = recent?.data?.[0]?.status;
          if (threadSummaries.get(id)?.status !== status) {threadSummaries.set(id,{status});renderThreadBadge(id);}
        } catch { /* Preserve the last observation; the next tick can recover. */ }
      }
    };
    await Promise.all(Array.from({length:Math.min(4,pending.length)},worker));
    if (selectedChanged && current()) {renderStatus();scheduleRender();}
  } catch { /* Stream events stay active while a metadata refresh fails. */ }
  finally {
    threadStatusPending = false;
    scheduleThreadStatusRefresh(Math.max(0,1000 - (performance.now() - started)));
  }
}

function messageOf(error) {
  return error instanceof Error ? error.message : '操作失败。';
}

async function rpc(method, params) {
  const response = await sdk.codex.bridge.send({method, params: params === undefined ? {} : params});
  if (response && response.error) {const error = new Error(response.error.message || 'Codex 请求失败。');error.code = response.error.code;throw error;}
  return response ? response.result : undefined;
}

function notify(method, params) {
  return sdk.codex.bridge.send({method, params: params === undefined ? {} : params, notify: true});
}

async function ensureInitialized() {
  if (state.initialized) return;
  initialization ||= (async()=>{await rpc('initialize', {clientInfo: {name: 'lumi_codex_extension', title: 'Lumi Codex', version: '2.2.10'}, capabilities: {experimentalApi: true}});await notify('initialized', {});state.initialized = true;})();
  try { await initialization; } finally { initialization = undefined; }
}

const WINDOW_SIZE = 160, PAGE_SIZE = 40;
let scrollAnchor, threadSearchTimer, lastScrollTop = 0;
function itemById(id) { return state.itemIndex.get(id); }
function resetConversation() {
  state.userIndex.clear();state.indexHistory = null;state.detached = false;
  hideTurnPreview();railSignature = '';$('turn-rail').replaceChildren();
  state.externalWriter = false;state.writerTurnMarker = null;state.busy = false;state.turnId = null;
  state.items = [];state.itemIndex.clear();state.turns.clear();state.history = null;
  state.windowStart = 0;state.windowEnd = 0;state.resumed = false;scrollAnchor = null;
}
function upsertItem(item, turnId = state.turnId) {
  if (!item || typeof item.id !== 'string') return;
  if (item.type === 'userMessage') state.userIndex.set(item.id,{...item,_turnId:turnId});
  const existing = itemById(item.id);
  if (existing) {Object.assign(existing, item);if (Object.hasOwn(item,'aggregatedOutput')) existing.output = undefined;existing._revision++;if (turnId) existing._turnId = turnId;}
  else {
    const followsLatest = !state.detached && state.windowEnd === state.items.length;
    const value = {...item, _turnId: turnId, _revision: 1};state.items.push(value);state.itemIndex.set(value.id, value);
    if (followsLatest) {state.windowEnd = state.items.length;state.windowStart = Math.max(0, state.windowEnd - WINDOW_SIZE);}
  }
}
function appendDelta(id, key, delta, type = 'agentMessage') {
  if (typeof id !== 'string' || typeof delta !== 'string') return;
  if (!itemById(id)) upsertItem({id, type: key === 'output' ? 'commandExecution' : type, status: 'inProgress'});
  const item = itemById(id);item[key] = (item[key] || (key === 'output' ? item.aggregatedOutput : '') || '') + delta;item._revision++;
}
function mergeTurns(turns) {
  for (const turn of turns || []) if (typeof turn.id === 'string') {
    const old = state.turns.get(turn.id) || {};
    state.turns.set(turn.id, {...old, ...turn, items: undefined});
  }
  const latest = state.items.at(-1)?._turnId, turn = state.turns.get(latest);
  if (turn?.status === 'inProgress' && state.thread) {
    state.busy = true;state.turnId = turn.id;
    const status = threadStatuses.get(state.thread.id) || state.thread.status;
    if (status?.type !== 'active') updateThreadStatus(state.thread.id,{type:'active',activeFlags:[]});
  }
}
function mergeHistory(entries) {
  const older = [];
  for (const entry of entries) {
    const item = entry.item;if (!item || typeof item.id !== 'string' || state.itemIndex.has(item.id)) continue;
    if (item.type === 'userMessage') state.userIndex.set(item.id,{...item,_turnId:entry.turnId});
    const value = {...item, _turnId: entry.turnId, _revision: 1};state.itemIndex.set(value.id, value);older.push(value);
  }
  state.items.unshift(...older);
  state.windowStart += older.length;state.windowEnd += older.length;
  return older.length;
}
function captureAnchor() {
  const stream = $('conversation'), top = stream.getBoundingClientRect().top;
  const visible = [...$('messages').children].find(element => element.getBoundingClientRect().bottom > top + 10);
  return visible && {key: visible.dataset.key, top: visible.getBoundingClientRect().top};
}
function unsupported(error) { return error.code === -32601 || /unsupported|not supported|unknown method|method not found|experimentalApi|pagination.*support|item pagination/i.test(error.message); }

/* ---------------- rendering ---------------- */

let frame = 0;
function scheduleRender() {
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; renderConversation(); renderStatus(); renderContext(); });
}

function renderStatus() {
  const status = $('status');
  if (!status) return;
  const active = state.turns.get(state.turnId);
  const elapsed = Number.isFinite(active?.localStarted) ? formatDuration(performance.now() - active.localStarted) : '';
  status.textContent = state.error || (state.switching ? '正在打开会话…' : state.externalWriter ? '此会话正在其他 Codex 窗口工作，正在同步内容；完成后可继续发送。' : state.busy ? 'Codex 工作中' + (elapsed ? ' · 已用 ' + elapsed : '…') : '');
  status.title = state.externalWriter ? 'thread ' + state.thread?.id + ' already has an active writer' : status.textContent;
  const interrupt = $('interrupt'), steer = $('steer'), send = $('send');
  if (interrupt) interrupt.disabled = !state.turnId || state.externalWriter;
  if (steer) steer.disabled = !state.turnId || state.externalWriter;
  if (send) send.disabled = !connected || state.busy || state.switching;
  for (const id of ['new-thread','model-select','effort-select','pick-cwd']) if ($(id)) $(id).disabled = !connected || state.busy && !(state.externalWriter && id === 'new-thread') || state.switching;
  const unavailable = !connected || state.switching || !state.thread;
  $('rename-thread').disabled = unavailable;
  for (const id of ['archive-thread','delete-thread']) $(id).disabled = unavailable || state.busy;
  const actionNote = $('thread-actions-note'), note = !connected ? '请先连接 Codex。' : state.switching ? '正在打开会话…' : !state.thread ? '请先打开会话。' : state.busy ? '会话工作中，结束后可归档或删除。' : '';
  if (actionNote.textContent !== note) actionNote.textContent = note;actionNote.hidden = !note;
  for (const row of document.querySelectorAll('.thread-row')) row.disabled = state.busy && !state.externalWriter || state.switching;
  const title = $('thread-title');
  if (title) title.textContent = state.thread ? (state.thread.name || state.thread.preview || '未命名会话') : '新会话';
  const meta = $('thread-meta');
  if (meta) meta.textContent = state.thread ? (state.thread.id + (state.thread.modelProvider ? ' · ' + state.thread.modelProvider : '')) : '';
  const cwdLine = $('cwd-line');
  if (cwdLine) {cwdLine.textContent = state.cwd ? projectName(state.cwd) : '默认工作目录';cwdLine.title = state.cwd || '使用 Codex 默认工作目录';}
  $('jump-latest').hidden = state.windowEnd === state.items.length && $('conversation').scrollHeight - $('conversation').scrollTop - $('conversation').clientHeight < 80;
}

function textBlock(className, text) {
  const pre = el('pre', className);
  pre.textContent = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
  return pre;
}

const renderedItems = new Map(), collapsedProjects = new Set();
function renderConversation() {
  const stream = $('conversation'), container = $('messages');if (!stream || !container) return;
  const followsLatest = state.windowEnd === state.items.length;
  const atBottom = followsLatest && stream.scrollTop + stream.clientHeight >= stream.scrollHeight - 70;
  const rows = state.items.slice(state.windowStart, state.windowEnd), records = [];
  for (let index = 0; index < rows.length; index++) {
    const item = rows[index];records.push({key:'item:' + item.id, signature:item._revision, render:() => renderItem(item)});
    const storedTurn = state.turns.get(item._turnId), latestTurnId = state.items.at(-1)?._turnId;
    const working = storedTurn && state.busy && (storedTurn.id === state.turnId || (state.externalWriter || state.thread?.status?.type === 'active') && storedTurn.id === latestTurnId);
    const turn = working ? {...storedTurn,status:'inProgress',durationMs:undefined,completedAt:undefined} : storedTurn;
    if (turn && state.items[state.windowStart + index + 1]?._turnId !== item._turnId) records.push({key:'turn:' + turn.id, signature:JSON.stringify(turn), render:() => renderTurnFooter(turn)});
  }
  const keep = new Set();let cursor = container.firstChild;
  for (const record of records) {
    let cached = renderedItems.get(record.key);
    if (!cached || cached.signature !== record.signature) {
      const openDetails = cached ? [...cached.node.querySelectorAll('details')].filter(element => element.open).map(element => element.querySelector('summary')?.textContent) : [];
      const element = record.render();element.dataset.key = record.key;
      for (const details of element.querySelectorAll('details')) if (openDetails.includes(details.querySelector('summary')?.textContent)) details.open = true;
      if (cached?.node === cursor) cursor = cursor.nextSibling;
      cached?.node.remove();cached = {signature:record.signature,node:element};renderedItems.set(record.key, cached);
    }
    keep.add(record.key);if (cached.node !== cursor) container.insertBefore(cached.node, cursor);cursor = cached.node.nextSibling;
  }
  for (const [key, cached] of renderedItems) if (!keep.has(key)) {cached.node.remove();renderedItems.delete(key);}
  $('empty-conversation').hidden = !!state.items.length;
  const history = state.history, older = $('load-older');
  older.hidden = !state.windowStart && !history?.cursor && !history?.error;
  older.disabled = !!history?.loading;
  older.textContent = history?.loading ? '正在载入更早消息…' : history?.error ? '载入失败，点击重试' : '载入更早消息';
  $('history-note').textContent = history?.warning || history?.error || '';
  $('load-newer').hidden = state.windowEnd >= state.items.length && !state.history?.targetNext;
  if (scrollAnchor) {
    const anchor = [...container.children].find(element => element.dataset.key === scrollAnchor.key);
    if (anchor) stream.scrollTop += anchor.getBoundingClientRect().top - scrollAnchor.top;
    scrollAnchor = null;
  } else if (atBottom) stream.scrollTop = stream.scrollHeight;
  renderTurnRail();
}

// The complete user-only index fits in half of the reading area, independently of body pagination.
let railSignature = '', railFrame = 0, railObserver, previewMarker;
const expandedMarkers = new Set();
function resetTurnExpansion() {
  for (const marker of expandedMarkers) {marker.style.removeProperty('--turn-scale');marker.classList.remove('emphasized');}
  expandedMarkers.clear();
}
function expandTurnMarker(marker) {
  resetTurnExpansion();
  marker.style.setProperty('--turn-scale', '4');marker.classList.add('emphasized');expandedMarkers.add(marker);
  let previous = marker.previousElementSibling, next = marker.nextElementSibling;
  for (let distance = 1; distance <= 3; distance++) {
    for (const neighbor of [previous, next]) if (neighbor) {neighbor.style.setProperty('--turn-scale', String(4 - distance * .75));expandedMarkers.add(neighbor);}
    previous = previous?.previousElementSibling;next = next?.nextElementSibling;
  }
}
function layoutTurnRail() {
  const rail = $('turn-rail'), navigation = rail.parentElement, count = rail.childElementCount;
  // Old 18px pitch minus a 2px stroke left 16px of space; retain one third of that space.
  // Round down to Chromium's layout unit so many fractional rows cannot overflow the half-height budget.
  const pitch = Math.floor(Math.min(2 + 16 / 3, rail.getBoundingClientRect().height / Math.max(1, count)) * 64) / 64;
  navigation.style.setProperty('--turn-pitch', Math.max(0, pitch) + 'px');
  navigation.style.setProperty('--turn-line', Math.min(2, pitch * .4) + 'px');
}
function userExcerpt(item) {
  return (item.content || []).map(part => part.type === 'text' ? part.text : /image/i.test(part.type) ? '[图片]' : '[附件]').join(' ').replace(/\s+/g, ' ').trim().slice(0, 600) || '用户消息';
}
function hideTurnPreview() {
  previewMarker?.removeAttribute('aria-describedby');
  previewMarker = null;
  resetTurnExpansion();
  $('turn-preview')?.classList.remove('visible');
}
function showTurnPreview(marker) {
  const item = state.userIndex.get(marker.dataset.item) || itemById(marker.dataset.item);if (!item) return;
  if (previewMarker !== marker) previewMarker?.removeAttribute('aria-describedby');
  previewMarker = marker;
  expandTurnMarker(marker);
  const preview = $('turn-preview'), stage = $('stream-stage');
  $('turn-preview-text').textContent = userExcerpt(item);
  preview.classList.add('visible');marker.setAttribute('aria-describedby', 'turn-preview');
  const anchor = marker.getBoundingClientRect(), bounds = stage.getBoundingClientRect();
  preview.style.left = Math.max(6,Math.min(anchor.right - bounds.left + 3,stage.clientWidth - preview.offsetWidth - 6)) + 'px';
  preview.style.top = Math.max(6, Math.min(anchor.top - bounds.top + anchor.height / 2 - preview.offsetHeight / 2, stage.clientHeight - preview.offsetHeight - 6)) + 'px';
}
async function jumpToUser(id) {
  let index = state.items.findIndex(item => item.id === id);
  if (index < 0) {
    const user = state.userIndex.get(id), version = selection;if (!user?._turnId) return;
    try {
      const result = await rpc('thread/items/list',{threadId:state.thread.id,turnId:user._turnId,sortDirection:'asc',limit:WINDOW_SIZE});
      if (version !== selection) return;
      const entries = result?.data || [];if (!entries.some(entry => entry.item?.id === id)) throw new Error('该用户消息暂不可定位。');
      state.items = [];state.itemIndex.clear();state.windowStart = 0;state.windowEnd = 0;mergeHistory(entries);
      state.windowStart = 0;state.windowEnd = state.items.length;state.detached = true;
      state.history.cursor = result.backwardsCursor || null;state.history.targetTurn = user._turnId;state.history.targetNext = result.nextCursor || null;
      index = state.items.findIndex(item => item.id === id);
    } catch (error) {state.error = messageOf(error);renderStatus();return;}
  }
  hideTurnPreview();
  if (index < state.windowStart || index >= state.windowEnd) {
    state.windowStart = Math.max(0, index - 20);state.windowEnd = Math.min(state.items.length, state.windowStart + WINDOW_SIZE);
  }
  scrollAnchor = null;renderConversation();
  const node = renderedItems.get('item:' + id)?.node, stream = $('conversation');
  if (node) stream.scrollTop += node.getBoundingClientRect().top - stream.getBoundingClientRect().top - 16;
  renderStatus();updateTurnRail();
}
function updateTurnRail() {
  const top = $('conversation').getBoundingClientRect().top + 24;let active;
  for (const item of state.items.slice(state.windowStart, state.windowEnd)) {
    if (item.type !== 'userMessage') continue;
    const node = renderedItems.get('item:' + item.id)?.node;
    if (!active || node?.getBoundingClientRect().top <= top) active = item.id;else break;
  }
  for (const marker of $('turn-rail').children) {
    const selected = marker.dataset.item === active;marker.classList.toggle('current', selected);
    if (selected) marker.setAttribute('aria-current', 'location');else marker.removeAttribute('aria-current');
  }
}
function scheduleTurnRail() {
  if (!railFrame) railFrame = requestAnimationFrame(() => {railFrame = 0;layoutTurnRail();updateTurnRail();if (previewMarker?.isConnected) showTurnPreview(previewMarker);});
}
function renderTurnRail() {
  const users = [...state.userIndex.values()];
  const loader = $('load-turn-index'), history = state.indexHistory;
  loader.hidden = !history || history.done && !history.error;
  loader.disabled = !!history?.loading;
  loader.textContent = history?.loading ? '·' : '⋯';
  loader.title = history?.loading ? '正在按页查找用户消息…' : history?.error ? '载入失败，点击重试' : '按页载入更早的用户对话';
  const shown = users, signature = JSON.stringify(shown.map(item => [item.id,item.content]));
  if (signature !== railSignature) {
    railSignature = signature;hideTurnPreview();const fragment = document.createDocumentFragment();
    for (const item of shown) {
      const marker = el('button', 'turn-marker');marker.classList.remove('button');marker.type = 'button';marker.dataset.item = item.id;
      marker.setAttribute('aria-label', '定位用户消息：' + userExcerpt(item).slice(0, 100));
      marker.addEventListener('pointerenter', () => showTurnPreview(marker));marker.addEventListener('pointerleave', () => {if (document.activeElement !== marker) hideTurnPreview();});
      marker.addEventListener('focus', () => showTurnPreview(marker));
      marker.addEventListener('blur', hideTurnPreview);marker.addEventListener('click', () => jumpToUser(item.id));fragment.append(marker);
    }
    $('turn-rail').replaceChildren(fragment);
  }
  layoutTurnRail();updateTurnRail();
}

async function loadTurnIndex() {
  const history = state.indexHistory;if (!history || history.loading || (history.done && !history.error)) return;
  history.loading = true;history.error = '';renderTurnRail();
  try {
    do {
      const params = {threadId:history.threadId,limit:50,sortDirection:'asc',itemsView:'summary'};if (history.cursor) params.cursor = history.cursor;
      const result = await rpc('thread/turns/list',params);
      if (history !== state.indexHistory || history.version !== selection) return;
      if (!Array.isArray(result?.data)) throw new Error('无法读取用户对话索引。');
      if (result.nextCursor && result.nextCursor === history.cursor) throw new Error('用户消息索引游标未前进。');
      history.users ||= new Map();
      for (const turn of result.data) for (const item of turn.items || []) if (item.type === 'userMessage') {history.users.set(item.id,{...item,_turnId:turn.id});if (!state.userIndex.has(item.id)) state.userIndex.set(item.id,{...item,_turnId:turn.id});}
      history.cursor = result.nextCursor || null;history.done = !history.cursor;renderTurnRail();
    } while (!history.done);
    // Stable chronological order even when live inputs arrive during the scan.
    const ordered = new Map(history.users);
    for (const [id,item] of state.userIndex) ordered.set(id,item);
    state.userIndex = ordered;
  } catch (error) {if (history === state.indexHistory && history.version === selection) history.error = messageOf(error);}
  finally {if (history === state.indexHistory && history.version === selection) {history.loading = false;renderTurnRail();}}
}

function renderThreads() {
  const list = $('thread-list');if (!list) return;
  const scrollTop = list.scrollTop, focused = list.contains(document.activeElement) ? document.activeElement?.dataset.thread : null;
  list.textContent = '';threadBadges.clear();expandedThreadRows = [];
  const term = state.search.trim().toLowerCase(), groups = new Map();
  for (const thread of state.threads) {
    if (state.sourceFilter && (state.sourceFilter === 'subAgent' ? sourceKind(thread) !== 'subAgent' : sourceKind(thread) !== state.sourceFilter)) continue;
    if (term && ![thread.name, thread.preview, thread.cwd, thread.id].some(value => String(value || '').toLowerCase().includes(term))) continue;
    const key = projectKey(thread);if (!groups.has(key)) groups.set(key, []);groups.get(key).push(thread);
  }
  if (!groups.size) list.append(el('li', 'empty-threads muted small', state.threadLoading ? '正在载入会话…' : state.search ? '未找到匹配会话' : '暂无会话'));
  for (const [key, threads] of groups) {
    const group = el('li', 'project-group'), heading = el('button', 'ghost project-heading');heading.type = 'button';heading.title = threads[0].cwd || '未归属项目';heading.dataset.project = key;
    const expanded = !collapsedProjects.has(key);heading.setAttribute('aria-expanded', String(expanded));
    heading.append(el('span', 'project-chevron', expanded ? '⌄' : '›'),el('strong', '', key ? projectName(threads[0].cwd) : '最近'),el('span', 'muted small', threads.length));
    heading.addEventListener('click', () => {if (expanded) collapsedProjects.add(key);else collapsedProjects.delete(key);renderThreads();});group.append(heading);
    const rows = el('ul', 'project-threads');rows.hidden = !expanded;
    for (const thread of threads) {
      const entry = el('li'), selected = thread.id === state.thread?.id, button = el('button', 'thread-row nav-item' + (selected ? ' active' : ''));button.classList.remove('button');button.type = 'button';button.dataset.thread = thread.id;button.setAttribute('aria-pressed', String(selected));
      const title = thread.name || thread.preview || '未命名会话';button.title = title;
      const titleLine = el('span','thread-title-line'), [kind,label] = threadState(thread), badge = el('span','thread-state',label);badge.dataset.state = kind;
      threadBadges.set(thread.id,badge);
      badge.title = threadSummaries.get(thread.id)?.status && (!thread.status || thread.status.type === 'notLoaded') ? '最近一轮的保存状态；每秒检查更新' : 'Codex 返回的会话状态；每秒检查更新';
      titleLine.append(el('strong', '', title),badge);button.append(titleLine);
      const info = el('span', 'thread-info muted small'), date = thread.updatedAt || thread.createdAt;
      info.append(el('span', 'thread-source', sourceLabel(thread)),el('span', '', Number.isFinite(date) && date > 0 ? new Date(date * 1000).toLocaleDateString('zh-CN', {month:'numeric',day:'numeric'}) : ''));
      button.append(info);button.disabled = state.busy && !state.externalWriter || state.switching;button.addEventListener('click', () => void openThread(thread.id));entry.append(button);rows.append(entry);if (expanded) expandedThreadRows.push(button);
    }
    group.append(rows);list.append(group);
  }
  const more = $('load-threads');more.hidden = !state.threadCursor && !state.threadError;more.disabled = state.threadLoading;more.textContent = state.threadLoading ? '正在载入…' : state.threadError ? '加载失败，重试' : '更多会话';
  $('threads-error').textContent = state.threadError;
  list.scrollTop = scrollTop;
  if (focused) [...list.querySelectorAll('[data-thread]')].find(button => button.dataset.thread === focused)?.focus({preventScroll:true});
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

let contextSignature = '';
function renderContext() {
  $('context-project').textContent = state.cwd ? projectName(state.cwd) : '默认项目';$('context-project').title = state.cwd || '使用 Codex 默认工作目录';
  const recent = state.items, files = new Map(), tools = [];
  const turnId = recent.at(-1)?._turnId;
  for (const item of recent.filter(item => !turnId || item._turnId === turnId)) {
    if (item.type === 'fileChange') {for (const change of item.changes || []) {
      if (change.kind !== 'turn' && change.path) files.set(change.path,change);
      else if (change.kind === 'turn') for (const file of splitTurnDiff(change.diff)) files.set(file.path,file);
    }}
    else if (['commandExecution','mcpToolCall','dynamicToolCall','webSearch'].includes(item.type)) {
      const summary = item.type === 'commandExecution' ? summarizeCommand(item.command) : item.type === 'webSearch' ? '搜索 · ' + compactText(item.query || item.action?.url || '网页',52) : compactText(item.tool || item.server || '工具调用',52);
      if (tools.at(-1) === summary) continue;tools.push(summary);
    }
  }
  const signature = JSON.stringify([[...files.values()],tools.slice(-8)]);if (signature === contextSignature) return;contextSignature = signature;
  const filePanel = $('context-files'), toolPanel = $('context-tools');filePanel.textContent = '';toolPanel.textContent = '';
  if (!files.size) filePanel.textContent = '当前没有文件改动';
  for (const change of [...files.values()].slice(0,5)) {
    const row = el('div', 'context-entry context-file'), name = el('span','context-file-name',change.path.split(/[\\/]/).at(-1));row.title = change.path;
    row.append(name);
    if (typeof change.diff === 'string' && change.diff.trim()) {
      const count = window.lumiCodexDisplay.diffCounts(change.diff), amounts = el('span','diff-counts');
      amounts.append(el('span','added','+' + count.added),el('span','removed','−' + count.removed));row.append(amounts);
      row.setAttribute('aria-label',change.path + '，新增 ' + count.added + ' 行，删除 ' + count.removed + ' 行');
    } else row.append(el('span','muted small','改动量未知'));
    filePanel.append(row);
  }
  if (files.size > 5) filePanel.append(el('div','muted small','另有 ' + (files.size - 5) + ' 个文件'));
  if (!tools.length) toolPanel.textContent = '当前没有工具记录';
  for (const tool of tools.slice(-4)) toolPanel.append(el('div', 'context-entry', tool));
  if (tools.length > 4) toolPanel.prepend(el('div','muted small','本轮 ' + tools.length + ' 项工具操作 · 最近 4 项'));
}
function splitTurnDiff(diff) {
  if (typeof diff !== 'string') return [];
  const result = [];let file, oldPath;
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {file = null;oldPath = null;}
    if (!file && line.startsWith('--- ')) oldPath = line.slice(4).replace(/^a\//,'');
    if (!file && line.startsWith('+++ ')) {
      const next = line.slice(4).replace(/^b\//,'');file = {path:next === '/dev/null' ? oldPath : next,diff:''};if (file.path) result.push(file);
    }
    if (file) file.diff += line + '\n';
  }
  return result;
}
function compactText(value, limit = 60) {const text = String(value || '').replace(/\s+/g,' ').trim();return text.length > limit ? text.slice(0,limit - 1) + '…' : text;}
function summarizeCommand(command) {
  const text = String(command || '');
  const match = text.match(/\b(npm(?:\.cmd)?|node|python(?:3)?|git|rg|Get-Content|Get-ChildItem|Get-FileHash|cargo|go|dotnet)\b[^\r\n;]*/i);
  if (!match) return '执行命令';
  return compactText(match[0].replace(/\s+\*>?\s+.*$/,'').replace(/['"]+$/,''),60);
}

function renderApprovals() {
  const container = $('approvals');
  if (!container) return;
  container.textContent = '';
  for (const approval of state.approvals) {
    const card = el('div', 'approval surface tool-config-card');
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
      if(input.tagName==='SELECT'){const wrap=el('span','select-wrap');wrap.dataset.decorated='false';wrap.append(input);label.append(wrap);}else label.append(input);card.append(label);answers[question.id]=input;
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
  if (method === 'thread/status/changed') {
    updateThreadStatus(params.threadId, params.status);
    if (params.threadId === state.thread?.id && params.status?.type !== 'notLoaded') {state.busy = params.status?.type === 'active';if (!state.busy) {state.turnId = null;state.externalWriter = false;}}
    scheduleRender();return;
  }
  if (method === 'thread/started' && params.thread) {
    const index = state.threads.findIndex(thread => thread.id === params.thread.id);
    if (index < 0) state.threads.unshift(params.thread);else state.threads[index] = {...state.threads[index],...params.thread};
    if (params.thread.status) updateThreadStatus(params.thread.id, params.thread.status);
    renderThreads();
  }
  if (method === 'turn/started') updateThreadStatus(params.threadId, {type:'active',activeFlags:[]});
  if (method === 'turn/completed') updateThreadStatus(params.threadId, {type:params.turn?.error ? 'systemError' : 'idle'});
  if (method === 'lumi/bridge/exited') {connected=false;state.initialized=false;initialization=undefined;++selection;++connectionEpoch;state.busy=false;state.switching=false;state.turnId=null;state.approvals=[];state.error=params.detail || '连接已关闭，请重新连接。';renderApprovals();scheduleRender();return;}
  if (params.threadId && params.threadId !== state.thread?.id) return;
  if (method === undefined) {
    if (message.error) { state.error = message.error.message || 'Codex 返回错误。'; scheduleRender(); }
    return;
  }
  if (message.id !== undefined) {
    updateThreadStatus(state.thread?.id,{type:'active',activeFlags:[method.includes('requestUserInput') ? 'waitingOnUserInput' : 'waitingOnApproval']});
    state.approvals.push({id: message.id, ...describeApproval(message)});
    renderApprovals();
    return;
  }
  switch (method) {
    case 'thread/started': break;
    case 'turn/started':
      state.turnId = params.turn?.id;mergeTurns(params.turn ? [{...params.turn,status:'inProgress'}] : []);
      if (state.turnId) {const turn = state.turns.get(state.turnId);if (!Number.isFinite(turn.localStarted)) turn.localStarted = performance.now();}
      state.busy = true;state.error = '';scheduleRender();break;
    case 'turn/completed':
      mergeTurns([params.turn].filter(Boolean));
      if (params.turn?.id) {const turn = state.turns.get(params.turn.id);if (Number.isFinite(turn.localStarted)) turn.localDurationMs = performance.now() - turn.localStarted;turn.status = params.turn.status || 'completed';}
      for (const item of params.turn?.items || []) upsertItem({...item,status:item.status || 'completed'}, params.turn.id);
      for (const item of state.items) if (item._turnId === params.turn?.id && item.status === 'inProgress') {item.status = params.turn.status || 'completed';item._revision++;}
      state.turnId = null;state.busy = false;
      state.externalWriter = false;
      if (params.turn && params.turn.error) state.error = params.turn.error.message || '本轮失败。';
      scheduleRender(); break;
    case 'item/started':
      if (params.item) upsertItem({...params.item,status:params.item.status || 'inProgress'}, params.turnId || state.turnId);scheduleRender();break;
    case 'item/completed':
      if (params.item) upsertItem({...params.item,status:params.item.status || 'completed'}, params.turnId || state.turnId);scheduleRender();break;
    case 'item/agentMessage/delta': appendDelta(params.itemId, 'text', params.delta); scheduleRender(); break;
    case 'item/plan/delta': appendDelta(params.itemId, 'text', params.delta, 'plan'); scheduleRender(); break;
    case 'item/commandExecution/outputDelta': appendDelta(params.itemId, 'output', params.delta); scheduleRender(); break;
    case 'item/reasoning/summaryTextDelta': {
      if (!itemById(params.itemId)) upsertItem({id:params.itemId,type:'reasoning',summary:[]});
      const item = itemById(params.itemId);item._revision++;
      item.summary = item.summary || [];
      item.summary[params.summaryIndex || 0] = (item.summary[params.summaryIndex || 0] || '') + params.delta;
      scheduleRender(); break;
    }
    case 'item/reasoning/textDelta': appendDelta(params.itemId, 'content', params.delta, 'reasoning'); scheduleRender(); break;
    case 'turn/plan/updated': {
      upsertItem({id:'turn:' + params.turnId,type:'plan',explanation:params.explanation,steps:params.plan || []}, params.turnId);
      scheduleRender(); break;
    }
    case 'turn/diff/updated': {
      upsertItem({id:'diff:' + params.turnId,type:'fileChange',changes:[{kind:'turn',path:'本轮改动',diff:params.diff || ''}]}, params.turnId);
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
  const connection = connectionEpoch;
  try {
    const result = await rpc('model/list', {limit: 50, includeHidden: false});
    if (connection !== connectionEpoch) return;
    state.models = (result && result.data) || [];
    renderModels();
  } catch { /* Model list is optional. */ }
}

async function loadThreads(older = false) {
  if (older && (state.threadLoading || !state.threadCursor && !state.threadError)) return;
  const version = older ? state.threadsVersion : ++state.threadsVersion, connection = connectionEpoch;
  state.threadLoading = true;state.threadError = '';if (!older) state.threadCursor = null;renderThreads();
  try {
    const kinds = state.sourceFilter === 'subAgent' ? ['subAgent','subAgentReview','subAgentCompact','subAgentThreadSpawn','subAgentOther'] : state.sourceFilter ? [state.sourceFilter] : ['cli','vscode','exec','appServer','subAgent','subAgentReview','subAgentCompact','subAgentThreadSpawn','subAgentOther','unknown'];
    const params = {limit:30, sortKey:'updated_at', sourceKinds:kinds};
    if (older && state.threadCursor) params.cursor = state.threadCursor;
    // Search on the server too, so titles beyond the first page can be found.
    if (state.search.trim()) {
      const projects = [...state.knownProjects].filter(directory => directory.toLowerCase().includes(state.search.trim().toLowerCase()));
      if (projects.length) params.cwd = projects.length === 1 ? projects[0] : projects;
      else params.searchTerm = state.search.trim();
    }
    const statusVersions = new Map(threadStatusVersions), result = await rpc('thread/list', params);
    if (version !== state.threadsVersion || connection !== connectionEpoch) return;
    const entries = (result?.data || []).filter(thread => typeof thread.id === 'string');
    for (const thread of entries) {
      if (typeof thread.cwd === 'string' && thread.cwd) state.knownProjects.add(thread.cwd);
      thread.status = observedThreadStatus(thread.id,thread.status);
      if ((statusVersions.get(thread.id) || 0) !== (threadStatusVersions.get(thread.id) || 0)) thread.status = threadStatuses.get(thread.id) || thread.status;
      else if (thread.status) {threadStatuses.set(thread.id, thread.status);threadStatusVersions.set(thread.id,(threadStatusVersions.get(thread.id) || 0) + 1);}
    }
    const merged = new Map((older ? state.threads : []).map(thread => [thread.id, thread]));for (const thread of entries) merged.set(thread.id, thread);
    state.threads = [...merged.values()];
    if (result?.nextCursor && result.nextCursor === params.cursor) throw new Error('会话分页游标未前进，请刷新后重试。');
    state.threadCursor = result?.nextCursor || null;
    void loadThreadSummaries(entries,version,connection);
  } catch (error) {if (version === state.threadsVersion && connection === connectionEpoch) state.threadError = messageOf(error);}
  finally {if (version === state.threadsVersion && connection === connectionEpoch) {state.threadLoading = false;renderThreads();}}
}

async function fetchHistory(history, first = false) {
  const isCurrent = () => history === state.history && history.version === selection;
  const params = {threadId:history.threadId, limit:history.mode === 'turns' ? 4 : PAGE_SIZE, sortDirection:'desc'};
  if (history.targetTurn) params.turnId = history.targetTurn;
  if (history.cursor) params.cursor = history.cursor;
  if (history.mode === 'turns') params.itemsView = 'full';
  let response;
  try {response = await rpc(history.mode === 'turns' ? 'thread/turns/list' : 'thread/items/list', params);}
  catch (error) {
    if (first && unsupported(error) && isCurrent()) {
      history.mode = 'turns';history.warning = '当前会话不支持按消息分页，改为每次载入 4 轮。';
      return fetchHistory(history, false);
    }
    throw error;
  }
  if (!isCurrent()) return [];
  if (!Array.isArray(response?.data)) throw new Error('Codex 未返回分页历史，请更新 Codex CLI。');
  if (response.nextCursor && response.nextCursor === history.cursor) throw new Error('历史分页游标未前进，请重试。');
  history.cursor = response.nextCursor || null;
  history.started = true;
  let entries;
  if (history.mode === 'turns') {const turns = response.data.slice().reverse();mergeTurns(turns);entries = turns.flatMap(turn => (turn.items || []).map(item => ({item,turnId:turn.id})));}
  else entries = response.data.slice().reverse();
  if (history.mode === 'items' && (first || entries.some(entry => !state.turns.has(entry.turnId)) && history.turnCursor)) {
    const turnParams = {threadId:history.threadId,limit:20,sortDirection:'desc',itemsView:'notLoaded'};if (!first && history.turnCursor) turnParams.cursor = history.turnCursor;
    try {
      const meta = await rpc('thread/turns/list', turnParams);
      if (!isCurrent()) return [];
      mergeTurns(meta?.data);history.turnCursor = meta?.nextCursor || null;
    } catch { /* Item pagination stays usable when optional turn timing is unavailable. */ }
  }
  return entries;
}

async function loadOlder() {
  if (state.windowStart) {
    scrollAnchor = captureAnchor();state.windowStart = Math.max(0, state.windowStart - PAGE_SIZE);state.windowEnd = Math.min(state.items.length, state.windowStart + WINDOW_SIZE);renderConversation();return;
  }
  const history = state.history;if (!history || history.loading || !history.cursor && !history.error) return;
  scrollAnchor = captureAnchor();history.loading = true;history.error = '';renderConversation();
  try {
    const entries = await fetchHistory(history, !history.started);
    if (history !== state.history || history.version !== selection) return;
    scrollAnchor = captureAnchor();const added = mergeHistory(entries);state.windowStart = 0;state.windowEnd = Math.min(state.items.length, Math.max(PAGE_SIZE, state.windowEnd), WINDOW_SIZE);
    if (!added && history.cursor) history.error = '本页没有新消息，可再次载入。';
  } catch (error) {if (history === state.history && history.version === selection) history.error = messageOf(error);}
  finally {if (history === state.history && history.version === selection) {history.loading = false;renderConversation();renderStatus();}}
}
async function loadNewer() {
  if (state.detached && state.windowEnd >= state.items.length && state.history.targetNext) {
    const history = state.history, version = selection;
    try {
      const response = await rpc('thread/items/list',{threadId:history.threadId,turnId:history.targetTurn,cursor:history.targetNext,sortDirection:'asc',limit:PAGE_SIZE});
      if (version !== selection || history !== state.history) return;
      if (response.nextCursor && response.nextCursor === history.targetNext) throw new Error('历史分页游标未前进。');
      for (const entry of response.data || []) upsertItem(entry.item,entry.turnId);
      history.targetNext = response.nextCursor || null;
    } catch (error) {if (version === selection) {state.error = messageOf(error);renderStatus();}return;}
  }
  scrollAnchor = captureAnchor();state.windowEnd = Math.min(state.items.length, state.windowEnd + PAGE_SIZE);state.windowStart = Math.max(0, state.windowEnd - WINDOW_SIZE);renderConversation();renderStatus();
}
function jumpLatest() {
  if (state.detached) {void restoreLatest();return;}
  state.windowEnd = state.items.length;state.windowStart = Math.max(0, state.windowEnd - WINDOW_SIZE);scrollAnchor = null;renderConversation();$('conversation').scrollTop = $('conversation').scrollHeight;renderStatus();
}
async function restoreLatest() {
  const version = selection, threadId = state.thread?.id;if (!threadId) return;
  try {
    const result = await rpc('thread/items/list',{threadId,limit:PAGE_SIZE,sortDirection:'desc'});if (version !== selection) return;
    state.items = [];state.itemIndex.clear();state.windowStart = 0;state.windowEnd = 0;mergeHistory((result.data || []).slice().reverse());
    state.history.cursor = result.nextCursor || null;state.history.targetTurn = null;state.history.targetNext = null;state.detached = false;
    state.windowEnd = state.items.length;state.windowStart = 0;renderConversation();jumpLatest();
  } catch (error) {if (version === selection) {state.error = messageOf(error);renderStatus();}}
}

async function openThread(threadId) {
  if (state.busy && !state.externalWriter || state.switching || !connected) return;
  const version = ++selection;state.switching = true;state.error = '';renderStatus();
  try {
    const read = await rpc('thread/read', {threadId, includeTurns:false});
    if (version !== selection) return;
    if (!read?.thread) throw new Error('会话不存在。');
    resetConversation();state.thread = read.thread;state.cwd = read.thread.cwd || '';state.turnId = null;state.approvals = [];renderApprovals();
    if (read.thread.status) updateThreadStatus(threadId,read.thread.status);
    const history = state.history = {threadId,version,mode:'items',cursor:null,turnCursor:null,loading:true,error:'',warning:''};
    renderThreads();renderConversation();
    try {const entries = await fetchHistory(history, true);if (version !== selection) return;mergeHistory(entries);state.windowEnd = state.items.length;state.windowStart = Math.max(0, state.windowEnd - WINDOW_SIZE);}
    catch (error) {if (version !== selection) return;history.unsupported = unsupported(error);history.warning = history.unsupported ? '此版本 Codex 不支持分批历史，请更新 Codex CLI。' : '';history.error = messageOf(error);}
    history.loading = false;
    // Resume only after the paging capability is known, and exclude its full history payload.
    if (!history.error) await resumeCurrentThread(version);
    if (version !== selection) return;
    renderConversation();jumpLatest();
    state.indexHistory = {threadId,version,cursor:null,done:false,loading:false,error:''};void loadTurnIndex();
    if (innerWidth < 760) setSidebar(false);
  } catch (error) {if (version === selection) state.error = messageOf(error);}
  finally {if (version === selection) {state.switching = false;renderStatus();scheduleSync();}}
}
function scheduleSync(delay = 3000) {
  clearTimeout(syncTimer);
  if (!chatDisposed && connected && !document.hidden) syncTimer = setTimeout(() => void syncCurrentThread(), delay);
}
async function syncCurrentThread() {
  const version = selection, connection = connectionEpoch, epoch = syncEpoch;
  if (syncPending || !connected || state.switching || !state.thread || state.history?.loading || document.hidden) {scheduleSync();return;}
  const threadId = state.thread.id, history = state.history, revisions = new Map(state.items.map(item => [item.id,item._revision]));
  const current = () => version === selection && connection === connectionEpoch && epoch === syncEpoch && threadId === state.thread?.id;
  syncPending = true;
  try {
    const revision = threadStatusVersions.get(threadId), read = await rpc('thread/read',{threadId,includeTurns:false});if (!current()) return;
    if (read?.thread) {
      state.thread = {...state.thread,...read.thread,status:revision === threadStatusVersions.get(threadId) ? read.thread.status : state.thread.status,turns:undefined};
      const row = state.threads.find(thread => thread.id === threadId);if (row) Object.assign(row, state.thread);
      if (read.thread.status && revision === threadStatusVersions.get(threadId)) {
        updateThreadStatus(threadId,read.thread.status);
        if (read.thread.status.type === 'active') state.busy = true;
        if (read.thread.status.type === 'idle' || read.thread.status.type === 'systemError') {state.externalWriter = false;state.busy = false;state.turnId = null;}
      }
    }
    if (!history || history.unsupported) return;
    const turnsMode = history.mode === 'turns';
    const result = await rpc(turnsMode ? 'thread/turns/list' : 'thread/items/list',{threadId,limit:turnsMode ? 4 : PAGE_SIZE,sortDirection:'desc',...(turnsMode ? {itemsView:'full'} : {})});
    if (!current()) return;
    const rows = (result?.data || []).slice().reverse();
    const entries = turnsMode ? rows.flatMap(turn => (turn.items || []).map(item => ({item,turnId:turn.id}))) : rows;
    if (turnsMode) mergeTurns(rows);
    for (const entry of entries) {
      const old = itemById(entry.item?.id);
      // A delta received during the request is newer than its snapshot.
      if (old && old._revision !== revisions.get(old.id)) continue;
      if (old && Object.keys(entry.item).every(key => JSON.stringify(old[key]) === JSON.stringify(entry.item[key])) && old._turnId === entry.turnId) continue;
      upsertItem(entry.item,entry.turnId);
    }
    if (!turnsMode) {
      const metadataRevision = threadStatusVersions.get(threadId);
      const meta = await rpc('thread/turns/list',{threadId,limit:20,sortDirection:'desc',itemsView:'notLoaded'}).catch(()=>null);
      if (!current()) return;if (meta && metadataRevision === threadStatusVersions.get(threadId)) mergeTurns(meta.data);
    }
    const latestTurn = state.turns.get(state.items.at(-1)?._turnId), marker = state.writerTurnMarker;
    if (state.externalWriter && marker && latestTurn && ['completed','failed','interrupted'].includes(latestTurn.status) && (latestTurn.id !== marker.id || latestTurn.status !== marker.status)) {
      state.externalWriter = false;state.busy = false;state.turnId = null;state.writerTurnMarker = null;
      updateThreadStatus(threadId,{type:latestTurn.status === 'failed' ? 'systemError' : 'idle'});
    }
    renderThreads();scheduleRender();
  } catch { /* Retain the visible snapshot; stream events and the next bounded refresh can recover. */ }
  finally {syncPending = false;if (epoch === syncEpoch) scheduleSync();}
}
async function resumeCurrentThread(version = selection) {
  if (state.resumed || !state.thread) return;
  if (state.history?.unsupported) throw new Error('请更新 Codex CLI 后重连，以分批载入历史。');
  const threadId = state.thread.id;
  let result;
  try {result = await rpc('thread/resume', {threadId, excludeTurns:true});}
  catch (error) {
    if (version !== selection || threadId !== state.thread?.id) return;
    if (!/already has an active writer/i.test(messageOf(error))) throw error;
    state.externalWriter = true;state.busy = true;state.error = '';
    const latest = state.turns.get(state.items.at(-1)?._turnId);state.writerTurnMarker = latest ? {id:latest.id,status:latest.status} : null;
    updateThreadStatus(threadId,{type:'active',activeFlags:[]});scheduleRender();return;
  }
  if (version !== selection || threadId !== state.thread?.id) return;
  const thread = result?.thread || {};state.thread = {...state.thread, ...thread, turns:undefined};state.resumed = true;
  if (thread.status) updateThreadStatus(threadId,thread.status);
  mergeTurns(thread.turns);
  const active = (thread.turns || []).find(turn => turn.status === 'inProgress');
  // Recent metadata supplies the active turn when excludeTurns omits it from the response.
  const observed = active || [...state.turns.values()].find(turn => turn.status === 'inProgress');
  if (observed) {state.turnId = observed.id;state.busy = true;}
  else if (thread.status?.type === 'active') state.busy = true;
}

async function newThread() {
  if (state.busy && !state.externalWriter || state.switching || !connected) return;
  const version=++selection;state.switching=true;renderStatus();
  state.error = '';
  try {
    const params = {};
    if (state.cwd) params.cwd = state.cwd;
    if (state.model) params.model = state.model;
    const result = await rpc('thread/start', params);
    if(version!==selection)return;
    state.thread = result && result.thread;
    resetConversation();state.resumed = true;state.turnId = null;state.busy = false;state.approvals = [];
    renderApprovals(); renderThreads(); scheduleRender();
    if (state.thread) {state.threads.unshift(state.thread);renderThreads();void loadThreads();}
    if (innerWidth < 760) setSidebar(false);
  } catch (error) {
    if(version===selection){state.error = messageOf(error); scheduleRender();}
  }
  finally {if(version===selection){state.switching=false;scheduleRender();}}
}

async function startTurn(text) {
  if (!connected || state.busy || state.switching) return;
  if (!state.thread) await newThread();
  if (!state.thread) return;
  const version = selection, threadId = state.thread.id;
  state.switching = true;renderStatus();
  try {await resumeCurrentThread(version);} catch (error) {if (version === selection) {state.error = messageOf(error);state.switching = false;renderStatus();}return;}
  if (version !== selection) return;state.switching = false;if (state.busy) {renderStatus();return;}
  const params = {threadId, input: [{type: 'text', text}]};
  if (state.model) params.model = state.model;
  if (state.effort) params.effort = state.effort;
  if (state.cwd) params.cwd = state.cwd;
  state.busy = true; state.error = ''; scheduleRender();
  try {
    const result = await rpc('turn/start', params);
    if (version !== selection || threadId !== state.thread?.id) return;
    if (state.busy) {state.turnId = result?.turn?.id;mergeTurns([result?.turn].filter(Boolean));}
  } catch (error) {
    if (version !== selection || threadId !== state.thread?.id) return;
    state.busy = false;state.error = messageOf(error);
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
  const version = selection, threadId = state.thread.id;
  const name = $('rename-input').value;
  if (!name.trim()) return;
  try { await rpc('thread/name/set', {threadId, name:name.trim()});if (version !== selection) return;state.thread.name = name.trim();const row = state.threads.find(thread => thread.id === threadId);if (row) row.name = name.trim();renderThreads();scheduleRender(); }
  catch (error) {if (version === selection) {state.error = messageOf(error);scheduleRender();}}
}

async function archiveThread() {
  if (!state.thread || !connected || state.busy || state.switching) return;
  const version = selection, threadId = state.thread.id;
  try { await rpc('thread/archive', {threadId});if (version !== selection) return;state.thread = null;resetConversation();void loadThreads();scheduleRender(); }
  catch (error) {if (version === selection) {state.error = messageOf(error);scheduleRender();}}
}

async function deleteThread() {
  if (!state.thread || !connected || state.busy || state.switching) return;
  const version = selection, threadId = state.thread.id;
  try { await rpc('thread/delete', {threadId});if (version !== selection) return;state.thread = null;resetConversation();void loadThreads();scheduleRender(); }
  catch (error) {if (version === selection) {state.error = messageOf(error);scheduleRender();}}
}

async function pickDirectory() {
  const version = selection;
  try {
    const result = await sdk.codex.bridge.chooseDirectory();
    if (version !== selection) return;
    if (result && result.path) { state.cwd = result.path; renderStatus(); }
  } catch (error) { state.error = messageOf(error); scheduleRender(); }
}

/* ---------------- wiring ---------------- */

function resizePrompt() {
  const stream = $('conversation');$('chat-shell').style.setProperty('--chat-scrollbar',Math.max(0,stream.offsetWidth-stream.clientWidth)+'px');
  const prompt = $('prompt'),limit = Math.min(160, Math.max(48, $('chat-shell').clientHeight * .22));prompt.style.height = 'auto';prompt.style.height = Math.min(limit, Math.max(48, prompt.scrollHeight)) + 'px';
}
function syncSidebar() {const narrow = innerWidth < 760, open = $('chat-shell').classList.contains('sidebar-open');$('threads-panel').inert = narrow && !open;$('toggle-threads').setAttribute('aria-expanded', String(!narrow || open));}
function setSidebar(open) { $('chat-shell').classList.toggle('sidebar-open', open);syncSidebar();if (innerWidth < 760) {if (open) $('thread-search').focus();else if ($('threads-panel').contains(document.activeElement)) $('toggle-threads').focus();}}
function wireChat() {
  $('new-thread').addEventListener('click', () => void newThread());
  $('refresh-threads').addEventListener('click', () => void loadThreads().catch(error => { state.error = messageOf(error); scheduleRender(); }));
  $('thread-search').addEventListener('input', event => {state.search = event.target.value;++state.threadsVersion;state.threadCursor = null;state.threadLoading = true;renderThreads();clearTimeout(threadSearchTimer);threadSearchTimer = setTimeout(() => void loadThreads(), 240);});
  $('source-filter').addEventListener('change', event => {state.sourceFilter = event.target.value;void loadThreads();});
  $('load-threads').addEventListener('click', () => void loadThreads(true));
  $('load-older').addEventListener('click', () => void loadOlder());
  $('load-turn-index').addEventListener('click', () => void loadTurnIndex(4));
  $('load-newer').addEventListener('click', loadNewer);
  $('jump-latest').addEventListener('click', jumpLatest);
  $('toggle-threads').addEventListener('click', () => setSidebar(!$('chat-shell').classList.contains('sidebar-open')));
  $('close-threads').addEventListener('click', () => setSidebar(false));
  $('sidebar-backdrop').addEventListener('click', () => setSidebar(false));
  document.addEventListener('keydown', event => {if (event.key === 'Escape') {setSidebar(false);hideTurnPreview();document.querySelector('.thread-actions').open=false;}});
  document.addEventListener('click', event => {const actions=document.querySelector('.thread-actions');if (!actions.contains(event.target) || event.target.closest('.actions-menu button')) actions.open=false;});
  $('conversation').addEventListener('scroll', () => {const focused = document.activeElement;if ($('turn-rail').contains(focused)) showTurnPreview(focused);else hideTurnPreview();scheduleTurnRail();});
  railObserver = new ResizeObserver(scheduleTurnRail);railObserver.observe($('stream-stage'));
  $('conversation').addEventListener('scroll', () => {const top = $('conversation').scrollTop, movingUp = top < lastScrollTop;lastScrollTop = top;renderStatus();if (movingUp && top < 50 && !state.switching && !state.history?.loading && !state.history?.error) void loadOlder();});
  $('prompt').addEventListener('input', resizePrompt);
  window.addEventListener('resize', () => {hideTurnPreview();resizePrompt();syncSidebar();scheduleTurnRail();});syncSidebar();
  statusClock = setInterval(() => {if (state.busy && !document.hidden) renderStatus();}, 1000);
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
  $('steer').addEventListener('click', () => { const prompt = $('prompt'); const text = prompt.value.trim(); if (text) { prompt.value = '';resizePrompt();void steerTurn(text); } });
  const sendPrompt=()=>{if(!connected || state.busy || state.switching)return;const prompt=$('prompt'),text=prompt.value.trim();if(!text)return;prompt.value='';resizePrompt();void startTurn(text);};
  $('send').addEventListener('click',sendPrompt);
  $('prompt').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault();sendPrompt(); } });
}

async function startChat() {
  wireChat();
  window.addEventListener('pagehide', () => {chatDisposed=true;++selection;++connectionEpoch;++syncEpoch;clearTimeout(syncTimer);clearTimeout(threadStatusTimer);clearInterval(statusClock);clearTimeout(threadSearchTimer);railObserver?.disconnect();cancelAnimationFrame(railFrame);railFrame=0;unsubscribe?.();unsubscribe=undefined;});
  document.addEventListener('visibilitychange',()=>{clearTimeout(syncTimer);clearTimeout(threadStatusTimer);if(!document.hidden){scheduleSync(0);scheduleThreadStatusRefresh(0);}});
  renderConversation();resizePrompt();await connectChat();
}

async function connectChat() {
  if (state.switching || state.busy) return;
  unsubscribe?.();++connectionEpoch;state.knownProjects.clear();threadStatuses.clear();threadStatusVersions.clear();threadSummaries.clear();const version=++selection;unsubscribe=sdk.codex.bridge.subscribe(handleEvent);state.initialized=false;state.thread=null;resetConversation();state.approvals=[];state.turnId=null;connected=false;state.error='正在连接…';renderApprovals();scheduleRender();
  renderStatus();
  try {
    await ensureInitialized();
    if(version!==selection)return;
    connected=true;state.error='';
    await Promise.all([loadModels().catch(() => {}), loadThreads()]);
    scheduleRender();
    scheduleSync();
    scheduleThreadStatusRefresh();
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
      status.textContent = '无法使用 Codex 桥接，请检查 Codex CLI 或更新 Lumi。(' + messageOf(error) + ')';
    }
  };
  $('conn-refresh').addEventListener('click', () => void refresh());
  await refresh();
}

async function start() {
  const {context, view} = await sdk.ready;
  state.slot = view.slot;
  if (view.slot === 'sidebar') document.body.dataset.lumiLayout = 'fill';
  else delete document.body.dataset.lumiLayout;
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

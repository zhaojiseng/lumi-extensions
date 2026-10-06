(() => {
// Render protocol data with DOM nodes only. Message text never becomes HTML.
function node(tag, className = '', text) {
  const element = document.createElement(tag);
  element.className = (tag === 'button' ? 'button ' : ['input', 'textarea'].includes(tag) ? 'text-input ' : '') + className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '';
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return milliseconds < 1000 ? '<1 秒' : seconds + ' 秒';
  return (seconds >= 3600 ? Math.floor(seconds / 3600) + ' 小时 ' : '') + Math.floor(seconds % 3600 / 60) + ' 分 ' + seconds % 60 + ' 秒';
}

function turnDuration(turn) {
  if (Number.isFinite(turn?.durationMs) && turn.durationMs >= 0) return {value: turn.durationMs, local: false};
  if (Number.isFinite(turn?.startedAt) && Number.isFinite(turn?.completedAt) && turn.completedAt >= turn.startedAt) return {value: (turn.completedAt - turn.startedAt) * 1000, local: false};
  if (Number.isFinite(turn?.localDurationMs)) return {value: turn.localDurationMs, local: true};
  return null;
}

function sourceKind(thread) {
  return typeof thread.source === 'string' ? thread.source : thread.source?.subAgent ? 'subAgent' : thread.source?.custom ? 'custom' : 'unknown';
}
function sourceLabel(thread) {
  return {cli:'终端',vscode:'编辑器',exec:'自动任务',appServer:'应用',subAgent:'子任务',custom:'自定义',unknown:'其他'}[sourceKind(thread)] || '其他';
}
function projectKey(thread) {
  const directory = typeof thread.cwd === 'string' ? thread.cwd.replace(/\\/g, '/').replace(/\/$/, '') : '';
  return /^[a-z]:\//i.test(directory) ? directory.toLowerCase() : directory;
}
function projectName(directory) {
  return directory.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) || directory || '最近';
}

async function copyText(text, button) {
  const focus = document.activeElement;
  try {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const input = node('textarea');input.value = text;input.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.append(input);input.select();const copied = document.execCommand('copy');input.remove();focus?.focus();
      if (!copied) throw new Error();
    }
    button.textContent = '已复制';
  } catch { button.textContent = '请选中复制'; }
}

function inline(element, text) {
  const expression = /(`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^\s)]+)\))/g;
  let position = 0;
  for (const match of text.matchAll(expression)) {
    element.append(document.createTextNode(text.slice(position, match.index)));
    if (match[2]) element.append(node('code', 'inline-code', match[2]));
    else if (match[3]) element.append(node('strong', '', match[3]));
    else { const reference = node('span', 'reference', match[4]);reference.title = match[5];reference.append(node('code', 'reference-url', match[5]));element.append(reference); }
    position = match.index + match[0].length;
  }
  element.append(document.createTextNode(text.slice(position)));
}

function codeBlock(text, language = '') {
  const wrapper = node('div', 'code-block'), header = node('div', 'code-head');
  const copy = node('button', 'ghost small', '复制');copy.type = 'button';copy.addEventListener('click', () => void copyText(text, copy));
  header.append(node('span', 'muted small', language || '代码'), copy);
  const pre = node('pre'), code = node('code', '', text);pre.append(code);wrapper.append(header, pre);return wrapper;
}

function markdown(text = '') {
  const content = node('div', 'message-content');
  const lines = String(text).split('\n');let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (/^\s*```/.test(line)) {
      const language = line.trim().slice(3), code = [];index++;
      while (index < lines.length && !/^\s*```/.test(lines[index])) code.push(lines[index++]);
      index++;content.append(codeBlock(code.join('\n'), language));continue;
    }
    if (!line.trim()) { index++;continue; }
    if (index + 1 < lines.length && line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      const wrap = node('div', 'table-wrap'), table = node('table', 'message-table');
      const cells = value => value.trim().replace(/^\||\|$/g, '').split('|');
      const head = node('tr');for (const cell of cells(line)) {const element = node('th');inline(element, cell.trim());head.append(element);}table.append(head);index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {const row = node('tr');for (const cell of cells(lines[index++])) {const element = node('td');inline(element, cell.trim());row.append(element);}table.append(row);}
      wrap.append(table);content.append(wrap);continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) { const element = node('h' + Math.min(heading[1].length + 2, 6));inline(element, heading[2]);content.append(element);index++;continue; }
    if (/^\s*([-*]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d/.test(line), list = node(ordered ? 'ol' : 'ul');
      while (index < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/).test(lines[index])) {const entry = node('li');inline(entry, lines[index++].replace(/^\s*(?:[-*]|\d+[.)])\s+/, ''));list.append(entry);}content.append(list);continue;
    }
    const quote = /^>\s?/.test(line), paragraph = node(quote ? 'blockquote' : 'p', 'text');
    const group = [quote ? line.replace(/^>\s?/, '') : line];index++;
    while (index < lines.length && lines[index].trim() && !/^(?:\s*```|#{1,6}\s|\s*[-*]\s|\s*\d+[.)]\s|>)/.test(lines[index]) && !(index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1]))) group.push(lines[index++]);
    inline(paragraph, group.join('\n'));content.append(paragraph);
  }
  return content;
}

function expandable(title, value, className = '') {
  const details = node('details', 'detail-block ' + className), summary = node('summary', '', title);
  details.append(summary);
  details.addEventListener('toggle', () => {
    if (!details.open || details.childElementCount > 1) return;
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const pre = node('pre', className, text?.slice(0, 12000) || '无内容');details.append(pre);
    if (text?.length > 12000) {const full = node('button', 'ghost small', '显示完整内容');full.addEventListener('click', () => {pre.textContent = text;full.remove();});details.append(full);}
  });
  return details;
}

function imageContent(part) {
  const figure = node('figure', 'attachment');
  const url = part.url || part.imageUrl || (part.data && part.mimeType ? 'data:' + part.mimeType + ';base64,' + part.data : '');
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=\s]+$/.test(url) && url.length <= 4 * 1024 * 1024) {
    const image = node('img');image.src = url;image.alt = part.name || '对话图片';image.loading = 'lazy';figure.append(image);
  }
  figure.append(node('figcaption', 'muted small', part.path || part.name || part.fileId || (part.type === 'localImage' || part.type === 'image' ? '图片附件' : '附件')));
  return figure;
}

function contentParts(container, parts = []) {
  for (const part of Array.isArray(parts) ? parts : []) {
    if (part.type === 'text' || part.type === 'inputText') container.append(markdown(part.text));
    else if (['image','localImage','inputImage'].includes(part.type)) container.append(imageContent(part));
    else if (['audio','localAudio','inputAudio','skill','mention','resource_link','resource'].includes(part.type)) {
      container.append(node('div', 'attachment-chip', ({skill:'技能',mention:'引用',audio:'音频',localAudio:'音频',resource:'资源',resource_link:'来源'}[part.type] || '附件') + ' · ' + (part.name || part.path || part.uri || part.url || '')));
    } else container.append(expandable('附件详情', part));
  }
}

const statusLabels = {inProgress:'处理中',completed:'已完成',failed:'失败',declined:'已拒绝',interrupted:'已中断',pending:'待处理',running:'进行中',notFound:'未找到'};
function diffCounts(diff = '') {
  let added = 0, removed = 0, inHunk = false;
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {inHunk = false;continue;}
    if (line.startsWith('@@')) {inHunk = true;continue;}
    if (line.startsWith('+') && (inHunk || !line.startsWith('+++'))) added++;
    if (line.startsWith('-') && (inHunk || !line.startsWith('---'))) removed++;
  }
  return {added,removed};
}
function counts(count) {
  const group = node('span', 'diff-counts');group.append(node('span', 'added', '+' + count.added), node('span', 'removed', '−' + count.removed));return group;
}
function fileChanges(article, changes = []) {
  const total = changes.reduce((sum, change) => {const count = diffCounts(change.diff);return {added:sum.added + count.added,removed:sum.removed + count.removed};}, {added:0,removed:0});
  const aggregate = changes.every(change => change.kind === 'turn');
  const summary = node('div', 'change-summary');summary.append(node('strong', '', aggregate ? '本轮文件差异' : changes.length + ' 个文件改动'), counts(total));article.append(summary);
  const append = (parent, change) => {
    const file = node('details', 'file-change'), header = node('summary'), kind = typeof change.kind === 'string' ? change.kind : change.kind?.type;
    const path = node('span', 'file-path', change.path || '本轮改动');path.title = change.path || '';
    header.append(path, node('span', 'muted small', {add:'新增',delete:'删除',update:'修改',turn:'汇总'}[kind] || '修改'), counts(diffCounts(change.diff)));file.append(header);
    file.addEventListener('toggle', () => {if (file.open && file.childElementCount === 1) file.append(codeBlock(change.diff || '无可用差异', 'diff'));});parent.append(file);
  };
  for (const change of changes.slice(0, 3)) append(article, change);
  if (changes.length > 3) {
    const more = node('details', 'more-files');more.append(node('summary', '', '再显示 ' + (changes.length - 3) + ' 个文件'));
    more.addEventListener('toggle', () => {if (more.open && more.childElementCount === 1) for (const change of changes.slice(3)) append(more, change);});article.append(more);
  }
}

function renderItem(item) {
  const roles = {userMessage:'user',agentMessage:'assistant',reasoning:'reasoning',plan:'plan',commandExecution:'command',fileChange:'diff',mcpToolCall:'tool',dynamicToolCall:'tool',functionCallOutput:'tool',webSearch:'search',enteredReviewMode:'review',exitedReviewMode:'review',contextCompaction:'event',error:'error',collabAgentToolCall:'agents',subAgentActivity:'agents',imageView:'image',imageGeneration:'image',sleep:'event'};
  const role = roles[item.type] || 'event';
  const article = node('article', 'item role-' + role + (role === 'assistant' ? '' : ' surface panel') + (role === 'user' ? ' bubble' : role === 'assistant' ? '' : ' activity-card'));
  const head = node('div', 'item-head');head.append(node('span', 'role', {user:'你',assistant:'Codex',reasoning:'思考',plan:'计划',command:'命令',diff:'文件改动',tool:'工具',search:'搜索',review:'审查',event:'事件',error:'错误',agents:'子任务',image:'图片'}[role]));
  if (item.status) head.append(node('span', 'badge pill muted', statusLabels[item.status] || item.status));
  if (Number.isFinite(item.durationMs)) head.append(node('span', 'muted small', formatDuration(item.durationMs)));
  article.append(head);
  if (item.type === 'userMessage') contentParts(article, item.content);
  else if (item.type === 'agentMessage' || item.type === 'plan' && !item.steps) article.append(markdown(item.text));
  else if (item.type === 'plan') {
    if (item.explanation) article.append(markdown(item.explanation));
    const steps = node('ol', 'plan-list');for (const step of item.steps) {const row = node('li');row.append(node('span', 'pill muted', statusLabels[step.status] || step.status),node('span', '', step.step));steps.append(row);}article.append(steps);
  } else if (item.type === 'reasoning') article.append(expandable('思考过程', (item.summary || []).join('\n') || (Array.isArray(item.content) ? item.content.join('\n') : item.content) || ''));
  else if (item.type === 'commandExecution') {
    article.append(node('code', 'command-line', item.command || ''));
    if (item.cwd) article.append(node('p', 'muted small path-label', item.cwd));
    if (item.output || item.aggregatedOutput) article.append(expandable('命令输出', item.output || item.aggregatedOutput, 'output'));
    if (item.exitCode !== undefined && item.exitCode !== null) article.append(node('span', 'pill ' + (item.exitCode ? 'removed' : 'muted'), '退出码 ' + item.exitCode));
  } else if (item.type === 'fileChange') fileChanges(article, item.changes);
  else if (['mcpToolCall','dynamicToolCall','functionCallOutput'].includes(item.type)) {
    article.append(node('strong', '', (item.server ? item.server + ' · ' : '') + (item.tool || item.name || '工具调用')));
    if (item.arguments !== undefined) article.append(expandable('输入参数', item.arguments));
    if (item.result?.content) contentParts(article, item.result.content);
    if (item.contentItems) contentParts(article, item.contentItems);
    if (item.result !== undefined || item.output !== undefined) article.append(expandable('输出详情', item.result || item.output));
    if (item.error) article.append(expandable('错误详情', item.error));
  } else if (item.type === 'webSearch') {
    article.append(node('p', 'text', item.query || item.action?.url || '浏览网页'));
    if (item.results) article.append(expandable('搜索结果', item.results));
  } else if (item.type === 'collabAgentToolCall') {
    article.append(node('strong', '', item.tool || '子任务'));
    for (const [id, agent] of Object.entries(item.agentsStates || {})) {const row = node('div', 'agent-state');row.append(node('span', '', agent.agentNickname || id),node('span', 'pill muted', statusLabels[agent.status] || agent.status));if (agent.message) row.append(node('p', 'text', agent.message));article.append(row);}
    if (item.prompt) article.append(expandable('任务说明', item.prompt));
  } else if (item.type === 'subAgentActivity') article.append(node('p', 'text', (item.agentPath || '') + ' · ' + (typeof item.kind === 'string' ? item.kind : item.kind?.type || '活动')));
  else if (['imageView','imageGeneration'].includes(item.type)) {
    if (item.result) article.append(imageContent({type:'image',url:item.result.startsWith('data:') ? item.result : 'data:image/png;base64,' + item.result,name:item.savedPath}));
    else article.append(node('div', 'attachment-chip', item.path || item.savedPath || '图片'));
    if (item.failure) article.append(expandable('生成失败', item.failure));
  } else if (item.type === 'contextCompaction') article.append(node('p', 'muted small', 'Codex 已压缩上下文，保留当前任务摘要。'));
  else if (item.type === 'sleep') article.append(node('p', 'muted small', '等待 ' + formatDuration(item.durationMs)));
  else if (role === 'review') article.append(markdown(item.review));
  else if (item.type === 'error') article.append(node('p', 'text', item.message || item.text || '本轮出现错误。'));
  else article.append(expandable('事件详情', item));
  return article;
}

function renderTurnFooter(turn) {
  const duration = turnDuration(turn), footer = node('div', 'turn-footer muted small');
  if (turn.status === 'inProgress') {footer.textContent = '工作中';return footer;}
  footer.textContent = (statusLabels[turn.status] || '已完成') + ' · ' + (duration ? (duration.local ? '本地计时 ' : '耗时 ') + formatDuration(duration.value) : '耗时未知');
  return footer;
}

window.lumiCodexDisplay = Object.freeze({node, renderItem, renderTurnFooter, formatDuration, turnDuration, sourceKind, sourceLabel, projectKey, projectName, diffCounts});
})();

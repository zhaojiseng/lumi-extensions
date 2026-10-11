const frame = document.querySelector('iframe');
const protocol = 'lumi-extension/1', nonce = 'notes-ui-fixture';
const send = message => frame.contentWindow.postMessage({protocol, nonce, ...message}, '*');
window.fixture = {
  reads: [], writes: [], stored: '先前保存的便笺', activeWrites: 0, maxActiveWrites: 0,
  resolveRead() {
    const request = this.reads.shift();
    if (!request) throw new Error('No pending read');
    send({type: 'response', id: request.id, ok: true, data: this.stored});
  },
  finishWrite(index, error) {
    const request = this.writes[index];
    if (!request || request.finished) throw new Error('No pending write');
    request.finished = true;
    this.activeWrites--;
    if (!error) this.stored = request.input.value;
    send({type: 'response', id: request.id, ok: !error, data: null, error});
  },
  theme(theme) {
    document.body.style.background = theme === 'dark' ? '#111c17' : '#eef3f0';
    send({type: 'context', context: {theme, locale: 'zh-CN'}});
  }
};

addEventListener('message', event => {
  const request = event.data;
  if (event.source !== frame.contentWindow || request?.protocol !== protocol) return;
  if (request.type === 'ready') {
    send({type: 'init', context: {theme: 'light', locale: 'zh-CN'}, view: {id: 'card', slot: 'workbench'}});
    return;
  }
  if (request.type !== 'request' || request.nonce !== nonce) return;
  if (request.method === 'storage.read' && request.input.key === 'note') fixture.reads.push(request);
  else if (request.method === 'storage.write' && request.input.key === 'note' && typeof request.input.value === 'string') {
    fixture.writes.push(request);
    fixture.activeWrites++;
    fixture.maxActiveWrites = Math.max(fixture.maxActiveWrites, fixture.activeWrites);
  } else send({type: 'response', id: request.id, ok: false, error: 'Unexpected fixture request'});
});

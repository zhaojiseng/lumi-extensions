import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../package-stage/app.js', import.meta.url), 'utf8');

// Exercise the production event, timer and request flow with deterministic time.
// Layout remains covered by the real Electron UI regressions.
function harness() {
  const elements = new Map(), documentEvents = new Map(), timers = new Map(), requests = [];
  let now = 0, timerId = 0;
  function element(id = '') {
    if (id && elements.has(id)) return elements.get(id);
    const listeners = new Map();
    const value = {
      id, value: '', type: 'text', hidden: false, disabled: false, checked: false, open: false,
      dataset: {}, children: [], options: [], firstChild: { textContent: '' },
      classList: { toggle() {} },
      addEventListener(name, callback) { listeners.set(name, callback); },
      querySelector(selector) { return element(id + ':' + selector); }, querySelectorAll() { return []; },
      hasAttribute() { return false; }, setAttribute() {}, removeAttribute() {}, toggleAttribute() {},
      replaceChildren(...children) { this.children = children; }, append(...children) { this.children.push(...children); },
      before() {}, after() {}, close() { this.open = false; }, reset() {}, focus() {},
      cloneNode() { return element(); }, closest() { return null; },
    };
    if (id) elements.set(id, value);
    return value;
  }
  const document = {
    hidden: false, documentElement: { dataset: {} }, body: { dataset: {} },
    getElementById: element, createElement: () => element(), createComment: () => element(),
    querySelectorAll() { return []; },
    addEventListener(name, callback) { documentEvents.set(name, callback); },
  };
  const workbench = new Proxy({ supported: false, accessChoices: () => [], preferredAccess: () => null }, {
    get: (target, key) => key in target ? target[key] : () => {},
  });
  const sdk = {
    ready: new Promise(() => {}), gateway: { local: {}, records: {
      list(input) { return new Promise((resolve, reject) => requests.push({ input, resolve, reject })); },
    } },
  };
  const context = vm.createContext({ document, URL, TextEncoder, console,
    window: { lumiExtension: sdk, createGatewayWorkbench: () => workbench, addEventListener() {} },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.testApp={state,showTab,recordSummaryChanged,loadRecords,clearSession,connect};})();'), context);
  const api = context.testApp;
  api.state.supported = true;
  api.state.session = { sessionId: 'test-session' };
  api.state.activeTab = 'records';
  api.state.records = [record('existing')];
  api.state.recordsPages = 1;
  async function flush() { for (let i = 0; i < 8; i += 1) await Promise.resolve(); }
  async function advance(ms) {
    const end = now + ms;
    for (;;) {
      const next = [...timers.entries()].filter(([, value]) => value.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].callback(); await flush();
    }
    now = end; await flush();
  }
  return { ...api, requests, timers, document, sdk, advance, flush,
    visibility(hidden) { document.hidden = hidden; documentEvents.get('visibilitychange')(); },
  };
}

function record(id) { return { id, routeId: 'provider', status: 'completed', startedAtMs: 1, model: 'test-model' }; }
function finish(request, id) { request.resolve({ records: [record(id)], nextCursor: null }); }

test('a continuous event stream refreshes before traffic stops and never overlaps automatic reads', async () => {
  const app = harness();
  for (let i = 0; i < 8; i += 1) { app.recordSummaryChanged(); await app.advance(50); }
  assert.equal(app.requests.length, 1, 'continuous traffic must not postpone every refresh');
  for (let i = 0; i < 20; i += 1) { app.recordSummaryChanged(); await app.advance(50); }
  assert.equal(app.requests.length, 1, 'slow requests must not accumulate parallel reads');
  finish(app.requests[0], 'first'); await app.flush();
  assert.equal(app.state.records[0].id, 'first', 'in-flight events must not invalidate a valid response');
  assert.equal(app.state.recordsUpdated, true);
  await app.advance(250);
  assert.equal(app.requests.length, 2, 'events during a read need one trailing refresh');
  finish(app.requests[1], 'latest'); await app.flush();
  await app.advance(10000);
  assert.equal(app.requests.length, 2, 'an idle record list must not poll');
  assert.equal(app.state.recordsUpdated, false);
});

test('hidden views stop automatic work and returning to records refreshes existing content', async () => {
  const app = harness();
  app.recordSummaryChanged(); app.showTab('gateway');
  await app.advance(10000); assert.equal(app.requests.length, 0);
  app.showTab('records'); await app.advance(250);
  assert.equal(app.requests.length, 1, 'returning to an already populated tab must refresh stale rows');
  app.visibility(true); finish(app.requests[0], 'hidden-result'); await app.flush();
  assert.equal(app.state.records[0].id, 'existing', 'hidden automatic results must not rebuild the table');
  app.recordSummaryChanged(); await app.advance(10000); assert.equal(app.requests.length, 1);
  app.visibility(false); await app.advance(250); assert.equal(app.requests.length, 2);
  finish(app.requests[1], 'visible-result'); await app.flush();
  assert.equal(app.state.records[0].id, 'visible-result');
});

test('automatic refresh protects selection, detail and pagination both before and during requests', async () => {
  for (const protect of [app => app.state.selection.add('existing'), app => app.state.detail = record('existing'), app => app.state.recordsPages = 2]) {
    const blocked = harness(); protect(blocked); blocked.recordSummaryChanged(); await blocked.advance(1000);
    assert.equal(blocked.requests.length, 0);
    const pending = harness(); pending.recordSummaryChanged(); await pending.advance(250); protect(pending);
    finish(pending.requests[0], 'replacement'); await pending.flush();
    assert.equal(pending.state.records[0].id, 'existing');
    assert.equal(pending.state.recordsUpdated, true);
    await pending.advance(1000); assert.equal(pending.requests.length, 1);
  }
});

test('a manual read absorbs concurrent events without automatic request races', async () => {
  const app = harness(), read = app.loadRecords(false);
  for (let i = 0; i < 10; i += 1) { app.recordSummaryChanged(); await app.advance(50); }
  assert.equal(app.requests.length, 1);
  finish(app.requests[0], 'manual-result'); await read;
  await app.advance(250); assert.equal(app.requests.length, 2);
  finish(app.requests[1], 'after-manual'); await app.flush();
  assert.equal(app.state.records[0].id, 'after-manual');
});

test('an older automatic response cannot swallow updates queued during a newer manual read', async () => {
  const app = harness(); app.recordSummaryChanged(); await app.advance(250);
  const manual = app.loadRecords(false);
  app.recordSummaryChanged();
  finish(app.requests[1], 'manual-result'); await manual;
  assert.equal(app.state.records[0].id, 'manual-result');
  finish(app.requests[0], 'stale-automatic-result'); await app.flush();
  assert.equal(app.state.records[0].id, 'manual-result', 'the older response must not overwrite newer rows');
  await app.advance(250);
  assert.equal(app.requests.length, 3, 'the last pending response must release the queued refresh');
  finish(app.requests[2], 'latest'); await app.flush();
  assert.equal(app.state.records[0].id, 'latest');
  assert.equal(app.state.recordsUpdated, false);
});

test('a failed automatic read does not create an idle retry loop', async () => {
  const app = harness(); app.recordSummaryChanged(); await app.advance(250);
  app.requests[0].reject(new Error('temporary')); await app.flush();
  await app.advance(10000); assert.equal(app.requests.length, 1);
  app.recordSummaryChanged(); await app.advance(250); assert.equal(app.requests.length, 2);
  finish(app.requests[1], 'retry'); await app.flush();
});

test('an older failed automatic read releases updates queued during a newer manual read', async () => {
  const app = harness(); app.recordSummaryChanged(); await app.advance(250);
  const manual = app.loadRecords(false);
  app.recordSummaryChanged();
  finish(app.requests[1], 'manual-result'); await manual;
  assert.equal(app.state.records[0].id, 'manual-result');
  assert.equal(app.state.recordsUpdated, true);
  app.requests[0].reject(new Error('obsolete automatic read failed')); await app.flush();
  assert.equal(app.state.recordsLoads.size, 0);
  await app.advance(250);
  assert.equal(app.requests.length, 3, 'a stale failure must release the queued refresh');
  finish(app.requests[2], 'latest'); await app.flush();
  assert.equal(app.state.records[0].id, 'latest');
  assert.equal(app.state.recordsUpdated, false);
  await app.advance(10000);
  assert.equal(app.requests.length, 3, 'a completed update must return to idle');
});

test('clearing a session withdraws rows and makes its pending response inert', async () => {
  const app = harness(); app.recordSummaryChanged(); await app.advance(250);
  app.clearSession();
  finish(app.requests[0], 'old-session'); await app.flush(); await app.advance(10000);
  assert.equal(app.state.records.length, 0); assert.equal(app.requests.length, 1);
  assert.equal(app.state.recordsLoads.size, 0); assert.equal(app.timers.size, 0);
});

test('a delayed connection status cannot restore state after the session was cleared', async () => {
  const app = harness();
  app.state.local = { configured: true };
  app.sdk.gateway.connect = async () => ({ sessionId: 'next-session', instanceId: 'instance' });
  app.sdk.gateway.disconnect = async () => {};
  let finishStatus;
  app.sdk.gateway.status = () => new Promise(resolve => { finishStatus = resolve; });
  const connecting = app.connect(); await app.flush();
  assert.equal(typeof finishStatus, 'function');
  app.clearSession();
  finishStatus({ pairings: [{ instanceId: 'instance', listening: true, activeRequests: 2 }] });
  await assert.rejects(connecting, error => error.stale === true);
  assert.equal(app.state.session, null); assert.equal(app.state.listener, null);
  assert.equal(app.requests.length, 0);
});

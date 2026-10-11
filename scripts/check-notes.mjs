import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setImmediate} from 'node:timers/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../plugins/extension.lumi.notes/app.js', import.meta.url), 'utf8');
const settle = () => setImmediate();

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

function fixture() {
  const ready = deferred(), read = deferred(), writes = [];
  let activeWrites = 0, maxActiveWrites = 0, onContext;
  const elements = Object.fromEntries(['note', 'status', 'save', 'description'].map(id => {
    const listeners = new Map();
    return [id, {value: '', textContent: '', disabled: false,
      addEventListener: (name, callback) => listeners.set(name, callback),
      dispatch: name => listeners.get(name)?.()}];
  }));
  const document = {documentElement: {dataset: {}}, getElementById: id => elements[id]};
  const sdk = {
    ready: ready.promise,
    onContext: callback => { onContext = callback; return () => {}; },
    storage: {
      read: key => { assert.equal(key, 'note'); return read.promise; },
      write: (key, value) => {
        assert.equal(key, 'note');
        const operation = deferred();
        activeWrites++;
        maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
        writes.push({value, ...operation});
        return operation.promise.finally(() => { activeWrites--; });
      }
    }
  };
  vm.runInNewContext(source, {window: {lumiExtension: sdk}, document});
  return {
    ...elements, ready, read, writes, document,
    get maxActiveWrites() { return maxActiveWrites; },
    input(value) { elements.note.value = value; elements.note.dispatch('input'); },
    click() { if (!elements.save.disabled) elements.save.dispatch('click'); },
    context(value) { onContext(value); },
    async load(value = '原便笺') {
      ready.resolve({context: {theme: 'light'}, view: {slot: 'workbench'}});
      read.resolve(value);
      await settle();
    }
  };
}

test('delayed initial read preserves edits and prevents saving before loading', async () => {
  const f = fixture();
  assert.equal(f.save.disabled, true);
  f.ready.resolve({context: {theme: 'light'}, view: {slot: 'workbench'}});
  await settle();
  f.input('刚输入的新便笺');
  f.click();
  assert.equal(f.writes.length, 0);
  f.read.resolve('旧便笺');
  await settle();
  assert.equal(f.note.value, '刚输入的新便笺');
  assert.equal(f.status.textContent, '未保存');
  assert.equal(f.save.disabled, false);
});

test('untouched initial values load, including empty storage, and context updates remain active', async () => {
  for (const value of [null, '', '保存的便笺']) {
    const f = fixture();
    await f.load(value);
    assert.equal(f.note.value, value ?? '');
    assert.equal(f.status.textContent, '已保存');
    assert.equal(f.document.documentElement.dataset.theme, 'light');
    f.context({theme: 'dark'});
    assert.equal(f.document.documentElement.dataset.theme, 'dark');
    f.click();
    assert.equal(f.writes[0].value, value ?? '');
    f.writes[0].resolve();
    await settle();
  }
});

test('repeated saves are serial and coalesce to the latest requested text', async () => {
  const f = fixture();
  await f.load();
  f.input('第一稿');
  f.click();
  for (let index = 0; index < 30; index++) {
    f.input('稿件 ' + index);
    f.click();
  }
  assert.deepEqual(f.writes.map(write => write.value), ['第一稿']);
  assert.equal(f.status.textContent, '正在保存…');
  f.writes[0].resolve();
  await settle();
  assert.deepEqual(f.writes.map(write => write.value), ['第一稿', '稿件 29']);
  assert.equal(f.maxActiveWrites, 1);
  f.writes[1].resolve();
  await settle();
  assert.equal(f.status.textContent, '已保存');
});

test('duplicate clicks do not write twice and unsaved edits are never reported as saved', async () => {
  const f = fixture();
  await f.load();
  f.input('请求保存的文本');
  f.click();
  f.click();
  f.input('未请求保存的新文本');
  f.writes[0].resolve();
  await settle();
  assert.equal(f.writes.length, 1);
  assert.equal(f.note.value, '未请求保存的新文本');
  assert.equal(f.status.textContent, '未保存');
  f.click();
  f.writes[1].resolve();
  await settle();
  assert.equal(f.status.textContent, '已保存');
  f.input('保存后又修改');
  assert.equal(f.status.textContent, '未保存');
});

test('a new explicit save persists unchanged text again for shared views', async () => {
  const f = fixture();
  await f.load('相同文本');
  f.click();
  f.writes[0].resolve();
  await settle();
  // A sibling view may write a different value between these two clicks.
  f.click();
  assert.equal(f.writes.length, 2);
  assert.equal(f.writes[1].value, '相同文本');
  f.writes[1].resolve();
  await settle();
  assert.equal(f.status.textContent, '已保存');
});

test('failed writes preserve text and can be retried', async () => {
  const f = fixture();
  await f.load();
  f.input('不能丢失的便笺');
  f.click();
  f.writes[0].reject(new Error('磁盘不可用'));
  await settle();
  assert.equal(f.note.value, '不能丢失的便笺');
  assert.equal(f.status.textContent, '保存失败：磁盘不可用');
  f.click();
  f.writes[1].resolve();
  await settle();
  assert.equal(f.status.textContent, '已保存');
});

test('a queued newer save can succeed after an earlier write fails', async () => {
  const f = fixture();
  await f.load();
  f.input('旧稿');
  f.click();
  f.input('新稿');
  f.click();
  f.writes[0].reject(new Error('暂时不可用'));
  await settle();
  assert.equal(f.writes[1].value, '新稿');
  f.writes[1].resolve();
  await settle();
  assert.equal(f.status.textContent, '已保存');
  assert.equal(f.maxActiveWrites, 1);
});

test('read failures retain edits and allow an explicit save after initialization', async () => {
  const f = fixture();
  f.ready.resolve({context: {theme: 'light'}, view: {slot: 'workbench'}});
  await settle();
  f.input('加载失败时输入的文本');
  f.read.reject(new Error('读取不可用'));
  await settle();
  assert.equal(f.note.value, '加载失败时输入的文本');
  assert.equal(f.status.textContent, '读取失败：读取不可用');
  f.click();
  f.writes[0].resolve();
  await settle();
  assert.equal(f.status.textContent, '已保存');
});

test('SDK initialization failures keep saving disabled and retain the error', async () => {
  const f = fixture();
  f.ready.reject(new Error('插件已停用'));
  await settle();
  f.input('保留输入');
  f.click();
  assert.equal(f.note.value, '保留输入');
  assert.equal(f.save.disabled, true);
  assert.equal(f.status.textContent, '加载失败：插件已停用');
  assert.equal(f.writes.length, 0);
});

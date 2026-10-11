const sdk = window.lumiExtension;
const note = document.getElementById('note');
const status = document.getElementById('status');
const save = document.getElementById('save');
let edited = false, loaded = false, saving = false;
let savedValue, pendingSave = null, errorMessage = '';

function theme(context) { document.documentElement.dataset.theme = context.theme; }
function message(error) { return error?.message || '请稍后重试。'; }
function renderStatus() {
  status.textContent = saving ? '正在保存…' : errorMessage || (!loaded ? '正在加载…' : note.value === savedValue ? '已保存' : '未保存');
}

save.disabled = true;
renderStatus();
note.addEventListener('input', () => {
  edited = true;
  if (loaded) errorMessage = '';
  renderStatus();
});

sdk.ready.then(async ({context, view}) => {
  theme(context);
  sdk.onContext(theme);
  if (view.slot === 'connection') document.getElementById('description').textContent = '使用 Lumi 提供的独立本机存储，无需站点或密钥。';
  try {
    const value = await sdk.storage.read('note');
    if (value !== null && typeof value !== 'string') throw new Error('便笺数据格式无效。');
    savedValue = value ?? '';
    // A delayed read must not replace text entered while the plugin was opening.
    if (!edited) note.value = savedValue;
  } catch (error) {
    errorMessage = '读取失败：' + message(error);
  }
  loaded = true;
  save.disabled = false;
  renderStatus();
}).catch(error => {
  errorMessage = '加载失败：' + message(error);
  renderStatus();
});

async function savePending() {
  let completedValue;
  saving = true;
  renderStatus();
  while (pendingSave !== null) {
    const value = pendingSave;
    pendingSave = null;
    try {
      // Deduplicate this batch only: another view may have changed shared storage.
      if (value !== completedValue) {
        await sdk.storage.write('note', value);
        savedValue = value;
        completedValue = value;
      }
      errorMessage = '';
    } catch (error) {
      errorMessage = '保存失败：' + message(error);
    }
  }
  saving = false;
  renderStatus();
}

save.addEventListener('click', () => {
  if (!loaded) return;
  // Keep only the latest explicitly requested snapshot while a write is pending.
  pendingSave = note.value;
  errorMessage = '';
  if (!saving) void savePending();
});

import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {root, host, run, requireHost} from './host.mjs';

requireHost();
const input = process.argv[2];
const packages = input ? [path.resolve(root, input)] : readdirSync(path.join(root, 'plugins'), {withFileTypes: true})
  .filter(entry => entry.isDirectory()).map(entry => path.join(root, 'plugins', entry.name));
if (!packages.length) throw new Error('未找到插件包。');
const ids = new Set();
for (const directory of packages) {
  const manifest = JSON.parse(readFileSync(path.join(directory, 'plugin.json'), 'utf8'));
  if (path.basename(directory) !== manifest.id) throw new Error('插件目录名称必须与清单 ID 一致。');
  if (ids.has(manifest.id)) throw new Error(`插件 ID 重复：${manifest.id}`);
  ids.add(manifest.id);
  run(process.execPath, [path.join(host, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(host, 'scripts', 'check-extensions.mjs'), directory], host);
}

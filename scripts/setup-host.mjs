import {existsSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {root, host, config, run, requireHost} from './host.mjs';

if (!/^[a-f0-9]{40}$/.test(config.ref)) throw new Error('host.json 必须固定完整提交 SHA。');
if (!existsSync(path.join(host, '.git'))) {
  mkdirSync(host, {recursive: true});
  run('git', ['init', host]);
  run('git', ['remote', 'add', 'origin', config.repository], host);
}
run('git', ['fetch', '--depth=1', 'origin', config.ref], host);
run('git', ['checkout', '--detach', config.ref], host);
requireHost();
if (!process.env.npm_execpath) throw new Error('请通过 npm run setup:host 运行。');
run(process.execPath, [process.env.npm_execpath, 'ci', '--ignore-scripts', '--cache', path.join(root, '.cache', 'npm')], host);
console.log(`已准备 Lumi ${config.release} 的官方插件校验器。`);

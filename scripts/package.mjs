import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {root, run} from './host.mjs';

const id = process.argv[2];
if (!id || !/^extension\.[a-z][a-z0-9-]{0,39}\.[a-z][a-z0-9-]{0,39}$/.test(id)) {
  throw new Error('用法：npm run package -- extension.author.name');
}
const changes = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {cwd: root, encoding: 'utf8'});
if (changes.trim()) throw new Error('请先提交修改，发布包必须来自干净的 Git 提交。');
const directory = path.join(root, 'plugins', id);
run(process.execPath, [path.join(root, 'scripts', 'check.mjs'), directory]);
const manifest = JSON.parse(readFileSync(path.join(directory, 'plugin.json'), 'utf8'));
const tag = `${id}-v${manifest.version}`;
if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== tag) {
  throw new Error(`发布标签必须与清单匹配：${tag}`);
}
const output = path.join(root, 'release');
mkdirSync(output, {recursive: true});
const name = `${tag}.zip`;
const file = path.join(output, name);
run('git', ['archive', '--format=zip', `--prefix=${id}/`, `--output=${file}`, `HEAD:plugins/${id}`]);
const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
writeFileSync(path.join(output, `${tag}.sha256`), `${hash}  ${name}\n`);
console.log(`发布包：${file}`);

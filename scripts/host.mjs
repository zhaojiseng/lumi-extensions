import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const host = path.join(root, '.cache', 'lumi-host');
export const config = JSON.parse(readFileSync(path.join(root, 'host.json'), 'utf8'));

export function run(command, args, cwd = root) {
  execFileSync(command, args, {cwd, stdio: 'inherit'});
}

export function requireHost() {
  const actual = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: host, encoding: 'utf8'}).trim();
  if (actual !== config.ref) throw new Error('宿主校验器版本不匹配，请运行 npm run setup:host。');
}

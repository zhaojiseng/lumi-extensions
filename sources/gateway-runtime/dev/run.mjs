import {startEngine} from './engine.mjs';
import {createGateway} from './transport.mjs';
import path from 'node:path';

const dataDir = process.argv[2];
if (!dataDir || process.argv.length !== 3 || !path.isAbsolute(dataDir)) throw new Error('用法：node dev/run.mjs <独立数据目录绝对路径>');
const engine = await startEngine({dataDir});
let gateway;
try {
  gateway = await createGateway({config: engine.bootstrap.config, routeSecrets: engine.bootstrap.routeSecrets, engine});
  // Never print any key or RPC payload.
  console.log('本地开发网关已监听：' + gateway.address);
  console.log('service_tier 在实际请求 JSON 中改写；正文录制状态：' + (engine.bootstrap.config.recording.bodies ? '已启用加密录制' : '仅元数据'));
} catch {
  await engine.close();
  throw new Error('本地网关启动失败；请检查配置、端口与系统安全存储');
}
let warnedFailures = 0;
const recordingHealth = setInterval(() => {
  if (gateway.metrics.recordingFailures > warnedFailures) {
    warnedFailures = gateway.metrics.recordingFailures;
    console.error('本地录制不完整：记录存储或核心连接发生故障，请检查网关。累计失败：' + warnedFailures);
  }
}, 1000);
recordingHealth.unref();
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(recordingHealth);
  await gateway.stop();
  if (gateway.metrics.recordingFailures > 0) console.error('退出时检测到录制失败：' + gateway.metrics.recordingFailures);
  await engine.close();
}
process.once('SIGINT', () => { stop().catch(() => { process.exitCode = 1; }); });
process.once('SIGTERM', () => { stop().catch(() => { process.exitCode = 1; }); });

// Headless test driver (Chrome DevTools Protocol). Always muted.
//   node tools/shoot.mjs steps.json
// steps: {evalFile:path,print} {device:[w,h,dpr,mobile]} {nav:url,wait} {eval:js,print} {key:code} {click:[x,y]} {sleep:ms} {shot:path}
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
const [, , stepsFile] = process.argv;
const steps = JSON.parse(readFileSync(stepsFile, 'utf8'));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn('chromium', ['--headless=new', '--mute-audio', `--remote-debugging-port=${port}`, '--window-size=1440,900',
  '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required', '--no-first-run', `--user-data-dir=/tmp/claude-1000/cdp-prof-${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find((t) => t.type === 'page')) break; } catch {} await sleep(200); }
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.type + ': ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
  if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
for (const s of steps) {
  if (s.device) { const [width, height, deviceScaleFactor = 1, mobile = false] = s.device; await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile }); if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true }); }
  if (s.nav) { await send('Page.navigate', { url: s.nav }); await sleep(s.wait ?? 1500); }
  if (s.evalFile) s.eval = readFileSync(s.evalFile, 'utf8');
  if (s.eval) { const r = await send('Runtime.evaluate', { expression: s.eval, awaitPromise: true, returnByValue: true }); const v = r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description; if (s.print) console.log('EVAL>', typeof v === 'string' ? v : JSON.stringify(v)); }
  if (s.key) { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, code: s.key, key: s.keyName || s.key }); }
  if (s.click) { for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: s.click[0], y: s.click[1], button: 'left', clickCount: 1 }); }
  if (s.sleep) await sleep(s.sleep);
  if (s.shot) { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(s.shot, Buffer.from(r.result.data, 'base64')); console.log('shot', s.shot); }
}
console.log('--- console ---\n' + logs.join('\n'));
ws.close(); chrome.kill();

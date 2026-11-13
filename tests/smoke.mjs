/* PF Calculator BD - headless-Chrome smoke tests via raw CDP (no deps).
   Run: node tests/smoke.mjs [width]   (default 1280; pass 390 for mobile)
   Uses the Playwright-cached headless_shell. Serves the app over file:// */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHELL = path.join(process.env.HOME, '.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell');
const WIDTH = parseInt(process.argv[2] || '1280', 10);
const HEIGHT = 900;
const PORT = 9337;

let failures = [];
let checks = 0;
function check(name, cond, extra = '') {
  checks++;
  if (cond) console.log('  PASS ' + name);
  else { failures.push(name + (extra ? ' — ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

const chrome = spawn(SHELL, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${PORT}`, `--window-size=${WIDTH},${HEIGHT}`,
  'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await res.json();
      return j.webSocketDebuggerUrl;
    } catch { await sleep(250); }
  }
  throw new Error('CDP did not start');
}

async function main() {
  const browserWs = new WebSocket(await getWsUrl());
  await new Promise((res, rej) => { browserWs.onopen = res; browserWs.onerror = rej; });
  let msgId = 0;
  const pending = new Map();
  const events = [];
  browserWs.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) events.push(m);
  };
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++msgId;
    pending.set(id, res);
    browserWs.send(JSON.stringify({ id, method, params }));
  });

  const target = await send('Target.createTarget', { url: 'about:blank' });
  const targetId = target.result.targetId;
  const attached = await send('Target.attachToTarget', { targetId, flatten: true });
  const sessionId = attached.result.sessionId;
  const sendS = (method, params = {}) => new Promise((res) => {
    const id = ++msgId;
    pending.set(id, res);
    browserWs.send(JSON.stringify({ id, sessionId, method, params }));
  });

  await sendS('Runtime.enable');
  await sendS('Page.enable');
  await sendS('Network.enable');
  await sendS('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: WIDTH <= 500 });

  const consoleErrors = [];
  const pageErrors = [];
  const extRequests = [];
  const origOnMessage = browserWs.onmessage;
  browserWs.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.sessionId === sessionId && m.method === 'Runtime.exceptionThrown') {
      pageErrors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
    }
    if (m.sessionId === sessionId && m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(m.params.args.map((a) => a.value || a.description || '').join(' '));
    }
    if (m.sessionId === sessionId && m.method === 'Network.requestWillBeSent') {
      const url = m.params.request.url;
      if (!url.startsWith('file://') && !url.startsWith('data:') && !url.startsWith('blob:') && !url.startsWith('chrome')) {
        extRequests.push(url);
      }
    }
    origOnMessage(ev);
  };

  const evalJs = async (expr) => {
    const r = await sendS('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  };

  const fileUrl = 'file://' + path.join(ROOT, 'index.html');
  await sendS('Page.navigate', { url: fileUrl });
  await sleep(1200);

  console.log(`== smoke @ ${WIDTH}px ==`);

  const setNum = async (id, val) => {
    await evalJs(`(function(){ const el = document.getElementById('${id}'); el.value = '${val}'; el.dispatchEvent(new Event('input')); })()`);
  };
  const txt = async (id) => await evalJs(`document.getElementById('${id}').textContent`);

  check('page title', (await evalJs('document.title')).includes('PF Calculator BD'));
  check('h1 text is PF Calculator BD', (await evalJs(`document.querySelector('h1').textContent`)) === 'PF Calculator BD');
  check('3 tabs present', (await evalJs(`document.querySelectorAll('.tab-btn').length`)) === 3);
  check('calc tab visible, others hidden', (await evalJs(`!document.getElementById('tab-calc').hidden && document.getElementById('tab-scenarios').hidden && document.getElementById('tab-guide').hidden`)) === true);
  check('no horizontal overflow', (await evalJs('document.documentElement.scrollWidth')) <= WIDTH + 1,
    'scrollWidth=' + (await evalJs('document.documentElement.scrollWidth')));

  // --- defaults auto-calculate on load ---
  check('results visible on load', (await evalJs(`!document.getElementById('results').hidden`)) === true);
  check('default maturity 2,303,705.46', (await txt('res-maturity')) === '৳2,303,705.46', await txt('res-maturity'));
  check('default employee total 754,673.64', (await txt('res-emp')) === '৳754,673.64', await txt('res-emp'));
  check('default interest 794,358.18', (await txt('res-interest')) === '৳794,358.18', await txt('res-interest'));
  check('default monthly 10,000.00', (await txt('res-monthly')) === '৳10,000.00', await txt('res-monthly'));
  check('schedule has 10 rows', (await evalJs(`document.querySelectorAll('#schedule-body tr').length`)) === 10);
  check('compare-with matches maturity', (await txt('cmp-with')) === '৳2,303,705.46');
  check('compare-without 1,151,852.69', (await txt('cmp-without')) === '৳1,151,852.69', await txt('cmp-without'));
  check('compare diff 1,151,852.77', (await txt('cmp-diff')) === '৳1,151,852.77', await txt('cmp-diff'));

  // --- zero-rate 1-year case: exact hand-computed values ---
  await setNum('basic', '10000');
  await setNum('empPct', '10');
  await setNum('erPct', '10');
  await setNum('ratePct', '0');
  await setNum('years', '1');
  await setNum('incrementPct', '0');
  await setNum('opening', '0');
  await evalJs(`document.getElementById('btn-calc').click()`);
  await sleep(200);
  check('zero-rate maturity 24,000.00', (await txt('res-maturity')) === '৳24,000.00', await txt('res-maturity'));
  check('zero-rate interest 0.00', (await txt('res-interest')) === '৳0.00', await txt('res-interest'));
  check('zero-rate schedule 1 row', (await evalJs(`document.querySelectorAll('#schedule-body tr').length`)) === 1);
  check('zero-rate compare-without 12,000.00', (await txt('cmp-without')) === '৳12,000.00', await txt('cmp-without'));
  check('zero-rate compare diff 12,000.00', (await txt('cmp-diff')) === '৳12,000.00', await txt('cmp-diff'));

  // --- validation: years = 0 ---
  await setNum('years', '0');
  await evalJs(`document.getElementById('btn-calc').click()`);
  await sleep(200);
  check('invalid years shows error', (await txt('err-years')).length > 0, await txt('err-years'));
  check('results hidden on invalid input', (await evalJs(`document.getElementById('results').hidden`)) === true);
  check('empty state shows on invalid input', (await evalJs(`!document.getElementById('empty-results').hidden`)) === true);
  await setNum('years', '10');
  await setNum('ratePct', '8.5');
  await evalJs(`document.getElementById('btn-calc').click()`);
  await sleep(200);
  check('results return after fixing input', (await evalJs(`!document.getElementById('results').hidden`)) === true);

  // --- preset button ---
  await evalJs(`document.querySelector('[data-preset="12/12"]').click()`);
  await sleep(200);
  check('preset 12/12 sets empPct', (await evalJs(`document.getElementById('empPct').value`)) === '12');
  check('preset 12/12 sets erPct', (await evalJs(`document.getElementById('erPct').value`)) === '12');
  check('preset recalculates maturity', (await txt('res-maturity')) !== '৳24,000.00', await txt('res-maturity'));

  // --- reset ---
  await evalJs(`document.getElementById('btn-reset').click()`);
  await sleep(200);
  check('reset restores basic 50000', (await evalJs(`document.getElementById('basic').value`)) === '50000');
  check('reset hides results', (await evalJs(`document.getElementById('results').hidden`)) === true);
  await evalJs(`document.getElementById('btn-calc').click()`);
  await sleep(200);

  // --- scenarios: save, load, erase ---
  await evalJs(`document.querySelector('[data-tab="scenarios"]').click()`);
  await sleep(200);
  check('scenarios tab shows', (await evalJs(`!document.getElementById('tab-scenarios').hidden`)) === true);
  check('empty scenarios message shows', (await evalJs(`!document.getElementById('empty-scenarios').hidden`)) === true);
  await evalJs(`(function(){ const el = document.getElementById('scenario-name'); el.value = 'Test PF'; })()`);
  await evalJs(`document.getElementById('btn-save-scenario').click()`);
  await sleep(200);
  check('scenario card appears', (await evalJs(`document.querySelectorAll('.scenario-card').length`)) === 1);
  check('scenario card names Test PF', (await evalJs(`document.querySelector('.scenario-card strong').textContent`)) === 'Test PF');
  check('scenario persisted in localStorage', (await evalJs(`JSON.parse(localStorage.getItem('pfcalc.scenarios')).length`)) === 1);
  // erase: wrong confirm first
  await evalJs(`(function(){ document.getElementById('erase-confirm').value = 'delete'; })()`);
  await evalJs(`document.getElementById('btn-erase').click()`);
  await sleep(200);
  check('wrong erase confirm keeps scenario', (await evalJs(`document.querySelectorAll('.scenario-card').length`)) === 1);
  await evalJs(`(function(){ document.getElementById('erase-confirm').value = 'DELETE'; })()`);
  await evalJs(`document.getElementById('btn-erase').click()`);
  await sleep(200);
  check('DELETE erases all scenarios', (await evalJs(`document.querySelectorAll('.scenario-card').length`)) === 0);
  check('erase message shows', (await txt('scenario-msg')).length > 0, await txt('scenario-msg'));

  // --- guide tab ---
  await evalJs(`document.querySelector('[data-tab="guide"]').click()`);
  await sleep(200);
  check('guide tab shows', (await evalJs(`!document.getElementById('tab-guide').hidden`)) === true);
  check('guide mentions Provident Fund', (await evalJs(`document.getElementById('tab-guide').textContent`)).includes('Provident Fund'));

  // --- language toggle to Bangla ---
  await evalJs(`document.querySelector('[data-tab="calc"]').click()`);
  await sleep(150);
  await evalJs(`document.getElementById('lang-toggle').click()`);
  await sleep(300);
  check('h1 becomes Bangla', (await evalJs(`document.querySelector('h1').textContent`)) === 'পিএফ ক্যালকুলেটর বিডি');
  check('maturity shows Bengali digits', /[০-৯]/.test(await txt('res-maturity')), await txt('res-maturity'));
  check('lang persisted as bn', (await evalJs(`localStorage.getItem('pfcalc.lang')`)) === 'bn');
  await evalJs(`document.getElementById('lang-toggle').click()`);
  await sleep(300);
  check('toggle back to English', (await evalJs(`document.querySelector('h1').textContent`)) === 'PF Calculator BD');

  // --- console / network hygiene ---
  await sleep(400);
  check('zero page errors', pageErrors.length === 0, pageErrors.join(' | '));
  check('zero console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
  check('zero non-file network requests', extRequests.length === 0, extRequests.join(', '));

  console.log(`\n== ${checks - failures.length}/${checks} passed @ ${WIDTH}px ==`);
  if (failures.length) console.log('FAILURES:\n- ' + failures.join('\n- '));
  chrome.kill();
  browserWs.close();
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });

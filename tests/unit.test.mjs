/* PF Calculator BD - unit tests (Node, no DOM).
   Run: node --test tests/unit.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const logic = require(path.join(ROOT, 'js', 'logic.js'));
const { I18N } = require(path.join(ROOT, 'js', 'i18n.js'));

const {
  LIMITS, round2, validateInputs, defaults, projectPF, projectEmployeeOnly,
  formatTaka, formatTakaBn, toBnDigits, validateScenarioList,
} = logic;

const near = (a, b, tol = 0.1) => Math.abs(a - b) <= tol;

test('defaults are sane and valid', () => {
  const d = defaults();
  assert.equal(d.basic, 50000);
  assert.equal(d.empPct, 10);
  assert.equal(d.erPct, 10);
  assert.equal(d.ratePct, 8.5);
  assert.equal(d.years, 10);
  assert.equal(d.incrementPct, 5);
  assert.equal(d.opening, 0);
  assert.equal(validateInputs(d).ok, true);
});

test('zero rate, 1 year: exact hand-computed totals', () => {
  const r = projectPF({ basic: 10000, empPct: 10, erPct: 10, ratePct: 0, years: 1, incrementPct: 0, opening: 0 });
  assert.equal(r.maturity, 24000);
  assert.equal(r.empTotal, 12000);
  assert.equal(r.erTotal, 12000);
  assert.equal(r.interestTotal, 0);
  assert.equal(r.contribTotal, 24000);
  assert.equal(r.monthlyFirst, 2000);
  assert.equal(r.years.length, 1);
  assert.deepEqual(r.years[0], { year: 1, opening: 0, emp: 12000, er: 12000, interest: 0, closing: 24000 });
});

test('12% rate, 1 year, employee-only: geometric-series value', () => {
  // Monthly 1000, 1%/mo: 1000 * sum_{k=1..12} 1.01^k = 12809.33
  const r = projectPF({ basic: 10000, empPct: 10, erPct: 0, ratePct: 12, years: 1, incrementPct: 0, opening: 0 });
  assert.ok(near(r.maturity, 12809.33), `maturity ${r.maturity} != 12809.33`);
  assert.equal(r.empTotal, 12000);
  assert.equal(r.erTotal, 0);
  assert.ok(near(r.interestTotal, 809.33), `interest ${r.interestTotal} != 809.33`);
  assert.equal(r.years[0].closing, r.maturity);
});

test('salary increment applies from year 2', () => {
  const r = projectPF({ basic: 10000, empPct: 10, erPct: 10, ratePct: 0, years: 2, incrementPct: 10, opening: 0 });
  assert.equal(r.maturity, 50400); // 24000 + 26400
  assert.equal(r.years[0].closing, 24000);
  assert.equal(r.years[1].opening, 24000);
  assert.equal(r.years[1].emp, 13200);
  assert.equal(r.years[1].er, 13200);
  assert.equal(r.years[1].closing, 50400);
});

test('opening balance carries through untouched at 0% rate', () => {
  const r = projectPF({ basic: 10000, empPct: 0, erPct: 0, ratePct: 0, years: 1, incrementPct: 0, opening: 12000 });
  assert.equal(r.maturity, 12000);
  assert.equal(r.years[0].opening, 12000);
});

test('opening balance earns interest', () => {
  // 12000 at 12%/yr, no contributions: 12000 * 1.01^12 = 13521.90
  const r = projectPF({ basic: 10000, empPct: 0, erPct: 0, ratePct: 12, years: 1, incrementPct: 0, opening: 12000 });
  assert.ok(near(r.maturity, 13521.9), `maturity ${r.maturity} != 13521.90`);
});

test('employee-only projection drops the employer share', () => {
  const full = projectPF({ basic: 20000, empPct: 10, erPct: 10, ratePct: 8, years: 5, incrementPct: 0, opening: 0 });
  const only = projectEmployeeOnly({ basic: 20000, empPct: 10, erPct: 10, ratePct: 8, years: 5, incrementPct: 0, opening: 0 });
  assert.equal(only.erTotal, 0);
  assert.ok(only.maturity < full.maturity);
  assert.ok(near(only.empTotal, full.empTotal));
  // Employee-only with 0% rate is exactly half of the matched total.
  const f0 = projectPF({ basic: 20000, empPct: 10, erPct: 10, ratePct: 0, years: 5, incrementPct: 0, opening: 0 });
  const o0 = projectEmployeeOnly({ basic: 20000, empPct: 10, erPct: 10, ratePct: 0, years: 5, incrementPct: 0, opening: 0 });
  assert.equal(o0.maturity, f0.maturity / 2);
});

test('year rows sum to the totals', () => {
  const r = projectPF({ basic: 33333, empPct: 12, erPct: 8, ratePct: 7.25, years: 7, incrementPct: 6, opening: 50000 });
  const sum = (k) => r.years.reduce((a, y) => a + y[k], 0);
  assert.ok(near(sum('emp'), r.empTotal));
  assert.ok(near(sum('er'), r.erTotal));
  assert.ok(near(sum('interest'), r.interestTotal));
  assert.equal(r.years[r.years.length - 1].closing, r.maturity);
  for (let i = 1; i < r.years.length; i++) {
    assert.equal(r.years[i].opening, r.years[i - 1].closing);
  }
});

test('maturity grows with rate and with years', () => {
  const base = { basic: 40000, empPct: 10, erPct: 10, ratePct: 0, years: 10, incrementPct: 0, opening: 0 };
  const withRate = projectPF({ ...base, ratePct: 9 });
  const longer = projectPF({ ...base, years: 20 });
  assert.ok(withRate.maturity > projectPF(base).maturity);
  assert.ok(longer.maturity > projectPF(base).maturity);
});

test('validation rejects out-of-range and non-integer values', () => {
  const good = defaults();
  assert.equal(validateInputs(good).ok, true);
  const bad = (patch) => validateInputs({ ...good, ...patch });
  assert.equal(bad({ basic: 0 }).ok, false);
  assert.equal(bad({ basic: -100 }).ok, false);
  assert.equal(bad({ basic: 10000001 }).ok, false);
  assert.equal(bad({ basic: NaN }).ok, false);
  assert.equal(bad({ empPct: 51 }).ok, false);
  assert.equal(bad({ erPct: -1 }).ok, false);
  assert.equal(bad({ ratePct: 25.01 }).ok, false);
  assert.equal(bad({ years: 0 }).ok, false);
  assert.equal(bad({ years: 41 }).ok, false);
  assert.equal(bad({ years: 10.5 }).ok, false);
  assert.equal(bad({ incrementPct: 21 }).ok, false);
  assert.equal(bad({ opening: -1 }).ok, false);
  assert.equal(bad({ basic: 0 }).errors.basic, 'errTooSmall');
  assert.equal(bad({ years: 10.5 }).errors.years, 'errInteger');
  assert.equal(bad({ ratePct: 26 }).errors.ratePct, 'errTooBig');
});

test('formatTaka groups thousands and fixes 2 decimals', () => {
  assert.equal(formatTaka(1234567.8), '1,234,567.80');
  assert.equal(formatTaka(0), '0.00');
  assert.equal(formatTaka(1000), '1,000.00');
  assert.equal(formatTaka(999.999), '1,000.00');
});

test('Bengali digits map 0-9 and formatTakaBn converts', () => {
  assert.equal(toBnDigits('0123456789'), '০১২৩৪৫৬৭৮৯');
  assert.equal(formatTakaBn(1234567.8), '১,২৩৪,৫৬৭.৮০');
  assert.equal(formatTakaBn(24000), '২৪,০০০.০০');
});

test('round2 rounds to the paisa', () => {
  assert.equal(round2(10.005), 10.01);
  assert.equal(round2(10.004), 10.0);
});

test('validateScenarioList accepts good lists and rejects bad ones', () => {
  const good = [{ name: 'My PF', inputs: defaults(), savedAt: new Date().toISOString() }];
  assert.equal(validateScenarioList(good), true);
  assert.equal(validateScenarioList([]), true);
  assert.equal(validateScenarioList(null), false);
  assert.equal(validateScenarioList({}), false);
  assert.equal(validateScenarioList([{ name: '', inputs: defaults(), savedAt: 'x' }]), false);
  assert.equal(validateScenarioList([{ name: 'x', inputs: { ...defaults(), years: 99 }, savedAt: 'x' }]), false);
  assert.equal(validateScenarioList([{ name: 'x', inputs: defaults() }]), false);
  assert.equal(validateScenarioList('nope'), false);
});

test('i18n parity: EN and BN have identical non-empty keys', () => {
  const enKeys = Object.keys(I18N.en).sort();
  const bnKeys = Object.keys(I18N.bn).sort();
  assert.deepEqual(bnKeys, enKeys);
  for (const k of enKeys) {
    assert.ok(I18N.en[k].length > 0, `en.${k} empty`);
    assert.ok(I18N.bn[k].length > 0, `bn.${k} empty`);
  }
  // Bangla strings actually contain Bengali script.
  assert.match(I18N.bn.appTitle, /[\u0980-\u09FF]/);
  assert.match(I18N.bn.lblBasic, /[\u0980-\u09FF]/);
});

test('logic.js and app.js are pure ASCII (Bengali lives only in i18n.js)', () => {
  for (const f of ['js/logic.js', 'js/app.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const bad = [...src].find((c) => c.codePointAt(0) > 127);
    assert.equal(bad, undefined, `${f} contains non-ASCII: ${bad}`);
  }
  const i18n = fs.readFileSync(path.join(ROOT, 'js/i18n.js'), 'utf8');
  assert.match(i18n, /[\u0980-\u09FF]/, 'i18n.js should carry Bengali strings');
});

test('index.html references all local assets that exist', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /js\/logic\.js/);
  assert.match(html, /js\/i18n\.js/);
  assert.match(html, /js\/app\.js/);
  assert.match(html, /styles\.css/);
  for (const f of ['index.html', 'styles.css', 'js/logic.js', 'js/i18n.js', 'js/app.js']) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} missing`);
  }
  // Every input id used by app.js exists in the HTML.
  for (const id of ['basic', 'empPct', 'erPct', 'ratePct', 'years', 'incrementPct', 'opening',
    'btn-calc', 'btn-reset', 'res-maturity', 'res-emp', 'res-er', 'res-interest',
    'res-monthly', 'res-contrib', 'cmp-with', 'cmp-without', 'cmp-diff',
    'schedule-body', 'results', 'empty-results', 'scenario-name', 'btn-save-scenario',
    'btn-export', 'btn-import', 'import-file', 'scenario-list', 'empty-scenarios',
    'scenario-msg', 'erase-confirm', 'btn-erase', 'lang-toggle']) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id} in index.html`);
  }
});

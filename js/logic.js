/* PF Calculator BD - pure calculation logic (no DOM).
   Provident Fund projection for Bangladesh: monthly employee + employer
   contributions on basic salary, compounded monthly.
   Model (documented in README): at the start of each month the month's
   employee + employer contributions are added to the balance, then that
   month's interest (annual rate / 12) is applied to the new balance.
   Basic salary grows by the annual increment % at the start of each year
   after year 1. All money is rounded to the paisa (2 dp) each month. */

'use strict';

const LIMITS = {
  basic: { min: 1, max: 10000000 },
  empPct: { min: 0, max: 50 },
  erPct: { min: 0, max: 50 },
  ratePct: { min: 0, max: 25 },
  years: { min: 1, max: 40 },
  incrementPct: { min: 0, max: 20 },
  opening: { min: 0, max: 100000000 },
};

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/* Validate raw inputs. Returns { ok, errors } where errors maps field -> key. */
function validateInputs(inp) {
  const errors = {};
  const check = (field, value, limits, integer) => {
    if (!isFiniteNumber(value)) { errors[field] = 'errNumber'; return; }
    if (integer && !Number.isInteger(value)) { errors[field] = 'errInteger'; return; }
    if (value < limits.min) { errors[field] = 'errTooSmall'; return; }
    if (value > limits.max) { errors[field] = 'errTooBig'; return; }
  };
  check('basic', inp.basic, LIMITS.basic);
  check('empPct', inp.empPct, LIMITS.empPct);
  check('erPct', inp.erPct, LIMITS.erPct);
  check('ratePct', inp.ratePct, LIMITS.ratePct);
  check('years', inp.years, LIMITS.years, true);
  check('incrementPct', inp.incrementPct, LIMITS.incrementPct);
  check('opening', inp.opening, LIMITS.opening);
  return { ok: Object.keys(errors).length === 0, errors };
}

function defaults() {
  return {
    basic: 50000,
    empPct: 10,
    erPct: 10,
    ratePct: 8.5,
    years: 10,
    incrementPct: 5,
    opening: 0,
  };
}

/* Project the fund. Returns:
   { maturity, empTotal, erTotal, interestTotal, contribTotal,
     monthlyFirst, years: [{year, opening, emp, er, interest, closing}] } */
function projectPF(inp) {
  const monthlyRate = inp.ratePct / 100 / 12;
  let balance = round2(inp.opening);
  let basic = inp.basic;
  let empTotal = 0;
  let erTotal = 0;
  let interestTotal = 0;
  const years = [];
  const monthlyFirst = round2(basic * (inp.empPct + inp.erPct) / 100);

  for (let y = 1; y <= inp.years; y++) {
    if (y > 1) basic = round2(basic * (1 + inp.incrementPct / 100));
    const opening = balance;
    let yEmp = 0;
    let yEr = 0;
    let yInt = 0;
    for (let m = 0; m < 12; m++) {
      const emp = round2(basic * inp.empPct / 100);
      const er = round2(basic * inp.erPct / 100);
      balance = round2(balance + emp + er);
      const interest = round2(balance * monthlyRate);
      balance = round2(balance + interest);
      yEmp = round2(yEmp + emp);
      yEr = round2(yEr + er);
      yInt = round2(yInt + interest);
    }
    empTotal = round2(empTotal + yEmp);
    erTotal = round2(erTotal + yEr);
    interestTotal = round2(interestTotal + yInt);
    years.push({
      year: y,
      opening,
      emp: yEmp,
      er: yEr,
      interest: yInt,
      closing: balance,
    });
  }

  return {
    maturity: balance,
    empTotal,
    erTotal,
    interestTotal,
    contribTotal: round2(empTotal + erTotal),
    monthlyFirst,
    years,
  };
}

/* Same projection with employer contribution forced to 0 (what-if compare). */
function projectEmployeeOnly(inp) {
  return projectPF({ ...inp, erPct: 0 });
}

/* Format a taka amount with thousands separators and 2 decimals (EN digits). */
function formatTaka(n) {
  const v = round2(n);
  const parts = v.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

const BN_DIGITS = { 0: '\u09E6', 1: '\u09E7', 2: '\u09E8', 3: '\u09E9', 4: '\u09EA', 5: '\u09EB', 6: '\u09EC', 7: '\u09ED', 8: '\u09EE', 9: '\u09EF' };
function toBnDigits(s) {
  return String(s).replace(/[0-9]/g, (d) => BN_DIGITS[d]);
}

function formatTakaBn(n) {
  return toBnDigits(formatTaka(n));
}

/* --- Scenario storage helpers (pure) --- */
function validateScenarioList(list) {
  if (!Array.isArray(list)) return false;
  return list.every((s) =>
    s && typeof s === 'object' &&
    typeof s.name === 'string' && s.name.trim().length > 0 && s.name.length <= 60 &&
    s.inputs && typeof s.inputs === 'object' &&
    validateInputs(s.inputs).ok &&
    typeof s.savedAt === 'string');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LIMITS, round2, isFiniteNumber, validateInputs, defaults,
    projectPF, projectEmployeeOnly, formatTaka, formatTakaBn,
    toBnDigits, validateScenarioList,
  };
}

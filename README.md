# PF Calculator BD

Provident Fund maturity & growth planner for Bangladesh — an offline, bilingual (English / বাংলা) web app. Enter your basic salary, contribution rates, interest rate and years of service, and see exactly what your PF could be worth at maturity, year by year.

## Problem

Most Bangladeshi employees know a slice of their salary goes to Provident Fund every month, but few can see what that adds up to: your own contributions, the employer's match, and years of compound interest. Existing calculators are usually generic savings tools — they don't model the employer match, annual salary increments, or an existing PF balance.

## Features

- **PF projection** — maturity value, your contributions, employer contributions, interest earned, and monthly contribution (year 1), from monthly compounding.
- **Employer-match comparison** — side-by-side "with employer match" vs "employee only" maturity, and exactly how much the match adds.
- **Year-by-year schedule** — opening balance, your payment, employer payment, interest, and closing balance for every year.
- **Salary increments** — optional annual increment % grows your basic (and therefore your contributions) from year 2.
- **Existing balance** — start from your current PF balance instead of zero.
- **Quick presets** — Standard 10% + 10%, Higher 12% + 12%, Starter 5% + 5%.
- **Saved scenarios** — name and save plans, load them later, export / import as JSON, typed-DELETE erase-all.
- **Bilingual UI** — full English / বাংলা toggle with Bengali digits in Bangla mode; language, inputs and scenarios persist in `localStorage`.
- **Offline & private** — zero network requests; all data stays on your device.
- **Responsive** — verified at 1280px desktop and 390px mobile; the schedule table scrolls horizontally on small screens.

## How the numbers are worked out

Each month: your contribution + employer contribution are added to the balance, then one month of interest (annual rate ÷ 12) is added on the new balance. Your basic salary grows by the annual increment % at the start of each year after year 1. All amounts are rounded to the paisa (৳0.01) each month.

The interest rate is **yours to enter** — no official rate is assumed. PF rules, rates and tax treatment vary by employer and scheme (government, private, or company-run fund). Confirm the exact rate and rules with your HR or fund office before making decisions. This is a planning tool, not financial advice.

## Stack

- Plain HTML + CSS + vanilla JavaScript (no framework, no build step, no dependencies)
- `js/logic.js` — pure calculation + validation (also loadable in Node for tests)
- `js/i18n.js` — English / বাংলা strings
- `js/app.js` — DOM wiring, tabs, scenarios, persistence
- Tests: Node's built-in test runner + raw-CDP headless-Chrome smoke tests

## Prerequisites

- Any modern browser (for the app), or Node.js 18+ (to run the tests)

## Install & run

```bash
# No install step — open the file directly:
open index.html
# or serve it locally:
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Dev commands

```bash
node --test tests/unit.test.mjs   # unit tests (logic, validation, i18n)
node tests/smoke.mjs 1280         # headless-Chrome smoke tests, desktop
node tests/smoke.mjs 390          # headless-Chrome smoke tests, mobile
```

## Environment

No environment variables, no API keys, no backend. Everything runs client-side.

## Testing

- **Unit tests:** 17/17 pass — hand-computed projections (zero-rate exact totals, 12% geometric-series value, increment from year 2, opening-balance interest), row-to-total reconciliation, validation boundaries, taka/Bengali-digit formatting, scenario-list validation, EN/BN i18n parity, ASCII checks on `logic.js`/`app.js`.
- **Smoke tests:** 45/45 pass at 1280px and 45/45 at 390px — defaults auto-calculate (maturity ৳2,303,705.46), zero-rate 1-year exact values, validation errors + empty state, presets, reset, scenario save/load/erase (wrong confirm rejected, DELETE accepted), guide tab, Bangla toggle with Bengali digits, zero console/page errors, zero non-file network requests.
- Repairs: 1 unit-test fix (Bengali digit literals moved to `\u` escapes so `logic.js` stays pure ASCII); 1 CSS fix (grid `min-width: 0` so the schedule table can't force horizontal overflow at 390px).

See `TEST_RESULTS.md` for the full record.

## Deployment

Static site — any static host works. GitHub Pages: publish the `main` branch from the repository root.

## Limitations

- Monthly compounding with contributions added at the start of each month is a stated model, not a promise about any particular fund's crediting method.
- No tax calculation — PF tax treatment depends on the scheme and current rules.
- Scenarios live in the browser's `localStorage` only; clearing browser data removes them (export JSON to keep a copy).
- Figures are estimates for planning; verify rates and rules with your employer.

## Status

Complete MVP — built, tested, and published 2026-11-13. Live at https://fahad3235.github.io/pf-calculator-bd/

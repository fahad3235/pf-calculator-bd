# TEST_RESULTS.md — PF Calculator BD (run #326)

## Unit tests (Node, no DOM)

Command: `node --test tests/unit.test.mjs`
Result: **17/17 pass, 0 fail**

Covered: defaults sane + valid; zero-rate 1-year exact hand-computed totals
(maturity 24000, emp 12000, er 12000, interest 0, monthly 2000, full year row);
12% rate 1-year employee-only geometric-series value (maturity 12809.33,
interest 809.33); salary increment applies from year 2 (24000 + 26400 = 50400);
opening balance carries through at 0% and earns interest at 12%
(12000 → 13521.90); employee-only projection drops the employer share and is
exactly half at 0% rate; year rows sum to totals with opening/closing chained
across 7 years; maturity grows with rate and with years; validation rejects
out-of-range / non-integer values with the right error keys; taka formatting
(1,234,567.80); Bengali digit mapping (০১২৩৪৫৬৭৮৯) and formatTakaBn;
round2 paisa rounding; validateScenarioList accept/reject cases; i18n parity
(identical non-empty EN/BN key sets, Bengali script present); logic.js and
app.js pure ASCII; index.html references all existing local assets and every
input/result/scenario element id used by app.js.

Repairs: 1 test-side fix — Bengali digit literals in logic.js moved to
`\u09E6`–`\u09EF` escapes and the taka sign / middle dot in app.js to
`\u09F3` / `\u00B7`, so both files stay pure ASCII (Bengali strings live only
in i18n.js). No app-logic bugs found by the unit tests.

## Smoke tests (headless Chrome, raw CDP, file://)

Command: `node tests/smoke.mjs 1280` and `node tests/smoke.mjs 390`
Result: **45/45 pass at 1280px, 45/45 pass at 390px**

Covered: title/h1/tabs render; calc tab visible, others hidden; no overflow;
defaults auto-calculate on load — maturity ৳2,303,705.46, employee
৳754,673.64, interest ৳794,358.18, monthly ৳10,000.00, 10 schedule rows,
compare-without ৳1,151,852.69, diff ৳1,151,852.77; zero-rate 1-year case
(maturity ৳24,000.00, interest ৳0.00, 1 schedule row, compare-without
৳12,000.00, diff ৳12,000.00); validation (years=0 shows error, results hide,
empty state shows, fixing restores results); preset 12/12 sets both % fields
and recalculates; reset restores basic 50000 and hides results; scenarios tab
(save "Test PF" → card appears + localStorage holds 1, wrong erase confirm
keeps it, DELETE erases all + message shows); guide tab mentions Provident
Fund; language toggle → h1 "পিএফ ক্যালকুলেটর বিডি", Bengali digits in
maturity, lang persisted as bn, toggle back to English; zero page errors,
zero console errors, zero non-file network requests at both widths.

Repairs: 1 CSS fix — `.grid > * { min-width: 0 }` added after the 390px run
failed "no horizontal overflow" (scrollWidth 672: the schedule table's
intrinsic width forced the grid track wider). Re-ran both widths: 45/45 each.

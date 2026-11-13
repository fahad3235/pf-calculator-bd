/* PF Calculator BD - UI wiring (browser only). Depends on logic.js + i18n.js. */
(function () {
  'use strict';

  var LS_LANG = 'pfcalc.lang';
  var LS_INPUTS = 'pfcalc.inputs';
  var LS_SCENARIOS = 'pfcalc.scenarios';

  var lang = 'en';
  try { lang = localStorage.getItem(LS_LANG) || 'en'; } catch (e) { lang = 'en'; }
  if (lang !== 'bn') lang = 'en';

  function t(key) {
    return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  }
  function fmt(n) {
    return lang === 'bn' ? formatTakaBn(n) : formatTaka(n);
  }
  function fmtInt(n) {
    var s = lang === 'bn' ? toBnDigits(String(n)) : String(n);
    return s;
  }
  function $(id) { return document.getElementById(id); }

  var FIELDS = ['basic', 'empPct', 'erPct', 'ratePct', 'years', 'incrementPct', 'opening'];

  function readInputs() {
    var inp = {};
    FIELDS.forEach(function (f) {
      var v = parseFloat($(f).value);
      inp[f] = v;
    });
    return inp;
  }

  function writeInputs(inp) {
    FIELDS.forEach(function (f) {
      $(f).value = inp[f];
    });
  }

  function showErrors(errors) {
    FIELDS.forEach(function (f) {
      var err = $('err-' + f);
      if (err) err.textContent = errors[f] ? t(errors[f]) : '';
      var input = $(f);
      if (input) input.classList.toggle('invalid', !!errors[f]);
    });
  }

  function renderResults(res, empOnly) {
    $('empty-results').hidden = true;
    $('results').hidden = false;
    $('res-maturity').textContent = '\u09F3' + fmt(res.maturity);
    $('res-emp').textContent = '\u09F3' + fmt(res.empTotal);
    $('res-er').textContent = '\u09F3' + fmt(res.erTotal);
    $('res-interest').textContent = '\u09F3' + fmt(res.interestTotal);
    $('res-monthly').textContent = '\u09F3' + fmt(res.monthlyFirst);
    $('res-contrib').textContent = '\u09F3' + fmt(res.contribTotal);
    $('cmp-with').textContent = '\u09F3' + fmt(res.maturity);
    $('cmp-without').textContent = '\u09F3' + fmt(empOnly.maturity);
    $('cmp-diff').textContent = '\u09F3' + fmt(res.maturity - empOnly.maturity);

    var tbody = $('schedule-body');
    tbody.innerHTML = '';
    res.years.forEach(function (row) {
      var tr = document.createElement('tr');
      [row.year, row.opening, row.emp, row.er, row.interest, row.closing].forEach(function (v, i) {
        var td = document.createElement('td');
        td.textContent = i === 0 ? fmtInt(v) : '\u09F3' + fmt(v);
        if (i > 0) td.classList.add('num');
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function calculate() {
    var inp = readInputs();
    var v = validateInputs(inp);
    showErrors(v.errors);
    if (!v.ok) {
      $('empty-results').hidden = false;
      $('results').hidden = true;
      return false;
    }
    var res = projectPF(inp);
    var empOnly = projectEmployeeOnly(inp);
    renderResults(res, empOnly);
    try { localStorage.setItem(LS_INPUTS, JSON.stringify(inp)); } catch (e) {}
    return true;
  }

  /* --- Scenarios --- */
  function loadScenarios() {
    try {
      var raw = localStorage.getItem(LS_SCENARIOS);
      if (!raw) return [];
      var list = JSON.parse(raw);
      return validateScenarioList(list) ? list : [];
    } catch (e) { return []; }
  }
  function saveScenarios(list) {
    try { localStorage.setItem(LS_SCENARIOS, JSON.stringify(list)); } catch (e) {}
  }

  function renderScenarios() {
    var list = loadScenarios();
    var box = $('scenario-list');
    box.innerHTML = '';
    $('empty-scenarios').hidden = list.length > 0;
    list.forEach(function (sc, idx) {
      var div = document.createElement('div');
      div.className = 'scenario-card';
      var name = document.createElement('strong');
      name.textContent = sc.name;
      var meta = document.createElement('span');
      meta.className = 'scenario-meta';
      var res = projectPF(sc.inputs);
      meta.textContent = t('savedAt') + ' ' + sc.savedAt.slice(0, 10) +
        ' \u00B7 ' + t('resMaturity') + ': \u09F3' + fmt(res.maturity);
      var btns = document.createElement('span');
      btns.className = 'scenario-btns';
      var load = document.createElement('button');
      load.className = 'btn small';
      load.textContent = t('btnLoad');
      load.addEventListener('click', function () {
        writeInputs(sc.inputs);
        calculate();
        switchTab('calc');
      });
      var del = document.createElement('button');
      del.className = 'btn small danger';
      del.textContent = t('btnDelete');
      del.addEventListener('click', function () {
        var l = loadScenarios();
        l.splice(idx, 1);
        saveScenarios(l);
        renderScenarios();
      });
      btns.appendChild(load);
      btns.appendChild(del);
      div.appendChild(name);
      div.appendChild(document.createElement('br'));
      div.appendChild(meta);
      div.appendChild(btns);
      box.appendChild(div);
    });
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* --- Tabs + language --- */
  function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    document.querySelectorAll('.tab-panel').forEach(function (p) {
      p.hidden = p.id !== 'tab-' + name;
    });
  }

  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.placeholder = t(el.dataset.i18nPh);
    });
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
    $('lang-toggle').textContent = t('langBtn');
    try { localStorage.setItem(LS_LANG, lang); } catch (e) {}
    // Re-render numbers in the active language if results exist.
    if (!$('results').hidden) calculate();
    renderScenarios();
  }

  function init() {
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.dataset.tab); });
    });
    $('lang-toggle').addEventListener('click', function () {
      lang = lang === 'en' ? 'bn' : 'en';
      applyLang();
    });
    $('btn-calc').addEventListener('click', calculate);
    $('btn-reset').addEventListener('click', function () {
      writeInputs(defaults());
      showErrors({});
      $('empty-results').hidden = false;
      $('results').hidden = true;
    });
    document.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () {
        var parts = b.dataset.preset.split('/');
        $('empPct').value = parts[0];
        $('erPct').value = parts[1];
        calculate();
      });
    });

    $('btn-save-scenario').addEventListener('click', function () {
      var inp = readInputs();
      var v = validateInputs(inp);
      showErrors(v.errors);
      if (!v.ok) { switchTab('calc'); return; }
      var name = $('scenario-name').value.trim();
      if (!name) { $('scenario-name').focus(); return; }
      var list = loadScenarios();
      list.push({ name: name, inputs: inp, savedAt: new Date().toISOString() });
      saveScenarios(list);
      $('scenario-name').value = '';
      $('scenario-msg').textContent = '';
      renderScenarios();
    });

    $('btn-export').addEventListener('click', function () {
      download('pf-calculator-scenarios.json', JSON.stringify(loadScenarios(), null, 2));
    });
    $('btn-import').addEventListener('click', function () { $('import-file').click(); });
    $('import-file').addEventListener('change', function (ev) {
      var file = ev.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var list = JSON.parse(reader.result);
          if (!validateScenarioList(list)) throw new Error('bad');
          saveScenarios(list);
          $('scenario-msg').textContent = t('importOk').replace('{n}', lang === 'bn' ? toBnDigits(String(list.length)) : String(list.length));
          renderScenarios();
        } catch (e) {
          $('scenario-msg').textContent = t('importBad');
        }
        ev.target.value = '';
      };
      reader.readAsText(file);
    });

    $('btn-erase').addEventListener('click', function () {
      if ($('erase-confirm').value.trim() !== 'DELETE') {
        $('scenario-msg').textContent = t('eraseWrong');
        return;
      }
      saveScenarios([]);
      $('erase-confirm').value = '';
      $('scenario-msg').textContent = t('eraseDone');
      renderScenarios();
    });

    // Restore last inputs if present, else defaults.
    var restored = null;
    try {
      var raw = localStorage.getItem(LS_INPUTS);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (validateInputs(parsed).ok) restored = parsed;
      }
    } catch (e) {}
    writeInputs(restored || defaults());
    applyLang();
    calculate();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

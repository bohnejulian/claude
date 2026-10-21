// Travelguide, erster Entwurf: Startseite, Fragebogen, Ergebnisse und Detailseite als Single-Page-App mit Hash-Routing.
(function () {
  'use strict';

  var S = window.TGScoring;
  var DATA = {
    destinations: window.TG_DESTINATIONS,
    airports: window.TG_AIRPORTS,
    climate: window.TG_CLIMATE.data,
    safety: window.TG_SAFETY.data
  };
  var MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  var STORE_KEY = 'travelguide.answers.v1';
  var STEPS = 6;
  var app = document.getElementById('app');

  // ---------- Zustand ----------

  function defaultAnswers() {
    var start = new Date();
    start.setDate(start.getDate() + 60);
    return {
      airport: 'FRA',
      startDate: start.toISOString().slice(0, 10),
      days: 7,
      travellers: 2,
      budget: 1000,
      climate: 'warm',
      interests: [],
      maxFlight: 'mittel',
      excluded: [],
      weights: Object.assign({}, S.DEFAULT_WEIGHTS),
      done: false
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return Object.assign(defaultAnswers(), JSON.parse(raw));
    } catch (e) { /* Speicher nicht verfügbar */ }
    return defaultAnswers();
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(answers)); } catch (e) { /* egal */ }
  }

  var answers = load();

  // ---------- Helfer ----------

  function esc(v) {
    return String(v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function euro(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }
  function hours(h) { return h.toString().replace('.', ',') + ' h'; }
  function fmtDate(iso) {
    var d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function addDays(iso, n) {
    var d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function daysUntil(iso) {
    var today = new Date(); today.setHours(12, 0, 0, 0);
    return Math.round((new Date(iso + 'T12:00:00') - today) / 86400000);
  }
  function scoreClass(v) { return v >= 75 ? 'good' : v >= 50 ? 'ok' : 'low'; }
  function countries() {
    var seen = {};
    DATA.destinations.forEach(function (d) { if (!seen[d.cc]) seen[d.cc] = { cc: d.cc, name: d.country, region: d.region }; });
    return Object.keys(seen).map(function (k) { return seen[k]; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'de'); });
  }

  function chip(label, pressed, attrs) {
    return '<button type="button" class="chip" aria-pressed="' + (pressed ? 'true' : 'false') + '" ' + attrs + '>' + esc(label) + '</button>';
  }

  function render(html) {
    app.innerHTML = html;
    app.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  // ---------- Startseite ----------

  function viewStart() {
    var count = DATA.destinations.length;
    render(
      '<section class="hero">' +
        '<div class="hero-text">' +
          '<h1>Wohin geht’s als Nächstes?</h1>' +
          '<p class="lead">Sag uns in sechs kurzen Schritten, was du suchst. Wir gleichen ' + count + ' Reiseziele mit Wetter, Flugkosten, Sicherheitslage und deinem Budget ab und zeigen dir, warum ein Ziel passt.</p>' +
          '<div class="actions">' +
            '<a class="btn btn-primary" href="#/fragen/1">Reiseziel finden</a>' +
            (answers.done ? '<a class="btn btn-secondary" href="#/ergebnisse">Letzte Ergebnisse ansehen</a>' : '') +
          '</div>' +
        '</div>' +
        boardPreview() +
      '</section>' +
      '<section class="how">' +
        '<h2>So funktioniert’s</h2>' +
        '<ol class="how-steps">' +
          '<li><strong>Du beantwortest Fragen</strong><span>Abflughafen, Reisezeit, Budget, Wunschklima, Interessen und Länder, in denen du schon warst.</span></li>' +
          '<li><strong>Wir rechnen</strong><span>Jedes Ziel bekommt Punkte für Wetter, Flugpreis, Sicherheit, Budget und Interessen. Du bestimmst, was zählt.</span></li>' +
          '<li><strong>Du vergleichst</strong><span>Die besten Ziele mit Begründung, Kosten und aktuellem Wetter. Von dort geht es direkt zur Flugsuche.</span></li>' +
        '</ol>' +
      '</section>'
    );
  }

  // Kleine Abflugtafel als Blickfang, mit einer echten Beispielrechnung.
  function boardPreview() {
    var demo = S.rank(Object.assign(defaultAnswers(), { interests: ['Strand', 'Kultur'], climate: 'warm' }), DATA).results.slice(0, 4);
    return '<div class="board board-preview" aria-label="Beispiel: Ergebnisse für Strand und Kultur, Abflug Frankfurt">' +
      '<div class="board-head"><span>Beispiel ab Frankfurt</span><span>' + MONTHS[demo[0].month] + '</span></div>' +
      demo.map(function (r) {
        return '<div class="board-row"><span class="board-city">' + esc(r.dest.city) + '</span>' + flap(r.score) + '</div>';
      }).join('') +
    '</div>';
  }

  function flap(score) {
    var digits = String(score).padStart(3, ' ').split('');
    return '<span class="flap ' + scoreClass(score) + '" aria-label="' + score + ' von 100 Punkten">' +
      digits.map(function (d) { return '<span aria-hidden="true">' + (d === ' ' ? '&nbsp;' : d) + '</span>'; }).join('') + '</span>';
  }

  // ---------- Fragebogen ----------

  function viewStep(step) {
    step = Math.min(STEPS, Math.max(1, step));
    var body = [stepTrip, stepBudget, stepClimate, stepInterests, stepExclude, stepWeights][step - 1]();
    render(
      '<section class="quiz">' +
        '<div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="' + STEPS + '" aria-valuenow="' + step + '" aria-label="Schritt ' + step + ' von ' + STEPS + '">' +
          '<span style="width:' + (step / STEPS * 100) + '%"></span>' +
        '</div>' +
        '<p class="step-count">Schritt ' + step + ' von ' + STEPS + '</p>' +
        '<form id="step-form" class="step" novalidate>' + body +
          '<div class="step-nav">' +
            (step > 1 ? '<a class="btn btn-secondary" href="#/fragen/' + (step - 1) + '">Zurück</a>' : '<a class="btn btn-secondary" href="#/">Abbrechen</a>') +
            '<button class="btn btn-primary" type="submit">' + (step < STEPS ? 'Weiter' : 'Ergebnisse zeigen') + '</button>' +
          '</div>' +
        '</form>' +
      '</section>'
    );
    var form = document.getElementById('step-form');
    bindChips(form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      readForm(form);
      save();
      if (step < STEPS) location.hash = '#/fragen/' + (step + 1);
      else { answers.done = true; save(); location.hash = '#/ergebnisse'; }
    });
    if (step === 5) bindCountryFilter(form);
    if (step === 6) bindWeightOutputs(form);
  }

  function stepTrip() {
    var minDate = new Date().toISOString().slice(0, 10);
    return '<h1>Von wo und wann?</h1>' +
      '<div class="field-grid">' +
        '<label>Abflughafen<select name="airport">' +
          DATA.airports.map(function (a) { return '<option value="' + a.iata + '"' + (a.iata === answers.airport ? ' selected' : '') + '>' + esc(a.name) + ' (' + a.iata + ')</option>'; }).join('') +
        '</select></label>' +
        '<label>Hinflug am<input type="date" name="startDate" min="' + minDate + '" value="' + esc(answers.startDate) + '" required></label>' +
        '<label>Reisedauer in Tagen<input type="number" name="days" min="1" max="365" value="' + esc(answers.days) + '" required></label>' +
        '<label>Reisende<input type="number" name="travellers" min="1" max="12" value="' + esc(answers.travellers) + '" required></label>' +
      '</div>';
  }

  function stepBudget() {
    var presets = [500, 1000, 1500, 2500, 4000];
    return '<h1>Wie viel darf die Reise pro Person kosten?</h1>' +
      '<p class="hint">Flug und Aufenthalt zusammen. Wir rechnen mit Mittelklasse-Unterkünften.</p>' +
      '<label class="budget-input">Budget pro Person in €<input type="number" name="budget" min="100" step="50" value="' + esc(answers.budget) + '" required></label>' +
      '<div class="chips" role="group" aria-label="Schnellauswahl Budget">' +
        presets.map(function (p) { return chip('bis ' + euro(p), Number(answers.budget) === p, 'data-set="budget" data-value="' + p + '"'); }).join('') +
      '</div>';
  }

  function stepClimate() {
    var keys = ['heiss', 'warm', 'mild', 'kuehl', 'schnee', 'egal'];
    return '<h1>Welches Wetter wünschst du dir?</h1>' +
      '<p class="hint">Gemeint ist die Tageshöchsttemperatur im Reisemonat.</p>' +
      '<div class="option-list" role="radiogroup" aria-label="Wunschklima">' +
        keys.map(function (k) {
          var c = S.CLIMATES[k];
          var range = k === 'egal' ? 'Hauptsache angenehm' : c.min < -5 ? 'unter ' + (c.max + 1) + ' °C' : c.min + ' bis ' + c.max + ' °C';
          return '<label class="option"><input type="radio" name="climate" value="' + k + '"' + (answers.climate === k ? ' checked' : '') + '><span><strong>' + c.label + '</strong><small>' + range + '</small></span></label>';
        }).join('') +
      '</div>';
  }

  function stepInterests() {
    return '<h1>Worauf hast du Lust?</h1>' +
      '<p class="hint">Wähle so viele, wie du möchtest. Ohne Auswahl zählen Interessen nicht.</p>' +
      '<div class="chips" role="group" aria-label="Interessen">' +
        window.TG_INTERESTS.map(function (i) { return chip(i, answers.interests.indexOf(i) >= 0, 'data-toggle="interests" data-value="' + esc(i) + '"'); }).join('') +
      '</div>';
  }

  function stepExclude() {
    var limits = [['kurz', 'Bis 4 Stunden'], ['mittel', 'Bis 8 Stunden'], ['egal', 'Egal']];
    var list = countries();
    return '<h1>Wie weit und wohin nicht?</h1>' +
      '<fieldset><legend>Maximale Flugzeit pro Strecke</legend><div class="chips">' +
        limits.map(function (l) { return chip(l[1], answers.maxFlight === l[0], 'data-set="maxFlight" data-value="' + l[0] + '"'); }).join('') +
      '</div></fieldset>' +
      '<fieldset><legend>Länder ausschließen, zum Beispiel weil du schon dort warst</legend>' +
        '<label class="search">Land suchen<input type="search" id="country-filter" autocomplete="off"></label>' +
        '<p class="hint" id="excluded-count">' + excludedLabel() + '</p>' +
        '<div class="country-grid">' +
          list.map(function (c) {
            return '<label class="country" data-name="' + esc(c.name.toLowerCase()) + '"><input type="checkbox" name="excluded" value="' + c.cc + '"' + (answers.excluded.indexOf(c.cc) >= 0 ? ' checked' : '') + '><span>' + esc(c.name) + '</span></label>';
          }).join('') +
        '</div>' +
      '</fieldset>';
  }

  function excludedLabel() {
    var n = answers.excluded.length;
    return n === 0 ? 'Noch kein Land ausgeschlossen.' : n === 1 ? '1 Land ausgeschlossen.' : n + ' Länder ausgeschlossen.';
  }

  function stepWeights() {
    return '<h1>Was ist dir am wichtigsten?</h1>' +
      '<p class="hint">0 heißt egal, 3 heißt sehr wichtig. Das kannst du auf der Ergebnisseite noch ändern.</p>' +
      weightSliders();
  }

  function weightSliders() {
    var words = ['egal', 'etwas', 'wichtig', 'sehr wichtig'];
    return '<div class="weights">' + S.FACTORS.map(function (f) {
      var v = answers.weights[f.key];
      return '<label class="weight"><span>' + f.label + '</span>' +
        '<input type="range" min="0" max="3" step="1" name="w-' + f.key + '" value="' + v + '">' +
        '<output data-for="w-' + f.key + '">' + words[v] + '</output></label>';
    }).join('') + '</div>';
  }

  function bindWeightOutputs(scope, onChange) {
    var words = ['egal', 'etwas', 'wichtig', 'sehr wichtig'];
    scope.querySelectorAll('input[type=range]').forEach(function (input) {
      input.addEventListener('input', function () {
        scope.querySelector('output[data-for="' + input.name + '"]').textContent = words[input.value];
        if (onChange) { answers.weights[input.name.slice(2)] = Number(input.value); save(); onChange(); }
      });
    });
  }

  function bindChips(form) {
    form.querySelectorAll('[data-set]').forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-set');
        var val = b.getAttribute('data-value');
        answers[key] = key === 'budget' ? Number(val) : val;
        form.querySelectorAll('[data-set="' + key + '"]').forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        if (key === 'budget') form.querySelector('input[name=budget]').value = val;
      });
    });
    form.querySelectorAll('[data-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-toggle');
        var val = b.getAttribute('data-value');
        var list = answers[key];
        var i = list.indexOf(val);
        if (i >= 0) list.splice(i, 1); else list.push(val);
        b.setAttribute('aria-pressed', i >= 0 ? 'false' : 'true');
      });
    });
    var budget = form.querySelector('input[name=budget]');
    if (budget) budget.addEventListener('input', function () {
      form.querySelectorAll('[data-set="budget"]').forEach(function (o) { o.setAttribute('aria-pressed', o.getAttribute('data-value') === budget.value ? 'true' : 'false'); });
    });
  }

  function bindCountryFilter(form) {
    var input = form.querySelector('#country-filter');
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      form.querySelectorAll('.country').forEach(function (el) { el.hidden = q && el.getAttribute('data-name').indexOf(q) < 0; });
    });
    form.querySelectorAll('input[name=excluded]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        answers.excluded = Array.prototype.map.call(form.querySelectorAll('input[name=excluded]:checked'), function (x) { return x.value; });
        form.querySelector('#excluded-count').textContent = excludedLabel();
      });
    });
  }

  function readForm(form) {
    var get = function (n) { var el = form.elements[n]; return el ? el.value : undefined; };
    if (form.elements.airport) answers.airport = get('airport');
    if (form.elements.startDate && get('startDate')) answers.startDate = get('startDate');
    if (form.elements.days) answers.days = Math.max(1, Math.min(365, Number(get('days')) || 7));
    if (form.elements.travellers) answers.travellers = Math.max(1, Math.min(12, Number(get('travellers')) || 1));
    if (form.elements.budget) answers.budget = Math.max(100, Number(get('budget')) || 1000);
    var climate = form.querySelector('input[name=climate]:checked');
    if (climate) answers.climate = climate.value;
    if (form.querySelector('input[name=excluded]')) {
      answers.excluded = Array.prototype.map.call(form.querySelectorAll('input[name=excluded]:checked'), function (x) { return x.value; });
    }
    S.FACTORS.forEach(function (f) {
      var el = form.elements['w-' + f.key];
      if (el) answers.weights[f.key] = Number(el.value);
    });
  }

  // ---------- Ergebnisse ----------

  function viewResults() {
    if (!answers.done) { location.hash = '#/fragen/1'; return; }
    var airport = DATA.airports.filter(function (a) { return a.iata === answers.airport; })[0];
    render(
      '<section class="results">' +
        '<div class="results-head">' +
          '<div><h1>Deine besten Ziele</h1>' +
          '<p class="summary">Ab ' + esc(airport.name) + ', ' + fmtDate(answers.startDate) + ', ' + answers.days + ' Tage, ' + answers.travellers + (answers.travellers === 1 ? ' Person' : ' Personen') + ', bis ' + euro(answers.budget) + ' pro Person. ' +
          '<a href="#/fragen/1">Angaben ändern</a></p></div>' +
        '</div>' +
        '<div class="results-layout">' +
          '<div id="board"></div>' +
          '<aside class="tuner"><h2>Gewichtung anpassen</h2><p class="hint">Die Liste sortiert sich sofort neu.</p>' + weightSliders() + '</aside>' +
        '</div>' +
      '</section>'
    );
    var tuner = app.querySelector('.tuner');
    bindWeightOutputs(tuner, drawBoard);
    drawBoard();
  }

  function drawBoard() {
    var r = S.rank(answers, DATA);
    var top = r.results.slice(0, 10);
    var el = document.getElementById('board');
    if (!top.length) {
      el.innerHTML = '<div class="empty"><h2>Kein Ziel passt zu allen Angaben</h2><p>Erlaube eine längere Flugzeit oder schließe weniger Länder aus.</p><a class="btn btn-primary" href="#/fragen/5">Angaben anpassen</a></div>';
      return;
    }
    el.innerHTML =
      '<div class="board board-results">' +
        '<div class="board-head" aria-hidden="true"><span>Ziel</span><span>Kosten p. P.</span><span>Flug</span><span>Wetter</span><span>Match</span></div>' +
        '<ol class="board-list">' + top.map(resultRow).join('') + '</ol>' +
      '</div>' +
      filteredBlock(r.filtered);
  }

  function resultRow(r, i) {
    var d = r.dest;
    return '<li class="result">' +
      '<a class="result-main" href="#/ziel/' + d.id + '">' +
        '<span class="result-rank" aria-hidden="true">' + (i + 1) + '</span>' +
        '<span class="result-name"><strong>' + esc(d.city) + '</strong><small>' + esc(d.country) + '</small></span>' +
        '<span class="result-cost' + (r.overBudget ? ' over' : '') + '"><small>Kosten p. P.</small>' + euro(r.total) + (r.overBudget ? '<em>über Budget</em>' : '') + '</span>' +
        '<span class="result-flight"><small>Flug</small>' + hours(r.flight.hours) + '</span>' +
        '<span class="result-weather"><small>Wetter</small>' + Math.round(r.climate.t) + ' °C</span>' +
        flap(r.score) +
      '</a>' +
      '<div class="result-why">' +
        (r.reasons.pros.length ? '<ul class="pros">' + r.reasons.pros.slice(0, 3).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '') +
        (r.reasons.cons.length ? '<ul class="cons">' + r.reasons.cons.slice(0, 2).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '') +
        safetyBadge(r.safety) +
      '</div>' +
    '</li>';
  }

  function safetyBadge(s) {
    return '<span class="badge badge-' + s.level + '">' + esc(s.text) + '</span>';
  }

  function filteredBlock(filtered) {
    if (!filtered.length) return '';
    return '<details class="filtered"><summary>' + filtered.length + ' Ziele aussortiert, warum?</summary><ul>' +
      filtered.map(function (f) { return '<li><strong>' + esc(f.dest.city) + '</strong>, ' + esc(f.dest.country) + ': ' + esc(f.reason) + '</li>'; }).join('') +
    '</ul></details>';
  }

  // ---------- Detailseite ----------

  function viewDetail(id) {
    var ranked = S.rank(Object.assign({}, answers, { excluded: [], maxFlight: 'egal' }), DATA);
    var r = ranked.results.filter(function (x) { return x.dest.id === id; })[0];
    if (!r) { render('<div class="empty"><h1>Ziel nicht gefunden</h1><a class="btn btn-primary" href="#/ergebnisse">Zu den Ergebnissen</a></div>'); return; }
    var d = r.dest;
    var position = S.rank(answers, DATA).results.map(function (x) { return x.dest.id; }).indexOf(id);
    var end = addDays(answers.startDate, answers.days);
    var people = answers.travellers;
    var safety = DATA.safety[d.cc];

    render(
      '<article class="detail">' +
        '<a class="back" href="#/ergebnisse">Zurück zu den Ergebnissen</a>' +
        '<header class="detail-head">' +
          '<div>' +
            '<p class="detail-rank">' + (position >= 0 ? 'Platz ' + (position + 1) + ' in deiner Liste' : 'Nicht in deiner Liste, weil du es ausgeschlossen hast') + '</p>' +
            '<h1>' + esc(d.city) + '<span>' + esc(d.country) + '</span></h1>' +
            '<p class="lead">' + esc(d.text) + '</p>' +
          '</div>' +
          '<div class="detail-score">' + flap(r.score) + '<small>von 100 Punkten</small></div>' +
        '</header>' +

        '<section class="factors" aria-label="Punkte je Kriterium">' +
          S.FACTORS.map(function (f) {
            var v = r.scores[f.key];
            return '<div class="factor"><span>' + f.label + '</span><span class="bar"><span class="' + scoreClass(v) + '" style="width:' + v + '%"></span></span><strong>' + v + '</strong></div>';
          }).join('') +
        '</section>' +

        '<div class="detail-grid">' +
          '<section class="panel">' +
            '<h2>Wetter im ' + MONTHS[r.month] + '</h2>' +
            '<div class="stats">' +
              stat('Höchstwert', Math.round(r.climate.t) + ' °C') +
              stat('Sonne pro Tag', Math.round(r.climate.sun) + ' h') +
              stat('Regentage', r.climate.rain) +
            '</div>' +
            climateChart(d.id, r.month) +
            '<div id="live-weather" class="live" aria-live="polite">Aktuelles Wetter wird geladen …</div>' +
            '<p class="source">Klimamittel ' + window.TG_CLIMATE.years[0] + ' bis ' + window.TG_CLIMATE.years[window.TG_CLIMATE.years.length - 1] + ' und Live-Wetter von Open-Meteo.</p>' +
          '</section>' +

          '<section class="panel">' +
            '<h2>Sicherheitslage</h2>' +
            safetyBadge(r.safety) +
            '<p>' + safetyText(r.safety) + '</p>' +
            (safety ? '<p><a href="' + esc(safety.url) + '" target="_blank" rel="noopener">Reise- und Sicherheitshinweise beim Auswärtigen Amt lesen</a></p>' : '') +
            '<p class="source">Auswärtiges Amt, Stand ' + (safety ? fmtDate(safety.updated) : 'unbekannt') + '.</p>' +
          '</section>' +

          '<section class="panel">' +
            '<h2>Kosten pro Person</h2>' +
            '<dl class="costs">' +
              '<div><dt>Flug hin und zurück ab ' + esc(ranked.airport.iata) + '</dt><dd>ca. ' + euro(r.flight.price) + '</dd></div>' +
              '<div><dt>Aufenthalt, ' + answers.days + ' Tage zu ca. ' + euro(d.dailyCost) + '</dt><dd>ca. ' + euro(r.stay) + '</dd></div>' +
              '<div class="total"><dt>Gesamt</dt><dd>ca. ' + euro(r.total) + '</dd></div>' +
              (people > 1 ? '<div><dt>Für ' + people + ' Personen</dt><dd>ca. ' + euro(r.total * people) + '</dd></div>' : '') +
            '</dl>' +
            '<span class="badge ' + (r.overBudget ? 'badge-teilwarnung' : 'badge-ok') + '">' + (r.overBudget ? euro(r.total - answers.budget) + ' über deinem Budget' : 'Im Budget von ' + euro(answers.budget)) + '</span>' +
            '<p class="source">Schätzung: Flug nach Entfernung (' + r.flight.km.toLocaleString('de-DE') + ' km, ca. ' + hours(r.flight.hours) + ') und Saison, Tageskosten als Richtwert. Live-Preise folgen.</p>' +
          '</section>' +
        '</div>' +

        '<section class="panel why">' +
          '<h2>Warum ' + esc(d.city) + '?</h2>' +
          '<div class="why-grid">' +
            '<div><h3>Spricht dafür</h3><ul class="pros">' + (r.reasons.pros.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') || '<li class="none">Wenig, was besonders heraussticht.</li>') + '</ul></div>' +
            '<div><h3>Spricht dagegen</h3><ul class="cons">' + (r.reasons.cons.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') || '<li class="none">Nichts Wesentliches.</li>') + '</ul></div>' +
          '</div>' +
          '<p class="tags">Passt zu: ' + d.tags.map(esc).join(', ') + '</p>' +
        '</section>' +

        '<section class="panel book">' +
          '<h2>Weiter zur Buchung</h2>' +
          '<p>Die Links öffnen die Suche mit deinen Daten: ' + fmtDate(answers.startDate) + ' bis ' + fmtDate(end) + ', ' + people + (people === 1 ? ' Person.' : ' Personen.') + '</p>' +
          '<div class="actions">' +
            '<a class="btn btn-primary" href="' + esc(flightLink(ranked.airport.iata, d.iata, answers.startDate, end, people)) + '" target="_blank" rel="noopener sponsored">Flüge bei Skyscanner vergleichen</a>' +
            '<a class="btn btn-secondary" href="' + esc(hotelLink(d, answers.startDate, end, people)) + '" target="_blank" rel="noopener sponsored">Unterkünfte bei Booking.com suchen</a>' +
          '</div>' +
          '<p class="source">Hinweis für später: Wenn hier Partnerlinks hinterlegt sind, erhalten wir ggf. eine Provision. Der Preis für dich bleibt gleich.</p>' +
        '</section>' +
      '</article>'
    );
    loadLiveWeather(d, answers.startDate, answers.days);
  }

  function stat(label, value) {
    return '<div class="stat"><small>' + label + '</small><strong>' + value + '</strong></div>';
  }

  function safetyText(s) {
    if (s.level === 'ok') return 'Für dieses Land gibt es derzeit keine Reisewarnung. Allgemeine Hinweise gelten trotzdem.';
    if (s.level === 'teilwarnung') return 'Für einzelne Regionen wird von Reisen abgeraten. Prüfe, ob dein Reiseort betroffen ist.';
    if (s.level === 'hinweis') return 'Das Auswärtige Amt weist auf besondere Risiken hin. Lies die Hinweise vor der Buchung.';
    if (s.level === 'warnung') return 'Es besteht eine Reisewarnung. Wir empfehlen dieses Ziel deshalb nicht.';
    return 'Für dieses Land liegen uns keine Daten vor.';
  }

  // Balkendiagramm der Tageshöchstwerte über das Jahr, der Reisemonat ist hervorgehoben.
  function climateChart(id, month) {
    var c = DATA.climate[id];
    if (!c) return '';
    var max = Math.max(35, Math.max.apply(null, c.map(function (m) { return m.t; })));
    var min = Math.min(0, Math.min.apply(null, c.map(function (m) { return m.t; })));
    var H = 90, W = 12 * 26;
    var y = function (t) { return H - ((t - min) / (max - min)) * H; };
    var bars = c.map(function (m, i) {
      var zero = y(0);
      var h = Math.max(2, Math.abs(zero - y(m.t)));
      var yy = m.t >= 0 ? zero - h : zero;
      return '<rect x="' + (i * 26 + 4) + '" y="' + yy.toFixed(1) + '" width="18" height="' + h.toFixed(1) + '" rx="3" class="' + (i === month ? 'on' : '') + '"><title>' + MONTHS[i] + ': ' + m.t + ' °C</title></rect>' +
        '<text x="' + (i * 26 + 13) + '" y="' + (H + 14) + '" text-anchor="middle">' + MONTHS_SHORT[i].charAt(0) + '</text>';
    }).join('');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + (H + 18) + '" role="img" aria-label="Tageshöchsttemperatur im Jahresverlauf, ' + MONTHS[month] + ' ' + c[month].t + ' °C">' + bars + '</svg>';
  }

  // Live-Wetter von Open-Meteo: aktuelle Lage und, wenn die Reise bald startet, die Vorhersage für die Reisetage.
  function loadLiveWeather(d, start, days) {
    var box = document.getElementById('live-weather');
    var until = daysUntil(start);
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + d.lat + '&longitude=' + d.lon +
      '&current=temperature_2m,weather_code&daily=temperature_2m_max,precipitation_probability_max&forecast_days=16&timezone=auto';
    fetch(url).then(function (res) {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    }).then(function (json) {
      if (!document.body.contains(box)) return;
      var now = '<p><strong>Gerade vor Ort:</strong> ' + Math.round(json.current.temperature_2m) + ' °C, ' + weatherWord(json.current.weather_code) + '.</p>';
      var forecast = '';
      if (until >= 0 && until < 16) {
        var idx = json.daily.time.indexOf(start);
        var slice = json.daily.time.slice(idx, idx + Math.min(days, 16 - until)).map(function (t, i) {
          return '<li><small>' + new Date(t + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' }) + '</small>' +
            Math.round(json.daily.temperature_2m_max[idx + i]) + ' °C<small>' + (json.daily.precipitation_probability_max[idx + i] || 0) + ' % Regen</small></li>';
        }).join('');
        forecast = '<p><strong>Vorhersage für deine Reise</strong></p><ul class="forecast">' + slice + '</ul>';
      } else if (until >= 16) {
        forecast = '<p class="hint">Eine Vorhersage für deine Reisetage gibt es ab 16 Tagen vor Abflug. Bis dahin zählen die Klimamittel.</p>';
      }
      box.innerHTML = now + forecast;
    }).catch(function () {
      if (document.body.contains(box)) box.textContent = 'Live-Wetter ist gerade nicht erreichbar. Die Klimamittel oben gelten trotzdem.';
    });
  }

  function weatherWord(code) {
    if (code === 0) return 'klarer Himmel';
    if (code <= 3) return 'teils bewölkt';
    if (code <= 48) return 'Nebel';
    if (code <= 67) return 'Regen';
    if (code <= 77) return 'Schnee';
    if (code <= 82) return 'Regenschauer';
    if (code <= 86) return 'Schneeschauer';
    return 'Gewitter';
  }

  function yymmdd(iso) { return iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10); }

  function flightLink(from, to, start, end, people) {
    var url = 'https://www.skyscanner.de/transport/fluge/' + from.toLowerCase() + '/' + to.toLowerCase() + '/' + yymmdd(start) + '/' + yymmdd(end) + '/?adultsv2=' + people;
    var id = window.TG_CONFIG.affiliate.skyscanner;
    return id ? url + '&associateid=' + encodeURIComponent(id) : url;
  }

  function hotelLink(d, start, end, people) {
    var city = d.city.replace(/\s*\(.*\)/, '');
    var url = 'https://www.booking.com/searchresults.de.html?ss=' + encodeURIComponent(city + ', ' + d.country) +
      '&checkin=' + start + '&checkout=' + end + '&group_adults=' + people + '&no_rooms=1';
    var id = window.TG_CONFIG.affiliate.booking;
    return id ? url + '&aid=' + encodeURIComponent(id) : url;
  }

  // ---------- Router ----------

  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/');
    document.querySelectorAll('[data-needs-answers]').forEach(function (a) { a.hidden = !answers.done; });
    if (parts[0] === 'fragen') return viewStep(Number(parts[1]) || 1);
    if (parts[0] === 'ergebnisse') return viewResults();
    if (parts[0] === 'ziel' && parts[1]) return viewDetail(parts[1]);
    viewStart();
  }

  document.getElementById('safety-date').textContent = fmtDate(window.TG_SAFETY.fetchedAt.slice(0, 10));
  window.addEventListener('hashchange', route);
  route();
})();

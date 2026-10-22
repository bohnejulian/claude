// Bewertungslogik: berechnet für jedes Reiseziel einen Match-Wert von 0 bis 100.
// Läuft im Browser (window.TGScoring) und in Node (require) für Tests.
(function (root) {
  'use strict';

  // Temperaturbereiche (Tageshöchstwert in °C) je Wunschklima.
  var CLIMATES = {
    heiss: { label: 'Richtig heiß', min: 29, max: 35 },
    warm: { label: 'Warm', min: 24, max: 30 },
    mild: { label: 'Mild', min: 17, max: 24 },
    kuehl: { label: 'Kühl', min: 6, max: 16 },
    schnee: { label: 'Schnee und Kälte', min: -15, max: 2 },
    egal: { label: 'Egal', min: 15, max: 32 }
  };

  // Maximale Flugdauer in Stunden (eine Strecke).
  var FLIGHT_LIMITS = { kurz: 4, mittel: 8, egal: Infinity };

  // Preisaufschlag je Abflugmonat (Ferien und Feiertage teurer).
  var SEASON = [0.85, 0.85, 0.95, 1.0, 1.0, 1.1, 1.3, 1.3, 1.05, 1.0, 0.85, 1.15];

  var FACTORS = [
    { key: 'weather', label: 'Wetter' },
    { key: 'price', label: 'Flugpreis' },
    { key: 'safety', label: 'Sicherheitslage' },
    { key: 'budget', label: 'Budget' },
    { key: 'interests', label: 'Interessen' }
  ];

  var DEFAULT_WEIGHTS = { weather: 3, price: 1, safety: 2, budget: 2, interests: 2 };

  // Faktoren, die als K.-o.-Kriterium wirken: liegt ihr Wert unter 40, sinkt der Gesamtwert zusätzlich.
  var DEALBREAKERS = ['weather', 'budget'];

  function eur(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'; }

  function clamp(v) { return Math.max(0, Math.min(100, Math.round(v))); }

  function distanceKm(a, b) {
    var rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad;
    var dLon = (b.lon - a.lon) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  // Schätzung für Hin- und Rückflug pro Person, bis echte Preise angebunden sind.
  function estimateFlight(airport, dest, month) {
    var km = distanceKm(airport, dest);
    var base = km < 1500 ? 40 + km * 0.07 : km < 4000 ? 60 + km * 0.065 : 200 + km * 0.045;
    var price = Math.round((base * (dest.flightFactor || 1) * SEASON[month]) / 5) * 5;
    var hours = Math.round((km / 780 + 0.6) * 4) / 4;
    return { km: Math.round(km), hours: hours, price: price, direct: km < 4500 };
  }

  function weatherScore(clim, pref) {
    var range = CLIMATES[pref] || CLIMATES.egal;
    var t = clim.t;
    var off = t < range.min ? range.min - t : t > range.max ? t - range.max : 0;
    var score = 100 - off * 8;
    score -= Math.max(0, clim.rain - 5) * 2.5;
    if (pref !== 'kuehl' && pref !== 'schnee') score += (clim.sun - 8) * 2;
    return clamp(score);
  }

  function safetyInfo(entry) {
    if (!entry) return { score: 80, level: 'unbekannt', text: 'Keine Daten vom Auswärtigen Amt' };
    if (entry.warning) return { score: 0, level: 'warnung', text: 'Reisewarnung', blocked: true };
    if (entry.partialWarning) return { score: 60, level: 'teilwarnung', text: 'Teilreisewarnung für einzelne Regionen' };
    if (entry.situationWarning) return { score: 75, level: 'hinweis', text: 'Sicherheitshinweis für das Land' };
    if (entry.situationPartWarning) return { score: 85, level: 'hinweis', text: 'Sicherheitshinweis für einzelne Regionen' };
    return { score: 100, level: 'ok', text: 'Keine Reisewarnung' };
  }

  function budgetScore(total, budget) {
    if (!budget) return 70;
    var ratio = total / budget;
    if (ratio <= 0.6) return 100;
    if (ratio <= 1) return clamp(100 - (ratio - 0.6) * 25);
    return clamp(90 - (ratio - 1) * 250);
  }

  function interestScore(tags, wanted) {
    if (!wanted || !wanted.length) return { score: 70, matched: [] };
    var matched = wanted.filter(function (i) { return tags.indexOf(i) >= 0; });
    return { score: clamp((matched.length / wanted.length) * 100), matched: matched };
  }

  function priceScore(price, cheapest) {
    // Doppelt so teuer wie der günstigste Flug = 70 Punkte, viermal so teuer = 40.
    return clamp(100 - (Math.log(price / cheapest) / Math.LN2) * 30);
  }

  // answers: { airport, startDate (YYYY-MM-DD), days, budget, climate, interests[], maxFlight, excluded[], weights{} }
  // data: { destinations, airports, climate, safety }
  function rank(answers, data) {
    var airport = data.airports.filter(function (a) { return a.iata === answers.airport; })[0] || data.airports[0];
    var month = answers.startDate ? Number(answers.startDate.slice(5, 7)) - 1 : new Date().getMonth();
    var days = Math.max(1, Number(answers.days) || 7);
    var weights = Object.assign({}, DEFAULT_WEIGHTS, answers.weights || {});
    var excluded = answers.excluded || [];
    var maxHours = FLIGHT_LIMITS[answers.maxFlight] || Infinity;
    var filtered = [];
    var candidates = [];

    data.destinations.forEach(function (d) {
      var flight = estimateFlight(airport, d, month);
      // Echter Preis aus der Flug-API, falls vorhanden (data.flightPrices[IATA] = { price, airline, transfers, link }).
      var live = data.flightPrices && data.flightPrices[d.iata];
      if (live && live.price) flight = Object.assign({}, flight, { price: Math.round(live.price), live: live });
      var safety = safetyInfo(data.safety[d.cc]);
      if (excluded.indexOf(d.cc) >= 0) return filtered.push({ dest: d, reason: 'Von dir ausgeschlossen' });
      if (safety.blocked) return filtered.push({ dest: d, reason: 'Reisewarnung des Auswärtigen Amts' });
      if (flight.hours > maxHours) return filtered.push({ dest: d, reason: 'Flug länger als ' + maxHours + ' Stunden' });
      candidates.push({ dest: d, flight: flight, safety: safety });
    });

    var cheapest = Math.min.apply(null, candidates.map(function (c) { return c.flight.price; }));

    var results = candidates.map(function (c) {
      var d = c.dest;
      var clim = data.climate[d.id] ? data.climate[d.id][month] : { t: 20, sun: 7, rain: 8 };
      var stay = d.dailyCost * days;
      var total = c.flight.price + stay;
      var interest = interestScore(d.tags, answers.interests);
      var scores = {
        weather: weatherScore(clim, answers.climate),
        price: priceScore(c.flight.price, cheapest),
        safety: c.safety.score,
        budget: budgetScore(total, Number(answers.budget)),
        interests: interest.score
      };
      var wsum = 0, sum = 0;
      FACTORS.forEach(function (f) { wsum += weights[f.key]; sum += scores[f.key] * weights[f.key]; });
      var score = wsum ? sum / wsum : 0;
      DEALBREAKERS.forEach(function (k) { if (weights[k] > 0 && scores[k] < 40) score *= 0.75 + scores[k] / 160; });
      score = Math.round(score);
      return {
        dest: d, score: score, scores: scores, climate: clim, month: month, days: days,
        flight: c.flight, safety: c.safety, stay: stay, total: total,
        overBudget: answers.budget ? total > Number(answers.budget) : false,
        matched: interest.matched,
        reasons: explain(d, scores, clim, c.flight, total, answers, interest.matched, c.safety)
      };
    }).sort(function (a, b) { return b.score - a.score; });

    return { results: results, filtered: filtered, airport: airport, month: month };
  }

  // Begründungen in Klartext: zuerst Stärken, dann Punkte, die gegen das Ziel sprechen.
  function explain(d, s, clim, flight, total, a, matched, safety) {
    var pros = [], cons = [];
    if (s.weather >= 75) pros.push('Im Reisemonat meist ' + Math.round(clim.t) + ' °C und rund ' + Math.round(clim.sun) + ' Sonnenstunden am Tag.');
    else if (s.weather < 50) cons.push('Das Wetter passt eher nicht: etwa ' + Math.round(clim.t) + ' °C und ' + clim.rain + ' Regentage im Monat.');
    if (a.budget && total <= a.budget) pros.push('Etwa ' + eur(total) + ' pro Person, das liegt in deinem Budget von ' + eur(a.budget) + '.');
    else if (a.budget) cons.push('Etwa ' + eur(total) + ' pro Person, das sind ' + eur(total - a.budget) + ' über deinem Budget.');
    if (matched.length) pros.push('Passt zu ' + matched.join(', ') + '.');
    if (a.interests && a.interests.length && matched.length < a.interests.length) {
      var missing = a.interests.filter(function (i) { return matched.indexOf(i) < 0; });
      if (missing.length === a.interests.length) cons.push('Bietet wenig für ' + missing.join(', ') + '.');
    }
    if (s.price >= 85) pros.push('Einer der günstigeren Flüge in der Auswahl.');
    else if (s.price < 40) cons.push('Der Flug kostet deutlich mehr als bei anderen Zielen in der Auswahl.');
    if (flight.hours > 8) cons.push('Lange Anreise, ungefähr ' + flight.hours.toString().replace('.', ',') + ' Stunden Flug.');
    if (safety.level === 'ok') pros.push('Keine Reisewarnung des Auswärtigen Amts.');
    else if (safety.level !== 'unbekannt') cons.push(safety.text + ', vor der Buchung die Hinweise lesen.');
    return { pros: pros, cons: cons };
  }

  var api = {
    CLIMATES: CLIMATES, FLIGHT_LIMITS: FLIGHT_LIMITS, FACTORS: FACTORS, DEFAULT_WEIGHTS: DEFAULT_WEIGHTS,
    distanceKm: distanceKm, estimateFlight: estimateFlight, weatherScore: weatherScore,
    safetyInfo: safetyInfo, budgetScore: budgetScore, rank: rank
  };
  root.TGScoring = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);

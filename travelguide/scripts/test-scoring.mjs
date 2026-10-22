// Schneller Plausibilitätstest der Bewertungslogik mit Beispielprofilen.
// Aufruf: node scripts/test-scoring.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadBrowserData, root } from './lib.mjs';

const require = createRequire(import.meta.url);
const S = require(root + 'js/scoring.js');
const w = loadBrowserData('js/data/destinations.js');
const data = {
  destinations: w.TG_DESTINATIONS,
  airports: w.TG_AIRPORTS,
  climate: loadBrowserData('js/data/climate.js').TG_CLIMATE.data,
  safety: loadBrowserData('js/data/safety.js').TG_SAFETY.data
};

function top(answers, n = 5) {
  const r = S.rank(answers, data);
  console.log(`\n${answers.name}`);
  r.results.slice(0, n).forEach((x, i) => console.log(`  ${i + 1}. ${x.dest.city.padEnd(22)} ${String(x.score).padStart(3)}  ${x.total} €  ${JSON.stringify(x.scores)}`));
  console.log(`  ausgefiltert: ${r.filtered.length}`);
  return r;
}

// Julian und Mia: 3 Wochen, warm, Strand und Kultur, Juni, schon in Portugal gewesen.
const julian = top({ name: 'Strand und Kultur, warm, Juni, 21 Tage, Portugal ausgeschlossen', airport: 'FRA', startDate: '2027-06-10', days: 21, budget: 2500, climate: 'warm', interests: ['Strand', 'Kultur'], maxFlight: 'kurz', excluded: ['PT'] });
assert.ok(julian.results.every(x => x.dest.cc !== 'PT'), 'Ausgeschlossene Länder dürfen nicht vorkommen');
assert.ok(julian.results.every(x => x.flight.hours <= 4), 'Flugdauer-Grenze wird eingehalten');

const winter = top({ name: 'Winter, warm, günstig, 10 Tage, 1.200 €', airport: 'MUC', startDate: '2027-01-15', days: 10, budget: 1200, climate: 'warm', interests: ['Strand', 'Ruhe'], maxFlight: 'egal', excluded: [] });
assert.ok(winter.results[0].climate.t >= 22, 'Im Januar mit Wunsch warm sollte das beste Ziel warm sein');

const snow = top({ name: 'Kalt, Natur, Dezember', airport: 'HAM', startDate: '2026-12-05', days: 7, budget: 2000, climate: 'schnee', interests: ['Natur', 'Abenteuer'], maxFlight: 'mittel', excluded: [] });
assert.ok(snow.results[0].climate.t <= 4, 'Wunsch Schnee liefert ein kühles Ziel');

const city = top({ name: 'Städtetrip, Wochenende, 400 €', airport: 'BER', startDate: '2027-04-02', days: 3, budget: 400, climate: 'egal', interests: ['Stadt', 'Nachtleben'], maxFlight: 'kurz', excluded: [] });
assert.ok(city.results[0].total <= 400 * 1.1, 'Kleines Budget liefert ein günstiges Ziel');

console.log('\nAlle Prüfungen bestanden.');

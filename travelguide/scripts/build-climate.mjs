// Erzeugt js/data/climate.js aus echten Wetterdaten der letzten drei Jahre (Open-Meteo Archiv, kostenlos, ohne Schlüssel).
// Pro Ziel und Monat: mittlere Tageshöchsttemperatur, Sonnenstunden pro Tag, Regentage (>= 1 mm) pro Monat.
// Aufruf: node scripts/build-climate.mjs            (alle Ziele)
//        node scripts/build-climate.mjs kreta rom  (nur diese Ziele neu laden, Rest bleibt)
import { existsSync } from 'node:fs';
import { loadBrowserData, writeBrowserData, root } from './lib.mjs';

const only = process.argv.slice(2);
const all = loadBrowserData('js/data/destinations.js').TG_DESTINATIONS;
const dests = only.length ? all.filter(d => only.includes(d.id)) : all;
const YEARS = [2023, 2024, 2025];
const BATCH = 4;

async function fetchBatch(batch) {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', batch.map(d => d.lat).join(','));
  url.searchParams.set('longitude', batch.map(d => d.lon).join(','));
  url.searchParams.set('start_date', `${YEARS[0]}-01-01`);
  url.searchParams.set('end_date', `${YEARS[YEARS.length - 1]}-12-31`);
  url.searchParams.set('daily', 'temperature_2m_max,sunshine_duration,precipitation_sum');
  url.searchParams.set('timezone', 'auto');
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json) ? json : [json];
    }
    console.warn(`Status ${res.status}, warte ...`);
    await new Promise(r => setTimeout(r, 20000 * attempt));
  }
  throw new Error('Open-Meteo antwortet nicht');
}

function monthly(daily) {
  const acc = Array.from({ length: 12 }, () => ({ t: 0, s: 0, n: 0, rain: 0 }));
  daily.time.forEach((day, i) => {
    const m = Number(day.slice(5, 7)) - 1;
    const t = daily.temperature_2m_max[i];
    if (t == null) return;
    const a = acc[m];
    a.t += t;
    a.s += (daily.sunshine_duration[i] || 0) / 3600;
    a.rain += (daily.precipitation_sum[i] || 0) >= 1 ? 1 : 0;
    a.n += 1;
  });
  return acc.map(a => ({
    t: Math.round((a.t / a.n) * 10) / 10,
    sun: Math.round((a.s / a.n) * 10) / 10,
    rain: Math.round((a.rain / a.n) * 30.4)
  }));
}

const out = only.length && existsSync(root + 'js/data/climate.js') ? loadBrowserData('js/data/climate.js').TG_CLIMATE.data : {};
for (let i = 0; i < dests.length; i += BATCH) {
  const batch = dests.slice(i, i + BATCH);
  const results = await fetchBatch(batch);
  batch.forEach((d, j) => { out[d.id] = monthly(results[j].daily); });
  console.log(`${Math.min(i + BATCH, dests.length)}/${dests.length} Ziele`);
}

writeBrowserData('js/data/climate.js', 'TG_CLIMATE', { source: 'Open-Meteo Archiv (ERA5)', years: YEARS, fetchedAt: new Date().toISOString(), data: out },
  'Klimamittel pro Ziel und Monat: t = Tageshöchsttemperatur in °C, sun = Sonnenstunden pro Tag, rain = Regentage pro Monat.');
console.log('climate.js geschrieben');

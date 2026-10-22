// Erzeugt js/data/safety.js aus den offenen Daten des Auswärtigen Amts.
// Die Schnittstelle erlaubt keinen direkten Abruf aus dem Browser (kein CORS), deshalb holen wir einen Schnappschuss.
// Aufruf: node scripts/update-safety.mjs  (später automatisch, z. B. täglich per GitHub Action oder Netlify-Funktion)
import { loadBrowserData, writeBrowserData } from './lib.mjs';

const { TG_DESTINATIONS: dests } = loadBrowserData('js/data/destinations.js');
const wanted = new Set(dests.map(d => d.cc));

const res = await fetch('https://www.auswaertiges-amt.de/opendata/travelwarning');
if (!res.ok) throw new Error(`Auswärtiges Amt antwortet mit ${res.status}`);
const json = await res.json();

const out = {};
for (const [id, entry] of Object.entries(json.response)) {
  if (!entry || !entry.countryCode || !wanted.has(entry.countryCode)) continue;
  out[entry.countryCode] = {
    name: entry.countryName,
    warning: !!entry.warning,
    partialWarning: !!entry.partialWarning,
    situationWarning: !!entry.situationWarning,
    situationPartWarning: !!entry.situationPartWarning,
    updated: new Date(entry.lastModified * 1000).toISOString().slice(0, 10),
    url: `https://www.auswaertiges-amt.de/de/service/laender/${id}`
  };
}

const missing = [...wanted].filter(cc => !out[cc]);
if (missing.length) console.warn('Keine Daten für:', missing.join(', '));

writeBrowserData('js/data/safety.js', 'TG_SAFETY', { source: 'Auswärtiges Amt, Reise- und Sicherheitshinweise (Open Data)', fetchedAt: new Date().toISOString(), data: out },
  'Reisewarnungen pro Land (ISO-Code): warning = Reisewarnung, partialWarning = Teilreisewarnung, situationWarning = Lagehinweis, situationPartWarning = regionaler Lagehinweis.');
console.log(`safety.js geschrieben (${Object.keys(out).length} Länder)`);

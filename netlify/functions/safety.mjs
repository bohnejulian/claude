// /api/safety: holt die aktuellen Reisewarnungen des Auswärtigen Amts.
// Nötig, weil die Schnittstelle keinen direkten Abruf aus dem Browser erlaubt (kein CORS).
// Antwort im selben Format wie js/data/safety.js, eine Stunde im Cache.
export default async () => {
  const res = await fetch('https://www.auswaertiges-amt.de/opendata/travelwarning');
  if (!res.ok) return Response.json({ error: `Auswärtiges Amt antwortet mit ${res.status}` }, { status: 502 });
  const json = await res.json();
  const data = {};
  for (const [id, e] of Object.entries(json.response)) {
    if (!e || !e.countryCode) continue;
    data[e.countryCode] = {
      name: e.countryName,
      warning: !!e.warning,
      partialWarning: !!e.partialWarning,
      situationWarning: !!e.situationWarning,
      situationPartWarning: !!e.situationPartWarning,
      updated: new Date(e.lastModified * 1000).toISOString().slice(0, 10),
      url: `https://www.auswaertiges-amt.de/de/service/laender/${id}`
    };
  }
  return Response.json(
    { source: 'Auswärtiges Amt, Reise- und Sicherheitshinweise (Open Data)', fetchedAt: new Date().toISOString(), data },
    { headers: { 'cache-control': 'public, max-age=3600' } }
  );
};

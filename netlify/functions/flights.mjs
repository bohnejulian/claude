// /api/flights?origin=FRA&month=2027-06&dest=LIS,BCN,...
// Günstigste gefundene Hin- und Rückflüge pro Ziel aus der Travelpayouts Data API (Aviasales).
// Braucht die Umgebungsvariable TRAVELPAYOUTS_TOKEN (kostenloses Konto bei travelpayouts.com).
// Ohne Token antwortet die Funktion mit 503, die Website nutzt dann weiter die Schätzung.
const API = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates';
const MAX_DEST = 15;

export default async (req) => {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) return Response.json({ error: 'Kein TRAVELPAYOUTS_TOKEN hinterlegt' }, { status: 503 });

  const q = new URL(req.url).searchParams;
  const origin = (q.get('origin') || '').toUpperCase();
  const month = q.get('month') || '';
  const dests = (q.get('dest') || '').toUpperCase().split(',').filter(x => /^[A-Z]{3}$/.test(x)).slice(0, MAX_DEST);
  if (!/^[A-Z]{3}$/.test(origin) || !/^\d{4}-\d{2}$/.test(month) || !dests.length) {
    return Response.json({ error: 'origin, month (JJJJ-MM) und dest werden gebraucht' }, { status: 400 });
  }

  const marker = process.env.TRAVELPAYOUTS_MARKER || '';
  const prices = {};
  await Promise.all(dests.map(async (dest) => {
    const url = new URL(API);
    url.search = new URLSearchParams({
      origin, destination: dest, departure_at: month, return_at: month,
      currency: 'eur', sorting: 'price', one_way: 'false', limit: '1', token
    });
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const json = await res.json();
      const f = json.data && json.data[0];
      if (!f) return;
      prices[dest] = {
        price: f.price,
        airline: f.airline,
        transfers: f.transfers,
        departureAt: f.departure_at,
        returnAt: f.return_at,
        link: f.link ? `https://www.aviasales.com${f.link}${marker ? `&marker=${marker}` : ''}` : null
      };
    } catch { /* einzelnes Ziel ohne Preis ist okay */ }
  }));

  return Response.json(
    { source: 'Travelpayouts / Aviasales, zwischengespeicherte Preise', fetchedAt: new Date().toISOString(), origin, month, prices },
    { headers: { 'cache-control': 'public, max-age=1800' } }
  );
};

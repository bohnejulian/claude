# Travelguide – 1. Entwurf (unbearbeitet)

Eine Website, die in sechs Fragen das passende nächste Reiseziel findet. Reines HTML, CSS und JavaScript, ohne Build-Schritt.

## Ausprobieren

- Einfach `index.html` im Browser öffnen, oder
- `node scripts/serve.mjs` starten und http://localhost:8090 öffnen. Dann laufen auch die Server-Funktionen unter `/api/...` (Live-Sicherheitslage, mit Token auch Live-Flugpreise).

## Online stellen mit Netlify

1. Bei netlify.com anmelden, „Add new site“ → „Import an existing project“ → GitHub-Repo `bohnejulian/claude` wählen. Die Einstellungen kommen aus `netlify.toml` (veröffentlicht `travelguide/`, Funktionen aus `netlify/functions/`).
2. Für Live-Flugpreise: kostenloses Konto bei travelpayouts.com anlegen, API-Token kopieren und bei Netlify unter „Site configuration“ → „Environment variables“ als `TRAVELPAYOUTS_TOKEN` eintragen. Optional `TRAVELPAYOUTS_MARKER` (Affiliate-Kennung).
3. Neu veröffentlichen. Ohne Token funktioniert alles weiter, dann mit geschätzten Flugpreisen.

Nur per Drag-and-drop (app.netlify.com/drop) geht auch, dann aber ohne Server-Funktionen.

## Server-Funktionen

| Adresse | Datei | Was |
| --- | --- | --- |
| `/api/safety` | `netlify/functions/safety.mjs` | Aktuelle Reisewarnungen des Auswärtigen Amts (der Browser darf die Schnittstelle nicht direkt abfragen) |
| `/api/flights?origin=FRA&month=2027-06&dest=LIS,BCN` | `netlify/functions/flights.mjs` | Günstigste Hin- und Rückflüge pro Ziel im Reisemonat (Travelpayouts/Aviasales), braucht `TRAVELPAYOUTS_TOKEN` |

Die Website fragt beide an, wenn sie über einen Server läuft. Klappt das nicht, nutzt sie den Schnappschuss in `js/data/safety.js` und die Flugpreis-Schätzung. Live-Preise sind in der Ergebnisliste mit „Flug live“ markiert.

## Seiten

| Adresse | Inhalt |
| --- | --- |
| `#/` | Startseite mit Beispiel-Abflugtafel |
| `#/fragen/1` bis `#/fragen/6` | Fragebogen: Abflug und Zeitraum, Budget, Wunschklima, Interessen, Flugzeit und ausgeschlossene Länder, Gewichtung |
| `#/ergebnisse` | Top 10 als Abflugtafel mit Begründung, Gewichtung live verstellbar, Liste der aussortierten Ziele mit Grund |
| `#/ziel/<id>` | Detailseite: Punkte je Kriterium, Klima im Jahresverlauf, Live-Wetter, Sicherheitslage, Kosten, Buchungslinks, Merken |
| `#/merkliste` | Gemerkte Ziele nebeneinander im Vergleich |
| `#/impressum`, `#/datenschutz` | Platzhaltertexte, vor dem Livegang ausfüllen |

Antworten und Merkliste bleiben im Browser gespeichert (localStorage).

## Bewertungslogik (`js/scoring.js`)

Jedes Ziel bekommt 0 bis 100 Punkte in fünf Kriterien, gewichtet nach den Reglern des Nutzers (Standard: Wetter 3, Flugpreis 1, Sicherheit 2, Budget 2, Interessen 2):

- **Wetter:** Tageshöchsttemperatur im Reisemonat gegen das Wunschklima (heiß 29–35 °C, warm 24–30, mild 17–24, kühl 6–16, Schnee bis 2 °C). Pro Grad Abweichung 8 Punkte Abzug, Abzug für mehr als 5 Regentage, kleiner Bonus für Sonnenstunden.
- **Flugpreis:** relativ zum günstigsten Ziel in der Auswahl. Doppelt so teuer = 70 Punkte, viermal so teuer = 40.
- **Sicherheitslage:** Auswärtiges Amt. Keine Warnung 100, regionaler Hinweis 85, Hinweis 75, Teilreisewarnung 60. Bei einer Reisewarnung fliegt das Ziel raus.
- **Budget:** Flug plus Tageskosten mal Reisetage gegen das Budget pro Person. Bis 60 % des Budgets 100 Punkte, beim vollen Budget 90, danach fällt der Wert schnell.
- **Interessen:** Anteil der gewählten Interessen, die das Ziel bietet.

Wetter und Budget wirken zusätzlich als K.-o.-Kriterium: Liegt einer der beiden unter 40 Punkten, sinkt der Gesamtwert um bis zu 25 %.
Harte Filter: ausgeschlossene Länder, Reisewarnung, Flug länger als die gewählte maximale Flugzeit.

`node scripts/test-scoring.mjs` prüft die Logik mit vier Beispielprofilen.

## Daten

| Datei | Inhalt | Quelle | Aktualisieren |
| --- | --- | --- | --- |
| `js/data/destinations.js` | 53 Ziele mit Koordinaten, Flughafen, Tags, Tageskosten | von Hand, Tageskosten geschätzt | von Hand |
| `js/data/climate.js` | Klimamittel pro Monat (Höchstwert, Sonne, Regentage) | Open-Meteo Archiv, 2023–2025 | `node scripts/build-climate.mjs` |
| `js/data/safety.js` | Reisewarnungen pro Land | Auswärtiges Amt Open Data | `node scripts/update-safety.mjs` |
| Live im Browser | aktuelles Wetter und 16-Tage-Vorhersage | Open-Meteo Forecast | automatisch |

**Flugpreise:** mit `TRAVELPAYOUTS_TOKEN` live für die angezeigten Ziele, sonst Schätzung (Entfernung, Saison, Ziel-Faktor).

## Offene Punkte

- Travelpayouts-Token eintragen und die Live-Preise mit echten Antworten testen (die Funktion ist gebaut, aber noch nicht mit echtem Token geprüft).
- Google Fonts lokal einbinden (Datenschutz).
- Tageskosten mit echten Daten belegen (z. B. Hotelpreise über eine Partner-API).
- Fotos pro Ziel.
- Affiliate-Kennungen in `js/config.js` eintragen, sobald die Partnerprogramme stehen, plus Kennzeichnung und Impressum/Datenschutz.

# EdgeLog — Trading Backtesting

Minimalistische Next.js-Web-App zur schnellen Erfassung und statistischen Auswertung von Backtest-Trades. Ein Chart-Screenshot kann serverseitig durch Anthropic Claude ausgelesen werden; unsichere Werte bleiben leer und alle erkannten Werte sind bearbeitbar.

## Funktionen

- Schnelle Trade-Erfassung mit Drag-and-Drop-Screenshot
- Kennzeichnung jedes Eintrags als Backtest oder echter Live Trade
- Strukturierte KI-Extraktion ohne Bewertung des Trades
- Eigener „Kein Trade“-Modus für bewusst ausgelassene Entries und unlogische Setups
- Automatische Berechnung des geplanten Risk-to-Reward
- Frei verwaltbare Tags und Kategorien
- Trade-Tabelle mit Zeitraum-, Instrument-, Richtungs-, Ergebnis-, Confidence-, Kontext-, R:R- und Mehrfach-Tag-Filtern
- Detailansicht, Bearbeitung und Löschung
- Kennzahlen: Trades, Kein Trade, Wins, Losses, Break-even, Winrate, Ø R, Gesamt-R, Ø Gewinner/Verlierer, Ø geplantes R:R, Profit Factor und Expectancy
- Vollständig getrennte Analyse von Backtests und Live Trades
- Analyse einzelner Tags und beliebiger Tag-Kombinationen
- Direkter Vergleich zweier Tag-Gruppen
- Private Supabase-Storage-Bucket für Screenshots

## Technischer Aufbau

- Next.js 16 mit App Router und TypeScript
- Tailwind CSS
- Supabase Postgres und Supabase Storage
- Anthropic Messages API mit strukturiertem JSON-Schema
- Vercel-kompatible Route Handler

Der `SUPABASE_SERVICE_ROLE_KEY` und der `ANTHROPIC_API_KEY` werden ausschließlich in serverseitigen Route Handlern verwendet. Sie werden niemals an den Browser ausgeliefert.

## 1. Lokal einrichten

Voraussetzung: Node.js in einer von Next.js unterstützten Version.

```powershell
npm.cmd install
Copy-Item .env.example .env.local
```

Anschließend die Werte in `.env.local` eintragen.

## 2. Supabase vorbereiten

1. Ein neues Supabase-Projekt erstellen.
2. Im Supabase SQL Editor die Dateien aus `supabase/migrations/` in numerischer Reihenfolge vollständig ausführen.
3. Unter **Project Settings → API** die Project URL und den `service_role`-Key kopieren.
4. Folgende Werte in `.env.local` eintragen:

```env
NEXT_PUBLIC_SUPABASE_URL=https://IHR_PROJEKT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=IHR_SERVICE_ROLE_KEY
```

Das SQL-Schema erstellt:

- `trades`
- `tags`
- `trade_tags`
- optionale Nachbetrachtungen pro Trade
- Eintragstyp für Backtest oder Live Trade; bestehende Einträge bleiben Backtests
- `tag_categories`
- Indizes für die wichtigsten Filter
- den privaten Storage-Bucket `trade-screenshots`
- alle Startkategorien und Start-Tags

Row Level Security ist auf allen Tabellen aktiv. Der Browser greift nicht direkt auf Supabase zu; sämtliche Datenoperationen laufen serverseitig über die App.

## 3. Anthropic konfigurieren

Einen API-Key in der Anthropic Console erstellen und ausschließlich serverseitig eintragen:

```env
ANTHROPIC_API_KEY=IHR_ANTHROPIC_API_KEY
ANTHROPIC_VISION_MODEL=claude-haiku-4-5
```

`ANTHROPIC_VISION_MODEL` ist optional. Das gewählte Modell muss Bildeingaben und strukturierte Ausgaben unterstützen.

Die Analyse ist ausdrücklich auf sichtbare Datenerfassung beschränkt. Nicht zuverlässig erkennbare Angaben werden als `null` zurückgegeben. Die KI bewertet weder Setup noch Entry.
Nicht erkannte Confidence-Werte werden mit `0` ausgegeben, damit das strukturierte Schema innerhalb der Anthropic-Grenzen bleibt.

## 4. Starten und prüfen

```powershell
npm.cmd run dev
```

Danach `http://localhost:3000` öffnen.

Qualitätsprüfungen:

```powershell
npm.cmd run lint
npm.cmd run build
```

## 5. Auf Vercel bereitstellen

1. Das Projekt in ein Git-Repository übertragen und mit Vercel verbinden.
2. In den Vercel Project Settings alle Variablen aus `.env.example` anlegen.
3. `NEXT_PUBLIC_APP_URL` auf die endgültige HTTPS-Domain setzen.
4. Deployment ausführen. Zusätzliche Build-Einstellungen sind nicht erforderlich.

### Wichtiger Zugriffsschutz

Das MVP ist als persönliche Single-User-App ohne eigenes Login ausgelegt. Die API-Endpunkte verwenden serverseitig den Supabase-Service-Key. Eine öffentlich erreichbare Instanz muss deshalb über Vercel Deployment Protection oder eine vorgeschaltete Authentifizierung geschützt werden. Ohne Zugriffsschutz könnten Dritte Daten lesen oder verändern. Der Service-Key selbst bleibt trotzdem serverseitig und darf niemals das Präfix `NEXT_PUBLIC_` erhalten.

## Daten- und Screenshot-Schutz

- Screenshots liegen in einem privaten Bucket.
- Die App erzeugt nur kurzlebige signierte URLs zur Anzeige.
- Bilder werden vor der Analyse clientseitig verkleinert, wenn sie zu groß sind.
- Der Anthropic-Aufruf und der Supabase-Upload erfolgen serverseitig.
- In Git werden `.env` und `.env.local` ignoriert.

## Kennzahlen

- **Winrate:** Gewinner / alle gefilterten Trades
- **Kein Trade:** Wird separat gezählt und nicht in Winrate oder R-Kennzahlen einbezogen
- **Ø R / Expectancy:** Summe der vorhandenen R-Ergebnisse / Trades mit R-Ergebnis
- **Profit Factor:** Summe positiver R-Ergebnisse / Betrag der Summe negativer R-Ergebnisse
- **Tag-Kombination:** Ein Trade wird nur berücksichtigt, wenn er alle ausgewählten Tags enthält
- **Backtest/Live:** Beide Bereiche werden getrennt berechnet und nicht miteinander vermischt

MFE und MAE sind optionale numerische Felder und werden gespeichert, derzeit aber nicht als eigene Analysekennzahl verwendet.

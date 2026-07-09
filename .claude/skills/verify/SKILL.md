---
name: verify
description: Zeitkonto-App lokal starten und end-to-end im Browser verifizieren (statische PWA, kein Build)
---

# Zeitkonto verifizieren

Statische App — kein Build. Oberfläche = Browser.

## Starten

```bash
cd <repo> && python -m http.server 8123   # im Hintergrund
```

## Fahren (Playwright, headless)

Kein lokales Playwright-Paket; die Bibliothek liegt gebündelt in der globalen CLI.
Browser der `chromium_headless_shell` fehlt → Chrome-Channel nutzen:

```js
const { chromium } = require('C:/Users/anash/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
```

## Gotchas

- Frischer Browser-Kontext = leerer localStorage = keine Mitarbeiter → `#bilanz`/Kacheln
  versteckt. Entweder per UI anlegen (`#f-name` → `#btn-save-emp`) oder Daten per
  `addInitScript` unter Key `zeitkonto:v1` seeden (`{employees:[…], entries:{empId:{…}}}`).
- App startet im aktuellen Monat; zu Januar 2026 mit `#btn-prev`-Klicks navigieren
  (bei Startmonat ist der Button disabled).
- Zeit-/Zahlfelder: nach `fill()` ein `dispatchEvent('change')` nötig, damit die App speichert.
- `innerText`-Assertions: Überschriften sind CSS-uppercase → case-insensitiv vergleichen.
- Sinnvolle Flows: Mitarbeiter mit Übertrag anlegen → Team-Liste prüfen; Tag buchen →
  Bilanz unter der Tagesliste prüfen; Monat weiter → Übertrag Vormonate; Reload → Persistenz;
  `emulateMedia({media:'print'})` → Bilanz sichtbar, Kacheln versteckt.

## Rechenlogik separat

`node tests/logic.test.js` (reine Logik, ersetzt aber keine Browser-Verifikation).

# Zeitkonto — Arbeitszeiterfassung für den Elektromeister

Web-App (reines HTML/CSS/JS, kein Build, kein Backend) zur Arbeitszeiterfassung und Urlaubsverwaltung.
Alle Daten liegen im `localStorage` des Nutzers — es gibt bewusst keinen Server (DSGVO-unkritisch).

## Dateien

- `index.html` — komplette App (UI + Anwendungslogik inline)
- `logic.js` — reine Rechenlogik ohne DOM (Ist/Soll/Saldo in **Minuten**, Feiertage Hessen,
  Monatsübertrag ab Januar 2026, Urlaubskonto); wird von index.html UND den Tests genutzt
- `tests/logic.test.js` — Node-Tests: `node tests/logic.test.js`
- `sw.js`, `manifest.webmanifest`, `icon-*.png` — PWA (offline, installierbar)

## Fachliche Regeln (mit dem Meister abgestimmt)

- Händische Eingabe NUR: Beginn, Ende, Pause (Minuten), Bemerkung — alles andere rechnet die App
- Bemerkung (Urlaub/Krank/Seminar/Schule) an einem Arbeitstag ⇒ Ist = Soll, Saldo ±0
- Ein Tag zählt erst, wenn Beginn UND Ende gesetzt sind oder eine Bemerkung an einem Arbeitstag steht —
  leere Tage erzeugen KEINE Minusstunden
- Soll: Mo–Fr = Soll-Std./Tag (Standard 8), Sa/So/Feiertag = 0; Arbeit dort zählt als Plus
- Zeitkonto = kumulierter Saldo ab Januar 2026 (Startmonat, fest)
- Urlaubszählung: nur Arbeitstage; Resturlaub bezieht sich aufs angezeigte Jahr

## Entwicklung

- Nach Logik-Änderungen immer `node tests/logic.test.js` laufen lassen
- Bei Änderungen an gecachten Dateien die `VERSION` in `sw.js` hochzählen (sonst sehen
  installierte Apps das Update erst spät)
- Anzeige-Format ist H:MM (z. B. `+0:45`), intern wird ausschließlich in Minuten gerechnet

## Deployment

GitHub Pages, Repo `zeitkonto` (Account anashegazi933-lab, öffentlich — enthält nur Code, keine Personendaten).
Live: https://anashegazi933-lab.github.io/zeitkonto/ — deploy = push auf `main`.

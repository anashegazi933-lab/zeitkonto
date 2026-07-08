/* Zeitkonto — Rechenlogik (ohne DOM, wird auch von den Node-Tests genutzt).
   Alle Zeitwerte intern in Minuten, damit keine Rundungsfehler entstehen. */
const ZK = (() => {
  const BEMERKUNGEN = ['Urlaub', 'Krank', 'Seminar', 'Schule'];
  const START_JAHR = 2026;
  const START_MONAT = 1;

  const pad2 = (n) => String(n).padStart(2, '0');
  const dateKey = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
  const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
  const weekday = (y, m, d) => new Date(y, m - 1, d).getDay(); // 0 = So

  // Ostersonntag nach Meeus/Jones/Butcher
  function easterSunday(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100;
    const d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }

  // Gesetzliche Feiertage in Hessen: Key "JJJJ-MM-TT" -> Name
  function holidays(year) {
    const map = {};
    const fixed = [
      [1, 1, 'Neujahr'],
      [5, 1, 'Tag der Arbeit'],
      [10, 3, 'Tag der Deutschen Einheit'],
      [12, 25, '1. Weihnachtstag'],
      [12, 26, '2. Weihnachtstag'],
    ];
    fixed.forEach(([m, d, name]) => { map[dateKey(year, m, d)] = name; });
    const easter = easterSunday(year);
    const rel = [
      [-2, 'Karfreitag'],
      [1, 'Ostermontag'],
      [39, 'Christi Himmelfahrt'],
      [50, 'Pfingstmontag'],
      [60, 'Fronleichnam'],
    ];
    rel.forEach(([offset, name]) => {
      const dt = new Date(easter.getTime());
      dt.setDate(dt.getDate() + offset);
      map[dateKey(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())] = name;
    });
    return map;
  }

  function parseTime(t) {
    if (!t || typeof t !== 'string') return null;
    const parts = t.split(':');
    if (parts.length !== 2) return null;
    const h = Number(parts[0]), m = Number(parts[1]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  }

  // Soll in Minuten: Mo–Fr = Soll-Std./Tag, Sa/So/Feiertag = 0
  function sollMin(emp, y, m, d, hol) {
    const wd = weekday(y, m, d);
    if (wd === 0 || wd === 6) return 0;
    if (hol[dateKey(y, m, d)]) return 0;
    return Math.round((Number(emp.sollStdProTag) || 8) * 60);
  }

  /* Tagesberechnung. Regel fürs Zeitkonto: ein Tag zählt erst, wenn Beginn UND Ende
     eingetragen sind oder eine Bemerkung an einem Arbeitstag gesetzt ist.
     Bemerkung an einem Arbeitstag: Ist = Soll, Saldo 0 (Vorgabe des Meisters). */
  function dayCalc(emp, entry, y, m, d, hol) {
    const wd = weekday(y, m, d);
    const weekend = wd === 0 || wd === 6;
    const holidayName = hol[dateKey(y, m, d)] || null;
    const soll = sollMin(emp, y, m, d, hol);
    const e = entry || {};
    const bem = e.bemerkung || '';

    if (bem && soll > 0) {
      return { soll, ist: soll, saldo: 0, counted: true, special: bem, weekend, holidayName, wd };
    }
    const s = parseTime(e.start), en = parseTime(e.ende);
    if (s !== null && en !== null) {
      let diff = en - s;
      if (diff < 0) diff += 24 * 60; // Nachtschicht über Mitternacht
      diff -= Math.max(0, parseInt(e.pauseMin, 10) || 0);
      if (diff < 0) diff = 0;
      return { soll, ist: diff, saldo: diff - soll, counted: true, special: null, weekend, holidayName, wd };
    }
    return { soll, ist: 0, saldo: 0, counted: false, special: bem || null, weekend, holidayName, wd };
  }

  // Monatsberechnung: Zeilen + Summen (nur gebuchte Tage zählen in Ist/Saldo)
  function monthCalc(emp, empEntries, y, m) {
    const hol = holidays(y);
    const entries = empEntries || {};
    const rows = [];
    let sollMonat = 0, sollGebucht = 0, ist = 0, saldo = 0, urlaub = 0;
    const n = daysInMonth(y, m);
    for (let d = 1; d <= n; d++) {
      const r = dayCalc(emp, entries[dateKey(y, m, d)], y, m, d, hol);
      rows.push(Object.assign({ d }, r));
      sollMonat += r.soll;
      if (r.counted) {
        sollGebucht += r.soll;
        ist += r.ist;
        saldo += r.saldo;
        if (r.special === 'Urlaub') urlaub++;
      }
    }
    return { rows, sollMonat, sollGebucht, ist, saldo, urlaub };
  }

  // Übertrag: Summe aller Monatssalden von Januar 2026 bis zum Monat VOR (y, m)
  function carryOverMin(emp, empEntries, y, m) {
    let sum = 0;
    let cy = START_JAHR, cm = START_MONAT;
    while (cy < y || (cy === y && cm < m)) {
      sum += monthCalc(emp, empEntries, cy, cm).saldo;
      cm++;
      if (cm > 12) { cm = 1; cy++; }
    }
    return sum;
  }

  // Genommene Urlaubstage im Jahr (nur Arbeitstage zählen)
  function vacationUsed(emp, empEntries, year) {
    let used = 0;
    for (let m = 1; m <= 12; m++) used += monthCalc(emp, empEntries, year, m).urlaub;
    return used;
  }

  function vacationRemaining(emp, empEntries, year) {
    return (Number(emp.urlaubstageJahr) || 0) - vacationUsed(emp, empEntries, year);
  }

  // Formatierung: Minuten -> "8:45" bzw. mit Vorzeichen "+0:45" / "−2:30" / "±0:00"
  function fmtMin(min) {
    const abs = Math.abs(Math.round(min));
    return `${Math.floor(abs / 60)}:${pad2(abs % 60)}`;
  }
  function fmtSigned(min) {
    const r = Math.round(min);
    const sign = r > 0 ? '+' : (r < 0 ? '−' : '±');
    return sign + fmtMin(r);
  }

  return {
    BEMERKUNGEN, START_JAHR, START_MONAT,
    pad2, dateKey, daysInMonth, weekday,
    easterSunday, holidays, parseTime, sollMin,
    dayCalc, monthCalc, carryOverMin, vacationUsed, vacationRemaining,
    fmtMin, fmtSigned,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ZK;

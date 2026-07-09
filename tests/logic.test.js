/* Tests für die Zeitkonto-Rechenlogik: node tests/logic.test.js */
const assert = require('node:assert');
const ZK = require('../logic.js');

const emp = { sollStdProTag: 8, urlaubstageJahr: 30 };
let passed = 0;
function t(name, fn) { fn(); passed++; console.log('ok - ' + name); }

// --- Zeit-Parsing & Formatierung ---
t('parseTime', () => {
  assert.strictEqual(ZK.parseTime('07:00'), 420);
  assert.strictEqual(ZK.parseTime(''), null);
  assert.strictEqual(ZK.parseTime(null), null);
});
t('fmtMin / fmtSigned', () => {
  assert.strictEqual(ZK.fmtMin(525), '8:45');
  assert.strictEqual(ZK.fmtSigned(45), '+0:45');
  assert.strictEqual(ZK.fmtSigned(-150), '−2:30');
  assert.strictEqual(ZK.fmtSigned(0), '±0:00');
});

// --- Feiertage Hessen 2026 (Ostersonntag 2026 = 05.04.) ---
t('Feiertage 2026', () => {
  const h = ZK.holidays(2026);
  assert.strictEqual(h['2026-01-01'], 'Neujahr');
  assert.strictEqual(h['2026-04-03'], 'Karfreitag');
  assert.strictEqual(h['2026-04-06'], 'Ostermontag');
  assert.strictEqual(h['2026-05-14'], 'Christi Himmelfahrt');
  assert.strictEqual(h['2026-05-25'], 'Pfingstmontag');
  assert.strictEqual(h['2026-06-04'], 'Fronleichnam');
  assert.strictEqual(h['2026-12-25'], '1. Weihnachtstag');
  assert.strictEqual(Object.keys(h).length, 10);
});

// --- Tagesberechnung ---
const hol26 = ZK.holidays(2026);
t('Normaler Arbeitstag: 07:00–16:30, 45 min Pause => Ist 8:45, Saldo +0:45', () => {
  // Mi 07.01.2026
  const r = ZK.dayCalc(emp, { start: '07:00', ende: '16:30', pauseMin: 45 }, 2026, 1, 7, hol26);
  assert.strictEqual(r.soll, 480);
  assert.strictEqual(r.ist, 525);
  assert.strictEqual(r.saldo, 45);
  assert.strictEqual(r.counted, true);
});
t('Wochenende: Soll 0, Arbeit zählt als Plus', () => {
  // Sa 10.01.2026
  const r = ZK.dayCalc(emp, { start: '08:00', ende: '12:00', pauseMin: 0 }, 2026, 1, 10, hol26);
  assert.strictEqual(r.soll, 0);
  assert.strictEqual(r.saldo, 240);
  assert.strictEqual(r.weekend, true);
});
t('Feiertag (Karfreitag 03.04.2026): Soll 0', () => {
  const r = ZK.dayCalc(emp, {}, 2026, 4, 3, hol26);
  assert.strictEqual(r.soll, 0);
  assert.strictEqual(r.holidayName, 'Karfreitag');
  assert.strictEqual(r.counted, false);
});
t('Bemerkung Urlaub am Arbeitstag: Ist = Soll, Saldo 0', () => {
  const r = ZK.dayCalc(emp, { bemerkung: 'Urlaub' }, 2026, 1, 7, hol26);
  assert.strictEqual(r.ist, 480);
  assert.strictEqual(r.saldo, 0);
  assert.strictEqual(r.special, 'Urlaub');
  assert.strictEqual(r.counted, true);
});
t('Bemerkung am Samstag zählt nicht', () => {
  const r = ZK.dayCalc(emp, { bemerkung: 'Urlaub' }, 2026, 1, 10, hol26);
  assert.strictEqual(r.counted, false);
});
t('Nicht ausgefüllter Tag zählt nicht (kein Minus)', () => {
  const r = ZK.dayCalc(emp, undefined, 2026, 1, 7, hol26);
  assert.strictEqual(r.counted, false);
  assert.strictEqual(r.saldo, 0);
});
t('Nur Beginn ohne Ende zählt noch nicht', () => {
  const r = ZK.dayCalc(emp, { start: '07:00' }, 2026, 1, 7, hol26);
  assert.strictEqual(r.counted, false);
});
t('Nachtschicht über Mitternacht: 22:00–06:00 => 8:00', () => {
  const r = ZK.dayCalc(emp, { start: '22:00', ende: '06:00', pauseMin: 0 }, 2026, 1, 7, hol26);
  assert.strictEqual(r.ist, 480);
});
t('Beginn = Ende: Ist 0, Saldo −8:00 (Fehltag bewusst buchen)', () => {
  const r = ZK.dayCalc(emp, { start: '00:00', ende: '00:00', pauseMin: 0 }, 2026, 1, 7, hol26);
  assert.strictEqual(r.counted, true);
  assert.strictEqual(r.saldo, -480);
});

// --- Monat & Übertrag ---
t('Monatssummen & Übertrag in den Folgemonat', () => {
  const entries = {
    '2026-01-07': { start: '07:00', ende: '17:00', pauseMin: 60 }, // Ist 9:00, +1:00
    '2026-01-08': { start: '07:00', ende: '15:00', pauseMin: 30 }, // Ist 7:30, −0:30
    '2026-01-09': { bemerkung: 'Urlaub' },                          // ±0, 1 Urlaubstag
  };
  const m = ZK.monthCalc(emp, entries, 2026, 1);
  assert.strictEqual(m.ist, 540 + 450 + 480);
  assert.strictEqual(m.saldo, 30);
  assert.strictEqual(m.urlaub, 1);
  // Januar 2026 hat 21 Arbeitstage (Neujahr = Do, fällt raus): Soll 21*8h
  assert.strictEqual(m.sollMonat, 21 * 480);
  assert.strictEqual(ZK.carryOverMin(emp, entries, 2026, 2), 30);
  assert.strictEqual(ZK.carryOverMin(emp, entries, 2026, 1), 0);
  assert.strictEqual(ZK.carryOverMin(emp, entries, 2027, 1), 30);
});

t('Jahres-Saldo: zählt nur Monate des jeweiligen Jahres', () => {
  const entries = {
    '2026-12-30': { start: '07:00', ende: '17:00', pauseMin: 60 }, // Mi, +1:00
    '2027-01-04': { start: '07:00', ende: '17:30', pauseMin: 60 }, // Mo, +1:30
  };
  assert.strictEqual(ZK.yearSaldoMin(emp, entries, 2026, 12), 60);
  assert.strictEqual(ZK.yearSaldoMin(emp, entries, 2027, 1), 90);
  assert.strictEqual(ZK.yearSaldoMin(emp, entries, 2027, 12), 90);
  // Zeitkonto gesamt läuft dagegen über beide Jahre
  assert.strictEqual(ZK.carryOverMin(emp, entries, 2027, 2), 150);
});

// --- Urlaubskonto ---
t('Resturlaub: 30 − 2 genommene = 28 (Wochenend-Urlaub zählt nicht)', () => {
  const entries = {
    '2026-03-02': { bemerkung: 'Urlaub' }, // Mo
    '2026-03-03': { bemerkung: 'Urlaub' }, // Di
    '2026-03-07': { bemerkung: 'Urlaub' }, // Sa — zählt nicht
    '2026-03-04': { bemerkung: 'Krank' },  // kein Urlaub
  };
  assert.strictEqual(ZK.vacationUsed(emp, entries, 2026), 2);
  assert.strictEqual(ZK.vacationRemaining(emp, entries, 2026), 28);
});

t('Urlaubs-Übertrag Vorjahr: händisches Feld zählt im Startjahr 2026 mit', () => {
  const empU = { sollStdProTag: 8, urlaubstageJahr: 30, urlaubUebertrag: 4 };
  const entries = {
    '2026-03-02': { bemerkung: 'Urlaub' }, // Mo
    '2026-03-03': { bemerkung: 'Urlaub' }, // Di
  };
  assert.strictEqual(ZK.vacationCarry(empU, entries, 2026), 4);
  assert.strictEqual(ZK.vacationRemaining(empU, entries, 2026), 30 + 4 - 2);
});
t('Urlaubs-Übertrag ab 2027: Resturlaub des Vorjahres wird automatisch übernommen', () => {
  const empU = { sollStdProTag: 8, urlaubstageJahr: 30, urlaubUebertrag: 4 };
  const entries = {
    '2026-03-02': { bemerkung: 'Urlaub' },
    '2027-06-07': { bemerkung: 'Urlaub' }, // Mo 2027
  };
  // 2026: 30 + 4 − 1 = 33 Rest -> Übertrag nach 2027
  assert.strictEqual(ZK.vacationCarry(empU, entries, 2027), 33);
  assert.strictEqual(ZK.vacationRemaining(empU, entries, 2027), 30 + 33 - 1);
  // und weiter nach 2028 (kein Urlaub 2028 gebucht)
  assert.strictEqual(ZK.vacationCarry(empU, entries, 2028), 62);
});
t('Ohne Übertrags-Feld (Bestandsdaten): Übertrag 0', () => {
  assert.strictEqual(ZK.vacationCarry(emp, {}, 2026), 0);
  assert.strictEqual(ZK.vacationRemaining(emp, {}, 2026), 30);
});

t('Halbe Soll-Stunden (7,5 h/Tag) funktionieren', () => {
  const e75 = { sollStdProTag: 7.5 };
  const r = ZK.dayCalc(e75, { start: '08:00', ende: '16:00', pauseMin: 30 }, 2026, 1, 7, hol26);
  assert.strictEqual(r.soll, 450);
  assert.strictEqual(r.saldo, 0);
});

console.log(`\n${passed} Tests bestanden.`);

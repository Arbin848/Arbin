// Checks course data files: node tools/validate.js [data/file.js ...]
// With no arguments it checks every file in data/.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = path.join(__dirname, '..', 'data');
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => path.join(dir, f));

const LEVELS = ['Start', 'A1', 'A2', 'B1', 'B2'];
const DEVANAGARI = /[ऀ-ॿ]/;
let errors = 0;
const fail = (where, msg) => { errors++; console.log(`✗ ${where}: ${msg}`); };
const ids = new Set();

for (const file of files) {
  const ctx = { window: {} };
  try {
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  } catch (e) { fail(file, `does not run: ${e.message}`); continue; }
  const w = ctx.window;
  const units = w.SLOWKA_COURSE || [];
  if (w.SLOWKA_ALPHABET) checkAlphabet(file, w.SLOWKA_ALPHABET);
  if (!units.length && !w.SLOWKA_ALPHABET) fail(file, 'adds no units');

  for (const u of units) {
    const at = `${path.basename(file)} ${u.id || '(no id)'}`;
    if (!/^[a-z0-9]+-\d{2}$/.test(u.id || '')) fail(at, 'id must look like "a1-03"');
    if (ids.has(u.id)) fail(at, 'duplicate unit id');
    ids.add(u.id);
    if (!LEVELS.includes(u.level)) fail(at, `level must be one of ${LEVELS.join(', ')}`);
    for (const k of ['title', 'titleNe', 'summary', 'summaryNe']) {
      if (typeof u[k] !== 'string' || !u[k].trim()) fail(at, `missing ${k}`);
    }
    if (u.titleNe && !DEVANAGARI.test(u.titleNe)) fail(at, 'titleNe must be in Devanagari');
    if (!Array.isArray(u.lesson) || u.lesson.length < 2) fail(at, 'lesson needs at least 2 paragraphs');
    (u.lesson || []).forEach((p, i) => {
      if (!p || typeof p.en !== 'string' || typeof p.ne !== 'string') fail(at, `lesson[${i}] needs en and ne`);
      else if (!DEVANAGARI.test(p.ne)) fail(at, `lesson[${i}].ne must be in Nepali`);
    });
    (u.tables || []).forEach((t, i) => {
      if (!t.title || !Array.isArray(t.head) || !Array.isArray(t.rows)) fail(at, `tables[${i}] needs title, head, rows`);
      else t.rows.forEach((r, j) => { if (!Array.isArray(r) || r.length !== t.head.length) fail(at, `tables[${i}].rows[${j}] has ${r && r.length} cells, head has ${t.head.length}`); });
    });
    checkEntries(at, 'words', u.words, 8);
    checkEntries(at, 'phrases', u.phrases, 3);
    (u.dialogue || []).forEach((d, i) => {
      if (!Array.isArray(d) || d.length !== 4 || d.some((x) => typeof x !== 'string' || !x.trim())) fail(at, `dialogue[${i}] must be [speaker, pl, en, ne]`);
      else if (!DEVANAGARI.test(d[3])) fail(at, `dialogue[${i}] Nepali must be in Devanagari`);
    });
  }
  console.log(`${path.basename(file)}: ${units.length} units, ${units.reduce((n, u) => n + (u.words || []).length + (u.phrases || []).length, 0)} entries`);
}

function checkEntries(at, key, list, min) {
  if (!Array.isArray(list) || list.length < min) { fail(at, `${key} needs at least ${min} entries`); return; }
  list.forEach((e, i) => {
    const where = `${at} ${key}[${i}] ${Array.isArray(e) ? e[0] : ''}`;
    if (!Array.isArray(e) || e.length !== 5 || e.some((x) => typeof x !== 'string' || !x.trim())) { fail(where, 'must be [pl, en, ne, pron, proNe] with no empty fields'); return; }
    if (!DEVANAGARI.test(e[2])) fail(where, 'Nepali meaning must be in Devanagari');
    if (!DEVANAGARI.test(e[4])) fail(where, 'Devanagari pronunciation missing');
    if (DEVANAGARI.test(e[3])) fail(where, 'English pronunciation contains Devanagari');
    if (!/[A-Z]{2}|^[a-z]+$|^[A-Z]+$/.test(e[3].replace(/[^A-Za-z]/g, '')) && e[3].split(/[\s-]+/).length > 1) fail(where, 'English pronunciation should mark the stressed syllable in CAPS');
  });
}

function checkAlphabet(file, letters) {
  if (!Array.isArray(letters) || letters.length < 32) fail(file, `SLOWKA_ALPHABET needs all 32 letters, has ${letters && letters.length}`);
  (letters || []).forEach((l, i) => {
    const keys = ['letter', 'soundEn', 'soundNe', 'example', 'exampleEn', 'exampleNe', 'pron', 'proNe'];
    for (const k of keys) if (typeof l[k] !== 'string' || !l[k].trim()) fail(file, `alphabet[${i}] missing ${k}`);
  });
}

console.log(errors ? `\n${errors} problem(s) found` : '\nAll good');
process.exit(errors ? 1 : 0);

(() => {
  'use strict';

  // ---------- course data ----------

  const LEVELS = [
    { id: 'Start', name: 'Start here', ne: 'यहाँबाट सुरु गर्नुहोस्', blurb: 'Alphabet, sounds and reading rules', blurbNe: 'वर्णमाला, उच्चारण र पढ्ने नियम' },
    { id: 'A1', name: 'A1 · Beginner', ne: 'शुरुआती', blurb: 'Everyday words and simple sentences', blurbNe: 'दैनिक शब्द र सरल वाक्य' },
    { id: 'A2', name: 'A2 · Elementary', ne: 'प्रारम्भिक', blurb: 'Cases, past and future, daily life and work', blurbNe: 'विभक्ति, भूत र भविष्य काल, दैनिक जीवन र काम' },
    { id: 'B1', name: 'B1 · Intermediate', ne: 'मध्यम', blurb: 'Aspect, polite Polish, life in Poland', blurbNe: 'क्रियाको पक्ष, विनम्र पोलिस, पोल्यान्डमा जीवन' },
    { id: 'B2', name: 'B2 · Upper intermediate', ne: 'उच्च-मध्यम', blurb: 'Fluent, formal and idiomatic Polish', blurbNe: 'धाराप्रवाह, औपचारिक र मुहावरेदार पोलिस' },
  ];
  const levelIndex = (id) => LEVELS.findIndex((l) => l.id === id);

  const COURSE = (window.SLOWKA_COURSE || [])
    .filter((u) => u && u.id && levelIndex(u.level) >= 0)
    .sort((a, b) => levelIndex(a.level) - levelIndex(b.level) || a.id.localeCompare(b.id, 'en', { numeric: true }));
  const ALPHABET = window.SLOWKA_ALPHABET || [];

  COURSE.forEach((u) => {
    const toEntry = (kind) => ([pl, en, ne, pron, proNe]) => ({ pl, en, ne, pron, proNe, kind, unit: u.id });
    u.entries = [...(u.words || []).map(toEntry('word')), ...(u.phrases || []).map(toEntry('phrase'))];
  });
  const UNIT = new Map(COURSE.map((u) => [u.id, u]));
  // One entry per Polish form; the first unit that teaches it owns it.
  const ENTRIES = [];
  const seenForms = new Set();
  COURSE.forEach((u) => u.entries.forEach((e) => {
    if (!seenForms.has(e.pl)) { seenForms.add(e.pl); ENTRIES.push(e); }
  }));

  // ---------- storage ----------

  const PROGRESS_KEY = 'slowka-progress-v2';
  const SETTINGS_KEY = 'slowka-settings-v2';

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch (e) { return null; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }

  const freshProgress = () => ({ items: {}, streak: 0, lastDay: null, todayDay: null, todayCount: 0, lastUnit: null });
  let progress = Object.assign(freshProgress(), readJSON(PROGRESS_KEY));

  // Carry over boxes from the first version of the app.
  const legacy = readJSON('slowka-progress-v1');
  if (legacy && legacy.boxes && !Object.keys(progress.items).length) {
    Object.entries(legacy.boxes).forEach(([pl, b]) => { progress.items[pl] = { b, due: dayKey() }; });
    Object.assign(progress, { streak: legacy.streak || 0, lastDay: legacy.lastDay || null });
    writeJSON(PROGRESS_KEY, progress);
  }

  const settings = Object.assign(
    { meaning: 'both', pron: 'both', explain: 'both', dir: 'pl', slow: false },
    readJSON(SETTINGS_KEY)
  );
  const saveSettings = () => writeJSON(SETTINGS_KEY, settings);
  const shows = (key, lang) => settings[key] === 'both' || settings[key] === lang;

  // ---------- spaced repetition ----------

  // Leitner boxes 0–5 with review intervals in days. Box 3+ counts as learned.
  const INTERVALS = [0, 1, 2, 4, 7, 14];
  const MAX_BOX = 5;
  const LEARNED_BOX = 3;
  const SESSION_SIZE = 10;

  function dayKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function addDays(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return dayKey(d);
  }
  function daysBetween(a, b) {
    return Math.round((new Date(`${b}T12:00`) - new Date(`${a}T12:00`)) / 864e5);
  }

  const itemOf = (e) => progress.items[e.pl];
  const boxOf = (e) => (itemOf(e) ? itemOf(e).b : 0);
  const isLearned = (e) => boxOf(e) >= LEARNED_BOX;
  const dueList = () => {
    const today = dayKey();
    return ENTRIES.filter((e) => itemOf(e) && itemOf(e).due <= today)
      .sort((a, b) => itemOf(a).due.localeCompare(itemOf(b).due) || boxOf(a) - boxOf(b));
  };

  function review(entry, change) {
    const b = change === 'reset' ? 0 : Math.max(0, Math.min(MAX_BOX, boxOf(entry) + change));
    progress.items[entry.pl] = { b, due: addDays(INTERVALS[b]) };

    const today = dayKey();
    if (progress.todayDay !== today) { progress.todayDay = today; progress.todayCount = 0; }
    progress.todayCount += 1;
    if (progress.lastDay !== today) {
      progress.streak = progress.lastDay && daysBetween(progress.lastDay, today) === 1 ? progress.streak + 1 : 1;
      progress.lastDay = today;
    }
    writeJSON(PROGRESS_KEY, progress);
    renderStats();
  }

  const currentStreak = () => (progress.lastDay && daysBetween(progress.lastDay, dayKey()) <= 1 ? progress.streak : 0);
  const unitLearned = (u) => u.entries.filter(isLearned).length;
  const unitStarted = (u) => u.entries.some((e) => itemOf(e));

  // ---------- helpers ----------

  const $ = (sel) => document.querySelector(sel);
  const view = $('#view');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const highlight = (escaped) => escaped.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '<span class="dia">$&</span>');
  const polish = (s) => highlight(esc(s));
  // Lesson markup: *polish words* and **bold**, on escaped text.
  function markup(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, (_, t) => `<span class="pl" lang="pl">${highlight(t)}</span>`);
  }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // Weak items come first, with jitter so rounds differ.
  function pickSession(list, n) {
    return list.map((e) => ({ e, k: boxOf(e) + Math.random() * 1.5 }))
      .sort((a, b) => a.k - b.k).slice(0, n).map((x) => x.e);
  }
  function pickOne(list, avoid) {
    const c = list.length > 1 ? list.filter((e) => e !== avoid) : list;
    const weights = c.map((e) => (MAX_BOX + 1 - boxOf(e)) ** 2);
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < c.length; i++) { r -= weights[i]; if (r <= 0) return c[i]; }
    return c[c.length - 1];
  }
  // Wrong answers of the same kind, from the unit first, then the whole course.
  function distractors(target, list, key) {
    const same = (pool) => shuffle(pool.filter((e) => e.kind === target.kind && e[key] !== target[key]));
    const picked = [];
    const seen = new Set([target[key]]);
    const any = shuffle(ENTRIES.filter((e) => e[key] !== target[key]));
    for (const e of [...same(list), ...same(ENTRIES), ...any]) {
      if (picked.length === 3) break;
      if (!seen.has(e[key])) { seen.add(e[key]); picked.push(e); }
    }
    return picked;
  }

  function meaningHTML(e, cls = '') {
    const parts = [];
    if (shows('meaning', 'en')) parts.push(`<span class="m-en">${esc(e.en)}</span>`);
    if (shows('meaning', 'ne')) parts.push(`<span class="m-ne" lang="ne">${esc(e.ne)}</span>`);
    return `<span class="meaning ${cls}">${parts.join('')}</span>`;
  }
  function pronHTML(e) {
    const parts = [];
    if (shows('pron', 'en')) parts.push(`<span class="pron" title="Pronunciation: capitals mark the stressed syllable">${esc(e.pron)}</span>`);
    if (shows('pron', 'ne')) parts.push(`<span class="pron ne" lang="ne" title="उच्चारण: ˈ चिन्हपछिको अक्षरमा जोड दिनुहोस्">${esc(e.proNe)}</span>`);
    return `<span class="prons">${parts.join('')}</span>`;
  }
  function boxMeter(e) {
    const b = boxOf(e);
    let cells = '';
    for (let i = 1; i <= MAX_BOX; i++) cells += `<i class="${i <= b ? 'on' : ''}"></i>`;
    return `<span class="boxes" title="Memory strength ${b} of ${MAX_BOX}" aria-label="Memory strength ${b} of ${MAX_BOX}">${cells}</span>`;
  }
  function bar(done, total) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    return `<span class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></span>`;
  }

  // ---------- speech ----------

  const synth = window.speechSynthesis;
  let polishVoice = null;
  function findVoice() {
    try { polishVoice = synth.getVoices().find((v) => /^pl\b/i.test(v.lang)) || null; } catch (e) { polishVoice = null; }
  }
  if (synth) {
    findVoice();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', findVoice);
  }
  function speak(text) {
    if (!synth) return;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/…/g, '').replace(/\s\/\s/g, ', '));
      u.lang = 'pl-PL';
      if (polishVoice) u.voice = polishVoice;
      u.rate = settings.slow ? 0.6 : 0.85;
      synth.speak(u);
    } catch (e) { /* speech unavailable */ }
  }
  const SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  function listenBtn(text, big) {
    if (!synth) return '';
    return big
      ? `<button class="btn listen" data-action="say" data-text="${esc(text)}">${SPEAKER} Listen <span lang="ne">सुन्नुहोस्</span></button>`
      : `<button class="icon-btn" data-action="say" data-text="${esc(text)}" aria-label="Listen to ${esc(text)}">${SPEAKER}</button>`;
  }

  // ---------- navigation ----------

  let route = { name: 'home' };
  let session = null; // practice state for the current unit tab or review

  function go(to) {
    session = null;
    if (UNIT.has(to)) route = { name: 'unit', id: to, tab: 'learn' };
    else if (['review', 'alphabet', 'dictionary', 'settings'].includes(to)) route = { name: to };
    else route = { name: 'home' };
    if (route.name === 'unit') { progress.lastUnit = to; writeJSON(PROGRESS_KEY, progress); }
    try { history.replaceState(null, '', route.name === 'home' ? location.pathname + location.search : `#${to}`); } catch (e) { /* not allowed here */ }
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    renderStats();
    if (route.name === 'unit') renderUnit();
    else if (route.name === 'review') renderReview();
    else if (route.name === 'alphabet') renderAlphabet();
    else if (route.name === 'dictionary') renderDictionary();
    else if (route.name === 'settings') renderSettings();
    else renderHome();
  }

  function renderStats() {
    const learned = ENTRIES.filter(isLearned).length;
    const due = dueList().length;
    $('#stats').innerHTML = `
      <div class="stat"><b>${currentStreak()}</b><span>day streak</span></div>
      <div class="stat"><b>${learned}<small>/${ENTRIES.length}</small></b><span>learned</span></div>
      <div class="stat"><b>${due}</b><span>to review</span></div>`;
  }

  const backLink = () => `<button class="back" data-action="go" data-to="home">← All lessons <span lang="ne">सबै पाठ</span></button>`;

  // ---------- home ----------

  function nextUnit() {
    const last = UNIT.get(progress.lastUnit);
    if (last && unitLearned(last) < last.entries.length * 0.8) return last;
    return COURSE.find((u) => unitLearned(u) < u.entries.length * 0.8) || COURSE[0];
  }

  function renderHome() {
    if (!COURSE.length) {
      view.innerHTML = '<p class="empty">The course content did not load. Check that the files in the <code>data</code> folder are next to this page.</p>';
      return;
    }
    const next = nextUnit();
    const due = dueList().length;
    const started = COURSE.some(unitStarted);

    const levels = LEVELS.map((level) => {
      const units = COURSE.filter((u) => u.level === level.id);
      if (!units.length) return '';
      const total = units.reduce((n, u) => n + u.entries.length, 0);
      const done = units.reduce((n, u) => n + unitLearned(u), 0);
      return `
        <section class="level" aria-labelledby="lvl-${level.id}">
          <header class="level-head">
            <div>
              <h2 id="lvl-${level.id}">${esc(level.name)} <span class="ne-sub" lang="ne">${esc(level.ne)}</span></h2>
              <p>${esc(level.blurb)} · <span lang="ne">${esc(level.blurbNe)}</span></p>
            </div>
            <span class="level-count">${done}/${total}</span>
          </header>
          <ol class="units">
            ${units.map((u) => {
              const n = u.entries.length;
              const l = unitLearned(u);
              const state = l >= n * 0.8 ? 'done' : unitStarted(u) ? 'started' : '';
              return `
                <li>
                  <button class="unit-row ${state}" data-action="go" data-to="${u.id}">
                    <span class="unit-num">${esc(u.id.split('-')[1])}</span>
                    <span class="unit-text">
                      <span class="unit-title">${esc(u.title)}</span>
                      <span class="unit-ne" lang="ne">${esc(u.titleNe)}</span>
                    </span>
                    <span class="unit-progress">${bar(l, n)}<small>${l}/${n}</small></span>
                  </button>
                </li>`;
            }).join('')}
          </ol>
        </section>`;
    }).join('');

    view.innerHTML = `
      <section class="hero">
        <div class="hero-main">
          <span class="eyebrow">${started ? 'Continue · जारी राख्नुहोस्' : 'Start here · यहाँबाट सुरु गर्नुहोस्'}</span>
          <h2>${esc(next.title)}</h2>
          <p lang="ne">${esc(next.titleNe)}</p>
          <p class="hint">${esc(next.summary)}</p>
          <div class="row start">
            <button class="btn primary" data-action="go" data-to="${next.id}">${started ? 'Continue lesson' : 'Begin the course'}</button>
            ${due ? `<button class="btn" data-action="go" data-to="review">Review ${due} due ${due === 1 ? 'word' : 'words'}</button>` : ''}
          </div>
        </div>
        <nav class="tools" aria-label="Tools">
          <button class="tool" data-action="go" data-to="alphabet"><b lang="pl">Aa Ąą</b><span>Alphabet</span><small lang="ne">वर्णमाला</small></button>
          <button class="tool" data-action="go" data-to="review"><b>${due}</b><span>Daily review</span><small lang="ne">दैनिक दोहोर्याइ</small></button>
          <button class="tool" data-action="go" data-to="dictionary"><b>${ENTRIES.length}</b><span>Dictionary</span><small lang="ne">शब्दकोश</small></button>
          <button class="tool" data-action="go" data-to="settings"><b>⚙</b><span>Settings</span><small lang="ne">सेटिङ</small></button>
        </nav>
      </section>
      <section class="howto">
        <h2>How to use this course <span class="ne-sub" lang="ne">यो कोर्स कसरी प्रयोग गर्ने</span></h2>
        <ol>
          <li><b>Read the lesson</b> in each unit. Every rule is explained in English and Nepali. <span lang="ne">हरेक पाठ पढ्नुहोस्; नियमहरू अंग्रेजी र नेपालीमा छन्।</span></li>
          <li><b>Listen and repeat</b> every word out loud. Capitals and <span class="pron ne">ˈ</span> mark the stressed syllable. <span lang="ne">हरेक शब्द सुनेर ठूलो स्वरमा दोहोर्याउनुहोस्।</span></li>
          <li><b>Practise</b> with flashcards, quiz, listening and typing until the unit bar is full. <span lang="ne">अभ्यास गर्नुहोस्।</span></li>
          <li><b>Come back every day</b> for the daily review. Words return just before you would forget them. <span lang="ne">हरेक दिन दोहोर्याउनुहोस्।</span></li>
        </ol>
      </section>
      ${levels}`;
  }

  // ---------- unit ----------

  const TABS = [
    { id: 'learn', en: 'Learn', ne: 'सिक्नुहोस्' },
    { id: 'cards', en: 'Flashcards', ne: 'कार्ड' },
    { id: 'quiz', en: 'Quiz', ne: 'प्रश्न' },
    { id: 'listen', en: 'Listening', ne: 'सुनाइ', needsSpeech: true },
    { id: 'type', en: 'Type it', ne: 'लेख्नुहोस्' },
  ];

  function renderUnit() {
    const u = UNIT.get(route.id);
    const idx = COURSE.indexOf(u);
    const level = LEVELS[levelIndex(u.level)];
    const n = u.entries.length;
    const l = unitLearned(u);
    const tabs = TABS.filter((t) => !t.needsSpeech || synth);

    view.innerHTML = `
      ${backLink()}
      <header class="unit-head">
        <span class="eyebrow">${esc(level.name)} · Unit ${esc(u.id.split('-')[1])}</span>
        <h2>${esc(u.title)}</h2>
        <p class="unit-head-ne" lang="ne">${esc(u.titleNe)}</p>
        <p class="hint">${esc(u.summary)}<br><span lang="ne">${esc(u.summaryNe)}</span></p>
        <div class="unit-meter">${bar(l, n)}<small>${l} of ${n} learned</small></div>
      </header>
      <nav class="tabs" role="tablist" aria-label="Lesson sections">
        ${tabs.map((t) => `<button class="tab" role="tab" aria-selected="${route.tab === t.id}" data-action="tab" data-tab="${t.id}">${t.en}<small lang="ne">${t.ne}</small></button>`).join('')}
      </nav>
      <section class="stage" id="stage" aria-live="polite"></section>
      <nav class="pager">
        ${idx > 0 ? `<button class="btn" data-action="go" data-to="${COURSE[idx - 1].id}">← ${esc(COURSE[idx - 1].title)}</button>` : '<span></span>'}
        ${idx < COURSE.length - 1 ? `<button class="btn" data-action="go" data-to="${COURSE[idx + 1].id}">${esc(COURSE[idx + 1].title)} →</button>` : ''}
      </nav>`;
    renderStage();
  }

  function renderStage() {
    const stage = $('#stage');
    if (!stage) return;
    const u = route.name === 'unit' ? UNIT.get(route.id) : null;
    const tab = route.name === 'review' ? 'cards' : route.tab;
    if (tab === 'learn') stage.innerHTML = learnHTML(u);
    else if (tab === 'cards') renderCards(stage);
    else if (tab === 'quiz') renderQuiz(stage);
    else if (tab === 'listen') renderListen(stage);
    else if (tab === 'type') renderType(stage);
    const focus = stage.querySelector('[data-autofocus]');
    if (focus) focus.focus({ preventScroll: true });
  }

  function entryRow(e) {
    return `
      <li class="entry">
        <div class="entry-pl"><span lang="pl">${polish(e.pl)}</span>${pronHTML(e)}</div>
        ${meaningHTML(e)}
        <div class="entry-side">${boxMeter(e)}${listenBtn(e.pl)}</div>
      </li>`;
  }

  function learnHTML(u) {
    const paragraphs = u.lesson.map((p) => `
      <div class="para">
        ${shows('explain', 'en') ? `<p>${markup(p.en)}</p>` : ''}
        ${shows('explain', 'ne') ? `<p class="ne" lang="ne">${markup(p.ne)}</p>` : ''}
      </div>`).join('');

    const tables = (u.tables || []).map((t) => `
      <div class="table-wrap">
        <table>
          <caption>${esc(t.title)}${t.titleNe ? ` · <span lang="ne">${esc(t.titleNe)}</span>` : ''}</caption>
          <thead><tr>${t.head.map((h) => `<th scope="col">${markup(h)}</th>`).join('')}</tr></thead>
          <tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${markup(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>`).join('');

    const alphabet = u.id === 'start-01' && ALPHABET.length ? `<h3>All 32 letters <span class="ne-sub" lang="ne">सबै ३२ अक्षर</span></h3>${alphabetGrid()}` : '';
    const words = u.entries.filter((e) => e.kind === 'word');
    const phrases = u.entries.filter((e) => e.kind === 'phrase');

    const dialogue = (u.dialogue || []).length ? `
      <h3>Dialogue <span class="ne-sub" lang="ne">संवाद</span></h3>
      <div class="dialogue">
        ${u.dialogue.map(([who, pl, en, ne], i) => `
          <div class="line ${i % 2 ? 'right' : ''}">
            <span class="who">${esc(who)}</span>
            <div class="bubble">
              <div class="bubble-pl"><span lang="pl">${polish(pl)}</span>${listenBtn(pl)}</div>
              ${shows('meaning', 'en') ? `<div class="m-en">${esc(en)}</div>` : ''}
              ${shows('meaning', 'ne') ? `<div class="m-ne" lang="ne">${esc(ne)}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>` : '';

    return `
      <article class="lesson">
        <h3>Lesson <span class="ne-sub" lang="ne">पाठ</span></h3>
        ${paragraphs}
        ${tables}
        ${alphabet}
        <h3>Words <span class="ne-sub" lang="ne">शब्दहरू</span> <small>${words.length}</small></h3>
        <ul class="entries">${words.map(entryRow).join('')}</ul>
        ${phrases.length ? `<h3>Sentences <span class="ne-sub" lang="ne">वाक्यहरू</span> <small>${phrases.length}</small></h3><ul class="entries">${phrases.map(entryRow).join('')}</ul>` : ''}
        ${dialogue}
        <div class="row start"><button class="btn primary" data-action="tab" data-tab="cards">Practise these words → <span lang="ne">अभ्यास गर्नुहोस्</span></button></div>
      </article>`;
  }

  // ---------- practice: shared ----------

  function practicePool() {
    if (route.name === 'review') return null;
    return UNIT.get(route.id).entries;
  }

  function feedbackHTML(kind, e, next) {
    const title = { right: 'Dobrze! Correct · सही', close: 'Almost: check the accents · लगभग सही', wrong: 'Not quite · मिलेन' }[kind];
    return `
      <div class="feedback ${kind}" role="status">
        <div class="fb-text">
          <strong>${title}</strong>
          <span class="answer" lang="pl">${polish(e.pl)}</span>
          ${pronHTML(e)}
          ${meaningHTML(e)}
        </div>
        <div class="row">${listenBtn(e.pl, true)}<button class="btn primary" data-action="${next}" data-autofocus><kbd>Enter</kbd> Next</button></div>
      </div>`;
  }

  // ---------- flashcards (also used for daily review) ----------

  function startCards() {
    const isReview = route.name === 'review';
    const cards = isReview ? dueList().slice(0, 20) : pickSession(practicePool(), SESSION_SIZE);
    session = { mode: 'cards', cards, i: 0, flipped: false, tally: { again: 0, good: 0, easy: 0 } };
  }

  function renderCards(stage) {
    if (!session || session.mode !== 'cards') startCards();
    const s = session;
    if (!s.cards.length) {
      stage.innerHTML = `
        <div class="card summary">
          <span class="label">All caught up · सबै दोहोर्याइ सकियो</span>
          <h2>Nothing to review yet</h2>
          <p class="hint">Study a unit first. Words you practise come back here when they are due.<br><span lang="ne">पहिले एउटा पाठ अभ्यास गर्नुहोस्। अभ्यास गरेका शब्दहरू समय भएपछि यहाँ आउँछन्।</span></p>
          <button class="btn primary" data-action="go" data-to="${nextUnit().id}">Go to ${esc(nextUnit().title)}</button>
        </div>`;
      return;
    }
    if (s.i >= s.cards.length) {
      stage.innerHTML = `
        <div class="card summary">
          <span class="label">Round complete · सकियो</span>
          <h2 lang="pl">Dobra robota!</h2>
          <p class="hint">"Good job!" <span lang="ne">"स्याबास!"</span> You went through ${s.cards.length} cards.</p>
          <div class="tally">
            <div><b class="t-again">${s.tally.again}</b><span class="label">Again</span></div>
            <div><b class="t-good">${s.tally.good}</b><span class="label">Good</span></div>
            <div><b>${s.tally.easy}</b><span class="label">Easy</span></div>
          </div>
          <button class="btn primary" data-action="new-cards" data-autofocus>${route.name === 'review' ? 'Check for more' : 'Another round'}</button>
        </div>`;
      return;
    }
    const e = s.cards[s.i];
    const plFirst = settings.dir === 'pl';
    const front = plFirst
      ? `<span class="label">Polish · पोलिस</span><span class="word" lang="pl">${polish(e.pl)}</span>`
      : `<span class="label">Say it in Polish · पोलिसमा भन्नुहोस्</span>${meaningHTML(e, 'big')}`;
    const back = plFirst
      ? `<span class="rule"></span>${meaningHTML(e, 'big')}${pronHTML(e)}`
      : `<span class="rule"></span><span class="word sm" lang="pl">${polish(e.pl)}</span>${pronHTML(e)}`;

    stage.innerHTML = `
      <div class="meta"><span>Card ${s.i + 1} of ${s.cards.length}</span>${dirToggle()}${boxMeter(e)}</div>
      <button class="card flip-in" data-action="flip" ${s.flipped ? '' : 'data-autofocus'}>
        ${front}
        ${s.flipped ? back : '<span class="hint">Tap or press Space to see the answer · उत्तर हेर्न थिच्नुहोस्</span>'}
      </button>
      <div class="row">
        ${plFirst || s.flipped ? listenBtn(e.pl, true) : ''}
        ${s.flipped
          ? `<button class="btn again" data-action="rate" data-rate="again"><kbd>1</kbd> Again <span lang="ne">फेरि</span></button>
             <button class="btn good" data-action="rate" data-rate="good" data-autofocus><kbd>2</kbd> Good <span lang="ne">ठीक</span></button>
             <button class="btn" data-action="rate" data-rate="easy"><kbd>3</kbd> Easy <span lang="ne">सजिलो</span></button>`
          : '<button class="btn primary" data-action="flip"><kbd>Space</kbd> Show answer</button>'}
      </div>`;
  }

  const dirToggle = () => `<button class="dir" data-action="dir">${settings.dir === 'pl' ? 'Polish → meaning' : 'Meaning → Polish'} ⇄</button>`;

  function flip() {
    if (!session || session.mode !== 'cards' || session.flipped || session.i >= session.cards.length) return;
    session.flipped = true;
    renderStage();
    if (settings.dir !== 'pl') speak(session.cards[session.i].pl);
  }
  function rate(kind) {
    const s = session;
    if (!s || s.mode !== 'cards' || !s.flipped) return;
    review(s.cards[s.i], kind === 'again' ? 'reset' : kind === 'good' ? 1 : 2);
    s.tally[kind] += 1;
    s.i += 1;
    s.flipped = false;
    renderStage();
  }

  // ---------- quiz ----------

  function newQuiz() {
    const pool = practicePool();
    const prev = session && session.mode === 'quiz' ? session : { score: 0, total: 0 };
    const target = pickOne(pool, prev.word);
    const key = settings.dir === 'pl' ? 'en' : 'pl';
    session = { mode: 'quiz', score: prev.score, total: prev.total, word: target, options: shuffle([target, ...distractors(target, pool, key)]), picked: null };
  }

  function renderQuiz(stage) {
    if (!session || session.mode !== 'quiz') newQuiz();
    const s = session;
    const e = s.word;
    const plFirst = settings.dir === 'pl';
    const answered = s.picked !== null;
    const prompt = plFirst
      ? `<span class="label">What does it mean? · यसको अर्थ के हो?</span><span class="word" lang="pl">${polish(e.pl)}</span>${answered ? '' : `<div class="row">${listenBtn(e.pl, true)}</div>`}`
      : `<span class="label">Choose the Polish · पोलिस छान्नुहोस्</span>${meaningHTML(e, 'big')}`;
    const opts = s.options.map((o, i) => {
      let cls = 'option';
      if (answered && o === e) cls += ' right';
      else if (answered && o === s.picked) cls += ' wrong';
      const text = plFirst ? meaningHTML(o) : `<span lang="pl" class="opt-pl">${polish(o.pl)}</span>`;
      return `<button class="${cls}" data-action="answer" data-index="${i}" ${answered ? 'disabled' : ''}><kbd>${i + 1}</kbd>${text}</button>`;
    }).join('');

    stage.innerHTML = `
      <div class="meta"><span>Score ${s.score} / ${s.total}</span>${dirToggle()}${boxMeter(e)}</div>
      <div class="card">${prompt}</div>
      <div class="options">${opts}</div>
      ${answered ? feedbackHTML(s.picked === e ? 'right' : 'wrong', e, 'next-quiz') : ''}`;
  }

  function answer(index) {
    const s = session;
    if (!s || s.picked !== null || !s.options[index]) return;
    s.picked = s.options[index];
    s.total += 1;
    const right = s.picked === s.word;
    if (right) s.score += 1;
    review(s.word, right ? 1 : -1);
    renderStage();
    if (s.mode === 'quiz' && settings.dir !== 'pl') speak(s.word.pl);
  }

  // ---------- listening ----------

  function newListen() {
    const pool = practicePool();
    const prev = session && session.mode === 'listen' ? session : { score: 0, total: 0 };
    const target = pickOne(pool, prev.word);
    session = { mode: 'listen', score: prev.score, total: prev.total, word: target, options: shuffle([target, ...distractors(target, pool, 'pl')]), picked: null };
  }

  function renderListen(stage) {
    if (!session || session.mode !== 'listen') newListen();
    const s = session;
    const e = s.word;
    const answered = s.picked !== null;
    const opts = s.options.map((o, i) => {
      let cls = 'option';
      if (answered && o === e) cls += ' right';
      else if (answered && o === s.picked) cls += ' wrong';
      return `<button class="${cls}" data-action="answer" data-index="${i}" ${answered ? 'disabled' : ''}><kbd>${i + 1}</kbd><span lang="pl" class="opt-pl">${polish(o.pl)}</span></button>`;
    }).join('');
    stage.innerHTML = `
      <div class="meta"><span>Score ${s.score} / ${s.total}</span>${boxMeter(e)}</div>
      <div class="card">
        <span class="label">What did you hear? · तपाईंले के सुन्नुभयो?</span>
        <button class="play" data-action="say" data-text="${esc(e.pl)}" aria-label="Play the word again" ${answered ? '' : 'data-autofocus'}>${SPEAKER}</button>
        <span class="hint">Tap to play again${settings.slow ? '' : ' · turn on slow speech in Settings if it is too fast'}</span>
      </div>
      <div class="options">${opts}</div>
      ${answered ? feedbackHTML(s.picked === e ? 'right' : 'wrong', e, 'next-listen') : ''}`;
    if (!answered) speak(e.pl);
  }

  // ---------- typing ----------

  const clean = (s) => s.toLowerCase().replace(/[?!.,…¿¡:;"„”]/g, '').replace(/\s+/g, ' ').trim();
  const stripMarks = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
  const POLISH_KEYS = ['ą', 'ć', 'ę', 'ł', 'ń', 'ó', 'ś', 'ź', 'ż'];

  function newType() {
    const pool = practicePool().filter((e) => e.kind === 'word');
    const prev = session && session.mode === 'type' ? session : { score: 0, total: 0 };
    session = { mode: 'type', score: prev.score, total: prev.total, word: pickOne(pool.length ? pool : practicePool(), prev.word), result: null, given: '', hint: 0 };
  }

  function renderType(stage) {
    if (!session || session.mode !== 'type') newType();
    const s = session;
    const e = s.word;
    const target = e.pl.replace(/…/g, '');
    const hint = s.hint ? `${esc(target.slice(0, s.hint))}${'·'.repeat(Math.max(0, target.length - s.hint))}` : '';
    stage.innerHTML = `
      <div class="meta"><span>Score ${s.score} / ${s.total}</span>${boxMeter(e)}</div>
      <form class="card" id="type-form" autocomplete="off">
        <span class="label">Write it in Polish · पोलिसमा लेख्नुहोस्</span>
        ${meaningHTML(e, 'big')}
        <input class="type-input" id="type-answer" lang="pl" spellcheck="false" autocapitalize="off" autocorrect="off"
          aria-label="Your answer in Polish" value="${esc(s.given)}" ${s.result ? 'readonly' : 'data-autofocus'}>
        ${hint ? `<span class="pron hint-letters">${hint}</span>` : ''}
        ${s.result ? '' : `
          <div class="keys" aria-label="Polish letters">${POLISH_KEYS.map((k) => `<button type="button" class="key" data-action="key" data-key="${k}">${k}</button>`).join('')}</div>
          <div class="row">
            <button type="button" class="btn" data-action="hint">Hint <span lang="ne">संकेत</span></button>
            <button type="submit" class="btn primary"><kbd>Enter</kbd> Check</button>
          </div>`}
      </form>
      ${s.result ? feedbackHTML(s.result, e, 'next-type') : ''}`;
    if (!s.result) {
      const input = $('#type-answer');
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function checkType() {
    const s = session;
    if (!s || s.mode !== 'type' || s.result) return;
    const given = $('#type-answer').value;
    if (!given.trim()) return;
    s.given = given;
    // Aspect pairs like "robić / zrobić" accept either form or both.
    const answers = [s.word.pl, ...s.word.pl.split(' / ')].map(clean);
    const got = clean(given);
    s.total += 1;
    if (answers.includes(got)) {
      s.result = 'right';
      s.score += 1;
      review(s.word, s.hint ? 0 : 1);
    } else if (answers.map(stripMarks).includes(stripMarks(got))) {
      s.result = 'close';
      review(s.word, 0);
    } else {
      s.result = 'wrong';
      review(s.word, -1);
    }
    renderStage();
    speak(s.word.pl);
  }

  function insertKey(ch) {
    const input = $('#type-answer');
    if (!input || input.readOnly) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + ch + input.value.slice(end);
    input.focus();
    input.setSelectionRange(start + 1, start + 1);
    session.given = input.value;
  }

  // ---------- review ----------

  function renderReview() {
    const due = dueList().length;
    view.innerHTML = `
      ${backLink()}
      <header class="unit-head">
        <span class="eyebrow">Daily review · दैनिक दोहोर्याइ</span>
        <h2>${due ? `${due} ${due === 1 ? 'word is' : 'words are'} due today` : 'Daily review'}</h2>
        <p class="hint">Words you have practised come back here on a schedule: tomorrow, then in 2, 4, 7 and 14 days. A few minutes every day is the fastest way to remember them.<br>
        <span lang="ne">अभ्यास गरेका शब्दहरू तालिका अनुसार फर्केर आउँछन्: भोलि, अनि २, ४, ७ र १४ दिनपछि। हरेक दिन केही मिनेट दोहोर्याउनु नै छिटो सम्झने उपाय हो।</span></p>
      </header>
      <section class="stage" id="stage" aria-live="polite"></section>`;
    renderStage();
  }

  // ---------- alphabet ----------

  function alphabetGrid() {
    return `<div class="letters">${ALPHABET.map((a) => `
      <div class="letter">
        <div class="letter-top"><span class="glyph" lang="pl">${polish(a.letter)}</span>${listenBtn(a.example)}</div>
        ${shows('explain', 'en') ? `<span class="sound">${esc(a.soundEn)}</span>` : ''}
        ${shows('explain', 'ne') ? `<span class="sound" lang="ne">${esc(a.soundNe)}</span>` : ''}
        <span class="example"><b lang="pl">${polish(a.example)}</b>
          ${shows('pron', 'en') ? `<span class="pron">${esc(a.pron)}</span>` : ''}${shows('pron', 'ne') ? `<span class="pron ne" lang="ne">${esc(a.proNe)}</span>` : ''}
          <span class="ex-m">${shows('meaning', 'en') ? esc(a.exampleEn) : ''}${settings.meaning === 'both' ? ' · ' : ''}${shows('meaning', 'ne') ? `<span lang="ne">${esc(a.exampleNe)}</span>` : ''}</span>
        </span>
      </div>`).join('')}</div>`;
  }

  function renderAlphabet() {
    const first = COURSE.find((u) => u.level === 'Start');
    view.innerHTML = `
      ${backLink()}
      <header class="unit-head">
        <span class="eyebrow">Reference · सन्दर्भ</span>
        <h2>The Polish alphabet</h2>
        <p class="unit-head-ne" lang="ne">पोलिस वर्णमाला</p>
        <p class="hint">32 letters. Polish is read exactly as it is written, so once you know these sounds you can read any word. Stress falls on the second-to-last syllable.<br>
        <span lang="ne">३२ अक्षर। पोलिस जस्तो लेखिन्छ त्यस्तै पढिन्छ। यी आवाज सिकेपछि जुनसुकै शब्द पढ्न सक्नुहुन्छ। जोड प्राय: अन्तिमभन्दा अघिल्लो अक्षरमा पर्छ।</span></p>
      </header>
      ${ALPHABET.length ? alphabetGrid() : '<p class="empty">The alphabet did not load.</p>'}
      ${first ? `<div class="row start"><button class="btn primary" data-action="go" data-to="${first.id}">Start the first lesson →</button></div>` : ''}`;
  }

  // ---------- dictionary ----------

  const fold = (s) => stripMarks(s.toLowerCase());

  function renderDictionary() {
    view.innerHTML = `
      ${backLink()}
      <header class="unit-head">
        <span class="eyebrow">Reference · सन्दर्भ</span>
        <h2>Dictionary</h2>
        <p class="unit-head-ne" lang="ne">शब्दकोश</p>
        <p class="hint">Search every word and sentence in the course in Polish, English or Nepali. You can type Polish without accents.</p>
      </header>
      <input class="search" id="dict-q" type="search" placeholder="Search: dom, house, घर…" aria-label="Search the dictionary" data-autofocus>
      <p class="hint" id="dict-count"></p>
      <ul class="entries" id="dict-results"></ul>`;
    const input = $('#dict-q');
    input.addEventListener('input', updateDictionary);
    updateDictionary();
    input.focus({ preventScroll: true });
  }

  function updateDictionary() {
    const q = fold($('#dict-q').value.trim());
    const hits = q ? ENTRIES.filter((e) => fold(e.pl).includes(q) || e.en.toLowerCase().includes(q) || e.ne.includes(q)) : ENTRIES.filter((e) => e.kind === 'word');
    const shown = hits.slice(0, 80);
    $('#dict-count').textContent = q
      ? `${hits.length} ${hits.length === 1 ? 'result' : 'results'}${hits.length > shown.length ? `, showing the first ${shown.length}` : ''}`
      : `Showing the first ${shown.length} of ${hits.length} words. Type to search.`;
    $('#dict-results').innerHTML = shown.map((e) => {
      const u = UNIT.get(e.unit);
      return entryRow(e).replace('</li>', `<button class="from" data-action="go" data-to="${u.id}">${esc(u.level)} · ${esc(u.title)}</button></li>`);
    }).join('');
  }

  // ---------- settings ----------

  function segmented(key, label, labelNe, options) {
    return `
      <fieldset class="setting">
        <legend>${label} <span lang="ne">${labelNe}</span></legend>
        <div class="seg">
          ${options.map(([value, text]) => `<button type="button" data-action="set" data-key="${key}" data-value="${value}" aria-pressed="${String(settings[key]) === value}">${text}</button>`).join('')}
        </div>
      </fieldset>`;
  }

  function renderSettings() {
    const langs = [['both', 'Both · दुवै'], ['en', 'English'], ['ne', 'नेपाली']];
    view.innerHTML = `
      ${backLink()}
      <header class="unit-head">
        <span class="eyebrow">Settings · सेटिङ</span>
        <h2>Make it yours</h2>
      </header>
      <div class="settings">
        ${segmented('meaning', 'Show meanings in', 'अर्थ देखाउने भाषा', langs)}
        ${segmented('pron', 'Show pronunciation in', 'उच्चारण देखाउने लिपि', [['both', 'Both · दुवै'], ['en', 'English letters'], ['ne', 'देवनागरी']])}
        ${segmented('explain', 'Explain lessons in', 'पाठको व्याख्या', langs)}
        ${segmented('dir', 'Flashcards and quiz show', 'कार्डमा पहिले देखाउने', [['pl', 'Polish first'], ['meaning', 'Meaning first']])}
        ${synth ? segmented('slow', 'Speaking speed', 'बोल्ने गति', [['false', 'Normal'], ['true', 'Slow · बिस्तारै']]) : ''}
        <fieldset class="setting">
          <legend>Progress <span lang="ne">प्रगति</span></legend>
          <p class="hint">Your progress is saved in this browser only. Clearing it cannot be undone.</p>
          <button class="btn again" data-action="reset">Clear all progress</button>
        </fieldset>
        ${synth ? '' : '<p class="hint">This browser has no text-to-speech, so the Listen buttons and listening practice are hidden.</p>'}
        <p class="hint">How pronunciation is written: in English letters the stressed syllable is in CAPITALS (<span class="pron">jen DOB-ri</span>). In Devanagari the stressed syllable comes after <span class="pron ne">ˈ</span> (<span class="pron ne" lang="ne">जेन् ˈदोब्-रि</span>). Both are approximations: always listen too.</p>
      </div>`;
  }

  // ---------- events ----------

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    switch (a) {
      case 'go': go(el.dataset.to); break;
      case 'tab':
        route.tab = el.dataset.tab;
        session = null;
        renderUnit();
        $('.tabs').scrollIntoView({ block: 'nearest' });
        break;
      case 'say': speak(el.dataset.text); break;
      case 'flip': flip(); break;
      case 'rate': rate(el.dataset.rate); break;
      case 'new-cards': session = null; renderStage(); break;
      case 'answer': answer(Number(el.dataset.index)); break;
      case 'next-quiz': newQuiz(); renderStage(); break;
      case 'next-listen': newListen(); renderStage(); break;
      case 'next-type': newType(); renderStage(); break;
      case 'key': insertKey(el.dataset.key); break;
      case 'hint':
        session.given = $('#type-answer').value;
        session.hint = Math.min(session.hint + 1, session.word.pl.length);
        renderStage();
        break;
      case 'dir':
        settings.dir = settings.dir === 'pl' ? 'meaning' : 'pl';
        saveSettings();
        session = null;
        renderStage();
        break;
      case 'set': {
        const v = el.dataset.value;
        settings[el.dataset.key] = v === 'true' ? true : v === 'false' ? false : v;
        saveSettings();
        renderSettings();
        break;
      }
      case 'reset':
        if (el.dataset.armed === 'true') {
          const lastUnit = progress.lastUnit;
          progress = freshProgress();
          progress.lastUnit = lastUnit;
          writeJSON(PROGRESS_KEY, progress);
          renderStats();
          el.dataset.armed = 'false';
          el.textContent = 'Progress cleared';
        } else {
          el.dataset.armed = 'true';
          el.textContent = 'Tap again to clear everything';
        }
        break;
    }
  });

  document.addEventListener('submit', (ev) => {
    if (ev.target.id === 'type-form') { ev.preventDefault(); checkType(); }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey || !session) return;
    if (ev.target.tagName === 'INPUT' && !ev.target.readOnly) return;
    const onButton = ev.target.tagName === 'BUTTON';
    const s = session;
    if (s.mode === 'cards') {
      if (ev.key === ' ' && !s.flipped && !onButton) { ev.preventDefault(); flip(); }
      else if (s.flipped && ['1', '2', '3'].includes(ev.key)) rate(['again', 'good', 'easy'][Number(ev.key) - 1]);
    } else if (s.mode === 'quiz' || s.mode === 'listen') {
      if (s.picked === null && /^[1-4]$/.test(ev.key)) answer(Number(ev.key) - 1);
    }
  });

  // ---------- start ----------

  const initial = (location.hash || '').slice(1);
  if (initial) go(initial);
  else render();
})();

(() => {
  'use strict';

  const TOPICS = window.SLOWKA_TOPICS;
  const LETTERS = window.SLOWKA_LETTERS;
  const ALL = TOPICS.flatMap((t) =>
    t.words.map(([pl, en, pron]) => ({ pl, en, pron, topic: t.id }))
  );

  // Leitner boxes: 0 = new or forgotten, 5 = solid. A word counts as learned from box 3.
  const MAX_BOX = 5;
  const LEARNED_BOX = 3;
  const SESSION_SIZE = 10;
  const PROGRESS_KEY = 'slowka-progress-v1';
  const UI_KEY = 'slowka-ui-v1';
  const POLISH_KEYS = ['ą', 'ć', 'ę', 'ł', 'ń', 'ó', 'ś', 'ź', 'ż'];

  // ---------- storage ----------

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch (e) { return null; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }

  const freshProgress = () => ({ boxes: {}, streak: 0, lastDay: null, todayDay: null, todayCount: 0 });
  let progress = Object.assign(freshProgress(), readJSON(PROGRESS_KEY));
  const ui = Object.assign({ mode: 'cards', topic: 'all', dir: 'pl-en' }, readJSON(UI_KEY));
  if (ui.topic !== 'all' && !TOPICS.some((t) => t.id === ui.topic)) ui.topic = 'all';

  function dayKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function daysBetween(a, b) {
    return Math.round((new Date(`${b}T12:00`) - new Date(`${a}T12:00`)) / 864e5);
  }

  const boxOf = (w) => progress.boxes[w.pl] || 0;

  function review(word, change) {
    const next = change === 'reset' ? 0 : Math.max(0, Math.min(MAX_BOX, boxOf(word) + change));
    progress.boxes[word.pl] = next;

    const today = dayKey();
    if (progress.todayDay !== today) { progress.todayDay = today; progress.todayCount = 0; }
    progress.todayCount += 1;
    if (progress.lastDay !== today) {
      const consecutive = progress.lastDay && daysBetween(progress.lastDay, today) === 1;
      progress.streak = consecutive ? progress.streak + 1 : 1;
      progress.lastDay = today;
    }
    writeJSON(PROGRESS_KEY, progress);
    renderStats();
    renderChips();
  }

  function currentStreak() {
    if (!progress.lastDay) return 0;
    return daysBetween(progress.lastDay, dayKey()) <= 1 ? progress.streak : 0;
  }

  // ---------- helpers ----------

  const $ = (sel) => document.querySelector(sel);
  const stage = $('#stage');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // Escape, then colour the letters English doesn't have.
  function polish(s) {
    return esc(s).replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '<span class="dia">$&</span>');
  }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const pool = () => (ui.topic === 'all' ? ALL : ALL.filter((w) => w.topic === ui.topic));

  // Lower boxes come first, with some jitter so sessions don't repeat exactly.
  function pickSession(words, n) {
    return words
      .map((w) => ({ w, k: boxOf(w) + Math.random() * 1.5 }))
      .sort((a, b) => a.k - b.k)
      .slice(0, n)
      .map((x) => x.w);
  }

  // Weighted pick: weak words come up far more often than solid ones.
  function pickOne(words, avoid) {
    const candidates = words.length > 1 ? words.filter((w) => w !== avoid) : words;
    const weights = candidates.map((w) => (MAX_BOX + 1 - boxOf(w)) ** 2);
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  function boxMeter(w) {
    const b = boxOf(w);
    let cells = '';
    for (let i = 1; i <= MAX_BOX; i++) cells += `<i class="${i <= b ? 'on' : ''}"></i>`;
    return `<span class="boxes" title="Memory strength ${b} of ${MAX_BOX}" aria-label="Memory strength ${b} of ${MAX_BOX}">${cells}</span>`;
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
      const u = new SpeechSynthesisUtterance(text.replace(/…/g, ''));
      u.lang = 'pl-PL';
      if (polishVoice) u.voice = polishVoice;
      u.rate = 0.85;
      synth.speak(u);
    } catch (e) { /* speech unavailable */ }
  }
  const SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  function listenButton(text, compact) {
    if (!synth) return '';
    if (compact) {
      return `<button class="icon-btn" data-action="say" data-text="${esc(text)}" aria-label="Listen to ${esc(text)}">${SPEAKER}</button>`;
    }
    return `<button class="btn listen" data-action="say" data-text="${esc(text)}">${SPEAKER} Listen</button>`;
  }

  // ---------- header, tabs, chips ----------

  function renderStats() {
    const learned = ALL.filter((w) => boxOf(w) >= LEARNED_BOX).length;
    const todayCount = progress.todayDay === dayKey() ? progress.todayCount : 0;
    const streak = currentStreak();
    $('#stats').innerHTML = `
      <div class="stat"><b>${streak}</b><span>day streak</span></div>
      <div class="stat"><b>${learned}<small style="font-size:0.6em;color:var(--muted)">/${ALL.length}</small></b><span>learned</span></div>
      <div class="stat"><b>${todayCount}</b><span>today</span></div>`;
  }

  function renderTabs() {
    document.querySelectorAll('.tab').forEach((t) => {
      t.setAttribute('aria-selected', String(t.dataset.mode === ui.mode));
    });
    $('#controls').hidden = ui.mode === 'sounds';
    const dir = $('#dir');
    dir.hidden = ui.mode === 'type';
    dir.innerHTML = ui.dir === 'pl-en' ? 'Direction: <b>Polish → English</b>' : 'Direction: <b>English → Polish</b>';
  }

  function renderChips() {
    const chip = (id, name, words) => {
      const learned = words.filter((w) => boxOf(w) >= LEARNED_BOX).length;
      return `<button class="chip" data-action="topic" data-topic="${id}" aria-pressed="${ui.topic === id}">${esc(name)} <small>${learned}/${words.length}</small></button>`;
    };
    $('#chips').innerHTML =
      chip('all', 'All topics', ALL) +
      TOPICS.map((t) => chip(t.id, t.name, ALL.filter((w) => w.topic === t.id))).join('');
  }

  // ---------- flashcards ----------

  let deck = null;

  function startDeck() {
    deck = { cards: pickSession(pool(), SESSION_SIZE), i: 0, flipped: false, tally: { again: 0, good: 0, easy: 0 } };
  }

  function renderCards() {
    if (!deck) startDeck();
    if (deck.i >= deck.cards.length) {
      const t = deck.tally;
      stage.innerHTML = `
        <div class="card summary">
          <span class="label">Round complete</span>
          <h2>Dobra robota!</h2>
          <p class="hint">"Good job!" You went through ${deck.cards.length} cards.</p>
          <div class="tally">
            <div><b style="color:var(--accent)">${t.again}</b><span class="label">Again</span></div>
            <div><b style="color:var(--good)">${t.good}</b><span class="label">Good</span></div>
            <div><b>${t.easy}</b><span class="label">Easy</span></div>
          </div>
        </div>
        <div class="row"><button class="btn primary" data-action="new-deck">Start another round</button></div>`;
      return;
    }
    const w = deck.cards[deck.i];
    const plFirst = ui.dir === 'pl-en';
    const front = plFirst
      ? `<span class="label">Polish</span><span class="word" lang="pl">${polish(w.pl)}</span>`
      : `<span class="label">English</span><span class="word en">${esc(w.en)}</span>`;
    const back = plFirst
      ? `<span class="rule"></span><span class="label">English</span><span class="meaning">${esc(w.en)}</span><span class="pron">${esc(w.pron)}</span>`
      : `<span class="rule"></span><span class="label">Polish</span><span class="meaning pl" lang="pl">${polish(w.pl)}</span><span class="pron">${esc(w.pron)}</span>`;

    stage.innerHTML = `
      <div class="meta"><span>Card ${deck.i + 1} of ${deck.cards.length}</span>${boxMeter(w)}</div>
      <button class="card flip-in" data-action="flip" aria-label="${deck.flipped ? 'Card' : 'Show answer'}">
        ${front}
        ${deck.flipped ? back : '<span class="hint">Tap the card or press Space to see the answer</span>'}
      </button>
      <div class="row">
        ${plFirst || deck.flipped ? listenButton(w.pl) : ''}
        ${deck.flipped
          ? `<button class="btn again" data-action="rate" data-rate="again"><kbd>1</kbd> Again</button>
             <button class="btn good" data-action="rate" data-rate="good"><kbd>2</kbd> Good</button>
             <button class="btn" data-action="rate" data-rate="easy"><kbd>3</kbd> Easy</button>`
          : '<button class="btn primary" data-action="flip"><kbd>Space</kbd> Show answer</button>'}
      </div>`;
  }

  function flip() {
    if (!deck || deck.flipped || deck.i >= deck.cards.length) return;
    deck.flipped = true;
    renderCards();
    if (ui.dir === 'en-pl') speak(deck.cards[deck.i].pl);
  }

  function rate(kind) {
    if (!deck || !deck.flipped) return;
    const w = deck.cards[deck.i];
    review(w, kind === 'again' ? 'reset' : kind === 'good' ? 1 : 2);
    deck.tally[kind] += 1;
    deck.i += 1;
    deck.flipped = false;
    renderCards();
  }

  // ---------- quiz ----------

  let quiz = null;

  function nextQuestion() {
    const words = pool();
    const target = pickOne(words, quiz && quiz.word);
    const answerOf = (w) => (ui.dir === 'pl-en' ? w.en : w.pl);
    const distractors = shuffle(words.filter((w) => w !== target && answerOf(w) !== answerOf(target))).slice(0, 3);
    quiz = {
      score: quiz ? quiz.score : 0,
      total: quiz ? quiz.total : 0,
      word: target,
      options: shuffle([target, ...distractors]),
      picked: null,
    };
  }

  function renderQuiz() {
    if (!quiz) nextQuestion();
    const { word: w, options, picked } = quiz;
    const plFirst = ui.dir === 'pl-en';
    const answered = picked !== null;
    const prompt = plFirst
      ? `<span class="label">What does this mean?</span><span class="word" lang="pl">${polish(w.pl)}</span>`
      : `<span class="label">How do you say this in Polish?</span><span class="word en">${esc(w.en)}</span>`;

    const opts = options.map((o, i) => {
      let cls = 'option' + (plFirst ? '' : ' pl');
      if (answered && o === w) cls += ' right';
      else if (answered && o === picked) cls += ' wrong';
      const text = plFirst ? esc(o.en) : polish(o.pl);
      return `<button class="${cls}" data-action="answer" data-index="${i}" ${answered ? 'disabled' : ''}><kbd>${i + 1}</kbd><span${plFirst ? '' : ' lang="pl"'}>${text}</span></button>`;
    }).join('');

    let feedback = '';
    if (answered) {
      const right = picked === w;
      feedback = `
        <div class="feedback ${right ? 'right' : 'wrong'}" role="status">
          <span><strong>${right ? 'Dobrze! Correct.' : 'Not quite.'}</strong>
          <span class="answer" lang="pl">${polish(w.pl)}</span> <span class="pron">${esc(w.pron)}</span></span>
          <span class="row">${listenButton(w.pl)}<button class="btn primary" data-action="next-question"><kbd>Enter</kbd> Next</button></span>
        </div>`;
    }

    stage.innerHTML = `
      <div class="meta"><span>Score ${quiz.score} / ${quiz.total}</span>${boxMeter(w)}</div>
      <div class="card">
        ${prompt}
        ${plFirst && !answered ? `<div class="row">${listenButton(w.pl)}</div>` : ''}
      </div>
      <div class="options">${opts}</div>
      ${feedback}`;

    if (answered) {
      const next = stage.querySelector('[data-action="next-question"]');
      if (next) next.focus({ preventScroll: true });
    }
  }

  function answerQuiz(index) {
    if (!quiz || quiz.picked !== null) return;
    const picked = quiz.options[index];
    if (!picked) return;
    quiz.picked = picked;
    quiz.total += 1;
    if (picked === quiz.word) {
      quiz.score += 1;
      review(quiz.word, 1);
    } else {
      review(quiz.word, -1);
    }
    renderQuiz();
  }

  // ---------- typing ----------

  let typing = null;

  const clean = (s) => s.toLowerCase().replace(/[?!.,…¿¡]/g, '').replace(/\s+/g, ' ').trim();
  const stripMarks = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

  function nextTyping() {
    typing = {
      score: typing ? typing.score : 0,
      total: typing ? typing.total : 0,
      word: pickOne(pool(), typing && typing.word),
      result: null,
      given: '',
      hint: 0,
    };
  }

  function renderTyping() {
    if (!typing) nextTyping();
    const { word: w, result, hint } = typing;
    const target = w.pl.replace(/…/g, '');
    const hintText = hint ? `${esc(target.slice(0, hint))}${'·'.repeat(Math.max(0, target.length - hint))}` : '';

    let feedback = '';
    if (result) {
      const title = result === 'right' ? 'Perfect!' : result === 'close' ? 'Almost. Check the accents:' : 'The answer is:';
      feedback = `
        <div class="feedback ${result}" role="status">
          <span><strong>${title}</strong> <span class="answer" lang="pl">${polish(w.pl)}</span> <span class="pron">${esc(w.pron)}</span></span>
          <span class="row">${listenButton(w.pl)}<button class="btn primary" data-action="next-typing"><kbd>Enter</kbd> Next</button></span>
        </div>`;
    }

    stage.innerHTML = `
      <div class="meta"><span>Score ${typing.score} / ${typing.total}</span>${boxMeter(w)}</div>
      <form class="card" id="type-form" autocomplete="off">
        <span class="label">Type it in Polish</span>
        <span class="word en">${esc(w.en)}</span>
        <input class="type-input" id="type-answer" lang="pl" spellcheck="false" autocapitalize="off" autocorrect="off"
          aria-label="Your answer in Polish" value="${esc(typing.given)}" ${result ? 'readonly' : ''}>
        ${hintText ? `<span class="pron" style="letter-spacing:0.15em">${hintText}</span>` : ''}
        ${result ? '' : `<div class="keys" aria-label="Polish letters">${POLISH_KEYS.map((k) => `<button type="button" class="key" data-action="key" data-key="${k}">${k}</button>`).join('')}</div>`}
        ${result ? '' : `<div class="row">
          <button type="button" class="btn" data-action="hint">Hint</button>
          <button type="submit" class="btn primary"><kbd>Enter</kbd> Check</button>
        </div>`}
      </form>
      ${feedback}`;

    if (result) {
      const next = stage.querySelector('[data-action="next-typing"]');
      if (next) next.focus({ preventScroll: true });
    } else {
      const input = $('#type-answer');
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function checkTyping() {
    if (!typing || typing.result) return;
    const given = $('#type-answer').value;
    if (!given.trim()) return;
    typing.given = given;
    const want = clean(typing.word.pl);
    const got = clean(given);
    typing.total += 1;
    if (got === want) {
      typing.result = 'right';
      typing.score += 1;
      review(typing.word, typing.hint ? 0 : 1);
    } else if (stripMarks(got) === stripMarks(want)) {
      typing.result = 'close';
      review(typing.word, 0);
    } else {
      typing.result = 'wrong';
      review(typing.word, -1);
    }
    renderTyping();
    speak(typing.word.pl);
  }

  function insertKey(ch) {
    const input = $('#type-answer');
    if (!input || input.readOnly) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + ch + input.value.slice(end);
    input.focus();
    input.setSelectionRange(start + 1, start + 1);
    typing.given = input.value;
  }

  // ---------- sounds ----------

  function renderSounds() {
    stage.innerHTML = `
      <p class="intro">Polish is spelled the way it sounds. Once you know these letters you can read any word aloud.
      Stress almost always falls on the <b>second-to-last syllable</b>: <b lang="pl">ko-CHAM</b> is wrong, <b lang="pl">KO-cham</b> is right.</p>
      <div class="letters">
        ${LETTERS.map(([glyph, sound, example, meaning]) => `
          <div class="letter">
            <span class="glyph" lang="pl">${esc(glyph)}</span>
            <span class="sound">${esc(sound)}</span>
            <span class="example"><span><b lang="pl">${polish(example)}</b> · ${esc(meaning)}</span>${listenButton(example, true)}</span>
          </div>`).join('')}
      </div>`;
  }

  // ---------- routing ----------

  function render() {
    renderTabs();
    if (ui.mode === 'cards') renderCards();
    else if (ui.mode === 'quiz') renderQuiz();
    else if (ui.mode === 'type') renderTyping();
    else renderSounds();
  }

  function resetSessions() { deck = null; quiz = null; typing = null; }
  function saveUI() { writeJSON(UI_KEY, ui); }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    switch (action) {
      case 'mode':
        ui.mode = el.dataset.mode; saveUI(); render(); break;
      case 'topic':
        ui.topic = el.dataset.topic; saveUI(); resetSessions(); renderChips(); render(); break;
      case 'dir':
        ui.dir = ui.dir === 'pl-en' ? 'en-pl' : 'pl-en'; saveUI(); deck = null; quiz = null; render(); break;
      case 'flip': flip(); break;
      case 'rate': rate(el.dataset.rate); break;
      case 'new-deck': startDeck(); renderCards(); break;
      case 'answer': answerQuiz(Number(el.dataset.index)); break;
      case 'next-question': nextQuestion(); renderQuiz(); break;
      case 'next-typing': nextTyping(); renderTyping(); break;
      case 'key': insertKey(el.dataset.key); break;
      case 'hint':
        typing.given = $('#type-answer').value;
        typing.hint = Math.min(typing.hint + 1, typing.word.pl.length);
        renderTyping();
        break;
      case 'say': speak(el.dataset.text); break;
      case 'reset':
        if (el.dataset.armed === 'true') {
          progress = freshProgress();
          writeJSON(PROGRESS_KEY, progress);
          resetSessions();
          renderStats(); renderChips(); render();
          el.dataset.armed = 'false';
          el.textContent = 'Progress cleared';
        } else {
          el.dataset.armed = 'true';
          el.textContent = 'Tap again to clear all progress';
        }
        break;
    }
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id === 'type-form') { e.preventDefault(); checkTyping(); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const inField = e.target.tagName === 'INPUT' && !e.target.readOnly;
    if (inField) return;
    if (ui.mode === 'cards' && deck) {
      if (e.key === ' ' && !deck.flipped) { e.preventDefault(); flip(); }
      else if (deck.flipped && ['1', '2', '3'].includes(e.key)) rate(['again', 'good', 'easy'][Number(e.key) - 1]);
    } else if (ui.mode === 'quiz' && quiz) {
      if (quiz.picked === null && /^[1-4]$/.test(e.key)) answerQuiz(Number(e.key) - 1);
      else if (quiz.picked !== null && e.key === 'Enter' && e.target.tagName !== 'BUTTON') { nextQuestion(); renderQuiz(); }
    } else if (ui.mode === 'type' && typing && typing.result && e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
      nextTyping(); renderTyping();
    }
  });

  renderStats();
  renderChips();
  render();
})();

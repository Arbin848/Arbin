// Słówka practice: flashcards, quiz, listening, speaking, typing and grammar drills.
// The app supplies a stage element and a context ({ mode, pool, unitId, title }).
(() => {
  'use strict';
  const S = window.Slowka;
  const { esc, polish } = S;
  const SESSION_SIZE = 10;

  let session = null;
  let ctx = null;
  let stage = null;

  const P = (S.Practice = {});
  P.reset = () => { session = null; };
  P.render = (el, context) => {
    stage = el;
    if (!ctx || ctx.key !== context.key) session = null;
    ctx = context;
    draw();
  };
  function draw() {
    if (!stage || !stage.isConnected) return;
    const m = ctx.mode;
    if (m === 'cards') drawCards();
    else if (m === 'quiz') drawChoice('quiz');
    else if (m === 'listen') drawChoice('listen');
    else if (m === 'speak') drawSpeak();
    else if (m === 'type') drawType();
    else if (m === 'drill') drawDrill();
    else if (m === 'dictate') drawDictate();
    const focus = stage.querySelector('[data-autofocus]');
    if (focus) focus.focus({ preventScroll: true });
  }

  const feedbackHTML = (kind, e, next) => {
    const title = { right: 'Dobrze! Correct · सही', close: 'Almost: check the accents · लगभग सही', wrong: 'Not quite · मिलेन' }[kind];
    return `
      <div class="feedback ${kind}" role="status">
        <div class="fb-text">
          <strong>${title}</strong>
          <span class="answer" lang="pl">${polish(e.pl)}</span>
          ${S.pronHTML(e)}
          ${S.meaningHTML(e)}
        </div>
        <div class="row">${S.listenBtn(e.pl, true)}<button class="btn primary" data-action="${next}" data-autofocus><kbd>Enter</kbd> Next</button></div>
      </div>`;
  };
  const dirToggle = () => `<button class="dir" data-action="dir">${S.settings.dir === 'pl' ? 'Polish → meaning' : 'Meaning → Polish'} ⇄</button>`;
  const emptyHTML = (title, text) => `
    <div class="card summary">
      <span class="label">Nothing here yet · अहिले केही छैन</span>
      <h2>${title}</h2>
      <p class="hint">${text}</p>
    </div>`;

  // ---------- flashcards ----------

  function startCards() {
    const cards = ctx.review ? ctx.pool.slice(0, 20) : S.pickSession(ctx.pool, SESSION_SIZE);
    session = { mode: 'cards', cards, i: 0, flipped: false, tally: { again: 0, good: 0, easy: 0 } };
  }

  function drawCards() {
    if (!session || session.mode !== 'cards') startCards();
    const s = session;
    if (!s.cards.length) {
      stage.innerHTML = emptyHTML('All caught up', 'Words you practise come back here when they are due. Study a unit, then come back tomorrow.<br><span lang="ne">अभ्यास गरेका शब्दहरू समय भएपछि यहाँ आउँछन्। एउटा पाठ पढेर भोलि फर्कनुहोस्।</span>');
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
          <button class="btn primary" data-action="new-cards" data-autofocus>${ctx.review ? 'Check for more' : 'Another round'}</button>
        </div>`;
      return;
    }
    const e = s.cards[s.i];
    const plFirst = S.settings.dir === 'pl';
    const front = plFirst
      ? `<span class="label">Polish · पोलिस</span><span class="word" lang="pl">${polish(e.pl)}</span>`
      : `<span class="label">Say it in Polish · पोलिसमा भन्नुहोस्</span>${S.meaningHTML(e, 'big')}`;
    const back = plFirst
      ? `<span class="rule"></span>${S.meaningHTML(e, 'big')}${S.pronHTML(e)}`
      : `<span class="rule"></span><span class="word sm" lang="pl">${polish(e.pl)}</span>${S.pronHTML(e)}`;
    stage.innerHTML = `
      <div class="meta"><span>Card ${s.i + 1} of ${s.cards.length}</span>${dirToggle()}${S.boxMeter(e)}</div>
      <button class="card flip-in" data-action="flip" ${s.flipped ? '' : 'data-autofocus'}>
        ${front}
        ${s.flipped ? back : '<span class="hint">Tap or press Space to see the answer · उत्तर हेर्न थिच्नुहोस्</span>'}
      </button>
      <div class="row">
        ${plFirst || s.flipped ? S.listenBtn(e.pl, true) : ''}
        ${s.flipped
          ? `<button class="btn again" data-action="rate" data-rate="again"><kbd>1</kbd> Again <span lang="ne">फेरि</span></button>
             <button class="btn good" data-action="rate" data-rate="good" data-autofocus><kbd>2</kbd> Good <span lang="ne">ठीक</span></button>
             <button class="btn" data-action="rate" data-rate="easy"><kbd>3</kbd> Easy <span lang="ne">सजिलो</span></button>`
          : '<button class="btn primary" data-action="flip"><kbd>Space</kbd> Show answer</button>'}
      </div>`;
  }
  function flip() {
    const s = session;
    if (!s || s.mode !== 'cards' || s.flipped || s.i >= s.cards.length) return;
    s.flipped = true;
    draw();
    if (S.settings.dir !== 'pl') S.speak(s.cards[s.i].pl);
  }
  function rate(kind) {
    const s = session;
    if (!s || s.mode !== 'cards' || !s.flipped) return;
    S.review(s.cards[s.i], kind === 'again' ? 'reset' : kind === 'good' ? 1 : 2);
    s.tally[kind] += 1;
    s.i += 1;
    s.flipped = false;
    draw();
  }

  // ---------- quiz and listening (multiple choice) ----------

  function newChoice(mode) {
    const prev = session && session.mode === mode ? session : { score: 0, total: 0 };
    const target = S.pickOne(ctx.pool, prev.word);
    const key = mode === 'listen' ? 'pl' : S.settings.dir === 'pl' ? 'en' : 'pl';
    session = { mode, score: prev.score, total: prev.total, word: target, options: S.shuffle([target, ...S.distractors(target, ctx.pool, key)]), picked: null };
    if (mode === 'listen') setTimeout(() => S.speak(target.pl), 150);
  }

  function drawChoice(mode) {
    if (!session || session.mode !== mode) newChoice(mode);
    const s = session;
    const e = s.word;
    const answered = s.picked !== null;
    const plFirst = mode === 'quiz' && S.settings.dir === 'pl';
    let prompt;
    if (mode === 'listen') {
      prompt = `
        <span class="label">What did you hear? · तपाईंले के सुन्नुभयो?</span>
        <button class="play" data-action="say" data-text="${esc(e.pl)}" aria-label="Play again" ${answered ? '' : 'data-autofocus'}>${S.SPEAKER}</button>
        <span class="hint">Tap to play again${S.settings.slow ? '' : ' · slow speech is in Settings'}</span>`;
    } else if (plFirst) {
      prompt = `<span class="label">What does it mean? · यसको अर्थ के हो?</span><span class="word" lang="pl">${polish(e.pl)}</span>${answered ? '' : `<div class="row">${S.listenBtn(e.pl, true)}</div>`}`;
    } else {
      prompt = `<span class="label">Choose the Polish · पोलिस छान्नुहोस्</span>${S.meaningHTML(e, 'big')}`;
    }
    const opts = s.options.map((o, i) => {
      let cls = 'option';
      if (answered && o === e) cls += ' right';
      else if (answered && o === s.picked) cls += ' wrong';
      const text = plFirst ? S.meaningHTML(o) : `<span lang="pl" class="opt-pl">${polish(o.pl)}</span>`;
      return `<button class="${cls}" data-action="answer" data-index="${i}" ${answered ? 'disabled' : ''}><kbd>${i + 1}</kbd>${text}</button>`;
    }).join('');
    stage.innerHTML = `
      <div class="meta"><span>Score ${s.score} / ${s.total}</span>${mode === 'quiz' ? dirToggle() : ''}${S.boxMeter(e)}</div>
      <div class="card">${prompt}</div>
      <div class="options">${opts}</div>
      ${answered ? feedbackHTML(s.picked === e ? 'right' : 'wrong', e, 'next-choice') : ''}`;
  }

  function answer(index) {
    const s = session;
    if (!s || s.picked !== null || !s.options || !s.options[index]) return;
    s.picked = s.options[index];
    s.total += 1;
    const right = s.picked === s.word;
    if (right) s.score += 1;
    S.review(s.word, right ? 1 : -1);
    draw();
    if (s.mode === 'quiz' && S.settings.dir !== 'pl') S.speak(s.word.pl);
  }

  // ---------- speaking ----------

  function newSpeak() {
    const prev = session && session.mode === 'speak' ? session : { score: 0, total: 0 };
    const pool = ctx.pool.filter((e) => e.pl.split(/\s+/).length <= 6);
    session = { mode: 'speak', score: prev.score, total: prev.total, word: S.pickOne(pool.length ? pool : ctx.pool, prev.word), result: null, busy: '', recUrl: null, error: '' };
  }

  function drawSpeak() {
    if (!session || session.mode !== 'speak') newSpeak();
    const s = session;
    const e = s.word;
    const r = s.result;
    let result = '';
    if (r) {
      const pct = Math.round(r.score * 100);
      const kind = r.score >= 0.85 ? 'right' : r.score >= 0.6 ? 'close' : 'wrong';
      const title = { right: 'Świetnie! Great pronunciation · उत्कृष्ट', close: 'Close. Listen again and repeat · नजिक छ, फेरि सुनेर दोहोर्याउनुहोस्', wrong: 'Not yet. Listen slowly and try again · फेरि प्रयास गर्नुहोस्' }[kind];
      result = `
        <div class="feedback ${kind}" role="status">
          <div class="fb-text">
            <strong>${title}</strong>
            <span class="heard">Heard · सुनियो: <b lang="pl">${esc(r.heard || '—')}</b></span>
            <span class="score-line">${S.bar(pct, 100)} <b>${pct}%</b> match</span>
          </div>
          <div class="row"><button class="btn primary" data-action="next-speak" data-autofocus><kbd>Enter</kbd> Next word</button></div>
        </div>`;
    }
    stage.innerHTML = `
      <div class="meta"><span>Score ${s.score} / ${s.total}</span>${S.boxMeter(e)}</div>
      <div class="card">
        <span class="label">Say it out loud · ठूलो स्वरमा भन्नुहोस्</span>
        <span class="word" lang="pl">${polish(e.pl)}</span>
        ${S.pronHTML(e)}
        ${S.meaningHTML(e)}
        <div class="row">
          ${S.listenBtn(e.pl, true)}
          ${S.canRecognize ? `<button class="btn primary mic ${s.busy === 'listening' ? 'live' : ''}" data-action="speak-check" ${s.busy ? 'disabled' : ''}>${S.MIC} ${s.busy === 'listening' ? 'Listening… · सुन्दै…' : 'Say it · बोल्नुहोस्'}</button>` : ''}
          ${S.canRecord ? `<button class="btn ${s.busy === 'recording' ? 'live' : ''}" data-action="${s.busy === 'recording' ? 'record-stop' : 'record'}">${s.busy === 'recording' ? '■ Stop' : '● Record yourself'}</button>` : ''}
        </div>
        ${s.recUrl ? `<div class="compare"><span class="label">Compare · तुलना गर्नुहोस्</span><audio controls src="${s.recUrl}"></audio>${S.listenBtn(e.pl, true)}
          ${S.canRecognize ? '' : `<div class="row"><button class="btn again" data-action="self-rate" data-ok="0">Not yet · अझै होइन</button><button class="btn good" data-action="self-rate" data-ok="1">Sounds right · ठीक सुनियो</button></div>`}</div>` : ''}
        ${s.error ? `<p class="hint err">${esc(s.error)}</p>` : ''}
        ${!S.canRecognize && !S.canRecord ? '<p class="hint">This browser has no microphone support. Listen and repeat out loud, then tap Next. · सुनेर ठूलो स्वरमा दोहोर्याउनुहोस्।</p><button class="btn primary" data-action="next-speak">Next word</button>' : ''}
        ${S.canRecognize ? '<p class="hint small">Your browser turns your speech into text (in Chrome this uses an internet service); the app then compares it with the right answer.</p>' : ''}
      </div>
      ${result}`;
  }

  async function speakCheck() {
    const s = session;
    s.busy = 'listening';
    s.error = '';
    draw();
    try {
      const alts = await S.recognize();
      const target = s.word.pl.replace(/…/g, '');
      let best = { heard: alts[0] || '', score: 0 };
      for (const a of alts) {
        const sc = S.similarity(a, target);
        if (sc > best.score) best = { heard: a, score: sc };
      }
      if (session !== s) return;
      s.result = best;
      s.total += 1;
      if (best.score >= 0.85) { s.score += 1; S.review(s.word, 1); } else S.review(s.word, 0);
    } catch (err) {
      if (session !== s) return;
      s.error = S.micErrorText(err);
    }
    s.busy = '';
    draw();
  }

  async function record() {
    const s = session;
    s.busy = 'recording';
    s.error = '';
    draw();
    try {
      const url = await S.recordVoice();
      if (session !== s) return;
      s.recUrl = url;
    } catch (err) {
      if (session !== s) return;
      s.error = S.micErrorText(err);
    }
    s.busy = '';
    draw();
  }

  // ---------- typing ----------

  function newType() {
    const pool = ctx.pool.filter((e) => e.kind === 'word');
    const prev = session && session.mode === 'type' ? session : { score: 0, total: 0 };
    session = { mode: 'type', score: prev.score, total: prev.total, word: S.pickOne(pool.length ? pool : ctx.pool, prev.word), result: null, given: '', hint: 0 };
  }

  function drawType() {
    if (!session || session.mode !== 'type') newType();
    const s = session;
    const e = s.word;
    const target = e.pl.replace(/…/g, '');
    const hint = s.hint ? `${esc(target.slice(0, s.hint))}${'·'.repeat(Math.max(0, target.length - s.hint))}` : '';
    stage.innerHTML = `
      <div class="meta"><span>Score ${s.score} / ${s.total}</span>${S.boxMeter(e)}</div>
      <form class="card" data-form="type" autocomplete="off">
        <span class="label">Write it in Polish · पोलिसमा लेख्नुहोस्</span>
        ${S.meaningHTML(e, 'big')}
        <input class="type-input" id="type-answer" data-keys-target lang="pl" spellcheck="false" autocapitalize="off" autocorrect="off"
          aria-label="Your answer in Polish" value="${esc(s.given)}" ${s.result ? 'readonly' : 'data-autofocus'}>
        ${hint ? `<span class="pron hint-letters">${hint}</span>` : ''}
        ${s.result ? '' : `${S.keysHTML()}
          <div class="row">
            <button type="button" class="btn" data-action="hint">Hint <span lang="ne">संकेत</span></button>
            <button type="submit" class="btn primary"><kbd>Enter</kbd> Check</button>
          </div>`}
      </form>
      ${s.result ? feedbackHTML(s.result, e, 'next-type') : ''}`;
  }

  function checkType() {
    const s = session;
    const input = stage.querySelector('#type-answer');
    if (!s || s.mode !== 'type' || s.result || !input) return;
    const given = input.value;
    if (!given.trim()) return;
    s.given = given;
    // Pairs like "robić / zrobić" accept either form or both.
    s.result = S.checkAnswer(given, [s.word.pl, ...s.word.pl.split(' / ')]);
    s.total += 1;
    if (s.result === 'right') { s.score += 1; S.review(s.word, s.hint ? 0 : 1); }
    else S.review(s.word, s.result === 'close' ? 0 : -1);
    draw();
    S.speak(s.word.pl);
  }

  // ---------- dictation ----------

  // Hear a sentence (or word), write it, then see each word marked right or wrong.
  function newDictate() {
    const prev = session && session.mode === 'dictate' ? session : { score: 0, total: 0 };
    const phrases = ctx.pool.filter((e) => e.kind === 'phrase');
    const pool = phrases.length >= 3 ? phrases : ctx.pool;
    session = { mode: 'dictate', score: prev.score, total: prev.total, word: S.pickOne(pool, prev.word), result: null, given: '' };
    const text = session.word.pl;
    setTimeout(() => S.speak(text), 200);
  }

  function diffWords(target, given) {
    const tw = target.replace(/…/g, '').split(/\s+/).filter(Boolean);
    const gw = S.clean(given).split(' ').filter(Boolean);
    let gi = 0;
    return tw.map((w) => {
      const k = S.clean(w).replace(/\s/g, '');
      // Look a couple of words ahead so one missing word doesn't mark the rest wrong.
      for (let j = gi; j < Math.min(gw.length, gi + 3); j++) {
        if (gw[j] === k) { gi = j + 1; return `<span class="w-ok">${polish(w)}</span>`; }
        if (S.stripMarks(gw[j]) === S.stripMarks(k)) { gi = j + 1; return `<span class="w-bad" title="check the accents: you wrote ${esc(gw[j])}">${polish(w)}</span>`; }
      }
      if (gi < gw.length && S.similarity(gw[gi], k) >= 0.5) { const typed = gw[gi]; gi += 1; return `<span class="w-bad" title="you wrote ${esc(typed)}">${polish(w)}</span>`; }
      return `<span class="w-miss">${polish(w)}</span>`;
    }).join(' ');
  }

  function drawDictate() {
    if (!session || session.mode !== 'dictate') newDictate();
    const s = session;
    const e = s.word;
    const r = s.result;
    stage.innerHTML = `
      <div class="meta"><span>Score ${s.score} / ${s.total}</span>${S.boxMeter(e)}</div>
      <form class="card" data-form="dictate" autocomplete="off">
        <span class="label">Write what you hear · सुनेको कुरा लेख्नुहोस्</span>
        <button type="button" class="play" data-action="say" data-text="${esc(e.pl)}" aria-label="Play again">${S.SPEAKER}</button>
        <span class="hint">Tap to play again · फेरि सुन्न थिच्नुहोस्</span>
        <input class="type-input wide" id="dictate-answer" data-keys-target lang="pl" spellcheck="false" autocapitalize="off" autocorrect="off" aria-label="What you heard" value="${esc(s.given)}" ${r ? 'readonly' : 'data-autofocus'}>
        ${r ? '' : `${S.keysHTML()}<div class="row"><button type="button" class="btn" data-action="dictate-giveup">Show me</button><button type="submit" class="btn primary"><kbd>Enter</kbd> Check</button></div>`}
      </form>
      ${r ? `
        <div class="feedback ${r.kind}" role="status">
          <div class="fb-text">
            <strong>${{ right: 'Bezbłędnie! Perfect · उत्कृष्ट', close: 'Almost · लगभग', wrong: 'Keep practising · अभ्यास जारी राख्नुहोस्' }[r.kind]} · ${r.pct}%</strong>
            <div class="dict-words" lang="pl">${diffWords(e.pl, s.given)}</div>
            <span class="hint">Green: right · Red underline: misspelled · Dashed: missing</span>
            ${S.pronHTML(e)}${S.meaningHTML(e)}
          </div>
          <div class="row">${S.listenBtn(e.pl, true)}<button class="btn primary" data-action="next-dictate" data-autofocus><kbd>Enter</kbd> Next</button></div>
        </div>` : ''}`;
  }

  function checkDictate(giveUp) {
    const s = session;
    const input = stage.querySelector('#dictate-answer');
    if (!s || s.mode !== 'dictate' || s.result || !input) return;
    if (!giveUp && !input.value.trim()) return;
    s.given = giveUp ? '' : input.value;
    const exact = S.clean(s.given) === S.clean(s.word.pl.replace(/…/g, ''));
    const pct = Math.round(S.similarity(s.given, s.word.pl.replace(/…/g, '')) * 100);
    const kind = exact ? 'right' : pct >= 85 ? 'close' : 'wrong';
    s.result = { kind, pct: exact ? 100 : pct };
    s.total += 1;
    if (kind === 'right') { s.score += 1; S.review(s.word, 1); } else S.review(s.word, kind === 'close' ? 0 : -1);
    draw();
  }

  // ---------- grammar drills ----------

  // ctx.drills is a list of { d, unit, idx } so mistake reviews can mix units.
  function startDrill() {
    session = { mode: 'drill', items: S.shuffle(ctx.drills), i: 0, score: 0, answered: null, picked: [], given: '' };
    prepOrder();
  }
  function prepOrder() {
    const s = session;
    const it = s.items[s.i];
    s.picked = [];
    if (it && it.d.type === 'order') {
      let tiles = S.shuffle(it.d.words.map((w, k) => ({ w, k })));
      if (tiles.every((t, k) => t.k === k) && tiles.length > 1) tiles = tiles.slice(1).concat(tiles[0]);
      s.tiles = tiles;
    }
  }
  const blankHTML = (q, fill, cls) => polish(q).replace('___', `<span class="blank ${cls || ''}">${fill ? polish(fill) : '&nbsp;'}</span>`);
  const mistakeKey = (it) => `${it.unit}#${it.idx}`;

  function drawDrill() {
    if (!session || session.mode !== 'drill') startDrill();
    const s = session;
    if (!s.items.length) { stage.innerHTML = emptyHTML('No exercises', 'There are no grammar exercises here yet.'); return; }
    if (s.i >= s.items.length) {
      const pct = Math.round((s.score / s.items.length) * 100);
      stage.innerHTML = `
        <div class="card summary">
          <span class="label">Exercises complete · अभ्यास सकियो</span>
          <h2>${pct}%</h2>
          <p class="hint">${s.score} of ${s.items.length} right. ${pct >= 80 ? 'Excellent! You can move on. · उत्कृष्ट! अगाडि बढ्नुहोस्।' : 'Read the lesson again and repeat the exercises. · पाठ फेरि पढेर अभ्यास दोहोर्याउनुहोस्।'}</p>
          <div class="row"><button class="btn primary" data-action="drill-restart" data-autofocus>Practise again</button></div>
        </div>`;
      if (ctx.unitId && !s.saved) {
        s.saved = true;
        const rec = S.progress.drills[ctx.unitId] || { best: 0, runs: 0 };
        S.progress.drills[ctx.unitId] = { best: Math.max(rec.best, pct), runs: rec.runs + 1, last: pct };
        S.saveProgress();
      }
      return;
    }
    const it = s.items[s.i];
    const d = it.d;
    const a = s.answered;
    let body = '';
    if (d.type === 'choose') {
      body = `
        <p class="drill-q" lang="pl">${blankHTML(d.q, a ? d.options[d.answer] : '', a ? (a.result === 'right' ? 'ok' : 'bad') : '')}</p>
        <div class="options">${d.options.map((o, k) => {
          let cls = 'option';
          if (a && k === d.answer) cls += ' right';
          else if (a && k === a.pick) cls += ' wrong';
          return `<button class="${cls}" data-action="drill-choose" data-index="${k}" ${a ? 'disabled' : ''}><kbd>${k + 1}</kbd><span class="opt-pl" lang="pl">${polish(o)}</span></button>`;
        }).join('')}</div>`;
    } else if (d.type === 'fill') {
      body = `
        <p class="drill-q" lang="pl">${blankHTML(d.q, a ? d.answer[0] : '', a ? (a.result === 'right' ? 'ok' : a.result === 'close' ? 'near' : 'bad') : '')}</p>
        <form class="fill-form" data-form="drill-fill" autocomplete="off">
          <input class="type-input" id="drill-answer" data-keys-target lang="pl" spellcheck="false" autocapitalize="off" autocorrect="off"
            aria-label="Missing word" value="${esc(s.given)}" ${a ? 'readonly' : 'data-autofocus'}>
          ${a ? '' : `${S.keysHTML()}<div class="row"><button type="submit" class="btn primary"><kbd>Enter</kbd> Check</button></div>`}
        </form>`;
    } else if (d.type === 'order') {
      const used = new Set(s.picked);
      body = `
        <div class="order-line ${a ? (a.result === 'right' ? 'ok' : 'bad') : ''}" aria-label="Your sentence">
          ${s.picked.length ? s.picked.map((k, pos) => `<button class="tile placed" data-action="order-remove" data-pos="${pos}" ${a ? 'disabled' : ''} lang="pl">${polish(d.words[k])}</button>`).join('') : '<span class="hint">Tap the words in the right order · सही क्रममा शब्द थिच्नुहोस्</span>'}
        </div>
        ${a ? '' : `<div class="tiles">${s.tiles.map((t) => `<button class="tile" data-action="order-add" data-k="${t.k}" ${used.has(t.k) ? 'disabled' : ''} lang="pl">${polish(t.w)}</button>`).join('')}</div>
        <div class="row"><button class="btn" data-action="order-clear">Clear</button><button class="btn primary" data-action="order-check" ${s.picked.length === d.words.length ? '' : 'disabled'}>Check</button></div>`}`;
    }

    let fb = '';
    if (a) {
      const title = { right: 'Dobrze! Correct · सही', close: 'Almost: check the accents · लगभग सही', wrong: 'Not quite · मिलेन' }[a.result];
      const correct = d.type === 'order' ? d.words.join(' ') : d.type === 'choose' ? d.q.replace('___', d.options[d.answer]) : d.q.replace(/\s*\([^)]*\)\s*$/, '').replace('___', d.answer[0]);
      fb = `
        <div class="feedback ${a.result}" role="status">
          <div class="fb-text">
            <strong>${title}</strong>
            <span class="answer" lang="pl">${polish(correct)}</span>
            ${S.transHTML(d.en, d.ne)}
            ${S.whyHTML(a.why)}
          </div>
          <div class="row">${S.listenBtn(correct, true)}<button class="btn primary" data-action="drill-next" data-autofocus><kbd>Enter</kbd> Next</button></div>
        </div>`;
    }
    const unit = S.UNIT.get(it.unit);
    stage.innerHTML = `
      <div class="meta"><span>Exercise ${s.i + 1} of ${s.items.length} · Score ${s.score}</span>${ctx.mixed && unit ? `<span>${esc(unit.title)}</span>` : ''}</div>
      <div class="card drill">
        <span class="label">${{ choose: 'Choose the right form · सही रूप छान्नुहोस्', fill: 'Write the missing word · छुटेको शब्द लेख्नुहोस्', order: 'Build the sentence · वाक्य बनाउनुहोस्' }[d.type]}</span>
        ${body}
        ${a ? '' : `<details class="trans"><summary>Show translation · अनुवाद</summary>${S.transHTML(d.en, d.ne)}</details>`}
      </div>
      ${fb}
      ${a ? `<p class="report-row">${S.reportHTML(d.q || d.words.join(' '), `Grammar exercise, unit ${it.unit}`)}</p>` : ''}`;
  }

  function finishDrill(result, why, extra) {
    const s = session;
    const it = s.items[s.i];
    s.answered = Object.assign({ result, why }, extra);
    if (result === 'right') { s.score += 1; delete S.progress.mistakes[mistakeKey(it)]; }
    else if (result === 'wrong') {
      const m = S.progress.mistakes[mistakeKey(it)];
      S.progress.mistakes[mistakeKey(it)] = { unit: it.unit, idx: it.idx, count: (m ? m.count : 0) + 1, last: S.dayKey() };
    }
    S.logActivity();
    S.saveProgress();
    if (S.onProgress) S.onProgress();
    draw();
  }

  function drillChoose(k) {
    const s = session;
    if (!s || s.answered) return;
    const d = s.items[s.i].d;
    if (k < 0 || k >= d.options.length) return;
    finishDrill(k === d.answer ? 'right' : 'wrong', d.why, { pick: k });
  }
  function drillFill() {
    const s = session;
    const input = stage.querySelector('#drill-answer');
    if (!s || s.answered || !input || !input.value.trim()) return;
    const d = s.items[s.i].d;
    s.given = input.value;
    const result = S.checkAnswer(s.given, d.answer);
    let why = d.why;
    if (result === 'wrong' && d.traps) {
      const key = S.clean(s.given);
      const trap = Object.entries(d.traps).find(([t]) => S.clean(t) === key) || Object.entries(d.traps).find(([t]) => S.fold(t) === S.fold(key));
      if (trap) why = trap[1];
    }
    finishDrill(result, why);
  }
  function orderCheck() {
    const s = session;
    const d = s.items[s.i].d;
    if (s.picked.length !== d.words.length) return;
    const built = s.picked.map((k) => d.words[k]).join(' ');
    finishDrill(S.clean(built) === S.clean(d.words.join(' ')) ? 'right' : 'wrong', d.why || null);
  }
  function drillNext() {
    const s = session;
    s.i += 1;
    s.answered = null;
    s.given = '';
    prepOrder();
    draw();
  }

  // ---------- actions and keys ----------

  P.action = (a, el) => {
    switch (a) {
      case 'flip': flip(); return true;
      case 'rate': rate(el.dataset.rate); return true;
      case 'new-cards': session = null; draw(); return true;
      case 'answer': answer(Number(el.dataset.index)); return true;
      case 'next-choice': newChoice(session.mode); draw(); return true;
      case 'next-type': newType(); draw(); return true;
      case 'next-dictate': newDictate(); draw(); return true;
      case 'dictate-giveup': checkDictate(true); return true;
      case 'hint': {
        const input = stage.querySelector('#type-answer');
        if (input) session.given = input.value;
        session.hint = Math.min(session.hint + 1, session.word.pl.length);
        draw();
        return true;
      }
      case 'dir':
        S.settings.dir = S.settings.dir === 'pl' ? 'meaning' : 'pl';
        S.saveSettings();
        session = null;
        draw();
        return true;
      case 'speak-check': speakCheck(); return true;
      case 'record': record(); return true;
      case 'record-stop': if (S.stopRecording) S.stopRecording(); return true;
      case 'self-rate':
        session.total += 1;
        if (el.dataset.ok === '1') { session.score += 1; S.review(session.word, 1); } else S.review(session.word, 0);
        newSpeak(); draw();
        return true;
      case 'next-speak': newSpeak(); draw(); return true;
      case 'drill-choose': drillChoose(Number(el.dataset.index)); return true;
      case 'drill-next': drillNext(); return true;
      case 'drill-restart': startDrill(); draw(); return true;
      case 'order-add': if (!session.answered) { session.picked.push(Number(el.dataset.k)); draw(); } return true;
      case 'order-remove': if (!session.answered) { session.picked.splice(Number(el.dataset.pos), 1); draw(); } return true;
      case 'order-clear': session.picked = []; draw(); return true;
      case 'order-check': orderCheck(); return true;
      default: return false;
    }
  };

  P.submit = (form) => {
    if (form.dataset.form === 'type') { checkType(); return true; }
    if (form.dataset.form === 'dictate') { checkDictate(false); return true; }
    if (form.dataset.form === 'drill-fill') { drillFill(); return true; }
    return false;
  };

  P.key = (ev) => {
    const s = session;
    if (!s || !stage || !stage.isConnected) return false;
    const onButton = ev.target.tagName === 'BUTTON';
    if (s.mode === 'cards') {
      if (ev.key === ' ' && !s.flipped && !onButton) { ev.preventDefault(); flip(); return true; }
      if (s.flipped && ['1', '2', '3'].includes(ev.key)) { rate(['again', 'good', 'easy'][Number(ev.key) - 1]); return true; }
    } else if ((s.mode === 'quiz' || s.mode === 'listen') && s.picked === null && /^[1-4]$/.test(ev.key)) {
      answer(Number(ev.key) - 1); return true;
    } else if (s.mode === 'drill' && !s.answered && s.items[s.i] && s.items[s.i].d.type === 'choose' && /^[1-4]$/.test(ev.key)) {
      drillChoose(Number(ev.key) - 1); return true;
    }
    return false;
  };
})();

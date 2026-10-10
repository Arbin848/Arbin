# Słówka practice content guide

This extends `tools/CONTENT_GUIDE.md` (read that first: audience, pronunciation conventions, quality bar).
Everything here is **fixed, hand-written content**. The app never calls an AI, so every explanation a
learner might need must be written into the data. Write explanations the way a kind, clear teacher
would: say what is wrong, why, and what the right form is. Always give both `en` and `ne`.

Validate after every change: `node tools/validate.js data/<file>.js` must print "All good".

Entries use the same five-field shape as the course: `[pl, en, ne, pron, proNe]`.

Strings use double quotes. Polish inside explanations is marked with `*…*` (as in lessons).

---

## 1. Grammar drills — `window.SLOWKA_DRILLS`

```js
window.SLOWKA_DRILLS = window.SLOWKA_DRILLS || {};
window.SLOWKA_DRILLS["a1-05"] = [ /* 10–12 items */ ];
```

Keys are unit ids from `data/*.js`. Each unit gets **10–12 items**: about 4 `choose`, 4–5 `fill`, 2–3 `order`.
Drills must practise **that unit's grammar and words** (open the unit file and read it first). Start-level
units practise sounds and spelling (which letter makes this sound, which spelling is right, stress).

### choose — pick the right form
```js
{ type: "choose",
  q: "To jest ___ mama.",                     // exactly one ___
  options: ["moja", "mój", "moje"],           // 2–4 options, all plausible
  answer: 0,                                  // index of the right option
  en: "This is my mum.", ne: "यो मेरी आमा हुनुहुन्छ।",   // translation of the full correct sentence
  why: { en: "*mama* ends in -a, so it is feminine: use *moja*.", ne: "*mama* -a मा टुंगिन्छ, त्यसैले स्त्रीलिङ्ग हो: *moja* प्रयोग गर्नुहोस्।" } }
```

### fill — type the missing word
```js
{ type: "fill",
  q: "Mam brata i ___. (siostra)",            // exactly one ___; base form in brackets at the end
  answer: ["siostrę"],                        // every accepted answer, correct spelling
  en: "I have a brother and a sister.", ne: "मेरो एक दाजु/भाइ र एक दिदी/बहिनी छन्।",
  why: { en: "After *mam* (I have) a feminine noun takes the accusative: -a → -ę.", ne: "…" },
  traps: {                                    // OPTIONAL but strongly wanted: likely wrong answers → targeted explanation
    "siostra": { en: "*siostra* is the dictionary form. After *mam* it must change to *siostrę*.", ne: "…" },
    "siostry": { en: "*siostry* is genitive (used after *nie mam*). Here you have one, so: *siostrę*.", ne: "…" } } }
```
Write 1–3 `traps` per fill item for the mistakes learners really make (dictionary form, wrong case,
wrong gender, missing diacritics are handled automatically — don't add those).

### order — put the words in order
```js
{ type: "order",
  words: ["Nie", "mam", "dzisiaj", "czasu."],  // 3–8 tokens IN THE CORRECT ORDER; app shuffles them
  en: "I don't have time today.", ne: "आज मसँग समय छैन।",
  why: { en: "*nie* goes directly before the verb.", ne: "*nie* क्रियाको ठीक अगाडि आउँछ।" } }
```
Pick sentences with one clearly natural order (Polish word order is flexible, so avoid ambiguous ones).
Punctuation stays attached to the last token. Capitalise the first token.

---

## 2. Conversation practice (role-plays) — `window.SLOWKA_ROLEPLAYS`

```js
window.SLOWKA_ROLEPLAYS = window.SLOWKA_ROLEPLAYS || [];
window.SLOWKA_ROLEPLAYS.push({
  id: "rp-a1-cafe",                 // "rp-" + level + "-" + slug, unique
  level: "A1",                      // A1 | A2 | B1 | B2
  title: "Ordering at a café", titleNe: "क्याफेमा अर्डर गर्दै",
  scene: { en: "You walk into a small café in Warsaw. You want a coffee with milk and a cake.",
           ne: "तपाईं वार्सामा एउटा सानो क्याफेमा पस्नुहुन्छ। तपाईंलाई दूधसहितको कफी र केक चाहिएको छ।" },
  them: "Kelnerka",                 // who you talk to (Polish word for the role, or a first name)
  themEn: "Waitress", themNe: "वेट्रेस",
  steps: [                          // 6–9 steps
    { them: ["Dzień dobry! Co podać?", "Hello! What can I get you?", "नमस्ते! के ल्याऊँ?"],
      replies: [                    // exactly 3 replies; 1 or 2 have ok:true
        { pl: "Poproszę kawę z mlekiem.", en: "A coffee with milk, please.", ne: "दूधसहितको कफी दिनुहोस्।", ok: true },
        { pl: "Poproszę kawa z mleko.", en: "(wrong forms)", ne: "(गलत रूप)", ok: false,
          why: { en: "After *poproszę*, *kawa* becomes *kawę*, and after *z* (with), *mleko* becomes *mlekiem*.", ne: "…" } },
        { pl: "Do widzenia!", en: "Goodbye!", ne: "बिदा!", ok: false,
          why: { en: "*Do widzenia* means goodbye. You have only just arrived.", ne: "…" } } ] },
    …
  ],
  end: { en: "Well done! You ordered, paid and said goodbye politely.", ne: "…" },
  useful: [ [pl, en, ne, pron, proNe], … ]   // 5–8 key phrases from this conversation
});
```
Wrong replies should teach something: a grammar slip a learner would really make, a wrong politeness level
(using *ty* with an official), or a reply that doesn't fit the situation. Each `why` explains it clearly.
The conversation should flow as a realistic exchange regardless of which correct reply was chosen.
Practical, real-life Poland situations for Nepali workers are the priority.

---

## 3. Reading — `window.SLOWKA_STORIES`

```js
window.SLOWKA_STORIES = window.SLOWKA_STORIES || [];
window.SLOWKA_STORIES.push({
  id: "st-a1-01", level: "A1",       // A1 | A2 | B1 | B2
  kind: "story",                     // story | message | notice | document | article | email
  title: "Ram's first day", titleNe: "रामको पहिलो दिन",
  paragraphs: [                      // 3–6 paragraphs; A1 short and simple, B2 longer and richer
    { pl: "Ram jest z Nepalu. …", en: "Ram is from Nepal. …", ne: "राम नेपालबाट हुनुहुन्छ। …" } ],
  glossary: [ [pl, en, ne, pron, proNe], … ],   // 10–20 words AS THEY APPEAR IN THE TEXT (inflected forms), lowercase
  questions: [                       // 3–5 comprehension questions, in Polish
    { q: "Skąd jest Ram?", en: "Where is Ram from?", ne: "राम कहाँबाट हुनुहुन्छ?",
      options: ["Z Nepalu.", "Z Polski.", "Z Indii."], answer: 0,
      why: { en: "The first sentence says *Ram jest z Nepalu*.", ne: "…" } } ]
});
```
`message`/`notice`/`document`/`email` are realistic texts a worker in Poland meets: an SMS from a boss,
a notice in the stairwell, a shift schedule, a receipt, a rental advert, a contract excerpt, a letter from an office.
Keep names and places realistic but fictional (no real companies or people).

---

## 4. Exams and placement — `window.SLOWKA_PLACEMENT`, `window.SLOWKA_EXAMS`

```js
window.SLOWKA_PLACEMENT = [          // exactly 30 items: 6 Start/A1-basic, 6 A1, 6 A2, 6 B1, 6 B2, in that order
  { level: "A1", q: "___ jest Anna.", en: "This is Anna.", ne: "यो आन्ना हो।", options: ["To", "Ta", "Ten"], answer: 0 } ];

window.SLOWKA_EXAMS = [ {
  id: "b1-practice-1", level: "B1",
  title: "B1 practice test 1", titleNe: "B1 अभ्यास परीक्षा १",
  intro: { en: "…what the real exam is like and how to use this test…", ne: "…" },
  sections: [
    { kind: "listening", title: "Listening", titleNe: "सुनाइ",
      items: [ { audio: "Polish text the app will read aloud (2–5 sentences)",
                 en: "translation of the audio", ne: "…",
                 q: "Polish question", qEn: "…", qNe: "…",
                 options: ["…", "…", "…"], answer: 1, why: { en: "…", ne: "…" } } ] },   // 5 items
    { kind: "reading", title: "Reading", titleNe: "पढाइ",
      text: { pl: "…", en: "…", ne: "…" },
      items: [ { q, qEn, qNe, options, answer, why } ] },                                // 5 items
    { kind: "grammar", title: "Grammar", titleNe: "व्याकरण",
      items: [ { q: "sentence with ___", en, ne, options, answer, why } ] },             // 10 items
    { kind: "writing", title: "Writing", titleNe: "लेखाइ",
      tasks: [ { prompt: { pl: "…", en: "…", ne: "…" }, minWords: 60,
                 model: { pl: "model answer", en: "…", ne: "…" },
                 checklist: [ { en: "Did you greet the reader politely?", ne: "…" } ] } ] }   // 2 tasks, 4–6 checklist points each
  ] } ];
```
Exam questions are in Polish like the real *egzamin certyfikatowy*; translations help learners check themselves.

---

## 5. Work word packs

Work packs are ordinary course units (same shape as in `CONTENT_GUIDE.md`) with `level: "Work"` and ids
`work-01`…. They may have up to 25 words. Lessons explain the job context, safety rules and the most
important phrases in English and Nepali.

# Słówka

A small web app for learning Polish vocabulary. *Słówka* is what Polish learners call their vocab words.

## What's inside

- **Flashcards**: flip a card, then rate it *Again*, *Good* or *Easy*. Words you struggle with come back sooner (Leitner-box spaced repetition).
- **Quiz**: multiple choice, Polish → English or English → Polish.
- **Type it**: write the Polish word yourself, using the on-screen keys for ą ć ę ł ń ó ś ź ż. Missing accents count as "almost".
- **Sounds**: a guide to Polish letters and digraphs (sz, cz, rz, ł, ś…) with example words.
- About 100 words in 8 topics: greetings, numbers, food, family, days and time, getting around, verbs and useful phrases.
- Pronunciation for every word, with the stressed syllable in capitals, plus a **Listen** button that uses your device's Polish text-to-speech voice when it has one.
- Day streak, words learned and a daily review count, all saved in your browser's localStorage.

Keyboard: `Space` flips a card, `1`/`2`/`3` rate it, `1`–`4` answer the quiz, and `Enter` checks or moves on.

## Run it

There's no build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Add words

Edit `words.js`. Each word is `['polish', 'english', 'pro-NUN-ci-a-tion']`, inside a topic. New topics show up automatically.

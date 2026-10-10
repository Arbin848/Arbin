# Słówka

A complete Polish course for Nepali and English speakers, from the alphabet up to B2.
*Słówka* is what Polish learners call their vocab words.

पोलिस भाषा सुरुदेखि सिक्ने कोर्स: वर्णमाला, उच्चारण, व्याकरण र दैनिक जीवनका शब्दहरू, अंग्रेजी र नेपाली व्याख्यासहित।

## What's inside

- **Start here**: the 32-letter alphabet, letter pairs (sz, cz, rz…), soft sounds, nasal vowels, stress and reading rules, and a survival kit of first words.
- **A1 Beginner → A2 Elementary → B1 Intermediate → B2 Upper intermediate**: about 45 units covering everyday topics (family, food, time, shopping, work, the doctor, official matters in Poland, renting and banking) and all the core grammar (gender, the seven cases, past and future, aspect, the imperative, the conditional, verbs of motion, participles).
- Each unit has:
  - a **lesson** explained in English and in Nepali, with grammar tables
  - **words** and **example sentences**, each with:
    - its meaning in English and Nepali
    - pronunciation in English letters (`jen DOB-ri`) and in Devanagari (`जेन् ˈदोब्-रि`), with the stressed syllable marked
  - a short **dialogue**
  - practice: **flashcards**, a **quiz**, a **listening** quiz and **typing** with on-screen keys for ą ć ę ł ń ó ś ź ż
- **Daily review** brings practised words back on a spaced-repetition schedule (1, 2, 4, 7 and 14 days).
- A **dictionary** to search every word in Polish, English or Nepali (Polish works without accents), and an **alphabet** reference.
- **Settings** to show meanings, pronunciation and lesson explanations in English, Nepali or both, and to slow down speech.

Progress is saved in your browser's localStorage. The Listen buttons use your device's Polish text-to-speech voice when it has one.

Keyboard: `Space` flips a card, `1`/`2`/`3` rate it, `1`–`4` answer the quiz and listening questions, and `Enter` checks or moves on.

## Run it

There's no build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Add or edit content

Course content lives in `data/*.js`. See [`tools/CONTENT_GUIDE.md`](tools/CONTENT_GUIDE.md) for the format and the pronunciation conventions, then check your changes:

```sh
node tools/validate.js
```

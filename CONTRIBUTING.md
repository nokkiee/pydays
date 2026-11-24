# Contributing to PyDays

Thanks for wanting to help! A bug report, a fixed typo, a better explanation or a new translation
all help people learning Python. Please read this file and the [code of conduct](CODE_OF_CONDUCT.md)
before your first contribution.

## Reporting bugs

Report bugs and ideas in [Issues](https://github.com/nokkiee/pydays/issues). These help most:

- the app version (*Settings → About*) and your system (Windows or Linux, which distribution),
- the day and exercise it is about, for example `day 12, exercise 2`,
- what you did, what you expected and what happened, ideally with a screenshot,
- for problems running code: your Python version (shown in the status bar of the editor).

Found a mistake in a lesson or in an exercise's check? Say which language you were reading.

Do **not** report security problems publicly; see [SECURITY.md](SECURITY.md).

## Rules for content

- **Original text only.** The curriculum follows
  [30 Days Of Python](https://github.com/Asabeneh/30-Days-Of-Python), which has no license. Never
  copy its text, examples or exercises into the app. Follow its outline, write your own.
- **Five languages.** Every text exists in English, Polish, German, Spanish and French. A lesson
  or an exercise that is missing a language fails `npm run check-content`.
- **Polish is written gender-neutrally**: use forms that do not reveal the learner's gender, such as "udało się" instead of a past-tense "-łeś / -łaś" verb.
- **Everything runs.** Every example, every model solution and every starter is executed by
  `tools/check-content.mjs`: examples must run, solutions must pass their tests and starters must
  fail them. Examples that need a server, a database or an extra package are marked (`norun`,
  `needs=pkg`) in the lesson format described at the top of `renderer/js/parse.js`.
- **Exercises use only the standard library**, so they work on a fresh Python install.

## Setting up

You need [Node.js](https://nodejs.org/) 22 and Python 3.8 or newer.

```bash
npm ci
```

```bash
npm start
```

`npm run dev` starts the app with developer tools (F12).

## Tests

Run these before you send a change. GitHub Actions runs them for every pull request.

```bash
npm test
```

```bash
npm run check-content
```

```bash
npm run smoke
```

`npm run smoke` opens the real app in a hidden window and clicks through a lesson, the terminal,
exercises, the calendar and settings. On Linux without a display use `xvfb-run -a npm run smoke`.
Changed the look or a behavior? Add or adjust a step in `scripts/smoke-inner.js`. To look at the
result, run `npm run shots`, which saves screenshots to `tmp-shots/`.

## Code

- Follow the style of the surrounding code: ES modules in `renderer/js`, comments in English,
  colors only through the CSS variables in `renderer/css/app.css`.
- UI texts live in `renderer/i18n/<language>.js` and must exist in all five files.
- Small, well-described changes are easier to review than one big one.
- Commit messages: a short first line saying what changed and, if needed, a paragraph on why.

## Pull requests

1. Fork the repository and branch from `main`.
2. Make your change together with tests and run them locally.
3. Open a pull request saying what changes, why, and how you checked it (a screenshot for
   anything visual).
4. The **Tests** and **App build** workflows must pass.

By contributing you agree that your changes are released under the same license as the project
(see [LICENSE](LICENSE)).

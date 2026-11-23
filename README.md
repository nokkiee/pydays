# PyDays

Learn Python in 30 days: one class a day, a VS Code-style editor, a real Python terminal, and a calendar that tracks your progress. Available in English, Polish, German, Spanish and French.

The course follows the day-by-day curriculum of [30 Days Of Python](https://github.com/Asabeneh/30-Days-Of-Python) by Asabeneh Yetayeh. The lessons and exercises in this app are original writing for the app and follow that curriculum. Each lesson links to its day in the original course.

## Features

- **30 classes.** Each day has a lesson with runnable examples and 3–5 exercises with automatic checks. The days run from *Introduction* to *Building an API* and *Conclusions*.
- **Editor.** Monaco, the editor from VS Code, with a dark theme, Python completions, and a Problems panel that marks syntax errors as you type.
- **Terminal.** Programs run in your own Python. `input()` is answered in the terminal, and tracebacks are marked on the matching line in the editor. There is also an interactive Python shell.
- **Exercise checks.** Each check runs your program and reports which test passed or failed. Hints and a model solution are available when you get stuck.
- **Calendar.**
  - Every day you study is marked, with your study time, solved exercises and finished lessons.
  - It shows your streak, your longest streak and your total study time.
- **Milestones** at 3, 7, 14, 21 and 30 completed days.
  - A day counts as completed when all its exercises pass, or when you mark it done.
  - Milestones are celebrated and shown in the calendar on the day you reach them.
- **Sandbox.** A free editor for your own experiments.
- **Languages.** The interface and all 30 lessons are in English, Polish, German, Spanish and French. You can switch at any time.

## Requirements

- Node.js 20 or newer (to run from source).
- Python 3.8 or newer.
  - The app looks for `python3` or `python`; on Windows it also tries `py -3`.
  - You can set another interpreter, such as a virtual environment, in **Settings → Python**.
- Optional packages, for the later days:
  - `requests` (days 20, 22, 28);
  - `beautifulsoup4` (day 22);
  - `numpy` (day 24);
  - `pandas` (day 25);
  - `flask` (days 26, 29);
  - `pymongo` (day 27).

  The exercises themselves use only the standard library. If a program fails because a package is missing, the terminal shows the `pip install` command to run.

## Running

```bash
npm install
npm start
```

Builds: `npm run dist` makes an AppImage and a .deb, and `npm run dist:win` makes a Windows installer and a portable build.

## Development

| Command | What it does |
|---|---|
| `npm test` | unit tests (content parser, translations, progress and milestones) |
| `npm run check-content [day…]` | checks every lesson (see below) |
| `npm run smoke` | starts the app hidden and clicks through lesson, terminal, shell, exercises, calendar and settings |
| `npm run shots -- --lang=pl --seed` | the same, saving screenshots, with a week of sample progress |

`check-content` makes these checks:
- every text exists in all five languages, and tables match between languages;
- every runnable example runs;
- every model solution passes its exercise's tests;
- every starter fails them.

Lessons live in `content/days/NN.txt`, in a small text format described at the top of `renderer/js/parse.js`.

## Credits

- Curriculum: [30 Days Of Python](https://github.com/Asabeneh/30-Days-Of-Python) by Asabeneh Yetayeh.
- Editor: [Monaco Editor](https://github.com/microsoft/monaco-editor) (MIT).
- Markdown: [marked](https://github.com/markedjs/marked) (MIT).
- Fonts: Inter, Source Serif 4 and JetBrains Mono (SIL Open Font License), via Fontsource.
- The Python runner and terminal are adapted from Informatura.

## License

GPL-3.0-only – see [LICENSE](LICENSE).

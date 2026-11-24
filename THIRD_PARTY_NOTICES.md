# Third-party notices

PyDays is distributed under the GNU General Public License v3.0 only (see `LICENSE`).
It bundles the following software and materials.

## Software

| Component | Version | License | Copyright |
|---|---|---|---|
| [Electron](https://www.electronjs.org/) (includes Chromium and Node.js) | 45 | MIT (Chromium and Node.js: see `LICENSES.chromium.html` next to the executable) | GitHub Inc. and Electron contributors |
| [Monaco Editor](https://github.com/microsoft/monaco-editor) | 0.58.0 | MIT | Microsoft Corporation |
| [marked](https://github.com/markedjs/marked) | 18 | MIT | Christopher Jeffrey and the marked contributors |

### MIT License (Electron, Monaco Editor, marked)

```
Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Fonts

All three fonts are used under the SIL Open Font License, Version 1.1
(<https://openfontlicense.org/>). They are bundled through [Fontsource](https://fontsource.org/).

| Font | Copyright |
|---|---|
| [Inter](https://github.com/rsms/inter) | Copyright 2016 The Inter Project Authors |
| [Source Serif 4](https://github.com/adobe-fonts/source-serif) | Copyright Adobe, with Reserved Font Name "Source" |
| [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) | Copyright 2020 The JetBrains Mono Project Authors |

## Course material

The 30-day curriculum follows [30 Days Of Python](https://github.com/Asabeneh/30-Days-Of-Python)
by Asabeneh Yetayeh. That repository has no license, so no text from it is included: every lesson
and exercise in `content/days/` is original writing for PyDays that follows its day-by-day outline.
Each lesson links to its day in the original course.

## Adapted code

The Python runner (`src/runner.js`, `src/harness.py`) and the terminal are adapted from
Informatura, by the same author and under the same license.

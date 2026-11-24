# Security

## Supported versions

Security fixes go into the latest release. If you have an older version, update from
[Releases](https://github.com/nokkiee/pydays/releases/latest).

| Version | Supported |
|---|---|
| latest release | ✅ |
| older releases | ❌ |

## Reporting a vulnerability

**Do not report vulnerabilities in public Issues.** Use GitHub's private reporting instead:
**Security → Report a vulnerability** in this repository. Only the maintainer sees the report.

Please include:

- what the vulnerability is and what it could lead to,
- how to reproduce it (app version, operating system, steps, and a file or code if needed),
- if you know it, how it could be fixed.

I aim to answer within a few days. Once a vulnerability is confirmed I will prepare a fix and a
new release, and credit you in the release notes unless you prefer to stay anonymous.

## How the app works (what is and is not a vulnerability)

- **You run code on your own computer.** Programs you write in the editor are run by the Python
  installed on your machine, with your permissions, in a working folder for the lesson, exactly as
  if you had started them from a terminal. They are not sandboxed, so run only code you understand
  (for example, do not paste code from the internet blindly). This alone is not a vulnerability.
- **The app does not send your data anywhere.** Your progress, code and settings are stored only
  on your computer. Links open in your browser. Some lesson examples marked as needing the
  internet (for instance the `requests` ones) only make a request when you run them yourself.
- **The installers are not code-signed.** Download them only from
  [Releases](https://github.com/nokkiee/pydays/releases) in this repository. Each release has a
  `SHA256SUMS.txt` with checksums; see below for how to verify a download.

Examples of what we do treat as a vulnerability: running code or commands without your knowledge
(for example through lesson content or a saved state file), reading or writing files outside the
app folder and the lesson's working folder without your action, or getting around the app
window's protections (Content Security Policy, context isolation).

## Verifying a download

A SHA-256 checksum is a fingerprint of a file: if even one byte differs, the checksum is
completely different. Compare the checksum of your download with the line for that file in
`SHA256SUMS.txt` from the same release.

Windows (PowerShell, in the folder with the download):

```bash
Get-FileHash .\PyDays-Setup-1.0.0.exe -Algorithm SHA256
```

Linux (in the folder with the download and `SHA256SUMS.txt`):

```bash
sha256sum --check --ignore-missing SHA256SUMS.txt
```

If the checksum does not match, do not run the file. Download it again, and if the problem
persists, report it as described above.

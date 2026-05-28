---
name: html-push
description: Use when publishing or updating a local HTML report on GitHub Pages, optionally wrapping it with a password gate, updating the reports-index page, and verifying the Pages build. Applies to requests like "опубликуй html", "сделай ссылку на отчет", "запушь отчет", or "обнови reports-index".
metadata:
  short-description: Publish HTML reports to Pages
---

# HTML Push

Use this skill to publish a single local `.html` report to GitHub Pages and return a public URL. This is the Codex-native migration of the old `/html-push` workflow recovered from Claude file-history.

## Inputs

- HTML file path: required.
- Repo name: optional; default is the sanitized HTML filename without `.html`.
- GitHub owner/org: default from current `git remote -v`; ask only if it cannot be inferred.
- Password: optional. If provided, create a password-gated wrapper. Do not echo the password in final responses or logs.

## Workflow

1. Validate the input file exists, is `.html`, and can be read as text.
2. Derive final URL: `https://<owner>.github.io/<repo-name>/`.
3. Prepare a temporary deploy folder outside the repo, usually under `C:\tmp`.
4. If no password is requested, copy the source HTML to `index.html`.
5. If password is requested, build an AES-GCM browser wrapper:
   - random salt and IV;
   - PBKDF2-SHA256 key derivation;
   - one `<input type="password">` only;
   - decrypt via Web Crypto API and replace page contents on success;
   - show a short error on wrong password.
6. Create the GitHub repo if it does not exist. If GitHub auth is unavailable, prepare exact commands/API payload and stop.
7. Push `index.html` to branch `main` with HTTPS auth when SSH host verification fails on Windows.
8. Enable GitHub Pages from branch `main`, root `/`. Treat "already configured" as success.
9. Update `<owner>/reports-index` after a successful push. Do not update local `reports_index.md`.
10. Verify GitHub Pages build status and then check the public URL.

## Required Checks

- Verify generated deploy folder contains exactly one `index.html`.
- If password-gated, verify exactly one password input exists.
- Verify GitHub Pages build status is `built`; if `building`, wait and retry; if `errored`, repair Pages configuration before declaring success.
- Verify `reports-index` contains or updates the report row after the report URL is live.

## Safety

- Do not print or store GitHub tokens in skills, journals, or final answers.
- Do not delete local report files unless the user explicitly asks.
- Do not claim a report was published if GitHub auth, push, Pages build, or URL verification failed.
- If only a draft/payload was prepared, state that clearly.


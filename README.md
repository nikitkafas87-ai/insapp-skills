# Insapp Codex Skills

Personal Codex assets for Insapp QA work: skills, MCP helpers, setup notes, and reusable tooling.

The repository follows the same top-level layout as `geo-ai-advisory/insapp-skills`:

- `skills/` - user-maintained Codex skills.
- `mcp-servers/` - local MCP server code and setup notes.
- `tools/` - helper scripts for installing or syncing assets.
- `guides/` - longer setup notes and workflows.
- `reports/` - archived HTML reports from GitHub Pages.
- `plugins/` - personal plugin notes. Bundled OpenAI plugins are intentionally not vendored.
- `config/` - sanitized Codex config examples. Real tokens stay local.

## Exported Skills

- `audio_script`
- `autotest-review`
- `badges-osago-check`
- `feature-doc-writer`
- `html-push`
- `osago-crosses-check`
- `osago-insurers-check`
- `partner-settings-test`
- `pool-reinsurance-check`
- `tracker`
- `tracker-add-task`
- `tracker-report-active`

## MCP

Current local setup is represented as templates, not as a live config dump. Real values such as Tracker OAuth tokens, Google service account paths, GitHub tokens, and DB MCP API keys must stay outside git.

See:

- `config/codex.config.example.toml`
- `mcp-servers/README.md`
- `mcp-servers/tracker-attachments/README.md`

## Reports

HTML reports from `https://nikitkafas87-ai.github.io/reports-index/` are archived under `reports/`.

See `reports/README.md` for the source repos, public URLs, and captured commits.

## Install Locally

From this repository root:

```powershell
.\tools\install-codex-assets.ps1
```

The script copies skills into `%USERPROFILE%\.codex\skills` and installs the custom Tracker attachments MCP server under `%USERPROFILE%\.codex\mcp-servers\tracker-attachments\server.py`. It does not edit `config.toml`; merge the sanitized config snippet manually and keep secrets in local-only files or environment variables.

## Safety

Before committing changes, run:

```powershell
rg -n --hidden -i "(token|secret|api[_-]?key|oauth|password|client_secret|private[_-]?key|authorization|bearer|x-api-key)" .
rg -n --hidden "[A-Fa-f0-9]{32}|y0__[A-Za-z0-9_\-]+|gh[pousr]_[A-Za-z0-9_]+|AIza[0-9A-Za-z_\-]{35}|-----BEGIN .*PRIVATE KEY" .
```

Expected matches should be documentation placeholders only.

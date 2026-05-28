# Скиллы Codex для Insapp

Личный набор Codex-артефактов для QA-задач Insapp: скиллы, MCP-хелперы, заметки по настройке, отчеты и переиспользуемые инструменты.

Структура верхнего уровня повторяет подход из `geo-ai-advisory/insapp-skills`:

- `skills/` - пользовательские Codex-скиллы.
- `mcp-servers/` - код локальных MCP-серверов и инструкции по настройке.
- `tools/` - вспомогательные скрипты для установки и синхронизации.
- `guides/` - подробные инструкции и рабочие процессы.
- `reports/` - архив HTML-отчетов с GitHub Pages.
- `plugins/` - заметки по личным плагинам. Bundled-плагины OpenAI намеренно не вендорятся.
- `config/` - очищенные примеры Codex-конфига. Реальные токены остаются только локально.

## Экспортированные Скиллы

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

Текущая локальная настройка сохранена как шаблоны, а не как прямой дамп рабочего конфига. Реальные значения вроде OAuth-токенов Tracker, путей к Google service account, GitHub-токенов и API-ключей DB MCP должны оставаться вне git.

См.:

- `config/codex.config.example.toml`
- `mcp-servers/README.md`
- `mcp-servers/tracker-attachments/README.md`

## Отчеты

HTML-отчеты из `https://nikitkafas87-ai.github.io/reports-index/` заархивированы в `reports/`.

В `reports/README.md` указаны исходные репозитории, публичные URL и зафиксированные коммиты.

## Локальная Установка

Из корня этого репозитория:

```powershell
.\tools\install-codex-assets.ps1
```

Скрипт копирует скиллы в `%USERPROFILE%\.codex\skills` и устанавливает кастомный MCP-сервер для вложений Tracker в `%USERPROFILE%\.codex\mcp-servers\tracker-attachments\server.py`. `config.toml` он не меняет: очищенный пример конфига нужно перенести вручную, а секреты хранить только в локальных файлах или переменных окружения.

## Безопасность

Перед коммитом изменений запускай:

```powershell
rg -n --hidden -i "(token|secret|api[_-]?key|oauth|password|client_secret|private[_-]?key|authorization|bearer|x-api-key)" .
rg -n --hidden "[A-Fa-f0-9]{32}|y0__[A-Za-z0-9_\-]+|gh[pousr]_[A-Za-z0-9_]+|AIza[0-9A-Za-z_\-]{35}|-----BEGIN .*PRIVATE KEY" .
```

Ожидаемые совпадения должны быть только документационными плейсхолдерами.

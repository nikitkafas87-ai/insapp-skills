# MCP-Серверы

В этой папке хранится код локальных MCP-серверов и заметки по настройке, которые сопровождаются вместе со скиллами.

В репозитории хранится:

- `tracker-attachments/` - локальный Python MCP-сервер для загрузки вложений в Tracker, операций с чеклистами и inline-вложений в комментариях.

Не вендорится здесь:

- `google-sheets` - устанавливается через `uvx mcp-google-sheets`.
- `playwright` - устанавливается через `npx @playwright/mcp@latest`.
- `context7` - устанавливается через `npx -y @upstash/context7-mcp`.
- `tracker` - устанавливается через `uvx yandex-tracker-mcp@latest`.
- `insapp-db` - удаленный HTTP MCP, настраивается локальным API-ключом.

Очищенный пример конфига лежит в `config/codex.config.example.toml`.

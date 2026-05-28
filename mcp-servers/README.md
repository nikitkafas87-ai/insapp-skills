# MCP Servers

This folder stores local MCP server code and setup notes that are maintained with the skills repository.

Tracked here:

- `tracker-attachments/` - local Python MCP server for uploading Tracker attachments, checklist operations, and inline attachment comments.

Not vendored here:

- `google-sheets` - installed through `uvx mcp-google-sheets`.
- `playwright` - installed through `npx @playwright/mcp@latest`.
- `context7` - installed through `npx -y @upstash/context7-mcp`.
- `tracker` - installed through `uvx yandex-tracker-mcp@latest`.
- `insapp-db` - remote HTTP MCP, configured with a local API key.

Use `config/codex.config.example.toml` as a sanitized config reference.


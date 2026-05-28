# Tracker Attachments MCP

Кастомный локальный MCP-сервер, скопированный из:

`C:\Users\nikit\projects\autotests\scripts\mcp\tracker_attachments_server.py`

## Обязательные Переменные Окружения

- `TRACKER_TOKEN` or `TRACKER_IAM_TOKEN`
- `TRACKER_ORG_ID` or `TRACKER_CLOUD_ORG_ID`

Опционально:

- `TRACKER_API_BASE`
- `TRACKER_ATTACHMENTS_FORCE_CURL=1`

## Codex Config

```toml
[mcp_servers.tracker-attachments]
command = "C:\\Users\\nikit\\.local\\bin\\uvx.exe"
args = [
  "--python", "3.12",
  "--with", "mcp",
  "--with", "httpx",
  "--with", "truststore",
  "python",
  "C:\\Users\\nikit\\.codex\\mcp-servers\\tracker-attachments\\server.py",
]
env = { TRACKER_ORG_ID = "8168995", TRACKER_TOKEN = "REPLACE_WITH_LOCAL_TRACKER_TOKEN" }
```

Реальный токен храни только в локальном Codex config или в локальном окружении.

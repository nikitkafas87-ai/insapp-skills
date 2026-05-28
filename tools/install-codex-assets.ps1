param(
    [string]$CodexHome = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" })
)

$ErrorActionPreference = "Stop"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptPath
$skillsSource = Join-Path $repoRoot "skills"
$skillsTarget = Join-Path $CodexHome "skills"
$mcpTarget = Join-Path $CodexHome "mcp-servers\tracker-attachments"

if (!(Test-Path $skillsSource)) {
    throw "Папка с исходниками скиллов не найдена: $skillsSource"
}

New-Item -ItemType Directory -Force -Path $skillsTarget | Out-Null
Get-ChildItem -Directory $skillsSource | ForEach-Object {
    $target = Join-Path $skillsTarget $_.Name
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Copy-Item -LiteralPath (Join-Path $_.FullName "*") -Destination $target -Recurse -Force
    Write-Host "Скилл установлен: $($_.Name)"
}

$serverSource = Join-Path $repoRoot "mcp-servers\tracker-attachments\server.py"
if (Test-Path $serverSource) {
    New-Item -ItemType Directory -Force -Path $mcpTarget | Out-Null
    Copy-Item -LiteralPath $serverSource -Destination (Join-Path $mcpTarget "server.py") -Force
    Write-Host "MCP-сервер установлен: tracker-attachments"
}

Write-Host ""
Write-Host "Готово. Перенеси нужные блоки из config/codex.config.example.toml в $CodexHome\config.toml вручную."
Write-Host "Не коммить реальные токены и локальные файлы с секретами."

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
    throw "Skills source directory not found: $skillsSource"
}

New-Item -ItemType Directory -Force -Path $skillsTarget | Out-Null
Get-ChildItem -Directory $skillsSource | ForEach-Object {
    $target = Join-Path $skillsTarget $_.Name
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Copy-Item -LiteralPath (Join-Path $_.FullName "*") -Destination $target -Recurse -Force
    Write-Host "Installed skill: $($_.Name)"
}

$serverSource = Join-Path $repoRoot "mcp-servers\tracker-attachments\server.py"
if (Test-Path $serverSource) {
    New-Item -ItemType Directory -Force -Path $mcpTarget | Out-Null
    Copy-Item -LiteralPath $serverSource -Destination (Join-Path $mcpTarget "server.py") -Force
    Write-Host "Installed MCP server: tracker-attachments"
}

Write-Host ""
Write-Host "Done. Merge config/codex.config.example.toml into $CodexHome\config.toml manually."
Write-Host "Do not commit real tokens or local secret files."


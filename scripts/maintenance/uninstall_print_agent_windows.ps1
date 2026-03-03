param(
    [string]$WorkspacePath = ""
)

$ErrorActionPreference = 'SilentlyContinue'

if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
    $WorkspacePath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$TaskName = "CELUPRO-PrintAgent"
$RunnerCmd = Join-Path $WorkspacePath "scripts\maintenance\run_print_agent_windows.cmd"

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false

if (Test-Path $RunnerCmd) {
    Remove-Item $RunnerCmd -Force
}

Write-Host "Tarea eliminada: $TaskName"

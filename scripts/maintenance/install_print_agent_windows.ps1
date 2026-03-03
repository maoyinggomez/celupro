param(
    [string]$WorkspacePath = "",
    [string]$ApiUrl = "http://127.0.0.1:5001/api",
    [string]$Usuario = "admin",
    [string]$Password = "admin123",
    [string]$Printer = "",
    [string]$PythonExe = ""
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
    $WorkspacePath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$AgentScript = Join-Path $WorkspacePath "scripts\maintenance\print_agent.py"
$RunnerCmd = Join-Path $WorkspacePath "scripts\maintenance\run_print_agent_windows.cmd"
$TaskName = "CELUPRO-PrintAgent"

if ([string]::IsNullOrWhiteSpace($PythonExe)) {
    $venvPython = Join-Path $WorkspacePath ".venv\Scripts\python.exe"
    if (Test-Path $venvPython) {
        $PythonExe = $venvPython
    } else {
        $PythonExe = "python"
    }
}

if (-not (Test-Path $AgentScript)) {
    throw "No se encontró print_agent.py en $AgentScript"
}

$cmdContent = @"
@echo off
setlocal
""$PythonExe"" ""$AgentScript"" --base-url ""$ApiUrl"" --usuario ""$Usuario"" --password ""$Password"" --printer ""$Printer"" --interval 2
"@

Set-Content -Path $RunnerCmd -Value $cmdContent -Encoding ASCII

$action = New-ScheduledTaskAction -Execute $RunnerCmd
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Agente de impresión CELUPRO" -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host "Tarea instalada y activa: $TaskName"
Write-Host "Runner: $RunnerCmd"
Write-Host "Python: $PythonExe"
Write-Host "API: $ApiUrl"
Write-Host "Impresora: $Printer"

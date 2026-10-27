param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$PytestArgs
)

$ErrorActionPreference = "Stop"
$backend = Split-Path -Parent $PSScriptRoot
Push-Location $backend

try {
    & ".\.venv\Scripts\python.exe" -m scripts.reset_test_db --with-logs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    $env:DATABASE_URL = (& ".\.venv\Scripts\python.exe" -c "from app.config import settings; print(settings.test_database_url)").Trim()
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & ".\.venv\Scripts\python.exe" -m scripts.seed_history
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & ".\.venv\Scripts\python.exe" -m pytest @PytestArgs
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}

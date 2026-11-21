param(
    [string]$PgBinDir = "D:\Application\PostgreSQL\18\bin",
    [string]$DbHost = "localhost",
    [int]$DbPort = 5432,
    [string]$DbName = "smart_dormitory_db",
    [string]$DbUser = "postgres",
    [string]$DbPassword = "postgres123"
)

$ErrorActionPreference = "Stop"
$env:PGPASSWORD = $DbPassword
$SqlFiles = @(
    "01_schema.sql",
    "02_views.sql",
    "03_triggers.sql",
    "04_procedures.sql",
    "05_indexes.sql",
    "06_roles_security.sql"
)

foreach ($file in $SqlFiles) {
    $path = Join-Path $PSScriptRoot $file
    Write-Host ">>> Executing $file..." -ForegroundColor Cyan
    & "$PgBinDir\psql.exe" -h $DbHost -p $DbPort -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -f $path
}

Write-Host ">>> Seeding sample CTU data (07_seed_data.py)..." -ForegroundColor Cyan
$env:ADMIN_DATABASE_URL = "postgresql://${DbUser}:${DbPassword}@${DbHost}:${DbPort}/${DbName}"
python (Join-Path $PSScriptRoot "07_seed_data.py")

$UpgradeFiles = @(
    "10_nang_cap_phan_quyen_canh_cao_thanh_toan.sql",
    "11_lien_ket_ngan_hang_acid.sql",
    "12_don_sach_bang_cu_va_phan_quyen.sql",
    "06_roles_security.sql"
)

foreach ($file in $UpgradeFiles) {
    $path = Join-Path $PSScriptRoot $file
    Write-Host ">>> Executing $file..." -ForegroundColor Cyan
    & "$PgBinDir\psql.exe" -h $DbHost -p $DbPort -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -f $path
}

Write-Host ">>> Running DB test suite (08_test_db.sql)..." -ForegroundColor Cyan
& "$PgBinDir\psql.exe" -h $DbHost -p $DbPort -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot "08_test_db.sql")

Write-Host ">>> Database initialization & verification COMPLETE!" -ForegroundColor Green

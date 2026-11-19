<#
.SYNOPSIS
    Kịch bản Sao lưu (Backup) và Phục hồi (Restore) CSDL Hệ thống Quản lý KTX CTU (Mục 7.5)
.EXAMPLE
    .\backup_restore.ps1 -Action backup
    .\backup_restore.ps1 -Action restore -BackupFile ".\backups\smart_dormitory_db_20261119_180000.dump"
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("backup", "restore")]
    [string]$Action,

    [string]$PgBinDir = "D:\Application\PostgreSQL\18\bin",
    [string]$DbHost = "localhost",
    [int]$DbPort = 5432,
    [string]$DbName = "smart_dormitory_db",
    [string]$DbUser = "postgres",
    [string]$DbPassword = "postgres123",
    [string]$BackupFile = ""
)

$ErrorActionPreference = "Stop"
$env:PGPASSWORD = $DbPassword
$BackupDir = Join-Path $PSScriptRoot "backups"

if ($Action -eq "backup") {
    if (-not (Test-Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir | Out-Null
    }
    $Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $DumpPath = Join-Path $BackupDir "${DbName}_${Timestamp}.dump"
    $SqlPath = Join-Path $BackupDir "${DbName}_${Timestamp}.sql"

    Write-Host "Dang sao luu CSDL '$DbName'..." -ForegroundColor Cyan
    & "$PgBinDir\pg_dump.exe" -h $DbHost -p $DbPort -U $DbUser -F c -b -v -f $DumpPath $DbName
    & "$PgBinDir\pg_dump.exe" -h $DbHost -p $DbPort -U $DbUser -F p --no-owner -f $SqlPath $DbName

    Write-Host "Sao luu thanh cong!" -ForegroundColor Green
    Write-Host "  - Custom dump : $DumpPath"
    Write-Host "  - Plain SQL   : $SqlPath"
}
elseif ($Action -eq "restore") {
    if (-not $BackupFile -or -not (Test-Path $BackupFile)) {
        throw "Khong tim thay file backup: $BackupFile"
    }

    Write-Host "Dang phuc hoi CSDL '$DbName' tu '$BackupFile'..." -ForegroundColor Yellow
    if ($BackupFile.EndsWith(".sql")) {
        & "$PgBinDir\psql.exe" -h $DbHost -p $DbPort -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -f $BackupFile
    } else {
        & "$PgBinDir\pg_restore.exe" -h $DbHost -p $DbPort -U $DbUser -d $DbName --clean --if-exists --no-owner -v $BackupFile
    }
    Write-Host "Phuc hoi CSDL thanh cong!" -ForegroundColor Green
}

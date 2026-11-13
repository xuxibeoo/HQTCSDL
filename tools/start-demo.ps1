[CmdletBinding()]
param(
    [ValidateSet('Start', 'Stop', 'Check')]
    [string]$Action = 'Start',
    [switch]$NoBrowser,
    [switch]$SkipBuild
)

# Windows PowerShell 5.1 compatible. No Node.js or Python installation is required.
# This launcher NEVER resets the schema or removes a Docker volume.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$composePath = Join-Path $projectRoot 'compose.yaml'
$runtimePath = Join-Path $projectRoot '.runtime'
$startedAt = Get-Date

function Say([string]$Message) { Write-Host $Message -ForegroundColor Cyan }
function Test-DockerReady {
    $savedPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & docker info --format '{{.ServerVersion}}' *> $null
        return $LASTEXITCODE -eq 0
    } finally { $ErrorActionPreference = $savedPreference }
}
function Ensure-Docker {
    if (Test-DockerReady) { return }
    $desktopPath = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    if (!(Test-Path -LiteralPath $desktopPath)) {
        throw 'Chua co Docker Desktop. Cai Docker Desktop va bat WSL 2 truoc khi chay do an.'
    }
    Say 'Dang mo Docker Desktop. Vui long cho khoang 1-3 phut...'
    Start-Process -FilePath $desktopPath -WindowStyle Hidden
    $deadline = (Get-Date).AddMinutes(3)
    do {
        Start-Sleep -Seconds 3
        if (Test-DockerReady) { return }
    } while ((Get-Date) -lt $deadline)
    throw 'Docker chua san sang. Mo Docker Desktop, cho Engine running roi bam KHOI_DONG.bat lai.'
}

try {
    Set-Location -LiteralPath $projectRoot
    Write-Host ''
    Write-Host '  HQTCSDL - GALAXY HUFLIT' -ForegroundColor White
    Write-Host '  Ban hoc tap / Oracle Database 23ai / Du lieu demo' -ForegroundColor DarkGray
    Write-Host ''
    if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
        $dockerBin = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin'
        if (Test-Path -LiteralPath (Join-Path $dockerBin 'docker.exe')) { $env:PATH = $dockerBin + ';' + $env:PATH }
        else { throw 'Khong tim thay Docker Desktop. Can cai Docker Desktop truoc.' }
    }
    $composeArgs = @('compose', '--project-directory', $projectRoot, '-f', $composePath)
    if ($Action -eq 'Stop') {
        if (!(Test-DockerReady)) { Say 'Docker da tat. Khong co gi can dung.'; exit 0 }
        New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
        Say 'Dang dung Web va Oracle; du lieu se duoc giu lai...'
        $dockerExe = (Get-Command docker).Source
        $stopLine = (($composeArgs + @('stop')) | ForEach-Object { '"' + $_ + '"' }) -join ' '
        $stopProcess = Start-Process -FilePath $dockerExe -ArgumentList $stopLine -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput (Join-Path $runtimePath 'stop.log') -RedirectStandardError (Join-Path $runtimePath 'stop-errors.log')
        if ($stopProcess.ExitCode -ne 0) { throw 'Khong dung duoc container. Khong xoa volume hoac du lieu.' }
        Say 'Da dung ung dung. Ve, tai khoan va du lieu Oracle van duoc giu.'
        exit 0
    }

    Say '[1/4] Kiem tra thu muc do an va Docker...'
    foreach ($relative in @('Dockerfile', 'compose.yaml', 'sql/install.sql', 'sql/01_schema.sql', 'frontend/package-lock.json', 'backend/main.py', 'database/bootstrap/health.sh')) {
        if (!(Test-Path -LiteralPath (Join-Path $projectRoot $relative))) { throw ('Thieu file: ' + $relative + '. Hay giai nen day du thu muc do an.') }
    }
    Ensure-Docker
    & docker compose version *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Can Docker Compose v2. Hay cap nhat Docker Desktop.' }
    # Let Compose interpret .env quoting, comments, interpolation and overrides.
    # Keep the full resolved configuration in memory only; it includes passwords.
    $configText = & docker @composeArgs config --format json
    if ($LASTEXITCODE -ne 0) { throw 'compose.yaml hoac .env chua hop le. Khong thay doi mat khau cua volume da khoi tao.' }
    $resolved = ($configText -join [Environment]::NewLine) | ConvertFrom-Json
    if ($Action -eq 'Check') { Say 'Kiem tra cau hinh DAT. Chua tao/xoa/reset co so du lieu.'; exit 0 }

    New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
    $webPort = [string]($resolved.services.web.ports | Where-Object { $_.target -eq 8080 } | Select-Object -First 1).published
    $oraclePort = [string]($resolved.services.oracle.ports | Where-Object { $_.target -eq 1521 } | Select-Object -First 1).published
    if ($webPort -notmatch '^\d+$' -or [int]$webPort -lt 1 -or [int]$webPort -gt 65535) { throw 'WEB_PORT phai la cong tu 1 den 65535.' }
    if ($oraclePort -notmatch '^\d+$' -or [int]$oraclePort -lt 1 -or [int]$oraclePort -gt 65535) { throw 'ORACLE_PORT phai la cong tu 1 den 65535.' }
    $webUrl = 'http://127.0.0.1:' + $webPort
    $logPath = Join-Path $runtimePath 'startup.log'
    $errorPath = Join-Path $runtimePath 'startup-errors.log'
    Say '[2/4] Chuan bi Web, API va Oracle...'
    Write-Host 'Lan dau can Internet de tai image va thu vien; co the mat 5-15 phut.'
    Write-Host 'Cac lan sau tai su dung du lieu va bo nho dem. Khong can cai Node.js/Python.'
    $upArgs = $composeArgs + @('up', '-d')
    if (!$SkipBuild) { $upArgs += '--build' }
    # Start-Process avoids treating Docker's normal progress on stderr as a
    # terminating NativeCommandError in Windows PowerShell 5.1.
    $dockerExe = (Get-Command docker).Source
    $argumentLine = ($upArgs | ForEach-Object { '"' + $_ + '"' }) -join ' '
    $dockerProcess = Start-Process -FilePath $dockerExe -ArgumentList $argumentLine -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput $logPath -RedirectStandardError $errorPath
    if ($dockerProcess.ExitCode -ne 0) {
        Write-Host ''
        Get-Content -LiteralPath $errorPath -Tail 12 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ -ForegroundColor DarkYellow }
        throw "Docker chua khoi dong duoc. Xem .runtime/startup-errors.log. Neu cong $webPort hoac $oraclePort bi trung, dung ung dung dang chiem cong hoac doi WEB_PORT/ORACLE_PORT trong .env; khong can xoa du lieu."
    }

    Say '[3/4] Cho Oracle 23ai va API san sang...'
    $deadline = (Get-Date).AddMinutes(15)
    $health = $null
    $poll = 0
    do {
        try {
            $candidate = Invoke-RestMethod -Uri ($webUrl + '/api/health') -TimeoutSec 6
            if ($candidate.engine -eq 'ORACLE_23AI_LIVE' -and $candidate.oracle -match '^23\.' -and $candidate.schema -eq 'CINEMA') { $health = $candidate; break }
        } catch { }
        if ($poll % 6 -eq 0) { Write-Host '  Oracle dang nap du lieu. Khong dong cua so nay...' -ForegroundColor DarkGray }
        $poll += 1
        Start-Sleep -Seconds 5
    } while ((Get-Date) -lt $deadline)
    if (!$health) { throw 'Chua ket noi duoc Oracle sau 15 phut. Xem docker compose logs --tail 80 oracle web. Du lieu van con; khong dung down -v.' }

    Say '[4/4] San sang de demo!'
    $demoUrl = $webUrl + '/?demo=1'
    $state = @{
        readyAt = (Get-Date).ToString('o'); web = $webUrl; demo = $demoUrl
        oracle = $health.oracle; schema = $health.schema; demoEnabled = $health.demo
        startupSeconds = [math]::Round(((Get-Date) - $startedAt).TotalSeconds)
    }
    $state | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimePath 'last-start.json') -Encoding UTF8
    Write-Host ('  Ung dung: ' + $demoUrl) -ForegroundColor White
    Write-Host ('  Swagger:  ' + $webUrl + '/docs')
    Write-Host ('  Oracle:   ' + $health.oracle + ' / ' + $health.schema)
    Write-Host ''
    Write-Host 'Bam Huong dan demo tren giao dien de theo kich ban 8-10 phut.'
    Write-Host 'Kich ban va tieu chi mon hoc: docs/KICH_BAN_BAO_CAO.md, docs/DOI_CHIEU_TIEU_CHI.md.'
    Write-Host 'Tat bang DUNG_UNG_DUNG.bat. Dung ung dung khong xoa du lieu.'
    if (!$health.demo) { Write-Host 'Luu y: CINEMA_DEMO dang tat; bo chuyen vai tro va huong dan demo co the khong kha dung.' -ForegroundColor Yellow }
    if (!$NoBrowser) { Start-Process $demoUrl }
    exit 0
} catch {
    Write-Host ''
    Write-Host ('LOI: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Thu muc hien tai: ' $projectRoot
    Write-Host 'Khong co lenh reset schema, xoa bang hoac xoa volume nao duoc launcher thuc hien.'
    exit 1
}

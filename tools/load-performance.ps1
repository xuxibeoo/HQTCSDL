[CmdletBinding()]
param([switch]$CheckOnly, [switch]$ConfirmLoad)

# Optional academic benchmark data. Never called by the normal startup launcher.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
try {
    Set-Location -LiteralPath $projectRoot
    Write-Host 'HQTCSDL - DU LIEU HIEU NANG (TUY CHON)' -ForegroundColor Cyan
    Write-Host 'Them 300.000 don va 400.000 ve lich su de do execution plan.'
    Write-Host 'Khong reset bang, khong xoa du lieu, khong can nap lai neu da co marker.'
    if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
        $dockerBin = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin'
        if (Test-Path -LiteralPath (Join-Path $dockerBin 'docker.exe')) { $env:PATH = $dockerBin + ';' + $env:PATH }
        else { throw 'Can Docker Desktop. Hay chay KHOI_DONG.bat truoc.' }
    }
    $composeArgs = @('compose', '--project-directory', $projectRoot, '-f', (Join-Path $projectRoot 'compose.yaml'))
    $state = & docker @composeArgs exec -T oracle bash /cinema-db/bootstrap/load-performance.sh --check-only
    if ($LASTEXITCODE -ne 0) { throw 'Oracle chua san sang. Hay chay KHOI_DONG.bat truoc.' }
    $state | ForEach-Object { Write-Host $_ }
    if (($state -join ' ') -match 'PERF_LOADED=1') {
        Write-Host 'Da co du lieu hieu nang. Khong nap trung, khong thay doi du lieu.' -ForegroundColor Green
        exit 0
    }
    if ($CheckOnly) { Write-Host 'Chi kiem tra; chua nap du lieu.'; exit 0 }
    Write-Host 'Can them dung luong Oracle va vai phut xu ly. Khong tat Docker khi dang nap.' -ForegroundColor Yellow
    if (!$ConfirmLoad -and (Read-Host 'Nhap NAP de xac nhan, hoac Enter de huy') -cne 'NAP') {
        Write-Host 'Da huy; khong co du lieu nao duoc them.'
        exit 0
    }
    & docker @composeArgs exec -T oracle bash /cinema-db/bootstrap/load-performance.sh --load-confirmed
    if ($LASTEXITCODE -ne 0) { throw 'Nap chua thanh cong. Khong reset database; xem loi Oracle ben tren.' }
    & docker @composeArgs exec -T oracle bash /cinema-db/bootstrap/load-performance.sh --check-only
    if ($LASTEXITCODE -ne 0) { throw 'Chua xac nhan duoc ket qua sau khi nap.' }
    Write-Host 'Hoan tat. Mo vai tro IT de so sanh hai execution plan.' -ForegroundColor Green
    exit 0
} catch {
    Write-Host ('LOI: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Khong co lenh xoa volume hay cai lai schema duoc thuc hien.'
    exit 1
}

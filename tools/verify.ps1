param([string]$Base = 'http://127.0.0.1:8080')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

function Call-Cinema([string]$Route, [string]$Method = 'Get', [string]$Token = '', $Body = $null) {
    $argsForApi = @{ Uri = "$Base/api$Route"; Method = $Method; TimeoutSec = 55 }
    if ($Token) { $argsForApi.Headers = @{ Authorization = "Bearer $Token" } }
    if ($null -ne $Body) { $argsForApi.Body = $Body | ConvertTo-Json -Compress; $argsForApi.ContentType = 'application/json; charset=utf-8' }
    $response = Invoke-WebRequest @argsForApi -UseBasicParsing
    $content = [System.Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray())
    ConvertFrom-Json -InputObject $content
}

function Assert-Cinema($Value, [string]$Message) {
    if (-not $Value) { throw $Message }
}

$health = Call-Cinema '/health'
Assert-Cinema ($health.oracle -like '23.*') 'Expected Oracle 23ai'
$catalog = Call-Cinema '/catalog'
Assert-Cinema ($catalog.rap.Count -eq 3 -and $catalog.phim.Count -ge 20) 'Catalog seed missing'
$customerToken = (Call-Cinema '/auth/demo/CUSTOMER' 'Post').token
try {
    $null = Call-Cinema '/admin/ky-thuat' 'Get' $customerToken
    throw 'Customer unexpectedly accessed IT data'
} catch {
    if ($null -eq $_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 403) { throw }
}
$staffReadRoutes = @{
    EXECUTIVE = '/admin/analytics'
    PROGRAMMING = '/admin/phong'
    CINEMA_MANAGER = '/admin/nhat-ky'
    CASHIER = '/admin/khach-hang'
    CUSTOMER_SUPPORT = '/admin/khach-hang'
    MARKETING = '/admin/voucher'
    ACCOUNTING = '/admin/doi-soat'
    IT_ADMIN = '/admin/ky-thuat'
}
foreach ($entry in $staffReadRoutes.GetEnumerator()) {
    $staffToken = (Call-Cinema "/auth/demo/$($entry.Key)" 'Post').token
    $null = Call-Cinema $entry.Value 'Get' $staffToken
}
$it = (Call-Cinema '/auth/demo/IT_ADMIN' 'Post').token
$testResults = @(
    foreach ($n in 1..9) {
        $r = Call-Cinema "/admin/tests/$n" 'Post' $it
        Write-Host "$($r.test) $($r.passed) $($r.log)"
        $r
    }
)
Assert-Cinema (-not ($testResults | Where-Object { -not $_.passed })) 'PL/SQL test failed'
$plans = Call-Cinema '/admin/benchmark' 'Get' $it
foreach ($key in 'A','B') {
    $plan = $plans.$key
    Assert-Cinema ($plan.result_match) "Benchmark $key result mismatch"
    Assert-Cinema ($plan.plans[0].plan -match 'TABLE ACCESS FULL') "No full scan for $key"
    Assert-Cinema ($plan.plans[1].plan -match 'INDEX RANGE SCAN') "No index range scan for $key"
    Write-Host "Plan ${key}: $($plan.plans[0].buffer_gets) -> $($plan.plans[1].buffer_gets) buffers"
}
Assert-Cinema ((Invoke-WebRequest "$Base/" -UseBasicParsing).StatusCode -eq 200) 'Web not served'
Write-Host 'Oracle, API, front-end entry and both plans verified.'

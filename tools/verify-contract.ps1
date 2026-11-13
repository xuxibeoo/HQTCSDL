param([string]$Base = 'http://127.0.0.1:8080')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

function Request-Cinema($Path, $Method='Get', $Token='', $Body=$null) {
    $args = @{ Uri = "$Base/api$Path"; Method = $Method; UseBasicParsing = $true; TimeoutSec = 70 }
    if ((Get-Command Invoke-WebRequest).Parameters.ContainsKey('SkipHttpErrorCheck')) { $args.SkipHttpErrorCheck = $true }
    if ($Token) { $args.Headers = @{ Authorization = "Bearer $Token" } }
    if ($null -ne $Body) { $args.Body = $Body | ConvertTo-Json -Depth 8 -Compress; $args.ContentType='application/json; charset=utf-8' }
    try {
        $res = Invoke-WebRequest @args
        $code = [int]$res.StatusCode; $content = [System.Text.Encoding]::UTF8.GetString($res.RawContentStream.ToArray()); $headers = $res.Headers
    } catch {
        $reply = $_.Exception.Response
        if ($null -eq $reply) { throw }
        # Windows PowerShell 5.1 throws on expected 4xx responses.
        $code = [int]$reply.StatusCode; $headers = $reply.Headers
        $content = $_.ErrorDetails.Message
        if (-not $content) {
            $reader = New-Object System.IO.StreamReader($reply.GetResponseStream(), [System.Text.Encoding]::UTF8)
            try { $content = $reader.ReadToEnd() } finally { $reader.Dispose() }
        }
    }
    $json = if ($content) { ConvertFrom-Json -InputObject $content }
    [pscustomobject]@{ Code = $code; Data = $json; Headers = $headers; Path = $Path }
}
function Need($Test, [string]$Why) { if (-not $Test) { throw $Why } }
function OK($Reply) {
    Need ($Reply.Code -in @(200,201)) "$($Reply.Path): HTTP $($Reply.Code) $($Reply.Data | ConvertTo-Json -Depth 5 -Compress)"
    return ,$Reply.Data
}
function DemoToken($Role) { (OK (Request-Cinema "/auth/demo/$Role" 'Post')).token }
function Need-Ora($Reply, [int]$Http, [int]$Oracle) {
    $signed = if ($null -ne $Reply.Data.ora_code) { $Reply.Data.ora_code } else { $Reply.Data.detail.ora_code }
    Need ($Reply.Code -eq $Http -and $signed -eq $Oracle) "Expected HTTP $Http / ORA $Oracle for $($Reply.Path): actual HTTP $($Reply.Code), $($Reply.Data | ConvertTo-Json -Depth 5 -Compress)"
}

$health = OK (Request-Cinema '/health')
Need ($health.oracle -like '23.*') 'The API must be connected to Oracle 23ai, not a mock.'
$customers = OK (Request-Cinema '/khach-hang')
Need ($customers.Count -ge 3) 'At least three seeded demo customers are required.'
Need (@($customers.hang_thanh_vien | Sort-Object -Unique).Count -ge 3) 'Expected demo member tiers THUONG, BAC and VANG.'
$a = DemoToken 'CUSTOMER_1'
$b = DemoToken 'CUSTOMER_2'
$it = DemoToken 'IT_ADMIN'
foreach ($route in '/phim','/rap','/combo','/khuyen-mai') { $null = OK (Request-Cinema $route) }
$shows = OK (Request-Cinema '/suat-chieu')
$candidate = $null
$seat = $null
foreach ($s in $shows | Where-Object { [DateTimeOffset]::Parse($PSItem.gio_bat_dau) -gt [DateTimeOffset]::Now.AddHours(3) } | Select-Object -First 20) {
    $seats = OK (Request-Cinema "/suat-chieu/$($s.ma_suat)/ghe")
    Need ($seats.Count -eq 100) "Show $($s.ma_suat) must contain exactly 100 seats."
    $seat = $seats | Where-Object { $_.trang_thai -eq 'TRONG' -and $_.ten_loai -eq 'COUPLE' } | Select-Object -First 1
    if ($null -ne $seat) { $candidate = $s; break }
}
Need ($null -ne $candidate) 'No future show with an available COUPLE seat.'
$key = @{ ma_suat = $candidate.ma_suat; ds_ghe = @($seat.ma_ghe) }
$quote = OK (Request-Cinema '/tinh-tien-tam' 'Post' $a $key)
Need ($quote.thuc_tra -gt 0) 'Preview price must be returned by Oracle.'
$holdReply = Request-Cinema '/don-dat-ve' 'Post' $a $key
$hold = OK $holdReply
Need ($hold.ma_don -gt 0 -and $hold.han_thanh_toan -and $hold.thuc_tra -eq $quote.thuc_tra) 'Hold must match quote and include an expiration.'
Need ($holdReply.Headers['X-Cinema-Oracle-Object'] -and $holdReply.Headers['X-Cinema-Elapsed-Ms']) 'Live transaction inspector headers not returned.'
Need-Ora (Request-Cinema '/don-dat-ve' 'Post' $b $key) 409 -20021

$paymentBody = @{ phuong_thuc='THE'; ma_gd_ngoai='VERIFY-'+[Guid]::NewGuid().ToString('N') }
$paid = OK (Request-Cinema "/don-dat-ve/$($hold.ma_don)/thanh-toan" 'Post' $a $paymentBody)
$issuedTickets = if ($null -ne $paid.tickets) { $paid.tickets } else { $paid.ve }
$ticket = @($issuedTickets)[0]
Need ($ticket.ma_qr -and $ticket.ma_ve) 'Payment must issue a QR ticket.'
$refund = OK (Request-Cinema "/ve/$($ticket.ma_ve)/huy" 'Post' $a @{})
Need ($refund.so_tien_hoan -eq $quote.thuc_tra) 'A full refund on a single undiscounted ticket must match the amount paid.'

$secondHold = OK (Request-Cinema '/don-dat-ve' 'Post' $b $key)
Need-Ora (Request-Cinema "/don-dat-ve/$($secondHold.ma_don)/thanh-toan" 'Post' $b $paymentBody) 409 -20027
$null = OK (Request-Cinema "/lab/gia-lap-het-han/$($secondHold.ma_don)" 'Post' $it)
$newPayment = @{ phuong_thuc='THE'; ma_gd_ngoai='VERIFY-'+[Guid]::NewGuid().ToString('N') }
Need-Ora (Request-Cinema "/don-dat-ve/$($secondHold.ma_don)/thanh-toan" 'Post' $b $newPayment) 410 -20023
$null = OK (Request-Cinema '/lab/giai-phong-ghe-het-han' 'Post' $it)
$free = OK (Request-Cinema "/suat-chieu/$($candidate.ma_suat)/ghe")
Need (($free | Where-Object ma_ghe -eq $seat.ma_ghe).trang_thai -eq 'TRONG') 'The expired hold must release its seat.'

foreach ($route in '/bao-cao/top-phim-thang','/bao-cao/xu-huong-thang','/bao-cao/doanh-thu-30-ngay','/bao-cao/ty-le-lap-day') {
    $result = OK (Request-Cinema $route 'Get' $it)
    if ($route -eq '/bao-cao/xu-huong-thang') { Need ($result.Count -eq 12) 'Monthly report must contain 12 calendar months.' }
    if ($route -eq '/bao-cao/doanh-thu-30-ngay') { Need ($result.Count -eq 30) 'Daily report must contain 30 calendar dates.' }
}
Need-Ora (Request-Cinema '/lab/them-suat-chieu' 'Post' $it @{scenario='overlap'}) 409 -20031
Need-Ora (Request-Cinema '/lab/them-suat-chieu' 'Post' $it @{scenario='gap10'}) 409 -20031
$null = OK (Request-Cinema '/lab/them-suat-chieu' 'Post' $it @{scenario='gap20'})
$null = OK (Request-Cinema '/lab/nhat-ky-ve' 'Get' $it)
$plan = OK (Request-Cinema '/lab/execution-plan' 'Get' $it)
Need ($plan.A.result_match -and $plan.B.result_match) 'Both execution-plan comparisons must return identical query results.'
Write-Host 'Canonical API verified: Oracle version, demo tiers, seat quote, hold, seat conflict, payment, refund, duplicate payment, expiration/release, reports, trigger, audit and plans.'

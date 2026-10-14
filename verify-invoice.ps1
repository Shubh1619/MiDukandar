$ErrorActionPreference = "Stop"
$base = "http://localhost:4000/api"

# 1. OTP login (master OTP path)
$otp = $null
for ($i = 0; $i -lt 4; $i++) {
  try {
    $r = Invoke-RestMethod -Method Post -Uri "$base/auth/request-otp" -ContentType "application/json" -Body (@{ mobile = "1111111111" } | ConvertTo-Json)
    $otp = if ($r.devOtp) { $r.devOtp } else { "000000" }
    break
  } catch {
    if (($_.ErrorDetails.Message) -match "RATE_LIMITED") { Start-Sleep -Seconds 8 } else { throw }
  }
}
if (-not $otp) { throw "no otp" }
Write-Output ("otp=" + $otp)
Start-Sleep -Milliseconds 400
$v = Invoke-RestMethod -Method Post -Uri "$base/auth/verify-otp" -ContentType "application/json" -Body (@{ mobile = "1111111111"; otp = $otp; name = "Shubham"; storeName = "MiDukandar Test" } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer " + $v.token }

# 2. UNPAID filter + mobile search
Write-Output "=== UNPAID (udhaar) sales, search by mobile suffix 98 ==="
$list = Invoke-RestMethod -Method Get -Uri "$base/sales?payment=UNPAID&search=98" -Headers $headers
$list.sales | ForEach-Object {
  "{0} | {1} | {2} | {3} | paid={4} due={5} expected={6}" -f $_.invoiceNumber, $_.customerName, $_.customerMobile, $_.paymentMode, $_.paidAmount, $_.dueAmount, $_.dueDate
}
Write-Output ("summary: totalInvoices={0} revenue={1} pendingUdhaar={2} overdue={3}" -f $list.summary.totalInvoices, $list.summary.totalRevenue, $list.summary.pendingUdhaar, $list.summary.overdueCount)

if (-not $list.sales) { Write-Output "NO udhaar sales found to check PDF expected-date watermark" }

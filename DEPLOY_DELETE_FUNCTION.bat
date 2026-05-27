@echo off
echo ================================================
echo  Deploy drive-delete-folder Edge Function
echo ================================================
cd /d "G:\Claude\hotel-checkin-system"

echo.
echo ต้องการ Supabase Personal Access Token
echo ไปที่: https://supabase.com/dashboard/account/tokens
echo สร้าง token แล้ว paste ที่นี่:
echo.
set /p PAT=PAT Token:

if "%PAT%"=="" (
    echo ERROR: ไม่ได้ใส่ token
    pause
    exit /b 1
)

echo.
echo กำลัง deploy...

powershell -Command ^
  "$code = Get-Content 'supabase\functions\drive-delete-folder\index.ts' -Raw -Encoding UTF8;" ^
  "$body = @{ slug='drive-delete-folder'; name='drive-delete-folder'; verify_jwt=$true; body=$code } | ConvertTo-Json -Depth 5;" ^
  "$headers = @{ 'Authorization'='Bearer %PAT%'; 'Content-Type'='application/json' };" ^
  "try {" ^
  "  $r = Invoke-RestMethod -Uri 'https://api.supabase.com/v1/projects/cfadkibqdgmvhjoqhxmd/functions/drive-delete-folder' -Method PATCH -Headers $headers -Body $body -ErrorAction Stop;" ^
  "  Write-Host 'SUCCESS: Function updated' -ForegroundColor Green" ^
  "} catch {" ^
  "  try {" ^
  "    $r2 = Invoke-RestMethod -Uri 'https://api.supabase.com/v1/projects/cfadkibqdgmvhjoqhxmd/functions' -Method POST -Headers $headers -Body $body -ErrorAction Stop;" ^
  "    Write-Host 'SUCCESS: Function created' -ForegroundColor Green" ^
  "  } catch { Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red }" ^
  "}"

echo.
echo ================================================
pause

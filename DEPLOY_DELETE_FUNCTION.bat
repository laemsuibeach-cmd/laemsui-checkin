@echo off
echo ================================================
echo  Deploy drive-delete-folder Edge Function
echo ================================================
cd /d "G:\Claude\hotel-checkin-system"

supabase functions deploy drive-delete-folder --project-ref YOUR_PROJECT_REF

echo.
if %ERRORLEVEL% == 0 (
    echo  SUCCESS! Edge Function deployed
) else (
    echo  ERROR - ตรวจสอบว่าติดตั้ง Supabase CLI แล้ว
    echo  หรือ deploy ผ่าน Supabase Dashboard ก็ได้
)
echo ================================================
pause

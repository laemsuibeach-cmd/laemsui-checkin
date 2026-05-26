@echo off
echo ================================================
echo  Revert to Google Drive Only flow (ab0ec6a)
echo ================================================
cd /d "G:\Claude\hotel-checkin-system"

if exist ".git\HEAD.lock"  del /f ".git\HEAD.lock"
if exist ".git\index.lock" del /f ".git\index.lock"

set /p TOKEN=<.token
if "%TOKEN%"=="" (
    echo ERROR: ไม่พบไฟล์ .token
    pause
    exit /b 1
)

git reset --hard ab0ec6a
echo.
echo Reset to ab0ec6a done. Pushing...
git push https://laemsuibeach-cmd:%TOKEN%@github.com/laemsuibeach-cmd/laemsui-checkin.git main --force

echo.
if %ERRORLEVEL% == 0 (
    echo  SUCCESS! Reverted to Google Drive only flow
    echo  URL: https://laemsui-checkin.vercel.app
) else (
    echo  ERROR - see message above
)
echo ================================================
pause

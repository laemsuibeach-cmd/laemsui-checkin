@echo off
echo ================================================
echo  Push to GitHub (push only, no commit)
echo ================================================
cd /d "G:\Claude\hotel-checkin-system"

set /p TOKEN=<.token

git push https://laemsuibeach-cmd:%TOKEN%@github.com/laemsuibeach-cmd/laemsui-checkin.git main --force

echo.
if %ERRORLEVEL% == 0 (
    echo  SUCCESS! Vercel will deploy automatically
    echo  URL: https://laemsui-checkin.vercel.app
) else (
    echo  ERROR - see message above
)
echo ================================================
pause

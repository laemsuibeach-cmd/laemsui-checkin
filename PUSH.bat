@echo off
echo ================================================
echo  Pushing to GitHub...
echo ================================================
cd /d "G:\Claude\hotel-checkin-system"

set /p TOKEN=<.token
if "%TOKEN%"=="" (
    echo ERROR: ไม่พบไฟล์ .token
    pause
    exit /b 1
)

if exist ".git\index.lock" del /f ".git\index.lock"
git add -A
git diff --staged --quiet && (echo Nothing to commit) || git commit -m "feat: show activities PDF after check-in complete"

git push https://laemsuibeach-cmd:%TOKEN%@github.com/laemsuibeach-cmd/laemsui-checkin.git main --force

echo.
if %ERRORLEVEL% == 0 (
    echo  SUCCESS! Vercel will deploy automatically
    echo  URL: https://laemsui-checkin.vercel.app
) else (
    echo  ERROR - see message above
)
echo ================================================
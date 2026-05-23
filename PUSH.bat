@echo off
echo ================================================
echo  Pushing to GitHub...
echo ================================================
cd /d "G:\Claude\hotel-checkin-system"

git rm -r --cached .github/ 2>nul
git add .gitignore
git add -A
git commit -m "Deploy Laemsui Resort checkin system" 2>nul || echo (nothing new to commit, continuing...)

git push https://laemsuibeach-cmd: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@github.com/laemsuibeach-cmd/laemsui-checkin.git main --force

echo.
if %ERRORLEVEL% == 0 (
    echo  SUCCESS! Code is on GitHub!
    echo  Vercel will deploy automatically
) else (
    echo  ERROR - see message above
)
echo ================================================
pause

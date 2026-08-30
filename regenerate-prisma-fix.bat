@echo off
echo ========================================
echo   Regenerating Prisma Client
echo ========================================
echo.
echo IMPORTANT: Make sure dev server is stopped!
echo Press Ctrl+C in the server terminal first.
echo.
pause
echo.
echo Regenerating Prisma Client...
call npx prisma generate
echo.
if %errorlevel% equ 0 (
    echo ========================================
    echo   SUCCESS! Prisma Client regenerated
    echo ========================================
    echo.
    echo Now you can start the dev server:
    echo   npm run dev
    echo.
) else (
    echo ========================================
    echo   ERROR! Please try:
    echo ========================================
    echo   1. Close all Node.js processes
    echo   2. Run this batch file again
    echo.
)
pause





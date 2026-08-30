@echo off
echo Stopping any running Prisma processes...
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak >nul

echo Deleting old Prisma client...
if exist "node_modules\.prisma" (
    rmdir /s /q "node_modules\.prisma"
)

echo Regenerating Prisma client...
call npx prisma generate

echo Done! You can now restart your dev server with: npm run dev
pause


@echo off
echo ============================================================
echo Verifying Payment Columns in Sales Table
echo ============================================================
echo.
echo This will check if cash_payment, bank_payment, and bank_title
echo columns exist in the sales table.
echo.
echo Press any key to run the verification...
pause > nul

npx prisma db execute --stdin < verify-columns.sql

echo.
echo ============================================================
echo Verification Complete!
echo ============================================================
echo.
echo If columns don't exist, run: ADD_PAYMENT_COLUMNS_TO_SALES.sql
echo.
pause




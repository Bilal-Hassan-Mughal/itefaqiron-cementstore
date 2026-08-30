@echo off
title Launching Ittefaq Iron Store POS Desktop App...
cd /d "%~dp0"
echo ========================================================
echo   Launching Ittefaq POS Native Desktop Application (.NET 9)
echo ========================================================
start "" "%~dp0IttefaqPOS\publish\IttefaqPOS.exe"
exit

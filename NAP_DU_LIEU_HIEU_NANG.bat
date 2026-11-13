@echo off
setlocal
cd /d "%~dp0"
title HQTCSDL - Nap du lieu hieu nang
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\load-performance.ps1" %*
set "result=%errorlevel%"
echo.
pause
exit /b %result%

@echo off
setlocal
cd /d "%~dp0"
title HQTCSDL - Dung ung dung
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start-demo.ps1" -Action Stop
if errorlevel 1 pause
exit /b %errorlevel%

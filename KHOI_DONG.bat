@echo off
setlocal
cd /d "%~dp0"
title HQTCSDL - Galaxy HUFLIT
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start-demo.ps1" %*
if errorlevel 1 (
  echo.
  echo Khong khoi dong duoc. Doc thong bao ben tren va thu lai.
  pause
  exit /b 1
)
exit /b 0

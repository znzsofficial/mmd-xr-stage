@echo off
setlocal
if "%~1"=="" (
  echo Drop one .blend file on this launcher to create a stage ZIP beside it.
  pause
  exit /b 2
)
powershell.exe -NoProfile -File "%~dp0convert-blend.ps1" -Model "%~f1"
set result=%errorlevel%
if not "%result%"=="0" pause
exit /b %result%

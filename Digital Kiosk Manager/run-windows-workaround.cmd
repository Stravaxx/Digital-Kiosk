@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0..\scripts\flutter-windows-workaround.ps1" -Mode run
exit /b %ERRORLEVEL%
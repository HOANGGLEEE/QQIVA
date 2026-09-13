@echo off
setlocal
cd /d "%~dp0"
echo [1/6] Cleaning partial install...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json

echo [2/6] Verifying npm cache...
call npm cache verify || goto :fail

echo [3/6] Installing dependencies...
call npm install || goto :fail

echo [4/6] Checking Expo dependency compatibility...
call npx expo install --check || goto :fail

echo [5/6] TypeScript check...
call npx tsc --noEmit || goto :fail

echo [6/6] Expo Doctor...
call npx expo-doctor || goto :fail

echo.
echo ALL CHECKS COMPLETED.
pause
exit /b 0
:fail
echo.
echo A COMMAND FAILED. Copy the error output and send it back for fixing.
pause
exit /b 1

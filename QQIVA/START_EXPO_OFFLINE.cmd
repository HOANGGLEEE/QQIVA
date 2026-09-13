@echo off
cd /d %~dp0
echo ==========================================
echo   QQIVA OFFLINE - REACT NATIVE + EXPO
echo ==========================================
echo.
echo Khong can chay Flask. Khong can file .env.
echo.
call npx expo start -c
pause

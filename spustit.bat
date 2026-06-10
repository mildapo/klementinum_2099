@echo off
chcp 65001 > nul
cd /d "%~dp0"
title Klementinum 2099 - Labyrint poznání
echo ======================================================
echo    Spouštění hry Klementinum 2099 - Labyrint poznání
echo ======================================================
echo.

:: Kontrola, zda je nainstalován Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [POZOR] Node.js není nainstalován na tomto počítači.
    echo Hra bude spuštěna v offline režimu - bez podpory sdílení na síti.
    echo.
    echo Spouštím index.html přímo v prohlížeči...
    start index.html
    echo.
    pause
    exit /b
)

:: Zjistit IP adresu pro lokální síť
set "LOCAL_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    if not defined LOCAL_IP (
        for /f "tokens=1" %%b in ("%%a") do set "LOCAL_IP=%%b"
    )
)

:: Spuštění serveru na pozadí a otevření prohlížeče
echo Spouštím lokální Node.js server...
start "" /b node server.js
timeout /t 2 /nobreak > nul

echo.
echo Otevírám hru v prohlížeči na adrese http://localhost:8787
start http://localhost:8787/?room=KLEMENTINUM^&teacher=1

echo.
echo ======================================================
echo   Server běží na portu 8787
echo ======================================================
echo.
if defined LOCAL_IP (
    echo   SDÍLENÍ SE STUDENTY NA TABLETECH:
    echo   ─────────────────────────────────
    echo.
    echo   Studenti: http://%LOCAL_IP%:8787/?room=KLEMENTINUM
    echo   Učitel:   http://%LOCAL_IP%:8787/?room=KLEMENTINUM^&teacher=1
    echo.
    echo   QR kódy pro snadné sdílení najdete přímo v aplikaci
    echo   na dashboardu učitele - tlačítko "Promítat QR kódy"
    echo.
) else (
    echo   [INFO] Nepodařilo se zjistit IP adresu.
    echo   Použijte příkaz 'ipconfig' pro zjištění IP adresy
    echo   nebo se podívejte na QR kódy v dashboardu učitele.
    echo.
)
echo ======================================================
echo   Stisknutím libovolné klávesy server zastavíte...
echo ======================================================
pause > nul

:: Ukončení serveru (node.exe spuštěného v této složce)
taskkill /f /im node.exe >nul 2>nul
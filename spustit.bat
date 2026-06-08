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

:: Spuštění serveru na pozadí a otevření prohlížeče
echo Spouštím lokální Node.js server...
start "" /b node server.js
timeout /t 2 /nobreak > nul

echo.
echo Otevírám hru v prohlížeči na adrese http://localhost:8787
start http://localhost:8787

echo.
echo ======================================================
echo Server běží na pozadí.
echo Pro sdílení se studenty na tabletech použijte IP adresu vašeho PC.
echo Pro zobrazení dashboardu učitele přejděte na:
echo http://localhost:8787/?teacher=1
echo ======================================================
echo.
echo Stisknutím libovolné klávesy server zastavíte...
pause > nul

:: Ukončení serveru (node.exe spuštěného v této složce)
taskkill /f /im node.exe >nul 2>nul
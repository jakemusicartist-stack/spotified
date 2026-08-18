@echo off
title Spotified Launcher

:: ── Check if dependencies are already installed ─────────────────────────────
if exist "%~dp0.deps_installed" goto :launch

echo.
echo  [Spotified]  First-time setup: installing dependencies...
cd /d "%~dp0web-app\spotified-backend"
call pip install -r requirements.txt -r ..\..\req.txt flask flask-cors >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Dependency install failed. Check your Python/pip setup.
    pause
    exit /b 1
)
:: Write the flag so we never run pip again
echo done > "%~dp0.deps_installed"
echo  [Spotified]  Dependencies ready.
goto :launchserver

:launch
cd /d "%~dp0web-app\spotified-backend"

:launchserver
:: ── Start the Flask server in its own branded window ─────────────────────────
:: Enable ANSI colors in CMD so the banner renders in purple
start "Spotified Server" cmd /k "reg add HKCU\Console /v VirtualTerminalLevel /t REG_DWORD /d 1 /f >nul 2>&1 && python app.py"

:: ── Open the browser after a short delay ─────────────────────────────────────
timeout /t 2 >nul
start http://localhost:5000

:: Auto-close this launcher window — no pause needed
exit

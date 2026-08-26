@echo off
title Spotified Launcher

:: ── Check if dependencies are already installed ─────────────────────────────
if exist "%~dp0.deps_installed" goto :check_ffmpeg

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

:check_ffmpeg
:: ── Check if FFmpeg is downloaded ───────────────────────────────────────────
if not exist "%~dp0ffmpeg.exe" (
    echo.
    echo  [Spotified]  First-time setup: Downloading FFmpeg ^(required for audio processing^)...
    cd /d "%~dp0"
    powershell -Command "$ErrorActionPreference = 'Stop'; $url = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'; Invoke-WebRequest -Uri $url -OutFile ffmpeg.zip; Expand-Archive -Path ffmpeg.zip -DestinationPath ffmpeg_temp -Force; Copy-Item 'ffmpeg_temp\ffmpeg-master-latest-win64-gpl\bin\ffmpeg.exe' -Destination . -Force; Remove-Item ffmpeg_temp -Recurse -Force; Remove-Item ffmpeg.zip -Force"
    if not exist "%~dp0ffmpeg.exe" (
        echo  [ERROR] FFmpeg download failed. Please download it manually and place ffmpeg.exe in this folder.
        pause
        exit /b 1
    )
    echo  [Spotified]  FFmpeg downloaded successfully.
)

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

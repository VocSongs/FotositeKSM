@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

if not exist media (
    mkdir media
    echo De map "media" is aangemaakt. Zet hier je foto's in en start dit bestand opnieuw.
    pause
    exit /b
)

echo Genereren van media.json en media.local.js...

set "JSON=%~dp0media.json"
set "JS=%~dp0media.local.js"

echo [>"%JSON%"
echo window.LOCAL_MEDIA = [>"%JS%"

set first=1
for %%f in ("media\*.jpg" "media\*.jpeg" "media\*.png" "media\*.webp" "media\*.gif" "media\*.mp4" "media\*.webm" "media\*.mov") do (
    if exist "%%~f" (
        set "entry=    { \"type\": \"image\", \"url\": \"media/%%~nxf\", \"name\": \"%%~nxf\" }"
        set "ext=%%~xf"
        if /I "!ext!"==".mp4" set "entry=    { \"type\": \"video\", \"url\": \"media/%%~nxf\", \"name\": \"%%~nxf\" }"
        if /I "!ext!"==".webm" set "entry=    { \"type\": \"video\", \"url\": \"media/%%~nxf\", \"name\": \"%%~nxf\" }"
        if /I "!ext!"==".mov" set "entry=    { \"type\": \"video\", \"url\": \"media/%%~nxf\", \"name\": \"%%~nxf\" }"

        if !first!==1 (
            echo !entry!>>"%JSON%"
            echo !entry!>>"%JS%"
            set first=0
        ) else (
            echo ,>>"%JSON%"
            echo !entry!>>"%JSON%"
            echo ,>>"%JS%"
            echo !entry!>>"%JS%"
        )
    )
)

echo ]>>"%JSON%"
echo ];>>"%JS%"

echo Klaar.
if !first!==1 (
    echo Er werden geen ondersteunde mediabestanden gevonden in de map media.
) else (
    echo Bestanden aangemaakt:
    echo - media.json
    echo - media.local.js
)

echo.
echo Tip: lokaal openen via index.html werkt met media.local.js.
 echo Voor media.json via fetch gebruik je best ook eens een lokale server.
pause

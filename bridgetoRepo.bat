@echo off
setlocal enabledelayedexpansion

:: Folder tujuan adalah lokasi .bat berada
set "destination=C:\Minecraft Add-On Projects\project-phantasm"

:: Folder sumber adalah folder Project Phantasm pada Bridge
set "source=%localappdata%\com.bridge.dev\bridge\projects\Project Phantasm"

echo ---------------------------------------------------------
echo Menyalin file langsung dari:
echo %source%
echo Ke:
echo %destination%
echo (Overwrite: ON)
echo ---------------------------------------------------------

:: Pastikan source ada
if not exist "%source%" (
    echo ERROR: Folder sumber tidak ditemukan:
    echo %source%
    pause
    exit /b
)

echo.
echo Menyalin dan menimpa file yang sudah ada...
robocopy "%source%" "%destination%" /E /IS /IT /NFL /NDL >nul

echo.
echo Selesai! File telah berhasil dicopy dari Bridge ke folder script.
echo Menutup dalam 5 detik...
timeout /t 5 >nul
exit
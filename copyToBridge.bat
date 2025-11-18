@echo off
setlocal enabledelayedexpansion

:: Folder sumber = lokasi .bat berada
set "source=C:\Minecraft Add-On Projects\project-phantasm"

:: Folder tujuan
set "destination=%localappdata%\com.bridge.dev\bridge\projects"
set "target=%destination%\Project Phantasm"

echo ---------------------------------------------------------
echo Menyalin file langsung dari:
echo %source%
echo Ke:
echo %target%
echo (Overwrite: ON)
echo ---------------------------------------------------------

:: Pastikan folder tujuan utama bisa diakses
pushd "%destination%" 2>nul
if errorlevel 1 (
    echo ERROR: Folder tujuan tidak dapat diakses:
    echo %destination%
    echo Pastikan folder ada atau perangkat terpasang.
    pause
    exit /b
)
popd

:: Buat folder Project Phantasm jika belum ada
if not exist "%target%" (
    echo Membuat folder Project Phantasm...
    mkdir "%target%"
)

echo.
echo Menyalin dan menimpa file yang sudah ada...
robocopy "%source%" "%target%" /E /IS /IT /NFL /NDL >nul

echo.
echo Selesai!

timeout /t 1

echo Script akan menutup dalam 5 detik...
timeout /t 5
exit
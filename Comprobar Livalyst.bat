@echo off
rem Comprueba que Livalyst est  bien: archivos, que arranca y que responde.
rem Funciona desde la carpeta en la que est , se abra como se abra.
rem Guardado en la codificaci¢n de la consola de Windows (850) para que las tildes se vean bien.
cd /d "%~dp0"
title Comprobar Livalyst
set FALLOS=0
echo.
echo   Comprobando Livalyst en: %CD%
echo   ------------------------------------------------------------
echo.

rem 1. Archivos de la aplicaci¢n
for %%F in (server.js panel.html widgets.html overlay.html package.json) do (
  if exist "%%F" (echo   [ OK ]   Archivo %%F) else (echo   [FALLO]  Falta el archivo %%F & set /a FALLOS+=1)
)
if exist "node_modules\ws" (echo   [ OK ]   Carpeta node_modules) else (echo   [FALLO]  Falta la carpeta node_modules & set /a FALLOS+=1)
if %FALLOS% GTR 0 goto final

rem 2. Que est‚ abierto; si no, se abre para comprobar que arranca (espera hasta 20 segundos)
echo.
curl -s -f -o nul -m 4 http://localhost:8787/config && goto abierto
echo   [ .. ]   Livalyst no estaba abierto: lo abro para comprobar que arranca...
if exist Livalyst.exe (start "" Livalyst.exe) else (start "" wscript "Iniciar Livalyst.vbs")
for /l %%i in (1,1,20) do (
  ping -n 2 127.0.0.1 >nul
  curl -s -f -o nul -m 2 http://localhost:8787/config && goto abierto
)
echo   [FALLO]  Livalyst no arranca. éltimas l¡neas de su registro (livalyst.log):
if exist livalyst.log powershell -NoProfile -Command "Get-Content livalyst.log -Tail 6 | ForEach-Object { '           ' + $_ }"
set /a FALLOS+=1
goto final

:abierto
echo   [ OK ]   Livalyst est  abierto y responde
rem 3. Sus p ginas (la de metas va aparte: dentro de un ®for¯, el ®?¯ se toma como comod¡n de archivos)
for %%P in (/ /widgets /alertas) do (
  curl -s -f -o nul -m 4 "http://localhost:8787%%P" && (echo   [ OK ]   P gina %%P) || (echo   [FALLO]  La p gina %%P no responde & set /a FALLOS+=1)
)
curl -s -f -o nul -m 4 "http://localhost:8787/meta?t=likes" && (echo   [ OK ]   P gina /meta) || (echo   [FALLO]  La p gina /meta no responde & set /a FALLOS+=1)
set VER=
if exist livalyst.log for /f "tokens=2" %%V in ('findstr /c:"Livalyst v" livalyst.log') do set VER=%%V
if defined VER echo   [ OK ]   Versi¢n en marcha: %VER%

:final
echo.
echo   ------------------------------------------------------------
if %FALLOS% GTR 0 (
  color 0C
  echo   Hay %FALLOS% problema^(s^). Vuelve a descargar Livalyst.zip de la £ltima versi¢n.
) else (
  color 0A
  echo   Todo funciona correctamente.
)
echo.
if not defined LIVALYST_SIN_PAUSA pause
exit /b %FALLOS%

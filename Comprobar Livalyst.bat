@echo off
rem Comprueba que Livalyst está bien: archivos, errores en el código y si responde.
rem Funciona desde la carpeta en la que está, se abra como se abra.
chcp 65001 >nul
cd /d "%~dp0"
title Comprobar Livalyst
set FALLOS=0
set AVISOS=0
echo.
echo   Comprobando Livalyst en: %CD%
echo   ------------------------------------------------------------
echo.

rem 1. Archivos de la aplicación
for %%F in (server.js panel.html widgets.html overlay.html package.json) do (
  if exist "%%F" (echo   [ OK ]   Archivo %%F) else (echo   [FALLO]  Falta el archivo %%F & set /a FALLOS+=1)
)
if exist "node_modules\ws" (echo   [ OK ]   Carpeta node_modules) else (echo   [FALLO]  Falta la carpeta node_modules & set /a FALLOS+=1)

rem 2. Que server.js no tenga errores (con Livalyst.exe, o con Node.js si se usa el código)
if not exist server.js goto respuesta
if exist Livalyst.exe (
  start "" /wait Livalyst.exe --check server.js
) else (
  where node >nul 2>nul || (echo   [AVISO]  No hay Livalyst.exe ni Node.js para revisar el código & set /a AVISOS+=1 & goto respuesta)
  node --check server.js >nul 2>nul
)
if errorlevel 1 (echo   [FALLO]  server.js tiene errores & set /a FALLOS+=1) else (echo   [ OK ]   server.js no tiene errores)

:respuesta
rem 3. Si Livalyst está abierto, que responda y sirva sus páginas
echo.
curl -s -f -o nul -m 4 http://localhost:8787/config
if errorlevel 1 (
  echo   [AVISO]  Livalyst no está abierto: ábrelo con Livalyst.exe y vuelve a comprobar
  set /a AVISOS+=1
  goto final
)
echo   [ OK ]   Livalyst está abierto y responde
rem (la de metas va aparte: dentro de un «for», el «?» se toma como comodín de archivos)
for %%P in (/ /widgets /alertas) do (
  curl -s -f -o nul -m 4 "http://localhost:8787%%P" && (echo   [ OK ]   Página %%P) || (echo   [FALLO]  La página %%P no responde & set /a FALLOS+=1)
)
curl -s -f -o nul -m 4 "http://localhost:8787/meta?t=likes" && (echo   [ OK ]   Página /meta) || (echo   [FALLO]  La página /meta no responde & set /a FALLOS+=1)
set VER=
if exist livalyst.log for /f "tokens=2" %%V in ('findstr /c:"Livalyst v" livalyst.log') do set VER=%%V
if defined VER echo   [ OK ]   Versión en marcha: %VER%

:final
echo.
echo   ------------------------------------------------------------
if %FALLOS% GTR 0 (
  color 0C
  echo   Hay %FALLOS% problema^(s^). Vuelve a descargar Livalyst.zip de la última versión.
) else if %AVISOS% GTR 0 (
  color 0E
  echo   Los archivos están bien. Revisa el aviso de arriba.
) else (
  color 0A
  echo   Todo funciona correctamente.
)
echo.
pause
exit /b %FALLOS%

@echo off
echo.
echo ============================================
echo   INSTALADOR - GARAGE INTELIGENTE
echo ============================================
echo.

:: Verifica Python
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python no encontrado en el sistema
    echo Descarga Python desde https://www.python.org
    echo Asegúrate de marcar "Add Python to PATH" durante instalación
    pause
    exit /b 1
)

echo [✓] Python detectado
echo.

:: Obtiene ruta actual
cd /d "%~dp0"
echo [✓] Ruta: %CD%

echo.
echo ============================================
echo   INICIANDO SERVIDOR WEB LOCAL
echo ============================================
echo.
echo Servidor iniciando en: http://localhost:8000
echo.
echo 1. Abre tu navegador (Chrome o Edge)
echo 2. Navega a: http://localhost:8000
echo 3. Conecta tu Arduino al puerto COM9
echo.
echo Presiona Ctrl+C para detener el servidor
echo.

python -m http.server 8000

@echo off
rem Batch order OCR (tencent + baidu cloud). Drag a folder onto this file, or run:
rem run_batch.bat "D:\path\to\images" [--engine both]
set PY=C:\Users\60969\AppData\Local\Programs\Python\Python314\python.exe
if "%~1"=="" (
    echo Usage: drag an image folder onto this bat, or: run_batch.bat "folder"
    pause
    exit /b 1
)
"%PY%" -X utf8 "%~dp0batch_ocr.py" %*
echo.
echo Done. Check the folder: 识别结果_xxx under your image folder.
pause

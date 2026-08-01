@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   工具集 一键同步到 GitHub (gjj/main)
echo ============================================

:: 检查是否有改动
git status --porcelain > nul 2>&1
if "%ERRORLEVEL%"=="0" (
  git status --porcelain | findstr /r "." > nul || (
    echo [信息] 没有检测到改动，无需同步。
    pause
    exit /b 0
  )
) else (
  echo [信息] 没有检测到改动，无需同步。
  pause
  exit /b 0
)

:: 输入提交说明
set /p MSG=请输入本次改动说明（直接回车用默认）:
if "%MSG%"=="" set MSG=更新工具集内容（%date% %time%）

echo.
echo [1/3] 添加改动...
git add -A

echo [2/3] 提交...
git -c user.name="DDzhp" -c user.email="609699844@qq.com" commit -m "%MSG%"

echo [3/3] 推送到 gjj/main...
git push origin main

echo.
echo ============================================
echo   同步完成！按任意键关闭窗口。
echo ============================================
pause

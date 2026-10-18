@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [1/3] 检查前端打包产物...
if not exist "web\dist\index.html" (
  echo 没找到打包产物，正在打包前端，大约 1 分钟...
  call npm run build || goto :err
)
echo [2/3] 启动网站服务（端口 3000）...
start "travel-cost-server" cmd /k "node server\src\index.js"
timeout /t 4 /nobreak >nul
echo [3/3] 生成公网网址，请等约 15 秒...
del /q "tools\tmole.log" 2>nul
start "travel-cost-tunnel" /min cmd /c "node tools\bore\node_modules\tunnelmole\dist\bin\tunnelmole.js 3000 > tools\tmole.log 2>&1"
timeout /t 16 /nobreak >nul
echo.
echo ============ 把下面 https:// 开头的那行发给好友 ============
findstr /c:"https://" "tools\tmole.log"
echo ==========================================================
echo.
echo 提示：这个网址靠这台电脑撑着，关机就失效；重启后重新双击本文件会换一个新网址。
pause
goto :eof
:err
echo 打包失败，请看上面报错。
pause

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
timeout /t 3 /nobreak >nul
echo [3/3] 生成公网网址，请等约 5 秒，下面 https:// 开头的那行就是发给好友的地址...
"tools\bore\node_modules\.bin\tmole.cmd" 3000
goto :eof
:err
echo 打包失败，请看上面报错。
pause

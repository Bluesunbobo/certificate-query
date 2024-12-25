@echo off
echo 正在检查端口 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| find ":3000"') do (
    echo 发现进程 %%a 正在使用端口 3000
    echo 正在终止进程...
    taskkill /F /PID %%a
)

echo 正在启动服务器...
node server.js
pause 
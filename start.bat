@echo off
echo 切换到项目目录...
cd /d "%~dp0"

echo 正在检查 node_modules...
if not exist node_modules\express (
    echo Express 模块未安装，正在运行安装脚本...
    call setup.bat
)

echo 正在检查端口 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| find ":3001"') do (
    echo 发现进程 %%a 正在使用端口 3001
    echo 正在终止进程...
    taskkill /F /PID %%a
)

echo 正在启动服务器...
"C:\Program Files\nodejs\node.exe" "%~dp0server.js"
pause
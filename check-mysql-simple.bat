@echo off
echo ========== MySQL 安装检查 ==========
echo.

echo 检查 MySQL 8.0 安装路径...
if exist "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" (
    echo [成功] MySQL 8.0 已安装
) else (
    echo [警告] 未找到 MySQL 8.0
)
echo.

echo 检查 MySQL 服务状态...
sc query "MySQL80" | find "STATE"
if errorlevel 1 (
    echo [警告] MySQL80 服务未运行或不存在
) else (
    echo [成功] MySQL80 服务已找到
)
echo.

echo 检查 MySQL 端口状态...
netstat -ano | find "3306"
if errorlevel 1 (
    echo [警告] 端口 3306 未在使用
) else (
    echo [成功] 端口 3306 已开放
)
echo.

echo ========== 检查完成 ==========
echo.
echo 如果看到任何[警告]信息，请确保：
echo 1. MySQL 8.0 已正确安装
echo 2. MySQL 服务已启动
echo 3. 端口 3306 未被其他程序占用
echo.
echo 按任意键继续...
pause > nul 
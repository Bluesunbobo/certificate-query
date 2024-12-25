@echo off
echo 正在检查 MySQL 安装...

REM 检查可能的 MySQL 安装路径
set MYSQL_FOUND=0
set MYSQL_PATH=

REM 检查 MySQL 8.0
if exist "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" (
    set "MYSQL_PATH=C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
    set MYSQL_FOUND=1
    echo 找到 MySQL 8.0: %MYSQL_PATH%
)

echo.
echo 正在初始化数据库...

REM 使用新密码创建数据库
echo 创建数据库...
"%MYSQL_PATH%" -u root -p123456 < "%~dp0setup.sql"

if %ERRORLEVEL% EQU 0 (
    echo 数据库初始化成功！
    echo 所有操作已完成！
) else (
    echo 数据库初始化失败，请检查错误信息
)

echo.
pause
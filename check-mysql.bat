@echo off
echo 正在检查 MySQL 服务状态...

REM 检查 MySQL 安装路径
echo 检查 MySQL 安装路径...
if exist "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" (
    echo MySQL 8.0 已安装在: C:\Program Files\MySQL\MySQL Server 8.0
) else if exist "C:\Program Files (x86)\MySQL\MySQL Server 8.0\bin\mysql.exe" (
    echo MySQL 8.0 已安装在: C:\Program Files (x86)\MySQL\MySQL Server 8.0
) else (
    echo 未找到 MySQL 8.0 安装
)

REM 检查 MySQL 服务是否在运行
echo.
echo 检查 MySQL 端口...
netstat -an | find ":3306"
if %ERRORLEVEL% EQU 0 (
    echo MySQL 端口 3306 已开放
) else (
    echo MySQL 端口 3306 未开放
)

REM 检查 MySQL 服务
echo.
echo 检查 MySQL 服务状态...
sc query MySQL80
if %ERRORLEVEL% EQU 0 (
    echo MySQL80 服务存在
) else (
    echo MySQL80 服务未找到，检查其他版本...
    sc query MySQL
    if %ERRORLEVEL% EQU 0 (
        echo 找到普通 MySQL 服务
    ) else (
        echo 未找到任何 MySQL 服务，需要安装 MySQL
    )
)

echo.
echo 检查完成！请查看以上信息。

REM 保持窗口打开
echo.
echo 按任意键继续...
pause > nul
cmd /k
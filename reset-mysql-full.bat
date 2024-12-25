@echo off
echo 正在完全重置 MySQL...

echo 1. 停止所有 MySQL 进程...
net stop MySQL80
taskkill /F /IM mysqld.exe /T

echo 2. 启动 MySQL 服务...
net start MySQL80
timeout /t 5

echo 3. 检查服务状态...
sc query MySQL80

echo 4. 尝试连接到 MySQL...
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -pA19880909a -e "SELECT 'Connection test' as Result;"

if %ERRORLEVEL% EQU 0 (
    echo MySQL 已成功启动并可以连接！
) else (
    echo MySQL 连接失败，错误代码：%ERRORLEVEL%
    echo 请检查 MySQL 安装是否正确。
)

pause 
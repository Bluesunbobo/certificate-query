@echo off
echo 测试 MySQL 连接...
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql" -u root -p123456 -e "SELECT 'Connection successful!' as Result;"
if %ERRORLEVEL% EQU 0 (
    echo MySQL 密码验证成功！
) else (
    echo MySQL 密码验证失败！
)
pause 
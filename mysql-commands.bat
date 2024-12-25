@echo off
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo 请求管理员权限...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"

echo 正在停止 MySQL 服务...
net stop MySQL80

echo 创建 SQL 命令文件...
(
echo FLUSH PRIVILEGES;
echo ALTER USER 'root'@'localhost' IDENTIFIED BY 'A19880909a';
echo FLUSH PRIVILEGES;
) > mysql-commands.sql

echo 以跳过授权表方式启动 MySQL...
start "MySQL" "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld" --skip-grant-tables --shared-memory

echo 等待 MySQL 启动...
timeout /t 5

echo 执行 SQL 命令...
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql" -u root < mysql-commands.sql

echo 关闭 MySQL...
taskkill /F /IM mysqld.exe

echo 重启 MySQL 服务...
net start MySQL80

echo 清理临时文件...
del mysql-commands.sql

echo 测试新密码...
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql" -u root -pA19880909a -e "SELECT 'Password reset successful!' as Result;"

pause 
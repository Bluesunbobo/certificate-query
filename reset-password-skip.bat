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

echo 以跳过授权表方式启动 MySQL...
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld" --skip-grant-tables --shared-memory

echo MySQL 已启动，请在新的命令提示符窗口中执行以下命令：
echo.
echo "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql" -u root
echo.
echo 然后在 MySQL 提示符下执行：
echo FLUSH PRIVILEGES;
echo ALTER USER 'root'@'localhost' IDENTIFIED BY 'A19880909a';
echo FLUSH PRIVILEGES;
echo exit;
echo.
echo 最后重启 MySQL 服务：
echo net start MySQL80
echo.
pause 
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

echo 创建初始化文件...
echo ALTER USER 'root'@'localhost' IDENTIFIED BY 'A19880909a'; > init-file.txt

echo 以安全模式启动 MySQL...
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld" --defaults-file="C:\ProgramData\MySQL\MySQL Server 8.0\my.ini" --init-file="%CD%\init-file.txt"

echo MySQL 已启动，请按 Ctrl+C 关闭此窗口，然后：
echo 1. 打开新的命令提示符（以管理员身份）
echo 2. 输入: net start MySQL80
echo 3. 重新运行 init-db.bat
pause 
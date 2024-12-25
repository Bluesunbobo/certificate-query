@echo off
echo 正在连接到 MySQL...

cd /d "C:\Program Files\MySQL\MySQL Server 8.0\bin"

echo 1. 尝试使用当前密码连接...
mysql -u root -pA19880909a -e "SELECT 'Connected!' as Result;"

if %ERRORLEVEL% EQU 0 (
    echo 连接成功！
) else (
    echo 连接失败，尝试重置密码...
    
    echo 2. 停止 MySQL 服务...
    net stop MySQL80
    
    echo 3. 以跳过授权表方式启动 MySQL...
    start "MySQL" mysqld --skip-grant-tables --shared-memory
    
    echo 等待 MySQL 启动...
    timeout /t 5
    
    echo 4. 执行密码重置...
    echo.
    echo 请在新窗口中执行以下命令：
    echo mysql -u root
    echo.
    echo 然后在 MySQL 提示符下输入：
    echo FLUSH PRIVILEGES;
    echo ALTER USER 'root'@'localhost' IDENTIFIED BY '123456';
    echo FLUSH PRIVILEGES;
    echo exit;
    echo.
    echo 完成后按任意键继续...
    pause
    
    echo 5. 关闭跳过授权表的 MySQL...
    taskkill /F /IM mysqld.exe
    
    echo 6. 重启 MySQL 服务...
    net start MySQL80
    
    echo 7. 测试新密码...
    mysql -u root -p123456 -e "SELECT 'Password reset successful!' as Result;"
)

pause 
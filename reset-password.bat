@echo off
echo 正在停止 MySQL 服务...
net stop MySQL80

echo 以安全模式启动 MySQL...
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld" --defaults-file="C:\ProgramData\MySQL\MySQL Server 8.0\my.ini" --init-file="%~dp0reset.txt" --console

echo MySQL 已启动，请按 Ctrl+C 关闭，然后重启 MySQL 服务
pause 
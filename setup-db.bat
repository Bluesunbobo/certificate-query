@echo off
echo 安装数据库依赖...
cd /d "%~dp0"
npm install mysql2 --save
echo 安装完成！
pause 
@echo off
echo 设置 Node.js 环境变量...
set PATH=%PATH%;C:\Program Files\nodejs\
echo 正在切换到项目目录...
cd /d "%~dp0"
echo 正在切换到淘宝镜像源...
call npm config set registry https://registry.npmmirror.com
echo 正在清除 npm 缓存...
call npm cache clean --force
echo 正在删除旧的 node_modules 文件夹（如果存在）...
if exist node_modules rmdir /s /q node_modules
echo 正在删除旧的 package-lock.json（如果存在）...
if exist package-lock.json del package-lock.json
echo 正在初始化项目...
call npm init -y
echo 正在安装依赖...
call npm install express multer xlsx --save --registry=https://registry.npmmirror.com
echo 安装完成！
pause 
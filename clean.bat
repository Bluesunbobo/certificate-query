@echo off
echo 正在清理项目...

echo 删除根目录下的 index.html...
if exist "index.html" (
    del "index.html"
    echo index.html 已删除
) else (
    echo index.html 不存在
)

echo 清理完成！
pause 
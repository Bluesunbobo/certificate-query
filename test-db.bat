@echo off
echo 切换到脚本所在目录...
cd /d "%~dp0"

echo 测试数据库连接...
"C:\Program Files\nodejs\node.exe" "%~dp0test-db.js"

if %ERRORLEVEL% EQU 0 (
    echo 测试完成！
) else (
    echo 测试失败，请检查错误信息
)
pause 
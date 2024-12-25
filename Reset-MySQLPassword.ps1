# 请求管理员权限
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator"))  
{  
    $arguments = "& '" + $myinvocation.mycommand.definition + "'"
    Start-Process powershell -Verb runAs -ArgumentList $arguments
    Break
}

# 停止 MySQL 服务
Write-Host "正在停止 MySQL 服务..."
Stop-Service MySQL80 -Force

# 创建 SQL 命令文件
Write-Host "创建 SQL 命令文件..."
@"
FLUSH PRIVILEGES;
ALTER USER 'root'@'localhost' IDENTIFIED BY 'A19880909a';
FLUSH PRIVILEGES;
"@ | Out-File -FilePath "mysql-commands.sql" -Encoding UTF8

# 启动 MySQL（跳过授权表）
Write-Host "以跳过授权表方式启动 MySQL..."
Start-Process -FilePath "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" -ArgumentList "--skip-grant-tables --shared-memory"

# 等待 MySQL 启动
Write-Host "等待 MySQL 启动..."
Start-Sleep -Seconds 5

# 执行 SQL 命令
Write-Host "执行 SQL 命令..."
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root < "mysql-commands.sql"

# 关闭 MySQL
Write-Host "关闭 MySQL..."
Stop-Process -Name "mysqld" -Force

# 重启 MySQL 服务
Write-Host "重启 MySQL 服务..."
Start-Service MySQL80

# 清理临时文件
Write-Host "清理临时文件..."
Remove-Item "mysql-commands.sql"

# 测试新密码
Write-Host "测试新密码..."
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -pA19880909a -e "SELECT 'Password reset successful!' as Result;"

Write-Host "按任意键继续..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 
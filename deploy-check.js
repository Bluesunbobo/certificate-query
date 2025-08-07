#!/usr/bin/env node

/**
 * 部署配置检查脚本
 * 用于验证Render部署前的配置是否正确
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 开始检查部署配置...\n');

// 检查必需文件
const requiredFiles = [
    'package.json',
    'server.js',
    'Procfile',
    'render.yaml',
    'public/index.html'
];

console.log('📁 检查必需文件:');
let allFilesExist = true;
requiredFiles.forEach(file => {
    const exists = fs.existsSync(file);
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    if (!exists) allFilesExist = false;
});

// 检查package.json
console.log('\n📦 检查package.json:');
try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // 检查启动脚本
    const hasStartScript = packageJson.scripts && packageJson.scripts.start;
    console.log(`  ${hasStartScript ? '✅' : '❌'} 启动脚本 (start)`);
    
    // 检查依赖
    const requiredDeps = ['express', 'pg', 'multer', 'xlsx'];
    console.log('  依赖检查:');
    requiredDeps.forEach(dep => {
        const hasDep = packageJson.dependencies && packageJson.dependencies[dep];
        console.log(`    ${hasDep ? '✅' : '❌'} ${dep}`);
    });
    
} catch (error) {
    console.log(`  ❌ package.json解析失败: ${error.message}`);
}

// 检查Procfile
console.log('\n📋 检查Procfile:');
try {
    const procfile = fs.readFileSync('Procfile', 'utf8');
    const hasWebProcess = procfile.includes('web:');
    console.log(`  ${hasWebProcess ? '✅' : '❌'} Web进程配置`);
} catch (error) {
    console.log(`  ❌ Procfile读取失败: ${error.message}`);
}

// 检查render.yaml
console.log('\n⚙️  检查render.yaml:');
try {
    const renderYaml = fs.readFileSync('render.yaml', 'utf8');
    const hasService = renderYaml.includes('type: web');
    const hasBuildCommand = renderYaml.includes('buildCommand');
    const hasStartCommand = renderYaml.includes('startCommand');
    
    console.log(`  ${hasService ? '✅' : '❌'} Web服务配置`);
    console.log(`  ${hasBuildCommand ? '✅' : '❌'} 构建命令`);
    console.log(`  ${hasStartCommand ? '✅' : '❌'} 启动命令`);
} catch (error) {
    console.log(`  ❌ render.yaml读取失败: ${error.message}`);
}

// 检查server.js
console.log('\n🚀 检查server.js:');
try {
    const serverJs = fs.readFileSync('server.js', 'utf8');
    const hasExpress = serverJs.includes('express');
    const hasListen = serverJs.includes('app.listen');
    const hasHealthCheck = serverJs.includes('/health');
    
    console.log(`  ${hasExpress ? '✅' : '❌'} Express框架`);
    console.log(`  ${hasListen ? '✅' : '❌'} 服务器监听`);
    console.log(`  ${hasHealthCheck ? '✅' : '❌'} 健康检查端点`);
} catch (error) {
    console.log(`  ❌ server.js读取失败: ${error.message}`);
}

console.log('\n📋 部署检查完成！');
console.log('\n💡 部署建议:');
console.log('1. 确保所有必需的环境变量已在Render中设置');
console.log('2. 检查数据库连接配置是否正确');
console.log('3. 验证GitHub仓库连接正常');
console.log('4. 查看Render部署日志以获取详细错误信息');

if (!allFilesExist) {
    console.log('\n⚠️  警告: 部分必需文件缺失，请检查后重新部署');
    process.exit(1);
} else {
    console.log('\n✅ 所有检查通过，可以开始部署！');
}

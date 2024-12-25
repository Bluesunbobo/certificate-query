const mysql = require('mysql2/promise');

const dbConfig = {
    host: '127.0.0.1',
    user: 'root',
    password: '123456',  // 使用新密码
    database: 'certificate_db',
    port: 3306
};

async function testConnection() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('数据库连接成功！');
        await connection.end();
    } catch (error) {
        console.error('数据库连接失败：', error);
    }
}

testConnection(); 
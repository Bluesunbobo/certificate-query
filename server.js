// Trigger Railway deployment - Auto deploy test v2
// Added more comments to trigger deployment
// Testing auto deployment
const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const mysql = require('mysql2/promise');
const app = express();
const fs = require('fs');
const os = require('os');

// 数据库配置
const dbConfig = {
    host: process.env.DB_HOST || 'junction.proxy.rlwy.net',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'ubjHNdavXgwVkCDMlSNOYeMpALhtcetx',
    database: process.env.DB_NAME || 'railway',
    port: process.env.DB_PORT || 36581,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
};

// 创建连接池
let pool;
try {
    pool = mysql.createPool(dbConfig);
    // 添加连接池错误处理
    pool.on('error', (err) => {
        console.error('Database pool error:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.log('Attempting to reconnect to database...');
            // 尝试重新初始化连接池
            initDatabase();
        }
    });
} catch (error) {
    console.error('Failed to create database pool:', error);
}

// 自动创建表
async function initDatabase() {
    try {
        if (!pool) {
            console.log('Recreating database pool...');
            pool = mysql.createPool(dbConfig);
        }
        
        const connection = await pool.getConnection();
        console.log('Database connection established successfully');
        
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS certificates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                gender VARCHAR(10) NOT NULL,
                id_type VARCHAR(20) NOT NULL,
                id_number VARCHAR(50) NOT NULL,
                cert_number VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_id_number (id_number),
                INDEX idx_cert_number (cert_number)
            )
        `);
        connection.release();
        console.log('Database initialized');
    } catch (error) {
        console.error('Database initialization error:', error);
        // 添加延迟重试
        console.log('Will retry database initialization in 5 seconds...');
        setTimeout(() => {
            initDatabase();
        }, 5000);
    }
}

// 在启动服务器前调用
initDatabase();

// 使用系统临时目录作为上传目录
let uploadDir = process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'cert-uploads');

// 确保上传目录存在
try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    console.log(`Upload directory set to: ${uploadDir}`);
} catch (error) {
    console.error(`Failed to create upload directory: ${error.message}`);
    // 降级使用当前目录
    uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
}

// 设置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});
const upload = multer({ storage: storage });

// 设置静态文件目录
app.use(express.static(__dirname + '/public'));

// 根路由
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// 获取数据库连接的辅助函数
async function getConnection() {
    try {
        if (!pool) {
            console.log('Recreating database pool before getting connection...');
            pool = mysql.createPool(dbConfig);
        }
        return await pool.getConnection();
    } catch (error) {
        console.error('Error getting database connection:', error);
        // 如果是连接丢失错误，尝试重新创建连接池
        if (error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ECONNREFUSED') {
            console.log('Connection lost, recreating pool...');
            pool = mysql.createPool(dbConfig);
            return await pool.getConnection();
        }
        throw error;
    }
}

// 证书查询API
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    try {
        // 使用辅助函数获取连接
        const connection = await getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM certificates WHERE id_number = ? OR cert_number = ?',
                [query, query]
            );
            
            if (rows.length > 0) {
                // 使用 Map 来合并重复记录
                const uniqueRecords = new Map();
                
                rows.forEach(data => {
                    const key = `${data.name}-${data.id_number}`; // 使用姓名和证件号作为唯一标识
                    
                    if (uniqueRecords.has(key)) {
                        // 如果记录已存在，将证书编号添加到数组中
                        const record = uniqueRecords.get(key);
                        if (!record.certNumbers.includes(data.cert_number)) {
                            record.certNumbers.push(data.cert_number);
                        }
                    } else {
                        // 如果是新记录，创建新的对象
                        uniqueRecords.set(key, {
                            name: data.name,
                            gender: data.gender,
                            idType: data.id_type,
                            idNumber: data.id_number,
                            certNumbers: [data.cert_number]
                        });
                    }
                });

                // 转换为数组
                const results = Array.from(uniqueRecords.values());
                
                res.json({
                    success: true,
                    data: results
                });
            } else {
                res.json({
                    success: false,
                    message: '未找到相关证书信息'
                });
            }
        } finally {
            // 确保连接一定会被释放
            connection.release();
        }
    } catch (error) {
        console.error('Database error:', error);
        res.json({
            success: false,
            message: '查询失败，请稍后重试'
        });
    }
});

// 文件上传API
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.json({ success: false, message: '未收到文件' });
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        // 检查数据是否为空
        if (!data || data.length === 0) {
            return res.json({ success: false, message: '文件中没有有效数据' });
        }

        // 验证数据格式
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (!row.姓名 || !row.性别 || !row.证件类型 || !row.证件号 || !row.证书编号) {
                return res.json({ 
                    success: false, 
                    message: `第${i+1}行数据不完整，请确保Excel包含姓名、性别、证件类型、证件号和证书编号字段` 
                });
            }
        }

        // 使用辅助函数获取连接
        const connection = await getConnection();
        try {
            await connection.beginTransaction();
            
            // 批量操作，每50条数据一批
            const batchSize = 50;
            for (let i = 0; i < data.length; i += batchSize) {
                const batch = data.slice(i, i + batchSize);
                
                // 准备批量插入数据
                const values = batch.map(row => [
                    row.姓名, row.性别, row.证件类型, row.证件号, row.证书编号
                ]);
                
                // 执行批量插入
                await connection.query(
                    'INSERT INTO certificates (name, gender, id_type, id_number, cert_number) VALUES ?',
                    [values]
                );
            }
            
            // 提交事务
            await connection.commit();
            
            // 删除上传的文件
            fs.unlinkSync(req.file.path);
            
            return res.json({ success: true, message: `文件上传成功，共导入${data.length}条记录` });
        } catch (error) {
            // 回滚事务
            await connection.rollback();
            console.error('Database error during file upload:', error);
            return res.json({ 
                success: false, 
                message: `文件处理失败: ${error.message}` 
            });
        } finally {
            // 确保连接被释放
            connection.release();
        }
    } catch (error) {
        console.error('Error processing file:', error);
        // 确保临时文件被删除
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) { /* 忽略删除错误 */ }
        }
        return res.json({ 
            success: false, 
            message: `文件处理失败: ${error.message}` 
        });
    }
});

// 启动服务器
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
    console.log(`服务器已启动，请在浏览器中访问: http://localhost:${PORT}`);
});

// 处理进程退出信号
process.on('SIGTERM', () => {
    console.log('收到SIGTERM信号，正在优雅关闭服务...');
    server.close(async () => {
        console.log('HTTP服务已关闭');
        // 尝试关闭数据库连接池
        if (pool) {
            try {
                await pool.end();
                console.log('数据库连接池已关闭');
            } catch (error) {
                console.error('关闭数据库连接池时出错:', error);
            }
        }
        process.exit(0);
    });
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    // 记录错误但不退出进程
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
    // 记录错误但不退出进程
}); 

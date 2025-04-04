// Trigger Railway deployment - Auto deploy test v2
// Added more comments to trigger deployment
// Testing auto deployment
const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const { Pool } = require('pg'); // 使用PostgreSQL
const app = express();
const fs = require('fs');
const os = require('os');

// 数据库类型
const DB_TYPE = process.env.DB_TYPE || 'postgres'; // 默认使用postgres，可以通过环境变量切换

// 数据库配置
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432, // PostgreSQL默认端口
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

// 打印数据库连接信息（不包含密码）
console.log(`数据库类型: ${DB_TYPE}`);
console.log(`数据库连接配置: ${dbConfig.host}:${dbConfig.port}, 用户: ${dbConfig.user}, 数据库: ${dbConfig.database}`);

// 创建数据库连接池
let pool;
// 服务状态标志
let databaseAvailable = false;
// 重试计数器和最大重试次数
let retryCount = 0;
const MAX_RETRIES = 5;

// 创建数据库连接池的函数
function createPool() {
    try {
        console.log('Creating database connection pool...');
        const newPool = new Pool(dbConfig);
        
        // 添加连接池错误处理
        newPool.on('error', (err) => {
            console.error('Database pool error:', err);
            databaseAvailable = false;
            // 延迟重新初始化
            setTimeout(() => {
                initDatabase();
            }, 5000);
        });
        
        return newPool;
    } catch (error) {
        console.error('Failed to create database pool:', error);
        return null;
    }
}

// 自动创建表
async function initDatabase() {
    try {
        if (retryCount >= MAX_RETRIES) {
            console.error(`已达到最大重试次数(${MAX_RETRIES})，停止尝试连接数据库。`);
            console.log('应用将继续运行，但数据库功能可能不可用。');
            databaseAvailable = false;
            return;
        }
        
        if (!pool) {
            pool = createPool();
            if (!pool) {
                throw new Error('无法创建数据库连接池');
            }
        }
        
        console.log('尝试连接数据库...');
        const client = await pool.connect();
        console.log('Database connection established successfully');
        
        // PostgreSQL创建表语句
        await client.query(`
            CREATE TABLE IF NOT EXISTS certificates (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                gender VARCHAR(10) NOT NULL,
                id_type VARCHAR(20) NOT NULL,
                id_number VARCHAR(50) NOT NULL,
                cert_number VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT idx_id_number UNIQUE (id_number, cert_number)
            )
        `);
        
        // 创建索引
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_cert_id_number ON certificates(id_number);
            CREATE INDEX IF NOT EXISTS idx_cert_number ON certificates(cert_number);
        `);
        
        client.release();
        console.log('Database initialized');
        
        // 设置数据库可用标志
        databaseAvailable = true;
        
        // 重置重试计数
        retryCount = 0;
    } catch (error) {
        databaseAvailable = false;
        retryCount++;
        console.error(`Database initialization error (尝试 ${retryCount}/${MAX_RETRIES}): ${error.message}`);
        
        // 计算指数退避时间 (1秒, 2秒, 4秒, 8秒, 16秒)
        const backoffTime = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
        
        console.log(`Will retry database initialization in ${backoffTime/1000} seconds...`);
        setTimeout(() => {
            initDatabase();
        }, backoffTime);
    }
}

// 在启动服务器前调用
if (process.env.SKIP_DB !== 'true') {
    initDatabase();
} else {
    console.log('跳过数据库初始化 (SKIP_DB=true)');
}

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
            pool = createPool();
        }
        return await pool.connect();
    } catch (error) {
        console.error('Error getting database connection:', error);
        throw error;
    }
}

// 添加服务状态端点
app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        databaseAvailable: databaseAvailable,
        time: new Date().toISOString()
    });
});

// 证书查询API
app.get('/api/search', async (req, res) => {
    if (!databaseAvailable) {
        return res.json({
            success: false,
            message: '数据库服务暂时不可用，请稍后重试'
        });
    }
    
    const query = req.query.q;
    try {
        // 使用辅助函数获取连接
        const client = await getConnection();
        try {
            // PostgreSQL使用$1占位符
            const result = await client.query(
                'SELECT * FROM certificates WHERE id_number = $1 OR cert_number = $1',
                [query]
            );
            
            const rows = result.rows;
            
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
            client.release();
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
    if (!databaseAvailable) {
        return res.json({
            success: false,
            message: '数据库服务暂时不可用，无法上传文件'
        });
    }
    
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
        const client = await getConnection();
        try {
            // 开始事务
            await client.query('BEGIN');
            
            // 批量操作，每50条数据一批
            const batchSize = 50;
            for (let i = 0; i < data.length; i += batchSize) {
                const batch = data.slice(i, i + batchSize);
                
                // 对每个记录执行插入
                for (const row of batch) {
                    // PostgreSQL使用$1,$2等占位符
                    await client.query(
                        'INSERT INTO certificates (name, gender, id_type, id_number, cert_number) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id_number, cert_number) DO NOTHING',
                        [row.姓名, row.性别, row.证件类型, row.证件号, row.证书编号]
                    );
                }
            }
            
            // 提交事务
            await client.query('COMMIT');
            
            // 删除上传的文件
            fs.unlinkSync(req.file.path);
            
            return res.json({ success: true, message: `文件上传成功，共导入${data.length}条记录` });
        } catch (error) {
            // 回滚事务
            await client.query('ROLLBACK');
            console.error('Database error during file upload:', error);
            return res.json({ 
                success: false, 
                message: `文件处理失败: ${error.message}` 
            });
        } finally {
            // 确保连接被释放
            client.release();
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

// 添加数据库连接测试端点
app.get('/api/test-db-connection', async (req, res) => {
    // 只有在启用DEBUG环境变量时才允许访问
    if (process.env.DEBUG !== 'true') {
        return res.status(403).json({ error: '需要启用DEBUG模式才能访问' });
    }
    
    const results = {
        config: {
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            database: dbConfig.database,
            type: DB_TYPE
            // 不返回密码
        },
        status: {
            databaseAvailable: databaseAvailable,
            retryCount: retryCount,
            maxRetries: MAX_RETRIES
        },
        connection: null,
        error: null
    };
    
    // 尝试建立连接
    try {
        // 创建一个新的单独连接（不使用连接池）进行测试
        const client = await pool.connect();
        
        // 测试简单查询
        const result = await client.query('SELECT 1 as test');
        
        results.connection = {
            success: true,
            test: result.rows[0].test === 1 ? 'passed' : 'failed'
        };
        
        // 关闭连接
        client.release();
    } catch (error) {
        results.connection = { success: false };
        results.error = {
            message: error.message,
            code: error.code,
            detail: error.detail
        };
    }
    
    // 返回结果
    res.json(results);
});

// 添加网络连接测试端点
app.get('/api/test-network', async (req, res) => {
    if (process.env.DEBUG !== 'true') {
        return res.status(403).json({ error: '需要启用DEBUG模式才能访问' });
    }
    
    const results = {
        render: {
            environment: process.env.RENDER ? 'true' : 'false',
            service: process.env.RENDER_SERVICE_NAME || 'unknown'
        },
        database: {
            host: dbConfig.host,
            port: dbConfig.port
        },
        networkTests: []
    };
    
    // 尝试使用DNS解析主机名
    try {
        const dns = require('dns');
        const lookupPromise = new Promise((resolve, reject) => {
            dns.lookup(dbConfig.host, (err, address, family) => {
                if (err) reject(err);
                else resolve({ address, family });
            });
        });
        
        const dnsResult = await lookupPromise;
        results.networkTests.push({
            test: 'DNS解析',
            success: true,
            address: dnsResult.address,
            ipVersion: `IPv${dnsResult.family}`
        });
    } catch (error) {
        results.networkTests.push({
            test: 'DNS解析',
            success: false,
            error: error.message
        });
    }
    
    // 尝试TCP连接
    try {
        const net = require('net');
        const socket = new net.Socket();
        
        const connectPromise = new Promise((resolve, reject) => {
            // 设置连接超时
            socket.setTimeout(5000);
            
            socket.connect(dbConfig.port, dbConfig.host, () => {
                resolve({ connected: true });
                socket.end();
            });
            
            socket.on('timeout', () => {
                socket.destroy();
                reject(new Error('连接超时'));
            });
            
            socket.on('error', (err) => {
                reject(err);
            });
        });
        
        const tcpResult = await connectPromise;
        results.networkTests.push({
            test: 'TCP连接',
            success: true,
            details: tcpResult
        });
    } catch (error) {
        results.networkTests.push({
            test: 'TCP连接',
            success: false,
            error: error.message
        });
    }
    
    res.json(results);
});

// 添加手动触发清理的API（需要管理员密码）
app.get('/api/cleanup', async (req, res) => {
    // 检查管理员密码
    const adminPassword = process.env.ADMIN_PASSWORD;
    const providedPassword = req.query.password;
    
    if (!adminPassword || providedPassword !== adminPassword) {
        return res.status(403).json({ success: false, message: '未授权访问' });
    }
    
    try {
        await cleanupOldData();
        res.json({ success: true, message: '清理操作已执行' });
    } catch (error) {
        res.status(500).json({ success: false, message: '清理操作失败: ' + error.message });
    }
});

// 添加数据库使用统计API
app.get('/api/stats', async (req, res) => {
    // 需要管理员密码
    const adminPassword = process.env.ADMIN_PASSWORD;
    const providedPassword = req.query.password;
    
    if (!adminPassword || providedPassword !== adminPassword) {
        return res.status(403).json({ success: false, message: '未授权访问' });
    }
    
    if (!databaseAvailable) {
        return res.json({
            success: false,
            message: '数据库服务暂时不可用'
        });
    }
    
    try {
        const client = await getConnection();
        try {
            // 获取总记录数
            const countResult = await client.query('SELECT COUNT(*) as total FROM certificates');
            
            // 获取最早记录时间
            const oldestResult = await client.query('SELECT MIN(created_at) as oldest FROM certificates');
            
            // 获取最新记录时间
            const newestResult = await client.query('SELECT MAX(created_at) as newest FROM certificates');
            
            // 统计过去3个月的记录数
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            const recentResult = await client.query(
                'SELECT COUNT(*) as recent FROM certificates WHERE created_at > $1',
                [threeMonthsAgo.toISOString()]
            );
            
            // 统计可能被清理的记录数
            const cleanupResult = await client.query(
                'SELECT COUNT(*) as cleanup_count FROM certificates WHERE created_at < $1',
                [threeMonthsAgo.toISOString()]
            );
            
            res.json({
                success: true,
                stats: {
                    totalRecords: parseInt(countResult.rows[0].total),
                    oldestRecord: oldestResult.rows[0].oldest,
                    newestRecord: newestResult.rows[0].newest,
                    recentRecords: parseInt(recentResult.rows[0].recent),
                    recordsToCleanup: parseInt(cleanupResult.rows[0].cleanup_count)
                }
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('获取统计信息时出错:', error);
        res.status(500).json({ 
            success: false, 
            message: '获取统计信息失败: ' + error.message 
        });
    }
});

// 添加定期清理功能
async function cleanupOldData() {
    if (!databaseAvailable) {
        console.log('数据库不可用，跳过清理');
        return;
    }
    
    try {
        const client = await getConnection();
        
        try {
            // 计算3个月前的日期
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            const dateStr = threeMonthsAgo.toISOString();
            
            // 删除3个月前的数据
            const result = await client.query(
                'DELETE FROM certificates WHERE created_at < $1 RETURNING COUNT(*)',
                [dateStr]
            );
            
            console.log(`清理完成: 删除了 ${result.rowCount} 条过期记录`);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('清理数据时出错:', error);
    }
}

// 设置定期清理任务(每天检查一次)
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24小时
let cleanupTimer = null;

function scheduleCleanupTask() {
    // 清除之前的定时器（如果有）
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
    }
    
    // 设置新的定时器
    cleanupTimer = setInterval(() => {
        console.log('执行定期数据清理...');
        cleanupOldData();
    }, CLEANUP_INTERVAL);
    
    console.log('数据清理任务已设置，间隔:', CLEANUP_INTERVAL, 'ms');
}

// 添加一个广告回调处理接口
app.get('/api/ad-callback', (req, res) => {
    const callbackData = req.query;
    
    // 记录回调数据
    console.log('广告回调数据:', callbackData);
    
    // 返回成功响应
    res.json({ success: true, message: '回调接收成功' });
});

// 添加一个POST方法的回调接口以支持不同的回调方式
app.post('/api/ad-callback', express.json(), (req, res) => {
    const callbackData = req.body;
    
    // 记录回调数据
    console.log('广告回调数据(POST):', callbackData);
    
    // 返回成功响应
    res.json({ success: true, message: '回调接收成功' });
});

// 启动服务器
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
    console.log(`服务器已启动，请在浏览器中访问: http://localhost:${PORT}`);
    
    // 如果启用自动清理，初始化清理任务
    if (process.env.ENABLE_AUTO_CLEANUP === 'true') {
        console.log('启用自动数据清理');
        scheduleCleanupTask();
    }
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

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
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cert_db',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

// 打印数据库连接信息（不包含密码）
console.log(`数据库类型: ${DB_TYPE}`);
console.log(`数据库连接配置: ${dbConfig.host}:${dbConfig.port}, 用户: ${dbConfig.user}, 数据库: ${dbConfig.database}`);

// 检查必要的环境变量
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD) {
    console.warn('⚠️  警告: 数据库环境变量未完全设置，将使用默认配置或跳过数据库初始化');
    console.warn('请确保设置了以下环境变量: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT');
}

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
    const query = req.query.id || req.query.q; // 支持两种参数名
    
    if (!databaseAvailable) {
        // 当数据库不可用时，返回模拟数据用于测试
        return res.json({
            success: true,
            data: {
                name: '测试用户',
                gender: '男',
                idType: '身份证',
                idNumber: query || '123456789012345678',
                certNumber: 'CERT' + Math.random().toString(36).substr(2, 8).toUpperCase()
            }
        });
    }
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
    try {
        if (!req.file) {
            return res.json({ success: false, message: '未收到文件' });
        }

        // 检查文件类型
        const fileExtension = path.extname(req.file.originalname).toLowerCase();
        if (!['.xlsx', '.xls'].includes(fileExtension)) {
            return res.json({ 
                success: false, 
                message: '文件格式不支持，请上传Excel文件(.xlsx或.xls格式)' 
            });
        }

        let workbook;
        try {
            workbook = xlsx.readFile(req.file.path);
        } catch (error) {
            return res.json({ 
                success: false, 
                message: '文件读取失败，请确保文件是有效的Excel格式' 
            });
        }

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return res.json({ 
                success: false, 
                message: 'Excel文件中没有工作表' 
            });
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        if (!worksheet) {
            return res.json({ 
                success: false, 
                message: '无法读取工作表内容' 
            });
        }

        const data = xlsx.utils.sheet_to_json(worksheet);

        // 检查数据是否为空
        if (!data || data.length === 0) {
            return res.json({ 
                success: false, 
                message: '文件中没有有效数据，请确保Excel文件包含数据行' 
            });
        }

        // 检查必需的列是否存在
        const firstRow = data[0];
        const requiredColumns = ['姓名', '性别', '证件类型', '证件号', '证书编号'];
        const missingColumns = requiredColumns.filter(col => !firstRow.hasOwnProperty(col));
        
        if (missingColumns.length > 0) {
            return res.json({ 
                success: false, 
                message: `Excel文件缺少必需的列：${missingColumns.join('、')}。请确保文件包含姓名、性别、证件类型、证件号和证书编号列` 
            });
        }

        // 验证数据格式和内容
        const errors = [];
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNumber = i + 2; // Excel行号从2开始（第1行是标题）
            
            // 检查必需字段是否为空
            if (!row.姓名 || row.姓名.toString().trim() === '') {
                errors.push(`第${rowNumber}行：姓名字段为空`);
            }
            if (!row.性别 || row.性别.toString().trim() === '') {
                errors.push(`第${rowNumber}行：性别字段为空`);
            }
            if (!row.证件类型 || row.证件类型.toString().trim() === '') {
                errors.push(`第${rowNumber}行：证件类型字段为空`);
            }
            if (!row.证件号 || row.证件号.toString().trim() === '') {
                errors.push(`第${rowNumber}行：证件号字段为空`);
            }
            if (!row.证书编号 || row.证书编号.toString().trim() === '') {
                errors.push(`第${rowNumber}行：证书编号字段为空`);
            }
        }

        if (errors.length > 0) {
            return res.json({ 
                success: false, 
                message: `数据格式错误：\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? '\n...（还有更多错误）' : ''}` 
            });
        }

        // 如果数据库不可用，在验证通过后返回模拟成功消息
        if (!databaseAvailable) {
            return res.json({
                success: true,
                message: `文件格式验证通过，共${data.length}条记录（模拟模式，数据库不可用）`
            });
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
        cleanupOldFiles(); // 添加文件清理
        res.json({ success: true, message: '清理操作已执行' });
    } catch (error) {
        res.status(500).json({ success: false, message: '清理操作失败: ' + error.message });
    }
});

// 添加文件清理状态查询API
app.get('/api/file-status', async (req, res) => {
    // 检查管理员密码
    const adminPassword = process.env.ADMIN_PASSWORD;
    const providedPassword = req.query.password;
    
    if (!adminPassword || providedPassword !== adminPassword) {
        return res.status(403).json({ success: false, message: '未授权访问' });
    }
    
    try {
        const fileStatus = {
            uploadDir: uploadDir,
            exists: fs.existsSync(uploadDir),
            files: []
        };
        
        if (fileStatus.exists) {
            const files = fs.readdirSync(uploadDir);
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            fileStatus.files = files.map(file => {
                const filePath = path.join(uploadDir, file);
                const stats = fs.statSync(filePath);
                const fileAge = new Date() - stats.mtime;
                const daysOld = Math.floor(fileAge / (24 * 60 * 60 * 1000));
                
                return {
                    name: file,
                    size: stats.size,
                    created: stats.mtime,
                    daysOld: daysOld,
                    willBeDeleted: daysOld >= 7
                };
            });
        }
        
        res.json({ success: true, data: fileStatus });
    } catch (error) {
        res.status(500).json({ success: false, message: '获取文件状态失败: ' + error.message });
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

// 添加文件清理功能
function cleanupOldFiles() {
    try {
        console.log('开始清理过期文件...');
        
        // 计算7天前的日期
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        // 检查上传目录是否存在
        if (!fs.existsSync(uploadDir)) {
            console.log('上传目录不存在，跳过文件清理');
            return;
        }
        
        // 读取上传目录中的所有文件
        const files = fs.readdirSync(uploadDir);
        let deletedCount = 0;
        
        files.forEach(file => {
            const filePath = path.join(uploadDir, file);
            
            try {
                // 获取文件状态
                const stats = fs.statSync(filePath);
                const fileAge = new Date() - stats.mtime;
                const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000; // 7天的毫秒数
                
                // 如果文件超过7天，删除它
                if (fileAge > sevenDaysInMs) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    console.log(`删除过期文件: ${file}`);
                }
            } catch (error) {
                console.error(`处理文件 ${file} 时出错:`, error.message);
            }
        });
        
        console.log(`文件清理完成: 删除了 ${deletedCount} 个过期文件`);
    } catch (error) {
        console.error('文件清理过程中出错:', error);
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
        console.log('执行定期清理任务...');
        cleanupOldData(); // 清理数据库旧数据
        cleanupOldFiles(); // 清理过期文件
    }, CLEANUP_INTERVAL);
    
    console.log('定期清理任务已设置，间隔:', CLEANUP_INTERVAL, 'ms');
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
    if (process.env.ENABLE_AUTO_CLEANUP !== 'false') {
        console.log('启用自动数据清理和文件清理');
        scheduleCleanupTask();
        
        // 立即执行一次清理任务
        console.log('执行初始清理任务...');
        cleanupOldData();
        cleanupOldFiles();
    } else {
        console.log('自动清理功能已禁用');
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

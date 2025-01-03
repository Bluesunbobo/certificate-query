// Trigger Railway deployment - Auto deploy test v2
// Added more comments to trigger deployment
// Testing auto deployment
const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const mysql = require('mysql2/promise');
const app = express();

// 数据库配置
const dbConfig = {
    host: 'junction.proxy.rlwy.net',
    user: 'root',
    password: 'ubjHNdavXgwVkCDMlSNOYeMpALhtcetx',
    database: 'railway',
    port: 36581,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 自动创建表
async function initDatabase() {
    try {
        const connection = await pool.getConnection();
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
    }
}

// 在启动服务器前调用
initDatabase();

// 设置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});
const upload = multer({ storage: storage });

// 确保上传目录存在
const fs = require('fs');
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// 设置静态文件目录
app.use(express.static(__dirname + '/public'));

// 根路由
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// 证书查询API
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT * FROM certificates WHERE id_number = ? OR cert_number = ?',
            [query, query]
        );
        connection.release();

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

        const connection = await pool.getConnection();
        
        for (const row of data) {
            await connection.execute(
                'INSERT INTO certificates (name, gender, id_type, id_number, cert_number) VALUES (?, ?, ?, ?, ?)',
                [row.姓名, row.性别, row.证件类型, row.证件号, row.证书编号]
            );
        }

        connection.release();

        // 删除上传的文件
        fs.unlinkSync(req.file.path);

        res.json({ success: true, message: '文件上传成功' });
    } catch (error) {
        console.error('Error processing file:', error);
        res.json({ success: false, message: '文件处理失败：' + error.message });
    }
});

// 启动服务器
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`服务器已启动，请在浏览器中访问: http://localhost:${PORT}`);
}); 

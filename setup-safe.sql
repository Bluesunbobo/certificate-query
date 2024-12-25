CREATE DATABASE IF NOT EXISTS certificate_db;
USE certificate_db;

-- 检查并删除旧表
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_schema = 'certificate_db' AND table_name = 'certificates');

SET @sql = IF(@table_exists > 0,
    'DROP TABLE certificates',
    'SELECT "Table does not exist"');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 创建新表
CREATE TABLE certificates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    gender VARCHAR(10) NOT NULL,
    id_type VARCHAR(20) NOT NULL,
    id_number VARCHAR(50) NOT NULL UNIQUE,
    cert_number VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_id_number (id_number),
    INDEX idx_cert_number (cert_number)
); 
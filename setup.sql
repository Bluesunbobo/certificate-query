CREATE DATABASE IF NOT EXISTS certificate_db;
USE certificate_db;

-- 删除旧表（如果存在）
DROP TABLE IF EXISTS certificates;

-- 创建新表（包含索引）
CREATE TABLE certificates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    gender VARCHAR(10) NOT NULL,
    id_type VARCHAR(20) NOT NULL,
    id_number VARCHAR(50) NOT NULL,
    cert_number VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_id_number (id_number),
    INDEX idx_cert_number (cert_number)
);
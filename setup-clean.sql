CREATE DATABASE IF NOT EXISTS certificate_db;
USE certificate_db;

-- 删除旧表（如果存在）
DROP TABLE IF EXISTS certificates;

-- 创建新表
CREATE TABLE certificates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    gender VARCHAR(10) NOT NULL,
    id_type VARCHAR(20) NOT NULL,
    id_number VARCHAR(50) NOT NULL UNIQUE,
    cert_number VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_id_number ON certificates(id_number);
CREATE INDEX idx_cert_number ON certificates(cert_number); 
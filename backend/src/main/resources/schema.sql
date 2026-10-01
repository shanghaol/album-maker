-- 相册制作平台 数据库初始化脚本
CREATE DATABASE IF NOT EXISTS album_maker DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE album_maker;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) DEFAULT NULL COMMENT '手机号',
    username VARCHAR(50) DEFAULT NULL COMMENT '用户名（商家登录用）',
    password VARCHAR(255) NOT NULL COMMENT '加密密码',
    nickname VARCHAR(50) DEFAULT NULL COMMENT '昵称',
    role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER' COMMENT '角色',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_phone (phone),
    UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 模板表
CREATE TABLE IF NOT EXISTS templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '模板名称',
    description TEXT COMMENT '模板描述',
    cover_url VARCHAR(500) COMMENT '封面图URL',
    page_count INT NOT NULL DEFAULT 0 COMMENT '总页数',
    category VARCHAR(50) DEFAULT NULL COMMENT '分类: wedding/travel/family/graduation/other',
    type VARCHAR(20) NOT NULL DEFAULT 'ALBUM' COMMENT '内容线: ALBUM/CREATIVE',
    status ENUM('DRAFT', 'PUBLISHED', 'DISABLED') NOT NULL DEFAULT 'DRAFT' COMMENT '状态',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模板表';

-- 存量库补列（MySQL 5.7 不支持 ADD COLUMN IF NOT EXISTS，先查后加；全新建库时下方 CREATE 已含两列，本段跳过）
-- ALTER TABLE templates ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'ALBUM' COMMENT '内容线: ALBUM/CREATIVE';
-- ALTER TABLE projects ADD COLUMN source_id BIGINT DEFAULT NULL COMMENT '重新编辑溯源根项目ID';

-- 模板页面表
CREATE TABLE IF NOT EXISTS template_pages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT NOT NULL COMMENT '模板ID',
    page_number INT NOT NULL COMMENT '页码',
    background_url VARCHAR(500) COMMENT '背景图URL',
    width INT DEFAULT 2480 COMMENT '页面宽度(px)',
    height INT DEFAULT 3508 COMMENT '页面高度(px)',
    layers_json TEXT COMMENT 'PSD分层模板图层档案JSON（每层URL/名称/位置/尺寸/层叠/不透明度/可见性）',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_template_id (template_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模板页面表';

-- 模板区域表（照片/文字放置区域）
-- v1.5.0：zone_type 扩展 COLOR_BLOCK/DECOR（创意模板预置元素）。存量 MySQL 库需执行：
--   ALTER TABLE template_zones MODIFY COLUMN zone_type ENUM('PHOTO','TEXT','COLOR_BLOCK','DECOR') NOT NULL;
-- v1.6.0 PS 式选择工具箱——区域形状与形状 op 列表。MySQL 5.7 不支持 ADD COLUMN IF NOT EXISTS，
-- 存量库执行前先查 information_schema 确认列不存在：
--   ALTER TABLE template_zones ADD COLUMN shape VARCHAR(20) NOT NULL DEFAULT 'RECT';
--   ALTER TABLE template_zones ADD COLUMN shapes_json TEXT;
CREATE TABLE IF NOT EXISTS template_zones (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    page_id BIGINT NOT NULL COMMENT '页面ID',
    zone_type ENUM('PHOTO', 'TEXT', 'COLOR_BLOCK', 'DECOR') NOT NULL COMMENT '区域类型',
    shape VARCHAR(20) NOT NULL DEFAULT 'RECT' COMMENT '区域形状：RECT/ELLIPSE/POLYGON/COMPOUND',
    shapes_json TEXT COMMENT 'POLYGON/COMPOUND 形状op列表JSON',
    x DOUBLE NOT NULL DEFAULT 0 COMMENT '左上角X（百分比）',
    y DOUBLE NOT NULL DEFAULT 0 COMMENT '左上角Y（百分比）',
    width DOUBLE NOT NULL DEFAULT 0 COMMENT '宽度（百分比）',
    height DOUBLE NOT NULL DEFAULT 0 COMMENT '高度（百分比）',
    rotation DOUBLE DEFAULT 0 COMMENT '旋转角度',
    placeholder_text VARCHAR(200) COMMENT '文字占位',
    sort_order INT DEFAULT 0 COMMENT '排序',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_page_id (page_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模板区域表';

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    template_id BIGINT NOT NULL COMMENT '模板ID',
    title VARCHAR(200) NOT NULL COMMENT '项目名称',
    status ENUM('DRAFT', 'SUBMITTED') NOT NULL DEFAULT 'DRAFT' COMMENT '状态',
    submitted_at DATETIME COMMENT '提交时间',
    h5_url VARCHAR(500) COMMENT 'H5预览URL',
    source_id BIGINT DEFAULT NULL COMMENT '重新编辑溯源根项目ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_user_id (user_id),
    KEY idx_template_id (template_id),
    KEY idx_status (status),
    KEY idx_source_id (source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目表';

-- 项目页面表
CREATE TABLE IF NOT EXISTS project_pages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL COMMENT '项目ID',
    page_number INT NOT NULL COMMENT '页码',
    page_data JSON COMMENT '页面编辑数据（JSON）',
    preview_url VARCHAR(500) COMMENT '预览图URL',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_project_id (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目页面表';

-- 贴纸表
CREATE TABLE IF NOT EXISTS stickers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '贴纸名称',
    category VARCHAR(50) COMMENT '分类',
    image_url VARCHAR(500) NOT NULL COMMENT '贴纸图片URL',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='贴纸表';
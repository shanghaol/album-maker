-- H2 开发数据库初始化脚本
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) DEFAULT NULL,
    username VARCHAR(50) DEFAULT NULL,
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(50) DEFAULT NULL,
    role VARCHAR(10) NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_phone ON users(phone);
CREATE UNIQUE INDEX IF NOT EXISTS uk_username ON users(username);

CREATE TABLE IF NOT EXISTS templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    cover_url VARCHAR(500),
    page_count INT NOT NULL DEFAULT 0,
    category VARCHAR(50) DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 增量迁移：v1.1.0 之前创建的旧库无 category 列（CREATE TABLE IF NOT EXISTS 不会补列）
ALTER TABLE templates ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT NULL;

-- 增量迁移：v1.5.0 创意模板模块——模板类型（ALBUM=相册 / CREATIVE=创意拼贴），存量模板默认 ALBUM
ALTER TABLE templates ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'ALBUM';

-- 增量迁移：v1.5.0 重新编辑溯源（FR-F7）：记录副本的来源项目（NULL=原创）
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_id BIGINT DEFAULT NULL;

-- 增量迁移：v1.5.0 创意区域类型（COLOR_BLOCK/DECOR 共 11 字符，旧列宽 10 不够）
ALTER TABLE template_zones ALTER COLUMN zone_type VARCHAR(20) NOT NULL;

-- 增量迁移：v1.6.0 PS 式选择工具箱——区域形状（RECT/ELLIPSE/POLYGON/COMPOUND）与形状 op 列表
ALTER TABLE template_zones ADD COLUMN IF NOT EXISTS shape VARCHAR(20) NOT NULL DEFAULT 'RECT';
ALTER TABLE template_zones ADD COLUMN IF NOT EXISTS shapes_json TEXT;

CREATE TABLE IF NOT EXISTS template_pages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT NOT NULL,
    page_number INT NOT NULL,
    background_url VARCHAR(500),
    width INT DEFAULT 2480,
    height INT DEFAULT 3508,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 增量迁移：v1.8.0 PSD 分层模板——图层档案（FR-53/D15，layers_json 结构见 SRS 7.10）
ALTER TABLE template_pages ADD COLUMN IF NOT EXISTS layers_json TEXT;

CREATE INDEX IF NOT EXISTS idx_template_pages_tid ON template_pages(template_id);

CREATE TABLE IF NOT EXISTS template_zones (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    page_id BIGINT NOT NULL,
    zone_type VARCHAR(20) NOT NULL,
    x DOUBLE NOT NULL DEFAULT 0,
    y DOUBLE NOT NULL DEFAULT 0,
    width DOUBLE NOT NULL DEFAULT 0,
    height DOUBLE NOT NULL DEFAULT 0,
    rotation DOUBLE DEFAULT 0,
    placeholder_text VARCHAR(200),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_template_zones_pid ON template_zones(page_id);

CREATE TABLE IF NOT EXISTS projects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    template_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    submitted_at TIMESTAMP,
    h5_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_uid ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_tid ON projects(template_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE TABLE IF NOT EXISTS project_pages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    page_number INT NOT NULL,
    page_data TEXT,
    preview_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_pages_pid ON project_pages(project_id);

CREATE TABLE IF NOT EXISTS stickers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    image_url VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stickers_cat ON stickers(category);
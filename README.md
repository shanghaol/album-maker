# 在线相册制作网站（Album Maker）

一个支持模板套用与自由创作的在线相册制作网站：用户上传照片、套用模板区域、编辑装饰与文字后生成可分享的 H5 相册，管理员可管理模板、贴纸、导出任务与用户项目。

## 技术栈

- **后端**：Spring Boot 3 · Spring Security + JWT · MyBatis-Plus · MySQL（本地开发可用 H2）
- **前端**：Vue 3 · Vite · Pinia · Vue Router · Fabric.js（编辑器画布）
- **测试**：JUnit 5（后端）· Vitest（前端）· Node 回归脚本（`api-tests/`）

## 功能概览

- 用户注册 / 登录（手机号 + 密码，JWT 鉴权，登录失败限流）
- 相册编辑器：照片上传、模板区域填充、贴纸 / 文字 / 装饰、撤销重做
- 模板管理：管理员上传模板、页面区域（zone）标注、PSD 分层导入、上下架
- H5 预览与分享、导出任务（异步 zip 导出 + 定时清理）
- 管理后台：数据看板、项目 / 模板 / 贴纸 / 导出管理

## 快速开始

### 后端

```bash
cd backend
# 通过环境变量提供数据库连接（不会把密码写入配置文件）
export DB_USER=album_maker
export DB_PASSWORD=<你的数据库密码>
export JWT_SECRET=<至少32字节的随机密钥>
mvn spring-boot:run
```

- 默认连接 `localhost:3306` 的 MySQL（库 `album_maker`，自动建表）。
- 想用 H2 内存/文件模式做本地开发，激活 `dev` profile（`backend/src/main/resources/application-dev.yml`，无需 MySQL）。

### 前端

```bash
cd frontend
npm install
npm run dev        # 开发服务器，/api 代理到 localhost:8080
npm run test       # Vitest 单元测试
```

## 生产部署要点

1. **环境变量必须覆盖**：`DB_USER`、`DB_PASSWORD`、`JWT_SECRET`（不设置 JWT_SECRET 时仅使用本地开发默认值，生产禁止）。
2. **立即修改默认管理员账号**：首次启动会自动创建默认管理员（`admin/admin123`），生产环境必须在上线前修改。
3. **HTTPS**：全站走 HTTPS，JWT 通过请求头传输。
4. **上传目录**：`app.storage.local.base-path` 指向服务器上的独立目录，并做好备份。
5. **导出清理**：导出产物默认保留 48 小时（`app.export.retention-hours`），定时任务每小时清理超期文件。

## 目录结构

```
backend/                 # Spring Boot 后端
  src/main/java/com/album/   # 控制器 / 服务 / 安全 / 实体
  src/main/resources/        # 配置与建表脚本（schema.sql / schema-h2.sql）
frontend/                # Vue 3 前端
  src/views/                 # 页面（编辑器 / 模板 / 预览 / 管理后台）
  src/components/            # 组件（编辑器工具栏 / 区域面板等）
  src/utils/                 # 引擎与工具（分页数据 / 装饰引擎 / 区域几何）
  src/utils/__tests__/       # Vitest 单元测试
api-tests/               # API 回归与稳定性脚本（node api_regression.mjs）
```

## 安全说明

- 仓库不包含任何真实数据库、密钥、服务器地址；`backend/data/`（本地 H2 数据）与 `backend/uploads/`（用户上传内容）均已忽略。
- 所有敏感配置通过环境变量注入，参见 `backend/src/main/resources/application.yml`。

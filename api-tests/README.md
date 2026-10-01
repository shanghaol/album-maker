# api-tests — 接口自动化回归 / 性能 / 稳定性

零第三方依赖（Node 18+ 内置 fetch/FormData），直接对运行中的后端做黑盒接口测试。

## 前置条件

后端已启动（dev profile，默认 `http://localhost:8080`）：

```bash
cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

需要可用的管理员账号（默认 admin/admin123，仅 dev）。测试会自注册随机手机号用户，结束后自动清理其项目/模板，dev 库中会残留少量测试账号与上传文件（可接受）。

## 用法

```bash
# 功能回归（66 项断言：认证/模板/项目生命周期/文件/管理端/H5/导出 + 历史缺陷回归）
node api_regression.mjs [--base http://localhost:8080] [--report-dir ./results]

# 性能 + 稳定性（延迟基准 N=30 → 并发 10/30/50 → 持续 60s @ c=15 混合读写）
node perf_stability.mjs [--duration 60] [--n 30]
```

退出码：`0` 全部通过；`1` 存在失败；`2` 脚本异常。

## 产物

每次运行写入 `results/`：

| 文件 | 内容 |
|---|---|
| `functional-<时间戳>.json/.md` | 逐项断言结果 + 模块汇总 |
| `perf-stability-<时间戳>.json/.md` | 延迟分位数 / 并发吞吐 / 稳定性漂移 |
| `backend-run.log` | 后端控制台日志（由启动方重定向，用于根因分析） |

## 覆盖清单（39 个端点映射 / 10 个控制器）

- **M0 夹具**：自动创建 CREATIVE 模板（copy 正向流依赖），结束自动删除
- **M1 认证**：注册/重复/弱密码/非法手机号、登录/错误密码、管理员登录/越权、刷新 token、无 token 403、用户访问管理接口 403
- **M2 模板**：列表/类型过滤/详情/404/类型不匹配 400/页面/区域
- **M3 项目**：创建/非法入参/current/列表/详情/越权 403/存页/页码与 64KB 边界/previewUrl 保留(#7)/提交/状态流转/H5 渲染标记/创意 copy 正反向/单草稿约束/删除
- **M4 文件**：真实 PNG/伪图片(#3)/路径越界(#13)/白名单外/无扩展名
- **M5 管理端**：模板 CRUD/分类白名单正负例/封面/页背景/空模板封面 404(#4)/区域/发布/贴纸增删/项目列表与页/导出任务轮询/删除清理
- **M6 H5**：公开预览页 200 + 页面数据标记

## 根因定位速查

见根目录 `API_TEST_REPORT.md` 第 9 节（症状 → 日志签名 → 修复 映射表）。常规流程：

```bash
curl -sv http://localhost:8080/api/... 2>&1 | tail -20     # 1. 复现并留证
grep -E "ERROR|Exception" api-tests/results/backend-run.log # 2. 日志定位
node api_regression.mjs                                     # 3. 修复后回归
```

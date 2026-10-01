/**
 * 接口功能回归测试（批量校验）— 无第三方依赖，Node 18+
 *
 * 覆盖：认证鉴权 / 模板查询 / 项目全生命周期 / 文件上传 / 管理端 / H5 预览 / 导出
 * 含历史缺陷回归：#7 previewUrl 保留、#12 templateId 类型、#14 类型不匹配 400、
 *                #3 魔数校验、#13 路径越界、#4 uploadCover 判空
 *
 * 用法：node api_regression.mjs [--base http://localhost:8080] [--report-dir ./results]
 * 退出码：全部通过 0，存在失败 1
 */
import fs from 'node:fs'
import path from 'node:path'

// ---------- 参数 ----------
const args = process.argv.slice(2)
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const BASE = argOf('--base', 'http://localhost:8080').replace(/\/$/, '')
const REPORT_DIR = argOf('--report-dir', path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'results'))

// ---------- 工具 ----------
const ts = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
const randDigits = n => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('')
const ADMIN = { account: 'admin', password: 'admin123' }
const USER_A = { phone: '138' + randDigits(8), password: 'Test1234', nickname: '接口回归A' }
const USER_B = { phone: '139' + randDigits(8), password: 'Test1234', nickname: '接口回归B' }

// 1x1 PNG（合法魔数与完整结构）
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64')

async function req(method, urlPath, { token, body, form, raw } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined && !form) headers['Content-Type'] = 'application/json'
  const t0 = performance.now()
  const res = await fetch(BASE + urlPath, {
    method,
    headers,
    body: form ? form : body !== undefined ? JSON.stringify(body) : undefined
  })
  const ms = Math.round(performance.now() - t0)
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* 非 JSON（HTML 等） */ }
  return { status: res.status, json, text, ms }
}

// ---------- 结果收集 ----------
const results = []
let passCount = 0, failCount = 0, skipCount = 0

function record(module, name, ok, detail, { skipped = false } = {}) {
  if (skipped) { skipCount++; results.push({ module, name, state: 'SKIP', detail }); return }
  ok ? passCount++ : failCount++
  results.push({ module, name, state: ok ? 'PASS' : 'FAIL', detail })
  console.log(`${ok ? '  ✅' : '  ❌'} [${module}] ${name}${detail && !ok ? ' —— ' + detail : ''}`)
}

const expectStatus = (r, codes) => codes.includes(r.status)

// ---------- 测试流程 ----------
async function main() {
  const st = {}   // 共享状态：token / id 等

  // ============ M1 认证与鉴权 ============
  {
    let r = await req('POST', '/api/auth/register', { body: USER_A })
    record('M1认证', '注册新用户', r.status === 200 && r.json?.code === 200 && !!r.json?.data?.token,
      `HTTP ${r.status} ${r.text.slice(0, 120)}`)
    st.tokenA = r.json?.data?.token

    r = await req('POST', '/api/auth/register', { body: USER_A })
    record('M1认证', '重复注册被拒', expectStatus(r, [400, 409]), `HTTP ${r.status}`)

    r = await req('POST', '/api/auth/register', { body: { ...USER_B, password: 'a12345' } })
    record('M1认证', '弱密码(<8位)被拒', expectStatus(r, [400]), `HTTP ${r.status}`)

    r = await req('POST', '/api/auth/register', { body: { ...USER_B, phone: '12345678901' } })
    record('M1认证', '非法手机号被拒', expectStatus(r, [400]), `HTTP ${r.status}`)

    r = await req('POST', '/api/auth/login', { body: { account: USER_A.phone, password: USER_A.password } })
    record('M1认证', '用户登录', r.status === 200 && !!r.json?.data?.token, `HTTP ${r.status}`)
    st.tokenA = r.json?.data?.token || st.tokenA

    r = await req('POST', '/api/auth/register', { body: USER_B })
    st.tokenB = r.json?.data?.token
    r = await req('POST', '/api/auth/login', { body: { account: USER_B.phone, password: 'Wrong1234' } })
    record('M1认证', '错误密码被拒', expectStatus(r, [400, 401]), `HTTP ${r.status}`)

    r = await req('POST', '/api/auth/admin/login', { body: ADMIN })
    record('M1认证', '管理员登录', r.status === 200 && r.json?.data?.role === 'ADMIN' && !!r.json?.data?.token,
      `HTTP ${r.status} ${r.text.slice(0, 120)}`)
    st.tokenAdmin = r.json?.data?.token

    r = await req('POST', '/api/auth/admin/login', { body: { account: USER_A.phone, password: USER_A.password } })
    record('M1认证', '普通用户登录管理入口被拒', expectStatus(r, [400, 401, 403, 404]), `HTTP ${r.status}`)

    r = await req('POST', '/api/auth/refresh', { token: st.tokenA })
    record('M1认证', '刷新token', r.status === 200 && !!r.json?.data?.token, `HTTP ${r.status}`)

    r = await req('GET', '/api/templates')
    record('M1认证', '无token访问受保护接口→403', expectStatus(r, [401, 403]), `HTTP ${r.status}`)

    r = await req('GET', '/api/admin/templates', { token: st.tokenA })
    record('M1认证', '用户token访问管理接口→403', expectStatus(r, [401, 403]), `HTTP ${r.status}`)
  }

  // ============ M0 夹具：确保存在 CREATIVE 模板（copy 正向流依赖） ============
  {
    let r = await req('POST', '/api/admin/templates', { token: st.tokenAdmin, body: {
      name: `回归夹具-创意-${Date.now()}`, pageCount: 1, type: 'CREATIVE', category: 'minimal',
      pages: [{ pageNumber: 1, width: 1080, height: 1920 }]
    } })
    st.tplCreativeId = r.json?.data?.id
    record('M0夹具', '创建CREATIVE夹具模板', r.status === 200 && !!st.tplCreativeId, `HTTP ${r.status} ${r.text.slice(0, 120)}`)
  }

  // ============ M2 模板查询 ============
  {
    let r = await req('GET', '/api/templates', { token: st.tokenA })
    const all = r.json?.data || []
    record('M2模板', '模板列表', r.status === 200 && Array.isArray(all) && all.length > 0,
      `HTTP ${r.status} count=${all.length}`)
    st.tplAlbum = all.find(t => (t.type || 'ALBUM') === 'ALBUM')
    st.tplCreative = all.find(t => t.type === 'CREATIVE')

    r = await req('GET', '/api/templates?type=ALBUM', { token: st.tokenA })
    const albums = r.json?.data || []
    record('M2模板', 'type=ALBUM 过滤', r.status === 200 && albums.every(t => (t.type || 'ALBUM') === 'ALBUM'),
      `HTTP ${r.status} count=${albums.length}`)

    r = await req('GET', '/api/templates?type=CREATIVE', { token: st.tokenA })
    const creatives = r.json?.data || []
    record('M2模板', 'type=CREATIVE 过滤', r.status === 200 && creatives.every(t => t.type === 'CREATIVE'),
      `HTTP ${r.status} count=${creatives.length}`)

    st.tplId = st.tplAlbum?.id
    r = await req('GET', `/api/templates/${st.tplId}`, { token: st.tokenA })
    record('M2模板', '模板详情', r.status === 200 && r.json?.data?.id === st.tplId, `HTTP ${r.status}`)

    r = await req('GET', '/api/templates/99999999', { token: st.tokenA })
    record('M2模板', '不存在模板→404', expectStatus(r, [404]) || r.json?.code === 404, `HTTP ${r.status} body=${r.text.slice(0, 80)}`)

    r = await req('GET', '/api/templates/abc', { token: st.tokenA })
    record('M2模板', '路径参数类型不匹配→400(#14)', expectStatus(r, [400]), `HTTP ${r.status}`)

    r = await req('GET', `/api/templates/${st.tplId}/pages`, { token: st.tokenA })
    const pages = r.json?.data || []
    record('M2模板', '模板页面列表', r.status === 200 && Array.isArray(pages) && pages.length > 0,
      `HTTP ${r.status} count=${pages.length}`)
    st.tplPageId = pages[0]?.id

    if (st.tplPageId) {
      r = await req('GET', `/api/templates/pages/${st.tplPageId}/zones`, { token: st.tokenA })
      record('M2模板', '模板区域列表', r.status === 200 && Array.isArray(r.json?.data), `HTTP ${r.status}`)
    } else record('M2模板', '模板区域列表', false, '依赖缺失：无 pageId', { skipped: true })
  }

  // ============ M3 项目全生命周期 ============
  {
    let r = await req('POST', '/api/projects', { token: st.tokenA, body: { templateId: st.tplId, title: '接口回归-生命周期' } })
    st.projectId = r.json?.data?.id
    record('M3项目', '创建项目', r.status === 200 && !!st.projectId && r.json?.data?.status === 'DRAFT',
      `HTTP ${r.status} ${r.text.slice(0, 120)}`)

    r = await req('POST', '/api/projects', { token: st.tokenA, body: { templateId: String(st.tplId), title: 'x' } })
    record('M3项目', 'templateId字符串→400(#12)', expectStatus(r, [400]), `HTTP ${r.status}`)

    r = await req('POST', '/api/projects', { token: st.tokenA, body: { templateId: st.tplId } })
    record('M3项目', '缺标题→400', expectStatus(r, [400]), `HTTP ${r.status}`)

    r = await req('GET', '/api/projects/current', { token: st.tokenA })
    record('M3项目', '当前草稿项目', r.status === 200 && !!r.json?.data?.id, `HTTP ${r.status}`)

    r = await req('GET', '/api/projects', { token: st.tokenA })
    record('M3项目', '我的项目列表含新项目', r.status === 200 && (r.json?.data || []).some(p => p.id === st.projectId),
      `HTTP ${r.status}`)

    r = await req('GET', `/api/projects/${st.projectId}`, { token: st.tokenA })
    record('M3项目', '项目详情（所有者）', r.status === 200 && r.json?.data?.id === st.projectId, `HTTP ${r.status}`)

    r = await req('GET', `/api/projects/${st.projectId}`, { token: st.tokenB })
    record('M3项目', '越权访问他人项目→403', expectStatus(r, [403]), `HTTP ${r.status}`)

    r = await req('GET', `/api/projects/${st.projectId}/pages`, { token: st.tokenA })
    record('M3项目', '项目页面列表', r.status === 200 && Array.isArray(r.json?.data), `HTTP ${r.status}`)

    r = await req('GET', '/api/projects/99999999', { token: st.tokenA })
    record('M3项目', '不存在项目→404', expectStatus(r, [404]) || r.json?.code === 404, `HTTP ${r.status}`)

    // savePage：带 previewUrl 保存
    const pageData = JSON.stringify({ canvas: { width: 1080, height: 1920 }, objs: [{ t: 'text', v: 'API-REG-MARKER' }] })
    r = await req('POST', `/api/projects/${st.projectId}/pages`,
      { token: st.tokenA, body: { pageNumber: 1, pageData, previewUrl: '/uploads/photos/api-reg-preview.png' } })
    record('M3项目', '保存页面(带previewUrl)', r.status === 200, `HTTP ${r.status} ${r.text.slice(0, 120)}`)

    r = await req('POST', `/api/projects/${st.projectId}/pages`, { token: st.tokenA, body: { pageNumber: 0, pageData } })
    record('M3项目', 'pageNumber=0→400', expectStatus(r, [400]), `HTTP ${r.status}`)

    r = await req('POST', `/api/projects/${st.projectId}/pages`,
      { token: st.tokenA, body: { pageNumber: 1, pageData: 'x'.repeat(70 * 1024) } })
    record('M3项目', 'pageData>64KB→400', expectStatus(r, [400]), `HTTP ${r.status}`)

    // Bug#7 回归：再次保存不带 previewUrl，页面级 preview_url 应保留（#7 修复位于 project_pages 表）
    r = await req('POST', `/api/projects/${st.projectId}/pages`, { token: st.tokenA, body: { pageNumber: 1, pageData } })
    const rPages = await req('GET', `/api/projects/${st.projectId}/pages`, { token: st.tokenA })
    const page1 = (rPages.json?.data || []).find(p => p.pageNumber === 1)
    record('M3项目', '重复保存不刷掉页面previewUrl(#7)', r.status === 200 && !!page1?.previewUrl,
      `save=${r.status} pagePreviewUrl=${page1?.previewUrl}`)

    r = await req('POST', `/api/projects/${st.projectId}/submit`, { token: st.tokenA, body: {} })
    record('M3项目', '提交项目', r.status === 200, `HTTP ${r.status} ${r.text.slice(0, 120)}`)

    r = await req('GET', `/api/projects/${st.projectId}`, { token: st.tokenA })
    record('M3项目', '提交后状态=SUBMITTED', r.json?.data?.status === 'SUBMITTED', `status=${r.json?.data?.status}`)

    r = await req('GET', `/api/h5/projects/${st.projectId}`)
    record('M6-H5', 'H5预览页渲染', r.status === 200 && /html/i.test(r.text) && r.text.includes('API-REG-MARKER'),
      `HTTP ${r.status} 含标记=${r.text.includes('API-REG-MARKER')}`)

    // 重新编辑仅支持创意作品（设计如此）：相册项目应被拒
    r = await req('POST', `/api/projects/${st.projectId}/copy`, { token: st.tokenA })
    record('M3项目', '相册项目copy被拒(仅创意支持)', expectStatus(r, [400]), `HTTP ${r.status}`)

    // 创意项目正向 copy 流程
    if (st.tplCreativeId) {
      r = await req('POST', '/api/projects', { token: st.tokenA, body: { templateId: st.tplCreativeId, title: '接口回归-创意copy' } })
      const cProjId = r.json?.data?.id
      r = await req('POST', `/api/projects/${cProjId}/submit`, { token: st.tokenA, body: {} })
      r = await req('POST', `/api/projects/${cProjId}/copy`, { token: st.tokenA })
      st.copyId = r.json?.data?.id
      record('M3项目', '重新编辑(已提交创意→新草稿)', r.status === 200 && !!st.copyId && r.json?.data?.status === 'DRAFT',
        `HTTP ${r.status} ${r.text.slice(0, 120)}`)

      // 副本草稿存在期间再次 copy → 单草稿约束 400
      r = await req('POST', `/api/projects/${cProjId}/copy`, { token: st.tokenA })
      record('M3项目', '已有草稿时重复copy被拒(单草稿约束)', expectStatus(r, [400]), `HTTP ${r.status}`)

      if (st.copyId) {
        r = await req('DELETE', `/api/projects/${st.copyId}`, { token: st.tokenA })
        record('M3项目', '删除草稿副本', r.status === 200, `HTTP ${r.status}`)
      }
      st.creativeSubmittedId = cProjId
    } else {
      record('M3项目', '重新编辑(已提交创意→新草稿)', false, '依赖缺失：库中无 CREATIVE 模板', { skipped: true })
    }
  }

  // ============ M4 文件上传 ============
  {
    let form = new FormData()
    form.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 't.png')
    form.append('subDir', 'photos')
    let r = await req('POST', '/api/files/upload', { token: st.tokenA, form })
    st.uploadUrl = r.json?.data
    record('M4文件', '上传真实PNG', r.status === 200 && typeof st.uploadUrl === 'string' && st.uploadUrl.includes('/uploads/'),
      `HTTP ${r.status} ${r.text.slice(0, 120)}`)

    form = new FormData()
    form.append('file', new Blob([Buffer.from('this is not an image at all ........')], { type: 'image/png' }), 'fake.png')
    form.append('subDir', 'photos')
    r = await req('POST', '/api/files/upload', { token: st.tokenA, form })
    record('M4文件', '伪图片内容被拒(#3)', expectStatus(r, [400]), `HTTP ${r.status}`)

    form = new FormData()
    form.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 't.png')
    form.append('subDir', '../hack')
    r = await req('POST', '/api/files/upload', { token: st.tokenA, form })
    record('M4文件', 'subDir路径越界被拒(#13)', expectStatus(r, [400]), `HTTP ${r.status}`)

    form = new FormData()
    form.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 't.png')
    form.append('subDir', 'disallowed')
    r = await req('POST', '/api/files/upload', { token: st.tokenA, form })
    record('M4文件', 'subDir白名单外被拒', expectStatus(r, [400]), `HTTP ${r.status}`)

    form = new FormData()
    form.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 'noext')
    form.append('subDir', 'photos')
    r = await req('POST', '/api/files/upload', { token: st.tokenA, form })
    record('M4文件', '无扩展名被拒', expectStatus(r, [400]), `HTTP ${r.status}`)
  }

  // ============ M5 管理端 ============
  {
    let r = await req('GET', '/api/admin/templates', { token: st.tokenAdmin })
    record('M5管理', '管理端模板列表', r.status === 200 && Array.isArray(r.json?.data), `HTTP ${r.status}`)

    const createBody = {
      name: `接口回归模板-${Date.now()}`, description: '自动化回归创建', pageCount: 2, type: 'ALBUM', category: 'travel',
      pages: [
        { pageNumber: 1, width: 1080, height: 1920, zones: [{ zoneType: 'PHOTO', x: 0.1, y: 0.1, width: 0.8, height: 0.3, sortOrder: 1 }] },
        { pageNumber: 2, width: 1080, height: 1920, zones: [{ zoneType: 'TEXT', x: 0.2, y: 0.6, width: 0.6, height: 0.1, sortOrder: 1 }] }
      ]
    }
    r = await req('POST', '/api/admin/templates', { token: st.tokenAdmin, body: createBody })
    st.newTplId = r.json?.data?.id
    record('M5管理', 'JSON创建模板(2页2zone)', r.status === 200 && !!st.newTplId, `HTTP ${r.status} ${r.text.slice(0, 150)}`)

    if (st.newTplId) {
      r = await req('GET', `/api/templates/${st.newTplId}/pages`, { token: st.tokenA })
      const newPages = r.json?.data || []
      st.newPageId = newPages[0]?.id
      record('M5管理', '新模板页面可查询', r.status === 200 && newPages.length === 2, `HTTP ${r.status} count=${newPages.length}`)

      r = await req('PUT', `/api/admin/templates/${st.newTplId}/category?category=family`, { token: st.tokenAdmin })
      record('M5管理', '更新分类(白名单内)', r.status === 200, `HTTP ${r.status}`)

      r = await req('PUT', `/api/admin/templates/${st.newTplId}/category?category=festival`, { token: st.tokenAdmin })
      record('M5管理', '更新分类(白名单外)→400', expectStatus(r, [400]), `HTTP ${r.status}`)

      const form1 = new FormData()
      form1.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 'cover.png')
      r = await req('POST', `/api/admin/templates/${st.newTplId}/cover`, { token: st.tokenAdmin, form: form1 })
      record('M5管理', '上传封面', r.status === 200 && typeof r.json?.data === 'string', `HTTP ${r.status} ${r.text.slice(0, 120)}`)

      const form2 = new FormData()
      form2.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 'bg.png')
      form2.append('width', '1080'); form2.append('height', '1920')
      r = await req('POST', `/api/admin/templates/${st.newTplId}/pages/1/background`, { token: st.tokenAdmin, form: form2 })
      record('M5管理', '上传页面背景', r.status === 200, `HTTP ${r.status} ${r.text.slice(0, 120)}`)

      const form3 = new FormData()
      form3.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 'cover.png')
      r = await req('POST', '/api/admin/templates/99999999/cover', { token: st.tokenAdmin, form: form3 })
      record('M5管理', '空模板上传封面→404(#4)', expectStatus(r, [404]) || r.json?.code === 404, `HTTP ${r.status}`)

      if (st.newPageId) {
        r = await req('PUT', `/api/admin/templates/pages/${st.newPageId}/zones`,
          { token: st.tokenAdmin, body: [{ zoneType: 'PHOTO', x: 0.05, y: 0.05, width: 0.9, height: 0.4, sortOrder: 1 }] })
        record('M5管理', '保存页面区域', r.status === 200, `HTTP ${r.status}`)
      }

      r = await req('PUT', `/api/admin/templates/${st.newTplId}/publish`, { token: st.tokenAdmin })
      record('M5管理', '发布模板', r.status === 200, `HTTP ${r.status}`)
    }

    r = await req('GET', '/api/admin/stickers', { token: st.tokenAdmin })
    record('M5管理', '贴纸列表', r.status === 200 && Array.isArray(r.json?.data), `HTTP ${r.status}`)

    const formS = new FormData()
    formS.append('name', 'api-reg-sticker'); formS.append('category', 'test')
    formS.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 's.png')
    r = await req('POST', '/api/admin/stickers', { token: st.tokenAdmin, form: formS })
    st.stickerId = r.json?.data?.id
    record('M5管理', '新增贴纸', r.status === 200 && !!st.stickerId, `HTTP ${r.status} ${r.text.slice(0, 120)}`)

    if (st.stickerId) {
      r = await req('DELETE', `/api/admin/stickers/${st.stickerId}`, { token: st.tokenAdmin })
      record('M5管理', '删除贴纸', r.status === 200, `HTTP ${r.status}`)
    }

    r = await req('GET', '/api/admin/projects?status=SUBMITTED', { token: st.tokenAdmin })
    const submitted = r.json?.data || []
    record('M5管理', '管理端项目列表(SUBMITTED)', r.status === 200 && submitted.some(p => p.id === st.projectId),
      `HTTP ${r.status} count=${submitted.length}`)

    r = await req('GET', `/api/admin/projects/${st.projectId}/pages`, { token: st.tokenAdmin })
    record('M5管理', '管理端查看项目页面', r.status === 200 && Array.isArray(r.json?.data), `HTTP ${r.status}`)

    // 导出（异步任务）
    r = await req('POST', '/api/admin/export', { token: st.tokenAdmin, body: { projectIds: [st.projectId] } })
    st.taskId = r.json?.data?.taskId || r.json?.data
    record('M5管理', '发起导出任务', r.status === 200 && !!st.taskId, `HTTP ${r.status} ${r.text.slice(0, 120)}`)

    if (st.taskId) {
      let status = '', polls = 0
      const t0 = Date.now()
      do {
        await new Promise(res => setTimeout(res, 1000))
        r = await req('GET', `/api/admin/export/status/${st.taskId}`, { token: st.tokenAdmin })
        status = typeof r.json?.data === 'string' ? r.json.data : JSON.stringify(r.json?.data)
        polls++
      } while ((status === 'PROCESSING' || status === 'PENDING') && Date.now() - t0 < 60000)
      record('M5管理', '导出任务终态', r.status === 200 && status !== 'PROCESSING' && status !== 'PENDING',
        `终态=${status} 轮询=${polls}次 耗时=${Date.now() - t0}ms`)
    }

    // 管理端删除提交项目（清理）+ 模板清理
    r = await req('DELETE', `/api/admin/projects/${st.projectId}`, { token: st.tokenAdmin })
    record('M5管理', '管理端删除项目', r.status === 200, `HTTP ${r.status}`)

    if (st.creativeSubmittedId) await req('DELETE', `/api/admin/projects/${st.creativeSubmittedId}`, { token: st.tokenAdmin })

    r = await req('GET', `/api/admin/projects/${st.projectId}`, { token: st.tokenAdmin })
    record('M5管理', '删除后查询→404', expectStatus(r, [404]) || r.json?.code === 404, `HTTP ${r.status}`)

    if (st.newTplId) {
      r = await req('DELETE', `/api/admin/templates/${st.newTplId}`, { token: st.tokenAdmin })
      record('M5管理', '删除测试模板(清理)', r.status === 200, `HTTP ${r.status}`)
    }

    if (st.tplCreativeId) {
      r = await req('DELETE', `/api/admin/templates/${st.tplCreativeId}`, { token: st.tokenAdmin })
      record('M5管理', '删除CREATIVE夹具模板(清理)', r.status === 200, `HTTP ${r.status}`)
    }
  }

  // ============ 汇总输出 ============
  const total = passCount + failCount
  const summary = {
    base: BASE, startedAt: ts(), durationSec: Math.round((performance.now() - t0Main) / 1000),
    total, pass: passCount, fail: failCount, skip: skipCount,
    passRate: total ? (passCount / total * 100).toFixed(1) + '%' : 'N/A'
  }
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const stamp = ts()
  fs.writeFileSync(path.join(REPORT_DIR, `functional-${stamp}.json`), JSON.stringify({ summary, results }, null, 2))

  const byMod = {}
  for (const r of results) {
    byMod[r.module] = byMod[r.module] || { pass: 0, fail: 0, skip: 0 }
    byMod[r.module][r.state === 'PASS' ? 'pass' : r.state === 'FAIL' ? 'fail' : 'skip']++
  }
  let md = `# 接口功能回归结果 ${stamp}\n\n总计 ${total} 项：✅ ${passCount} / ❌ ${failCount} / ⏭ ${skipCount}（通过率 ${summary.passRate}）\n\n`
  md += `| 模块 | 通过 | 失败 | 跳过 |\n|---|---|---|---|\n`
  for (const [m, c] of Object.entries(byMod)) md += `| ${m} | ${c.pass} | ${c.fail} | ${c.skip} |\n`
  md += `\n| 状态 | 模块 | 用例 | 说明 |\n|---|---|---|---|\n`
  for (const r of results) md += `| ${r.state} | ${r.module} | ${r.name} | ${String(r.detail || '').slice(0, 160)} |\n`
  fs.writeFileSync(path.join(REPORT_DIR, `functional-${stamp}.md`), md)

  console.log(`\n========== 汇总 ==========`)
  console.log(`总计 ${total} | 通过 ${passCount} | 失败 ${failCount} | 跳过 ${skipCount} | 通过率 ${summary.passRate}`)
  for (const [m, c] of Object.entries(byMod)) console.log(`  ${m}: ✅${c.pass} ❌${c.fail}${c.skip ? ' ⏭' + c.skip : ''}`)
  console.log(`结果已写入 ${REPORT_DIR}/functional-${stamp}.{json,md}`)
  process.exit(failCount > 0 ? 1 : 0)
}

const t0Main = performance.now()
main().catch(e => { console.error('回归脚本异常终止:', e); process.exit(2) })

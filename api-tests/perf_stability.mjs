/**
 * 接口性能与稳定性测试 — 无第三方依赖，Node 18+
 *
 * 阶段1 延迟基准：关键接口串行 N 次采样，输出 avg/p50/p95/max
 * 阶段2 并发压测：10/30/50 三档并发混合读写，输出吞吐/错误率/分位延迟
 * 阶段3 稳定性：持续 D 秒中强度混合负载，观测错误率与延迟漂移（前1/3 vs 后1/3）
 *
 * 用法：node perf_stability.mjs [--base http://localhost:8080] [--n 30] [--duration 60] [--report-dir ./results]
 */
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const BASE = argOf('--base', 'http://localhost:8080').replace(/\/$/, '')
const N = parseInt(argOf('--n', '30'))
const DURATION = parseInt(argOf('--duration', '60'))
const REPORT_DIR = argOf('--report-dir', path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'results'))

const randDigits = n => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('')
const USER = { phone: '137' + randDigits(8), password: 'Test1234', nickname: '性能测试' }
const ADMIN = { account: 'admin', password: 'admin123' }
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

async function req(method, urlPath, { token, body, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined && !form) headers['Content-Type'] = 'application/json'
  const t0 = performance.now()
  let res
  try {
    res = await fetch(BASE + urlPath, { method, headers, body: form ? form : body !== undefined ? JSON.stringify(body) : undefined })
  } catch (e) {
    return { status: 0, ms: Math.round(performance.now() - t0), error: String(e) }
  }
  const ms = Math.round(performance.now() - t0)
  await res.arrayBuffer().catch(() => {})
  return { status: res.status, ms }
}

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))] }
const maxOf = arr => arr.reduce((a, b) => (b > a ? b : a), 0)
const stat = arr => arr.length ? { n: arr.length, avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length), p50: pct(arr, 0.5), p95: pct(arr, 0.95), max: maxOf(arr) } : null

// 并发执行：total 个请求 / duration 秒持续压测（二选一由 workers 内部判断）
async function runLoad({ concurrency, total, durationMs, task }) {
  const latencies = [], errors = [], statuses = {}
  let done = 0
  const t0 = performance.now()
  const deadline = durationMs ? t0 + durationMs : Infinity
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (true) {
      const now = performance.now()
      if (now >= deadline) break
      if (!durationMs && done >= total) break
      done++
      const r = await task()
      latencies.push(r.ms)
      statuses[r.status] = (statuses[r.status] || 0) + 1
      if (r.status >= 400 || r.status === 0) errors.push({ status: r.status, ms: r.ms })
    }
  }))
  const wallMs = Math.round(performance.now() - t0)
  return { latencies, errors, statuses, requests: latencies.length, wallMs, rps: +(latencies.length / (wallMs / 1000)).toFixed(1) }
}

async function main() {
  console.log(`目标: ${BASE}  采样N=${N}  稳定性时长=${DURATION}s`)
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const out = { base: BASE, startedAt: new Date().toISOString(), latency: {}, concurrency: {}, stability: {} }

  // ---- 准备夹具：用户 token / 管理员 token / 模板 / 项目 ----
  console.log('准备测试夹具…')
  await req('POST', '/api/auth/register', { body: USER })
  const loginAs = async (path, body) => JSON.parse(await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.text())).data.token
  const userToken = await loginAs('/api/auth/login', { account: USER.phone, password: USER.password })
  const adminToken = await loginAs('/api/auth/admin/login', ADMIN)

  const tpl = JSON.parse((await fetch(BASE + '/api/templates?type=ALBUM', { headers: { Authorization: `Bearer ${userToken}` } }).then(x => x.text()))).data[0]
  const proj = JSON.parse((await fetch(BASE + '/api/projects', { method: 'POST', headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ templateId: tpl.id, title: '性能测试项目' }) }).then(x => x.text()))).data
  const smallPage = JSON.stringify({ canvas: { width: 1080, height: 1920 }, objs: Array.from({ length: 8 }, (_, i) => ({ t: 'text', v: 'perf-' + i })) })
  await fetch(BASE + `/api/projects/${proj.id}/pages`, { method: 'POST', headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ pageNumber: 1, pageData: smallPage }) })
  console.log(`夹具就绪：模板=${tpl.id} 项目=${proj.id}`)

  const ep = {
    tplList: { m: 'GET', u: '/api/templates', token: userToken, label: 'GET /api/templates' },
    tplPages: { m: 'GET', u: `/api/templates/${tpl.id}/pages`, token: userToken, label: 'GET /api/templates/{id}/pages' },
    projPages: { m: 'GET', u: `/api/projects/${proj.id}/pages`, token: userToken, label: 'GET /api/projects/{id}/pages' },
    h5: { m: 'GET', u: `/api/h5/projects/${proj.id}`, token: null, label: 'GET /api/h5/projects/{id}' },
    savePage: { m: 'POST', u: `/api/projects/${proj.id}/pages`, token: userToken, body: { pageNumber: 1, pageData: smallPage }, label: 'POST /api/projects/{id}/pages' },
    login: { m: 'POST', u: '/api/auth/login', token: null, body: { account: USER.phone, password: USER.password }, label: 'POST /api/auth/login(bcrypt)' }
  }

  // ---- 阶段1 延迟基准 ----
  console.log('\n阶段1 延迟基准（串行采样）')
  for (const [k, e] of Object.entries(ep)) {
    const n = k === 'login' ? Math.min(10, N) : N   // bcrypt 刻意降采样
    const lat = []
    for (let i = 0; i < n; i++) lat.push((await req(e.m, e.u, { token: e.token, body: e.body })).ms)
    out.latency[k] = { label: e.label, ...stat(lat) }
    const s = out.latency[k]
    console.log(`  ${e.label.padEnd(36)} avg=${s.avg}ms p50=${s.p50}ms p95=${s.p95}ms max=${s.max}ms (n=${n})`)
  }

  // ---- 阶段2 并发压测 ----
  const mix = [
    { w: 0.4, e: ep.tplList }, { w: 0.2, e: ep.tplPages }, { w: 0.2, e: ep.projPages },
    { w: 0.1, e: ep.h5 }, { w: 0.1, e: ep.savePage }
  ]
  const pick = () => { let x = Math.random(); for (const it of mix) { x -= it.w; if (x <= 0) return it.e } return mix[0].e }
  console.log('\n阶段2 并发压测（4:2:2:1:1 混合读写）')
  for (const c of [10, 30, 50]) {
    const r = await runLoad({ concurrency: c, total: c * 20, task: () => { const e = pick(); return req(e.m, e.u, { token: e.token, body: e.body }) } })
    out.concurrency[c] = { concurrency: c, ...stat(r.latencies), requests: r.requests, rps: r.rps, errors: r.errors.length, statuses: r.statuses }
    console.log(`  c=${String(c).padEnd(3)} req=${r.requests} rps=${r.rps} p50=${pct(r.latencies, .5)}ms p95=${pct(r.latencies, .95)}ms max=${maxOf(r.latencies)}ms err=${r.errors.length} ${JSON.stringify(r.statuses)}`)
  }

  // ---- 阶段3 稳定性 ----
  console.log(`\n阶段3 稳定性：${DURATION}s @ c=15（读写混合）`)
  const st = await runLoad({ concurrency: 15, durationMs: DURATION * 1000, task: () => { const e = pick(); return req(e.m, e.u, { token: e.token, body: e.body }) } })
  const third = Math.floor(st.latencies.length / 3)
  const firstThird = st.latencies.slice(0, third), lastThird = st.latencies.slice(-third)
  out.stability = {
    durationSec: DURATION, requests: st.requests, rps: st.rps,
    errors: st.errors.length, errorRate: (st.errors.length / st.requests * 100).toFixed(2) + '%',
    overall: stat(st.latencies),
    drift: { firstThirdAvg: Math.round(firstThird.reduce((a, b) => a + b, 0) / firstThird.length), lastThirdAvg: Math.round(lastThird.reduce((a, b) => a + b, 0) / lastThird.length) },
    statuses: st.statuses
  }
  console.log(`  req=${st.requests} rps=${st.rps} err=${st.errors.length}(${out.stability.errorRate}) p50=${pct(st.latencies, .5)}ms p95=${pct(st.latencies, .95)}ms`)
  console.log(`  延迟漂移 前1/3=${out.stability.drift.firstThirdAvg}ms → 后1/3=${out.stability.drift.lastThirdAvg}ms`)

  // ---- 输出 ----
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  fs.writeFileSync(path.join(REPORT_DIR, `perf-stability-${stamp}.json`), JSON.stringify(out, null, 2))
  let md = `# 性能与稳定性测试结果 ${stamp}\n\n## 阶段1 延迟基准\n\n| 接口 | n | avg | p50 | p95 | max |\n|---|---|---|---|---|---|\n`
  for (const s of Object.values(out.latency)) md += `| ${s.label} | ${s.n} | ${s.avg}ms | ${s.p50}ms | ${s.p95}ms | ${s.max}ms |\n`
  md += `\n## 阶段2 并发压测\n\n| 并发 | 请求数 | RPS | p50 | p95 | max | 错误 | 状态分布 |\n|---|---|---|---|---|---|---|---|\n`
  for (const [c, s] of Object.entries(out.concurrency)) md += `| ${c} | ${s.requests} | ${s.rps} | ${s.p50}ms | ${s.p95}ms | ${s.max}ms | ${s.errors} | \`${JSON.stringify(s.statuses)}\` |\n`
  const s = out.stability
  md += `\n## 阶段3 稳定性（${s.durationSec}s @ c=15）\n\n- 请求 ${s.requests}，RPS ${s.rps}，错误 ${s.errors}（${s.errorRate}）\n- p50=${s.overall.p50}ms p95=${s.overall.p95}ms max=${s.overall.max}ms\n- 延迟漂移：前1/3 ${s.drift.firstThirdAvg}ms → 后1/3 ${s.drift.lastThirdAvg}ms\n- 状态分布 \`${JSON.stringify(s.statuses)}\`\n`
  fs.writeFileSync(path.join(REPORT_DIR, `perf-stability-${stamp}.md`), md)
  console.log(`\n结果已写入 ${REPORT_DIR}/perf-stability-${stamp}.{json,md}`)
}

main().catch(e => { console.error('性能脚本异常终止:', e); process.exit(2) })

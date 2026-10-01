<template>
  <div class="min-h-screen bg-app-bg text-app-text pb-24">
    <header class="prof-header">
      <div class="prof-header-inner">
        <h1 class="prof-title">个人中心</h1>
        <div class="prof-spacer" />
      </div>
    </header>

    <div class="prof-content">
      <div class="prof-avatar-sect">
        <div class="prof-avatar">
          <span class="prof-avatar-text">{{ initial }}</span>
        </div>
        <h2 class="prof-nickname">{{ authStore.user?.nickname || '用户' }}</h2>
        <p class="prof-phone">{{ authStore.user?.phone || '未绑定手机号' }}</p>
      </div>

      <div v-if="statsLoaded" class="prof-stats">
        <div class="prof-stat-card">
          <p class="prof-stat-value">{{ stats.total }}</p>
          <p class="prof-stat-label">作品总数</p>
        </div>
        <div class="prof-stat-card">
          <p class="prof-stat-value prof-stat-value--amber">{{ stats.draft }}</p>
          <p class="prof-stat-label">草稿</p>
        </div>
        <div class="prof-stat-card">
          <p class="prof-stat-value prof-stat-value--emerald">{{ stats.submitted }}</p>
          <p class="prof-stat-label">已发布</p>
        </div>
      </div>

      <!-- 作品网格（原"我的项目"并入，抖音主页式） -->
      <div class="works-section">
        <div class="works-tabs-row">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            @click="statusFilter = tab.value"
            class="works-tab"
            :class="{ 'works-tab--active': statusFilter === tab.value }"
          >
            {{ tab.label }}
          </button>
        </div>

        <div v-if="loading" class="works-grid">
          <div v-for="i in 4" :key="'skel-'+i" class="works-skeleton" />
        </div>

        <div v-else-if="filteredProjects.length === 0 && visibleWcDrafts.length === 0" class="works-empty">
          <FolderOpen :size="40" class="works-empty-icon" />
          <p class="works-empty-text">{{ emptyText }}</p>
          <div class="works-empty-actions">
            <button @click="$router.push('/templates')" class="works-empty-btn">去模板市场</button>
            <button @click="$router.push('/creative')" class="works-empty-btn works-empty-btn--accent">去创意模板</button>
          </div>
        </div>

        <div v-else class="works-grid">
          <!-- colorblocking 拼贴草稿（本地草稿箱） -->
          <div
            v-for="d in visibleWcDrafts"
            :key="d.id"
            class="work-card"
            @click="openWcDraft(d)"
          >
            <div class="work-card-cover">
              <img v-if="d.thumb" :src="d.thumb" class="work-card-img" />
              <div v-else class="work-card-placeholder">
                <Sparkles :size="26" class="work-card-placeholder-icon" />
              </div>
              <span class="work-card-badge work-card-badge--draft">colorblocking</span>
            </div>
            <div class="work-card-body">
              <p class="work-card-title">{{ d.name }}</p>
              <div class="work-card-footer">
                <span class="work-card-date">{{ formatDate(d.savedAt) }}</span>
                <div class="work-card-actions">
                  <button
                    class="work-card-act work-card-del"
                    title="删除草稿"
                    @click.stop="deleteWcDraft(d.id)"
                  >
                    <Trash2 :size="13" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div
            v-for="p in filteredProjects"
            :key="p.id"
            class="work-card"
            @click="openProject(p)"
          >
            <div class="work-card-cover">
              <img v-if="p.previewUrl" :src="p.previewUrl" class="work-card-img" />
              <div v-else class="work-card-placeholder">
                <Images :size="26" class="work-card-placeholder-icon" />
              </div>
              <span v-if="p.status === 'DRAFT'" class="work-card-badge work-card-badge--draft">草稿</span>
            </div>
            <div class="work-card-body">
              <p class="work-card-title">{{ p.title }}</p>
              <div class="work-card-footer">
                <span class="work-card-date">{{ formatDate(p.submittedAt || p.createdAt) }}</span>
                <div class="work-card-actions">
                  <button
                    v-if="p.status === 'SUBMITTED'"
                    class="work-card-act"
                    title="复制分享链接"
                    @click.stop="copyShareLink(p)"
                  >
                    <Link2 :size="13" />
                  </button>
                  <button
                    v-if="p.status === 'SUBMITTED' && p.templateType === 'CREATIVE'"
                    class="work-card-act"
                    title="重新编辑"
                    @click.stop="reedit(p)"
                  >
                    <Pencil :size="13" />
                  </button>
                  <button
                    v-if="p.status === 'DRAFT'"
                    class="work-card-act work-card-del"
                    title="删除草稿"
                    @click.stop="abandon(p.id)"
                  >
                    <Trash2 :size="13" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="prof-logout-area">
        <button @click="handleLogout" class="prof-logout-btn">
          <div class="prof-logout-btn-left">
            <LogOut :size="20" class="prof-logout-icon" />
            <span class="prof-logout-label">退出登录</span>
          </div>
          <ChevronRight :size="18" class="prof-logout-arrow" />
        </button>
      </div>
    </div>
    <BottomNav />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getProjects, abandonProject, copyProject } from '@/api/project'
import { FolderOpen, Images, LogOut, ChevronRight, Trash2, Link2, Pencil, Sparkles } from '@lucide/vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BottomNav from '@/components/BottomNav.vue'
import { listDrafts, deleteDraft } from '@/utils/colorblocking/drafts'

const router = useRouter()
const authStore = useAuthStore()
const projects = ref([])
const loading = ref(true)
const statusFilter = ref('all')
const statsLoaded = ref(false)
const stats = reactive({ total: 0, draft: 0, submitted: 0 })

const tabs = [
  { label: '作品', value: 'SUBMITTED' },
  { label: '草稿', value: 'DRAFT' },
  { label: '全部', value: 'all' }
]

const initial = computed(() => {
  const name = authStore.user?.nickname || '用'
  return name.charAt(0).toUpperCase()
})

const filteredProjects = computed(() => {
  let list = projects.value
  if (statusFilter.value !== 'all') list = list.filter(p => p.status === statusFilter.value)
  // FR-F7 版本归并：同一溯源链（重新编辑副本）的已提交作品只展示最新一次提交；草稿不受影响
  const latestByLineage = {}
  list.forEach(p => {
    if (p.status !== 'SUBMITTED') return
    const key = p.sourceId || p.id
    const cur = latestByLineage[key]
    if (!cur || new Date(p.submittedAt || 0) > new Date(cur.submittedAt || 0)) latestByLineage[key] = p
  })
  return list.filter(p => {
    if (p.status === 'DRAFT') return true
    const latest = latestByLineage[p.sourceId || p.id]
    return !latest || latest.id === p.id
  })
})

// colorblocking 拼贴草稿（本地草稿箱），在"全部/草稿"页签下展示
const wcDrafts = ref([])
const visibleWcDrafts = computed(() => {
  if (statusFilter.value === 'SUBMITTED') return []
  return wcDrafts.value
})
function refreshWcDrafts() {
  wcDrafts.value = listDrafts()
}
function openWcDraft(d) {
  router.push({ path: '/colorblocking', query: { draft: d.id } })
}
function deleteWcDraft(id) {
  ElMessageBox.confirm('确定要删除该拼贴草稿吗？此操作不可恢复。', '提示', { type: 'warning' })
    .then(() => {
      deleteDraft(id)
      ElMessage.success('已删除')
      refreshWcDrafts()
      refreshStats()
    })
    .catch(() => {})
}

const emptyText = computed(() => {
  if (statusFilter.value === 'DRAFT') return '暂无草稿'
  if (statusFilter.value === 'SUBMITTED') return '暂无作品'
  return '还没有作品'
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

// 点击行为：已提交→H5 预览；草稿→继续编辑（需求 FR-F4）
function openProject(p) {
  if (p.status === 'DRAFT') {
    // 按模板类型分流：创意→创意编辑器，相册→相册编辑器
    const base = p.templateType === 'CREATIVE' ? '/creative-editor' : '/editor'
    router.push(`${base}/${p.id}`)
  } else {
    router.push(`/preview/${p.id}`)
  }
}

async function reedit(p) {
  try {
    const res = await copyProject(p.id)
    ElMessage.success('已创建编辑副本')
    const base = p.templateType === 'CREATIVE' ? '/creative-editor' : '/editor'
    router.push(`${base}/${res.data.data.id}`)
  } catch (e) {
    console.error('[Profile] 重新编辑失败:', e)
  }
}

// 复制公开 H5 分享链接（需求 FR-E1）
async function copyShareLink(p) {
  const url = `${location.origin}/api/h5/projects/${p.id}`
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('分享链接已复制')
  } catch {
    // 剪贴板不可用时的降级
    const input = document.createElement('input')
    input.value = url
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    ElMessage.success('分享链接已复制')
  }
}

async function abandon(id) {
  try {
    await ElMessageBox.confirm('确定要放弃该草稿吗？此操作不可恢复。', '提示', { type: 'warning' })
    await abandonProject(id)
    ElMessage.success('已放弃')
    projects.value = projects.value.filter(p => p.id !== id)
    refreshStats()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('[Profile] 放弃草稿失败:', e)
      ElMessage.error('操作失败，请重试')
    }
  }
}

function refreshStats() {
  stats.total = projects.value.length + wcDrafts.value.length
  stats.draft = projects.value.filter(p => p.status === 'DRAFT').length + wcDrafts.value.length
  stats.submitted = projects.value.filter(p => p.status === 'SUBMITTED').length
}

onMounted(async () => {
  refreshWcDrafts()
  try {
    const res = await getProjects()
    projects.value = res.data.data || []
    refreshStats()
    statsLoaded.value = true
  } catch (e) {
    console.error('[Profile] 加载作品列表失败:', e)
    ElMessage.error('加载作品列表失败，请刷新重试')
  } finally {
    loading.value = false
  }
})

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning'
    })
    authStore.logout()
    router.push('/login')
  } catch {
    // user cancelled
  }
}
</script>

<style scoped>
/* ---- Header（保持原有样式） ---- */
.prof-header {
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  background: rgba(245, 245, 247, 0.72);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.prof-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 16px;
  max-width: 1536px;
  margin: 0 auto;
}

.prof-title {
  font-size: 17px;
  font-weight: 600;
  color: #1d1d1f;
  letter-spacing: -0.02em;
}

.prof-spacer {
  width: 24px;
}

@media (min-width: 768px) {
  .prof-header-inner {
    height: 64px;
    padding: 0 32px;
  }
}

/* ---- Content ---- */
.prof-content {
  max-width: 448px;
  margin: 0 auto;
  padding: 32px 16px 96px;
}

/* ---- Avatar（保持原有样式） ---- */
.prof-avatar-sect {
  text-align: center;
  margin-bottom: 28px;
}

.prof-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
}

.prof-avatar-text {
  font-size: 32px;
  color: #fff;
  font-weight: 700;
}

.prof-nickname {
  font-size: 20px;
  font-weight: 600;
  color: #1d1d1f;
}

.prof-phone {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.4);
  margin-top: 4px;
}

/* ---- Stats（保持原有样式，文案改作品） ---- */
.prof-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 28px;
}

.prof-stat-card {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.45) 100%);
  backdrop-filter: blur(28px) saturate(200%);
  -webkit-backdrop-filter: blur(28px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 14px;
  padding: 14px 10px;
  text-align: center;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.08),
    inset 0 1px 1px rgba(255, 255, 255, 0.8),
    inset 0 -1px 1px rgba(0, 0, 0, 0.04);
}

.prof-stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #1d1d1f;
}

.prof-stat-value--amber {
  color: #d97706;
}

.prof-stat-value--emerald {
  color: #059669;
}

.prof-stat-label {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.4);
  margin-top: 4px;
}

/* ---- Works Section（作品网格，原 MyProjects 能力） ---- */
.works-section {
  margin-bottom: 24px;
}

.works-tabs-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.works-tab {
  border-radius: 999px;
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  border: 1px solid rgba(255, 255, 255, 0.55);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.62) 0%, rgba(255, 255, 255, 0.36) 100%);
  backdrop-filter: blur(28px) saturate(200%);
  -webkit-backdrop-filter: blur(28px) saturate(200%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.8);
  color: rgba(29, 29, 31, 0.5);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.works-tab:hover {
  color: #1d1d1f;
  transform: translateY(-1px);
}

.works-tab--active {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.6) 100%);
  color: #6366f1;
  border-color: rgba(255, 255, 255, 0.7);
  font-weight: 600;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  box-shadow: 0 1px 3px rgba(99, 102, 241, 0.25);
}

.works-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.works-skeleton {
  min-height: 150px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.04);
  animation: works-pulse 1.5s ease-in-out infinite;
}

@keyframes works-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.work-card {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.45) 100%);
  backdrop-filter: blur(28px) saturate(200%);
  -webkit-backdrop-filter: blur(28px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
  box-shadow:
    0 10px 32px rgba(0, 0, 0, 0.10),
    0 2px 6px rgba(0, 0, 0, 0.05),
    inset 0 1px 1px rgba(255, 255, 255, 0.8),
    inset 0 -1px 1px rgba(0, 0, 0, 0.04);
}
.work-card:active {
  transform: scale(0.96);
  transition: transform 0.1s ease;
}

.work-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.work-card:active {
  transform: scale(0.97);
}

.work-card-cover {
  position: relative;
  background: #f5f5f7;
  aspect-ratio: 3 / 4;
  overflow: hidden;
}

.work-card-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.work-card-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #eef2ff, #f3e8ff);
  display: flex;
  align-items: center;
  justify-content: center;
}

.work-card-placeholder-icon {
  color: rgba(99, 102, 241, 0.2);
}

.work-card-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 600;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.work-card-badge--draft {
  background: rgba(251, 243, 219, 0.9);
  color: #b45309;
  border: 0.5px solid rgba(245, 158, 11, 0.35);
}

.work-card-body {
  padding: 8px 10px 10px;
}

.work-card-title {
  font-size: 12px;
  font-weight: 600;
  color: #1d1d1f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.work-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.work-card-actions {
  display: flex;
  gap: 4px;
}

.work-card-act {
  border: none;
  background: rgba(99, 102, 241, 0.08);
  color: #6366f1;
  cursor: pointer;
  padding: 3px;
  display: flex;
  border-radius: 6px;
  transition: background 0.15s ease, transform 0.12s ease;
}

.work-card-act:hover {
  background: rgba(99, 102, 241, 0.16);
  transform: scale(1.1);
}

.work-card-date {
  font-size: 10px;
  color: rgba(0, 0, 0, 0.35);
}

.work-card-del {
  border: none;
  background: none;
  color: rgba(239, 68, 68, 0.55);
  cursor: pointer;
  padding: 2px;
  display: flex;
  transition: color 0.15s ease, transform 0.12s ease;
}

.work-card-del:hover {
  color: #ef4444;
  transform: scale(1.1);
}

/* ---- Empty State ---- */
.works-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0;
}

.works-empty-icon {
  color: rgba(0, 0, 0, 0.15);
  margin-bottom: 12px;
}

.works-empty-text {
  color: rgba(0, 0, 0, 0.35);
  font-size: 13px;
  margin-bottom: 14px;
}

.works-empty-actions {
  display: flex;
  gap: 10px;
}

.works-empty-btn {
  padding: 9px 18px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.62) 0%, rgba(255, 255, 255, 0.36) 100%);
  backdrop-filter: blur(28px) saturate(200%);
  -webkit-backdrop-filter: blur(28px) saturate(200%);
  color: #1d1d1f;
  border: 1px solid rgba(255, 255, 255, 0.55);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.10), inset 0 1px 1px rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.works-empty-btn:hover {
  transform: translateY(-1px);
  color: #1d1d1f;
  border-color: rgba(255, 255, 255, 0.75);
}

.works-empty-btn--accent {
  background: linear-gradient(180deg, rgba(99, 102, 241, 0.88) 0%, rgba(99, 102, 241, 0.68) 100%);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.28), inset 0 1px 1px rgba(255, 255, 255, 0.45);
}
.works-empty-btn--accent:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.55);
}

/* ---- Logout（保持原有样式） ---- */
.prof-logout-area {
  margin-top: 8px;
}

.prof-logout-btn {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.45) 100%);
  backdrop-filter: blur(28px) saturate(200%);
  -webkit-backdrop-filter: blur(28px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 12px;
  padding: 14px 18px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.prof-logout-btn:hover {
  border-color: rgba(239, 68, 68, 0.2);
  background: #fef2f2;
}

.prof-logout-btn-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.prof-logout-icon {
  color: #ef4444;
}

.prof-logout-label {
  font-size: 14px;
  font-weight: 500;
  color: #ef4444;
}

.prof-logout-arrow {
  color: rgba(0, 0, 0, 0.15);
}

/* ---- Responsive ---- */
@media (min-width: 768px) {
  .prof-content {
    max-width: 720px;
    padding: 48px 32px 96px;
  }

  .works-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
  }
}

@media (max-width: 768px) {
  .prof-header {
    padding-top: env(safe-area-inset-top, 0px);
    background: rgba(248, 248, 248, 0.72);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border-bottom: 0.5px solid rgba(0, 0, 0, 0.12);
    animation: prof-header-in 0.4s cubic-bezier(0.32, 0.72, 0, 1);
  }

  @keyframes prof-header-in {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .prof-content {
    padding: 24px 16px calc(120px + env(safe-area-inset-bottom, 0px));
  }

  .prof-avatar-sect {
    margin-bottom: 24px;
  }

  .prof-stats {
    gap: 8px;
  }

  .prof-stat-card,
  .works-tab,
  .work-card,
  .prof-logout-btn {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 0.5px solid rgba(0, 0, 0, 0.06);
  }

  .prof-stat-card {
    border-radius: 14px;
  }

  .works-tab {
    border-radius: 10px;
    padding: 7px 18px;
    font-size: 13px;
    background: rgba(0, 0, 0, 0.03);
    transition: transform 0.12s cubic-bezier(0.32, 0.72, 0, 1), background 0.15s ease;
  }

  .works-tab:active {
    transform: scale(0.95);
  }

  .work-card {
    border-radius: 14px;
    transition: transform 0.12s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .work-card:hover {
    transform: none;
  }
}
</style>

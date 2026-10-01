<template>
  <div class="dashboard">
    <div class="dashboard-hero">
      <div class="hero-left">
        <h2 class="hero-title">工作台</h2>
        <p class="hero-sub">欢迎回来，{{ authStore.user?.nickname || '管理员' }}</p>
      </div>
      <div class="hero-actions">
        <router-link to="/admin/templates" class="hero-action-card">
          <div class="hero-action-icon" style="background: rgba(99, 102, 241, 0.12);">
            <Plus :size="18" :stroke-width="2" color="#818cf8" />
          </div>
          <span>创建模板</span>
        </router-link>
        <router-link to="/admin/stickers" class="hero-action-card">
          <div class="hero-action-icon" style="background: rgba(245, 158, 11, 0.12);">
            <Upload :size="18" :stroke-width="2" color="#fbbf24" />
          </div>
          <span>上传贴纸</span>
        </router-link>
        <router-link to="/admin/export" class="hero-action-card">
          <div class="hero-action-icon" style="background: rgba(59, 130, 246, 0.12);">
            <Download :size="18" :stroke-width="2" color="#60a5fa" />
          </div>
          <span>导出素材</span>
        </router-link>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card stat-card--primary" v-for="(item, idx) in statItems" :key="item.label" :style="{ animationDelay: `${idx * 100}ms` }">
        <div class="stat-card-top">
          <div class="stat-icon-wrap" :style="{ background: item.bgColor }">
            <component :is="item.icon" :size="20" :stroke-width="1.5" :color="item.iconColor" />
          </div>
          <div class="stat-trend" v-if="item.trend" :class="item.trend > 0 ? 'trend-up' : 'trend-down'">
            <TrendingUp v-if="item.trend > 0" :size="12" />
            <TrendingDown v-else :size="12" />
            <span>{{ Math.abs(item.trend) }}%</span>
          </div>
        </div>
        <span class="stat-value">{{ item.displayValue }}</span>
        <span class="stat-label">{{ item.label }}</span>
        <div class="stat-card-bar" :style="{ background: item.barColor }"></div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="dashboard-card dashboard-card--large">
        <div class="card-header">
          <h3>最近活动</h3>
        </div>
        <div class="card-body">
          <div class="activity-list">
            <div class="activity-item" v-for="(act, i) in activities" :key="i">
              <div class="activity-dot" :style="{ background: act.color }"></div>
              <div class="activity-content">
                <span class="activity-text">{{ act.text }}</span>
                <span class="activity-time">{{ act.time }}</span>
              </div>
            </div>
            <div v-if="activities.length === 0" class="activity-empty">
              <Activity :size="32" class="activity-empty-icon" />
              <span>暂无活动记录</span>
            </div>
          </div>
        </div>
      </div>
      <div class="dashboard-card">
        <div class="card-header">
          <h3>快捷统计</h3>
        </div>
        <div class="card-body">
          <div class="quick-stats">
            <div class="quick-stat">
              <div class="quick-stat-ring">
                <svg viewBox="0 0 36 36" class="ring-svg">
                  <path class="ring-bg" d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path class="ring-fill" :stroke-dasharray="`${Math.min(templatePct, 100)}, 100`" d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <span class="ring-label">{{ templatePct }}%</span>
              </div>
              <span class="quick-stat-label">已发布模板</span>
            </div>
            <div class="quick-stat">
              <div class="quick-stat-ring">
                <svg viewBox="0 0 36 36" class="ring-svg">
                  <path class="ring-bg" d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path class="ring-fill ring-fill--amber" :stroke-dasharray="`${Math.min(projectPct, 100)}, 100`" d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <span class="ring-label">{{ projectPct }}%</span>
              </div>
              <span class="quick-stat-label">项目活跃度</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getAdminTemplates } from '@/api/template'
import { getAdminProjects } from '@/api/project'
import { getAdminStickers } from '@/api/sticker'
import { LayoutGrid, FolderOpen, Sticker, Plus, Upload, Download, TrendingUp, TrendingDown, Activity } from '@lucide/vue'

const authStore = useAuthStore()

const stats = ref({
  templateCount: 0,
  projectCount: 0,
  stickerCount: 0,
  publishedCount: 0,
  submittedCount: 0
})

const activities = ref([
  { text: '系统已就绪，等待操作', time: '刚刚', color: '#6366f1' }
])

const statItems = ref([
  { label: '模板总数', displayValue: 0, value: 0, icon: LayoutGrid, bgColor: 'rgba(99, 102, 241, 0.12)', iconColor: '#818cf8', barColor: 'linear-gradient(90deg, #818cf8, #6366f1)', trend: null },
  { label: '已提交项目', displayValue: 0, value: 0, icon: FolderOpen, bgColor: 'rgba(245, 158, 11, 0.12)', iconColor: '#fbbf24', barColor: 'linear-gradient(90deg, #fbbf24, #f59e0b)', trend: null },
  { label: '贴纸数量', displayValue: 0, value: 0, icon: Sticker, bgColor: 'rgba(236, 72, 153, 0.12)', iconColor: '#f472b6', barColor: 'linear-gradient(90deg, #f472b6, #ec4899)', trend: null }
])

const templatePct = ref(0)
const projectPct = ref(0)

function formatNumber(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

onMounted(async () => {
  let total = 0
  // 三类统计并行请求，缩短仪表盘首屏等待
  const [tplRes, projRes, stickerRes] = await Promise.allSettled([
    getAdminTemplates(),
    getAdminProjects(),
    getAdminStickers()
  ])
  if (tplRes.status === 'fulfilled') {
    const tpls = tplRes.value.data.data || []
    const count = tpls.length
    stats.value.templateCount = count
    stats.value.publishedCount = tpls.filter(t => t.status === 'PUBLISHED').length
    statItems.value[0].value = count
    statItems.value[0].displayValue = formatNumber(count)
    total = count
  }
  if (projRes.status === 'fulfilled') {
    const projs = projRes.value.data.data || []
    const count = projs.length
    stats.value.projectCount = count
    stats.value.submittedCount = projs.filter(p => p.status === 'SUBMITTED').length
    statItems.value[1].value = count
    statItems.value[1].displayValue = formatNumber(count)
  }
  if (stickerRes.status === 'fulfilled') {
    const count = (stickerRes.value.data.data || []).length
    stats.value.stickerCount = count
    statItems.value[2].value = count
    statItems.value[2].displayValue = formatNumber(count)
  }

  templatePct.value = total > 0 ? Math.round((stats.value.publishedCount / total) * 100) : 0
  // 真实提交率（修复：此前为 Math.random() 假数据）
  projectPct.value = stats.value.projectCount > 0
    ? Math.round((stats.value.submittedCount / stats.value.projectCount) * 100)
    : 0
})
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
  animation: fadeUp 0.5s ease-out;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ---- Hero ---- */
.dashboard-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 36px;
}

.hero-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.hero-sub {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.4);
  margin-top: 6px;
}

.hero-actions {
  display: flex;
  gap: 12px;
}

.hero-action-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 14px;
  text-decoration: none;
  color: rgba(0, 0, 0, 0.6);
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s ease;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.hero-action-card:hover {
  border-color: rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  color: #1a1a2e;
}

.hero-action-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ---- Stats Grid：移动1列 / 平板2列 / 桌面3列 ---- */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 36px;
}

@media (min-width: 640px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}

@media (min-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
}

.stat-card {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 20px;
  padding: 24px;
  position: relative;
  overflow: hidden;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: default;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  animation: fadeUp 0.5s ease-out both;
}

.stat-card:hover {
  border-color: rgba(0, 0, 0, 0.1);
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}

.stat-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.stat-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
}

.trend-up {
  color: #10b981;
  background: rgba(16, 185, 129, 0.08);
}

.trend-down {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}

.stat-value {
  display: block;
  font-size: 34px;
  font-weight: 800;
  color: #1a1a2e;
  letter-spacing: -0.03em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  display: block;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.4);
  margin-top: 8px;
  font-weight: 500;
}

.stat-card-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 0 0 20px 20px;
  opacity: 0.3;
}

/* ---- Dashboard Grid ---- */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 20px;
}

.dashboard-card {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.card-header {
  padding: 20px 24px 0;
}

.card-header h3 {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a2e;
}

.card-body {
  padding: 20px 24px;
}

/* ---- Activity List ---- */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.activity-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}

.activity-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.activity-text {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.7);
  font-weight: 500;
}

.activity-time {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.3);
}

.activity-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 0;
  color: rgba(0, 0, 0, 0.25);
  font-size: 13px;
}

.activity-empty-icon {
  opacity: 0.3;
}

/* ---- Quick Stats Rings ---- */
.quick-stats {
  display: flex;
  justify-content: space-around;
  padding: 8px 0;
}

.quick-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.quick-stat-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.4);
  font-weight: 500;
}

.quick-stat-ring {
  position: relative;
  width: 72px;
  height: 72px;
}

.ring-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-bg {
  fill: none;
  stroke: rgba(0, 0, 0, 0.06);
  stroke-width: 3;
}

.ring-fill {
  fill: none;
  stroke: #6366f1;
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dasharray 1s ease;
}

.ring-fill--amber {
  stroke: #f59e0b;
}

.ring-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #1a1a2e;
}

/* ---- Tablet ---- */
@media (max-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-hero {
    flex-direction: column;
  }

  .hero-actions {
    width: 100%;
  }

  .hero-action-card {
    flex: 1;
    justify-content: center;
  }
}

/* ---- Mobile ---- */
@media (max-width: 768px) {
  .hero-title {
    font-size: 24px;
  }

  .hero-actions {
    flex-wrap: wrap;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-card {
    padding: 18px;
    border-radius: 16px;
  }

  .stat-value {
    font-size: 28px;
  }

  .stat-icon-wrap {
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }

  .dashboard-card {
    border-radius: 16px;
  }
}
</style>
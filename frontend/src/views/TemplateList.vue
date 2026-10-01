<template>
  <div class="min-h-screen bg-app-bg text-app-text pb-20">
    <header class="tmpl-header">
      <div class="tmpl-header-inner">
        <div class="tmpl-category" @click="showCategoryPicker = true">
          <span class="tmpl-category-label">{{ activeCategoryLabel }}</span>
          <ChevronDown :size="18" class="text-app-text-muted" />
        </div>
        <button @click="$router.push('/my-projects')" class="tmpl-projects-btn">
          <FolderOpen :size="22" />
        </button>
      </div>
    </header>

    <div class="tmpl-content">
      <div class="template-grid-header">
        <h1 class="grid-heading">选择模板</h1>
        <p class="grid-subheading">选择一个模板开始创建你的相册</p>
      </div>

      <div v-if="loading" class="template-grid">
        <div v-for="i in 8" :key="'skel-'+i" class="skeleton-card" />
      </div>

      <div v-else-if="filteredTemplates.length === 0" class="empty-state">
        <Images :size="48" class="empty-icon" />
        <p>暂无可用模板</p>
      </div>

      <div v-else class="template-grid">
        <div
          v-for="(tpl, index) in filteredTemplates"
          :key="tpl.id"
          class="template-card stagger-enter"
          :class="{ 'stagger-enter-active': visible }"
          :style="{ transitionDelay: `${100 + index * 80}ms` }"
          @click="selectTemplate(tpl)"
        >
          <div class="template-card-image">
            <img
              v-if="tpl.coverUrl"
              :src="tpl.coverUrl"
              class="template-card-img"
            />
            <div v-else class="template-card-placeholder">
              <Images :size="32" class="placeholder-icon" />
            </div>
            <div class="template-card-overlay">
              <span class="overlay-cta">选择此模板</span>
            </div>
            <div class="template-card-badge">
              <span>{{ tpl.pageCount }} 页</span>
            </div>
          </div>
          <div class="template-card-body">
            <h3 class="template-card-name">{{ tpl.name }}</h3>
            <span class="template-card-category">{{ categoryLabel(tpl.category) }}</span>
          </div>
        </div>
      </div>
    </div>

    <Transition name="category-drop">
      <div v-if="showCategoryPicker" class="category-dropdown-mask" @click.self="showCategoryPicker = false">
        <div class="category-dropdown-panel">
          <h3 class="category-dropdown-title">选择模板分类</h3>
          <div class="category-dropdown-list">
            <button
              v-for="cat in categories"
              :key="cat.value"
              @click="selectCategory(cat.value)"
            class="category-dropdown-item"
            :class="{ 'category-dropdown-item--active': activeCategory === cat.value }"
          >
            <span>{{ cat.label }}</span>
            <Check v-if="activeCategory === cat.value" :size="18" class="text-indigo-500" />
          </button>
        </div>
      </div>
    </div>
    </Transition>

    <!-- 模板预览弹窗：点击卡片展开，纵向浏览所有页面 -->
    <Transition name="preview-pop">
      <div v-if="preview.open" class="preview-modal-mask" @click.self="closePreview">
        <div class="preview-modal">
          <div class="preview-modal-head">
            <div class="preview-modal-title">
              <h3>{{ preview.tpl?.name }}</h3>
              <span v-if="preview.pages.length">共 {{ preview.pages.length }} 页</span>
            </div>
            <button class="preview-close-btn" @click="closePreview">✕</button>
          </div>
          <div class="preview-modal-body">
            <div v-if="preview.loading" class="preview-skeleton-list">
              <div v-for="i in 2" :key="'pvsk-' + i" class="preview-skeleton" />
            </div>
            <template v-else>
              <div v-for="(page, idx) in preview.pages" :key="page.id" class="preview-page-card">
                <span class="preview-page-no">{{ idx + 1 }}</span>
                <div class="preview-page-canvas" :style="{ aspectRatio: `${page.width || 2480} / ${page.height || 3508}` }">
                  <img v-if="page.backgroundUrl" :src="normalizeStorageUrl(page.backgroundUrl)" class="preview-page-bg" />
                  <div v-else class="preview-page-placeholder"><Images :size="30" /></div>
                  <div
                    v-for="z in preview.zonesMap[page.id] || []"
                    :key="z.id"
                    class="preview-zone"
                    :class="{ 'preview-zone--text': z.zoneType === 'TEXT' }"
                    :style="{ left: (z.x * 100) + '%', top: (z.y * 100) + '%', width: (z.width * 100) + '%', height: (z.height * 100) + '%' }"
                  >
                    <span v-if="z.zoneType === 'TEXT' && z.placeholderText">{{ z.placeholderText }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
          <div class="preview-modal-foot">
            <button class="preview-use-btn" :disabled="preview.creating || preview.loading" @click="useTemplate">
              {{ preview.creating ? '创建中…' : '使用此模板开始编辑' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <BottomNav />
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getTemplates, getTemplatePages, getTemplateZones } from '@/api/template'
import { createProject } from '@/api/project'
import { normalizeStorageUrl } from '@/utils/storage'
import { ElMessage } from 'element-plus'
import { ChevronDown, FolderOpen, Images, Check } from '@lucide/vue'
import BottomNav from '@/components/BottomNav.vue'

const router = useRouter()
const authStore = useAuthStore()
const templates = ref([])
const loading = ref(true)
const visible = ref(false)
const activeCategory = ref('all')
const showCategoryPicker = ref(false)

const categories = [
  { label: '全部模板', value: 'all' },
  { label: '婚礼', value: 'wedding' },
  { label: '旅行', value: 'travel' },
  { label: '亲子', value: 'family' },
  { label: '毕业', value: 'graduation' },
  { label: '其他', value: 'other' }
]

const activeCategoryLabel = computed(() => {
  const cat = categories.find(c => c.value === activeCategory.value)
  return cat ? cat.label : '全部模板'
})

const filteredTemplates = computed(() => {
  return templates.value
})

function categoryLabel(category) {
  const cat = categories.find(c => c.value === category)
  return cat ? cat.label : (category || '')
}

onMounted(async () => {
  await loadTemplates()
  requestAnimationFrame(() => {
    visible.value = true
  })
})

async function loadTemplates() {
  loading.value = true
  try {
    const cat = activeCategory.value === 'all' ? null : activeCategory.value
    const res = await getTemplates(cat)
    templates.value = res.data.data || []
  } catch (e) {
    console.error('[TemplateList] 获取模板列表失败:', e)
    ElMessage.error('加载模板列表失败，请刷新重试')
  } finally {
    loading.value = false
  }
}

function selectCategory(value) {
  activeCategory.value = value
  showCategoryPicker.value = false
  loadTemplates()
}

async function selectTemplate(tpl) {
  // 展开预览弹窗：浏览全部页面后再决定是否使用
  preview.open = true
  preview.tpl = tpl
  preview.pages = []
  preview.zonesMap = {}
  preview.loading = true
  try {
    const pagesRes = await getTemplatePages(tpl.id)
    preview.pages = (pagesRes.data.data || []).slice().sort((a, b) => a.pageNumber - b.pageNumber)
    const entries = await Promise.all(
      preview.pages.map(async p => {
        try {
          const z = await getTemplateZones(p.id)
          return [p.id, z.data.data || []]
        } catch (e) {
          return [p.id, []]
        }
      })
    )
    preview.zonesMap = Object.fromEntries(entries)
  } catch (e) {
    console.error('[TemplateList] 加载模板页面失败:', e)
    ElMessage.error('模板加载失败，请重试')
    preview.open = false
  } finally {
    preview.loading = false
  }
}

const preview = reactive({ open: false, tpl: null, pages: [], zonesMap: {}, loading: false, creating: false })

function closePreview() {
  preview.open = false
}

async function useTemplate() {
  if (!preview.tpl) return
  preview.creating = true
  try {
    const res = await createProject({ templateId: preview.tpl.id, title: preview.tpl.name })
    preview.open = false
    router.push(`/editor/${res.data.data.id}`)
  } catch (e) {
    console.error('[TemplateList] 创建项目失败:', e)
    ElMessage.error('创建项目失败，请重试')
  } finally {
    preview.creating = false
  }
}
</script>

<style scoped>
/* ---- Header ---- */
.tmpl-header {
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  background: rgba(245, 245, 247, 0.72);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: none;
}

.tmpl-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 16px;
  max-width: 1536px;
  margin: 0 auto;
}

.tmpl-category {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  margin-left: 8px;
}

.tmpl-category-label {
  font-size: 17px;
  font-weight: 600;
  color: #1d1d1f;
  letter-spacing: -0.02em;
}

.tmpl-projects-btn {
  color: rgba(0, 0, 0, 0.35);
  transition: color 0.2s ease;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.tmpl-projects-btn:hover {
  color: #1d1d1f;
}

@media (min-width: 768px) {
  .tmpl-header-inner {
    height: 64px;
    padding: 0 32px;
  }
  .tmpl-category {
    margin-left: 16px;
  }
}

/* ---- Category Dropdown ---- */
.category-drop-enter-active,
.category-drop-leave-active {
  transition: opacity 0.3s ease;
}

.category-drop-enter-active .category-dropdown-panel,
.category-drop-leave-active .category-dropdown-panel {
  transition: transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.35s ease;
}

.category-drop-enter-from,
.category-drop-leave-to {
  opacity: 0;
}

.category-drop-enter-from .category-dropdown-panel,
.category-drop-leave-to .category-dropdown-panel {
  transform: translateY(-20px) scaleY(0.95);
  opacity: 0;
}

.category-dropdown-mask {
  position: fixed;
  top: 56px;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  display: flex;
  justify-content: center;
  animation: ios-fade-in 0.25s ease;
}

@keyframes ios-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.category-dropdown-panel {
  width: 100%;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border-radius: 0 0 20px 20px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.14);
  border: 0.5px solid rgba(0, 0, 0, 0.06);
  border-top: none;
  padding: 20px 16px 24px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}

.category-dropdown-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 12px;
  text-align: center;
}

.category-dropdown-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category-dropdown-item {
  width: 100%;
  text-align: left;
  padding: 14px 20px;
  border-radius: 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 16px;
  color: rgba(0, 0, 0, 0.55);
  transition: background 0.15s ease, color 0.15s ease, transform 0.12s cubic-bezier(0.32, 0.72, 0, 1);
}

.category-dropdown-item:active {
  background: rgba(0, 0, 0, 0.04);
  transform: scale(0.98);
}

.category-dropdown-item:hover {
  background: rgba(0, 0, 0, 0.03);
  color: #1d1d1f;
}

.category-dropdown-item--active {
  background: rgba(99, 102, 241, 0.06);
  color: #6366f1;
  font-weight: 600;
}

@media (min-width: 768px) {
  .category-dropdown-mask {
    top: 64px;
    justify-content: flex-start;
  }

  .category-dropdown-panel {
    max-width: 260px;
    margin-left: 48px;
    border-radius: 0 0 16px 16px;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.12);
  }

  .category-dropdown-title {
    text-align: left;
    padding: 0 4px;
  }
}

@keyframes slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ---- Template Grid ---- */
.tmpl-content {
  max-width: 1536px;
  margin: 0 auto;
  padding: 24px 24px 96px;
}

.template-grid-header {
  text-align: center;
  padding: 40px 0 36px;
}

.grid-heading {
  font-size: 32px;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.grid-subheading {
  color: rgba(0, 0, 0, 0.4);
  font-size: 14px;
  margin-top: 6px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

/* ---- Template Card ---- */
.template-card {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.45) 100%);
  backdrop-filter: blur(28px) saturate(200%);
  -webkit-backdrop-filter: blur(28px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow:
    0 10px 32px rgba(0, 0, 0, 0.10),
    0 2px 6px rgba(0, 0, 0, 0.05),
    inset 0 1px 1px rgba(255, 255, 255, 0.8),
    inset 0 -1px 1px rgba(0, 0, 0, 0.04);
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.template-card:hover {
  border-color: rgba(255, 255, 255, 0.75);
  transform: translateY(-2px);
  box-shadow:
    0 14px 36px rgba(0, 0, 0, 0.13),
    0 2px 6px rgba(0, 0, 0, 0.05),
    inset 0 1px 1px rgba(255, 255, 255, 0.85);
}

/* iOS 按压交互：按下缩小 + 阴影收敛，松手弹性回弹 */
.template-card:active {
  transform: scale(0.96);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  border-color: rgba(0, 0, 0, 0.1);
  transition: transform 0.12s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.12s ease;
}

.template-card-image {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: #f5f5f7;
}

/* 按压高亮层：按下时轻微压暗，模拟 iOS 触控反馈 */
.template-card-image::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.07);
  opacity: 0;
  transition: opacity 0.18s ease;
  pointer-events: none;
  z-index: 2;
}

.template-card:active .template-card-image::after {
  opacity: 1;
  transition: opacity 0.08s ease;
}

.template-card-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease-out;
}

.template-card:hover .template-card-img {
  transform: scale(1.03);
}

.template-card-placeholder {
  width: 100%;
  aspect-ratio: 1 / 1;
  background: linear-gradient(135deg, #f0edff, #f3f0ff);
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-icon {
  color: rgba(99, 102, 241, 0.18);
}

.template-card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.template-card:hover .template-card-overlay {
  opacity: 1;
}

.overlay-cta {
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 20px;
  border: 1.5px solid rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  backdrop-filter: blur(8px);
  background: rgba(255, 255, 255, 0.1);
}

.template-card-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.template-card-body {
  padding: 10px 12px 12px;
}

.template-card-name {
  font-size: 14px;
  font-weight: 600;
  color: #1d1d1f;
  letter-spacing: -0.01em;
  margin-bottom: 4px;
}

.template-card-category {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.4);
  font-weight: 500;
}

/* ---- Skeleton ---- */
.skeleton-card {
  min-height: 280px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 12px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* ---- Empty State ---- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: rgba(0, 0, 0, 0.25);
  font-size: 14px;
}

.empty-icon {
  margin-bottom: 12px;
  opacity: 0.4;
}

/* ---- Responsive ---- */
@media (min-width: 640px) {
  .template-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }

  .template-card-body {
    padding: 14px 16px 16px;
  }

  .grid-heading {
    font-size: 24px;
  }

  .template-grid-header {
    padding: 24px 0 28px;
  }
}

@media (min-width: 1024px) {
  .template-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 24px;
  }

  .grid-heading {
    font-size: 28px;
  }
}

@media (min-width: 1280px) {
  .template-grid {
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  }

  .grid-heading {
    font-size: 32px;
  }

  .template-grid-header {
    padding: 40px 0 36px;
  }
}

@media (max-width: 640px) {
  .tmpl-header {
    padding-top: env(safe-area-inset-top, 0px);
    background: rgba(248, 248, 248, 0.72);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border-bottom: 0.5px solid rgba(0, 0, 0, 0.12);
    animation: ios-header-in 0.4s cubic-bezier(0.32, 0.72, 0, 1);
  }

  @keyframes ios-header-in {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .tmpl-content {
    padding: 12px 16px calc(120px + env(safe-area-inset-bottom, 0px));
  }

  .template-card {
    border-radius: 16px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.66) 0%, rgba(255, 255, 255, 0.4) 100%);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border: 0.5px solid rgba(255, 255, 255, 0.6);
    box-shadow:
      0 8px 28px rgba(0, 0, 0, 0.08),
      0 2px 6px rgba(0, 0, 0, 0.04),
      inset 0 1px 1px rgba(255, 255, 255, 0.8);
    transition: transform 0.12s cubic-bezier(0.32, 0.72, 0, 1),
                box-shadow 0.2s ease;
  }

  .template-card:active {
    transform: scale(0.97);
  }

  .template-card:hover {
    transform: none;
    border-color: rgba(0, 0, 0, 0.06);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  }

  .template-card:hover .template-card-img {
    transform: none;
  }

  .template-card-overlay {
    display: none;
  }

  .template-card-badge {
    border-radius: 8px;
    font-size: 11px;
    backdrop-filter: blur(20px);
  }
}

/* ---- 模板预览弹窗（iOS 弹层） ---- */
.preview-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.preview-modal {
  width: min(420px, 94vw);
  max-height: min(82vh, 720px);
  display: flex;
  flex-direction: column;
  border-radius: 22px;
  overflow: hidden;
  background: rgba(248, 248, 250, 0.96);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.25);
}
.preview-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 16px 18px 12px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.07);
}
.preview-modal-title { min-width: 0; }
.preview-modal-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.preview-modal-title span {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.35);
}
.preview-close-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.55);
  color: #1d1d1f;
  font-size: 13px;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease;
}
.preview-close-btn:hover { background: rgba(255, 255, 255, 0.85); transform: scale(1.08); }
.preview-close-btn:active { transform: scale(0.92); }
.preview-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.preview-page-card { position: relative; }
.preview-page-no {
  position: absolute;
  top: -9px;
  left: -4px;
  z-index: 3;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: rgba(99, 102, 241, 0.85);
  border-radius: 999px;
  min-width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
}
.preview-page-canvas {
  position: relative;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.1);
}
.preview-page-bg {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.preview-page-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.15);
  background: #fbfbfd;
}
.preview-zone {
  position: absolute;
  border: 1.5px dashed rgba(99, 102, 241, 0.55);
  border-radius: 5px;
  background: rgba(99, 102, 241, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.preview-zone--text span {
  font-size: 12px;
  color: rgba(99, 102, 241, 0.6);
  font-weight: 500;
  text-align: center;
  padding: 0 4px;
}
.preview-skeleton-list { display: flex; flex-direction: column; gap: 18px; }
.preview-skeleton {
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.05);
  animation: pv-pulse 1.5s ease-in-out infinite;
}
@keyframes pv-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
.preview-modal-foot { padding: 12px 18px 16px; }
.preview-use-btn {
  width: 100%;
  padding: 13px 0;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: linear-gradient(180deg, rgba(99, 102, 241, 0.88) 0%, rgba(99, 102, 241, 0.68) 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.28), inset 0 1px 1px rgba(255, 255, 255, 0.45);
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.preview-use-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: linear-gradient(180deg, rgba(99, 102, 241, 0.96) 0%, rgba(99, 102, 241, 0.78) 100%);
}
.preview-use-btn:active:not(:disabled) { transform: scale(0.97); transition: transform 0.1s ease; }
.preview-use-btn:disabled { opacity: 0.6; cursor: default; }
/* 弹窗出入动画 */
.preview-pop-enter-active { transition: opacity 0.25s ease; }
.preview-pop-leave-active { transition: opacity 0.2s ease; }
.preview-pop-enter-from, .preview-pop-leave-to { opacity: 0; }
.preview-pop-enter-active .preview-modal {
  transition: transform 0.35s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.3s ease;
}
.preview-pop-leave-active .preview-modal { transition: transform 0.2s ease, opacity 0.2s ease; }
.preview-pop-enter-from .preview-modal,
.preview-pop-leave-to .preview-modal {
  transform: translateY(28px) scale(0.96);
  opacity: 0;
}
</style>
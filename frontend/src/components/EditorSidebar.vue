<template>
  <div class="editor-sidebar">
    <div class="sidebar-section">
      <h4>页面列表</h4>
      <div class="page-list">
        <div
          v-for="page in templatePages"
          :key="page.id"
          :class="['page-thumb', { active: currentPageNumber === page.pageNumber }]"
          @click="$emit('switchPage', page.pageNumber)"
        >
          <img v-if="getPagePreview(page.pageNumber)" :src="getPagePreview(page.pageNumber)" />
          <span v-else>第 {{ page.pageNumber }} 页</span>
        </div>
      </div>
    </div>
    <div class="sidebar-section">
      <h4>当前页操作</h4>
      <el-tabs v-model="activePanelLocal" type="card" class="sidebar-tabs dark-tabs" :class="{ 'centered-tabs': isMobile }" @update:model-value="$emit('update:activePanel', $event)">
        <el-tab-pane label="照片" name="photo">
          <div class="panel-content">
            <p v-if="editorMode === 'album'" class="zone-hint">点击画布中的虚线区域上传照片</p>
            <p v-else class="zone-hint">上传照片添加到画布，可平铺/换照片</p>
            <div class="photo-list" v-if="currentPageImages.length">
              <div
                v-for="(img, idx) in currentPageImages"
                :key="idx"
                class="photo-item"
                @click="$emit('selectImage', img)"
              >
                <img :src="img.imageUrl || img.originalUrl" />
              </div>
            </div>
            <!-- 自由照片上传入口：虚线边框 + 加号（仅创意编辑器，FR-B8） -->
            <button v-if="editorMode === 'creative'" class="photo-add-tile" aria-label="上传照片" @click="$emit('uploadFreePhotoClick')">
              <span class="photo-add-plus">+</span>
              <span class="photo-add-text">上传照片</span>
            </button>

            <div v-if="editorMode === 'creative' && freePhoto && freePhoto.has" class="free-photo-tools">
              <div class="prop-row">
                <label>平铺</label>
                <el-select
                  :model-value="freePhoto.copyMode" size="small" class="prop-select"
                  @change="$emit('setCopyMode', $event)"
                >
                  <el-option label="单张" value="single" />
                  <el-option label="上下平铺" value="tb" />
                  <el-option label="左右平铺" value="lr" />
                </el-select>
              </div>
              <el-upload
                :show-file-list="false"
                :before-upload="(file) => { $emit('replaceFreePhoto', file); return false }"
                accept="image/*"
              >
                <el-button size="small" class="upload-btn">换照片（保留装饰）</el-button>
              </el-upload>
            </div>
            <el-empty v-if="!currentPageImages.length && !(editorMode === 'creative' && freePhoto && freePhoto.has)" description="暂无照片" :image-size="40" />
          </div>
        </el-tab-pane>
        <el-tab-pane label="贴纸" name="sticker">
          <div class="panel-content">
            <el-upload
              :show-file-list="false"
              :before-upload="(file) => { $emit('uploadSticker', file); return false }"
              accept="image/*"
            >
              <el-button size="small" class="upload-btn">上传贴纸</el-button>
            </el-upload>
            <div class="sticker-src-row">
              <button
                class="src-chip" :class="{ active: stickerSource === 'system' }"
                @click="stickerSource = 'system'"
              >系统贴纸</button>
              <button
                class="src-chip" :class="{ active: stickerSource === 'emoji' }"
                @click="stickerSource = 'emoji'"
              >Emoji 表情</button>
            </div>
            <template v-if="stickerSource === 'emoji'">
              <div v-for="cat in emojiCategories" :key="cat.id" class="emoji-category">
                <p class="emoji-cat-title">{{ cat.label }}</p>
                <div class="sticker-grid emoji-grid">
                  <button
                    v-for="e in cat.emojis"
                    :key="e"
                    class="sticker-item emoji-item"
                    @click="$emit('addEmoji', e)"
                  >{{ e }}</button>
                </div>
              </div>
            </template>
            <div v-else class="sticker-grid">
              <div
                v-for="s in systemStickers"
                :key="s.id"
                class="sticker-item"
                @click="$emit('addSticker', s.imageUrl)"
              >
                <img :src="s.imageUrl" />
              </div>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="文字" name="text">
          <div class="panel-content">
            <el-button size="small" class="upload-btn" @click="$emit('addText')">添加文字</el-button>
            <p class="zone-hint" style="margin-top:10px">推荐短语（点击插入）</p>
            <div class="phrase-list">
              <button v-for="p in phrases" :key="p" class="phrase-chip" @click="$emit('addText', p)">{{ p }}</button>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane v-if="editorMode === 'creative'" label="创意" name="creative">
          <div class="panel-content">
            <div class="creative-section">
              <p class="creative-section-title">主色块</p>
              <el-button v-if="!hasMainBlock" size="small" class="upload-btn" @click="$emit('addBlock')">添加色块</el-button>
              <template v-else>
                <div class="prop-row">
                  <label>样式</label>
                  <el-select :model-value="blockData.style" size="small" class="prop-select" @change="$emit('updateBlock', { style: $event })">
                    <el-option label="纯色" value="solid" />
                    <el-option label="条纹" value="stripe" />
                  </el-select>
                </div>
                <div class="prop-row">
                  <label>颜色</label>
                  <el-color-picker :model-value="blockData.color" size="small" @change="$emit('updateBlock', { color: $event })" />
                  <template v-if="blockData.style === 'stripe'">
                    <el-color-picker :model-value="blockData.color2" size="small" @change="$emit('updateBlock', { color2: $event })" />
                  </template>
                </div>
                <template v-if="blockData.style === 'stripe'">
                  <div class="prop-row">
                    <label>方向</label>
                    <el-select :model-value="blockData.stripeDir" size="small" class="prop-select" @change="$emit('updateBlock', { stripeDir: $event })">
                      <el-option label="横条纹" value="h" />
                      <el-option label="竖条纹" value="v" />
                    </el-select>
                  </div>
                  <div class="prop-row">
                    <label>密度</label>
                    <el-slider
                      :model-value="blockData.stripeDensity" :min="2" :max="40" size="small"
                      @input="$emit('updateBlock', { stripeDensity: $event })"
                      @change="$emit('sliderCommit')"
                    />
                  </div>
                </template>
                <el-button size="small" class="remove-block-btn" @click="$emit('removeBlock')">移除色块</el-button>
              </template>
            </div>

            <div class="creative-section">
              <p class="creative-section-title">装饰</p>
              <div class="prop-row">
                <label>形状</label>
                <el-select v-model="decorForm.char" size="small" class="prop-select">
                  <el-option v-for="ch in presetChars" :key="ch" :label="ch" :value="ch" />
                </el-select>
              </div>
              <div class="prop-row">
                <label>分布</label>
                <el-select v-model="decorForm.distribution" size="small" class="prop-select">
                  <el-option label="随机" value="random" />
                  <el-option label="光束" value="beam" />
                  <el-option label="海浪" value="wave" />
                  <el-option label="雨" value="rain" />
                  <el-option label="排列" value="grid" />
                </el-select>
              </div>
              <div class="prop-row">
                <label>颜色</label>
                <el-color-picker v-model="decorForm.color" size="small" />
              </div>
              <div class="prop-row">
                <label>数量</label>
                <el-slider v-model="decorForm.count" :min="1" :max="80" size="small" @input="onDecorParamInput" />
              </div>
              <div class="prop-row">
                <label>大小</label>
                <el-slider v-model="decorSizePct" :min="1" :max="20" size="small" @input="onDecorParamInput" />
              </div>
              <div class="creative-actions">
                <el-button size="small" type="primary" class="creative-btn" @click="applyDecor">生成装饰</el-button>
                <el-button size="small" class="creative-btn" @click="$emit('clearDecor')">清除装饰</el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane v-if="!isMobile" label="属性" name="properties">
          <div class="panel-content">
            <div v-if="selectedObjectInfo" class="prop-panel">
              <div class="prop-row">
                <label>类型</label>
                <span class="prop-tag">{{ selectedObjectInfo.type }}</span>
              </div>
              <el-collapse :model-value="propCollapseActive" @update:model-value="$emit('update:propCollapseActive', $event)" class="prop-collapse">
                <el-collapse-item title="基础属性" name="basic">
                  <div class="prop-row">
                    <label>X</label>
                    <el-input-number
                      :model-value="selectedObjectInfo.left"
                      size="small"
                      :precision="0"
                      @change="$emit('updateSelectedProp', 'left', $event)"
                      controls-position="right"
                    />
                  </div>
                  <div class="prop-row">
                    <label>Y</label>
                    <el-input-number
                      :model-value="selectedObjectInfo.top"
                      size="small"
                      :precision="0"
                      @change="$emit('updateSelectedProp', 'top', $event)"
                      controls-position="right"
                    />
                  </div>
                  <div class="prop-row">
                    <label>宽度</label>
                    <el-input-number
                      :model-value="selectedObjectInfo.width"
                      size="small"
                      :precision="0"
                      @change="$emit('updateSelectedProp', 'width', $event)"
                      controls-position="right"
                    />
                  </div>
                  <div class="prop-row">
                    <label>高度</label>
                    <el-input-number
                      :model-value="selectedObjectInfo.height"
                      size="small"
                      :precision="0"
                      @change="$emit('updateSelectedProp', 'height', $event)"
                      controls-position="right"
                    />
                  </div>
                  <div class="prop-row">
                    <label>角度</label>
                    <el-input-number
                      :model-value="selectedObjectInfo.angle"
                      size="small"
                      :precision="0"
                      :min="-360"
                      :max="360"
                      @change="$emit('updateSelectedProp', 'angle', $event)"
                      controls-position="right"
                    />
                  </div>
                  <div class="prop-row">
                    <label>不透明度</label>
                    <el-slider
                      v-model="sliderOpacity"
                      :min="0"
                      :max="100"
                      size="small"
                      @input="$emit('updateSelectedProp', 'opacity', sliderOpacity)"
                      @change="$emit('sliderCommit')"
                    />
                  </div>
                </el-collapse-item>
                <el-collapse-item title="文字属性" name="text" v-if="selectedObjectInfo.type === '文字'">
                  <div class="prop-row">
                    <label>字体</label>
                    <el-select :model-value="selectedObjectInfo.fontFamily" size="small" @change="$emit('updateSelectedProp', 'fontFamily', $event)" class="prop-select">
                      <el-option v-for="font in fontList" :key="font.value" :label="font.label" :value="font.value" :style="{ fontFamily: font.value }" />
                    </el-select>
                  </div>
                  <div class="prop-row">
                    <label>内容</label>
                    <el-input
                      :model-value="selectedObjectInfo.text"
                      size="small"
                      @input="$emit('updateSelectedProp', 'text', $event)"
                      type="textarea"
                      :rows="2"
                    />
                  </div>
                  <div class="prop-row">
                    <label>字号</label>
                    <el-input-number
                      :model-value="selectedObjectInfo.fontSize"
                      size="small"
                      :precision="0"
                      :min="8"
                      :max="100"
                      @change="$emit('updateSelectedProp', 'fontSize', $event)"
                      controls-position="right"
                    />
                  </div>
                  <div class="prop-row">
                    <label>颜色</label>
                    <el-color-picker
                      :model-value="selectedObjectInfo.fill"
                      size="small"
                      @change="$emit('updateSelectedProp', 'fill', $event)"
                    />
                  </div>
                  <div class="prop-row">
                    <label>特效</label>
                    <el-checkbox
                      :model-value="selectedObjectInfo.shadow"
                      @change="$emit('toggleTextShadow')"
                    >阴影</el-checkbox>
                    <el-checkbox
                      :model-value="selectedObjectInfo.textCutout"
                      @change="$emit('toggleTextCutout')"
                    >镂空</el-checkbox>
                  </div>
                </el-collapse-item>
                <el-collapse-item title="图片滤镜" name="filter" v-if="selectedObjectInfo.type === '照片'">
                  <div class="prop-row">
                    <label>亮度</label>
                    <el-slider
                      v-model="sliderBrightness"
                      :min="-100"
                      :max="100"
                      size="small"
                      @input="$emit('updateImageFilter', 'brightness', sliderBrightness)"
                      @change="$emit('sliderCommit')"
                    />
                  </div>
                  <div class="prop-row">
                    <label>对比度</label>
                    <el-slider
                      v-model="sliderContrast"
                      :min="-100"
                      :max="100"
                      size="small"
                      @input="$emit('updateImageFilter', 'contrast', sliderContrast)"
                      @change="$emit('sliderCommit')"
                    />
                  </div>
                  <div class="prop-row">
                    <label>饱和度</label>
                    <el-slider
                      v-model="sliderSaturation"
                      :min="-100"
                      :max="100"
                      size="small"
                      @input="$emit('updateImageFilter', 'saturation', sliderSaturation)"
                      @change="$emit('sliderCommit')"
                    />
                  </div>
                  <div class="prop-row">
                    <el-button size="small" @click="$emit('resetImageFilters')" class="reset-filter-btn">重置滤镜</el-button>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
            <el-empty v-else description="点击画布中的对象查看属性" :image-size="40" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, reactive, watch } from 'vue'
import { EMOJI_CATEGORIES } from '@/utils/emojiStickers'

const props = defineProps({
  templatePages: { type: Array, default: () => [] },
  currentPageNumber: { type: Number, default: 1 },
  currentPageImages: { type: Array, default: () => [] },
  systemStickers: { type: Array, default: () => [] },
  selectedObjectInfo: { type: Object, default: null },
  propCollapseActive: { type: Array, default: () => ['basic'] },
  fontList: { type: Array, default: () => [] },
  activePanel: { type: String, default: 'photo' },
  isMobile: { type: Boolean, default: false },
  getPagePreview: { type: Function, default: () => null },
  hasMainBlock: { type: Boolean, default: false },
  blockData: { type: Object, default: () => ({}) },
  freePhoto: { type: Object, default: () => ({ has: false, copyMode: 'single' }) },
  editorMode: { type: String, default: 'album' }
})

const emit = defineEmits([
  'switchPage', 'selectImage', 'uploadSticker', 'addSticker', 'addText', 'addEmoji',
  'updateSelectedProp', 'updateImageFilter',
  'resetImageFilters', 'update:activePanel', 'update:propCollapseActive',
  'addBlock', 'updateBlock', 'removeBlock', 'applyDecor', 'clearDecor',
  'toggleTextShadow', 'toggleTextCutout',
  'uploadFreePhotoClick', 'setCopyMode', 'replaceFreePhoto',
  'sliderCommit'
])

const stickerSource = ref('system')
const emojiCategories = EMOJI_CATEGORIES

// 创意面板本地状态
import { PRESET_CHARS } from '@/utils/decorEngine'
const presetChars = ['♥', '♪', '★', ...PRESET_CHARS]
const decorForm = reactive({ char: '♥', distribution: 'random', color: '#ffffff', count: 20 })
const decorSizePct = ref(3)

// 推荐短语库（FR-B7/P3，参考站同款语汇）
const phrases = [
  'colorwalk', 'magic hour', 'to be continued', 'my days',
  'less is more', 'cinema moment', 'summer vibe', 'sweet memory'
]

function applyDecor() {
  emit('applyDecor', {
    chars: [decorForm.char],
    distribution: decorForm.distribution,
    colors: [decorForm.color],
    count: decorForm.count,
    size: decorSizePct.value / 100
  })
}

// 装饰参数滑块拖动实时重生成（防抖 150ms；参考站同款实时预览交互）
let decorRegenTimer = null
function onDecorParamInput() {
  if (decorRegenTimer) clearTimeout(decorRegenTimer)
  decorRegenTimer = setTimeout(() => {
    decorRegenTimer = null
    applyDecor()
  }, 150)
}

const activePanelLocal = computed({
  get: () => props.activePanel,
  set: (val) => emit('update:activePanel', val)
})

// Slider local state — v-model drives display, prop changes sync in
const sliderOpacity = ref(100)
const sliderBrightness = ref(0)
const sliderContrast = ref(0)
const sliderSaturation = ref(0)

watch(() => props.selectedObjectInfo, (info) => {
  if (info) {
    sliderOpacity.value = info.opacity ?? 100
    sliderBrightness.value = info.brightness ?? 0
    sliderContrast.value = info.contrast ?? 0
    sliderSaturation.value = info.saturation ?? 0
  }
}, { immediate: true, deep: true })
</script>

<style scoped>
/* ============================================ */
/* Finder-style Source List Sidebar              */
/* ============================================ */
.editor-sidebar {
  width: 280px;
  background: linear-gradient(
    90deg,
    rgba(248, 248, 250, 0.88) 0%,
    rgba(252, 252, 252, 0.78) 100%
  );
  backdrop-filter: saturate(220%) blur(24px);
  -webkit-backdrop-filter: saturate(220%) blur(24px);
  border-right: 1px solid rgba(0, 0, 0, 0.07);
  box-shadow: 1px 0 0 rgba(255, 255, 255, 0.5) inset;
  overflow-y: auto;
  flex-shrink: 0;
}

.sidebar-section {
  padding: 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.sidebar-section:last-child {
  border-bottom: none;
}

.sidebar-section h4 {
  font-size: 10px;
  font-weight: 700;
  margin-bottom: 10px;
  color: rgba(0, 0, 0, 0.28);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding-left: 2px;
}

.page-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.page-thumb {
  width: 68px;
  height: 90px;
  border: 2px solid rgba(0, 0, 0, 0.07);
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.35);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.5);
  transition:
    border-color 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
    transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.page-thumb.active {
  border-color: #6366f1;
  box-shadow:
    0 0 0 2px rgba(99, 102, 241, 0.2),
    0 2px 8px rgba(99, 102, 241, 0.12);
  transform: translateY(-1px);
}

.page-thumb:hover {
  border-color: rgba(99, 102, 241, 0.45);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.page-thumb:active {
  transform: translateY(0) scale(0.96);
  transition: transform 0.08s ease;
}

.page-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sidebar-tabs {
  margin-top: 6px;
}

/* ---- Creative Panel ---- */
.creative-section {
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 12px;
}

.creative-section-title {
  font-size: 11px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.35);
  letter-spacing: 0.05em;
  margin-bottom: 10px;
}

.creative-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.creative-btn {
  flex: 1;
}

.remove-block-btn {
  width: 100%;
  color: #ef4444;
}

.panel-content {
  padding-top: 6px;
  animation: panelSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes panelSlideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.zone-hint {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.32);
  margin-bottom: 8px;
  text-align: center;
}

.upload-btn {
  width: 100%;
  margin-bottom: 10px;
}

.photo-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.photo-item {
  width: 64px;
  height: 64px;
  border-radius: 9px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.07);
  background: rgba(255, 255, 255, 0.55);
  transition:
    border-color 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
    transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.photo-item:hover {
  border-color: rgba(99, 102, 241, 0.35);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.12);
  transform: translateY(-2px) scale(1.03);
}

.photo-item:active {
  transform: translateY(0) scale(0.96);
  transition: transform 0.08s ease;
}

.photo-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sticker-src-row {
  display: flex;
  gap: 6px;
  margin: 10px 0;
}
.src-chip {
  flex: 1;
  padding: 7px 0;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  color: rgba(0, 0, 0, 0.6);
}
.src-chip.active {
  background: #6366f1;
  border-color: #6366f1;
  color: #fff;
  font-weight: 600;
}
.emoji-category { margin-top: 10px; }
.emoji-cat-title {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.4);
  margin: 0 0 6px 2px;
}
.emoji-grid .sticker-item {
  font-size: 26px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
}

.sticker-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.sticker-item {
  width: 56px;
  height: 56px;
  cursor: pointer;
  border-radius: 9px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.55);
  padding: 4px;
  transition:
    border-color 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
    transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.sticker-item:hover {
  border-color: rgba(99, 102, 241, 0.35);
  box-shadow: 0 3px 12px rgba(99, 102, 241, 0.1);
  transform: translateY(-2px) scale(1.05);
}

.sticker-item:active {
  transform: scale(0.94);
  transition: transform 0.08s ease;
}

.sticker-item img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.prop-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.prop-collapse {
  border: none;
  background: transparent;
}

.prop-collapse :deep(.el-collapse-item__header) {
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.42);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  padding: 0 12px;
  height: 34px;
  line-height: 34px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition:
    background 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
    border-color 0.25s ease,
    color 0.25s ease;
}

.prop-collapse :deep(.el-collapse-item__header:hover) {
  background: rgba(255, 255, 255, 0.85);
  border-color: rgba(0, 0, 0, 0.1);
  color: rgba(0, 0, 0, 0.65);
}

.prop-collapse :deep(.el-collapse-item__wrap) {
  border: none;
  background: transparent;
}

.prop-collapse :deep(.el-collapse-item__content) {
  padding: 12px 4px 4px;
  animation: accordionReveal 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes accordionReveal {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ---- Free photo upload tile + tools ---- */
.photo-add-tile {
  width: 64px;
  height: 64px;
  border: 2px dashed rgba(99, 102, 241, 0.4);
  border-radius: 9px;
  background: rgba(99, 102, 241, 0.04);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.12s ease;
  -webkit-tap-highlight-color: transparent;
}

.photo-add-tile:hover {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.08);
}

.photo-add-tile:active {
  transform: scale(0.94);
}

.photo-add-plus {
  font-size: 22px;
  line-height: 1;
  color: #6366f1;
  font-weight: 300;
}

.photo-add-text {
  font-size: 10px;
  color: rgba(99, 102, 241, 0.75);
  font-weight: 500;
}

.free-photo-tools {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

/* ---- 推荐短语（FR-B7） ---- */
.phrase-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.phrase-chip {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid rgba(99, 102, 241, 0.25);
  background: rgba(99, 102, 241, 0.05);
  color: #6366f1;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.12s ease;
}

.phrase-chip:hover {
  background: rgba(99, 102, 241, 0.12);
}

.phrase-chip:active {
  transform: scale(0.94);
}

.photo-empty-hidden:deep(.el-empty__image) {
  display: none;
}

.prop-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.prop-row:last-child {
  margin-bottom: 0;
}

.prop-row label {
  font-size: 12px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.4);
  width: 56px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .editor-sidebar {
    padding-bottom: 0;
    width: 100%;
  }

  .sidebar-section {
    padding: 16px;
  }

  .page-thumb {
    width: 64px;
    height: 84px;
  }

  .page-list {
    gap: 10px;
  }

  .photo-item {
    width: 64px;
    height: 64px;
  }

  .photo-list {
    gap: 10px;
  }

  .sticker-grid {
    max-height: none;
    gap: 10px;
  }

  .sticker-item {
    width: 68px;
    height: 68px;
  }

  .sidebar-section h4 {
    font-size: 13px;
  }
}

.prop-tag {
  font-size: 12px;
  padding: 3px 12px;
  background: rgba(99, 102, 241, 0.08);
  color: #6366f1;
  border-radius: 6px;
  font-weight: 500;
}

.prop-select {
  flex: 1;
}

.reset-filter-btn {
  width: 100%;
}

.prop-row :deep(.el-input-number),
.prop-row :deep(.el-slider),
.prop-row :deep(.el-input),
.prop-row :deep(.el-select) {
  flex: 1;
  font-size: 12px;
}

.prop-row :deep(.el-input__inner),
.prop-row :deep(.el-input-number .el-input__inner) {
  font-size: 12px;
  text-align: left;
}

.dark-tabs :deep(.el-tabs__header) {
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  padding: 3px;
  margin: 0;
}

.dark-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.dark-tabs :deep(.el-tabs__nav) {
  border: none !important;
  display: flex;
  width: 100%;
}

.dark-tabs :deep(.el-tabs__item) {
  flex: 1;
  text-align: center;
  color: rgba(0, 0, 0, 0.35);
  border: none;
  font-size: 12px;
  font-weight: 500;
  height: 28px;
  line-height: 28px;
  border-radius: 6px;
  padding: 0 8px;
  transition:
    background 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
    color 0.25s ease,
    box-shadow 0.25s ease;
}

.dark-tabs :deep(.el-tabs__item:hover) {
  color: rgba(0, 0, 0, 0.6);
  background: rgba(255, 255, 255, 0.5);
}

.dark-tabs :deep(.el-tabs__item.is-active) {
  color: #6366f1;
  background: rgba(255, 255, 255, 0.9);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.06),
    0 1px 0 rgba(0, 0, 0, 0.04);
  font-weight: 600;
}

.dark-tabs :deep(.el-tabs__content) {
  background: transparent;
  padding: 8px 0 0;
}

.centered-tabs :deep(.el-tabs__nav-wrap) {
  display: flex;
  justify-content: center;
}

.centered-tabs :deep(.el-tabs__nav) {
  width: 100%;
  display: flex;
  justify-content: space-around;
}

.centered-tabs :deep(.el-tabs__item) {
  flex: 1;
  text-align: center;
  padding: 0 8px;
}
</style>
<template>
  <div v-if="visible" class="mobile-prop-bar">
    <div class="prop-chips">
      <template v-for="item in propItems" :key="item.key">
        <div
          v-if="item.isToggle"
          class="prop-chip prop-chip--toggle"
          :class="{ active: item.current }"
          @click="onToggle(item)"
        >
          <span class="chip-icon">{{ item.icon }}</span>
        </div>
        <div
          v-else
          class="prop-chip"
          :class="{ active: activeSheetKey === item.key }"
          @click="openSheet(item)"
        >
          <span v-if="item.icon" class="chip-icon">{{ item.icon }}</span>
          <span v-if="item.swatch" class="chip-swatch" :style="{ background: item.swatch }"></span>
          <span class="chip-label">{{ item.label }}</span>
          <span v-if="item.display" class="chip-val">{{ item.display }}</span>
        </div>
      </template>
    </div>

    <Teleport to="body">
      <Transition name="sheet">
        <div
          v-if="activeSheet"
          class="prop-sheet-overlay"
          @click.self="closeSheet"
        >
          <div class="prop-sheet">
            <div class="sheet-handle"></div>
            <div class="sheet-header">
              <span class="sheet-title">{{ activeSheet.label }}</span>
              <button class="sheet-done" @click="closeSheet">完成</button>
            </div>

            <div class="sheet-body">
              <template v-if="activeSheet.type === 'slider'">
                <div class="sheet-num-display">{{ sheetDisplay }}</div>
                <div class="sheet-slider-row">
                  <span class="sheet-range">{{ activeSheet.min }}</span>
                  <el-slider
                    v-model="sheetValue"
                    :min="activeSheet.min"
                    :max="activeSheet.max"
                    :step="1"
                    size="small"
                    @input="onSheetInput"
                    @change="onSheetChange"
                  />
                  <span class="sheet-range">{{ activeSheet.max }}</span>
                </div>
              </template>

              <template v-if="activeSheet.type === 'align'">
                <div class="sheet-align-row">
                  <button
                    v-for="opt in alignOptions"
                    :key="opt.value"
                    class="sheet-align-btn"
                    :class="{ active: sheetValue === opt.value }"
                    @click="onAlignSelect(opt.value)"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <template v-if="opt.value === 'left'">
                        <line x1="17" y1="3" x2="17" y2="21"/><line x1="3" y1="7" x2="14" y2="7"/><line x1="3" y1="12" x2="10" y2="12"/><line x1="3" y1="17" x2="14" y2="17"/>
                      </template>
                      <template v-if="opt.value === 'center'">
                        <line x1="12" y1="3" x2="12" y2="21"/><line x1="4" y1="7" x2="20" y2="7"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>
                      </template>
                      <template v-if="opt.value === 'right'">
                        <line x1="7" y1="3" x2="7" y2="21"/><line x1="10" y1="7" x2="21" y2="7"/><line x1="14" y1="12" x2="21" y2="12"/><line x1="10" y1="17" x2="21" y2="17"/>
                      </template>
                    </svg>
                    <span class="align-label">{{ opt.label }}</span>
                  </button>
                </div>
              </template>

              <template v-if="activeSheet.type === 'font'">
                <div class="sheet-font-list">
                  <div
                    v-for="font in fontList"
                    :key="font.value"
                    class="sheet-font-item"
                    :class="{ active: sheetValue === font.value }"
                    :style="{ fontFamily: font.value }"
                    @click="onFontSelect(font.value)"
                  >
                    {{ font.label }}
                    <span v-if="sheetValue === font.value" class="font-check">✓</span>
                  </div>
                </div>
              </template>

              <template v-if="activeSheet.type === 'color'">
                <div class="sheet-color-grid">
                  <button
                    v-for="c in colorPresets"
                    :key="c"
                    class="sheet-color-swatch"
                    :class="{ active: sheetValue === c }"
                    :style="{ backgroundColor: c }"
                    @click="onColorSelect(c)"
                  >
                    <span v-if="sheetValue === c" class="swatch-check">✓</span>
                  </button>
                </div>
              </template>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  selectedObjectInfo: { type: Object, default: null },
  hasSelection: { type: Boolean, default: false },
  textFormatState: { type: Object, default: () => ({}) },
  fontList: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'updateSelectedProp',
  'updateImageFilter',
  'toggleTextBold',
  'toggleTextItalic',
  'toggleTextUnderline',
  'setTextAlign',
  'updateTextFontFamily',
  'updateTextFontSize',
  'updateTextColor',
  'sliderCommit'
])

const activeSheetKey = ref(null)
const sheetValue = ref(0)

const alignOptions = [
  { value: 'left', label: '左对齐' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '右对齐' }
]

const colorPresets = [
  '#333333', '#000000', '#666666', '#999999',
  '#1a1a2e', '#6366f1', '#ef4444', '#f59e0b',
  '#10b981', '#06b6d4', '#8b5cf6', '#ec4899',
  '#f97316', '#84cc16', '#14b8a6', '#f43f5e',
  '#ffffff', '#f5f5f5', '#e5e5e5', '#d4d4d4'
]

const visible = computed(() => {
  if (!props.hasSelection || !props.selectedObjectInfo) return false
  const type = props.selectedObjectInfo.type
  return type === '照片' || type === '贴纸' || type === '文字'
})

const isText = computed(() => {
  return props.selectedObjectInfo?.type === '文字'
})

const propItems = computed(() => {
  if (isText.value) {
    const fmt = props.textFormatState
    return [
      { key: 'bold', icon: 'B', isToggle: true, current: fmt.bold || false },
      { key: 'italic', icon: 'I', isToggle: true, current: fmt.italic || false },
      { key: 'underline', icon: 'U', isToggle: true, current: fmt.underline || false },
      {
        key: 'textAlign',
        label: '对齐',
        display: alignLabel(fmt.textAlign),
        type: 'align',
        current: fmt.textAlign || 'left'
      },
      {
        key: 'fontFamily',
        label: '字体',
        display: fontDisplay(fmt.fontFamily),
        type: 'font',
        current: fmt.fontFamily || 'Microsoft YaHei'
      },
      {
        key: 'fontSize',
        label: '字号',
        display: String(fmt.fontSize || 24),
        type: 'slider',
        current: fmt.fontSize || 24,
        min: 8,
        max: 100,
        suffix: ''
      },
      {
        key: 'fill',
        label: '颜色',
        swatch: fmt.fill || '#333333',
        type: 'color',
        current: fmt.fill || '#333333'
      }
    ]
  }

  const info = props.selectedObjectInfo
  if (!info) return []

  return [
    {
      key: 'opacity',
      icon: '◐',
      label: '不透明度',
      display: (info.opacity ?? 100) + '%',
      type: 'slider',
      current: info.opacity ?? 100,
      min: 0,
      max: 100,
      suffix: '%'
    },
    {
      key: 'brightness',
      icon: '☀',
      label: '亮度',
      display: String(info.brightness ?? 0),
      type: 'slider',
      current: info.brightness ?? 0,
      min: -100,
      max: 100,
      suffix: ''
    },
    {
      key: 'contrast',
      icon: '◑',
      label: '对比度',
      display: String(info.contrast ?? 0),
      type: 'slider',
      current: info.contrast ?? 0,
      min: -100,
      max: 100,
      suffix: ''
    },
    {
      key: 'saturation',
      icon: '🌈',
      label: '饱和度',
      display: String(info.saturation ?? 0),
      type: 'slider',
      current: info.saturation ?? 0,
      min: -100,
      max: 100,
      suffix: ''
    }
  ]
})

const activeSheet = computed(() => {
  if (!activeSheetKey.value) return null
  return propItems.value.find(item => item.key === activeSheetKey.value) || null
})

const sheetDisplay = computed(() => {
  if (!activeSheet.value) return ''
  const sheet = activeSheet.value
  return sheetValue.value + (sheet.suffix || '')
})

function alignLabel(val) {
  const map = { left: '≡', center: '☰', right: '≡' }
  return map[val] || '≡'
}

function fontDisplay(val) {
  if (!val) return '雅黑'
  const short = val.replace('Microsoft ', '').replace('Comic ', '').replace('Trebuchet ', '').replace('Times New ', '')
  if (short.length > 5) return short.substring(0, 5) + '…'
  return short
}

function onToggle(item) {
  const map = {
    bold: 'toggleTextBold',
    italic: 'toggleTextItalic',
    underline: 'toggleTextUnderline'
  }
  if (map[item.key]) {
    emit(map[item.key])
  }
}

function openSheet(item) {
  activeSheetKey.value = item.key
  sheetValue.value = item.current
}

function closeSheet() {
  activeSheetKey.value = null
}

function onSheetChange(val) {
  // 松手：应用最终值 + 提交一次历史（sliderCommit）
  onSheetInput(val)
  emit('sliderCommit')
}

// 拖动中实时预览
function onSheetInput(val) {
  if (!activeSheet.value) return
  const key = activeSheet.value.key
  if (key === 'opacity') {
    emit('updateSelectedProp', 'opacity', val)
  } else if (key === 'fontSize') {
    emit('updateTextFontSize', val)
  } else {
    emit('updateImageFilter', key, val)
  }
}

function onAlignSelect(val) {
  sheetValue.value = val
  emit('setTextAlign', val)
  closeSheet()
}

function onFontSelect(val) {
  sheetValue.value = val
  emit('updateTextFontFamily', val)
  closeSheet()
}

function onColorSelect(val) {
  sheetValue.value = val
  emit('updateTextColor', val)
  closeSheet()
}

watch(() => props.selectedObjectInfo, () => {
  if (activeSheetKey.value) {
    const item = propItems.value.find(i => i.key === activeSheetKey.value)
    if (item) {
      sheetValue.value = item.current
    }
  }
}, { deep: true })

watch(() => props.textFormatState, (fmt) => {
  if (activeSheet.value && fmt) {
    const key = activeSheet.value.key
    if (key === 'textAlign' || key === 'fontFamily' || key === 'fontSize' || key === 'fill') {
      sheetValue.value = fmt[key] ?? activeSheet.value.current
    }
  }
}, { deep: true })
</script>

<style scoped>
.mobile-prop-bar {
  position: fixed;
  bottom: 88px;
  left: 16px;
  right: 16px;
  z-index: 999;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.mobile-prop-bar::-webkit-scrollbar {
  display: none;
}

.prop-chips {
  display: flex;
  gap: 10px;
  padding: 0 4px;
  width: max-content;
}

.prop-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.prop-chip:active {
  transform: scale(0.95);
  background: rgba(255, 255, 255, 0.75);
}

.prop-chip.active {
  background: rgba(99, 102, 241, 0.12);
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 2px 16px rgba(99, 102, 241, 0.15);
}

.prop-chip--toggle {
  width: 44px;
  height: 44px;
  min-width: 44px;
  padding: 0;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.4);
}

.prop-chip--toggle.active {
  color: #6366f1;
}

.chip-icon {
  font-size: 14px;
  line-height: 1;
  opacity: 0.5;
  font-weight: 600;
}

.prop-chip.active .chip-icon {
  opacity: 0.8;
}

.chip-swatch {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1.5px solid rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
}

.chip-label {
  font-size: 13px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.55);
  white-space: nowrap;
}

.chip-val {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a2e;
  min-width: 28px;
  text-align: right;
}

/* ============================================ */
/* iOS-style Bottom Sheet                        */
/* ============================================ */
.prop-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: flex-end;
  pointer-events: none;
}

.prop-sheet-overlay > * {
  pointer-events: auto;
}

.prop-sheet {
  width: 100%;
  max-height: 70vh;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-radius: 20px 20px 0 0;
  padding: 0 20px 36px;
  box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

.sheet-handle {
  width: 36px;
  height: 5px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
  margin: 10px auto 16px;
  flex-shrink: 0;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  flex-shrink: 0;
}

.sheet-done {
  font-size: 15px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 4px 8px;
  color: #6366f1;
  font-weight: 600;
}

.sheet-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}

.sheet-body {
  flex: 1;
  overflow-y: auto;
}

/* Slider sheet */
.sheet-num-display {
  font-size: 48px;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: -0.02em;
  line-height: 1;
  text-align: center;
  margin-bottom: 20px;
}

.sheet-slider-row {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.sheet-slider-row .el-slider {
  flex: 1;
}

.sheet-range {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.3);
  min-width: 32px;
  text-align: center;
  flex-shrink: 0;
}

/* Align sheet */
.sheet-align-row {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 12px 0;
}

.sheet-align-btn {
  flex: 1;
  max-width: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 12px;
  border: 2px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.02);
  cursor: pointer;
  transition: all 0.2s ease;
  color: rgba(0, 0, 0, 0.4);
}

.sheet-align-btn.active {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.08);
  color: #6366f1;
}

.align-label {
  font-size: 13px;
  font-weight: 500;
}

/* Font picker sheet */
.sheet-font-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 50vh;
  overflow-y: auto;
}

.sheet-font-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  font-size: 17px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
  color: #1a1a2e;
}

.sheet-font-item:active {
  background: rgba(0, 0, 0, 0.04);
}

.sheet-font-item.active {
  background: rgba(99, 102, 241, 0.08);
  color: #6366f1;
}

.font-check {
  font-size: 16px;
  font-weight: 600;
  color: #6366f1;
}

/* Color sheet */
.sheet-color-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  padding: 8px 0;
  justify-items: center;
}

.sheet-color-swatch {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.sheet-color-swatch:active {
  transform: scale(0.9);
}

.sheet-color-swatch.active {
  border-color: #6366f1;
  transform: scale(1.1);
}

.swatch-check {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* ============================================ */
/* Sheet Transition Animations                   */
/* ============================================ */

/* --- Enter: overlay fades in, sheet slides up --- */
.sheet-enter-active {
  transition: opacity 0.32s cubic-bezier(0.32, 0.72, 0, 1);
}

.sheet-enter-active .prop-sheet {
  transition: transform 0.38s cubic-bezier(0.32, 0.72, 0, 1);
}

.sheet-enter-from {
  opacity: 0;
}

.sheet-enter-from .prop-sheet {
  transform: translateY(100%);
}

.sheet-enter-to {
  opacity: 1;
}

.sheet-enter-to .prop-sheet {
  transform: translateY(0);
}

/* --- Leave: sheet slides out first, then overlay fades --- */
.sheet-leave-active {
  transition: opacity 0.22s cubic-bezier(0.4, 0, 1, 1);
  transition-delay: 0.1s;
}

.sheet-leave-active .prop-sheet {
  transition: transform 0.26s cubic-bezier(0.4, 0, 1, 1);
}

.sheet-leave-from {
  opacity: 1;
}

.sheet-leave-from .prop-sheet {
  transform: translateY(0);
}

.sheet-leave-to {
  opacity: 0;
}

.sheet-leave-to .prop-sheet {
  transform: translateY(100%);
}
</style>
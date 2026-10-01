<template>
  <div class="editor-sidebar">
    <!-- 页面列表：编辑器内直接切换多页 -->
    <div class="sidebar-section">
      <h4>模板页面</h4>
      <div class="page-list">
        <div
          v-for="page in pages"
          :key="page.id"
          :class="['page-thumb', { active: page.pageNumber === currentPageNumber }]"
          @click="$emit('switchPage', page.pageNumber)"
        >
          <img v-if="page.backgroundUrl" :src="page.backgroundUrl" />
          <span v-else>{{ page.pageNumber }}</span>
          <em class="page-no">{{ page.pageNumber }}</em>
        </div>
      </div>
    </div>

    <!-- 背景图上传/更换 -->
    <div class="sidebar-section">
      <h4>背景图</h4>
      <el-upload
        :show-file-list="false"
        accept="image/*"
        :auto-upload="false"
        :on-change="onBgChange"
      >
        <el-button size="small" style="width: 100%">
          {{ currentBgUrl ? '更换背景图' : '上传背景图' }}
        </el-button>
      </el-upload>
      <p class="hint-text" v-if="currentBgUrl">拖拽画布中的背景可微调对位（不保存）</p>
      <p class="hint-text warn" v-else>请先上传背景图，否则无法保存区域</p>
    </div>

    <!-- 工具选项 -->
    <div class="sidebar-section">
      <h4>工具选项</h4>
      <div class="option-row">
        <label>区域类型</label>
        <el-select :model-value="newZoneType" size="small" style="width: 100%"
                   @update:model-value="$emit('update:newZoneType', $event)">
          <el-option label="照片区域" value="PHOTO" />
          <el-option label="文字区域" value="TEXT" />
        </el-select>
        <div class="type-hint">新标注仅支持照片/文字；存量色块/装饰区域兼容读取</div>
      </div>
      <div class="option-row">
        <label>选区模式</label>
        <el-radio-group :model-value="selectionMode" size="small"
                        @update:model-value="$emit('update:selectionMode', $event)">
          <el-radio-button value="new">新选区</el-radio-button>
          <el-radio-button value="add">加选</el-radio-button>
          <el-radio-button value="subtract">减选</el-radio-button>
        </el-radio-group>
      </div>
      <p class="hint-text">绘制时按住 Shift=加选、Alt=减选（作用于选中区域）</p>
      <div v-if="tool === 'wand'" class="option-row">
        <label>魔棒容差</label>
        <el-slider
          :model-value="wandTolerance"
          :min="4" :max="128" :step="4"
          @update:model-value="$emit('update:wandTolerance', $event)"
        />
        <span class="tolerance-value">{{ wandTolerance }}</span>
      </div>
    </div>

    <!-- PSD 图层（FR-54/55，D15）：分层模板专属 -->
    <div v-if="layers.length" class="sidebar-section">
      <h4>图层（{{ layers.length }}）</h4>
      <p class="hint-text">拖动/缩放画布上的图层；隐藏的图层不参与合成</p>
      <div class="layer-list">
        <div
          v-for="(layer, ri) in [...layers].reverse()"
          :key="layer.id || (layers.length - ri)"
          class="layer-item"
        >
          <span class="layer-name" :title="layer.name">{{ layer.name }}</span>
          <div class="layer-ops">
            <el-button size="small" text :disabled="ri === 0" @click="$emit('moveLayer', layers.length - 1 - ri, 1)" title="上移一层">↑</el-button>
            <el-button size="small" text :disabled="ri === layers.length - 1" @click="$emit('moveLayer', layers.length - 1 - ri, -1)" title="下移一层">↓</el-button>
            <el-switch
              size="small"
              :model-value="layer.visible !== false"
              @update:model-value="$emit('toggleLayerVisible', layers.length - 1 - ri)"
            />
          </div>
        </div>
      </div>
      <el-button
        size="small"
        type="primary"
        class="apply-btn"
        :loading="applying"
        @click="$emit('applyComposite')"
      >
        应用合成
      </el-button>
      <p class="hint-text">合成结果写回页面背景；图层档案保留，可反复调整</p>
    </div>

    <!-- 区域列表 -->
    <div class="sidebar-section grow">
      <h4>已添加区域（{{ zones.length }}）</h4>
      <p class="hint-text" v-if="!zones.length">选择左侧工具在页面上绘制区域</p>
      <div
        v-for="(zone, idx) in zones"
        :key="idx"
        :class="['zone-item', { selected: idx === selectedZoneIndex }]"
        @click="$emit('selectZone', idx)"
      >
        <div class="zone-item-head">
          <el-tag :type="typeTagStyle(zone.zoneType)" size="small">{{ typeLabel(zone.zoneType) }}</el-tag>
          <span class="zone-shape">{{ shapeLabel(zone) }}</span>
        </div>
        <div class="zone-item-meta">
          <span>x {{ pct(zone.x) }} · y {{ pct(zone.y) }}</span>
          <span>{{ pct(zone.width) }} × {{ pct(zone.height) }}</span>
        </div>
        <el-button size="small" type="danger" text class="zone-del" @click.stop="$emit('removeZone', idx)">删除</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  pages: { type: Array, default: () => [] },
  currentPageNumber: { type: Number, default: 1 },
  zones: { type: Array, default: () => [] },
  selectedZoneIndex: { type: Number, default: -1 },
  tool: { type: String, default: 'select' },
  newZoneType: { type: String, default: 'PHOTO' },
  selectionMode: { type: String, default: 'new' },
  wandTolerance: { type: Number, default: 32 },
  layers: { type: Array, default: () => [] },
  applying: { type: Boolean, default: false }
})

const emit = defineEmits(['switchPage', 'update:newZoneType', 'update:selectionMode', 'update:wandTolerance', 'selectZone', 'removeZone', 'uploadBg', 'toggleLayerVisible', 'applyComposite', 'moveLayer'])

const currentBgUrl = computed(() => {
  const page = props.pages.find(p => p.pageNumber === props.currentPageNumber)
  return page ? page.backgroundUrl : ''
})

const TYPE_LABELS = { PHOTO: '照片', TEXT: '文字', COLOR_BLOCK: '色块区', DECOR: '装饰区' }
const TYPE_TAGS = { PHOTO: 'primary', TEXT: 'success', COLOR_BLOCK: 'warning', DECOR: 'danger' }

function typeLabel(t) {
  return TYPE_LABELS[t] || t
}

function typeTagStyle(t) {
  return TYPE_TAGS[t] || 'info'
}

function shapeLabel(zone) {
  const shape = (zone.shape || 'RECT').toUpperCase()
  if (shape === 'COMPOUND') {
    const ops = zone._ops || []
    const adds = ops.filter(o => o.op === 'add').length
    const subs = ops.filter(o => o.op === 'subtract').length
    return `复合 ${adds} 形状${subs ? ` - ${subs}` : ''}`
  }
  return { RECT: '矩形', ELLIPSE: '椭圆', POLYGON: '多边形' }[shape] || shape
}

function pct(v) {
  return `${Math.round((v || 0) * 100)}%`
}

function onBgChange(file) {
  if (file && file.raw) {
    emit('uploadBg', file.raw)
  }
}
</script>

<style scoped>
/* 与用户编辑器 EditorSidebar 同源的 Finder 风格侧栏视觉 */
.editor-sidebar {
  width: 280px;
  background: linear-gradient(
    90deg,
    rgba(248, 248, 250, 0.88) 0%,
    rgba(252, 252, 252, 0.78) 100%
  );
  backdrop-filter: saturate(220%) blur(24px);
  -webkit-backdrop-filter: saturate(220%) blur(24px);
  border-left: 1px solid rgba(0, 0, 0, 0.07);
  box-shadow: -1px 0 0 rgba(255, 255, 255, 0.5) inset;
  overflow-y: auto;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.sidebar-section {
  padding: 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.sidebar-section.grow {
  flex: 1;
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
  position: relative;
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
}

.page-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.page-no {
  position: absolute;
  left: 4px;
  bottom: 3px;
  font-size: 9px;
  font-style: normal;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.45);
  background: rgba(255, 255, 255, 0.85);
  border-radius: 4px;
  padding: 0 4px;
  line-height: 14px;
}

.hint-text {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.35);
  line-height: 1.5;
  margin: 8px 0 0;
}

.hint-text.warn {
  color: #d97706;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.option-row label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.5);
  width: 60px;
  flex-shrink: 0;
}

.type-hint {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.35);
  margin-top: 4px;
}

.layer-list {
  max-height: 160px;
  overflow-y: auto;
}

.layer-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 12px;
}

.layer-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.layer-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.layer-ops {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.layer-ops .el-button {
  padding: 2px 6px;
  margin: 0;
}

.apply-btn {
  width: 100%;
  margin-top: 8px;
}

.tolerance-value {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
  width: 26px;
  text-align: right;
}

.zone-item {
  position: relative;
  padding: 10px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.zone-item:hover {
  border-color: rgba(99, 102, 241, 0.4);
}

.zone-item.selected {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.16);
}

.zone-item-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zone-shape {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.55);
  font-weight: 600;
}

.zone-item-meta {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.4);
  margin-top: 6px;
}

.zone-del {
  position: absolute;
  right: 6px;
  bottom: 6px;
}

@media (max-width: 768px) {
  .editor-sidebar {
    width: 100%;
    border-left: none;
  }
}
</style>

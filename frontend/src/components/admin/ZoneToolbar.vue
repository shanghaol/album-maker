<template>
  <div class="editor-toolbar-wrapper">
    <div class="editor-toolbar">
      <button class="back-btn" @click="$emit('goBack')" aria-label="返回">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <span class="project-title">{{ title }}</span>
      <el-tag size="small" type="warning" effect="plain" class="mode-tag">模板区域标注</el-tag>

      <div v-if="!isMobile" class="toolbar-actions">
        <el-button-group class="action-group">
          <el-button size="small" @click="$emit('undo')" :disabled="!canUndo" title="撤销 (Ctrl+Z)" aria-label="撤销">
            <span class="toolbar-icon">↩</span>
          </el-button>
          <el-button size="small" @click="$emit('redo')" :disabled="!canRedo" title="重做 (Ctrl+Y)" aria-label="重做">
            <span class="toolbar-icon">↪</span>
          </el-button>
        </el-button-group>
        <el-button-group class="action-group">
          <el-button size="small" @click="$emit('zoomOut')" title="缩小" aria-label="缩小">
            <span class="toolbar-icon">-</span>
          </el-button>
          <el-button size="small" class="zoom-label" disabled>{{ zoomPercent }}%</el-button>
          <el-button size="small" @click="$emit('zoomIn')" title="放大" aria-label="放大">
            <span class="toolbar-icon">+</span>
          </el-button>
          <el-button size="small" @click="$emit('zoomToFit')" title="适应画布">⊞</el-button>
        </el-button-group>
        <el-button-group class="action-group">
          <el-button size="small" @click="$emit('deleteSelected')" title="删除选中区域 (Delete)" aria-label="删除选中区域">
            <span class="toolbar-icon">🗑</span>
          </el-button>
        </el-button-group>
      </div>

      <div class="toolbar-right">
        <span class="save-status" v-if="!isMobile">{{ statusText }}</span>
        <el-button @click="$emit('save')" :loading="saving" type="primary" size="small">保存区域</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
  zoomPercent: { type: Number, default: 100 },
  saving: { type: Boolean, default: false },
  dirty: { type: Boolean, default: false },
  isMobile: { type: Boolean, default: false }
})

defineEmits(['goBack', 'undo', 'redo', 'zoomIn', 'zoomOut', 'zoomToFit', 'deleteSelected', 'save'])

const statusText = computed(() => {
  if (props.saving) return '保存中...'
  return props.dirty ? '有未保存修改' : '已与服务器同步'
})
</script>

<style scoped>
/* 与用户编辑器 EditorToolbar 同源的 macOS 统一工具栏视觉 */
.editor-toolbar-wrapper {
  position: relative;
  z-index: 10;
  flex-shrink: 0;
}

.editor-toolbar {
  height: 52px;
  padding: 0 16px;
  padding-top: env(safe-area-inset-top, 0px);
  background: linear-gradient(
    180deg,
    rgba(245, 245, 247, 0.88) 0%,
    rgba(245, 245, 247, 0.74) 100%
  );
  backdrop-filter: saturate(210%) blur(24px);
  -webkit-backdrop-filter: saturate(210%) blur(24px);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.7) inset,
    0 -1px 0 rgba(0, 0, 0, 0.03) inset;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.back-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  color: #1d1d1f;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, transform 0.15s ease;
}
.back-btn:hover {
  background: rgba(0, 0, 0, 0.09);
}
.back-btn:active {
  transform: scale(0.92);
}

.project-title {
  font-size: 14px;
  font-weight: 600;
  color: #1d1d1f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.mode-tag {
  flex-shrink: 0;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.action-group {
  flex-shrink: 0;
}

.toolbar-icon {
  font-size: 13px;
  line-height: 1;
}

.zoom-label {
  min-width: 52px;
  font-size: 12px;
}

.toolbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.save-status {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.4);
}

@media (max-width: 768px) {
  .editor-toolbar {
    height: 50px;
    padding: 0 12px;
    gap: 8px;
  }
  .project-title {
    max-width: 120px;
    font-size: 13px;
  }
  .mode-tag {
    display: none;
  }
}
</style>

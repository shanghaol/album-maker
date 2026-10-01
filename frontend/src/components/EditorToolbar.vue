<template>
  <div class="editor-toolbar-wrapper">
    <div class="editor-toolbar">
      <button class="back-btn" @click="$emit('goBack')" aria-label="返回">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <span class="project-title">{{ title }}</span>

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
          <el-button size="small" @click="$emit('zoomIn')" title="放大" aria-label="放大">
            <span class="toolbar-icon">+</span>
          </el-button>
          <el-button size="small" class="zoom-label" disabled>{{ zoomPercent }}%</el-button>
          <el-button size="small" @click="$emit('zoomOut')" title="缩小" aria-label="缩小">
            <span class="toolbar-icon">-</span>
          </el-button>
          <el-button size="small" @click="$emit('zoomToFit')" title="适应画布" aria-label="适应画布">⊞</el-button>
        </el-button-group>
        <el-button-group class="action-group">
          <el-button size="small" @click="$emit('deleteSelected')" title="删除 (Delete)" aria-label="删除">
            <span class="toolbar-icon">🗑</span>
          </el-button>
          <el-button size="small" @click="$emit('copySelected')" title="复制 (Ctrl+C)" aria-label="复制">
            <span class="toolbar-icon">📋</span>
          </el-button>
          <el-button size="small" @click="$emit('pasteSelected')" title="粘贴 (Ctrl+V)" aria-label="粘贴">
            <span class="toolbar-icon">📄</span>
          </el-button>
        </el-button-group>
        <el-dropdown class="more-actions-dropdown" trigger="click">
          <el-button size="small" class="more-actions-btn" aria-label="更多操作">
            更多<span class="toolbar-icon">▾</span>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="$emit('bringForward')">↑ 上移一层</el-dropdown-item>
              <el-dropdown-item @click="$emit('sendBackward')">↓ 下移一层</el-dropdown-item>
              <el-dropdown-item @click="$emit('bringToFront')">⤒ 置顶</el-dropdown-item>
              <el-dropdown-item @click="$emit('sendToBack')">⤓ 置底</el-dropdown-item>
              <el-dropdown-item divided @click="$emit('alignObjects', 'left')">◧ 左对齐</el-dropdown-item>
              <el-dropdown-item @click="$emit('alignObjects', 'center')">◫ 水平居中</el-dropdown-item>
              <el-dropdown-item @click="$emit('alignObjects', 'right')">◨ 右对齐</el-dropdown-item>
              <el-dropdown-item @click="$emit('alignObjects', 'top')">⬒ 顶对齐</el-dropdown-item>
              <el-dropdown-item @click="$emit('alignObjects', 'middle')">⬓ 垂直居中</el-dropdown-item>
              <el-dropdown-item @click="$emit('alignObjects', 'bottom')">⬔ 底对齐</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <div class="toolbar-right">
        <span class="auto-save-status" v-if="autoSaveStatus && !isMobile">{{ autoSaveStatus }}</span>
        <el-dropdown v-if="editorMode === 'creative'" trigger="click" @command="$emit('setCanvasRatio', $event)">
          <el-button size="small" title="画幅比例">{{ canvasRatioLabel }} ▾</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="r in canvasRatios"
                :key="r.id"
                :command="r.id"
                :class="{ 'is-active-ratio': r.id === canvasRatioLabel }"
              >{{ r.id }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button @click="$emit('saveDraft')" :loading="saving" size="small">保存草稿</el-button>
        <el-button type="primary" @click="$emit('submitProject')" :loading="submitting" size="small">提交相册</el-button>
      </div>
    </div>

    <div v-if="isMobile" class="mobile-tools-panel">
      <div class="mobile-tools-row">
        <el-button size="small" @click="$emit('undo')" :disabled="!canUndo" title="撤销">
          <span class="toolbar-icon">↩</span>
        </el-button>
        <el-button size="small" @click="$emit('redo')" :disabled="!canRedo" title="重做">
          <span class="toolbar-icon">↪</span>
        </el-button>
        <span class="mobile-tools-sep"></span>
        <el-button size="small" @click="$emit('zoomIn')" title="放大">
          <span class="toolbar-icon">+</span>
        </el-button>
        <el-button size="small" class="mobile-zoom-label" disabled>{{ zoomPercent }}%</el-button>
        <el-button size="small" @click="$emit('zoomOut')" title="缩小">
          <span class="toolbar-icon">-</span>
        </el-button>
        <el-button size="small" @click="$emit('zoomToFit')" title="适应画布">⊞</el-button>
        <span class="mobile-tools-sep"></span>
        <el-button size="small" @click="$emit('deleteSelected')" title="删除">
          <span class="toolbar-icon">🗑</span>
        </el-button>
        <el-button size="small" @click="$emit('copySelected')" title="复制">
          <span class="toolbar-icon">📋</span>
        </el-button>
        <el-button size="small" @click="$emit('pasteSelected')" title="粘贴">
          <span class="toolbar-icon">📄</span>
        </el-button>
        <span class="mobile-tools-sep"></span>
        <el-dropdown trigger="click" class="mobile-more-dropdown">
          <el-button size="small" aria-label="更多操作">更多 ▾</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="$emit('bringForward')">↑ 上移一层</el-dropdown-item>
              <el-dropdown-item @click="$emit('sendBackward')">↓ 下移一层</el-dropdown-item>
              <el-dropdown-item @click="$emit('bringToFront')">⤒ 置顶</el-dropdown-item>
              <el-dropdown-item @click="$emit('sendToBack')">⤓ 置底</el-dropdown-item>
              <el-dropdown-item divided @click="$emit('alignObjects', 'left')">◧ 左对齐</el-dropdown-item>
              <el-dropdown-item @click="$emit('alignObjects', 'center')">◫ 水平居中</el-dropdown-item>
              <el-dropdown-item @click="$emit('alignObjects', 'right')">◨ 右对齐</el-dropdown-item>
              <el-dropdown-item @click="$emit('alignObjects', 'top')">⬒ 顶对齐</el-dropdown-item>
              <el-dropdown-item @click="$emit('alignObjects', 'middle')">⬓ 垂直居中</el-dropdown-item>
              <el-dropdown-item @click="$emit('alignObjects', 'bottom')">⬔ 底对齐</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </div>
</template>

<script setup>
import { CANVAS_RATIOS } from '@/utils/decorEngine'

defineProps({
  title: { type: String, default: '' },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
  zoomPercent: { type: Number, default: 100 },
  autoSaveStatus: { type: String, default: '' },
  saving: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  isMobile: { type: Boolean, default: false },
  editorMode: { type: String, default: 'album' },
  canvasRatioLabel: { type: String, default: '' }
})

const canvasRatios = CANVAS_RATIOS

defineEmits([
  'goBack', 'undo', 'redo', 'zoomIn', 'zoomOut', 'zoomToFit',
  'deleteSelected', 'copySelected', 'pasteSelected',
  'bringForward', 'sendBackward', 'bringToFront', 'sendToBack',
  'alignObjects', 'saveDraft', 'submitProject', 'setCanvasRatio'
])
</script>

<style scoped>
/* ============================================ */
/* macOS Unified Toolbar                         */
/* ============================================ */
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

/* ---- Back Button — macOS traffic-light style ---- */
.back-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: #6366f1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  padding: 0;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.75);
  border-color: rgba(0, 0, 0, 0.16);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transform: scale(1.08);
}

.back-btn:active {
  transform: scale(0.94);
  transition: transform 0.1s ease;
}

/* ---- Title ---- */
.project-title {
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.02em;
}

/* ---- Desktop Toolbar Actions ---- */
.toolbar-actions {
  display: flex;
  gap: 8px;
}

.action-group {
  display: flex;
}

/* macOS segmented-control style for button groups */
.action-group :deep(.el-button + .el-button) {
  margin-left: 0 !important;
}

.action-group :deep(.el-button) {
  border-radius: 0;
  border-color: rgba(0, 0, 0, 0.12);
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.action-group :deep(.el-button:hover) {
  transform: scale(1.06);
  z-index: 1;
}

.action-group :deep(.el-button:active) {
  transform: scale(0.95);
  transition: transform 0.08s ease;
}

.action-group :deep(.el-button:first-child) {
  border-radius: 7px 0 0 7px;
}

.action-group :deep(.el-button:last-child) {
  border-radius: 0 7px 7px 0;
}

.action-group :deep(.el-button:only-child) {
  border-radius: 7px;
}

.more-actions-dropdown {
  margin-left: 4px;
}

/* ---- Right Section ---- */
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  /* 保存/提交固定贴工具栏最右（标题 max-width 封顶后不再伸展时兜底） */
  margin-left: auto;
}

.auto-save-status {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.3);
  white-space: nowrap;
}

.toolbar-right :deep(.el-button:not(.el-button--primary)) {
  background: transparent;
  border: none;
  color: #6366f1;
  font-size: 13px;
  font-weight: 500;
  padding: 4px 10px;
  height: auto;
  border-radius: 7px;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toolbar-right :deep(.el-button:not(.el-button--primary)):hover {
  background: rgba(99, 102, 241, 0.08);
  transform: scale(1.04);
}

.toolbar-right :deep(.el-button:not(.el-button--primary)):active {
  transform: scale(0.96);
  transition: transform 0.08s ease;
}

.toolbar-right :deep(.el-button--primary) {
  background: #6366f1;
  border: none;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  padding: 5px 16px;
  height: auto;
  box-shadow:
    0 1px 2px rgba(99, 102, 241, 0.2),
    0 1px 0 rgba(255, 255, 255, 0.15) inset;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toolbar-right :deep(.el-button--primary):hover {
  background: #5558e6;
  transform: scale(1.03);
  box-shadow:
    0 3px 12px rgba(99, 102, 241, 0.3),
    0 1px 0 rgba(255, 255, 255, 0.2) inset;
}

.toolbar-right :deep(.el-button--primary):active {
  transform: scale(0.97);
  transition: transform 0.08s ease;
}

/* ============================================ */
/* Toolbar Button Overrides                     */
/* ============================================ */
.toolbar-icon {
  font-size: 14px;
  line-height: 1;
}

.zoom-label {
  min-width: 42px;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.5);
  cursor: default;
}

.editor-toolbar :deep(.el-button--small) {
  height: 28px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  color: rgba(0, 0, 0, 0.6);
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.editor-toolbar :deep(.el-button--small):hover {
  background: rgba(255, 255, 255, 0.8);
  border-color: rgba(0, 0, 0, 0.16);
  color: #1d1d1f;
}

.editor-toolbar :deep(.el-button--small):active {
  transform: scale(0.94);
  transition: transform 0.08s ease;
}

.editor-toolbar :deep(.el-button--small.is-disabled) {
  background: transparent;
  border-color: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.2);
}

.editor-toolbar :deep(.el-button--small.is-disabled):hover {
  transform: none;
}

.action-group :deep(.el-button--small.is-disabled:hover) {
  transform: none;
}

.toolbar-actions .action-group :deep(.el-button--small:not(.zoom-label)),
.mobile-tools-row > :deep(.el-button--small:not(.mobile-zoom-label)) {
  width: 30px;
  min-width: 30px;
  padding: 0;
  justify-content: center;
}

/* More button */
.more-actions-btn {
  font-size: 13px;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.more-actions-btn:hover {
  transform: scale(1.04);
}

/* ============================================ */
/* Mobile Tools Panel — iOS Toolbar Style       */
/* ============================================ */
.mobile-tools-panel {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  background: rgba(248, 248, 248, 0.72);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.1);
  overflow-x: auto;
  animation: iosToolsSlideDown 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes iosToolsSlideDown {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

.mobile-tools-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  white-space: nowrap;
}

.mobile-tools-row :deep(.el-button--small) {
  font-size: 13px;
  min-width: auto;
  padding: 4px 8px;
  height: 32px;
  background: rgba(0, 0, 0, 0.03);
  border: 0.5px solid rgba(0, 0, 0, 0.08);
  color: rgba(0, 0, 0, 0.65);
}

.mobile-tools-row :deep(.el-button--small):active {
  background: rgba(0, 0, 0, 0.1);
}

.mobile-tools-row :deep(.el-button--small.is-disabled) {
  background: transparent;
  border-color: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.2);
}

.mobile-tools-sep {
  width: 0.5px;
  height: 20px;
  background: rgba(0, 0, 0, 0.1);
  margin: 0 6px;
  flex-shrink: 0;
}

.mobile-zoom-label {
  min-width: 40px;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.55);
  cursor: default;
}

.mobile-more-dropdown {
  flex-shrink: 0;
}

/* ============================================ */
/* Responsive                                   */
/* ============================================ */
@media (max-width: 1024px) {
  .auto-save-status {
    display: none;
  }
}

@media (max-width: 768px) {
  .editor-toolbar {
    height: 50px;
    padding: 0 12px;
    gap: 8px;
  }

  .project-title {
    font-size: 15px;
    max-width: 120px;
  }

  .toolbar-right {
    gap: 4px;
  }

  .toolbar-right :deep(.el-button:not(.el-button--primary)) {
    font-size: 13px;
    padding: 2px 8px;
  }

  .toolbar-right :deep(.el-button--primary) {
    font-size: 13px;
    padding: 5px 14px;
  }
}
</style>
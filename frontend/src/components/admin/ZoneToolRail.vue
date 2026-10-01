<template>
  <div class="zone-tool-rail">
    <button
      v-for="t in tools"
      :key="t.id"
      :class="['rail-btn', { active: tool === t.id }]"
      :title="`${t.label} (${t.key})`"
      :aria-label="t.label"
      @click="$emit('update:tool', t.id)"
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" v-html="t.icon"></svg>
      <span class="rail-key">{{ t.key }}</span>
    </button>

    <div class="rail-divider"></div>

    <div class="rail-hint" :title="activeHint">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  tool: { type: String, default: 'select' },
  selectionMode: { type: String, default: 'new' },
  toolLabel: { type: String, default: '' }
})

defineEmits(['update:tool'])

const tools = [
  {
    id: 'select', key: 'V', label: '移动/选择',
    icon: '<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/>'
  },
  {
    id: 'rect', key: 'M', label: '矩形选框',
    icon: '<rect x="4" y="6" width="16" height="12" rx="1" stroke-dasharray="3 2.4"/>'
  },
  {
    id: 'ellipse', key: 'E', label: '椭圆选框',
    icon: '<circle cx="12" cy="12" r="8" stroke-dasharray="3 2.4"/>'
  },
  {
    id: 'lasso', key: 'L', label: '自由套索',
    icon: '<path d="M7 5.5C3.5 7 2.5 10.5 4.5 13c1.8 2.3 5.6 3 8.8 2.2" stroke-dasharray="none"/><path d="M13.3 15.2c3.9-.9 7-3.4 6.5-6.4C19.4 6 15.8 4.4 12 5"/><circle cx="11" cy="18.4" r="2.1"/><path d="M9.4 20.2c-.9.9-2.3.9-3.2 0"/>'
  },
  {
    id: 'polygon', key: 'P', label: '多边形套索',
    icon: '<path d="M12 3.2l8 5.8-3 9.4H7L4 9z" stroke-linejoin="round"/>'
  },
  {
    id: 'wand', key: 'W', label: '魔棒（点击背景图选色）',
    icon: '<path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8L19 13"/><path d="M17.8 6.2L19 5"/><path d="M12.2 6.2L11 5"/><path d="M3 21l9-9"/><path d="M15 9h0"/>'
  }
]

const activeHint = computed(() => {
  if (props.tool === 'wand') {
    return `在背景图上点击相似颜色区域，自动识别轮廓（容差 ${props.toolLabel || ''}）`
  }
  if (props.tool === 'polygon') {
    return '点击添加顶点，双击 / Enter / 点击起点闭合，Esc 取消，Backspace 回退'
  }
  if (props.tool === 'select') {
    return '点击选择区域，拖拽移动缩放；绘制形状时按住 Shift 加选 / Alt 减选并入选中区域'
  }
  return '在页面上拖拽绘制；按住 Shift 加选 / Alt 减选并入选中区域'
})
</script>

<style scoped>
.zone-tool-rail {
  width: 52px;
  flex-shrink: 0;
  background: linear-gradient(
    180deg,
    rgba(248, 248, 250, 0.92) 0%,
    rgba(252, 252, 252, 0.82) 100%
  );
  backdrop-filter: saturate(220%) blur(24px);
  -webkit-backdrop-filter: saturate(220%) blur(24px);
  border-right: 1px solid rgba(0, 0, 0, 0.07);
  box-shadow: 1px 0 0 rgba(255, 255, 255, 0.5) inset;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0;
  gap: 4px;
  z-index: 5;
}

.rail-btn {
  position: relative;
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.rail-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #1d1d1f;
}

.rail-btn.active {
  background: #6366f1;
  color: #fff;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
}

.rail-btn:active {
  transform: scale(0.92);
}

.rail-key {
  position: absolute;
  right: 2px;
  bottom: 1px;
  font-size: 8px;
  font-weight: 700;
  opacity: 0.45;
  line-height: 1;
}

.rail-divider {
  width: 24px;
  height: 1px;
  background: rgba(0, 0, 0, 0.1);
  margin: 6px 0;
}

.rail-hint {
  margin-top: auto;
  color: rgba(0, 0, 0, 0.28);
  cursor: help;
  display: flex;
  padding: 6px;
}
</style>

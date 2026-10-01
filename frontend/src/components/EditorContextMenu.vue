<template>
  <Transition name="ctx-spring">
    <div
      v-if="visible"
      class="context-menu"
      :style="{ left: x + 'px', top: y + 'px', transformOrigin: menuOrigin }"
    >
      <div class="context-item context-item--danger" @click="$emit('delete')">
        <span>删除</span>
        <kbd>⌫</kbd>
      </div>
      <div class="context-item" @click="$emit('copy')">
        <span>复制</span>
        <kbd>⌘C</kbd>
      </div>
      <div class="context-divider"></div>
      <div class="context-item" @click="$emit('bringToFront')">
        <span>置顶</span>
        <kbd>⌘⇧]</kbd>
      </div>
      <div class="context-item" @click="$emit('sendToBack')">
        <span>置底</span>
        <kbd>⌘⇧[</kbd>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 }
})

defineEmits(['delete', 'copy', 'bringToFront', 'sendToBack'])

const menuOrigin = computed(() => {
  const originY = props.y < 200 ? 'top' : 'center'
  const originX = props.x < 200 ? 'left' : 'center'
  return `${originX} ${originY}`
})
</script>

<style scoped>
/* ============================================ */
/* macOS Context Menu — Spring + Vibrancy       */
/* ============================================ */

/* Spring scale-in */
.ctx-spring-enter-active {
  animation: ctxSpringIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.ctx-spring-leave-active {
  animation: ctxSpringOut 0.15s cubic-bezier(0.4, 0, 1, 1);
}

@keyframes ctxSpringIn {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes ctxSpringOut {
  to {
    opacity: 0;
    transform: scale(0.92);
  }
}

.context-menu {
  position: absolute;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: saturate(220%) blur(28px);
  -webkit-backdrop-filter: saturate(220%) blur(28px);
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 10px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.04),
    0 8px 24px rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(255, 255, 255, 0.4) inset;
  z-index: 1000;
  min-width: 160px;
  padding: 5px;
}

.context-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 7px 12px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.7);
  cursor: pointer;
  border-radius: 6px;
  transition:
    background 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
    color 0.2s ease;
}

.context-item kbd {
  font-family: -apple-system, 'SF Mono', 'Menlo', monospace;
  font-size: 10px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.25);
  letter-spacing: 0;
}

.context-item:hover {
  background: #6366f1;
  color: #ffffff;
}

.context-item:hover kbd {
  color: rgba(255, 255, 255, 0.6);
}

.context-item:active {
  transform: scale(0.97);
  transition: transform 0.06s ease;
}

.context-item--danger:hover {
  background: #ef4444;
}

.context-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
  margin: 3px 8px;
}

@media (max-width: 768px) {
  .context-menu {
    min-width: 170px;
    border-radius: 14px;
    padding: 8px;
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.06),
      0 16px 48px rgba(0, 0, 0, 0.14),
      0 0 0 1px rgba(255, 255, 255, 0.4) inset;
  }

  .context-item {
    padding: 12px 16px;
    font-size: 16px;
    border-radius: 10px;
  }

  .context-item kbd {
    font-size: 12px;
  }
}
</style>
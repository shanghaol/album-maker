<template>
  <nav class="bottom-nav">
    <router-link
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      class="nav-item"
    >
      <component :is="item.icon" :size="21" />
      <span class="nav-label">{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<script setup>
import { House, Sparkles, User } from '@lucide/vue'

const navItems = [
  { path: '/templates', label: '模板市场', icon: House },
  { path: '/creative', label: '创意模板', icon: Sparkles },
  { path: '/profile', label: '个人中心', icon: User }
]
</script>

<style scoped>
/*
 * 液态半透明立体磨砂玻璃导航（对齐 iOS 状态栏材质）：
 * - 材质：低透明度白色渐变 + 高斯模糊 + 饱和度提升（背后内容透出且颜色更鲜活）
 * - 立体：外层环境投影 + 接触投影，顶部内嵌高光、底部内嵌暗缘，玻璃亮边描边
 * - 液态：斜向高光扫面（::before），按压弹性缩放，激活项浮起白色玻璃胶囊
 */
.bottom-nav {
  position: fixed;
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 28px;

  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.62) 0%,
    rgba(255, 255, 255, 0.36) 100%
  );
  backdrop-filter: blur(28px) saturate(200%);
  -webkit-backdrop-filter: blur(28px) saturate(200%);

  /* 玻璃亮边：外圈透光 */
  border: 1px solid rgba(255, 255, 255, 0.55);

  /* 立体感：环境投影 + 接触投影 + 顶部内高光 + 底部内暗缘 */
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.14),
    0 2px 8px rgba(0, 0, 0, 0.08),
    inset 0 1px 1px rgba(255, 255, 255, 0.85),
    inset 0 -1px 1px rgba(0, 0, 0, 0.05);
}

/* 斜向高光扫面：玻璃表面的液态反光 */
.bottom-nav::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    115deg,
    rgba(255, 255, 255, 0.5) 0%,
    rgba(255, 255, 255, 0) 38%,
    rgba(255, 255, 255, 0) 62%,
    rgba(255, 255, 255, 0.2) 100%
  );
  pointer-events: none;
}

.nav-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 20px;
  border-radius: 20px;
  color: rgba(29, 29, 31, 0.5);
  text-decoration: none;
  transition:
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
    color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.nav-item:hover {
  color: #6366f1;
  transform: translateY(-1px);
}

/* 按压弹性反馈 */
.nav-item:active {
  transform: scale(0.9);
  transition: transform 0.1s ease;
}

/* 激活项：仅图标与文字转为靛蓝 */
.nav-item.router-link-active {
  color: #6366f1;
}

.nav-label {
  display: none;
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

@media (min-width: 768px) {
  .bottom-nav {
    gap: 10px;
    padding: 8px 18px;
  }

  .nav-label {
    display: block;
  }

  .nav-item {
    padding: 8px 22px;
  }
}
</style>

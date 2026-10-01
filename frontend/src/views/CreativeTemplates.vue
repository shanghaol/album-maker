<template>
  <div class="min-h-screen bg-app-bg text-app-text pb-24">
    <header class="cr-header">
      <div class="cr-header-inner">
        <button @click="$router.push('/profile')" class="cr-profile-btn">
          <User :size="22" />
        </button>
      </div>
    </header>

    <div class="cr-content">
      <div class="cr-grid-header">
        <h1 class="cr-heading">创意模板</h1>
        <p class="cr-subheading">进入创意模板，创作你的个性作品</p>
      </div>

      <div class="cr-grid">
        <div class="cr-card" @click="$router.push('/colorblocking')">
          <div class="cr-card-banner">
            <div
              class="cr-card-banner-bg"
              :style="{ backgroundImage: `url(${colorblockingBg})` }"
            ></div>
            <span class="cr-card-collage">Color<br>blocking</span>
          </div>
        </div>
      </div>
    </div>

    <BottomNav />
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { User } from '@lucide/vue'
import BottomNav from '@/components/BottomNav.vue'
import colorblockingBg from '@/assets/colorblocking-card-bg.png'

const router = useRouter()
</script>

<style scoped>
/* 吸顶磨砂 header */
.cr-header {
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  background: rgba(245, 245, 247, 0.72);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.cr-header-inner {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 56px;
  padding: 0 16px;
  max-width: 1536px;
  margin: 0 auto;
}

.cr-profile-btn {
  color: rgba(0, 0, 0, 0.35);
  transition: color 0.2s ease;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.cr-profile-btn:hover {
  color: #1d1d1f;
}

.cr-content {
  max-width: 680px;
  margin: 0 auto;
  padding: 24px 24px 96px;
}

.cr-grid-header {
  text-align: center;
  padding: 40px 0 36px;
}

.cr-heading {
  font-size: 32px;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.cr-subheading {
  color: rgba(0, 0, 0, 0.4);
  font-size: 14px;
  margin-top: 6px;
}

/* 单列长方形卡片（iOS 列表风格） */
.cr-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cr-card {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.45) 100%);
  backdrop-filter: blur(28px) saturate(200%);
  -webkit-backdrop-filter: blur(28px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 18px;
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

.cr-card:hover {
  border-color: rgba(255, 255, 255, 0.75);
  transform: translateY(-2px);
  box-shadow:
    0 14px 36px rgba(0, 0, 0, 0.13),
    0 2px 6px rgba(0, 0, 0, 0.05),
    inset 0 1px 1px rgba(255, 255, 255, 0.85);
}

/* iOS 按压交互：按下缩小，松手弹性回弹 */
.cr-card:active {
  transform: scale(0.96);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  transition: transform 0.12s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.12s ease;
}

/* 按压高亮层：按下时轻微压暗 */
.cr-card-banner {
  position: relative;
  height: 180px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding-left: 28px;
}

/* 模糊照片背景：inset 外扩 + 放大，避免模糊边缘露白 */
.cr-card-banner-bg {
  position: absolute;
  inset: -24px;
  background-size: cover;
  background-position: center;
  filter: blur(3px);
  transform: scale(1.05);
}

.cr-card-banner::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.06);
  opacity: 0;
  transition: opacity 0.18s ease;
  pointer-events: none;
}

.cr-card:active .cr-card-banner::after {
  opacity: 1;
  transition: opacity 0.08s ease;
}

.cr-card-collage {
  position: relative;
  z-index: 1;
  font-size: 30px;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.35);
  letter-spacing: 0.02em;
  text-align: left;
  line-height: 1.12;
}

@media (max-width: 640px) {
  .cr-header {
    padding-top: env(safe-area-inset-top, 0px);
    background: rgba(248, 248, 248, 0.72);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border-bottom: 0.5px solid rgba(0, 0, 0, 0.12);
    animation: cr-header-in 0.4s cubic-bezier(0.32, 0.72, 0, 1);
  }

  @keyframes cr-header-in {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .cr-grid-header {
    padding: 24px 0 20px;
  }

  .cr-heading {
    font-size: 24px;
  }

  .cr-card {
    border-radius: 16px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.66) 0%, rgba(255, 255, 255, 0.4) 100%);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border: 0.5px solid rgba(255, 255, 255, 0.6);
    box-shadow:
      0 8px 28px rgba(0, 0, 0, 0.08),
      0 2px 6px rgba(0, 0, 0, 0.04),
      inset 0 1px 1px rgba(255, 255, 255, 0.8);
    transition: transform 0.12s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.2s ease;
  }

  .cr-card:active {
    transform: scale(0.97);
  }

  .cr-card:hover {
    transform: none;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.08);
  }
}
</style>

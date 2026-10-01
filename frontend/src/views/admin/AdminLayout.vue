<template>
  <div class="admin-layout" :class="{ 'sidebar-open': sidebarOpen }">
    <div class="sidebar-overlay" v-if="sidebarOpen" @click="sidebarOpen = false"></div>
    <aside class="admin-sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="url(#logo-grad)"/>
            <path d="M8 18V10l6 4-6 4z" fill="#fff"/>
            <path d="M14 20V8l6 4-6 4v4z" fill="rgba(255,255,255,0.7)"/>
            <defs>
              <linearGradient id="logo-grad" x1="0" y1="0" x2="28" y2="28">
                <stop stop-color="#6366f1"/>
                <stop offset="1" stop-color="#a78bfa"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="sidebar-logo-text">
          <h2>相册管理后台</h2>
          <span class="sidebar-logo-sub">Album Maker Admin</span>
        </div>
      </div>
      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="sidebar-nav-item"
          :class="{ active: activeMenu === item.path }"
          @click="sidebarOpen = false"
        >
          <component :is="item.icon" :size="18" class="sidebar-nav-icon" />
          <span>{{ item.label }}</span>
          <span v-if="activeMenu === item.path" class="sidebar-nav-dot"></span>
        </router-link>
      </nav>
      <div class="sidebar-footer">
        <button class="sidebar-logout" @click="handleLogout">
          <LogOut :size="16" />
          <span>退出登录</span>
        </button>
      </div>
    </aside>
    <div class="admin-main">
      <header class="admin-topbar">
        <button class="hamburger-btn" @click="sidebarOpen = !sidebarOpen" aria-label="切换菜单">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div class="admin-breadcrumb">
          <span class="breadcrumb-label">{{ currentPageLabel }}</span>
        </div>
        <div class="admin-topbar-right">
          <div class="admin-user-avatar">
            {{ (authStore.user?.nickname || 'A')[0] }}
          </div>
          <span class="admin-username">{{ authStore.user?.nickname }}</span>
        </div>
      </header>
      <main class="admin-content">
        <router-view />
      </main>
    </div>
    <div class="admin-bg-decor">
      <div class="admin-bg-blob admin-bg-blob--1"></div>
      <div class="admin-bg-blob admin-bg-blob--2"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { LayoutDashboard, Images, FolderOpen, Scissors, Download, LogOut } from '@lucide/vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const sidebarOpen = ref(false)

const activeMenu = computed(() => route.path)

const currentPageLabel = computed(() => {
  const item = navItems.find(n => route.path.startsWith(n.path))
  return item ? item.label : ''
})

const navItems = [
  { path: '/admin/dashboard', label: '工作台', icon: LayoutDashboard },
  { path: '/admin/templates', label: '模板管理', icon: Images },
  { path: '/admin/projects', label: '用户项目', icon: FolderOpen },
  { path: '/admin/stickers', label: '贴纸管理', icon: Scissors },
  { path: '/admin/export', label: '导出素材', icon: Download }
]

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  height: 100vh;
  background: #f8f8fa;
  position: relative;
  overflow: hidden;
}

/* ---- Background decorations ---- */
.admin-bg-decor {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.admin-bg-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.12;
}

.admin-bg-blob--1 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, #818cf8, #6366f1);
  top: -200px;
  right: -150px;
  animation: blob-float 20s ease-in-out infinite;
}

.admin-bg-blob--2 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, #c4b5fd, #a78bfa);
  bottom: -150px;
  left: -100px;
  animation: blob-float 25s ease-in-out infinite reverse;
}

@keyframes blob-float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -30px) scale(1.05); }
  50% { transform: translate(-20px, 20px) scale(0.95); }
  75% { transform: translate(-30px, -10px) scale(1.02); }
}

/* ---- Sidebar ---- */
.admin-sidebar {
  width: 260px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  flex-shrink: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  z-index: 10;
  transition: width 0.3s ease;
}

.sidebar-logo {
  padding: 28px 20px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.sidebar-logo-icon {
  flex-shrink: 0;
}

.sidebar-logo-text h2 {
  color: #1a1a2e;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.sidebar-logo-sub {
  color: rgba(0, 0, 0, 0.3);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.sidebar-nav {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: 12px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}

.sidebar-nav-item:hover {
  background: rgba(0, 0, 0, 0.03);
  color: rgba(0, 0, 0, 0.7);
}

.sidebar-nav-item.active {
  background: rgba(99, 102, 241, 0.08);
  color: #6366f1;
  font-weight: 600;
}

.sidebar-nav-dot {
  position: absolute;
  right: 14px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6366f1;
}

.sidebar-nav-icon {
  flex-shrink: 0;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.sidebar-logout {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 11px 14px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: rgba(0, 0, 0, 0.35);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.sidebar-logout:hover {
  background: rgba(239, 68, 68, 0.06);
  color: #f87171;
}

/* ---- Main area ---- */
.admin-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  z-index: 10;
  position: relative;
}

.admin-topbar {
  height: 60px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  flex-shrink: 0;
  z-index: 20;
}

.admin-breadcrumb {
  display: flex;
  align-items: center;
}

.breadcrumb-label {
  color: rgba(0, 0, 0, 0.5);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.admin-topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #a78bfa);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.admin-username {
  color: rgba(0, 0, 0, 0.55);
  font-size: 13px;
  font-weight: 500;
}

.admin-content {
  flex: 1;
  padding: 36px 32px;
  overflow-y: auto;
  position: relative;
}

/* ---- Extra wide screens: center content ---- */
@media (min-width: 1600px) {
  .admin-content {
    padding: 40px 48px;
  }
}

/* ---- Hamburger button ---- */
.hamburger-btn {
  display: none;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  width: 36px;
  height: 36px;
  padding: 6px;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s;
}

.hamburger-btn:hover {
  background: rgba(0, 0, 0, 0.04);
}

.hamburger-btn span {
  display: block;
  width: 18px;
  height: 2px;
  background: rgba(0, 0, 0, 0.45);
  border-radius: 1px;
  transition: all 0.25s ease;
}

/* Sidebar overlay (mobile) */
.sidebar-overlay {
  display: none;
}

/* Tablet */
@media (max-width: 1024px) {
  .admin-sidebar {
    width: 240px;
  }

  .admin-content {
    padding: 24px 20px;
  }
}

/* Mobile */
@media (max-width: 768px) {
  .hamburger-btn {
    display: flex;
  }

  .admin-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 1000;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    width: 280px;
  }

  .admin-sidebar.open {
    transform: translateX(0);
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    z-index: 999;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .admin-topbar {
    padding: 0 16px;
  }

  .admin-content {
    padding: 20px 16px;
  }

  .breadcrumb-label {
    display: none;
  }

  .admin-username {
    display: none;
  }
}
</style>
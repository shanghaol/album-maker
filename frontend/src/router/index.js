import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/',
    redirect: '/templates'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { guest: true, title: '登录', transition: 'page-fade' }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { guest: true, title: '注册', transition: 'page-fade' }
  },
  {
    path: '/templates',
    name: 'Templates',
    component: () => import('@/views/TemplateList.vue'),
    meta: { requiresAuth: true, title: '选择模板' }
  },
  {
    path: '/creative',
    name: 'Creative',
    component: () => import('@/views/CreativeTemplates.vue'),
    meta: { requiresAuth: true, title: '创意模板' }
  },
  {
    path: '/editor/:projectId',
    name: 'Editor',
    component: () => import('@/views/EditorView.vue'),
    meta: { requiresAuth: true, title: '编辑器' }
  },
  {
    // 创意编辑器（创意模板专用，含色块/装饰/自由照片平铺）
    path: '/creative-editor/:projectId',
    name: 'CreativeEditor',
    component: () => import('@/views/EditorView.vue'),
    meta: { requiresAuth: true, title: '创意编辑器' }
  },
  {
    // Colorblocking 拼贴编辑器（独立创意工具，草稿存本地）
    path: '/colorblocking',
    name: 'ColorblockingEditor',
    component: () => import('@/views/ColorblockingEditor.vue'),
    meta: { requiresAuth: true, title: 'colorblocking' }
  },
  {
    // 我的项目已并入个人中心（v1.5 需求），旧链接兼容跳转
    path: '/my-projects',
    redirect: '/profile'
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { requiresAuth: true, title: '个人中心' }
  },
  {
    path: '/preview/:projectId',
    name: 'Preview',
    component: () => import('@/views/H5Preview.vue'),
    meta: { requiresAuth: true, title: '预览' }
  },
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: '管理后台' },
    children: [
      {
        path: '',
        redirect: '/admin/dashboard'
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/admin/Dashboard.vue'),
        meta: { title: '仪表盘' }
      },
      {
        path: 'templates',
        name: 'AdminTemplates',
        component: () => import('@/views/admin/TemplateManage.vue'),
        meta: { title: '模板管理' }
      },
      {
        path: 'templates/:id/zones',
        name: 'TemplateZones',
        component: () => import('@/views/admin/AdminTemplateEditor.vue'),
        meta: { title: '模板编辑' }
      },
      {
        path: 'projects',
        name: 'AdminProjects',
        component: () => import('@/views/admin/ProjectList.vue'),
        meta: { title: '项目管理' }
      },
      {
        path: 'stickers',
        name: 'AdminStickers',
        component: () => import('@/views/admin/StickerManage.vue'),
        meta: { title: '贴纸管理' }
      },
      {
        path: 'export',
        name: 'AdminExport',
        component: () => import('@/views/admin/ExportManage.vue'),
        meta: { title: '导出管理' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// ============================================
// Navigation Direction Tracking (for page transitions)
// ============================================
const navStack = []

router.beforeEach((to, from, next) => {
  // first page load or same-page (param change)
  if (!from.name || from.fullPath === to.fullPath) {
    to.meta._direction = 'forward'
    if (!from.name && to.fullPath) {
      navStack.push(to.fullPath)
    }
    return next()
  }

  // check if going back to a page earlier in the stack
  const stackIdx = navStack.lastIndexOf(to.fullPath)
  if (stackIdx >= 0 && stackIdx < navStack.length - 1) {
    to.meta._direction = 'back'
    navStack.length = stackIdx + 1
  } else {
    to.meta._direction = 'forward'
    navStack.push(to.fullPath)
  }

  next()
})

// ============================================
// Auth Guard
// ============================================
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    next('/login')
  } else if (to.meta.requiresAdmin && authStore.user?.role !== 'ADMIN') {
    next('/login')
  } else if (to.meta.guest && authStore.isLoggedIn) {
    if (authStore.user?.role === 'ADMIN') {
      next('/admin/dashboard')
    } else {
      next('/templates')
    }
  } else {
    next()
  }
})

router.afterEach((to) => {
  const title = to.meta.title
  document.title = title ? `${title} - 相册制作` : '相册制作平台'
})

export default router
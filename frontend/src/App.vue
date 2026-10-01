<template>
  <div class="app-shell">
    <router-view v-slot="{ Component, route }">
      <transition :name="getTransition(route)">
        <component :is="Component" :key="getRouteKey(route)" />
      </transition>
    </router-view>
  </div>
</template>

<script setup>
function getRouteKey(route) {
  if (route.path.startsWith('/admin')) return undefined
  return route.fullPath
}

function getTransition(route) {
  if (route.path.startsWith('/admin')) return ''
  if (route.meta.transition === 'page-fade') return 'page-fade'
  return route.meta._direction === 'back' ? 'page-back' : 'page-forward'
}
</script>

<style scoped>
.app-shell {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
}
</style>
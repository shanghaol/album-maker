import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login, register } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
  const token = ref(localStorage.getItem('token') || '')

  const isLoggedIn = computed(() => !!token.value)

  async function doLogin(account, password) {
    const res = await login({ account, password })
    setAuth(res.data.data)
  }

  async function doRegister(phone, password, nickname) {
    const res = await register({ phone, password, nickname })
    setAuth(res.data.data)
  }

  function setAuth(data) {
    user.value = { id: data.userId, nickname: data.nickname, role: data.role }
    token.value = data.token
    localStorage.setItem('user', JSON.stringify(user.value))
    localStorage.setItem('token', data.token)
  }

  function logout() {
    user.value = null
    token.value = ''
    localStorage.removeItem('user')
    localStorage.removeItem('token')
  }

  return { user, token, isLoggedIn, doLogin, doRegister, logout }
})
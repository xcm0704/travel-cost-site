<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import http from '../api/client.js'
import { saveLogin } from '../stores/session.js'
import { checkPassword, checkUsername } from '../utils/validate.js'
import { toastOk } from '../stores/toast.js'

const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = checkUsername(username.value) || checkPassword(password.value)
  if (error.value) return
  busy.value = true
  try {
    const data = await http.post('/auth/login', {
      username: username.value.trim(),
      password: password.value
    })
    saveLogin(data)
    const isAdmin = data.user && data.user.role === 'admin'
    toastOk(isAdmin ? '管理员登录成功' : '登录成功，开始查费用吧')
    if (isAdmin) {
      router.replace('/admin/data')
      return
    }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    router.replace(redirect && redirect.indexOf('/admin') !== 0 ? redirect : '/')
  } catch (e) {
    error.value = e.userMessage || '登录失败，稍后再试'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="auth-wrap">
    <div class="auth-card rise">
      <p class="auth-mark">行价 · Xingjia</p>
      <h1 class="auth-title">登录</h1>
      <p class="auth-sub">登录后就能查酒店、门票和车费。</p>

      <form class="auth-form" @submit.prevent="submit">
        <label class="field">
          <span class="field-label">用户名</span>
          <input
            v-model="username"
            class="input"
            type="text"
            autocomplete="username"
            placeholder="3 到 20 个字"
            maxlength="20"
          />
        </label>

        <label class="field">
          <span class="field-label">密码</span>
          <input
            v-model="password"
            class="input"
            type="password"
            autocomplete="current-password"
            placeholder="6 到 32 个字"
            maxlength="32"
          />
        </label>

        <p v-if="error" class="form-error">{{ error }}</p>

        <button class="btn btn-primary btn-wide" type="submit" :disabled="busy">
          {{ busy ? '正在登录…' : '登录' }}
        </button>
      </form>

      <p class="auth-foot">还没有账号？<RouterLink to="/register">去注册</RouterLink></p>
    </div>
  </div>
</template>

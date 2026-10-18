<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import http from '../api/client.js'
import { saveLogin } from '../stores/session.js'
import { checkConfirm, checkPassword, checkUsername } from '../utils/validate.js'
import { toastOk } from '../stores/toast.js'

const router = useRouter()

const username = ref('')
const password = ref('')
const confirm = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value =
    checkUsername(username.value) ||
    checkPassword(password.value) ||
    checkConfirm(password.value, confirm.value)
  if (error.value) return
  busy.value = true
  try {
    const data = await http.post('/auth/register', {
      username: username.value.trim(),
      password: password.value
    })
    saveLogin(data)
    toastOk('注册成功，已经帮你登录了')
    router.replace('/')
  } catch (e) {
    error.value = e.userMessage || '注册失败，稍后再试'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="auth-wrap">
    <div class="auth-card rise">
      <p class="auth-mark">行价 · Xingjia</p>
      <h1 class="auth-title">注册</h1>
      <p class="auth-sub">只要用户名和密码，不用手机号。</p>

      <form class="auth-form" @submit.prevent="submit">
        <label class="field">
          <span class="field-label">用户名</span>
          <input
            v-model="username"
            class="input"
            type="text"
            autocomplete="username"
            placeholder="3 到 20 个字，中英文数字下划线"
            maxlength="20"
          />
          <span class="field-hint">例子：xiaoliu、大连老王、travel_2026</span>
        </label>

        <label class="field">
          <span class="field-label">密码</span>
          <input
            v-model="password"
            class="input"
            type="password"
            autocomplete="new-password"
            placeholder="6 到 32 个字"
            maxlength="32"
          />
        </label>

        <label class="field">
          <span class="field-label">确认密码</span>
          <input
            v-model="confirm"
            class="input"
            type="password"
            autocomplete="new-password"
            placeholder="再输一遍"
            maxlength="32"
          />
        </label>

        <p v-if="error" class="form-error">{{ error }}</p>

        <button class="btn btn-primary btn-wide" type="submit" :disabled="busy">
          {{ busy ? '正在注册…' : '注册并登录' }}
        </button>
      </form>

      <p class="auth-foot">已经有账号？<RouterLink to="/login">去登录</RouterLink></p>
    </div>
  </div>
</template>

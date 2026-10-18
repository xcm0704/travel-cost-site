<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { session, clearLogin } from './stores/session.js'
import { toastOk } from './stores/toast.js'
import ToastHost from './components/ToastHost.vue'
import SharePanel from './components/SharePanel.vue'

const route = useRoute()
const router = useRouter()

const shareOpen = ref(false)

const bare = computed(function () { return !!route.meta.public })
const isAdminUser = computed(function () { return !!(session.user && session.user.role === 'admin') })
const username = computed(function () { return (session.user && session.user.username) || '' })

function logout() {
  clearLogin()
  toastOk('已退出登录')
  router.replace('/login')
}
</script>

<template>
  <div class="shell" :class="{ 'shell-bare': bare }">
    <header v-if="!bare" class="topbar">
      <div class="topbar-inner">
        <RouterLink to="/" class="brand">
          <span class="brand-mark" aria-hidden="true">行</span>
          <span class="brand-text">
            <strong>行价</strong>
            <small>旅费预算</small>
          </span>
        </RouterLink>

        <nav class="nav">
          <template v-if="isAdminUser">
            <RouterLink to="/admin/data" class="nav-link">数据管理</RouterLink>
            <RouterLink to="/admin/overview" class="nav-link">数据总览</RouterLink>
            <RouterLink to="/admin/users" class="nav-link">注册用户</RouterLink>
          </template>
          <template v-else>
            <RouterLink to="/" class="nav-link">查费用</RouterLink>
          </template>
          <span v-if="username" class="nav-user" :title="'当前账号 ' + username">{{ username }}</span>
          <button type="button" class="nav-link nav-share" @click="shareOpen = true">分享</button>
          <button type="button" class="nav-link nav-quit" @click="logout">退出</button>
        </nav>
      </div>
    </header>

    <main class="main">
      <RouterView />
    </main>

    <SharePanel v-model:open="shareOpen" />
    <ToastHost />
  </div>
</template>

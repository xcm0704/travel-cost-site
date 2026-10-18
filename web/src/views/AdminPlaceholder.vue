<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const titles = {
  'admin-data': '数据管理',
  'admin-overview': '数据总览',
  'admin-users': '注册用户'
}
const title = computed(function () { return titles[route.name] || '管理端' })
</script>

<template>
  <div class="page">
    <section class="section rise">
      <p class="eyebrow">ADMIN · 管理端</p>
      <h1 class="display">正在开发</h1>
      <p class="lede">「{{ title }}」页面已经占好路由，界面由管理端同事补上。骨架、鉴权、接口封装都已就绪。</p>
    </section>

    <section class="section rise rise-2">
      <div class="ticket">
        <div class="ticket-head">
          <h2 class="ticket-title">占位说明</h2>
          <span class="ticket-sub">/admin/*</span>
        </div>
        <hr class="perf" />
        <ul class="line-list">
          <li class="line-item"><span class="lb">路由预留</span><span class="am">/admin/data · /admin/overview · /admin/users</span></li>
          <li class="line-item"><span class="lb">权限守卫</span><span class="am">role=admin 才放行</span></li>
          <li class="line-item"><span class="lb">请求封装</span><span class="am">src/api/client.js</span></li>
        </ul>
        <hr class="perf" />
        <RouterLink to="/" class="btn btn-ghost btn-wide">回用户端查费用</RouterLink>
      </div>
    </section>
  </div>
</template>

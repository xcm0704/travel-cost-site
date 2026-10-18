import { createRouter, createWebHistory } from 'vue-router'
import { session } from './stores/session.js'
import { toastError } from './stores/toast.js'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: function () { return import('./views/Login.vue') },
    meta: { public: true, title: '登录' }
  },
  {
    path: '/register',
    name: 'register',
    component: function () { return import('./views/Register.vue') },
    meta: { public: true, title: '注册' }
  },
  {
    path: '/',
    name: 'home',
    component: function () { return import('./views/Home.vue') },
    meta: { title: '查费用' }
  },
  {
    path: '/estimate',
    name: 'estimate',
    component: function () { return import('./views/Estimate.vue') },
    meta: { title: '费用明细' }
  },

  // ---- 管理端：真实页面在 src/views/admin/ ----
  {
    path: '/admin',
    redirect: '/admin/data'
  },
  {
    path: '/admin/data',
    name: 'admin-data',
    component: function () { return import('./views/admin/DataManage.vue') },
    meta: { admin: true, title: '数据管理' }
  },
  {
    path: '/admin/overview',
    name: 'admin-overview',
    component: function () { return import('./views/admin/Overview.vue') },
    meta: { admin: true, title: '数据总览' }
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    component: function () { return import('./views/admin/Users.vue') },
    meta: { admin: true, title: '注册用户' }
  },

  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes: routes,
  scrollBehavior: function () { return { top: 0 } }
})

router.beforeEach(function (to) {
  const loggedIn = !!session.token
  const isAdminUser = !!(session.user && session.user.role === 'admin')

  if (to.meta.public) {
    // 已登录的人再进登录/注册页，直接送到该去的地方
    if (loggedIn) return isAdminUser ? '/admin/data' : '/'
    return true
  }

  if (!loggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (to.meta.admin && !isAdminUser) {
    toastError('只有管理员能进管理端')
    return '/'
  }

  return true
})

router.afterEach(function (to) {
  const t = to.meta && to.meta.title
  document.title = t ? t + ' · 行价' : '行价 · 旅游费用查询'
})

export default router

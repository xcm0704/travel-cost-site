import axios from 'axios'
import { session, clearLogin } from '../stores/session.js'
import { toastError } from '../stores/toast.js'

// 统一 axios 实例：自动带 Bearer token、401 清 token 跳登录、失败弹中文提示。
const http = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

http.interceptors.request.use(function (config) {
  if (session.token) {
    config.headers.Authorization = 'Bearer ' + session.token
  }
  return config
})

function statusText(status) {
  if (status === 400) return '填的内容不对，检查一下再试'
  if (status === 401) return '登录已过期，请重新登录'
  if (status === 403) return '只有管理员能做这个'
  if (status === 404) return '没找到数据'
  if (status === 500) return '服务器出问题了，稍后再试'
  return '网络不太顺，稍后再试'
}

let leaving = false

function jumpToLogin() {
  clearLogin()
  const path = window.location.pathname
  if (path === '/login' || path === '/register' || leaving) return
  leaving = true
  // 留一点时间让中文提示先被看见，再整页跳登录
  setTimeout(function () { window.location.assign('/login') }, 900)
}

http.interceptors.response.use(
  function (res) {
    return res.data
  },
  function (error) {
    if (error.response) {
      const status = error.response.status
      const data = error.response.data
      const msg = (data && data.error) || statusText(status)
      if (status === 401) {
        toastError(msg)
        jumpToLogin()
      } else {
        toastError(msg)
      }
      error.userMessage = msg
    } else if (error.code === 'ECONNABORTED') {
      toastError('请求超时，检查一下网络')
      error.userMessage = '请求超时，检查一下网络'
    } else {
      toastError('连不上服务器，确认后端已经起来了')
      error.userMessage = '连不上服务器，确认后端已经起来了'
    }
    return Promise.reject(error)
  }
)

export default http
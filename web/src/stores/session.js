import { reactive, computed } from 'vue'

const TOKEN_KEY = 'travel_token'
const USER_KEY = 'travel_user'

function readUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

export const session = reactive({
  token: localStorage.getItem(TOKEN_KEY) || '',
  user: readUser()
})

export const isLoggedIn = computed(() => !!session.token)
export const isAdmin = computed(() => session.user && session.user.role === 'admin')

export function saveLogin(payload) {
  session.token = payload.token || ''
  session.user = payload.user || null
  if (session.token) localStorage.setItem(TOKEN_KEY, session.token)
  if (session.user) localStorage.setItem(USER_KEY, JSON.stringify(session.user))
}

export function setUser(user) {
  session.user = user || null
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(USER_KEY)
}

export function clearLogin() {
  session.token = ''
  session.user = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

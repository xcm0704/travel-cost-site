import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import './styles/main.css'

createApp(App).use(router).mount('#app')

// Netlify 免费版会在页面右下角注入「Powered by Netlify」角标（iframe#nl-badge-frame），
// 它盖住底部固定条上的「算总价」按钮。检测到它就给 <html> 加类，让固定条上移让位。
function markNetlifyBadge() {
  if (document.getElementById('nl-badge-frame')) {
    document.documentElement.classList.add('has-nl-badge')
    return true
  }
  return false
}
if (!markNetlifyBadge()) {
  let tries = 0
  const timer = setInterval(() => {
    if (markNetlifyBadge() || ++tries > 40) clearInterval(timer)
  }, 250)
}

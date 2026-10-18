<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { toastOk, toastError } from '../stores/toast.js'

const props = defineProps({
  open: { type: Boolean, default: false }
})
const emit = defineEmits(['update:open'])

const url = ref('')
const canvasRef = ref(null)
const urlRef = ref(null)
const qrError = ref('')
const copying = ref(false)
const copied = ref(false)

// 打开时再读 UA：微信内置浏览器里要额外提示「···」分享入口
const isWeChat = ref(false)

function close() {
  emit('update:open', false)
}

async function renderQr() {
  qrError.value = ''
  await nextTick()
  if (!canvasRef.value) return
  try {
    // 二维码库单独分包，首屏不加载
    const mod = await import('qrcode')
    const QRCode = mod.default || mod
    await QRCode.toCanvas(canvasRef.value, url.value, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0e4a55', light: '#fffdf7' }
    })
  } catch (e) {
    qrError.value = '二维码没画出来，直接用下面的网址也行'
  }
}

function fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch (e) {
    return false
  }
}

async function copyLink() {
  if (copying.value) return
  copying.value = true
  copied.value = false
  let ok = false
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url.value)
      ok = true
    }
  } catch (e) {
    ok = false
  }
  if (!ok) ok = fallbackCopy(url.value)
  copying.value = false
  if (ok) {
    copied.value = true
    toastOk('链接已复制，去微信粘给朋友吧')
    setTimeout(function () { copied.value = false }, 2200)
  } else {
    // 微信内置浏览器会锁剪贴板，只能提示手动选中
    if (urlRef.value && window.getSelection) {
      const range = document.createRange()
      range.selectNodeContents(urlRef.value)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    }
    toastError('复制被浏览器拦了，长按上面选中的网址手动复制')
  }
}

function onKey(e) {
  if (e.key === 'Escape') close()
}

watch(
  function () { return props.open },
  function (v) {
    if (v) {
      url.value = window.location.href
      isWeChat.value = /micromessenger/i.test(navigator.userAgent || '')
      renderQr()
      window.addEventListener('keydown', onKey)
    } else {
      window.removeEventListener('keydown', onKey)
    }
  },
  { immediate: true }
)

onBeforeUnmount(function () {
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="share-mask" @click.self="close">
        <div class="share-panel" role="dialog" aria-modal="true" aria-label="分享这个页面">
          <div class="share-head">
            <h2 class="share-title">分享给朋友</h2>
            <button type="button" class="share-close" aria-label="关闭分享" @click="close">×</button>
          </div>

          <div class="share-body">
            <div class="qr-box">
              <canvas ref="canvasRef" class="qr-canvas" width="180" height="180"></canvas>
              <p v-if="qrError" class="form-error" style="margin: 8px 0 0">{{ qrError }}</p>
            </div>

            <p class="share-tip">让朋友用微信「扫一扫」扫这个码，或者复制链接发过去。</p>

            <p ref="urlRef" class="share-url">{{ url }}</p>

            <p class="share-price-note">页面里的价格都是参考价，以实际下单时为准。</p>

            <p v-if="isWeChat" class="share-wechat">
              微信里也可以点右上角「···」→「发送给朋友」或「分享到朋友圈」。
            </p>

            <div class="actions" style="margin-top: 14px">
              <button type="button" class="btn btn-primary btn-block" :disabled="copying" @click="copyLink">
                {{ copied ? '已复制 ✓' : (copying ? '正在复制…' : '复制链接') }}
              </button>
              <button type="button" class="btn btn-ghost btn-block" @click="close">关闭</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
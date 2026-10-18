<script setup>
import { watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  sub: { type: String, default: '' }
})
const emit = defineEmits(['close'])

function onKey(e) {
  if (e.key === 'Escape') emit('close')
}

function teardown() {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
}

watch(function () { return props.open }, function (open) {
  if (open) {
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
  } else {
    teardown()
  }
})

onBeforeUnmount(teardown)
</script>

<template>
  <Teleport to="body">
    <Transition name="adm-fade">
      <div v-if="open" class="adm-overlay" @click.self="emit('close')">
        <div class="adm-dialog" role="dialog" aria-modal="true" :aria-label="title">
          <header class="adm-dialog-head">
            <div class="adm-dialog-heading">
              <p class="adm-dialog-kicker">{{ sub || '行价 · 管理端' }}</p>
              <h2 class="adm-dialog-title">{{ title }}</h2>
            </div>
            <button type="button" class="adm-x" aria-label="关闭" @click="emit('close')">×</button>
          </header>

          <div class="adm-dialog-body">
            <slot />
          </div>

          <footer class="adm-dialog-foot">
            <slot name="foot" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.adm-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(22, 39, 42, 0.42);
  backdrop-filter: blur(3px);
  overflow-y: auto;
}

.adm-dialog {
  width: min(520px, 100%);
  max-height: min(88vh, 780px);
  display: flex;
  flex-direction: column;
  background: var(--paper-lift, #fffdf7);
  border: 1px solid var(--line-strong, #cfc6b3);
  border-radius: 16px;
  box-shadow: 0 24px 60px -24px rgba(22, 39, 42, 0.6);
  overflow: hidden;
  position: relative;
}
.adm-dialog::after {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  background: linear-gradient(90deg, var(--teal, #0e4a55) 0%, var(--teal-mid, #15616d) 45%, var(--clay, #b95f27) 100%);
}

.adm-dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 20px 12px;
  border-bottom: 1px dashed var(--line-strong, #cfc6b3);
}
.adm-dialog-heading { min-width: 0; }
.adm-dialog-kicker {
  margin: 0;
  font-family: var(--font-num, monospace);
  font-size: 10.5px;
  letter-spacing: 0.18em;
  color: var(--clay, #b95f27);
  text-transform: uppercase;
}
.adm-dialog-title {
  margin: 4px 0 0;
  font-family: var(--font-display, serif);
  font-size: 19px;
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 1.35;
}

.adm-x {
  flex: none;
  width: 32px;
  height: 32px;
  border: 1px solid var(--line, #e2dbcc);
  border-radius: 999px;
  background: var(--paper-lift, #fffdf7);
  color: var(--ink-soft, #566b6d);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s ease;
}
.adm-x:hover { color: var(--danger, #a5341f); border-color: var(--danger, #a5341f); }

.adm-dialog-body { padding: 16px 20px 4px; overflow-y: auto; min-height: 0; }

.adm-dialog-foot {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 14px 20px 18px;
}
.adm-dialog-foot :deep(.btn) { flex: none; }

.adm-fade-enter-active, .adm-fade-leave-active { transition: opacity 0.18s ease; }
.adm-fade-enter-from, .adm-fade-leave-to { opacity: 0; }
.adm-fade-enter-active .adm-dialog { animation: adm-pop 0.22s cubic-bezier(0.22, 0.7, 0.3, 1) both; }
@keyframes adm-pop {
  from { opacity: 0; transform: translateY(10px) scale(0.99); }
  to { opacity: 1; transform: none; }
}

@media (max-width: 720px) {
  .adm-overlay { padding: 0; align-items: flex-end; }
  .adm-dialog {
    width: 100%;
    max-height: 92vh;
    border-radius: 16px 16px 0 0;
    border-bottom: 0;
  }
  .adm-dialog-head { padding: 18px 15px 11px; }
  .adm-dialog-body { padding: 14px 15px 4px; }
  .adm-dialog-foot { padding: 12px 15px calc(14px + env(safe-area-inset-bottom, 0px)); }
  .adm-dialog-foot :deep(.btn) { flex: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .adm-fade-enter-active .adm-dialog { animation: none; }
}
</style>

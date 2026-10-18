<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: function () { return [] } },
  placeholder: { type: String, default: '搜城市名' },
  label: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const q = ref(props.modelValue || '')
const wrap = ref(null)

const list = computed(function () {
  const all = props.options || []
  const k = String(q.value || '').trim().toLowerCase()
  if (!k) return all.slice(0, 40)
  return all.filter(function (c) { return String(c).toLowerCase().indexOf(k) > -1 }).slice(0, 40)
})

const exact = computed(function () {
  return (props.options || []).indexOf(String(q.value || '').trim()) > -1
})

watch(function () { return props.modelValue }, function (v) {
  if ((v || '') !== q.value) q.value = v || ''
})

function pick(city) {
  q.value = city
  emit('update:modelValue', city)
  open.value = false
}

function onInput() {
  emit('update:modelValue', q.value)
  open.value = true
}

function onEnter(e) {
  if (!open.value) {
    open.value = true
    return
  }
  const typed = String(q.value || '').trim()
  const hit = list.value.indexOf(typed) > -1 ? typed : (list.value.length === 1 ? list.value[0] : '')
  if (hit) {
    e.preventDefault()
    pick(hit)
    return
  }
  open.value = false
}

function clear() {
  q.value = ''
  emit('update:modelValue', '')
  open.value = false
}

function onOutside(e) {
  if (wrap.value && !wrap.value.contains(e.target)) open.value = false
}

onMounted(function () { document.addEventListener('mousedown', onOutside) })
onBeforeUnmount(function () { document.removeEventListener('mousedown', onOutside) })
</script>

<template>
  <div ref="wrap" class="cp">
    <div class="cp-box">
      <input
        v-model="q"
        class="input cp-input"
        type="text"
        autocomplete="off"
        :placeholder="placeholder"
        :aria-label="label || placeholder"
        role="combobox"
        :aria-expanded="open ? 'true' : 'false'"
        @input="onInput"
        @focus="open = true"
        @keydown.enter="onEnter"
        @keydown.esc="open = false"
      />
      <button v-if="q" type="button" class="cp-x" aria-label="清空" @click="clear">×</button>
      <span v-else class="cp-caret" aria-hidden="true">▾</span>
    </div>

    <ul v-if="open" class="cp-list" role="listbox">
      <li
        v-for="c in list"
        :key="c"
        class="cp-opt"
        :class="{ 'is-on': c === modelValue }"
        role="option"
        :aria-selected="c === modelValue ? 'true' : 'false'"
        @mousedown.prevent="pick(c)"
      >{{ c }}</li>
      <li v-if="!list.length" class="cp-none">没有这个城市</li>
    </ul>

    <p v-if="q && !exact && !open" class="cp-warn">城市列表里没有「{{ String(q).trim() }}」，查不到就换一个</p>
  </div>
</template>

<style scoped>
.cp { position: relative; min-width: 0; }

.cp-box { position: relative; }
.cp-input { padding-right: 34px; }

.cp-x, .cp-caret {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: none;
  color: var(--ink-faint, #8b9a99);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.cp-caret { cursor: default; font-size: 11px; }
.cp-x:hover { background: var(--clay-soft, #f6e7dc); color: var(--clay, #b95f27); }

.cp-list {
  position: absolute;
  z-index: 8;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  margin: 0;
  padding: 4px;
  list-style: none;
  max-height: 216px;
  overflow-y: auto;
  background: var(--paper-lift, #fffdf7);
  border: 1px solid var(--line-strong, #cfc6b3);
  border-radius: var(--radius-sm, 8px);
  box-shadow: 0 12px 28px -16px rgba(22, 39, 42, 0.55);
  scrollbar-width: thin;
}

.cp-opt {
  padding: 7px 9px;
  border-radius: 6px;
  font-size: 14px;
  color: var(--ink, #16272a);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cp-opt:hover { background: var(--teal-soft, #e3eeed); color: var(--teal, #0e4a55); }
.cp-opt.is-on { background: var(--teal, #0e4a55); color: #f8f3e7; font-weight: 600; }

.cp-none {
  padding: 7px 9px;
  font-size: 12.5px;
  color: var(--ink-faint, #8b9a99);
}

.cp-warn {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--clay, #b95f27);
}
</style>

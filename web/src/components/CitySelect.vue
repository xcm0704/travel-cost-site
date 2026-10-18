<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: function () { return [] } },
  placeholder: { type: String, default: '选一个城市' },
  searchPlaceholder: { type: String, default: '搜城市' }
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const q = ref('')

const filtered = computed(function () {
  const kw = q.value.trim()
  if (!kw) return props.options
  return props.options.filter(function (c) { return String(c).indexOf(kw) > -1 })
})

function toggle() {
  open.value = !open.value
  if (open.value) {
    q.value = ''
    document.addEventListener('click', onDocClick)
    window.addEventListener('keydown', onKey)
  } else {
    detach()
  }
}

function detach() {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('keydown', onKey)
}

function onDocClick() {
  if (open.value) {
    open.value = false
    detach()
  }
}

function onKey(e) {
  if (e.key === 'Escape') {
    open.value = false
    detach()
  }
}

function choose(c) {
  emit('update:modelValue', c)
  open.value = false
  detach()
}

onBeforeUnmount(detach)
</script>

<template>
  <div class="cselect" :class="{ 'is-open': open }">
    <button
      type="button"
      class="cselect-btn"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click.stop="toggle"
    >
      <span :class="{ 'cselect-ph': !modelValue }">{{ modelValue || placeholder }}</span>
      <span class="cselect-caret" aria-hidden="true">▾</span>
    </button>

    <div v-if="open" class="cselect-pop" @click.stop>
      <input
        v-model="q"
        class="input cselect-input"
        type="search"
        inputmode="search"
        :placeholder="searchPlaceholder"
        aria-label="搜索城市"
      />
      <ul class="cselect-list" role="listbox">
        <li v-for="c in filtered" :key="c">
          <button
            type="button"
            class="cselect-opt"
            :class="{ active: c === modelValue }"
            role="option"
            :aria-selected="c === modelValue"
            @click="choose(c)"
          >
            {{ c }}
          </button>
        </li>
        <li v-if="!filtered.length" class="cselect-empty">没找到「{{ q.trim() }}」，换个词试试</li>
      </ul>
    </div>
  </div>
</template>

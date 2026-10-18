<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  cities: { type: Array, default: function () { return [] } },
  selectedId: { type: [Number, String, null], default: null }
})
const emit = defineEmits(['select'])

const q = ref('')
const expanded = ref(false)

const filtered = computed(function () {
  const kw = q.value.trim().toLowerCase()
  if (!kw) return props.cities
  return props.cities.filter(function (c) {
    const name = String(c.name || '')
    const province = String(c.province || '')
    return name.toLowerCase().indexOf(kw) > -1 || province.toLowerCase().indexOf(kw) > -1
  })
})

const tooMany = computed(function () { return props.cities.length > 12 })

function pick(c) {
  emit('select', c)
}

function clearSearch() {
  q.value = ''
}

watch(q, function (v) {
  if (v.trim()) expanded.value = true
})
</script>

<template>
  <div class="city-picker">
    <div class="city-search">
      <input
        v-model="q"
        class="input city-search-input"
        type="search"
        inputmode="search"
        placeholder="搜城市名或省份，比如「成都」「山东」"
        aria-label="搜索城市"
      />
      <button v-if="q" type="button" class="city-search-clear" aria-label="清空搜索" @click="clearSearch">×</button>
    </div>

    <div class="city-meta">
      <span v-if="q.trim()">筛出 {{ filtered.length }} 个城市</span>
      <span v-else>{{ cities.length }} 个城市都能查</span>
      <button
        v-if="tooMany && !q.trim()"
        type="button"
        class="city-toggle"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? '收起' : '展开全部' }}
      </button>
    </div>

    <div v-if="!cities.length" class="empty">城市数据还没录进来，稍后再看。</div>

    <div v-else-if="!filtered.length" class="empty">没找到「{{ q.trim() }}」这个城市，换个词试试。</div>

    <div v-else-if="expanded || q.trim()" class="city-grid" role="group" aria-label="目的地">
      <button
        v-for="d in filtered"
        :key="'g-' + d.id"
        type="button"
        class="chip chip-grid"
        :class="{ active: d.id === selectedId }"
        :aria-pressed="d.id === selectedId"
        @click="pick(d)"
      >
        <strong>{{ d.name }}</strong>
        <small>{{ d.province || '目的地' }}</small>
      </button>
    </div>

    <div v-else class="chip-row" role="group" aria-label="目的地">
      <button
        v-for="d in filtered"
        :key="'r-' + d.id"
        type="button"
        class="chip"
        :class="{ active: d.id === selectedId }"
        :aria-pressed="d.id === selectedId"
        @click="pick(d)"
      >
        <strong>{{ d.name }}</strong>
        <small>{{ d.province || '目的地' }}</small>
      </button>
    </div>
  </div>
</template>

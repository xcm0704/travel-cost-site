<script setup>
import { ref, computed, onMounted } from 'vue'
import http from '../../api/client.js'

const stats = ref(null)
const loading = ref(true)
const failed = ref(false)
const at = ref('')

const CARDS = [
  { key: 'users', label: '注册用户', unit: '人', hint: '注册过的人', href: '/admin/users' },
  { key: 'destinations', label: '目的地', unit: '个', hint: '能查的城市', href: '/admin/data' },
  { key: 'hotels', label: '酒店', unit: '家', hint: '录了价格的', href: '/admin/data' },
  { key: 'attractions', label: '门票', unit: '处', hint: '景点门票价', href: '/admin/data' },
  { key: 'transports', label: '车费', unit: '条', hint: '城际交通', href: '/admin/data' }
]

const total = computed(function () {
  if (!stats.value) return 0
  return ['destinations', 'hotels', 'attractions', 'transports'].reduce(function (sum, k) {
    return sum + (Number(stats.value[k]) || 0)
  }, 0)
})

async function load() {
  loading.value = true
  failed.value = false
  try {
    stats.value = await http.get('/admin/overview')
    const d = new Date()
    const p = function (n) { return String(n).padStart(2, '0') }
    at.value = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds())
  } catch (e) {
    failed.value = true
    stats.value = null
  } finally {
    loading.value = false
  }
}

function value(key) {
  if (!stats.value) return '—'
  const n = Number(stats.value[key])
  return Number.isFinite(n) ? n.toLocaleString('zh-CN') : '—'
}

onMounted(load)
</script>

<template>
  <div class="page">
    <section class="section rise">
      <p class="eyebrow">ADMIN · 总览</p>
      <h1 class="display">数据总览</h1>
      <p class="lede">
        现在库里一共收着 {{ total }} 条旅行价格数据，用户端查到的每一个数字都来自这五张表。
      </p>
    </section>

    <section class="section rise rise-2">
      <div class="ov-grid">
        <article
          v-for="(c, i) in CARDS"
          :key="c.key"
          class="ov-card"
          :style="{ animationDelay: (i * 60) + 'ms' }"
        >
          <p class="ov-label">{{ c.label }}</p>
          <p class="ov-num">
            <span class="ov-value">{{ loading ? '·' : value(c.key) }}</span>
            <span class="ov-unit">{{ c.unit }}</span>
          </p>
          <p class="ov-hint">{{ c.hint }}</p>
          <RouterLink :to="c.href" class="ov-link">去管理 →</RouterLink>
        </article>
      </div>

      <div class="ov-foot">
        <p class="ov-note">
          <b>一句话：</b>数据是随时能改的台账 —— 改完这里，用户端刷新立刻就是新价，中间没有缓存挡着。
        </p>
        <button type="button" class="ov-refresh" :disabled="loading" @click="load">
          {{ loading ? '正在取数…' : (at ? '刷新 · 取于 ' + at : '刷新') }}
        </button>
      </div>

      <p v-if="failed" class="form-error">没取到数字，确认后端在跑再刷新一次。</p>
    </section>
  </div>
</template>

<style scoped>
.ov-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(158px, 1fr));
  gap: 12px;
}

.ov-card {
  position: relative;
  background: var(--paper-lift);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 15px 15px 13px;
  box-shadow: var(--shadow-1);
  overflow: hidden;
  animation: ov-rise 0.5s cubic-bezier(0.22, 0.7, 0.3, 1) both;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}
.ov-card::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, var(--teal) 0%, var(--teal-mid) 60%, var(--clay) 100%);
  opacity: 0.85;
}
.ov-card:hover {
  border-color: var(--teal-mid);
  box-shadow: var(--shadow-2);
  transform: translateY(-2px);
}

@keyframes ov-rise {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}

.ov-label {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.16em;
  color: var(--ink-soft);
}
.ov-num {
  margin: 6px 0 2px;
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.ov-value {
  font-family: var(--font-num);
  font-size: 30px;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: var(--teal);
  font-variant-numeric: tabular-nums;
}
.ov-unit {
  font-size: 11.5px;
  color: var(--ink-faint);
}
.ov-hint {
  margin: 0;
  font-size: 11.5px;
  color: var(--ink-faint);
  min-height: 1.5em;
}
.ov-link {
  display: inline-block;
  margin-top: 9px;
  font-size: 11.5px;
  color: var(--clay);
  border-bottom: 1px solid transparent;
}
.ov-link:hover { border-bottom-color: var(--clay); }

.ov-foot {
  margin-top: 16px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  border-top: 1px dashed var(--line-strong);
  padding-top: 12px;
}
.ov-note {
  margin: 0;
  flex: 1 1 320px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink-soft);
}
.ov-note b { color: var(--ink); font-weight: 600; }
.ov-refresh {
  flex: none;
  border: 1px solid var(--line-strong);
  background: var(--paper-lift);
  color: var(--teal);
  border-radius: var(--radius-sm);
  padding: 8px 13px;
  font-size: 12.5px;
  cursor: pointer;
  font-family: var(--font-body);
}
.ov-refresh:hover:not(:disabled) { border-color: var(--teal-mid); background: #eef5f3; }
.ov-refresh:disabled { color: var(--ink-faint); cursor: default; }

@media (max-width: 720px) {
  .ov-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .ov-card { padding: 13px 12px 11px; }
  .ov-value { font-size: 25px; }
  .ov-grid > .ov-card:first-child { grid-column: 1 / -1; }
  .ov-refresh { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .ov-card { animation: none; }
}
</style>

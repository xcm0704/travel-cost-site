<script setup>
import { ref, computed, onMounted } from 'vue'
import http from '../../api/client.js'
import AdminTable from '../../components/admin/AdminTable.vue'

const rows = ref([])
const loading = ref(true)
const at = ref('')

const COLUMNS = [
  { key: 'id', label: 'ID', width: 64 },
  { key: 'username', label: '用户名' },
  { key: 'role', label: '角色' },
  { key: 'createdAt', label: '注册时间' }
]

const adminCount = computed(function () {
  return rows.value.filter(function (r) { return r.role === 'admin' }).length
})

function roleText(role) {
  return role === 'admin' ? '管理员' : '普通用户'
}

async function load() {
  loading.value = true
  try {
    const list = await http.get('/admin/users')
    rows.value = Array.isArray(list) ? list : []
    const d = new Date()
    const p = function (n) { return String(n).padStart(2, '0') }
    at.value = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds())
  } catch (e) {
    rows.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <section class="section rise">
      <p class="eyebrow">ADMIN · 账号</p>
      <h1 class="display">注册用户</h1>
      <p class="lede">按注册时间从新到旧排。管理员 {{ adminCount }} 个，其余的只能查费用、进不了管理端。</p>
    </section>

    <section class="section rise rise-2">
      <div class="us-bar">
        <span class="us-count">共 {{ loading ? '…' : rows.length }} 个账号</span>
        <button type="button" class="us-refresh" :disabled="loading" @click="load">
          {{ loading ? '刷新中…' : (at ? '刷新 · 取于 ' + at : '刷新') }}
        </button>
      </div>

      <AdminTable
        :columns="COLUMNS"
        :rows="rows"
        :loading="loading"
        :min-width="520"
        empty="还没有人注册"
      >
        <template #id="{ row }"><span class="mono-faint">{{ row.id }}</span></template>

        <template #username="{ row }">
          <span class="us-name">{{ row.username }}</span>
        </template>

        <template #role="{ row }">
          <span class="role" :class="row.role === 'admin' ? 'role-admin' : 'role-user'">{{ roleText(row.role) }}</span>
        </template>

        <template #createdAt="{ row }">
          <span class="mono-faint">{{ row.createdAt || '—' }}</span>
        </template>
      </AdminTable>

      <p class="us-note">排序跟后台一致：注册时间新的在上面，同一分钟注册的按 ID 倒序。</p>
    </section>
  </div>
</template>

<style scoped>
.us-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--ink-faint);
}
.us-count {
  font-family: var(--font-num);
  letter-spacing: 0.06em;
}
.us-refresh {
  border: 0;
  background: none;
  padding: 4px 2px;
  font-size: 12px;
  color: var(--teal);
  cursor: pointer;
  border-bottom: 1px solid var(--line-strong);
  font-family: var(--font-body);
}
.us-refresh:disabled { color: var(--ink-faint); cursor: default; border-bottom-color: transparent; }

.mono-faint {
  font-family: var(--font-num);
  font-size: 12px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.us-name { font-weight: 600; letter-spacing: 0.01em; word-break: break-all; }

.role {
  display: inline-block;
  font-size: 11.5px;
  line-height: 1.6;
  padding: 1px 9px;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;
}
.role-admin { background: var(--clay-soft); color: var(--clay); border-color: #ecd6c4; }
.role-user { background: var(--teal-soft); color: var(--teal); border-color: #cfe0dd; }

.us-note { margin: 10px 2px 0; font-size: 11.5px; color: var(--ink-faint); }

@media (max-width: 720px) {
  .us-note { display: none; }
  .us-refresh { font-size: 11.5px; }
}
</style>

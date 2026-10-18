<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import http from '../../api/client.js'
import { toastOk } from '../../stores/toast.js'
import AdminTable from '../../components/admin/AdminTable.vue'
import AdminModal from '../../components/admin/AdminModal.vue'
import CityPicker from '../../components/admin/CityPicker.vue'

const TABS = [
  { key: 'destinations', label: '目的地' },
  { key: 'hotels', label: '酒店' },
  { key: 'attractions', label: '门票' },
  { key: 'transports', label: '车费' }
]

const MODES = ['高铁', '动车', '飞机', '大巴', '自驾']

const COLUMNS = {
  destinations: [
    { key: 'id', label: 'ID', width: 54 },
    { key: 'name', label: '目的地' },
    { key: 'province', label: '省份' },
    { key: 'intro', label: '介绍', cls: 'c-clip' },
    { key: 'updatedAt', label: '更新时间' },
    { key: 'actions', label: '操作', width: 116, sticky: true }
  ],
  hotels: [
    { key: 'id', label: 'ID', width: 54 },
    { key: 'name', label: '酒店' },
    { key: 'destinationName', label: '所在目的地' },
    { key: 'level', label: '档次' },
    { key: 'address', label: '地址', cls: 'c-clip' },
    { key: 'pricePerNight', label: '每晚', align: 'right' },
    { key: 'updatedAt', label: '更新时间' },
    { key: 'actions', label: '操作', width: 116, sticky: true }
  ],
  attractions: [
    { key: 'id', label: 'ID', width: 54 },
    { key: 'name', label: '景点' },
    { key: 'destinationName', label: '所在目的地' },
    { key: 'ticketPrice', label: '门票', align: 'right' },
    { key: 'openTime', label: '开放时间' },
    { key: 'updatedAt', label: '更新时间' },
    { key: 'actions', label: '操作', width: 116, sticky: true }
  ],
  transports: [
    { key: 'id', label: 'ID', width: 54 },
    { key: 'fromCity', label: '出发地' },
    { key: 'toCity', label: '到达地' },
    { key: 'mode', label: '方式' },
    { key: 'durationMinutes', label: '用时', align: 'right' },
    { key: 'price', label: '票价', align: 'right' },
    { key: 'note', label: '备注', cls: 'c-clip' },
    { key: 'updatedAt', label: '更新时间' },
    { key: 'actions', label: '操作', width: 116, sticky: true }
  ]
}

const MIN_WIDTH = { destinations: 660, hotels: 860, attractions: 760, transports: 900 }

const FIELDS = {
  destinations: [
    { key: 'name', label: '目的地名称', type: 'text', maxlength: 50, required: true, placeholder: '例：大连' },
    { key: 'province', label: '省份', type: 'text', maxlength: 50, placeholder: '例：辽宁' },
    { key: 'intro', label: '介绍', type: 'textarea', maxlength: 255, placeholder: '一句话说清这地方有什么好玩的' }
  ],
  hotels: [
    { key: 'destinationId', label: '所属目的地', type: 'destination', required: true },
    { key: 'name', label: '酒店名称', type: 'text', maxlength: 100, required: true, placeholder: '例：大连星海假日酒店' },
    { key: 'level', label: '档次', type: 'text', maxlength: 20, placeholder: '例：经济型 / 舒适型 / 高档' },
    { key: 'address', label: '地址', type: 'text', maxlength: 200, placeholder: '例：沙河口区中山路 578 号' },
    { key: 'pricePerNight', label: '每晚价格（元）', type: 'money', required: true, placeholder: '例：480' },
    { key: 'note', label: '备注', type: 'textarea', maxlength: 255, placeholder: '选填，比如离地铁近、含早餐' }
  ],
  attractions: [
    { key: 'destinationId', label: '所属目的地', type: 'destination', required: true },
    { key: 'name', label: '景点名称', type: 'text', maxlength: 100, required: true, placeholder: '例：老虎滩海洋公园' },
    { key: 'ticketPrice', label: '门票价格（元）', type: 'money', required: true, placeholder: '例：220' },
    { key: 'openTime', label: '开放时间', type: 'text', maxlength: 100, placeholder: '例：08:30-17:00' },
    { key: 'note', label: '备注', type: 'textarea', maxlength: 255, placeholder: '选填，比如值得玩半天' }
  ],
  transports: [
    { key: 'fromCity', label: '出发城市', type: 'text', maxlength: 50, required: true, placeholder: '例：沈阳' },
    { key: 'toCity', label: '到达城市', type: 'text', maxlength: 50, required: true, placeholder: '例：大连' },
    { key: 'mode', label: '交通方式', type: 'mode', required: true },
    { key: 'durationMinutes', label: '用时（分钟）', type: 'int', placeholder: '例：145，可留空' },
    { key: 'price', label: '票价（元）', type: 'money', required: true, placeholder: '例：145' },
    { key: 'note', label: '备注', type: 'textarea', maxlength: 255, placeholder: '选填，比如车次每天只有一班' }
  ]
}

const tab = ref('destinations')
const rows = ref([])
const loading = ref(false)
const destinations = ref([])
const cities = ref([])

const fDestQ = ref('')
const fHotelDest = ref('')
const fHotelQ = ref('')
const fAttrDest = ref('')
const fAttrQ = ref('')
const fTrFrom = ref('')
const fTrTo = ref('')
const fTrMode = ref('')
// 车费表几万条，进标签页不发请求：先选城市再查
const trQueried = ref(false)

const formOpen = ref(false)
const editingId = ref(null)
const submitting = ref(false)
const formError = ref('')
const form = reactive({})
const fieldErr = reactive({})

const delTarget = ref(null)
const delBusy = ref(false)
const delError = ref('')

const columns = computed(function () { return COLUMNS[tab.value] || [] })
const fields = computed(function () { return FIELDS[tab.value] || [] })
const minWidth = computed(function () { return MIN_WIDTH[tab.value] || 700 })
const tabLabel = computed(function () {
  const t = TABS.find(function (x) { return x.key === tab.value })
  return t ? t.label : ''
})

const viewRows = computed(function () {
  if (tab.value === 'transports') {
    const m = fTrMode.value
    if (!m) return rows.value
    return rows.value.filter(function (r) { return r.mode === m })
  }
  if (tab.value !== 'destinations') return rows.value
  const q = fDestQ.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter(function (r) {
    return [r.name, r.province, r.intro].some(function (v) {
      return String(v || '').toLowerCase().indexOf(q) > -1
    })
  })
})

const countText = computed(function () {
  if (loading.value) return '正在取数…'
  if (tab.value === 'transports' && !trQueried.value) return '还没查'
  return '共 ' + viewRows.value.length + ' 条'
})

// 车费必须先给一个城市，否则等于全表扫描
const trReady = computed(function () {
  return !!(String(fTrFrom.value || '').trim() || String(fTrTo.value || '').trim())
})

const showTransportGuide = computed(function () {
  return tab.value === 'transports' && !trQueried.value
})

const canReload = computed(function () {
  return tab.value !== 'transports' || trReady.value
})

const tooMany = computed(function () {
  return tab.value === 'transports' && viewRows.value.length > 150
})

function debounce(fn, ms) {
  let timer = null
  return function () {
    clearTimeout(timer)
    timer = setTimeout(fn, ms)
  }
}

function money(v) {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return '¥' + n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function duration(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return '—'
  const h = Math.floor(n / 60)
  const m = n % 60
  if (!h) return m + ' 分钟'
  return h + ' 小时' + (m ? ' ' + m + ' 分' : '')
}

function rowTitle(row) {
  if (!row) return ''
  if (row.name) return row.name
  if (row.fromCity) return row.fromCity + ' → ' + row.toCity
  return ''
}

function clean(params) {
  const out = {}
  Object.keys(params).forEach(function (k) {
    const v = params[k]
    if (v !== '' && v !== null && v !== undefined) out[k] = v
  })
  return out
}

async function loadDestinations() {
  try {
    const list = await http.get('/admin/destinations')
    destinations.value = Array.isArray(list) ? list : []
  } catch (e) {
    destinations.value = []
  }
}

async function loadCities() {
  try {
    const data = await http.get('/cities')
    cities.value = data && Array.isArray(data.cities) ? data.cities : []
  } catch (e) {
    cities.value = []
  }
}

async function loadRows() {
  loading.value = true
  const key = tab.value
  try {
    let list = []
    if (key === 'destinations') {
      list = await http.get('/admin/destinations')
    } else if (key === 'hotels') {
      list = await http.get('/admin/hotels', { params: clean({ destinationId: fHotelDest.value, q: fHotelQ.value.trim() }) })
    } else if (key === 'attractions') {
      list = await http.get('/admin/attractions', { params: clean({ destinationId: fAttrDest.value, q: fAttrQ.value.trim() }) })
    } else if (!trReady.value) {
      // 没有城市条件就不查：全量 1.4 万条 / 3 MB，手机扛不住
      rows.value = []
      trQueried.value = false
      return
    } else {
      trQueried.value = true
      list = await http.get('/admin/transports', {
        params: clean({ from: String(fTrFrom.value || '').trim(), to: String(fTrTo.value || '').trim() })
      })
    }
    if (key === tab.value) rows.value = Array.isArray(list) ? list : []
  } catch (e) {
    if (key === tab.value) rows.value = []
  } finally {
    if (key === tab.value) loading.value = false
  }
}

const reloadSoon = debounce(loadRows, 320)

async function afterChange() {
  await loadRows()
  if (tab.value === 'destinations') await loadDestinations()
  if (tab.value === 'transports') await loadCities()
}

function clearFilters() {
  if (tab.value === 'destinations') fDestQ.value = ''
  if (tab.value === 'hotels') { fHotelDest.value = ''; fHotelQ.value = '' }
  if (tab.value === 'attractions') { fAttrDest.value = ''; fAttrQ.value = '' }
  if (tab.value === 'transports') { fTrFrom.value = ''; fTrTo.value = ''; fTrMode.value = '' }
}

function resetFilters() {
  clearFilters()
  if (tab.value === 'transports') {
    rows.value = []
    trQueried.value = false
    return
  }
  loadRows()
}

function runTransportQuery() {
  if (!trReady.value) return
  loadRows()
}

/* ---------- 表单校验：提示语和后台保持一致的口径 ---------- */
function bare(label) { return String(label).split('（')[0] }

function fieldError(f, raw) {
  const v = raw === undefined || raw === null ? '' : String(raw).trim()
  if (f.type === 'destination') {
    const n = Number(v)
    if (!v) return '请选择' + f.label
    if (!Number.isInteger(n) || n <= 0) return '请选择' + f.label
    return ''
  }
  if (f.required && !v) return '请填写' + f.label
  if (!v) return ''
  if (f.maxlength && v.length > f.maxlength) return f.label + '最多 ' + f.maxlength + ' 个字'
  if (f.type === 'money') {
    const n = Number(v)
    if (!Number.isFinite(n)) return bare(f.label) + '要填数字'
    if (n < 0) return bare(f.label) + '不能是负数'
    if (n > 99999999.99) return bare(f.label) + '太大了'
  }
  if (f.type === 'int') {
    const n = Number(v)
    if (!Number.isInteger(n)) return bare(f.label) + '要填整数分钟'
    if (n < 0 || n > 100000) return bare(f.label) + '要在 0~100000 之间'
  }
  return ''
}

function toWire(f, raw) {
  const v = raw === undefined || raw === null ? '' : String(raw).trim()
  if (f.type === 'money') return v === '' ? 0 : Number(v)
  if (f.type === 'int') return v === '' ? 0 : Number(v)
  if (f.type === 'destination') return Number(v)
  return v
}

function openCreate() {
  editingId.value = null
  formError.value = ''
  fields.value.forEach(function (f) {
    delete fieldErr[f.key]
    form[f.key] = f.type === 'destination' ? (destinations.value[0] ? String(destinations.value[0].id) : '') : ''
    if (f.type === 'mode') form[f.key] = MODES[0]
    if (f.type === 'int') form[f.key] = ''
  })
  formOpen.value = true
}

function openEdit(row) {
  editingId.value = row.id
  formError.value = ''
  fields.value.forEach(function (f) {
    delete fieldErr[f.key]
    const v = row[f.key]
    form[f.key] = v === null || v === undefined ? '' : String(v)
  })
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
  submitting.value = false
}

async function submitForm() {
  let bad = false
  fields.value.forEach(function (f) {
    const msg = fieldError(f, form[f.key])
    fieldErr[f.key] = msg
    if (msg) bad = true
  })
  if (bad) {
    formError.value = '还有几项没填对，看下红字'
    return
  }
  formError.value = ''
  submitting.value = true
  const payload = {}
  fields.value.forEach(function (f) { payload[f.key] = toWire(f, form[f.key]) })
  const key = tab.value
  try {
    let saved = null
    if (editingId.value) {
      saved = await http.put('/admin/' + key + '/' + editingId.value, payload)
      toastOk('已保存「' + (rowTitle(saved) || '这条数据') + '」')
    } else {
      saved = await http.post('/admin/' + key, payload)
      toastOk('已新增「' + (rowTitle(saved) || '一条数据') + '」')
    }
    if (key === 'transports') {
      // 车费不全量拉：把筛选条件对准刚保存的这条线路，保证能看见它
      fTrFrom.value = (saved && saved.fromCity) || payload.fromCity
      fTrTo.value = (saved && saved.toCity) || payload.toCity
      fTrMode.value = ''
    } else if (!editingId.value) {
      // 新建的那条要能被看见：先清掉筛选，否则它可能落在筛选条件之外
      clearFilters()
    }
    closeForm()
    await afterChange()
  } catch (e) {
    formError.value = e.userMessage || '保存失败，检查一下再试'
  } finally {
    submitting.value = false
  }
}

function askDelete(row) {
  delTarget.value = row
  delError.value = ''
  delBusy.value = false
}

async function doDelete() {
  const target = delTarget.value
  if (!target) return
  delBusy.value = true
  delError.value = ''
  try {
    await http.delete('/admin/' + tab.value + '/' + target.id)
    toastOk('已删除「' + rowTitle(target) + '」')
    delTarget.value = null
    await afterChange()
  } catch (e) {
    delError.value = e.userMessage || '删除失败，稍后再试'
  } finally {
    delBusy.value = false
  }
}

watch(tab, function () {
  rows.value = []
  loadRows()
})

onMounted(function () {
  loadDestinations()
  loadCities()
  loadRows()
})
</script>

<template>
  <div class="page">
    <section class="section rise">
      <p class="eyebrow">ADMIN · 台账</p>
      <h1 class="display">数据管理</h1>
      <p class="lede">目的地、酒店、门票、车费都在这儿改。改完用户端刷新立刻看到新值，不用等。</p>
    </section>

    <section class="section rise rise-2">
      <div class="adm-tabs" role="tablist" aria-label="数据分类">
        <button
          v-for="t in TABS"
          :key="t.key"
          type="button"
          role="tab"
          class="adm-tab"
          :class="{ 'is-on': tab === t.key }"
          :aria-selected="tab === t.key ? 'true' : 'false'"
          @click="tab = t.key"
        >{{ t.label }}</button>
      </div>

      <div class="filters">
        <template v-if="tab === 'destinations'">
          <label class="field">
            <span class="field-label">搜目的地</span>
            <input v-model="fDestQ" class="input" type="search" placeholder="名称 / 省份 / 介绍" />
          </label>
        </template>

        <template v-else-if="tab === 'hotels'">
          <label class="field field-sm">
            <span class="field-label">所属目的地</span>
            <select v-model="fHotelDest" class="select" @change="loadRows">
              <option value="">全部</option>
              <option v-for="d in destinations" :key="d.id" :value="String(d.id)">{{ d.name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">搜酒店</span>
            <input v-model="fHotelQ" class="input" type="search" placeholder="酒店名称" @input="reloadSoon" />
          </label>
        </template>

        <template v-else-if="tab === 'attractions'">
          <label class="field field-sm">
            <span class="field-label">所属目的地</span>
            <select v-model="fAttrDest" class="select" @change="loadRows">
              <option value="">全部</option>
              <option v-for="d in destinations" :key="d.id" :value="String(d.id)">{{ d.name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">搜景点</span>
            <input v-model="fAttrQ" class="input" type="search" placeholder="景点名称" @input="reloadSoon" />
          </label>
        </template>

        <template v-else>
          <label class="field field-sm">
            <span class="field-label">出发地</span>
            <CityPicker v-model="fTrFrom" :options="cities" placeholder="搜城市名" label="出发地" />
          </label>
          <label class="field field-sm">
            <span class="field-label">到达地</span>
            <CityPicker v-model="fTrTo" :options="cities" placeholder="搜城市名" label="到达地" />
          </label>
          <label class="field field-sm">
            <span class="field-label">方式</span>
            <select v-model="fTrMode" class="select">
              <option value="">全部</option>
              <option v-for="m in MODES" :key="'m' + m" :value="m">{{ m }}</option>
            </select>
          </label>
          <button type="button" class="btn btn-primary btn-query" :disabled="!trReady || loading" @click="runTransportQuery">
            {{ loading && trQueried ? '查询中…' : '查询' }}
          </button>
        </template>

        <button type="button" class="btn btn-ghost btn-reset" @click="resetFilters">重置</button>
        <button type="button" class="btn btn-primary btn-add" @click="openCreate">＋ 新增{{ tabLabel }}</button>
      </div>

      <div class="adm-bar">
        <span class="adm-count">{{ countText }}</span>
        <button type="button" class="adm-refresh" :disabled="loading || !canReload" @click="loadRows">
          {{ loading ? '刷新中…' : '刷新' }}
        </button>
      </div>

      <p v-if="tooMany" class="adm-warn">查出来 {{ viewRows.length }} 条，有点多了 —— 把到达地（或出发地）也选上会清楚得多。</p>

      <div v-if="showTransportGuide" class="adm-guide">
        <p class="adm-guide-title">先选出发地或到达地，再点「查询」</p>
        <p class="adm-guide-text">全库车费上万条，一次只查一条线路就够了 —— 这个标签页不会预先拉全表，所以现在先是空的。</p>
        <p class="adm-guide-text">城市名记不准？在框里打一个字就能从列表里挑。要加新线路，点右上角「新增车费」。</p>
      </div>

      <AdminTable
        v-else
        :columns="columns"
        :rows="viewRows"
        :loading="loading"
        :min-width="minWidth"
        empty="这个条件下没有车费，换个城市或方式试试"
      >
        <template #id="{ row }"><span class="mono-faint">{{ row.id }}</span></template>

        <template #level="{ row }">
          <span class="tag tag-soft">{{ row.level || '未标注' }}</span>
        </template>

        <template #mode="{ row }">
          <span class="tag tag-mode">{{ row.mode }}</span>
        </template>

        <template #pricePerNight="{ row }"><span class="money">{{ money(row.pricePerNight) }}</span></template>
        <template #ticketPrice="{ row }"><span class="money">{{ money(row.ticketPrice) }}</span></template>
        <template #price="{ row }"><span class="money">{{ money(row.price) }}</span></template>

        <template #durationMinutes="{ row }">
          <span class="mono-faint">{{ duration(row.durationMinutes) }}</span>
        </template>

        <template #updatedAt="{ row }">
          <span class="mono-faint">{{ row.updatedAt || '—' }}</span>
        </template>

        <template #actions="{ row }">
          <div class="row-acts">
            <button type="button" class="act" @click="openEdit(row)">编辑</button>
            <button type="button" class="act act-del" @click="askDelete(row)">删除</button>
          </div>
        </template>
      </AdminTable>

      <p class="adm-foot-note">表格在手机上可以左右滑动查看全部列；操作列固定在右边。</p>
    </section>

    <AdminModal
      :open="formOpen"
      :title="(editingId ? '修改' : '新增') + tabLabel"
      :sub="editingId ? 'ID #' + editingId + ' · 管理端' : '管理端 · 新增'"
      @close="closeForm"
    >
      <form class="adm-form" @submit.prevent="submitForm">
        <label v-for="f in fields" :key="f.key" class="field adm-field">
          <span class="field-label">{{ f.label }}<i v-if="f.required" class="req">*</i></span>

          <select v-if="f.type === 'destination'" v-model="form[f.key]" class="select" :class="{ 'is-bad': fieldErr[f.key] }">
            <option value="">— 请选择 —</option>
            <option v-for="d in destinations" :key="d.id" :value="String(d.id)">{{ d.name }}（{{ d.province || '省份未填' }}）</option>
          </select>

          <select v-else-if="f.type === 'mode'" v-model="form[f.key]" class="select" :class="{ 'is-bad': fieldErr[f.key] }">
            <option v-for="m in MODES" :key="m" :value="m">{{ m }}</option>
          </select>

          <textarea
            v-else-if="f.type === 'textarea'"
            v-model="form[f.key]"
            class="input adm-textarea"
            rows="3"
            :maxlength="f.maxlength"
            :placeholder="f.placeholder"
            :class="{ 'is-bad': fieldErr[f.key] }"
          ></textarea>

          <input
            v-else-if="f.type === 'money'"
            v-model="form[f.key]"
            class="input"
            type="number"
            min="0"
            step="0.01"
            inputmode="decimal"
            :placeholder="f.placeholder"
            :class="{ 'is-bad': fieldErr[f.key] }"
          />

          <input
            v-else-if="f.type === 'int'"
            v-model="form[f.key]"
            class="input"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            :placeholder="f.placeholder"
            :class="{ 'is-bad': fieldErr[f.key] }"
          />

          <input
            v-else
            v-model="form[f.key]"
            class="input"
            type="text"
            :maxlength="f.maxlength"
            :placeholder="f.placeholder"
            :class="{ 'is-bad': fieldErr[f.key] }"
          />

          <span v-if="fieldErr[f.key]" class="err">{{ fieldErr[f.key] }}</span>
        </label>

        <p v-if="formError" class="form-error">{{ formError }}</p>
        <button type="submit" hidden></button>
      </form>

      <template #foot>
        <button type="button" class="btn btn-ghost" :disabled="submitting" @click="closeForm">取消</button>
        <button type="button" class="btn btn-primary" :disabled="submitting" @click="submitForm">
          {{ submitting ? '保存中…' : (editingId ? '保存修改' : '确认新增') }}
        </button>
      </template>
    </AdminModal>

    <AdminModal
      :open="!!delTarget"
      title="确认删除"
      sub="删了就找不回来"
      @close="delTarget = null"
    >
      <p class="confirm-text">
        确定删掉「<b>{{ rowTitle(delTarget) }}</b>」吗？
      </p>
      <p class="confirm-tip">如果这个目的地下面还挂着酒店或门票，得先把它们删掉。</p>
      <p v-if="delError" class="form-error">{{ delError }}</p>

      <template #foot>
        <button type="button" class="btn btn-ghost" :disabled="delBusy" @click="delTarget = null">再想想</button>
        <button type="button" class="btn btn-danger" :disabled="delBusy" @click="doDelete">
          {{ delBusy ? '删除中…' : '确认删除' }}
        </button>
      </template>
    </AdminModal>
  </div>
</template>

<style scoped>
/* ---------- 标签页：沿用全局胶囊语言的窄排版 ---------- */
.adm-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgba(255, 253, 247, 0.72);
  border: 1px solid var(--line);
  border-radius: 999px;
  box-shadow: var(--shadow-1);
  overflow-x: auto;
  scrollbar-width: none;
}
.adm-tabs::-webkit-scrollbar { display: none; }

.adm-tab {
  flex: 1;
  min-width: 72px;
  border: 0;
  background: none;
  border-radius: 999px;
  padding: 9px 12px;
  font-size: 14px;
  color: var(--ink-soft);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.16s ease, color 0.16s ease;
}
.adm-tab:hover { color: var(--teal); }
.adm-tab.is-on { background: var(--teal); color: #f8f3e7; font-weight: 600; }

/* ---------- 筛选行 ---------- */
.btn-reset { height: 44px; padding: 0 14px; }
.btn-query { height: 44px; padding: 0 18px; }
.btn-add { margin-left: auto; }

/* 车费标签的空态引导：不先说清楚，用户会以为坏了 */
.adm-guide {
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius);
  background: rgba(255, 253, 247, 0.62);
  padding: 20px 18px 18px;
}
.adm-guide-title {
  margin: 0 0 7px;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--teal);
}
.adm-guide-title::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 9px;
  border-radius: 50%;
  background: var(--clay);
  vertical-align: 3px;
}
.adm-guide-text {
  margin: 0 0 4px;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--ink-soft);
}

.adm-warn {
  margin: 0 0 8px;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--clay);
  background: var(--clay-soft);
  border: 1px solid #ecd6c4;
  border-radius: var(--radius-sm);
  padding: 7px 10px;
}

.adm-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 12px 0 8px;
  font-size: 12px;
  color: var(--ink-faint);
}
.adm-count {
  font-family: var(--font-num);
  letter-spacing: 0.06em;
}
.adm-refresh {
  border: 0;
  background: none;
  padding: 4px 2px;
  font-size: 12px;
  color: var(--teal);
  cursor: pointer;
  border-bottom: 1px solid var(--line-strong);
  font-family: var(--font-body);
}
.adm-refresh:disabled { color: var(--ink-faint); cursor: default; border-bottom-color: transparent; }

/* ---------- 单元格 ---------- */
.mono-faint {
  font-family: var(--font-num);
  font-size: 12px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.money {
  font-family: var(--font-num);
  font-size: 13.5px;
  color: var(--clay);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.tag {
  display: inline-block;
  font-size: 11.5px;
  line-height: 1.5;
  padding: 1px 8px;
  border-radius: 999px;
  white-space: nowrap;
  border: 1px solid transparent;
}
.tag-soft { background: var(--teal-soft); color: var(--teal); border-color: #cfe0dd; }
.tag-mode { background: var(--clay-soft); color: var(--clay); border-color: #ecd6c4; }

.row-acts { display: flex; gap: 6px; justify-content: flex-end; }
.act {
  border: 1px solid var(--line-strong);
  background: var(--paper-lift);
  color: var(--teal);
  border-radius: 6px;
  padding: 5px 9px;
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.14s ease;
}
.act:hover { border-color: var(--teal-mid); background: #eef5f3; }
.act-del { color: var(--danger); }
.act-del:hover { border-color: var(--danger); background: #fbeeea; }

.adm-foot-note {
  margin: 10px 2px 0;
  font-size: 11.5px;
  color: var(--ink-faint);
}

/* ---------- 弹窗表单 ---------- */
.adm-form { display: flex; flex-direction: column; gap: 13px; }
.adm-field { flex: 1 1 auto; }
.adm-field .req { color: var(--clay); font-style: normal; margin-left: 3px; }
.adm-textarea {
  height: auto;
  min-height: 76px;
  padding: 10px 12px;
  line-height: 1.55;
  resize: vertical;
  font-family: inherit;
}
.input.is-bad, .select.is-bad { border-color: var(--danger); background: #fdf7f5; }
.err { font-size: 11.5px; color: var(--danger); }

.confirm-text { margin: 0 0 8px; font-size: 14.5px; line-height: 1.6; }
.confirm-text b { font-family: var(--font-display); color: var(--teal); }
.confirm-tip { margin: 0 0 12px; font-size: 12.5px; color: var(--ink-faint); line-height: 1.55; }

.btn-danger {
  background: var(--danger);
  color: #fdf6f2;
  box-shadow: 0 1px 2px rgba(165, 52, 31, 0.3);
}
.btn-danger:hover:not(:disabled) { background: #8d2b19; }

@media (max-width: 720px) {
  .btn-add { margin-left: 0; width: 100%; }
  .btn-reset { flex: 1 1 26%; }
  .btn-query { flex: 1 1 40%; padding: 0 14px; }
  .adm-foot-note { display: none; }
  /* 手指点得着：行内按钮在手机上放大一点 */
  .act { padding: 9px 11px; font-size: 13px; }
  .row-acts { gap: 8px; }
}
</style>

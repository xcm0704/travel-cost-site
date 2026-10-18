<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import http from '../api/client.js'
import { trip } from '../stores/trip.js'

const router = useRouter()

const result = ref(null)
const loading = ref(true)
const error = ref('')
const payload = ref(null)

const total = computed(function () {
  return result.value ? Number(result.value.total || 0) : 0
})

const roundTripLabel = computed(function () {
  if (!result.value || !result.value.transport) return ''
  return result.value.transport.back ? '含返程' : '单程'
})

function money(n) {
  return Number(n || 0).toFixed(2)
}

function readPayload() {
  try {
    const raw = sessionStorage.getItem('travel_estimate_payload')
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

async function calculate() {
  error.value = ''
  const body = payload.value
  if (!body) {
    loading.value = false
    error.value = '还没有勾选项目，回首页挑几样再算。'
    return
  }
  loading.value = true
  try {
    const data = await http.post('/estimate', body)
    result.value = data
  } catch (e) {
    result.value = null
    error.value = e.userMessage || '算不出来，回去检查一下选择'
  } finally {
    loading.value = false
  }
}

function backToPick() {
  router.push('/')
}

onMounted(function () {
  payload.value = readPayload()
  if (!payload.value && trip.destinationId) {
    payload.value = {
      destinationId: trip.destinationId,
      nights: Number(trip.nights || 1),
      hotelId: trip.hotel ? trip.hotel.id : null,
      attractionIds: trip.attractions.map(function (a) { return a.id }),
      fromCity: trip.fromCity || null,
      toCity: trip.toCity || null,
      transportId: trip.transport ? trip.transport.id : null,
      roundTrip: !!trip.roundTrip
    }
  }
  calculate()
})
</script>

<template>
  <div class="page">
    <section class="section rise">
      <p class="eyebrow">STEP 03 · 明细</p>
      <h1 class="display">
        这趟大概
        <em v-if="result">￥{{ money(total) }}</em>
        <em v-else>…</em>
      </h1>
      <p class="lede">每一项都列在下面，想省钱就回去改选，价格立刻重算。</p>
    </section>

    <section class="section rise rise-2">
      <div v-if="loading" class="ticket">
        <div class="skeleton" style="height: 22px; width: 40%"></div>
        <hr class="perf" />
        <div class="skeleton" style="margin-bottom: 8px"></div>
        <div class="skeleton" style="margin-bottom: 8px"></div>
        <div class="skeleton"></div>
      </div>

      <div v-else-if="error" class="ticket">
        <div class="ticket-head">
          <h2 class="ticket-title">没算出来</h2>
          <span class="ticket-sub">ESTIMATE</span>
        </div>
        <hr class="perf" />
        <p class="form-error" style="margin: 0">{{ error }}</p>
        <div class="actions" style="margin-top: 14px">
          <button type="button" class="btn btn-primary btn-block" @click="backToPick">返回改选</button>
          <button type="button" class="btn btn-ghost btn-block" @click="calculate">再算一次</button>
        </div>
      </div>

      <div v-else-if="result" class="ticket">
        <div class="ticket-head">
          <div>
            <h2 class="ticket-title">{{ result.destination ? result.destination.name : '行程' }}</h2>
            <span class="ticket-sub">
              {{ result.nights }} 晚{{ result.hotel ? ' · 含住宿' : ' · 不含住宿' }}{{ roundTripLabel ? ' · ' + roundTripLabel : '' }}
            </span>
          </div>
          <span class="stamp">行价核算</span>
        </div>

        <hr class="perf" />

        <ul class="line-list">
          <li v-for="(it, i) in result.items" :key="'it-' + i" class="line-item">
            <span class="lb">{{ it.label }}</span>
            <span class="am">￥{{ money(it.amount) }}</span>
          </li>
          <li v-if="!result.items || !result.items.length" class="line-item">
            <span class="lb">这次什么都没选，所以是 0 元。</span>
            <span class="am">￥0.00</span>
          </li>
        </ul>

        <hr class="perf" />

        <div class="line-total">
          <span class="lb">合计</span>
          <span class="am"><i>￥</i>{{ money(total) }}</span>
        </div>

        <dl class="summary">
          <div>
            <dt>车费方式</dt>
            <dd>{{ result.transport ? result.transport.mode : '未计价' }}</dd>
          </div>
          <div>
            <dt>去程</dt>
            <dd>
              {{ result.transport ? result.transport.go.from + ' → ' + result.transport.go.to + ' ￥' + money(result.transport.go.price) : '—' }}
            </dd>
          </div>
          <div>
            <dt>返程</dt>
            <dd>
              {{ result.transport && result.transport.back ? result.transport.back.from + ' → ' + result.transport.back.to + ' ￥' + money(result.transport.back.price) : '无' }}
            </dd>
          </div>
          <div>
            <dt>景点数</dt>
            <dd>{{ result.attractions ? result.attractions.length : 0 }} 个</dd>
          </div>
        </dl>

        <div class="actions" style="margin-top: 18px">
          <button type="button" class="btn btn-primary btn-block" @click="backToPick">返回改选</button>
          <button type="button" class="btn btn-ghost btn-block" @click="calculate">重算一遍</button>
        </div>
      </div>
    </section>

    <p class="section-hint" style="margin-top: 14px">
      价格与明细来自服务端核算，只记一次去程车费（勾了返程就按往返算），不含吃饭和购物。
    </p>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import http from '../api/client.js'
import { trip, resetTrip, previewTotal, persistTrip } from '../stores/trip.js'
import { toastError } from '../stores/toast.js'

const router = useRouter()

const destinations = ref([])
const cities = ref([])
const hotels = ref([])
const attractions = ref([])
const transports = ref([])

const tab = ref('hotels')
const qHotel = ref('')
const qAttr = ref('')
const modeFilter = ref('')

const loading = reactive({ dest: true, hotels: false, attractions: false, transports: false })

const MODES = ['高铁', '动车', '飞机', '大巴', '自驾']

const current = computed(function () {
  return destinations.value.find(function (d) { return d.id === trip.destinationId }) || null
})

const total = computed(function () { return previewTotal() })

const pickedCount = computed(function () {
  let n = trip.attractions.length
  if (trip.hotel) n += 1
  if (trip.transport) n += 1
  return n
})

const canEstimate = computed(function () {
  return !!trip.destinationId && (!!trip.hotel || trip.attractions.length > 0 || !!trip.transport)
})

function debounce(fn, ms) {
  let timer = null
  return function () {
    clearTimeout(timer)
    timer = setTimeout(fn, ms)
  }
}

async function loadDestinations() {
  loading.dest = true
  try {
    const list = await http.get('/destinations')
    destinations.value = Array.isArray(list) ? list : []
  } catch (e) {
    destinations.value = []
  } finally {
    loading.dest = false
  }
}

async function loadCities() {
  try {
    const data = await http.get('/cities')
    cities.value = (data && Array.isArray(data.cities)) ? data.cities : []
  } catch (e) {
    cities.value = []
  }
}

async function loadHotels() {
  if (!trip.destinationId) return
  loading.hotels = true
  try {
    const list = await http.get('/hotels', {
      params: { destinationId: trip.destinationId, q: qHotel.value.trim() }
    })
    hotels.value = Array.isArray(list) ? list : []
  } catch (e) {
    hotels.value = []
  } finally {
    loading.hotels = false
  }
}

async function loadAttractions() {
  if (!trip.destinationId) return
  loading.attractions = true
  try {
    const list = await http.get('/attractions', {
      params: { destinationId: trip.destinationId, q: qAttr.value.trim() }
    })
    attractions.value = Array.isArray(list) ? list : []
  } catch (e) {
    attractions.value = []
  } finally {
    loading.attractions = false
  }
}

async function loadTransports() {
  loading.transports = true
  try {
    const params = {}
    if (trip.fromCity) params.from = trip.fromCity
    if (trip.toCity) params.to = trip.toCity
    if (modeFilter.value) params.mode = modeFilter.value
    const list = await http.get('/transports', { params: params })
    transports.value = Array.isArray(list) ? list : []
  } catch (e) {
    transports.value = []
  } finally {
    loading.transports = false
  }
}

function ensureFromCity() {
  if (!cities.value.length) return
  if (trip.fromCity && trip.fromCity !== trip.toCity) return
  const first = cities.value.find(function (c) { return c !== trip.toCity })
  if (first) trip.fromCity = first
}

async function loadDestinationData() {
  hotels.value = []
  attractions.value = []
  transports.value = []
  if (!trip.destinationId) return
  trip.toCity = current.value ? current.value.name : trip.toCity
  ensureFromCity()
  await Promise.all([loadHotels(), loadAttractions(), loadTransports()])
}

function selectDestination(d) {
  if (trip.destinationId === d.id) return
  trip.destinationId = d.id
  trip.destinationName = d.name
  trip.hotel = null
  trip.attractions = []
  trip.transport = null
  trip.toCity = d.name
  qHotel.value = ''
  qAttr.value = ''
  modeFilter.value = ''
  ensureFromCity()
  loadDestinationData()
}

function pickHotel(h) {
  trip.hotel = (trip.hotel && trip.hotel.id === h.id) ? null : h
  persistTrip()
}

function isHotel(h) {
  return !!(trip.hotel && trip.hotel.id === h.id)
}

function isAttraction(a) {
  return trip.attractions.some(function (x) { return x.id === a.id })
}

function toggleAttraction(a) {
  if (isAttraction(a)) {
    trip.attractions = trip.attractions.filter(function (x) { return x.id !== a.id })
  } else {
    trip.attractions = trip.attractions.concat([a])
  }
  persistTrip()
}

function isTransport(t) {
  return !!(trip.transport && trip.transport.id === t.id)
}

function pickTransport(t) {
  if (isTransport(t)) {
    trip.transport = null
  } else {
    trip.transport = t
    trip.fromCity = t.fromCity
    trip.toCity = t.toCity
  }
  persistTrip()
}

function removeHotel() {
  trip.hotel = null
  persistTrip()
}

function removeTransport() {
  trip.transport = null
  persistTrip()
}

function removeAttraction(id) {
  trip.attractions = trip.attractions.filter(function (x) { return x.id !== id })
  persistTrip()
}

function stepNights(delta) {
  const next = Math.min(30, Math.max(1, Number(trip.nights || 1) + delta))
  trip.nights = next
  persistTrip()
}

function clearAll() {
  resetTrip()
  hotels.value = []
  attractions.value = []
  transports.value = []
  qHotel.value = ''
  qAttr.value = ''
  modeFilter.value = ''
  loadDestinationData()
}

function money(n) {
  return Number(n || 0).toFixed(2)
}

function durationText(minutes) {
  const m = Number(minutes || 0)
  if (!m) return ''
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (!h) return rest + ' 分钟'
  return rest ? h + ' 小时 ' + rest + ' 分' : h + ' 小时'
}

function goEstimate() {
  if (!trip.destinationId) {
    toastError('先选一个目的地')
    return
  }
  if (!canEstimate.value) {
    toastError('先勾上酒店、门票或车费里的至少一项')
    return
  }
  const payload = {
    destinationId: trip.destinationId,
    nights: Number(trip.nights || 1),
    hotelId: trip.hotel ? trip.hotel.id : null,
    attractionIds: trip.attractions.map(function (a) { return a.id }),
    fromCity: trip.fromCity || null,
    toCity: trip.toCity || null,
    transportId: trip.transport ? trip.transport.id : null,
    roundTrip: !!trip.roundTrip
  }
  sessionStorage.setItem('travel_estimate_payload', JSON.stringify(payload))
  router.push('/estimate')
}

const onSearchHotel = debounce(loadHotels, 320)
const onSearchAttr = debounce(loadAttractions, 320)

watch(function () { return trip.nights }, persistTrip)
watch(function () { return trip.roundTrip }, persistTrip)
watch(function () { return trip.fromCity }, function () { if (trip.fromCity) loadTransports() })
watch(function () { return trip.toCity }, function () { if (trip.toCity) loadTransports() })
watch(modeFilter, loadTransports)

onMounted(async function () {
  await Promise.all([loadDestinations(), loadCities()])
  if (trip.destinationId && !current.value) {
    trip.destinationId = null
    trip.destinationName = ''
  }
  if (!trip.destinationId && destinations.value.length) {
    // 直接选第一个目的地，手机上少一步
    const first = destinations.value[0]
    trip.destinationId = first.id
    trip.destinationName = first.name
    trip.toCity = first.name
    ensureFromCity()
  }
  if (trip.destinationId) await loadDestinationData()
})
</script>

<template>
  <div class="page page-with-bar">
    <section class="section rise">
      <p class="eyebrow">STEP 01 · 目的地</p>
      <h1 class="display">去哪儿，大概花<em>多少</em></h1>
      <p class="lede">选目的地，勾上酒店、门票和车费，一键算出这趟旅行要花多少钱。</p>

      <div v-if="loading.dest" class="chip-row">
        <div class="skeleton" style="width: 104px; height: 60px"></div>
        <div class="skeleton" style="width: 104px; height: 60px"></div>
        <div class="skeleton" style="width: 104px; height: 60px"></div>
      </div>
      <div v-else class="chip-row" role="group" aria-label="目的地">
        <button
          v-for="d in destinations"
          :key="d.id"
          type="button"
          class="chip"
          :class="{ active: d.id === trip.destinationId }"
          :aria-pressed="d.id === trip.destinationId"
          @click="selectDestination(d)"
        >
          <strong>{{ d.name }}</strong>
          <small>{{ d.province || '目的地' }}</small>
        </button>
      </div>

      <p v-if="current && current.intro" class="dest-intro">{{ current.intro }}</p>
      <div v-else-if="!loading.dest && !destinations.length" class="empty">目的地数据还没录进来，稍后再看。</div>
    </section>

    <div class="ws-grid">
      <section class="section rise rise-2">
        <div class="section-head">
          <h2 class="section-title"><span class="idx">02</span>挑项目</h2>
          <label class="switch">
            <input v-model="trip.roundTrip" type="checkbox" />
            含返程车费
          </label>
        </div>

        <div class="filters">
          <div class="field field-sm">
            <span class="field-label">住几晚</span>
            <div class="stepper">
              <button type="button" :disabled="trip.nights <= 1" aria-label="少一晚" @click="stepNights(-1)">−</button>
              <span>{{ trip.nights }}</span>
              <button type="button" :disabled="trip.nights >= 30" aria-label="多一晚" @click="stepNights(1)">+</button>
            </div>
          </div>
          <div class="field" style="flex: 2 1 200px">
            <span class="field-label">现在勾了</span>
            <div class="picked-line">
              {{ pickedCount }} 项 · 预估 ￥{{ money(total) }}
            </div>
          </div>
        </div>

        <div class="tabs" role="tablist" style="margin-top: 6px">
          <button
            type="button"
            class="tab"
            :class="{ active: tab === 'hotels' }"
            role="tab"
            :aria-selected="tab === 'hotels'"
            @click="tab = 'hotels'"
          >
            酒店<span class="tab-n">{{ hotels.length }}</span>
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: tab === 'attractions' }"
            role="tab"
            :aria-selected="tab === 'attractions'"
            @click="tab = 'attractions'"
          >
            门票<span class="tab-n">{{ attractions.length }}</span>
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: tab === 'transports' }"
            role="tab"
            :aria-selected="tab === 'transports'"
            @click="tab = 'transports'"
          >
            车费<span class="tab-n">{{ transports.length }}</span>
          </button>
        </div>

        <!-- 酒店 -->
        <div v-if="tab === 'hotels'" class="tab-body">
          <div class="filters">
            <div class="field">
              <span class="field-label">搜酒店名</span>
              <input v-model="qHotel" class="input" type="search" placeholder="比如 星海" @input="onSearchHotel" />
            </div>
          </div>
          <p class="section-hint">住几晚已经在上面设好了，酒店只能选一家。再点一次取消。</p>

          <div v-if="loading.hotels" class="list">
            <div class="skeleton"></div>
            <div class="skeleton"></div>
            <div class="skeleton"></div>
          </div>
          <div v-else-if="!hotels.length" class="empty">这个目的地还没有酒店数据。</div>
          <div v-else class="list">
            <button
              v-for="h in hotels"
              :key="h.id"
              type="button"
              class="item"
              :class="{ selected: isHotel(h) }"
              @click="pickHotel(h)"
            >
              <span class="tick">✓</span>
              <span class="item-body">
                <span class="item-name">{{ h.name }}</span>
                <span class="item-meta">
                  <span v-if="h.level">{{ h.level }}</span>
                  <span v-if="h.address" class="dot">{{ h.address }}</span>
                </span>
                <span v-if="h.note" class="item-note">{{ h.note }}</span>
              </span>
              <span class="item-side">
                <span class="price">￥{{ money(h.pricePerNight) }}<small>/晚</small></span>
              </span>
            </button>
          </div>
        </div>

        <!-- 门票 -->
        <div v-if="tab === 'attractions'" class="tab-body">
          <div class="filters">
            <div class="field">
              <span class="field-label">搜景点名</span>
              <input v-model="qAttr" class="input" type="search" placeholder="比如 老虎滩" @input="onSearchAttr" />
            </div>
          </div>
          <p class="section-hint">门票可以勾好几个，按人头算一次。</p>

          <div v-if="loading.attractions" class="list">
            <div class="skeleton"></div>
            <div class="skeleton"></div>
            <div class="skeleton"></div>
          </div>
          <div v-else-if="!attractions.length" class="empty">这个目的地还没有门票数据。</div>
          <div v-else class="list">
            <button
              v-for="a in attractions"
              :key="a.id"
              type="button"
              class="item"
              :class="{ selected: isAttraction(a) }"
              @click="toggleAttraction(a)"
            >
              <span class="tick">✓</span>
              <span class="item-body">
                <span class="item-name">{{ a.name }}</span>
                <span class="item-meta">
                  <span v-if="a.openTime" class="dot">{{ a.openTime }}</span>
                </span>
                <span v-if="a.note" class="item-note">{{ a.note }}</span>
              </span>
              <span class="item-side">
                <span class="price">￥{{ money(a.ticketPrice) }}<small>/人</small></span>
              </span>
            </button>
          </div>
        </div>

        <!-- 车费 -->
        <div v-if="tab === 'transports'" class="tab-body">
          <div class="filters">
            <label class="field field-sm">
              <span class="field-label">出发地</span>
              <select v-model="trip.fromCity" class="select">
                <option v-for="c in cities" :key="'from-' + c" :value="c">{{ c }}</option>
              </select>
            </label>
            <label class="field field-sm">
              <span class="field-label">到达地</span>
              <select v-model="trip.toCity" class="select">
                <option v-for="c in cities" :key="'to-' + c" :value="c">{{ c }}</option>
              </select>
            </label>
            <label class="field field-sm">
              <span class="field-label">方式</span>
              <select v-model="modeFilter" class="select">
                <option value="">不限</option>
                <option v-for="m in MODES" :key="m" :value="m">{{ m }}</option>
              </select>
            </label>
          </div>
          <p class="section-hint">不勾具体车次也行，算总价时会自动用最便宜的一条。车费只能选一条。</p>

          <div v-if="loading.transports" class="list">
            <div class="skeleton"></div>
            <div class="skeleton"></div>
          </div>
          <div v-else-if="!transports.length" class="empty">
            这个路线还没有录入车费，换一个出发地试试。
          </div>
          <div v-else class="list">
            <button
              v-for="t in transports"
              :key="t.id"
              type="button"
              class="item"
              :class="{ selected: isTransport(t) }"
              @click="pickTransport(t)"
            >
              <span class="tick">✓</span>
              <span class="item-body">
                <span class="item-name">{{ t.fromCity }} → {{ t.toCity }}</span>
                <span class="item-meta">
                  <span>{{ t.mode }}</span>
                  <span v-if="t.durationMinutes" class="dot">{{ durationText(t.durationMinutes) }}</span>
                </span>
                <span v-if="t.note" class="item-note">{{ t.note }}</span>
              </span>
              <span class="item-side">
                <span class="price">￥{{ money(t.price) }}<small>/人</small></span>
              </span>
            </button>
          </div>
        </div>
      </section>

      <aside class="ws-aside">
        <div class="ticket rise rise-3">
          <div class="ticket-head">
            <h2 class="ticket-title">行程清单</h2>
            <span class="ticket-sub">{{ trip.destinationName || '未选目的地' }}</span>
          </div>
          <hr class="perf" />

          <ul v-if="trip.destinationId" class="line-list">
            <li class="line-item">
              <span class="lb">{{ trip.destinationName }} · 住 {{ trip.nights }} 晚</span>
              <span class="am">{{ trip.roundTrip ? '含返程' : '单程' }}</span>
            </li>
            <li v-if="trip.hotel" class="line-item">
              <span class="lb">
                {{ trip.hotel.name }}
                <button type="button" class="link-x" @click="removeHotel">去掉</button>
              </span>
              <span class="am">￥{{ money(trip.hotel.pricePerNight * trip.nights) }}</span>
            </li>
            <li v-for="a in trip.attractions" :key="'pick-' + a.id" class="line-item">
              <span class="lb">
                {{ a.name }}
                <button type="button" class="link-x" @click="removeAttraction(a.id)">去掉</button>
              </span>
              <span class="am">￥{{ money(a.ticketPrice) }}</span>
            </li>
            <li v-if="trip.transport" class="line-item">
              <span class="lb">
                {{ trip.transport.fromCity }} → {{ trip.transport.toCity }} {{ trip.transport.mode }}
                <button type="button" class="link-x" @click="removeTransport">去掉</button>
              </span>
              <span class="am">￥{{ money(trip.transport.price) }}{{ trip.roundTrip ? ' × 2' : '' }}</span>
            </li>
          </ul>
          <div v-else class="empty">还没选目的地。</div>

          <p v-if="trip.destinationId && !pickedCount" class="section-hint" style="margin: 10px 0 0">
            清单还空着，去上面勾几项。
          </p>

          <hr class="perf" />
          <div class="line-total">
            <span class="lb">预估合计</span>
            <span class="am"><i>￥</i>{{ money(total) }}</span>
          </div>
          <p class="section-hint" style="margin: 6px 0 0">点「算总价」由服务端核算，以明细页为准。</p>
          <button v-if="pickedCount" type="button" class="btn btn-ghost btn-wide" style="margin-top: 12px" @click="clearAll">
            清空重选
          </button>
        </div>
      </aside>
    </div>

    <div class="trip-bar">
      <div class="trip-bar-inner">
        <div class="trip-bar-info">
          <div class="trip-bar-label">
            预估合计
            <b>{{ trip.destinationName || '—' }}</b>
          </div>
          <div class="trip-bar-total"><i>￥</i>{{ money(total) }}</div>
          <div class="trip-bar-chips">
            <span>{{ trip.nights }} 晚</span>
            <span>门票 {{ trip.attractions.length }}</span>
            <span>{{ trip.hotel ? '含酒店' : '不含酒店' }}</span>
            <span>{{ trip.roundTrip ? '含返程' : '单程' }}</span>
          </div>
        </div>
        <button type="button" class="btn btn-primary" :disabled="!canEstimate" @click="goEstimate">
          算总价
        </button>
      </div>
    </div>
  </div>
</template>

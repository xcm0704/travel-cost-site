import { reactive } from 'vue'

const KEY = 'travel_trip'

const EMPTY = {
  destinationId: null,
  destinationName: '',
  nights: 1,
  hotel: null,
  attractions: [],
  transport: null,
  fromCity: '',
  toCity: '',
  roundTrip: true
}

function load() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return Object.assign({}, EMPTY)
    return Object.assign({}, EMPTY, JSON.parse(raw))
  } catch (e) {
    return Object.assign({}, EMPTY)
  }
}

export const trip = reactive(load())

export function persistTrip() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trip))
  } catch (e) {
    /* 隐私模式下写不进去也不影响使用 */
  }
}

export function resetTrip() {
  Object.assign(trip, {
    destinationId: null,
    destinationName: '',
    nights: 1,
    hotel: null,
    attractions: [],
    transport: null,
    fromCity: '',
    toCity: '',
    roundTrip: true
  })
  persistTrip()
}

export function hasSelection() {
  return !!(trip.hotel || trip.attractions.length || trip.transport)
}

export function previewTotal() {
  let sum = 0
  if (trip.hotel) sum += Number(trip.hotel.pricePerNight || 0) * Number(trip.nights || 1)
  for (const a of trip.attractions) sum += Number(a.ticketPrice || 0)
  if (trip.transport) sum += Number(trip.transport.price || 0) * (trip.roundTrip ? 2 : 1)
  return Math.round(sum * 100) / 100
}

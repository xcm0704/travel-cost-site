import { reactive } from 'vue'

let seq = 0

export const toasts = reactive([])

export function dismiss(id) {
  const i = toasts.findIndex(function (t) { return t.id === id })
  if (i > -1) toasts.splice(i, 1)
}

export function pushToast(text, type) {
  if (!text) return
  const id = ++seq
  toasts.push({ id: id, text: String(text), type: type || 'error' })
  setTimeout(function () { dismiss(id) }, 3600)
}

export function toastError(text) { pushToast(text, 'error') }
export function toastOk(text) { pushToast(text, 'ok') }

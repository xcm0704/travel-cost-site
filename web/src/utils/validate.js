// 前端也做一遍校验，规则与后端一致（后端仍是唯一权威）
const NAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9_]{3,20}$/

export function checkUsername(name) {
  if (!name) return '用户名不能空着'
  if (name.length < 3 || name.length > 20) return '用户名要 3 到 20 个字'
  if (!NAME_RE.test(name)) return '用户名字符只许中文、英文、数字和下划线'
  return ''
}

export function checkPassword(pwd) {
  if (!pwd) return '密码不能空着'
  if (pwd.length < 6 || pwd.length > 32) return '密码要 6 到 32 个字'
  return ''
}

export function checkConfirm(pwd, confirm) {
  if (!confirm) return '再输一遍密码'
  if (pwd !== confirm) return '两次输入的密码不一样'
  return ''
}

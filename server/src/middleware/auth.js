const jwt = require('jsonwebtoken');
const config = require('../config');

function readToken(req) {
  const header = req.headers.authorization || '';
  const matched = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  return matched ? matched[1].trim() : null;
}

// 校验 Bearer token，成功把用户信息挂到 req.user
function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: '请先登录' });
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (err) {
    const expired = err && err.name === 'TokenExpiredError';
    return res.status(401).json({ error: expired ? '登录已过期，请重新登录' : '登录状态不对，请重新登录' });
  }
  if (!payload || !payload.id) return res.status(401).json({ error: '登录状态不对，请重新登录' });
  req.user = { id: payload.id, username: payload.username, role: payload.role };
  next();
}

// 必须已登录且 role=admin
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: '只有管理员能做这个' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, readToken };

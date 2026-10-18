const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const config = require('../config');
const { pool, mapUser } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// 3~20 个字，只许中英文、数字、下划线
const USERNAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9_]{3,20}$/;

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

router.post('/register', async (req, res, next) => {
  try {
    const body = req.body || {};
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!username) return res.status(400).json({ error: '请填写用户名' });
    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({ error: '用户名要 3~20 个字，只能用中文、英文、数字或下划线' });
    }
    if (username.toLowerCase() === 'admin') {
      return res.status(400).json({ error: '这个名字不能用' });
    }
    if (!password) return res.status(400).json({ error: '请填写密码' });
    if (password.length < 6 || password.length > 32) {
      return res.status(400).json({ error: '密码要 6~32 位' });
    }

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    let result;
    try {
      [result] = await pool.query(
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
        [username, passwordHash, 'user']
      );
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: '这个用户名已经有人用了' });
      }
      throw err;
    }

    const user = { id: result.insertId, username, role: 'user' };
    return res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    return next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const body = req.body || {};
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!username || !password) {
      return res.status(401).json({ error: '用户名或密码不对' });
    }

    const [rows] = await pool.query(
      'SELECT id, username, password_hash, role FROM users WHERE username = ? LIMIT 1',
      [username]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: '用户名或密码不对' });
    }

    const row = rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: '用户名或密码不对' });

    const user = { id: row.id, username: row.username, role: row.role };
    return res.json({ token: signToken(user), user });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, username, role FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (rows.length === 0) return res.status(401).json({ error: '账号不存在了，请重新注册' });
    const user = mapUser(rows[0]);
    return res.json({ id: user.id, username: user.username, role: user.role });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

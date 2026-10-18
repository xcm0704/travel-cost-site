const fs = require('fs');
const path = require('path');

const express = require('express');
const cors = require('cors');

const config = require('./config');

// 只负责组装 app，不 listen —— 本地由 src/index.js 起服务，Netlify 由 netlify/functions/api.js 包成函数
const app = express();

app.use(
  cors({
    origin(origin, callback) {
      // 本机任意端口的前端（localhost / 127.0.0.1）以及无 Origin 的请求（curl、同源页面）都放行
      if (!origin) return callback(null, true);
      if (config.corsOrigins.indexOf(origin) !== -1) return callback(null, true);
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
      return callback(null, false);
    },
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/estimate', require('./routes/estimate'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/catalog'));

// 没命中的 /api 请求统一 404
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

// 本地/自托管生产模式：存在 web/dist 就托管，非 /api 的 GET 一律回 index.html（SPA fallback）
// 部署到 Netlify 时静态文件由 CDN 托管，这里跳过（函数里也没有 dist 目录）
const webDist = config.webDist;
const hasWebDist = !config.isServerless && fs.existsSync(path.join(webDist, 'index.html'));
if (hasWebDist) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api(\/|$)).*/, (req, res) => res.sendFile(path.join(webDist, 'index.html')));
}

app.use((req, res) => res.status(404).json({ error: '接口不存在' }));

app.use((err, req, res, next) => {
  console.error('[error]', req.method, req.originalUrl, (err && (err.stack || err.message)) || err);
  if (res.headersSent) return;
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    return res.status(400).json({ error: '请求内容不是合法的 JSON' });
  }
  if (err && err.code === 'ER_NO_SUCH_TABLE') {
    return res.status(500).json({ error: '数据库还没建好，先跑 npm run db:setup（云库见 docs/部署上线.md）' });
  }
  if (err && (err.code === 'ECONNREFUSED' || err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ETIMEDOUT')) {
    return res.status(500).json({ error: '连不上数据库，请检查环境变量里的 DB_HOST、DB_USER、DB_PASSWORD、DB_SSL' });
  }
  return res.status(500).json({ error: '服务器出错了，请稍后再试' });
});

// 给启动日志用（index.js 读这两个）
app.locals.webDist = webDist;
app.locals.hasWebDist = hasWebDist;

module.exports = app;

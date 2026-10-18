const fs = require('fs');
const path = require('path');

const express = require('express');
const cors = require('cors');

const config = require('./config');

// 先做环境自检：缺关键变量就打印中文清单后干净退出，不甩栈给用户看
const issues = config.startupIssues();
if (issues.fatal.length > 0) {
  console.error('');
  console.error('启动失败：缺少必需的环境变量');
  for (const line of issues.fatal) console.error('  - ' + line);
  console.error('');
  console.error('怎么改：本地把 .env.example 复制成 server/.env 再填；云上（Render）到 Environment 里加这些变量。');
  console.error('详细步骤见 docs/部署上线.md');
  console.error('');
  process.exit(1);
}
for (const line of issues.warn) console.warn('[提醒] ' + line);

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

// 生产模式：存在 web/dist 就托管，非 /api 的 GET 一律回 index.html（SPA fallback）
const webDist = config.webDist;
const hasWebDist = fs.existsSync(path.join(webDist, 'index.html'));
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
    return res.status(500).json({ error: '连不上数据库，请检查 .env / Render 环境变量里的 DB_HOST、DB_USER、DB_PASSWORD、DB_SSL' });
  }
  return res.status(500).json({ error: '服务器出错了，请稍后再试' });
});

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log('后端已启动： http://localhost:' + config.port + '（监听 0.0.0.0，同一局域网可用本机 IP 访问）');
  console.log('健康检查： http://localhost:' + config.port + '/api/health');
  console.log('运行环境： ' + (config.isProduction ? '生产（NODE_ENV=production）' : '开发') + (config.envFileLoaded ? '，已读取 server/.env' : '，没有 .env 文件'));
  console.log('数据库： ' + config.dbTarget() + ' | TLS：' + config.tlsLabel());
  console.log('静态托管： ' + (hasWebDist ? webDist : '没找到 web/dist，只提供 /api（先执行 npm run build）'));
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error('端口 ' + config.port + ' 已被占用：先关掉占用的进程，或者换个端口（设环境变量 PORT）');
    process.exit(1);
  }
  throw err;
});

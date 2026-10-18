const config = require('./config');

// 先做环境自检：缺关键变量就打印中文清单后干净退出，不甩栈给用户看
const issues = config.startupIssues();
if (issues.fatal.length > 0) {
  console.error('');
  console.error('启动失败：缺少必需的环境变量');
  for (const line of issues.fatal) console.error('  - ' + line);
  console.error('');
  console.error('怎么改：本地把 .env.example 复制成 server/.env 再填；云上（Netlify / Render）到环境变量里加这些。');
  console.error('详细步骤见 docs/部署上线.md');
  console.error('');
  process.exit(1);
}
for (const line of issues.warn) console.warn('[提醒] ' + line);

const app = require('./app');

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log('后端已启动： http://localhost:' + config.port + '（监听 0.0.0.0，同一局域网可用本机 IP 访问）');
  console.log('健康检查： http://localhost:' + config.port + '/api/health');
  console.log('运行环境： ' + (config.isProduction ? '生产（NODE_ENV=production）' : '开发') + (config.envFileLoaded ? '，已读取 server/.env' : '，没有 .env 文件'));
  console.log('数据库： ' + config.dbTarget() + ' | TLS：' + config.tlsLabel() + ' | 连接池上限：' + config.dbPoolMax);
  console.log('静态托管： ' + (app.locals.hasWebDist ? app.locals.webDist : '没找到 web/dist，只提供 /api（先执行 npm run build）'));
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error('端口 ' + config.port + ' 已被占用：先关掉占用的进程，或者换个端口（设环境变量 PORT）');
    process.exit(1);
  }
  throw err;
});

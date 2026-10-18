# 旅游费用查询网站

一个查旅游花多少钱的小站：选目的地 → 看酒店/门票/车费 → 勾几项一键算这趟大概花多少。
管理员另有数据管理和数据总览。

- 前端：Vue3 + Vite + vue-router + axios（`web/`）
- 后端：Node.js + Express 4（`server/`）
- 数据库：MySQL 8 / TiDB Cloud（库名 `travel_cost`）

## 目录

```
docs/需求与技术方案.md   前后端接口契约（唯一约定，别乱改）
docs/部署上线.md         从零到拿到网址的分步操作（含「今天就发给好友」的局域网路径）
server/                  后端 + 数据库脚本
web/                     前端
package.json             根脚本：一条命令装依赖、打包、启动
render.yaml              Render 部署蓝图
```

## 本地跑起来（开发模式）

```powershell
cd D:\旅游费用查询网站
npm install                       # 只需要一次
npm run db:setup                  # 建库 travel_cost + 建表 + 灌样例数据（可重复跑）
npm run dev:server                # 后端 http://localhost:3000
npm run dev:web                   # 前端 http://localhost:5173（/api 代理到 3000）
```

管理员：`admin` / `123456`（普通用户自己在 /register 注册）

## 生产模式（就是发给好友的样子）

```powershell
npm run build                     # 装依赖 + 打包前端到 web/dist + 装后端依赖
$env:PORT=8080; npm start         # 一个进程同时提供页面和 /api
# 打开 http://localhost:8080
```

局域网给好友看：`http://<本机局域网IP>:8080`（防火墙要放行这个端口）。

## 上云（Render + TiDB Cloud）

完整步骤见 **`docs/部署上线.md`**。一句话版本：

1. 代码推到 GitHub；
2. TiDB Cloud 建 Serverless 集群，拿 Host/User/Password；
3. 在本地用 `DB_HOST=... DB_USER=... DB_PASSWORD=... DB_SSL=true npm run db:setup` 一步建库建表灌样例；
4. Render 新建 Web Service（或用 `render.yaml` 的 Blueprint），填环境变量；
5. 打开 `https://<服务名>.onrender.com/api/health` 看到 `{"ok":true}` 就成了。

## 自测

```powershell
node server/scripts/smoke.js              # 接口自测（需要后端已在 3000 端口跑着）
node server/scripts/db-config.js          # 看最终生效的数据库连接配置（密码打码）
```

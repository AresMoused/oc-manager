# 你现在要做的事（Discord + Railway）

指令和结算在 **Vercel**；「贴图 + 当日 `#代码` → 立刻进公布栏」在 **Railway 边车**。  
下面全是你在网页上点的，做完把 ID 填进环境变量即可。

`$1` Free 可以先连上试。边车 24 小时占内存，月底若额度不够，升 **Hobby $5** 就稳。

---

## 1. Discord 应用（同一份，已有登录的那个）

打开 [Discord Developer Portal](https://discord.com/developers/applications) → 选 oc-manager 那个 Application。

### Bot

1. 左侧 **Bot**
2. **Reset Token** → 复制，这是 `DISCORD_BOT_TOKEN`（只显示一次）
3. 关掉 **Public Bot**（只进自己服的话）
4. **Privileged Gateway Intents** 打开：
   - Server Members Intent（登录已经在用，可保持开）
   - **Message Content Intent**（必须：否则读不到 `#代码`）
5. 保存

### Public Key

左侧 **General Information** → **Public Key** → 复制，这是 `DISCORD_PUBLIC_KEY`。

### 邀请 Bot 进服

左侧 **OAuth2 → URL Generator**：

- Scopes：`bot`、`applications.commands`
- Bot Permissions：
  - View Channels
  - Send Messages
  - Embed Links
  - Attach Files
  - Read Message History
  - Add Reactions
  - （可选）Create Public Threads

打开生成的 URL，选你的服务器，授权。

**Interactions Endpoint URL 先空着。** 网站部署出 `/api/discord/interactions` 后再填。

---

## 2. 服务器里的频道和身份组

出题、转发投稿、公布投票结果 **用同一个频道**。跑图可以另开（也可多个、也可就是这个频道）。

| | 干什么 | 环境变量 |
| --- | --- | --- |
| 一个频道，例如 `#每日灵感` | 0 点出题、转发「图 + `#代码`」、宣布冠军 | `DISCORD_DAILY_CHANNEL_ID` |
| 一个或多个跑图频道 | 玩家发图 + 当日 `#代码`（可以就是上面那个频道） | `DISCORD_WATCH_CHANNEL_IDS` |
| 一个身份组，例如 `@每日灵感` | 出题和公布结果时 @ 它 | `DISCORD_PING_ROLE_ID` |

复制 ID：开发者模式 → 右键频道 / 身份组 → 复制 ID。  
`DISCORD_PING_ROLE_ID` **只放环境变量**，不写进代码。以后换身份组只改 Vercel 变量再 Redeploy。

Bot 角色需要：能看、能发该频道；**身份组设置里打开「允许任何人 @ 提及」**（否则 bot @ 了也没通知）。

给 Bot 角色能看、能发这些频道。

---

## 3. 随机一串 `CRON_SECRET`

本地执行：

```bash
openssl rand -hex 24
```

Vercel 的 Cron / Railway 边车打内部接口时都带这个，防止别人伪造投稿。

---

## 4. 填 Vercel 环境变量

Vercel 项目 → Settings → Environment Variables（Production + Preview 都加）：

```
DISCORD_PUBLIC_KEY=
DISCORD_BOT_TOKEN=
DISCORD_DAILY_CHANNEL_ID=
DISCORD_WATCH_CHANNEL_IDS=     # 多个频道用逗号
DISCORD_PING_ROLE_ID=          # 出题 / 公布结果时 @ 的身份组
DISCORD_DAILY_EMOJI=❤️
CRON_SECRET=
```

`DISCORD_CLIENT_ID` / `SECRET` / `GUILD_ID` / `ADMIN_*` 保持不动。

改完要 **Redeploy** 一次才生效。

---

## 5. 开 Railway

1. 打开 [railway.com](https://railway.com) → Login with GitHub  
2. **New Project** → **Deploy from GitHub repo** → `oc-manager`（分支 `vercel-preview`）  
3. 仓库已带 `Dockerfile.gateway`，**不要**让它跑 `npm run build`（那是网站）。  
   Settings → Build → Builder 选 **Dockerfile**，路径：`Dockerfile.gateway`  
   Start Command 可空（镜像自己会跑 gateway），或填 `npx tsx scripts/discord-gateway.ts`  
   这个服务只跑边车，不要绑域名。

4. **Variables** 里加：

```
DISCORD_BOT_TOKEN=          # 和 Vercel 同一份
DISCORD_WATCH_CHANNEL_IDS=
DISCORD_GUILD_ID=
INGEST_URL=https://<你的生产域名>/api/discord/ingest
CRON_SECRET=                # 和 Vercel 同一份
```

生产域名用现在的正式站（例如 `https://你的APP_URL`），不要尾斜杠。

5. Deploy。日志里应出现 `gateway ready` 或 `IDENTIFY`。若立刻退出，把日志贴给我。

### 关于 $1

- 试用期 $5 额度通常够跑好几周  
- Free **$1/月** 对 24h 占内存可能不够，Railway 会提示升级  
- 到时候升 **Hobby $5** 即可，代码不用改

同一 GitHub 仓可以：Vercel 跑 Next，Railway 只跑 `discord:gateway`。

---

## 6. 做完把这些发我（可打码 Token 后几位）

- [ ] Bot 已进服  
- [ ] Message Content Intent 已开  
- [ ] 每日频道 ID（出题 = 公布栏）  
- [ ] 监听频道 ID（可多个，可与每日频道相同）  
- [ ] 要 @ 的身份组 ID  
- [ ] Public Key 已进 Vercel  
- [ ] Railway 服务 Start Command 已改成 `npm run discord:gateway`  
- [ ] 正式站 `APP_URL`（我用来写 Interactions URL 和 `INGEST_URL`）

我这边会写：`/灵感`、`/每日`、ingest 转发卡片、0 点 Cron、边车过滤逻辑。你填完变量、Railway 能保持在线后就能联调。

---

## 先不要做

- 不要把 Interactions Endpoint 指到随便一个 URL（签名校验不过 Discord 会报 Failed）  
- 不要给 Railway 跑 `next start`  
- 不要开 Presence Intent

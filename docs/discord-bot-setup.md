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

## 2. 服务器里建频道

建议三个（每日题和跑图也可以合成一个）：

| 频道 | 干什么 | 环境变量 |
| --- | --- | --- |
| `#每日灵感` | Bot 0 点发今日题 | `DISCORD_DAILY_CHANNEL_ID` |
| `#跑图交流` | 人往这里发「图 + `#代码`」 | `DISCORD_WATCH_CHANNEL_IDS` |
| `#公布栏` | Bot 转发卡片、大家点表情投票 | `DISCORD_BULLETIN_CHANNEL_ID` |

复制 ID：Discord 设置 → 高级 → 开发者模式 → 右键频道 → 复制频道 ID。  
服务器 ID 你们已有 `DISCORD_GUILD_ID`。

给 Bot 角色能看、能发这三个频道。

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
DISCORD_BULLETIN_CHANNEL_ID=
DISCORD_DAILY_EMOJI=❤️
CRON_SECRET=
```

`DISCORD_CLIENT_ID` / `SECRET` / `GUILD_ID` / `ADMIN_*` 保持不动。

改完要 **Redeploy** 一次才生效。

---

## 5. 开 Railway

1. 打开 [railway.com](https://railway.com) → Login with GitHub  
2. **New Project** → **Deploy from GitHub repo** → `oc-manager`  
3. 若问 Root / Start Command，先不要用默认 `npm start`（那是网站）。建好服务后：

   **Settings → Deploy**
   - Custom Start Command：`npm run discord:gateway`

   这个服务 **只跑边车**，不要再给它绑自己的域名。

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
- [ ] 三个频道 ID  
- [ ] Public Key 已进 Vercel  
- [ ] Railway 服务 Start Command 已改成 `npm run discord:gateway`  
- [ ] 正式站 `APP_URL`（我用来写 Interactions URL 和 `INGEST_URL`）

我这边会写：`/灵感`、`/每日`、ingest 转发卡片、0 点 Cron、边车过滤逻辑。你填完变量、Railway 能保持在线后就能联调。

---

## 先不要做

- 不要把 Interactions Endpoint 指到随便一个 URL（签名校验不过 Discord 会报 Failed）  
- 不要给 Railway 跑 `next start`  
- 不要开 Presence Intent

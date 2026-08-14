# Discord 登录配置

分支：`feature/discord-auth`

## 1. 创建 Discord 应用

1. 打开 https://discord.com/developers/applications → New Application
2. OAuth2 → Add Redirect：
   - `http://localhost:3000/api/auth/callback`
   - `https://你的域名/api/auth/callback`
3. 复制 Client ID / Client Secret

## 2. 环境变量

复制 `.env.example` 为 `.env.local`：

```
APP_URL=https://你的域名
AUTH_SECRET=一长串随机字符
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_GUILD_ID=你的服务器ID
DISCORD_REQUIRED_ROLE_IDS=角色ID1,角色ID2
```

开启 Discord 开发者模式后，右键服务器 / 身份组可复制 ID。

## 3. 行为说明

- 未登录用户只能访问 `/login` 与认证相关 API
- 登录使用 Discord OAuth，scope：`identify` + `guilds.members.read`
- 回调时检查用户是否在 `DISCORD_GUILD_ID` 服务器内
- 若配置了 `DISCORD_REQUIRED_ROLE_IDS`，用户必须拥有其中**至少一个**身份组
- 通过后写入 HttpOnly session cookie（约 14 天）

## 4. 本地开发

```bash
npm install
# 填写 .env.local
npm run dev
```

打开 http://localhost:3000 → 应跳转到登录页。

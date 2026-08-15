# Vercel + Cloudflare R2 部署

分支：`feature/vercel-r2`

## 1. Cloudflare R2

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → Create bucket，例如 `oc-manager`
2. 对该 bucket 开启 **Public access**（或绑定自定义域名）
   - 使用 R2.dev subdomain：Settings → Public access → Allow Access
   - 记下公开 URL，例如 `https://pub-xxxxx.r2.dev`
3. **Manage R2 API Tokens** → Create API token
   - Permission: Object Read & Write
   - 指定上面的 bucket
   - 记下：Access Key ID、Secret Access Key、Account ID

## 2. 环境变量（Vercel Project Settings → Environment Variables）

| 变量 | 说明 |
|------|------|
| `APP_URL` | 正式域名，如 `https://your-app.vercel.app`（无尾斜杠） |
| `AUTH_SECRET` | 长随机字符串 |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord 应用 |
| `DISCORD_GUILD_ID` | 服务器 ID |
| `DISCORD_REQUIRED_ROLE_IDS` | 可选，逗号分隔 |
| `R2_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | R2 API token |
| `R2_SECRET_ACCESS_KEY` | R2 API secret |
| `R2_BUCKET_NAME` | 如 `oc-manager` |
| `R2_PUBLIC_URL` | 公开访问前缀，如 `https://pub-xxxxx.r2.dev` |

## 3. Discord OAuth 回调

在 Discord Developer Portal → OAuth2 → Redirects 增加：

```
https://你的域名/api/auth/callback
```

`APP_URL` 必须与该域名一致。

## 4. 本地开发

未配置 R2 时仍使用 `./data` 与 `public/uploads`。  
配置 R2 后本地也会读写 R2（与生产同一数据）。

## 5. 对象路径

| 路径 | 内容 |
|------|------|
| `data/users/{userId}/app-data.json` | 用户角色/世界 |
| `data/users-index.json` | 登录用户索引 |
| `data/shares.json` | 分享记录 |
| `uploads/{uuid}.ext` | 上传图片 |

## 6. 注意

- Vercel Serverless **无持久磁盘**，生产必须配置 R2
- JSON 为读-改-写，高并发同时保存可能互相覆盖（小群场景一般够用）
- 首次部署后数据为空；可从旧 `data/` 手动上传到 R2 同名路径迁移

# BangumiTV

把你的 Bangumi 追番进度展示在静态网页上。

这是一个 Cloudflare Worker，主要用来提供
API，让你能方便地获取自己的“想看”、“看过”和“在看”列表，顺便还带了个每日放送表。

自带了一个简单的演示页面，部署完就能看到效果。

## 功能

- **API 接口**: 拿来即用的 JSON 数据，包括收藏进度和每日放送。
- **自动更新**: 写了个脚本从 Bangumi 抓数据，配合 GitHub Actions
  可以自动定时更新。
- **Cloudflare Workers**: 部署简单，速度快，还免费。
- **静态托管**: 前端页面也直接塞在 Worker 里了 (KV)，不用额外部署。

## 怎么用

### 准备工作

- Node.js (v18 以上)
- pnpm (或者 npm)
- Cloudflare 账号

### 安装

```bash
pnpm install
```

### 本地跑起来

1. **设置账号**: 告诉脚本你要抓谁的收藏。
   ```bash
   export BANGUMI_USER=your_username
   ```
   _(不设的话默认是 `geekaven`)_

2. **抓数据**: 先跑一下脚本把数据抓下来存成本地 JSON。
   ```bash
   pnpm collect
   ```
   数据会保存在 `src/data/` 里。

3. **启动**:
   ```bash
   pnpm dev
   ```
   打开 `http://localhost:8787` 看看。

## API 说明

| 路径                         | 说明     | 参数              |
| ---------------------------- | -------- | ----------------- |
| `/api/bangumi?type=watching` | 在看     | `offset`, `limit` |
| `/api/bangumi?type=want`     | 想看     | `offset`, `limit` |
| `/api/bangumi?type=watched`  | 看过     | `offset`, `limit` |
| `/api/bangumi_total`         | 统计总数 | 无                |
| `/api/calendar`              | 每日放送 | 无                |

## 部署

### 手动部署

登录 Cloudflare 然后一把梭：

```bash
npx wrangler login

# 记得设环境变量
export BANGUMI_USER=your_username
pnpm deploy:worker
```

### 自动部署 (GitHub Actions)

懒人推荐。Fork 之后配置一下，让 GitHub 定时帮你更新数据并部署。

1. **Fork 本项目**。

2. **配置 Secrets**: 去仓库的 `Settings` -> `Secrets and variables` ->
   `Actions`，填这三个：

   | Secret                  | 填什么                                       |
   | ----------------------- | -------------------------------------------- |
   | `BANGUMI_USER`          | 你的 Bangumi ID                              |
   | `CLOUDFLARE_API_TOKEN`  | Cloudflare API Token (要有 Workers 编辑权限) |
   | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID (Workers 面板右边有)   |

3. **搞定**: 去 `Actions` 页面看一眼 `Update Data & Deploy Worker`
   跑没跑。默认每 2 小时更新一次。

## 在其他网页中使用

如果你想把追番进度挂到自己的博客或网站上，只需要引入 CSS 和 JS，然后配置一下 API
地址就行。

```html
<!-- 1. 引入样式 -->
<link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/bangumi-tv@latest/public/dist/bangumi.css"
>

<!-- 2. 配置参数 -->
<script>
    const bgmConfig = {
        apiUrl: "https://your-worker-domain.workers.dev", // 换成你部署好的 Worker 域名
        quote: "生命不止，追番不息！", // 选填，自定义一句话
    };
</script>

<!-- 3. 放置容器 -->
<div class="bgm-container"></div>

<!-- 4. 引入脚本 -->
<script
    src="https://cdn.jsdelivr.net/npm/bangumi-tv@latest/public/dist/bangumi.js"
></script>
```

## 目录结构

- `src/index.ts`: Worker 的主代码。
- `scripts/collection.ts`: 抓数据的脚本。
- `public/`: 放前端页面的。
- `wrangler.toml`: Cloudflare 的配置文件。

> [!TIP]
> 数据是构建的时候生成的，所以需要定时触发构建来更新数据。用 GitHub Actions
> 最省事。

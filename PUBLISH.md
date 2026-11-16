# 发布清单（dsh-dingpan 1.0.0）

包已改名并打包通过。剩下两步卡在凭据上：npm token 失效、本机没有 git / GitHub token。

## 1. npm

现状：
- `dsh-dingpan` 在 npm 上**这个名字是空的**（`GET registry.npmjs.org/dsh-dingpan` → 404），可以首发 1.0.0。
- 但 `~/.npmrc` 里的 `_authToken` 已失效：`pnpm whoami` → `401 Unauthorized`，
  `pnpm publish` → `404 Not Found - PUT https://registry.npmjs.org/dsh-dingpan`（npm 对无权限发布统一回 404，不是名字被占）。

补齐方式（任一）：

```bash
npm login                                    # 交互登录，写入新 token
# 或
npm config set //registry.npmjs.org:_authToken <新 token>
```

然后：

```bash
cd stock-watch
pnpm pack                 # 已通过：dsh-dingpan-1.0.0.tgz
pnpm publish --no-git-checks
```

## 2. GitHub

现状：本机没有 `git`、没有 `gh`、没有 GitHub token，无法推送。

补齐方式（任一）：

- **给一个 GitHub PAT（`repo` 权限）**：可以不装 git，直接用 REST API 建仓库并上传全部文件。
- 或者网页上新建仓库，把 `docs/dsh-dingpan-1.0.0-source.zip` 解压后拖进去。

命令行推送（仓库已建好时）：

```bash
cd stock-watch
git init
git add .
git commit -m "feat: 盯盘 dsh-dingpan 1.0 — K线周期/全球市场/板块/存储价格/任务栏胶囊"
git branch -M main
git remote add origin https://github.com/<你的用户名>/dsh-dingpan.git
git push -u origin main
```

## 3. 发布前替换占位符

`package.json` 里的 `repository` / `homepage` / `bugs` 仍是 `YOUR_GITHUB_USER`：

```bash
grep -n YOUR_GITHUB_USER package.json
```

## 4. 产物

| 文件 | 说明 |
| --- | --- |
| `docs/screenshots/watch.png` | 自选 + K 线（1280×796） |
| `docs/screenshots/world.png` | 全球市场（1280×596） |
| `docs/screenshots/sectors.png` | 板块（1280×856） |
| `docs/screenshots/storage.png` | 存储价格（1280×1056） |
| `docs/screenshots/pill.png` | 任务栏胶囊（601×64，透明底） |
| `docs/promo/preview.html` | 宣传图源文件（真实数据渲染） |
| `docs/dsh-dingpan-1.0.0-source.zip` | 可拖进 GitHub 的源码包 |

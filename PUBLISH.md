# 发布记录与后续流程

## 已发布

| 渠道 | 地址 | 版本 |
| --- | --- | --- |
| npm | https://www.npmjs.com/package/dsh-dingpan | 1.1.1（2026-11-26 发布，含暗盘页签） |
| GitHub | https://github.com/mumu1001ai-jpg/dsh-dingpan | main @ 1.1.1 |
| awesome-dsh-plugin | PR #16091 已合并 | 1.1.x 描述更新分支 `update-dsh-dingpan-darkpool` 已推送，待开 PR |

- npm 账号：`mumu1001ai`；Token 用 `~/Desktop/npm.txt`（granular，勾了 Bypass 2FA），写进包目录的 `.npmrc` 后 `pnpm publish --no-git-checks`，**跑完删掉 `.npmrc`**。
- 发布后注册表会先返回 `Your package is being processed and may take a few minutes to become available.`，这段时间内再发同版本会报 `409 Cannot publish over previously staged version`，**不要急着换版本号**，等 1–20 分钟再看 `https://registry.npmjs.org/<pkg>` 的 versions 是否出现。
- GitHub 用一个 fine-grained token 通过 REST API 推送（本机没有 git 命令）。这个 token 只有 contents 权限，**开不了 PR**；awesome-dsh-plugin 的 PR 需要人在网页上点一下（用 compare 链接）。
- 暗盘取 OKX / Bitget 报价需要开启代理；README 顶部、面板内、npm 描述和 awesome 条目都写明了。

## 发布新版本

```bash
# 1) 改版本号（语义化：功能 feat → minor，修复 fix → patch）
npm version patch --no-git-tag-version

# 2) 打包
pnpm pack

# 3) 发布
pnpm publish --no-git-checks
```

如果 `pnpm publish` 报 `401` / `404 Not Found - PUT`，说明本机 npm 客户端没读到 token
（这个环境下 pnpm 的 whoami/publish 就是这样，但 registry 本身接受同一个 token）。
兜底做法：直接对 `PUT https://registry.npmjs.org/dsh-dingpan` 发发布文档
（`versions` + `dist-tags` + `_attachments` 里放 tgz 的 base64），`Authorization: Bearer <token>`，
返回 `202 {"success":true}` 即受理。若返回 `409 Cannot publish over previously staged version`，说明该版本已在处理队列里，等它落库即可。

## 凭据

- npm token：`~/Desktop/npm.txt`（granular token，勾了 Bypass 2FA，写着 7 天有效期 → 过期后重新生成）
- GitHub token：`~/Desktop/githubtoken.txt`（fine-grained，contents 读写；**没有 Pull requests 权限**）
- 两个文件都不要提交进仓库，用完删除或撤销。

## 产物

| 文件 | 说明 |
| --- | --- |
| `docs/screenshots/watch.png` | 自选 + K 线 |
| `docs/screenshots/world.png` | 全球市场 |
| `docs/screenshots/sectors.png` | 板块 |
| `docs/screenshots/storage.png` | 存储价格 |
| `docs/screenshots/pill*.png` | 任务栏胶囊 |
| `docs/promo/preview.html` | 宣传图源文件（真实数据渲染） |

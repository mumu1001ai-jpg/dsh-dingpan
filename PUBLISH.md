# 发布记录与后续流程

## 已发布

| 渠道 | 地址 | 版本 |
| --- | --- | --- |
| npm | https://www.npmjs.com/package/dsh-dingpan | 1.0.1 |
| GitHub | https://github.com/mumu1001ai-jpg/dsh-dingpan | main |

- npm 账号：`mumu1001ai`；首次发布会先落一个 `0.0.0-stage` 占位版本，等人工/自动审核通过后正式版本才替换掉 `latest`（约 1–2 分钟）。
- GitHub 用一个 fine-grained token 通过 REST API 推送（本机没有 git）。

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
返回 `202 {"success":true}` 即受理，首次发布还会先落一个 `0.0.0-stage` 占位版本，1–2 分钟后正式版本顶上 `latest`。

## 凭据

- npm token：`~/Desktop/npm.txt`（granular token，勾了 Bypass 2FA，写着 7 天有效期 → 过期后重新生成）
- GitHub token：`~/Desktop/githubtoken.txt`（fine-grained，`repo` 权限）
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

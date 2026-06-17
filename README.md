# 邮件数据提取器

一个纯前端的邮件解析工具，用于从 `.eml`、`.txt` 等邮件文本中提取邮箱、目标链接、二维码 ID 和发送时间，并支持复制列数据、按邮箱分组查看、导出 CSV。

## 本地运行

需要先安装 Node.js 20 或更新版本。

```bash
npm install
npm run dev
```

浏览器打开终端显示的本地地址即可使用。

## 构建

```bash
npm run build
```

构建产物会输出到 `dist/`。

## 部署到 GitHub Pages

1. 在 GitHub 创建一个新仓库。
2. 把本项目推送到仓库的 `main` 分支。
3. 进入仓库 `Settings -> Pages`。
4. 在 `Build and deployment` 的 `Source` 中选择 `GitHub Actions`。
5. 推送到 `main` 后，`.github/workflows/deploy.yml` 会自动构建并发布 `dist/`。

项目已在 `vite.config.ts` 中设置 `base: './'`，因此可以部署到任意 GitHub Pages 仓库路径。

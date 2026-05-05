# Bark Push Desktop

基于 [Tauri v2](https://v2.tauri.app/) + Rust 构建的 [Bark](https://github.com/Finb/Bark) 桌面推送客户端。

## 功能

- **快速推送** — 输入内容，一键推送到 iPhone
- **两种发送模式**
  - JSON POST 模式（默认）— 标准 REST API 调用
  - URL GET 模式 — 适合浏览器、curl、脚本等场景
- **点击跳转** — 通知点击后可打开指定 URL
- **加密推送** — 支持 AES-128/192/256 + CBC/ECB 模式，参照 [Bark 加密文档](https://github.com/Finb/bark-server)
- **Token 持久化** — 设备密钥和配置自动保存，重启不丢失
- **关闭到任务栏** — 可选最小化到系统托盘
- **剪贴板粘贴** — 一键从剪贴板粘贴内容
- **调试日志** — 可选的运行日志面板

## 下载

从 [Releases](https://github.com/52sanmao/bark-push/releases) 页面下载安装包：

- `Bark Push_1.0.0_x64_en-US.msi` — Windows MSI 安装包
- `Bark Push_1.0.0_x64-setup.exe` — Windows NSIS 安装包

## 开发

### 环境要求

- [Node.js](https://nodejs.org/)
- [Rust](https://rustup.rs/)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### 运行

```bash
npm install
npx tauri dev
```

### 构建

```bash
npx tauri build
```

构建产物在 `src-tauri/target/release/bundle/` 目录下。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML/CSS/JS |
| 后端 | Rust + Tauri v2 |
| HTTP | reqwest + rustls |
| 加密 | AES (aes crate) + CBC/ECB |
| 编码 | base64 + urlencoding |

## API 参考

### JSON POST 模式

```
POST https://api.day.app/{device_key}
Content-Type: application/json

{
  "title": "标题",
  "body": "内容",
  "url": "https://www.baidu.com",
  "sound": "birdsong"
}
```

### URL GET 模式

```
GET https://api.day.app/{device_key}/{title}?url=https://www.baidu.com&sound=birdsong
```

### 加密推送

加密后通过 `ciphertext` 参数发送：

```
POST https://api.day.app/{device_key}?ciphertext={base64_ciphertext}&iv={iv}
```

## 配置文件

配置保存在：

- Windows: `%APPDATA%/bark-push/config.json`
- macOS: `~/Library/Application Support/bark-push/config.json`
- Linux: `~/.config/bark-push/config.json`

## 许可证

MIT License

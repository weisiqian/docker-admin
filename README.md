# Docker Admin

一个基于 Vue 3 + TypeScript + Vite 开发的 Docker 管理平台。

## 功能特性

- 🐳 Docker 容器管理
- 📦 镜像管理
- 🔄 实时监控
- 🛠️ 系统配置
- 📊 资源统计

## 技术栈

- Vue 3 - 渐进式 JavaScript 框架
- TypeScript - JavaScript 的超集
- Vite - 下一代前端构建工具
- Element Plus - 基于 Vue 3 的组件库
- Pinia - Vue 的状态管理库
- Vue Router - Vue.js 的官方路由
- Axios - 基于 Promise 的 HTTP 客户端

## 开发环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

## 推荐开发工具

- [VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (并禁用 Vetur)
- [Vue DevTools](https://devtools.vuejs.org/)

## 项目设置

### 安装依赖

```sh
npm install
```

### 开发环境运行

```sh
npm run dev
```

### 类型检查

```sh
npm run type-check
```

### 代码格式化

```sh
npm run format
```

### 生产环境构建

```sh
npm run build
```

### 预览生产构建

```sh
npm run preview
```

## 项目结构

```
docker-admin/
├── src/                # 源代码目录
├── public/            # 静态资源
├── .vscode/          # VSCode 配置
├── vite.config.ts    # Vite 配置
├── tsconfig.json     # TypeScript 配置
└── package.json      # 项目依赖配置
```

## 贡献指南

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

## 许可证

[MIT](LICENSE)

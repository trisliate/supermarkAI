# SuperMarket 智慧运营系统

基于 React Router v7 + Prisma + MariaDB 的全栈超市管理系统，覆盖商品、库存、采购、销售、供应商、AI 助手等核心业务。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19, React Router v7 (SSR), Tailwind CSS v4, shadcn/ui, Recharts |
| 后端 | Node.js, React Router SSR, Prisma ORM |
| 数据库 | MariaDB |
| AI | 兼容 Anthropic / OpenAI 协议的多模型接入（13 个供应商） |

## 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 18 | 推荐 20 LTS |
| MariaDB | >= 10.x | 或 MySQL >= 8.x |
| npm | >= 9 | 随 Node.js 安装 |

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入数据库连接和密钥

# 3. 初始化数据库
npx prisma db push

# 4. 填充种子数据
npx prisma db seed

# 5. 启动开发服务器
npm run dev
# 访问 http://localhost:5173
```

## 环境变量

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `DATABASE_URL` | 是 | MariaDB 连接字符串 | `mysql://root:123456@localhost:3306/supermark` |
| `SESSION_SECRET` | 是 | Cookie Session 加密密钥，建议 32+ 字符 | `my-super-secret-session-key-2024` |
| `ENCRYPTION_KEY` | 是 | AES-256-GCM 加密密钥（64 位十六进制） | `a1b2c3d4e5f6...`（64 位 hex） |

### 生成加密密钥

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### .env.example

```env
DATABASE_URL=mysql://root:123456@localhost:3306/supermark
SESSION_SECRET=your-session-secret-change-this
ENCRYPTION_KEY=generate-with-crypto-randomBytes-32-hex
```

## 数据库初始化

```bash
# 创建数据库（如果不存在）
mysql -u root -p -e "CREATE DATABASE supermark CHARACTER SET utf8mb4;"

# 推送 Schema（开发环境）
npx prisma db push

# 或使用 Migrate（生产环境）
npx prisma migrate deploy

# 填充种子数据
npx prisma db seed

# 重置数据库（清空重建）
npx prisma db push --force-reset
npx prisma db seed
```

## 测试账号

种子数据提供 8 个测试账号：

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 店长 |
| admin2 | 123456 | 店长 |
| purchaser | 123456 | 采购员 |
| purchaser2 | 123456 | 采购员 |
| keeper | 123456 | 理货员 |
| keeper2 | 123456 | 理货员 |
| cashier | 123456 | 收银员 |
| cashier2 | 123456 | 收银员 |

## 构建与部署

```bash
# 类型检查
npx tsc --noEmit

# 生产构建
npm run build

# 启动生产服务
npm start
```

### Docker 部署

```bash
docker build -t supermark .
docker run -p 3000:3000 \
  -e DATABASE_URL="mysql://root:123456@host.docker.internal:3306/supermark" \
  -e SESSION_SECRET="your-session-secret" \
  -e ENCRYPTION_KEY="your-64-char-hex-key" \
  supermark
```

## 业务逻辑

### 核心实体关系

```
Category 1──N Product 1──1 Inventory
Product N──N Supplier (through SupplierProduct)
Supplier 1──N PurchaseOrder N──N Product (through PurchaseOrderItem)
User 1──N SaleOrder / PurchaseOrder
SaleOrder 1──N SaleOrderItem N──1 Product
```

### 角色权限

| 角色 | 权限范围 |
|------|----------|
| admin | 全部功能 |
| purchaser | 商品管理、供应商管理、采购管理 |
| inventory_keeper | 库存管理、出入库操作、采购到货确认 |
| cashier | 销售收银、订单查看 |

### 采购流程

```
采购员创建(pending) → 管理员审批(approved/rejected) → 到货入库(received)
                                                  → 取消(cancelled)
```

### 销售流程

```
选择商品 → 确认订单 → 收款支付(paid) → [退款(refunded)] / [取消(failed)]
```

## 项目结构

```
app/
├── components/
│   ├── ai-assistant/       # AI 聊天助手组件
│   ├── dashboard/          # 仪表盘组件（按角色拆分）
│   ├── layout/             # 布局组件（sidebar, header）
│   └── ui/                 # shadcn/ui 基础组件
├── lib/
│   ├── ai-assistant.server.ts  # AI 助手后端逻辑
│   ├── auth.server.ts          # 认证逻辑
│   ├── crypto.server.ts        # AES-256-GCM 加密
│   ├── db.server.ts            # Prisma 客户端
│   └── recommendation.server.ts # 智能补货算法
├── routes/                 # 37 个路由文件
│   └── ...
├── routes.ts               # 路由定义
├── app.css                 # 全局样式 + CSS 变量
└── root.tsx                # 根组件
prisma/
├── schema.prisma           # 数据库 Schema（18 个模型）
└── seed.ts                 # 种子数据
docs/
├── 设计文档.md              # 完整软件设计文档
└── 操作文档.md              # 操作手册与测试指南
```

## 文档

- [设计文档.md](docs/设计文档.md) — 需求分析、技术架构、数据库设计、模块设计、UI/UX、安全设计
- [操作文档.md](docs/操作文档.md) — 环境准备、业务流程测试、AI 助手测试提示词、常见问题

# SuperMarket 智慧运营系统

基于 React Router v7 + Prisma + MariaDB 的全栈超市管理系统，覆盖商品、库存、采购、销售、供应商、AI 助手等核心业务。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19, React Router v7, Tailwind CSS v4, shadcn/ui, Recharts |
| 后端 | Node.js, React Router SSR, Prisma ORM |
| 数据库 | MariaDB |
| AI | 兼容 Anthropic / OpenAI 协议的多模型接入 |

## 快速开始

```bash
npm install
npx prisma migrate dev   # 初始化数据库
npx prisma db seed       # 填充种子数据
npm run dev              # http://localhost:5173
```

## 业务逻辑

### 核心实体关系

```
Category 1──N Product N──N Supplier (through SupplierProduct)
Product 1──1 Inventory
Supplier 1──N PurchaseOrder N──N Product (through PurchaseOrderItem)
User 1──N Sale / PurchaseOrder
Sale 1──N SaleItem N──1 Product
```

### 采购流程

1. 采购员创建采购单 → 状态 `pending`（待审批）
2. 管理员审批 → `approved`（已审批）或 `rejected`（已驳回）
3. 采购员确认入库 → `received`（已入库），自动增加库存
4. 可取消 → `cancelled`（已取消）

### 供应商-商品绑定

`SupplierProduct` 关联表维护供应商与商品的多对多关系。采购单创建时，选择供应商后只显示该供应商绑定的商品。绑定管理在供应商页（"货物"按钮）和商品页（"供应商"按钮）均可操作。

### 销售流程

收银员选择商品和数量 → 系统自动计算金额 → 扣减库存 → 生成销售单。

### 角色权限

| 角色 | 权限 |
|------|------|
| admin | 全部功能，含用户管理、AI 配置、数据大屏 |
| manager | 商品/库存/采购/销售/供应商管理 |
| purchaser | 采购单创建与入库 |
| cashier | 销售收银 |

## AI 助手配置

### 支持的模型提供商

系统兼容 Anthropic 和 OpenAI 两种协议的模型 API。

### 协议说明

- **Anthropic 协议**：使用 `x-api-key` header + `anthropic-version` header，端点为 `/v1/messages`
- **OpenAI 协议**：使用 `Authorization: Bearer` header，端点为 `/v1/chat/completions`

### baseUrl 规则

**baseUrl 必须是完整的请求 URL**，系统直接使用该 URL 发送请求，不追加任何路径后缀。原因：不同厂商的端点路径不同，统一拼接会导致 404。

示例配置：

| 提供商 | baseUrl | 协议 |
|--------|---------|------|
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` | openai |
| Anthropic | `https://api.anthropic.com/v1/messages` | anthropic |
| MiMo | `https://token-plan-sgp.xiaomimimo.com/v1/messages` | anthropic |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | openai |

## 项目结构

```
app/
├── components/
│   ├── dashboard/          # 仪表盘组件（图表、角色视图）
│   ├── layout/             # 布局组件（sidebar, header）
│   └── ui/                 # shadcn/ui 基础组件
├── lib/
│   ├── ai-assistant.server.ts  # AI 助手后端逻辑（LLM 调用、工具执行）
│   ├── auth.ts             # 认证与会话管理
│   ├── db.server.ts        # Prisma 客户端
│   └── utils.ts            # 工具函数
├── routes/                 # 页面路由（loader/action 模式）
│   ├── settings.ai.tsx     # AI 模型配置页
│   ├── products.tsx        # 商品管理
│   ├── suppliers.tsx       # 供应商管理
│   ├── purchases*.tsx      # 采购单相关
│   ├── sales*.tsx          # 销售相关
│   └── dashboard.tsx       # 仪表盘
└── app.css                 # 全局样式
prisma/
├── schema.prisma           # 数据模型
└── seed.ts                 # 种子数据
```

## 构建与部署

```bash
npx tsc --noEmit    # 类型检查
npm run build       # 生产构建
npm start           # 启动服务
```

# SuperMark 超市管理系统 - 设计文档

## 一、系统概述

SuperMark 是一个基于 React Router v7 + Prisma ORM + MariaDB 的超市管理系统，支持商品管理、采购管理、销售收银、库存管理、AI 智能助手等功能。

## 二、技术架构

```
┌─────────────────────────────────────────────┐
│                   前端                       │
│  React Router v7 · Tailwind CSS · Recharts  │
│  shadcn/ui · Lucide Icons · Sonner Toast    │
├─────────────────────────────────────────────┤
│                服务端 (SSR)                  │
│  React Router Loaders/Actions               │
│  Prisma Client · bcryptjs · cookie-session  │
├─────────────────────────────────────────────┤
│                  数据层                      │
│  MariaDB · Prisma ORM · Raw SQL Aggregation │
└─────────────────────────────────────────────┘
```

### 核心依赖
- **框架**: React Router v7 (SSR, Loaders/Actions 模式)
- **数据库**: MariaDB + Prisma ORM (含 Raw SQL 聚合查询)
- **UI**: Tailwind CSS + shadcn/ui 组件库
- **图表**: Recharts (Area, Bar, Pie, RadialBar)
- **认证**: Cookie-based Session + bcryptjs 密码加密
- **AI**: Function Calling (MiMo / DeepSeek / OpenAI / Anthropic 协议)

## 三、模块设计

### 3.1 认证与权限
- **Session 管理**: Cookie 存储 userId + role, 服务端验证
- **角色体系**: admin(店长) / cashier(收银员) / purchaser(采购) / inventory_keeper(理货员)
- **路由守卫**: `requireRole(request, ["admin", "cashier"])` 逐页控制
- **动态权限**: `permissions.server.ts` 维护 ROUTE_CONFIGS, sidebar 根据权限动态过滤菜单

### 3.2 商品管理
- CRUD 商品信息 (名称、分类、价格、单位、描述、状态)
- 分类管理 (独立页面)
- 商品图片上传 (api/product-image)
- 状态控制 (active/inactive)

### 3.3 采购管理
- 采购单生命周期: 待审批 → 已审批 → 已入库
- 审批流程: admin 审批, inventory_keeper 入库
- 入库时自动增加库存 + 记录库存日志

### 3.4 销售收银
- **收银台**: 商品卡片网格, 点击直接加入购物车
- **服务端搜索**: 300ms 防抖调用 `/api/product-search`
- **分类筛选**: URL searchParams 驱动
- **结算**: 支持现金/微信/支付宝, 事务内原子扣减库存
- **订单详情**: 查看/退款/取消

### 3.5 库存管理
- 库存看板 (状态分布: 缺货/偏低/正常/充足)
- 库存流水日志 (分页)
- 库存调整 (入库/出库)

### 3.6 数据总览 (Dashboard)
- KPI 卡片: 今日营收、订单数、活跃商品、待审批采购
- 7 日销售/采购趋势图
- 分类分布环形图
- 营收达成仪表盘 (今日 vs 昨日 120%)
- 库存状态分布条
- 热销商品 TOP 10 柱状图
- 今日时段分布图

### 3.7 AI 智能助手
- **协议**: 支持 OpenAI 和 Anthropic 两种 API 协议
- **Function Calling**: 20+ 工具, 涵盖查询和写操作
- **确认机制**: 写操作 (创建/编辑/销售) 需要用户二次确认
- **会话管理**: ChatSession 持久化, 支持多轮对话
- **关键词回退**: LLM 不可用时自动切换关键词匹配

## 四、UI/UX 设计原则

### 4.1 清晰 (Clarity)
- 信息层级明确: 标题 > 副标题 > 正文 > 辅助文字
- 关键数据用加粗和颜色突出
- 状态标签统一使用圆角胶囊样式 + 语义色彩

### 4.2 一致 (Consistency)
- 按钮、卡片、表格等组件全站复用 shadcn/ui
- 色彩体系: emerald=成功, blue=信息, amber=警告, red=危险, slate=中性
- 间距遵循 4px 基准 (gap-1=4px, gap-2=8px, gap-3=12px, gap-4=16px)
- 动画统一使用 `animate-fade-in`

### 4.3 层次 (Hierarchy)
- 页面布局: 侧边栏导航 + 顶部标题区 + 内容区
- 卡片设计: 圆角 xl, 边框 slate-200/800, 悬停阴影
- 暗色模式: 全组件适配 dark: 变体

### 4.4 交互反馈
- 操作结果用 Sonner toast 通知
- 危险操作使用 ConfirmDialog 二次确认
- 加载状态用 skeleton / spinner 占位
- 表格行可点击进入详情

## 五、数据安全

### 5.1 库存并发控制
- 销售事务内使用 `UPDATE ... WHERE quantity >= X` 原子扣减
- 防止 TOCTOU 竞争条件导致负库存

### 5.2 价格验证
- 服务端从数据库读取真实价格, 忽略客户端提交的价格
- 防止前端篡改商品价格

### 5.3 支付回调幂等性
- `deductInventoryForOrder` 检查库存日志是否已存在
- 防止支付回调重复扣减库存

### 5.4 API Key 加密
- 使用 AES-256-GCM 加密存储 AI/支付 API 密钥
- ENCRYPTION_KEY 存储在环境变量中

## 六、目录结构

```
app/
├── components/
│   ├── dashboard/          # Dashboard 图表组件
│   ├── layout/             # AppLayout, Sidebar
│   └── ui/                 # shadcn/ui 基础组件
├── lib/
│   ├── ai-assistant.server.ts   # AI 助手 (LLM + Function Calling)
│   ├── auth.server.ts           # 认证 (Session, requireRole)
│   ├── crypto.server.ts         # AES-256-GCM 加解密
│   ├── db.server.ts             # Prisma Client 初始化
│   ├── payment.server.ts        # 微信/支付宝支付
│   ├── permissions.server.ts    # 路由权限配置
│   └── utils.ts                 # 工具函数 (cn, formatPrice)
├── routes/
│   ├── dashboard.tsx            # 数据总览
│   ├── products.tsx             # 商品列表
│   ├── products.new.tsx         # 新建商品
│   ├── products.$id.edit.tsx    # 编辑商品
│   ├── categories.tsx           # 分类管理
│   ├── suppliers.tsx            # 供应商管理
│   ├── purchases.tsx            # 采购列表
│   ├── purchases.new.tsx        # 新建采购单
│   ├── purchases.$id.tsx        # 采购单详情
│   ├── inventory.tsx            # 库存看板
│   ├── inventory.log.tsx        # 库存日志
│   ├── inventory.$id.tsx        # 商品库存详情
│   ├── sales.tsx                # 销售列表
│   ├── sales.new.tsx            # 收银台
│   ├── sales.$id.tsx            # 订单详情
│   ├── users.tsx                # 用户列表
│   ├── settings.ai.tsx          # AI 配置
│   ├── settings.payment.tsx     # 支付配置
│   ├── settings.permissions.tsx # 权限管理
│   ├── api.assistant.ts         # AI 助手 API
│   ├── api.payment.tsx          # 支付回调 API
│   └── api.product-search.ts    # 商品搜索 API
└── routes.ts                    # 路由配置

prisma/
└── schema.prisma                # 数据库模型定义
```

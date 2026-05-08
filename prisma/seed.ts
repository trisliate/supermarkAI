import { PrismaClient, Role, PurchaseStatus } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

const adapter = new PrismaMariaDb({
  host: "localhost",
  user: "root",
  password: "123456",
  database: "supermark",
  port: 3306,
});

const prisma = new PrismaClient({ adapter });

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(Math.floor(Math.random() * 10) + 8, Math.floor(Math.random() * 60), 0, 0);
  return d;
}


async function main() {
  console.log("🌱 开始填充种子数据...");

  // ==================== 用户（8人）====================
  const adminPwd = await bcrypt.hash("admin123", 10);
  const userPwd = await bcrypt.hash("123456", 10);

  const users = await Promise.all([
    prisma.user.upsert({ where: { username: "admin" }, update: {}, create: { username: "admin", password: adminPwd, name: "系统管理员", role: Role.admin } }),
    prisma.user.upsert({ where: { username: "admin2" }, update: {}, create: { username: "admin2", password: userPwd, name: "陈经理", role: Role.admin } }),
    prisma.user.upsert({ where: { username: "purchaser1" }, update: {}, create: { username: "purchaser1", password: userPwd, name: "张采购", role: Role.purchaser } }),
    prisma.user.upsert({ where: { username: "purchaser2" }, update: {}, create: { username: "purchaser2", password: userPwd, name: "刘采购", role: Role.purchaser } }),
    prisma.user.upsert({ where: { username: "keeper1" }, update: {}, create: { username: "keeper1", password: userPwd, name: "李库管", role: Role.inventory_keeper } }),
    prisma.user.upsert({ where: { username: "keeper2" }, update: {}, create: { username: "keeper2", password: userPwd, name: "赵库管", role: Role.inventory_keeper } }),
    prisma.user.upsert({ where: { username: "cashier1" }, update: {}, create: { username: "cashier1", password: userPwd, name: "王收银", role: Role.cashier } }),
    prisma.user.upsert({ where: { username: "cashier2" }, update: {}, create: { username: "cashier2", password: userPwd, name: "孙收银", role: Role.cashier } }),
  ]);

  const admin = users[0];
  const purchaser1 = users[2];
  const purchaser2 = users[3];
  const keeper1 = users[4];
  const cashier1 = users[6];
  const cashier2 = users[7];

  console.log(`  ✅ 用户: ${users.length} 人`);

  // ==================== 分类（8个）====================
  const catData = [
    { name: "食品", description: "方便面、面包、主食等" },
    { name: "饮料", description: "碳酸饮料、矿泉水、茶饮等" },
    { name: "日用品", description: "纸巾、清洁用品等" },
    { name: "零食", description: "薯片、巧克力、坚果等" },
    { name: "生鲜果蔬", description: "新鲜水果、蔬菜" },
    { name: "调味品", description: "酱油、醋、辣椒酱等" },
    { name: "个人护理", description: "洗发水、牙膏、香皂等" },
    { name: "家居清洁", description: "清洁剂、消毒液等" },
  ];

  const categories: Record<string, any> = {};
  for (const c of catData) {
    categories[c.name] = await prisma.category.upsert({ where: { name: c.name }, update: {}, create: c });
  }

  console.log(`  ✅ 分类: ${Object.keys(categories).length} 个`);

  // ==================== 商品（28个）====================
  const prodData = [
    { name: "康师傅红烧牛肉面", cat: "食品", price: 4.50, unit: "袋", desc: "经典口味方便面" },
    { name: "统一老坛酸菜面", cat: "食品", price: 4.50, unit: "袋", desc: "酸爽可口" },
    { name: "旺仔小馒头", cat: "食品", price: 8.90, unit: "袋", desc: "210g装" },
    { name: "达利园面包", cat: "食品", price: 6.50, unit: "袋", desc: "早餐面包" },
    { name: "可口可乐500ml", cat: "饮料", price: 3.00, unit: "瓶", desc: "经典碳酸饮料" },
    { name: "农夫山泉550ml", cat: "饮料", price: 2.00, unit: "瓶", desc: "天然矿泉水" },
    { name: "元气森林气泡水", cat: "饮料", price: 5.50, unit: "瓶", desc: "白桃味0糖" },
    { name: "王老吉凉茶", cat: "饮料", price: 3.50, unit: "罐", desc: "310ml" },
    { name: "蓝月亮洗衣液2kg", cat: "日用品", price: 25.00, unit: "瓶", desc: "薰衣草香" },
    { name: "维达抽纸", cat: "日用品", price: 12.90, unit: "包", desc: "3层120抽" },
    { name: "垃圾袋", cat: "日用品", price: 8.50, unit: "卷", desc: "加厚款50只" },
    { name: "乐事薯片", cat: "零食", price: 9.90, unit: "袋", desc: "原味145g" },
    { name: "好丽友派", cat: "零食", price: 13.50, unit: "盒", desc: "6枚装" },
    { name: "德芙巧克力", cat: "零食", price: 15.90, unit: "盒", desc: "丝滑牛奶43g" },
    { name: "三只松鼠坚果", cat: "零食", price: 29.90, unit: "袋", desc: "混合坚果500g" },
    { name: "红富士苹果", cat: "生鲜果蔬", price: 6.80, unit: "斤", desc: "新鲜脆甜" },
    { name: "精品香蕉", cat: "生鲜果蔬", price: 3.98, unit: "斤", desc: "进口香蕉" },
    { name: "大白菜", cat: "生鲜果蔬", price: 2.50, unit: "棵", desc: "新鲜时蔬" },
    { name: "西红柿", cat: "生鲜果蔬", price: 4.50, unit: "斤", desc: "自然熟" },
    { name: "海天酱油500ml", cat: "调味品", price: 9.90, unit: "瓶", desc: "生抽" },
    { name: "老干妈辣椒酱", cat: "调味品", price: 9.50, unit: "瓶", desc: "风味豆豉280g" },
    { name: "恒顺香醋", cat: "调味品", price: 7.80, unit: "瓶", desc: "500ml" },
    { name: "舒肤佳香皂", cat: "个人护理", price: 6.50, unit: "块", desc: "纯白清香" },
    { name: "海飞丝洗发水", cat: "个人护理", price: 35.90, unit: "瓶", desc: "去屑400ml" },
    { name: "高露洁牙膏", cat: "个人护理", price: 12.90, unit: "支", desc: "全效120g" },
    { name: "威猛先生清洁剂", cat: "家居清洁", price: 15.90, unit: "瓶", desc: "厨房重油污" },
    { name: "心相印湿巾", cat: "家居清洁", price: 9.90, unit: "包", desc: "80片装" },
    { name: "舒洁湿厕纸", cat: "家居清洁", price: 11.90, unit: "包", desc: "40片装" },
  ];

  const products: any[] = [];
  for (const p of prodData) {
    const product = await prisma.product.upsert({
      where: { id: products.length + 1 },
      update: {},
      create: {
        name: p.name,
        categoryId: categories[p.cat].id,
        price: p.price,
        unit: p.unit,
        description: p.desc,
      },
    });
    products.push(product);
  }

  console.log(`  ✅ 商品: ${products.length} 个`);

  // ==================== 供应商（6个）====================
  const supData = [
    { name: "统一食品供应商", contact: "赵经理", phone: "13800138001", address: "上海市浦东新区张江路100号" },
    { name: "可口可乐经销商", contact: "钱经理", phone: "13800138002", address: "北京市朝阳区建国路88号" },
    { name: "日用品批发中心", contact: "孙经理", phone: "13800138003", address: "广州市白云区增槎路55号" },
    { name: "零食天地商贸", contact: "李经理", phone: "13800138004", address: "杭州市余杭区良渚路200号" },
    { name: "新鲜果蔬基地", contact: "周经理", phone: "13800138005", address: "成都市龙泉驿区果园路18号" },
    { name: "调味品总经销", contact: "吴经理", phone: "13800138006", address: "佛山市禅城区岭南大道66号" },
  ];

  const suppliers: any[] = [];
  for (let i = 0; i < supData.length; i++) {
    const s = await prisma.supplier.upsert({
      where: { id: i + 1 },
      update: {},
      create: supData[i],
    });
    suppliers.push(s);
  }

  console.log(`  ✅ 供应商: ${suppliers.length} 个`);

  // ==================== 库存 ====================
  // 设置不同库存状态：正常、偏低、缺货、充足
  const inventoryMap: Record<number, number> = {};
  products.forEach((p, i) => {
    if (i === 5) inventoryMap[p.id] = 0;   // 农夫山泉 → 缺货
    if (i === 17) inventoryMap[p.id] = 0;  // 大白菜 → 缺货
    if (i === 2) inventoryMap[p.id] = 3;   // 旺仔小馒头 → 极低
    if (i === 7) inventoryMap[p.id] = 5;   // 王老吉 → 偏低
    if (i === 12) inventoryMap[p.id] = 6;  // 好丽友 → 偏低
    if (i === 20) inventoryMap[p.id] = 8;  // 老干妈 → 偏低
    if (i === 23) inventoryMap[p.id] = 4;  // 海飞丝 → 偏低
    if (i === 14) inventoryMap[p.id] = 250; // 三只松鼠 → 充足(滞销候选)
    if (i === 25) inventoryMap[p.id] = 200; // 威猛先生 → 充足(滞销候选)
    if (i === 27) inventoryMap[p.id] = 180; // 舒洁湿厕纸 → 充足
    // 其余正常范围
    if (!(p.id in inventoryMap)) {
      inventoryMap[p.id] = 40 + Math.floor(Math.random() * 80); // 40-120
    }
  });

  for (const product of products) {
    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: { quantity: inventoryMap[product.id] },
      create: { productId: product.id, quantity: inventoryMap[product.id] },
    });
  }

  console.log(`  ✅ 库存: ${products.length} 条`);

  // ==================== 采购单（12笔）====================
  const purchaseOrders = [
    // pending（待审批）- 3笔
    { supplier: 0, user: purchaser1, status: PurchaseStatus.pending, daysAgo: 0, items: [
      { prodIdx: 5, qty: 100, price: 1.60 },  // 农夫山泉
      { prodIdx: 17, qty: 80, price: 1.80 },  // 大白菜
    ]},
    { supplier: 3, user: purchaser2, status: PurchaseStatus.pending, daysAgo: 0, items: [
      { prodIdx: 11, qty: 50, price: 7.50 },  // 乐事薯片
      { prodIdx: 12, qty: 30, price: 10.00 }, // 好丽友
      { prodIdx: 13, qty: 40, price: 12.00 }, // 德芙
    ]},
    { supplier: 5, user: purchaser1, status: PurchaseStatus.pending, daysAgo: 1, items: [
      { prodIdx: 20, qty: 60, price: 7.00 },  // 老干妈
      { prodIdx: 19, qty: 40, price: 7.50 },  // 海天酱油
    ]},
    // approved（已审批）- 2笔
    { supplier: 0, user: purchaser1, status: PurchaseStatus.approved, daysAgo: 1, items: [
      { prodIdx: 0, qty: 200, price: 3.20 },  // 康师傅
      { prodIdx: 1, qty: 150, price: 3.20 },  // 统一
      { prodIdx: 3, qty: 100, price: 4.50 },  // 达利园
    ]},
    { supplier: 4, user: purchaser2, status: PurchaseStatus.approved, daysAgo: 2, items: [
      { prodIdx: 15, qty: 100, price: 4.50 }, // 苹果
      { prodIdx: 16, qty: 80, price: 2.80 },  // 香蕉
      { prodIdx: 18, qty: 60, price: 3.00 },  // 西红柿
    ]},
    // received（已入库）- 5笔
    { supplier: 1, user: purchaser1, status: PurchaseStatus.received, daysAgo: 3, items: [
      { prodIdx: 4, qty: 200, price: 2.00 },  // 可口可乐
      { prodIdx: 6, qty: 100, price: 3.80 },  // 元气森林
    ]},
    { supplier: 2, user: purchaser2, status: PurchaseStatus.received, daysAgo: 4, items: [
      { prodIdx: 8, qty: 50, price: 18.00 },  // 蓝月亮
      { prodIdx: 9, qty: 100, price: 9.00 },  // 维达
      { prodIdx: 10, qty: 80, price: 5.50 },  // 垃圾袋
    ]},
    { supplier: 0, user: purchaser1, status: PurchaseStatus.received, daysAgo: 5, items: [
      { prodIdx: 2, qty: 80, price: 6.00 },   // 旺仔小馒头
      { prodIdx: 3, qty: 60, price: 4.50 },   // 达利园
    ]},
    { supplier: 3, user: purchaser2, status: PurchaseStatus.received, daysAgo: 5, items: [
      { prodIdx: 14, qty: 50, price: 22.00 }, // 三只松鼠
      { prodIdx: 11, qty: 80, price: 7.50 },  // 乐事
    ]},
    { supplier: 5, user: purchaser1, status: PurchaseStatus.received, daysAgo: 6, items: [
      { prodIdx: 21, qty: 40, price: 5.50 },  // 恒顺香醋
      { prodIdx: 22, qty: 60, price: 4.00 },  // 舒肤佳
      { prodIdx: 24, qty: 30, price: 9.00 },  // 高露洁
    ]},
    // cancelled（已取消）- 2笔
    { supplier: 4, user: purchaser2, status: PurchaseStatus.cancelled, daysAgo: 3, items: [
      { prodIdx: 15, qty: 200, price: 5.00 }, // 苹果(取消)
    ]},
    { supplier: 1, user: purchaser1, status: PurchaseStatus.cancelled, daysAgo: 4, items: [
      { prodIdx: 7, qty: 100, price: 2.50 },  // 王老吉(取消)
    ]},
  ];

  for (const po of purchaseOrders) {
    const totalAmount = po.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    const createdAt = daysAgo(po.daysAgo);

    await prisma.purchaseOrder.create({
      data: {
        supplierId: suppliers[po.supplier].id,
        userId: po.user.id,
        status: po.status,
        totalAmount,
        createdAt,
        items: {
          create: po.items.map((item) => ({
            productId: products[item.prodIdx].id,
            quantity: item.qty,
            unitPrice: item.price,
          })),
        },
      },
    });
  }

  console.log(`  ✅ 采购单: ${purchaseOrders.length} 笔`);

  // ==================== 销售单（25笔，近7天）====================
  const saleTemplates = [
    // 每个数组是一笔订单的 [商品索引, 数量] 组合
    [[0, 2], [4, 3], [9, 1]],                         // 方便面+可乐+抽纸
    [[11, 1], [12, 1], [6, 2]],                        // 薯片+好丽友+元气森林
    [[15, 3], [16, 2], [18, 2]],                       // 苹果+香蕉+西红柿
    [[0, 1], [1, 1], [7, 2]],                          // 方便面+酸菜面+王老吉
    [[8, 1], [10, 2], [26, 1]],                        // 洗衣液+垃圾袋+湿巾
    [[13, 1], [14, 1]],                                 // 德芙+坚果
    [[4, 6], [5, 4]],                                   // 可乐+农夫山泉
    [[2, 1], [3, 2], [12, 1]],                         // 旺仔+面包+好丽友
    [[19, 1], [20, 1], [21, 1]],                       // 酱油+老干妈+香醋
    [[22, 2], [23, 1], [24, 1]],                       // 香皂+洗发水+牙膏
    [[11, 2], [6, 3], [0, 1]],                         // 薯片+元气+方便面
    [[15, 5], [18, 3]],                                 // 苹果+西红柿(大量)
    [[4, 2], [9, 1], [26, 2]],                         // 可乐+抽纸+湿巾
    [[1, 2], [7, 2], [3, 1]],                          // 酸菜面+王老吉+面包
    [[8, 1], [25, 1], [10, 1]],                        // 洗衣液+清洁剂+垃圾袋
    [[13, 2], [11, 1], [4, 2]],                        // 德芙+薯片+可乐
    [[16, 4], [17, 3], [18, 2]],                       // 香蕉+白菜+西红柿
    [[0, 3], [1, 2], [2, 1], [3, 1]],                 // 多种食品
    [[22, 1], [24, 1], [26, 1], [10, 1]],             // 个护+清洁组合
    [[6, 2], [12, 1], [14, 1]],                        // 元气+好丽友+坚果
    [[4, 4], [5, 3]],                                   // 可乐+矿泉水(多)
    [[19, 1], [21, 1], [20, 1]],                       // 调味品组合
    [[15, 2], [16, 2]],                                 // 水果组合
    [[0, 1], [11, 1], [13, 1], [6, 1]],               // 混合零食
    [[8, 1], [9, 2], [22, 1], [24, 1]],               // 日用品大采购
  ];

  const cashiers = [cashier1, cashier2];

  for (let i = 0; i < saleTemplates.length; i++) {
    const template = saleTemplates[i];
    const dayOffset = Math.floor(i / 4); // 每天约4笔
    const createdAt = daysAgo(6 - dayOffset);
    const cashier = cashiers[i % 2];

    const items = template.map(([prodIdx, qty]) => ({
      productId: products[prodIdx].id,
      quantity: qty,
      unitPrice: Number(products[prodIdx].price),
    }));

    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    await prisma.saleOrder.create({
      data: {
        userId: cashier.id,
        totalAmount,
        createdAt,
        items: {
          create: items,
        },
      },
    });
  }

  console.log(`  ✅ 销售单: ${saleTemplates.length} 笔`);

  // ==================== 库存日志（部分记录）====================
  // 为一些库存变动创建日志记录
  const logEntries = [
    { prodIdx: 0, type: "IN" as const, qty: 200, reason: "采购入库 PO-0004", userId: keeper1.id, daysAgo: 5 },
    { prodIdx: 4, type: "IN" as const, qty: 200, reason: "采购入库 PO-0006", userId: keeper1.id, daysAgo: 3 },
    { prodIdx: 8, type: "IN" as const, qty: 50, reason: "采购入库 PO-0007", userId: keeper1.id, daysAgo: 4 },
    { prodIdx: 14, type: "IN" as const, qty: 50, reason: "采购入库 PO-0009", userId: keeper1.id, daysAgo: 5 },
    { prodIdx: 11, type: "OUT" as const, qty: 15, reason: "销售出库 SO-0001", userId: cashier1.id, daysAgo: 6 },
    { prodIdx: 4, type: "OUT" as const, qty: 10, reason: "销售出库 SO-0002", userId: cashier2.id, daysAgo: 5 },
    { prodIdx: 15, type: "OUT" as const, qty: 8, reason: "销售出库 SO-0003", userId: cashier1.id, daysAgo: 4 },
    { prodIdx: 0, type: "OUT" as const, qty: 5, reason: "销售出库 SO-0004", userId: cashier2.id, daysAgo: 3 },
    { prodIdx: 2, type: "OUT" as const, qty: 20, reason: "盘点损耗", userId: keeper1.id, daysAgo: 2 },
    { prodIdx: 5, type: "OUT" as const, qty: 50, reason: "销售出库(近期)", userId: cashier1.id, daysAgo: 1 },
  ];

  for (const log of logEntries) {
    await prisma.inventoryLog.create({
      data: {
        productId: products[log.prodIdx].id,
        type: log.type,
        quantity: log.qty,
        reason: log.reason,
        userId: log.userId,
        createdAt: daysAgo(log.daysAgo),
      },
    });
  }

  console.log(`  ✅ 库存日志: ${logEntries.length} 条`);
  console.log("\n🎉 种子数据填充完成！");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  管理员: admin / admin123");
  console.log("  其他用户: xxx / 123456");
  console.log("  用户列表: admin2, purchaser1, purchaser2, keeper1, keeper2, cashier1, cashier2");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

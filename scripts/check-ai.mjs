import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const configs = await db.aIConfig.findMany({
  select: { id: true, provider: true, model: true, isActive: true, enableTools: true, lastTestOk: true },
});
console.log(JSON.stringify(configs, null, 2));
await db.$disconnect();

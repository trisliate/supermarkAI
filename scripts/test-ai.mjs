import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const adapter = new PrismaMariaDb({
  host: "localhost",
  user: "root",
  password: "123456",
  database: "supermark",
  port: 3306,
  connectionLimit: 10,
  allowPublicKeyRetrieval: true,
});

const db = new PrismaClient({ adapter });

async function test() {
  // 1. Check AI configs
  const configs = await db.aIConfig.findMany({
    select: { id: true, provider: true, model: true, isActive: true, lastTestOk: true, protocol: true, enableTools: true },
  });
  console.log("=== AI Configs ===");
  console.log(JSON.stringify(configs, null, 2));

  const active = configs.find((c) => c.isActive);
  if (!active) {
    console.log("\n⚠️  No active AI config found!");
    await db.$disconnect();
    return;
  }
  console.log(`\n✅ Active config: ${active.provider}/${active.model}, enableTools=${active.enableTools}`);

  // 2. Test processQuery with sell request
  console.log("\n=== Testing processQuery: '帮我卖10袋康师傅红烧牛肉面' ===");
  const { processQuery } = await import("../app/lib/ai-assistant.server.ts");
  try {
    const result = await processQuery("帮我卖10袋康师傅红烧牛肉面");
    console.log("Result type:", result.type);
    console.log("Result title:", result.title);
    console.log("Result content:", result.content);
    if (result.toolName) console.log("Tool name:", result.toolName);
    if (result.toolArgs) console.log("Tool args:", JSON.stringify(result.toolArgs));
    if (result.needsConfirmation) console.log("Needs confirmation: YES");
  } catch (e) {
    console.error("processQuery error:", e.message);
  }

  await db.$disconnect();
}

test().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});

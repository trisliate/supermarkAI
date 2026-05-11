import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const adapter = new PrismaMariaDb({
  host: "localhost",
  user: "root",
  password: "123456",
  database: "supermark",
  port: 3306,
  connectionLimit: 10,
  acquireTimeout: 5000,
  idleTimeout: 30000,
  minimumIdle: 1,
});

let db: PrismaClient;

declare global {
  var __db__: PrismaClient | undefined;
}

if (process.env.NODE_ENV === "production") {
  db = new PrismaClient({ adapter });
} else {
  if (!global.__db__) {
    global.__db__ = new PrismaClient({ adapter });
  }
  db = global.__db__;
}

export { db };

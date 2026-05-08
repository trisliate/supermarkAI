import type { User, Role } from "@prisma/client";

export type AuthUser = Pick<User, "id" | "username" | "name" | "role">;

export const roleLabels: Record<Role, string> = {
  admin: "管理员",
  purchaser: "采购员",
  inventory_keeper: "库存管理员",
  cashier: "营业员",
};

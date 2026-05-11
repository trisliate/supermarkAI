import type { User, Role } from "@prisma/client";

export type AuthUser = Pick<User, "id" | "username" | "name" | "role">;

export const roleLabels: Record<Role, string> = {
  admin: "店长",
  purchaser: "采购",
  inventory_keeper: "理货员",
  cashier: "收银员",
};

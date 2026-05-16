import { redirect } from "react-router";
import bcrypt from "bcryptjs";
import { db } from "./db.server";
import { getSession, commitSession, destroySession } from "./session.server";
import type { Role } from "@prisma/client";
import type { AuthUser } from "./auth";

export type { AuthUser };

export async function login(username: string, password: string): Promise<AuthUser | null> {
  const user = await db.user.findUnique({ where: { username } });
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;

  return { id: user.id, username: user.username, name: user.name, role: user.role, hasAvatar: user.avatar !== null };
}

export async function getUserSession(request: Request): Promise<AuthUser | null> {
  const session = await getSession(request);
  const userId = session.get("userId");
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, name: true, role: true, avatar: true },
  });
  if (!user) return null;
  return { id: user.id, username: user.username, name: user.name, role: user.role, hasAvatar: user.avatar !== null };
}

export async function requireUser(request: Request): Promise<AuthUser> {
  const user = await getUserSession(request);
  if (!user) throw redirect("/login");
  return user;
}

export async function requireRole(request: Request, roles: Role[]): Promise<AuthUser> {
  const user = await requireUser(request);
  if (!roles.includes(user.role)) {
    throw new Response("权限不足", { status: 403 });
  }
  return user;
}

/** Check access based on dynamic RoutePermission in DB. Falls back to default config if not in DB. */
export async function requireRouteAccess(request: Request, route: string): Promise<AuthUser> {
  const { canAccessRoute } = await import("~/lib/permissions.server");
  const user = await requireUser(request);
  const allowed = await canAccessRoute(route, user.role);
  if (!allowed) {
    throw new Response("权限不足", { status: 403 });
  }
  return user;
}

export async function createUserSession(userId: number, redirectTo: string) {
  const session = await getSession(new Request("http://localhost"));
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return redirect("/login", {
    headers: { "Set-Cookie": await destroySession(session) },
  });
}

export { roleLabels } from "./auth";

import type { Route } from "./+types/api.assistant";
import { processQuery, executeConfirmedTool } from "~/lib/ai-assistant.server";
import { getUserSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { action, query, messages, confirmedTool, confirmedArgs, sessionId, title } = body;
    const user = await getUserSession(request);

    // Switch active model
    if (action === "switch_model") {
      if (!user || user.role !== "admin") {
        return Response.json({ error: "权限不足" }, { status: 403 });
      }
      const { configId } = body;
      await db.aIConfig.updateMany({ where: { isActive: true }, data: { isActive: false } });
      await db.aIConfig.update({ where: { id: configId }, data: { isActive: true } });
      const config = await db.aIConfig.findUnique({ where: { id: configId }, select: { model: true, provider: true } });
      return Response.json({ success: true, model: config?.model, provider: config?.provider });
    }

    // List chat sessions
    if (action === "list_sessions") {
      if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
      const sessions = await db.chatSession.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, title: true, createdAt: true, updatedAt: true },
      });
      return Response.json({ sessions });
    }

    // Load a chat session
    if (action === "load_session") {
      if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
      const { sessionId: sid } = body;
      const session = await db.chatSession.findFirst({
        where: { id: sid, userId: user.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      if (!session) return Response.json({ error: "会话不存在" }, { status: 404 });
      return Response.json({
        session: {
          id: session.id,
          title: session.title,
          messages: session.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            type: m.messageType,
            data: m.data ? JSON.parse(m.data) : undefined,
            navigateTo: m.navigateTo || undefined,
            createdAt: m.createdAt.toISOString(),
          })),
        },
      });
    }

    // Delete a chat session
    if (action === "delete_session") {
      if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
      const { sessionId: sid } = body;
      await db.chatSession.deleteMany({ where: { id: sid, userId: user.id } });
      return Response.json({ success: true });
    }

    // Handle confirmed write operations
    if (confirmedTool && confirmedArgs) {
      if (!user) {
        return Response.json({ error: "请先登录" }, { status: 401 });
      }
      const result = await executeConfirmedTool(confirmedTool, confirmedArgs, user);
      // Save assistant message to session
      if (sessionId) {
        await saveMessage(sessionId, "assistant", result.content, result.type, result.data, result.navigateTo);
      }
      return Response.json(result);
    }

    if (!query || typeof query !== "string") {
      return Response.json({ error: "请输入问题" }, { status: 400 });
    }

    // Create or reuse chat session
    let currentSessionId = sessionId as number | undefined;
    if (!currentSessionId && user) {
      const session = await db.chatSession.create({
        data: { userId: user.id, title: query.slice(0, 30) + (query.length > 30 ? "..." : "") },
      });
      currentSessionId = session.id;
    }

    // Save user message
    if (currentSessionId) {
      await saveMessage(currentSessionId, "user", query);
    }

    // Pass conversation history if provided (for LLM context)
    const history = Array.isArray(messages) ? messages.slice(-10) : undefined;
    const result = await processQuery(query, user || undefined, history);

    // Save assistant message
    if (currentSessionId) {
      await saveMessage(currentSessionId, "assistant", result.content, result.type, result.data, result.navigateTo);
    }

    return Response.json({ ...result, sessionId: currentSessionId });
  } catch (e) {
    console.error("Assistant API error:", e);
    return Response.json({ error: "处理请求时出错" }, { status: 500 });
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const user = await getUserSession(request);

  // Get available models and current active model
  if (url.searchParams.get("action") === "models") {
    const configs = await db.aIConfig.findMany({
      select: { id: true, provider: true, model: true, isActive: true, lastTestOk: true },
      orderBy: { createdAt: "desc" },
    });
    const active = configs.find((c) => c.isActive);
    return Response.json({ configs, active });
  }

  // Get current user info
  if (url.searchParams.get("action") === "me") {
    if (!user) return Response.json({ user: null });
    return Response.json({ user: { id: user.id, name: user.name, role: user.role } });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

async function saveMessage(
  sessionId: number,
  role: string,
  content: string,
  messageType?: string,
  data?: Record<string, unknown>[],
  navigateTo?: string
) {
  try {
    await db.chatMessage.create({
      data: {
        sessionId,
        role,
        content,
        messageType: messageType || "text",
        data: data ? JSON.stringify(data) : null,
        navigateTo: navigateTo || null,
      },
    });
    // Update session timestamp
    await db.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });
  } catch (e) {
    console.error("Failed to save chat message:", e);
  }
}

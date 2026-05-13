import type { Route } from "./+types/api.assistant";
import { processQuery, executeConfirmedTool } from "~/lib/ai-assistant.server";
import { getUserSession } from "~/lib/auth.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { query, messages, confirmedTool, confirmedArgs } = body;
    const user = await getUserSession(request);

    // Handle confirmed write operations
    if (confirmedTool && confirmedArgs) {
      if (!user) {
        return Response.json({ error: "请先登录" }, { status: 401 });
      }
      const result = await executeConfirmedTool(confirmedTool, confirmedArgs, user);
      return Response.json(result);
    }

    if (!query || typeof query !== "string") {
      return Response.json({ error: "请输入问题" }, { status: 400 });
    }

    // Pass conversation history if provided (for LLM context)
    const history = Array.isArray(messages) ? messages.slice(-10) : undefined;
    const result = await processQuery(query, user || undefined, history);
    return Response.json(result);
  } catch {
    return Response.json({ error: "处理请求时出错" }, { status: 500 });
  }
}

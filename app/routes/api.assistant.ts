import type { Route } from "./+types/api.assistant";
import { processQuery } from "~/lib/ai-assistant.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { query, messages } = body;

    if (!query || typeof query !== "string") {
      return Response.json({ error: "请输入问题" }, { status: 400 });
    }

    // Pass conversation history if provided (for LLM context)
    const history = Array.isArray(messages) ? messages.slice(-10) : undefined;
    const result = await processQuery(query, history);
    return Response.json(result);
  } catch {
    return Response.json({ error: "处理请求时出错" }, { status: 500 });
  }
}

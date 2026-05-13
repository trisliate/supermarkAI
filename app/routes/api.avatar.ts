import { db } from "~/lib/db.server";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const userId = Number(url.searchParams.get("userId"));
  if (!userId) return new Response("Missing userId", { status: 400 });

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { avatar: true },
  });

  if (!user?.avatar) return new Response("Not found", { status: 404 });

  return new Response(user.avatar, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

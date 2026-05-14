import type { Route } from "./+types/api.product-image";
import { db } from "~/lib/db.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const productId = Number(url.searchParams.get("productId"));
  if (!productId) return new Response("Missing productId", { status: 400 });

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { image: true },
  });

  if (!product?.image) return new Response("No image", { status: 404 });

  return new Response(product.image, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

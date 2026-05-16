import { db } from "~/lib/db.server";

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const categoryId = url.searchParams.get("category");
  const take = Math.min(Number(url.searchParams.get("take")) || 30, 100);

  if (!q && !categoryId) {
    // No search query, return top selling products
    const topSelling = await db.saleOrderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take,
    });
    const ids = topSelling.map((s) => s.productId);
    if (ids.length === 0) return Response.json({ products: [] });

    const products = await db.product.findMany({
      where: { id: { in: ids }, status: "active" },
      include: { inventory: true, category: { select: { name: true } } },
    });
    const sorted = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean);
    return Response.json({
      products: sorted.map((p) => ({
        id: p!.id,
        name: p!.name,
        price: Number(p!.price),
        unit: p!.unit,
        categoryId: p!.categoryId,
        categoryName: p!.category.name,
        quantity: p!.inventory?.quantity ?? 0,
      })),
    });
  }

  const where: Record<string, unknown> = { status: "active" };
  if (q) {
    // Search by name or ID
    const idNum = Number(q);
    where.OR = [
      { name: { contains: q } },
      ...(Number.isFinite(idNum) ? [{ id: idNum }] : []),
    ];
  }
  if (categoryId) {
    where.categoryId = Number(categoryId);
  }

  const products = await db.product.findMany({
    where,
    include: { inventory: true, category: { select: { name: true } } },
    orderBy: { name: "asc" },
    take,
  });

  return Response.json({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      unit: p.unit,
      categoryId: p.categoryId,
      categoryName: p.category.name,
      quantity: p.inventory?.quantity ?? 0,
    })),
  });
}

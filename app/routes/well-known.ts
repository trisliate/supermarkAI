import type { Route } from "./+types/well-known";

export function loader({ params }: Route.LoaderArgs) {
  return new Response(null, { status: 204 });
}

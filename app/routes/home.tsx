import { redirect } from "react-router";
import type { Route } from "./+types/home";
import { getUserSession } from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUserSession(request);
  if (user) throw redirect("/dashboard");
  throw redirect("/login");
}

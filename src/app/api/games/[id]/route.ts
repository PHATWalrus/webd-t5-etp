import { getCloudflareContext } from "@opennextjs/cloudflare";

import { handleGetGame } from "@/lib/server/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const { id } = await context.params;
  return handleGetGame(request, id, env);
}

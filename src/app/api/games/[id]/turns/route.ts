import { getCloudflareContext } from "@opennextjs/cloudflare";

import { handleCreateTurn } from "@/lib/server/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  const { id } = await context.params;
  return handleCreateTurn(request, id, env);
}

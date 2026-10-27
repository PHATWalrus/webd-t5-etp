import { getCloudflareContext } from "@opennextjs/cloudflare";

import { handleCreateGame } from "@/lib/server/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true });
  return handleCreateGame(request, env);
}

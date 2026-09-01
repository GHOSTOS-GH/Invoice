// GET /api/settings/maintenance — public status (no auth) so the login page
// can show the "Site fermé" screen to non-admin visitors.
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let settings = await db.settings.findUnique({ where: { id: "singleton" } });
  return Response.json({ maintenanceMode: settings?.maintenanceMode ?? false });
}

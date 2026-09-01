// GET /api/users — admin only: list all users
import { db } from "@/lib/db";
import { requireRole, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireRole("admin");
    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        phone: true,
        role: true,
        name: true,
        disabled: true,
        createdAt: true,
      },
    });
    return Response.json(users);
  } catch (err) {
    return authErrorResponse(err);
  }
}

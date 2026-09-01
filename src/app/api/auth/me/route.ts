// GET /api/auth/me — current session user
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ user: null }, { status: 200 });
  return Response.json({
    user: {
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
      disabled: user.disabled,
    },
  });
}

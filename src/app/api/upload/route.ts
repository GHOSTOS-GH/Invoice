// POST /api/upload — image upload (base64 or multipart), saves to /public/uploads
import { NextRequest } from "next/server";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { requireAuth, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role === "client") {
      return Response.json({ error: "Accès refusé" }, { status: 403 });
    }
    const contentType = req.headers.get("content-type") || "";

    let buffer: Buffer;
    let ext = "png";

    if (contentType.startsWith("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) return Response.json({ error: "Aucun fichier" }, { status: 400 });
      buffer = Buffer.from(await file.arrayBuffer());
      const m = file.type.match(/image\/(\w+)/);
      if (m) ext = m[1] === "jpeg" ? "jpg" : m[1];
    } else {
      const { dataUrl } = await req.json();
      if (!dataUrl?.startsWith("data:image/")) {
        return Response.json({ error: "Format invalide" }, { status: 400 });
      }
      const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) return Response.json({ error: "Data URL invalide" }, { status: 400 });
      ext = match[1] === "jpeg" ? "jpg" : match[1];
      buffer = Buffer.from(match[2], "base64");
    }

    mkdirSync(UPLOAD_DIR, { recursive: true });
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    writeFileSync(join(UPLOAD_DIR, filename), buffer);
    return Response.json({ url: `/uploads/${filename}` });
  } catch (err) {
    return authErrorResponse(err);
  }
}

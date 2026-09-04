import { randomUUID } from "node:crypto";
import { requireAuth, authErrorResponse } from "@/lib/auth";

export const runtime = "nodejs";

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function storageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Configuration Supabase Storage manquante");
  }
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ""), serviceKey };
}

export async function POST(req: Request) {
  try {
    await requireAuth();
    const { supabaseUrl, serviceKey } = storageConfig();
    let bytes: ArrayBuffer;
    let contentType: string;

    if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return Response.json({ error: "Fichier manquant" }, { status: 400 });
      }
      bytes = await file.arrayBuffer();
      contentType = file.type;
    } else {
      const body = await req.json();
      const match = typeof body.dataUrl === "string"
        ? body.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
        : null;
      if (!match) {
        return Response.json({ error: "dataUrl image invalide" }, { status: 400 });
      }
      contentType = match[1];
      bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0)).buffer;
    }

    if (!ALLOWED_TYPES.has(contentType)) {
      return Response.json({ error: "Format accepté : JPEG, PNG ou WebP" }, { status: 400 });
    }
    if (bytes.byteLength > MAX_BYTES) {
      return Response.json({ error: "Image trop volumineuse (5 Mo maximum)" }, { status: 413 });
    }

    const extension = contentType.split("/")[1].replace("jpeg", "jpg");
    const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    const upload = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: bytes,
    });
    if (!upload.ok) throw new Error("Upload Supabase Storage échoué");

    return Response.json({ url: `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}` });
  } catch (err) {
    if (err instanceof Error && err.message === "Configuration Supabase Storage manquante") {
      return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY et SUPABASE_URL sont requis pour l'upload d'image" }, { status: 503 });
    }
    return authErrorResponse(err);
  }
}
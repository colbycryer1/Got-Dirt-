import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

const BUCKET = "driver-documents";

const schema = z.object({
  fileName:    z.string(),
  contentType: z.string(),
  docType:     z.enum(["gdot_license", "insurance", "additional"]),
});

// POST /api/driver/documents — returns a signed upload URL for Supabase Storage
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "DRIVER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { fileName, contentType, docType } = parsed.data;
  const ext  = fileName.split(".").pop();
  const path = `${session.user.id}/${docType}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path, publicUrl, contentType });
}

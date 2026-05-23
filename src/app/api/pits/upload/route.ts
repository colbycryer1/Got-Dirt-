import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseKmzBuffer } from "@/lib/kmz";
import { PitStatus, PitType, UserRole } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".kmz")) {
    return NextResponse.json({ error: "File must be a .kmz file" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsedPits;

  try {
    parsedPits = await parseKmzBuffer(buffer);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to parse KMZ: ${(err as Error).message}` },
      { status: 422 }
    );
  }

  if (parsedPits.length === 0) {
    return NextResponse.json({ error: "No Point features found in KMZ file" }, { status: 422 });
  }

  // Log the upload batch
  const upload = await prisma.kmzUpload.create({
    data: {
      filename: file.name,
      uploadedBy: session.user.id,
      pitsCreated: 0,
    },
  });

  // Bulk insert pits
  const result = await prisma.pit.createMany({
    data: parsedPits.map((p) => ({
      name: p.name,
      latitude: p.latitude,
      longitude: p.longitude,
      notes: p.description ?? null,
      pitType: PitType.WASTE_BORROW,
      status: PitStatus.ACTIVE,
      accepting: true,
      importedFromKmz: true,
      kmzUploadId: upload.id,
      state: "GA",
    })),
    skipDuplicates: false,
  });

  await prisma.kmzUpload.update({
    where: { id: upload.id },
    data: { pitsCreated: result.count },
  });

  return NextResponse.json({
    created: result.count,
    skipped: parsedPits.length - result.count,
    uploadId: upload.id,
  });
}

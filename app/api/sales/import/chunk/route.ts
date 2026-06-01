import { writeImportChunk, type ImportChunkPayload } from "@/lib/chunkImport";

export const runtime = "nodejs";
/** Each chunk should finish well under Vercel's limit */
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: ImportChunkPayload;
  try {
    body = (await request.json()) as ImportChunkPayload;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body.sheet ||
    !body.kind ||
    !body.columns ||
    typeof body.columnCount !== "number" ||
    !Array.isArray(body.rows)
  ) {
    return Response.json({ error: "Invalid chunk payload" }, { status: 400 });
  }
  if (body.kind !== "sales" && body.kind !== "dnc") {
    return Response.json({ error: "Invalid kind" }, { status: 400 });
  }
  if (body.rows.length > 500) {
    return Response.json({ error: "Chunk too large (max 500 rows)" }, { status: 400 });
  }

  try {
    const result = await writeImportChunk(body);
    return Response.json(result);
  } catch (err) {
    console.error("chunk import error", err);
    const message =
      err instanceof Error ? err.message : "Chunk import failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

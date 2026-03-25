"use server";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Three directories for three protocol types
const DIRS = {
  function: path.join(process.cwd(), "platform/functions/custom"),
  sense: path.join(process.cwd(), "platform/sense/custom"),
  negotiate: path.join(process.cwd(), "platform/coordination/custom"),
} as const;

type ProtocolType = keyof typeof DIRS;

function getDir(type: string): string {
  return DIRS[type as ProtocolType] ?? DIRS.function;
}

/**
 * GET /api/dev/save-function?type=function|awareness|coordination
 * Lists all saved custom registrations of the given type.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Dev only" }, { status: 403 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "function";
  const dir = getDir(type);

  try {
    await fs.mkdir(dir, { recursive: true });
    const files = await fs.readdir(dir);
    const tsFiles = files.filter(f => f.endsWith(".ts") && f !== "index.ts");

    const items: Array<{ id: string; code: string }> = [];
    for (const file of tsFiles) {
      const code = await fs.readFile(path.join(dir, file), "utf-8");
      items.push({ id: file.replace(".ts", ""), code });
    }

    return NextResponse.json({ functions: items });
  } catch {
    return NextResponse.json({ functions: [] });
  }
}

/**
 * POST /api/dev/save-function
 * Body: { id: string, code: string, type?: "function" | "awareness" | "coordination" }
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Dev only" }, { status: 403 });
  }

  const body = await request.json();
  const { id, code, type = "function" } = body as { id: string; code: string; type?: string };

  if (!id || !code) {
    return NextResponse.json({ error: "Missing id or code" }, { status: 400 });
  }

  const dir = getDir(type);
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "-");
  const filePath = path.join(dir, `${safeId}.ts`);

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, code, "utf-8");
    return NextResponse.json({ path: filePath.replace(process.cwd(), "") });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/**
 * DELETE /api/dev/save-function?id=xxx&type=function|awareness|coordination
 */
export async function DELETE(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Dev only" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const type = url.searchParams.get("type") || "function";

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const dir = getDir(type);
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "-");

  try {
    await fs.unlink(path.join(dir, `${safeId}.ts`));
    return NextResponse.json({ deleted: safeId });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

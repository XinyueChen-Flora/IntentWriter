"use server";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const CUSTOM_DIR = path.join(process.cwd(), "platform/functions/custom");

/**
 * GET /api/dev/save-function
 *
 * Lists all custom function files and returns their code.
 * Used on page load to dynamically register saved functions.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  try {
    await fs.mkdir(CUSTOM_DIR, { recursive: true });
    const files = await fs.readdir(CUSTOM_DIR);
    const customFiles = files.filter(
      (f) => f.endsWith(".ts") && f !== "index.ts"
    );

    const functions: Array<{ id: string; code: string }> = [];
    for (const file of customFiles) {
      const code = await fs.readFile(path.join(CUSTOM_DIR, file), "utf-8");
      functions.push({ id: file.replace(".ts", ""), code });
    }

    return NextResponse.json({ functions });
  } catch {
    return NextResponse.json({ functions: [] });
  }
}

/**
 * POST /api/dev/save-function
 *
 * Saves a function definition as a TypeScript file.
 * Body: { id: string, code: string }
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { id, code } = body as { id: string; code: string };

  if (!id || !code) {
    return NextResponse.json({ error: "Missing id or code" }, { status: 400 });
  }

  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "-");
  const filePath = path.join(CUSTOM_DIR, `${safeId}.ts`);

  try {
    await fs.mkdir(CUSTOM_DIR, { recursive: true });
    await fs.writeFile(filePath, code, "utf-8");

    return NextResponse.json({
      path: `platform/functions/custom/${safeId}.ts`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/dev/save-function?id=xxx
 *
 * Removes a custom function file.
 */
export async function DELETE(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "-");
  const filePath = path.join(CUSTOM_DIR, `${safeId}.ts`);

  try {
    await fs.unlink(filePath);
    return NextResponse.json({ deleted: safeId });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

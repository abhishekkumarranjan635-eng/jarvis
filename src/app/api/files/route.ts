import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const allowedRoots = [os.homedir(), os.tmpdir(), "/workspace", "/data"];

function resolveSafe(target: string) {
  const expanded = target.startsWith("~") ? path.join(os.homedir(), target.slice(1)) : target;
  const absolute = path.resolve(expanded);
  if (!allowedRoots.some((root) => absolute.startsWith(path.resolve(root)))) {
    throw new Error("Access to this path is not allowed.");
  }
  return absolute;
}

async function listDirectory(target: string) {
  const safe = resolveSafe(target);
  const entries = await fs.readdir(safe, { withFileTypes: true });
  return entries.slice(0, 200).map((entry) => ({
    name: entry.name,
    path: path.join(safe, entry.name),
    kind: entry.isDirectory() ? "directory" : "file",
    size: entry.isFile() ? safe : undefined,
  }));
}

async function readFile(target: string) {
  const safe = resolveSafe(target);
  const stats = await fs.stat(safe);
  if (stats.size > 256 * 1024) throw new Error("File is too large to preview (limit 256 KB).");
  return fs.readFile(safe, "utf8");
}

export async function POST(request: Request) {
  let body: { action?: "list" | "read"; path?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid file request." }, { status: 400 });
  }
  if (!body.action || !body.path?.trim()) {
    return NextResponse.json({ error: "Choose an action and a path." }, { status: 400 });
  }
  try {
    if (body.action === "list") {
      const entries = await listDirectory(body.path.trim());
      return NextResponse.json({ entries, path: path.resolve(body.path.trim()) });
    }
    if (body.action === "read") {
      const text = await readFile(body.path.trim());
      return NextResponse.json({ text, path: path.resolve(body.path.trim()) });
    }
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Could not access the requested path.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

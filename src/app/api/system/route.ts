import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import os from "node:os";

type Platform = "windows" | "darwin" | "linux";

const platform: Platform = os.platform() === "win32" ? "windows" : os.platform() === "darwin" ? "darwin" : "linux";

type CommandSpec = {
  id: string;
  label: string;
  on?: string;
  off?: string;
};

const commandLibrary: Record<string, CommandSpec> = {
  browser: { id: "browser", label: "web browser", on: platform === "windows" ? "start chrome" : platform === "darwin" ? "open -a \"Google Chrome\"" : "xdg-open https://www.google.com", off: platform === "windows" ? "taskkill /IM chrome.exe /F" : platform === "darwin" ? "osascript -e 'quit app \"Google Chrome\"'" : "pkill -f chrome" },
  terminal: { id: "terminal", label: "terminal", on: platform === "windows" ? "start cmd" : platform === "darwin" ? "open -a Terminal" : "xdg-terminal", off: platform === "windows" ? "taskkill /IM cmd.exe /F" : platform === "darwin" ? "osascript -e 'quit app \"Terminal\"'" : "pkill -f xterm" },
  code: { id: "code", label: "vscode", on: platform === "windows" ? "start code" : platform === "darwin" ? "open -a \"Visual Studio Code\"" : "code .", off: platform === "windows" ? "taskkill /IM Code.exe /F" : platform === "darwin" ? "osascript -e 'quit app \"Visual Studio Code\"'" : "pkill -f code" },
  spotify: { id: "spotify", label: "spotify", on: platform === "windows" ? "start spotify" : platform === "darwin" ? "open -a Spotify" : "spotify", off: platform === "windows" ? "taskkill /IM Spotify.exe /F" : platform === "darwin" ? "osascript -e 'quit app \"Spotify\"'" : "pkill -f spotify" },
  slack: { id: "slack", label: "slack", on: platform === "windows" ? "start slack" : platform === "darwin" ? "open -a Slack" : "slack", off: platform === "windows" ? "taskkill /IM slack.exe /F" : platform === "darwin" ? "osascript -e 'quit app \"Slack\"'" : "pkill -f slack" },
  calculator: { id: "calculator", label: "calculator", on: platform === "windows" ? "start calc" : platform === "darwin" ? "open -a Calculator" : "gnome-calculator", off: platform === "windows" ? "taskkill /IM Calculator.exe /F" : platform === "darwin" ? "osascript -e 'quit app \"Calculator\"'" : "pkill -f gnome-calculator" },
};

function runShell(command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, detached: true, stdio: "ignore" });
    child.on("error", (error) => resolve({ stdout: "", stderr: error.message, code: -1 }));
    child.on("exit", (code) => resolve({ stdout: "", stderr: "", code: code ?? 0 }));
    if (typeof child.unref === "function") child.unref();
    setTimeout(() => resolve({ stdout: "", stderr: "", code: 0 }), 1500);
  });
}

export async function POST(request: Request) {
  let body: { action?: "on" | "off" | "list"; target?: string; command?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid system request." }, { status: 400 });
  }
  const action = body.action;
  if (action === "list") return NextResponse.json({ commands: Object.values(commandLibrary).map(({ id, label }) => ({ id, label })) });
  if (action !== "on" && action !== "off") return NextResponse.json({ error: "Choose on or off." }, { status: 400 });
  const target = body.target?.toLowerCase().trim();
  if (!target) return NextResponse.json({ error: "Choose a target application." }, { status: 400 });
  const spec = commandLibrary[target] ?? Object.values(commandLibrary).find((entry) => entry.label.toLowerCase().includes(target) || target.includes(entry.label.toLowerCase()));
  const command = body.command?.trim() || (spec ? (action === "on" ? spec.on : spec.off) : undefined);
  if (!command) return NextResponse.json({ error: `I do not know how to ${action} "${target}" on this system yet. Try: ${Object.keys(commandLibrary).join(", ")}.` }, { status: 404 });
  const result = await runShell(command);
  return NextResponse.json({ status: "ok", action, target: spec?.label ?? target, command, exitCode: result.code });
}

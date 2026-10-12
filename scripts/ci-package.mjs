import { spawn } from "node:child_process";
const scripts = {
    Windows: "desktop:windows",
    macOS: "desktop:mac",
    Linux: "desktop:linux",
  },
  platform = process.argv[2];
if (!scripts[platform]) throw new Error("Choose a platform.");
const env = { ...process.env };
for (const name of [
  "CSC_LINK",
  "CSC_KEY_PASSWORD",
  "APPLE_ID",
  "APPLE_APP_SPECIFIC_PASSWORD",
  "APPLE_TEAM_ID",
])
  if (!env[name]?.trim()) delete env[name];
const child = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", scripts[platform]],
  { env, shell: process.platform === "win32", stdio: "inherit" },
);
child.on("error", (e) => {
  console.error(e);
  process.exitCode = 1;
});
child.on("exit", (code) => (process.exitCode = code ?? 1));

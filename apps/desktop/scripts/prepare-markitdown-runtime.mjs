import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(projectRoot, "src-tauri", "scripts", "prepare-markitdown-runtime.py");

function resolvePythonCommand() {
  const candidates = process.platform === "win32" ? ["python", "py"] : ["python3", "python"];
  for (const command of candidates) {
    try {
      execFileSync(command, ["--version"], { stdio: "ignore" });
      return command;
    } catch {}
  }
  throw new Error("No usable Python interpreter found for prepare-markitdown-runtime");
}

execFileSync(resolvePythonCommand(), [scriptPath], {
  cwd: projectRoot,
  stdio: "inherit",
});

import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const prefix = resolve(process.argv[2] ?? ".");
const output = process.argv[3];
const scratch = await mkdtemp(join(tmpdir(), "xiaoyan-harness-smoke-"));
const exec = promisify(execFile);
const entries = {
  dsh: ["@deepseek-ai/dsh", "lib/bin.js"],
  codex: ["@openai/codex", "bin/codex.js"],
  opencode: ["opencode-ai", "bin/opencode"],
  pi_web: ["@agegr/pi-web", "bin/pi-web.js"],
};

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}

async function waitFor(check, processState) {
  const deadline = Date.now() + 60_000;
  let lastError;
  while (Date.now() < deadline) {
    if (processState.failure) throw processState.failure;
    if (processState.child.exitCode !== null) throw new Error(`runtime exited: ${processState.child.exitCode}`);
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw lastError ?? new Error("runtime readiness timed out");
}

function launch(command, args, cwd, env) {
  const child = spawn(command, args, {
    cwd, env, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"],
  });
  const state = { child, log: "", failure: null };
  const capture = (chunk) => { state.log = (state.log + chunk.toString()).slice(-32_000); };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  child.once("error", (error) => { state.failure = error; });
  return state;
}

async function stop(state) {
  if (!state?.child.pid) return;
  const signal = (name) => {
    try {
      if (process.platform === "win32") state.child.kill(name);
      else process.kill(-state.child.pid, name);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  };
  signal("SIGTERM");
  if (state.child.exitCode === null && state.child.signalCode === null) {
    await Promise.race([once(state.child, "exit"), delay(3000)]);
  }
  // Pi Web and DSH can own descendants after their CLI has exited.
  signal("SIGKILL");
}

const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(5000) });

async function checkCodex(url) {
  const socket = new WebSocket(url);
  try {
    await Promise.race([once(socket, "open"), delay(10_000).then(() => { throw new Error("WebSocket handshake timed out"); })]);
    const rpc = async (id, method, params) => {
      const response = new Promise((done, reject) => {
        const timer = setTimeout(() => { socket.removeEventListener("message", receive); reject(new Error(`${method} timed out`)); }, 10_000);
        const receive = (event) => {
          const message = JSON.parse(event.data);
          if (message.id !== id) return;
          clearTimeout(timer);
          socket.removeEventListener("message", receive);
          if (message.error) reject(new Error(`${method}: ${JSON.stringify(message.error)}`));
          else done(message.result);
        };
        socket.addEventListener("message", receive);
      });
      socket.send(JSON.stringify({ id, method, params }));
      return response;
    };
    await rpc(1, "initialize", { clientInfo: { name: "xiaoyan-runtime-smoke", version: "1" }, capabilities: { experimentalApi: true } });
    socket.send(JSON.stringify({ method: "initialized" }));
    const threads = await rpc(2, "thread/list", { limit: 5 });
    assert(Array.isArray(threads.data));
    return ["websocket_handshake", "initialize", "thread_list"];
  } finally {
    socket.close();
  }
}

async function smoke(provider) {
  const [name, relativeEntry] = entries[provider];
  const packageDir = join(prefix, "node_modules", name);
  const pkg = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
  const entry = join(packageDir, provider === "opencode" ? pkg.bin.opencode : relativeEntry);
  const command = provider === "opencode" ? entry : process.execPath;
  const prefixArgs = provider === "opencode" ? [] : [entry];
  const cwd = join(scratch, provider);
  await mkdir(cwd, { recursive: true });
  const env = {
    ...process.env, HOME: cwd, USERPROFILE: cwd, XDG_CONFIG_HOME: join(cwd, "config"), XDG_DATA_HOME: join(cwd, "data"),
    CODEX_HOME: join(cwd, "codex"), DSH_HOME: join(cwd, "dsh"), PI_CODING_AGENT_DIR: join(cwd, "pi"),
    DSH_TELEMETRY_DISABLED: "1", NEXT_TELEMETRY_DISABLED: "1", PI_WEB_SKIP_VERSION_CHECK: "1", DO_NOT_TRACK: "1",
  };
  // The smoke checks startup and local transport, with no provider credentials.
  for (const key of Object.keys(env)) if (/(API_KEY|AUTH_TOKEN|PI_WEB_PASSWORD|OPENCODE_SERVER_PASSWORD)/.test(key)) delete env[key];
  await mkdir(env.CODEX_HOME, { recursive: true });
  const { stdout } = await exec(command, [...prefixArgs, "--version"], { cwd, env, timeout: 20_000 });
  assert(stdout.includes(pkg.version), `${provider}: reported version does not match package`);
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const args = provider === "dsh" ? ["web", "--host", "127.0.0.1", "--port", String(port), "--no-open"]
    : provider === "codex" ? ["app-server", "--listen", `ws://127.0.0.1:${port}`]
      : provider === "opencode" ? ["serve", "--hostname", "127.0.0.1", "--port", String(port)]
        : ["--hostname", "127.0.0.1", "--port", String(port), "--no-open"];
  let state;
  try {
    state = launch(command, [...prefixArgs, ...args], cwd, env);
    let checks;
    if (provider === "dsh") {
      const url = await waitFor(() => state.log.match(/^dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=\S+)/m)?.[1], state);
      assert.equal((await request(base)).status, 401);
      const exchange = await request(url, { redirect: "manual" });
      assert.equal(exchange.status, 303);
      const cookie = exchange.headers.get("set-cookie");
      assert(cookie?.includes("SameSite=Strict"));
      assert.equal((await request(base, { headers: { cookie: cookie.split(";")[0] } })).status, 200);
      checks = ["loopback_startup", "unauthenticated_401", "launch_token_exchange", "authenticated_html"];
    } else if (provider === "codex") {
      await waitFor(() => state.log.includes("127.0.0.1") || state.log.includes("Listening"), state);
      checks = await checkCodex(`ws://127.0.0.1:${port}`);
    } else {
      const health = provider === "opencode" ? "/global/health" : "/api/sessions";
      await waitFor(async () => (await request(base + health)).status === 200, state);
      const page = await request(base);
      assert.equal(page.status, 200);
      assert(page.headers.get("content-type")?.includes("text/html"));
      checks = ["loopback_startup", provider === "opencode" ? "global_health" : "session_list", "html_page"];
    }
    return { provider, version: pkg.version, passed: true, checks };
  } catch (error) {
    const diagnostic = state?.log.slice(-1600).replace(/([?&]token=)[^\s]+/g, "$1[redacted]");
    return { provider, version: pkg.version, passed: false, error: error.message, diagnostic };
  } finally {
    await stop(state);
  }
}

const results = [];
for (const provider of Object.keys(entries)) {
  try { results.push(await smoke(provider)); }
  catch (error) { results.push({ provider, passed: false, error: error.message }); }
  console.log(JSON.stringify(results.at(-1)));
}
const report = { date: new Date().toISOString().slice(0, 10), evaluation: "isolated-keyless-harness-transport", results, passed: results.every((result) => result.passed) };
if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) process.exitCode = 1;

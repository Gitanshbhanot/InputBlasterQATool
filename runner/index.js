// runner/index.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 4545;
const RUNS_DIR = path.join(process.cwd(), "runs");

// If you ever need to force adb path:
// export ADB_BIN="/Users/<you>/Library/Android/sdk/platform-tools/adb"
const ADB_BIN = process.env.ADB_BIN || "adb";

// Swiggy launcher activity (you verified this works):
const SWIGGY_ACTIVITY = "in.swiggy.android/.HomeIcon";

// Gemini env
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"; // per docs

// ---------- ADB helper ----------
function adb(args) {
  const r = spawnSync(ADB_BIN, args, { encoding: "utf-8" });
  if (r.error) throw new Error(`adb spawn error: ${r.error.message}`);
  if (r.status !== 0) {
    throw new Error(
      `adb ${args.join(" ")} failed:\n${r.stderr || r.stdout || "(no output)"}`
    );
  }
  return (r.stdout || "").trim();
}

// ---------- Files ----------
function ensureRunsDir() {
  if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR, { recursive: true });
}
function makeRunDir() {
  ensureRunsDir();
  const runId = `run_${Date.now()}`;
  const outDir = path.join(RUNS_DIR, runId);
  fs.mkdirSync(outDir, { recursive: true });
  return { runId, outDir };
}

// ---------- Device control ----------
function wakeAndUnlock() {
  try {
    adb(["shell", "input", "keyevent", "224"]);
  } catch {}
  try {
    adb(["shell", "wm", "dismiss-keyguard"]);
  } catch {}
  try {
    adb(["shell", "input", "swipe", "500", "1800", "500", "300", "300"]);
  } catch {}
}
function goHome() {
  try {
    adb(["shell", "input", "keyevent", "3"]);
  } catch {}
}
function launchApp(appId) {
  wakeAndUnlock();
  goHome();

  if (appId === "in.swiggy.android") {
    adb(["shell", "am", "start", "-n", SWIGGY_ACTIVITY]);
    return;
  }

  adb([
    "shell",
    "monkey",
    "-p",
    appId,
    "-c",
    "android.intent.category.LAUNCHER",
    "1",
  ]);
}
function tap(x, y) {
  adb(["shell", "input", "tap", String(x), String(y)]);
}
function swipe(x1, y1, x2, y2, ms = 300) {
  adb([
    "shell",
    "input",
    "swipe",
    String(x1),
    String(y1),
    String(x2),
    String(y2),
    String(ms),
  ]);
}
function sleepMs(ms) {
  const sec = Math.max(0, Math.round(Number(ms || 0) / 1000));
  adb(["shell", "sleep", String(Math.max(0, sec))]);
}
function inputText(text) {
  // Reliable ADB input. Avoid shell metacharacters.
  const sanitized = String(text)
    .replace(/[<>|&;()$`\\'"]/g, "_")
    .replace(/%/g, "%25")
    .replace(/\s/g, "%s")
    .replace(/\n/g, "");

  adb(["shell", "input", "text", sanitized]);
}
function screenshot(localPath) {
  // Avoid ENOBUFS: capture on device then pull.
  const remote = "/sdcard/__lm_shot.png";
  adb(["shell", "screencap", "-p", remote]);
  adb(["pull", remote, localPath]);
  try {
    adb(["shell", "rm", remote]);
  } catch {}
}

// ---------- Crash evidence ----------
function clearLogcat() {
  try {
    adb(["logcat", "-c"]);
  } catch {}
}
function dumpLogcatTo(filePath, pid) {
  const args = pid
    ? ["logcat", "--pid", pid, "-d", "-v", "time"]
    : ["logcat", "-d", "-v", "time"];
  const out = adb(args);
  fs.writeFileSync(filePath, out || "", "utf-8");
}

function pidof(appId) {
  try {
    const out = adb(["shell", "pidof", appId]);
    return out?.trim() || "";
  } catch {
    return "";
  }
}

function detectCrash(logText, appId, pidBefore, pidAfter) {
  // strict Java crash marker
  const hasFatal = /FATAL EXCEPTION/.test(logText);

  // strict ANR marker
  const hasAnr = new RegExp(`ANR in\\s+${appId.replace(/\./g, "\\.")}`).test(
    logText
  );

  // scope crash to your app (Process: <pkg> is the key line in fatal blocks)
  const hasProcessLine = new RegExp(
    `\\bProcess:\\s*${appId.replace(/\./g, "\\.")}\\b`
  ).test(logText);

  // PID evidence: died OR restarted
  const died = Boolean(pidBefore) && !pidAfter;
  const restarted =
    Boolean(pidBefore) && Boolean(pidAfter) && pidBefore !== pidAfter;

  const crashed = (hasFatal && hasProcessLine) || hasAnr || died || restarted;

  return {
    fatal: hasFatal && hasProcessLine,
    anr: hasAnr,
    processDied: died || restarted,
    mentionsApp: hasProcessLine, // stop using includes(appId)
    crashed,
    pidBefore,
    pidAfter,
  };
}

// ---------- UIAutomator dump + selector matching (no X/Y in UI) ----------
function uiDumpLocal(outDir, name = "uidump.xml") {
  // Use /data/local/tmp (more reliable than /sdcard on some builds)
  const remote = "/data/local/tmp/__lm_uidump.xml";
  const local = path.join(outDir, name);

  // Try up to 3 times
  for (let i = 0; i < 3; i++) {
    try {
      // Remove previous file if any
      try {
        adb(["shell", "rm", "-f", remote]);
      } catch {}

      // Run dump
      adb(["shell", "uiautomator", "dump", remote]);

      // Verify it exists before pulling
      const ls = adb(["shell", "ls", "-l", remote]);
      if (!ls || ls.includes("No such file"))
        throw new Error("uidump not created");

      // Pull it
      adb(["pull", remote, local]);

      // Cleanup
      try {
        adb(["shell", "rm", "-f", remote]);
      } catch {}

      return local;
    } catch (e) {
      // wait a bit and retry
      try {
        sleepMs(800);
      } catch {}
      if (i === 2) throw e;
    }
  }
}

function parseBounds(boundsStr) {
  const m = String(boundsStr || "").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!m) return null;
  const x1 = Number(m[1]),
    y1 = Number(m[2]),
    x2 = Number(m[3]),
    y2 = Number(m[4]);
  return {
    x1,
    y1,
    x2,
    y2,
    cx: Math.floor((x1 + x2) / 2),
    cy: Math.floor((y1 + y2) / 2),
  };
}

function findNodeBounds(
  xmlText,
  {
    text,
    containsText,
    resourceId,
    className,
    contentDesc,
    containsDesc,
    contentDescription,
    containsDescription,
  }
) {
  const nodes = String(xmlText || "")
    .split("<node ")
    .slice(1);

  const exactDesc = contentDesc || contentDescription;
  const containsD = containsDesc || containsDescription;

  for (const chunk of nodes) {
    const line = "<node " + chunk;

    const getAttr = (k) => {
      const mm = line.match(new RegExp(`${k}="([^"]*)"`, "i"));
      return mm ? mm[1] : "";
    };

    const t = getAttr("text");
    const rid = getAttr("resource-id");
    const cls = getAttr("class");
    const cd = getAttr("content-desc");
    const bounds = getAttr("bounds");

    // Apply hard filters first
    if (resourceId && rid !== resourceId) continue;
    if (className && cls !== className) continue;

    // Match text
    if (text && t === text) return parseBounds(bounds);
    if (
      containsText &&
      t &&
      t.toLowerCase().includes(String(containsText).toLowerCase())
    ) {
      return parseBounds(bounds);
    }

    // Match content-desc / contentDescription
    if (exactDesc && cd === exactDesc) return parseBounds(bounds);
    if (
      containsD &&
      cd &&
      cd.toLowerCase().includes(String(containsD).toLowerCase())
    ) {
      return parseBounds(bounds);
    }
  }

  return null;
}

function normalizeSelectors(selOrList) {
  if (!selOrList) return [];
  return Array.isArray(selOrList) ? selOrList : [selOrList];
}
function findAndTap(outDir, selectorOrList) {
  const selectors = normalizeSelectors(selectorOrList);
  const xmlPath = uiDumpLocal(outDir, "uidump_findtap.xml");
  const xml = fs.readFileSync(xmlPath, "utf-8");

  for (const sel of selectors) {
    const b = findNodeBounds(xml, sel || {});
    if (b) {
      tap(b.cx, b.cy);
      return;
    }
  }

  throw new Error(
    `FIND_TAP failed: selector not found: ${JSON.stringify(selectors)}`
  );
}
function findAndInput(outDir, selectorOrList, text) {
  const selectors = normalizeSelectors(selectorOrList);
  const xmlPath = uiDumpLocal(outDir, "uidump_findinput.xml");
  const xml = fs.readFileSync(xmlPath, "utf-8");

  for (const sel of selectors) {
    const b = findNodeBounds(xml, sel || {});
    if (b) {
      tap(b.cx, b.cy);
      // focus settle
      try {
        adb(["shell", "sleep", "1"]);
      } catch {}
      inputText(text);
      return;
    }
  }

  throw new Error(
    `FIND_INPUT failed: selector not found: ${JSON.stringify(selectors)}`
  );
}
function withRetries(fn, { retries = 3, waitMs = 1200 } = {}) {
  let lastErr = null;
  for (let i = 0; i < retries; i++) {
    try {
      return fn();
    } catch (e) {
      lastErr = e;
    }
    // wait and retry
    try {
      sleepMs(waitMs);
    } catch {}
  }
  throw lastErr || new Error("Action failed");
}

// Locale is intentionally skipped for emulator reliability
function setLocale(locale) {
  return { method: "skipped (manual on emulator)", ok: true, locale };
}

// ---------- Gemini: goal -> testcase JSON ----------
function normalizeSteps(rawSteps) {
  const steps = Array.isArray(rawSteps) ? rawSteps : [];

  return steps.map((s) => {
    // If already object, keep it
    if (s && typeof s === "object") return s;

    // If string, support shorthand formats:
    // "LAUNCH"
    // "SCREENSHOT{name}" or "SCREENSHOT{LaunchScreen}"
    // "SLEEP_MS{6500}"
    if (typeof s === "string") {
      const str = s.trim();

      // SCREENSHOT{something}
      const shot = str.match(/^SCREENSHOT\{(.+)\}$/i);
      if (shot) {
        // allow "LaunchScreen" without extension
        const base = shot[1].trim().replace(/[^\w.-]+/g, "_");
        const name = base.toLowerCase().endsWith(".png") ? base : `${base}.png`;
        return { action: "SCREENSHOT", name };
      }

      // SLEEP_MS{1234}
      const sl = str.match(/^SLEEP_MS\{(\d+)\}$/i);
      if (sl) return { action: "SLEEP_MS", ms: Number(sl[1]) };

      // Plain action e.g. "LAUNCH"
      return { action: str.toUpperCase() };
    }

    // Unknown/invalid -> keep as-is so we can error clearly later
    return s;
  });
}

function extractJsonCandidate(text) {
  const s = String(text || "").trim();

  // If model returned pure JSON, parse directly
  try {
    const direct = JSON.parse(s);
    return direct;
  } catch {}

  // Otherwise, try best-effort extraction between first '{' and last '}'
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;

  const candidate = s.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

// Convert all step shapes into your runner's canonical format: { action: "...", ... }
function normalizeGeneratedSteps(rawSteps) {
  const steps = Array.isArray(rawSteps) ? rawSteps : [];
  const out = [];

  for (const s of steps) {
    // Existing object format: { action: "..." }
    if (s && typeof s === "object" && !Array.isArray(s) && s.action) {
      out.push(s);
      continue;
    }

    // String shorthands: "LAUNCH" or "SCREENSHOT{X}" etc.
    if (typeof s === "string") {
      const str = s.trim();

      const shot = str.match(/^SCREENSHOT\{(.+)\}$/i);
      if (shot) {
        const base = shot[1].trim().replace(/[^\w.-]+/g, "_");
        out.push({
          action: "SCREENSHOT",
          name: base.toLowerCase().endsWith(".png") ? base : `${base}.png`,
        });
        continue;
      }

      const sl = str.match(/^SLEEP_MS\{(\d+)\}$/i);
      if (sl) {
        out.push({ action: "SLEEP_MS", ms: Number(sl[1]) });
        continue;
      }

      out.push({ action: str.toUpperCase() });
      continue;
    }

    // Gemini alternate map format:
    // { "LAUNCH": {} }
    // { "SCREENSHOT": "App Launched" }
    // { "FIND_TAP": { selector: [...], retries: 4, waitMs: 1500 } }
    if (s && typeof s === "object" && !Array.isArray(s)) {
      const keys = Object.keys(s);
      if (keys.length === 1) {
        const k = keys[0];
        const v = s[k];

        if (k.toUpperCase() === "SCREENSHOT") {
          const base = String(v || "shot")
            .trim()
            .replace(/[^\w.-]+/g, "_");
          out.push({
            action: "SCREENSHOT",
            name: base.toLowerCase().endsWith(".png") ? base : `${base}.png`,
          });
          continue;
        }

        if (k.toUpperCase() === "SLEEP_MS") {
          out.push({ action: "SLEEP_MS", ms: Number(v?.ms ?? v ?? 0) });
          continue;
        }

        // FIND_TAP / FIND_INPUT shapes
        if (
          k.toUpperCase() === "FIND_TAP" ||
          k.toUpperCase() === "FIND_INPUT"
        ) {
          out.push({
            action: k.toUpperCase(),
            ...(typeof v === "object" && v ? v : {}),
          });
          continue;
        }

        // default: treat key as action
        out.push({
          action: k.toUpperCase(),
          ...(typeof v === "object" && v ? v : {}),
        });
        continue;
      }
    }

    // If we can't interpret, keep it (will error clearly)
    out.push(s);
  }

  return out;
}

function normalizeGeneratedTestcase(tc, { appId, goal, mutationText }) {
  const testcase = tc || {};
  testcase.appId = appId;
  testcase.locale = testcase.locale || "en-US";
  testcase.steps = normalizeGeneratedSteps(testcase.steps);
  testcase.meta = {
    ...(testcase.meta || {}),
    goal,
    mutationText,
    generator: "gemini",
  };
  return testcase;
}

async function callGemini(promptText) {
  if (!GEMINI_API_KEY)
    throw new Error("GEMINI_API_KEY is not set in runner env");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_MODEL
  )}:generateContent`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096, // prevent truncation
      responseMimeType: "application/json", // push pure JSON
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(
      `Gemini API error: HTTP ${resp.status} ${t}`.slice(0, 1500)
    );
  }

  const data = await resp.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ||
    "";

  return text;
}

async function geminiGenerateTestcase({ goal, appId, mutationText }) {
  const schema = `
Return ONLY valid JSON. No markdown. No extra text.

Schema (STRICT):
{
  "appId":"${appId}",
  "locale":"en-US",
  "steps":[
    { "action":"LAUNCH" },
    { "action":"SLEEP_MS","ms":9000 },
    { "action":"SCREENSHOT","name":"Launch.png" },

    {
      "action":"FIND_TAP",
      "selector":[
        { "containsText":"Search" },
        { "containsDesc":"Search" }
      ],
      "retries":4,
      "waitMs":1500
    },
    
    { "action":"TAP", "x": <number>, "y": <number> }

    { "action":"SLEEP_MS","ms":800 },

    {
      "action":"INPUT_TEXT",
      "text":"${mutationText}"
    },

    { "action":"SLEEP_MS","ms":1200 },
    { "action":"SCREENSHOT","name":"AfterInput.png" }
  ],
  "meta": {
    "goal":"${goal}",
    "mutationText":"${mutationText}"
  }
}

Rules (MANDATORY):
- Every step MUST be an object with an "action" field.
- DO NOT output string shorthand like "LAUNCH" or SCREENSHOT{...}.
- DO NOT use FIND_INPUT for search bars or text fields.
- ALWAYS use FIND_TAP to focus the field, then INPUT_TEXT to type.
- Prefer selectors by visible English text or content-desc.
- Keep steps <= 12.
- Assume the app uses custom views (Compose); do not rely on EditText.
`;

  const prompt = `App: ${appId}\nGoal: ${goal}\nmutationText: ${mutationText}\n\n${schema}`;

  // First try
  const raw1 = await callGemini(prompt);
  let obj = extractJsonCandidate(raw1);

  // If invalid/truncated, ask Gemini to REPAIR its own output (2nd try)
  if (!obj) {
    const repairPrompt = `Fix the following into STRICT valid JSON matching the schema. Output ONLY JSON.\n\n${raw1}`;
    const raw2 = await callGemini(repairPrompt);
    obj = extractJsonCandidate(raw2);
    if (!obj)
      throw new Error(
        `Gemini did not return valid JSON after repair. Raw:\n${raw2}`.slice(
          0,
          1500
        )
      );
  }

  return normalizeGeneratedTestcase(obj, { appId, goal, mutationText });
}

app.post("/generate", async (req, res) => {
  try {
    const { goal, appId, mutationText } = req.body || {};
    if (!goal || !appId || !mutationText) {
      return res
        .status(400)
        .json({ ok: false, error: "Needs { goal, appId, mutationText }" });
    }
    const testcase = await geminiGenerateTestcase({
      goal,
      appId,
      mutationText,
    });
    return res.json({ ok: true, testcase });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ---------- Run execution ----------
app.post("/run", async (req, res) => {
  const test = req.body;

  if (!test || !test.appId || !Array.isArray(test.steps)) {
    return res
      .status(400)
      .json({ ok: false, error: "Invalid payload: needs {appId, steps[]}" });
  }

  const { runId, outDir } = makeRunDir();
  const screenshots = [];

  let localeResult = { method: "n/a" };
  let pidBefore = "";
  let pidAfter = "";

  try {
    fs.writeFileSync(
      path.join(outDir, "log.json"),
      JSON.stringify({ test }, null, 2),
      "utf-8"
    );

    localeResult = setLocale(test.locale || "en-US");
    clearLogcat();

    test.steps = normalizeSteps(test.steps);

    for (const s of test.steps) {
      switch (s.action) {
        case "LAUNCH": {
          launchApp(test.appId);
          try {
            adb(["shell", "sleep", "1"]);
          } catch {}
          pidBefore = pidof(test.appId);
          break;
        }

        case "SLEEP_MS": {
          sleepMs(Number(s.ms || 0));
          break;
        }

        case "TAP_XY":
        case "TAP": {
          tap(Number(s.x), Number(s.y));
          break;
        }

        case "SWIPE": {
          swipe(
            Number(s.x1),
            Number(s.y1),
            Number(s.x2),
            Number(s.y2),
            Number(s.ms || 300)
          );
          break;
        }

        case "INPUT_TEXT": {
          inputText(s.text ?? "");
          break;
        }

        case "FIND_TAP": {
          const opts = {
            retries: Number(s.retries || 4),
            waitMs: Number(s.waitMs || 1500),
          };
          withRetries(() => findAndTap(outDir, s.selector), opts);
          break;
        }

        case "FIND_INPUT": {
          const opts = {
            retries: Number(s.retries || 4),
            waitMs: Number(s.waitMs || 1500),
          };
          withRetries(
            () => findAndInput(outDir, s.selector, s.text ?? ""),
            opts
          );
          break;
        }

        case "SCREENSHOT": {
          const name = s.name || `shot_${Date.now()}.png`;
          const p = path.join(outDir, name);
          screenshot(p);
          screenshots.push(name);
          break;
        }

        default:
          throw new Error(`Unknown action: ${s.action}`);
      }
    }

    pidAfter = pidof(test.appId);

    const logcatPath = path.join(outDir, "logcat.txt");
    dumpLogcatTo(logcatPath, pidBefore);
    const logText = fs.readFileSync(logcatPath, "utf-8");

    const crash = detectCrash(logText, test.appId, pidBefore, pidAfter);
    fs.writeFileSync(
      path.join(outDir, "crash.json"),
      JSON.stringify(crash, null, 2),
      "utf-8"
    );

    return res.json({
      ok: true,
      runId,
      outDir,
      localeMethod: localeResult.method,
      screenshots,
      crash,
    });
  } catch (e) {
    try {
      fs.writeFileSync(
        path.join(outDir, "error.txt"),
        String(e?.stack || e?.message || e),
        "utf-8"
      );
    } catch {}
    return res
      .status(500)
      .json({ ok: false, runId, outDir, error: String(e?.message || e) });
  }
});

app.get("/runs", (req, res) => {
  try {
    ensureRunsDir();
    const ids = fs
      .readdirSync(RUNS_DIR)
      .filter((d) => d.startsWith("run_"))
      .sort()
      .reverse();

    const runs = ids.map((id) => {
      const dir = path.join(RUNS_DIR, id);
      const crashPath = path.join(dir, "crash.json");
      const logPath = path.join(dir, "log.json");

      let crash = null;
      let meta = null;

      if (fs.existsSync(crashPath))
        crash = JSON.parse(fs.readFileSync(crashPath, "utf-8"));
      if (fs.existsSync(logPath)) {
        const j = JSON.parse(fs.readFileSync(logPath, "utf-8"));
        meta = j?.test?.meta || null;
      }

      const screenshots = fs.readdirSync(dir).filter((f) => f.endsWith(".png"));
      return { id, dir, crash, meta, screenshots };
    });

    res.json({ ok: true, runs });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`Runner listening on http://localhost:${PORT}`);
});

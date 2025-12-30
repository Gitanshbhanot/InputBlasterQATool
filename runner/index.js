// runner/index.js
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 4545;
const RUNS_DIR = path.join(process.cwd(), "runs");

// If you ever need to force adb path:
// export ADB_BIN="/Users/<you>/Library/Android/sdk/platform-tools/adb"
const ADB_BIN = process.env.ADB_BIN || "adb";

// Swiggy launcher activity you verified:
const SWIGGY_ACTIVITY = "in.swiggy.android/.HomeIcon";

// ---------- ADB helper ----------
function adb(args) {
  const r = spawnSync(ADB_BIN, args, { encoding: "utf-8" });

  if (r.error) {
    throw new Error(
      `Failed to start adb binary "${ADB_BIN}". Underlying error: ${r.error.message}`
    );
  }
  if (r.status !== 0) {
    throw new Error(
      `adb ${args.join(" ")} failed:\n${r.stderr || r.stdout || "(no output)"}`
    );
  }
  return (r.stdout || "").trim();
}

// ---------- Core actions ----------
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

function wakeAndUnlock() {
  // Wake screen
  try {
    adb(["shell", "input", "keyevent", "224"]);
  } catch {}
  // Dismiss keyguard (works on many emulators)
  try {
    adb(["shell", "wm", "dismiss-keyguard"]);
  } catch {}
  // Fallback swipe up
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

  // generic fallback
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

function sleepMs(ms) {
  const sec = Math.max(0, Math.round(ms / 1000));
  // shell sleep takes seconds; add 1 sec minimum for tiny waits
  adb(["shell", "sleep", String(Math.max(0, sec))]);
}

function inputText(text) {
  // Make adb input resilient: avoid shell metacharacters and fragile unicode.
  // (If you later add clipboard paste, you can support Arabic/emoji again.)
  const sanitized = String(text)
    .replace(/[<>|&;()$`\\'"]/g, "_") // prevent /system/bin/sh errors
    .replace(/%/g, "%25") // escape %
    .replace(/\s/g, "%s") // spaces -> %s
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

function clearLogcat() {
  try {
    adb(["logcat", "-c"]);
  } catch {}
}

function dumpLogcatTo(filePath) {
  const out = adb(["logcat", "-d", "-v", "time"]);
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
  const fatal = /FATAL EXCEPTION|AndroidRuntime/.test(logText);
  const anr = /ANR in/.test(logText);
  const mentionsApp =
    logText.includes(appId) ||
    new RegExp(`Process:\\s*${appId.replace(/\./g, "\\.")}`).test(logText);

  const processDied = Boolean(pidBefore) && !pidAfter;

  return {
    fatal,
    anr,
    processDied,
    mentionsApp,
    crashed: ((fatal || anr) && mentionsApp) || processDied,
    pidBefore,
    pidAfter,
  };
}

// Locale is intentionally skipped for emulator reliability (you set language manually)
function setLocale(locale) {
  return { method: "skipped (manual on emulator)", ok: true, locale };
}

// ---------- API ----------
app.post("/run", async (req, res) => {
  const test = req.body;

  // Basic validation
  if (!test || !test.appId || !Array.isArray(test.steps)) {
    return res
      .status(400)
      .json({ ok: false, error: "Invalid payload: needs {appId, steps[]}" });
  }

  const { runId, outDir } = makeRunDir();
  const logJsonPath = path.join(outDir, "log.json");
  const screenshots = [];

  let localeResult = { method: "n/a" };
  let pidBefore = "";
  let pidAfter = "";

  try {
    // Record input for debugging
    fs.writeFileSync(logJsonPath, JSON.stringify({ test }, null, 2));

    localeResult = setLocale(test.locale || "en-US");

    // Fresh logcat for crash evidence
    clearLogcat();

    // Execute steps
    for (const s of test.steps) {
      switch (s.action) {
        case "LAUNCH": {
          launchApp(test.appId);
          // Give a moment then capture pid
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

        case "TAP": {
          tap(Number(s.x), Number(s.y));
          break;
        }

        case "INPUT_TEXT": {
          inputText(s.text ?? "");
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

    // Crash evidence
    pidAfter = pidof(test.appId);

    const logcatPath = path.join(outDir, "logcat.txt");
    dumpLogcatTo(logcatPath);
    const logText = fs.readFileSync(logcatPath, "utf-8");

    const crash = detectCrash(logText, test.appId, pidBefore, pidAfter);
    fs.writeFileSync(
      path.join(outDir, "crash.json"),
      JSON.stringify(crash, null, 2)
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
    // Write error artifact
    try {
      fs.writeFileSync(
        path.join(outDir, "error.txt"),
        String(e?.stack || e?.message || e),
        "utf-8"
      );
    } catch {}

    return res.status(500).json({
      ok: false,
      runId,
      outDir,
      error: String(e?.message || e),
    });
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

      const screenshots = fs.existsSync(dir)
        ? fs.readdirSync(dir).filter((f) => f.endsWith(".png"))
        : [];

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

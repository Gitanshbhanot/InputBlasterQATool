import { useMemo, useState, useLayoutEffect, useEffect } from "react";
import EdgeCaseReviewModal from "./components/MultiEditModal";
import {
  Button as MuiButton,
  IconButton,
  ThemeProvider,
  createTheme,
  CssBaseline,
} from "@mui/material";
import {
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  AutoAwesome as MagicIcon,
  PlayArrow as PlayIcon,
  Terminal as TerminalIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";

function generateMutation(kind) {
  switch (kind) {
    case "PHONE_LONG":
      return "9999999999999999999999999999999999999999";
    case "PHONE_MIXED":
      return "12345abc67890";
    case "TEXT_EXPANSION":
      return "SehenswuerdigkeitenInDerNaeheVonHauptbahnhofZusatzinformation";
    case "SYMBOL_STRESS":
      return "!!!@@@###$$$%%%^^^^";
    default:
      return "test";
  }
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Card({ title, children, right, className = "" }) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm transition-all ${className}`}
    >
      <div className="flex justify-between items-center gap-3 mb-4">
        <div className="text-sm font-bold text-slate-900 dark:text-slate-50 tracking-tight">
          {title}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Badge({ children, tone = "gray" }) {
  const styles = {
    gray: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
    blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50",
    green:
      "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50",
    red: "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/50",
    amber:
      "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/50",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
        props.className || ""
      }`}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
        props.className || ""
      }`}
    />
  );
}

function Button({ children, variant = "primary", icon: Icon, ...props }) {
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/10",
    secondary:
      "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm",
  };

  return (
    <button
      {...props}
      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${
        variants[variant]
      } ${props.className || ""}`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

function CodeBlock({ children }) {
  return (
    <div className="relative group">
      <pre className="m-0 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-300 text-[11px] font-mono overflow-x-auto leading-relaxed scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {children}
      </pre>
    </div>
  );
}

export default function App() {
  const [appId, setAppId] = useState("in.swiggy.android");
  const [locale] = useState("en-US");

  const [fieldType, setFieldType] = useState("phone");
  const [kind, setKind] = useState("PHONE_LONG");

  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem("theme-mode");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const mutationText = useMemo(() => generateMutation(kind), [kind]);

  const [goal, setGoal] = useState(
    "Open Swiggy, go to Profile, tap Login, then enter the edge-case value into the phone number input field."
  );
  const [generatedTestcase, setGeneratedTestcase] = useState(null);

  const [enableTapAndInput, setEnableTapAndInput] = useState(false);
  const [tapX, setTapX] = useState("540");
  const [tapY, setTapY] = useState("900");

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [err, setErr] = useState("");
  const [runs, setRuns] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [openEdgeCaseReviewModal, setOpenEdgeCaseReviewModal] = useState(false);

  useLayoutEffect(() => {
    const root = window.document.documentElement;
    if (mode === "dark") {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    }
    localStorage.setItem("theme-mode", mode);
  }, [mode]);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: "#2563eb" },
          background: {
            default: mode === "dark" ? "#020617" : "#f8fafc",
            paper: mode === "dark" ? "#0f172a" : "#ffffff",
          },
        },
        shape: { borderRadius: 16 },
      }),
    [mode]
  );

  const baseTestCase = useMemo(() => {
    const steps = [
      { action: "LAUNCH" },
      { action: "SLEEP_MS", ms: 6500 },
      { action: "SCREENSHOT", name: "after_launch.png" },
    ];

    if (enableTapAndInput) {
      steps.push(
        { action: "TAP", x: Number(tapX), y: Number(tapY) },
        { action: "SLEEP_MS", ms: 450 },
        { action: "TAP", x: Number(tapX), y: Number(tapY) },
        { action: "SLEEP_MS", ms: 700 },
        { action: "INPUT_TEXT", text: mutationText },
        { action: "SLEEP_MS", ms: 1300 },
        { action: "SCREENSHOT", name: "after_input.png" }
      );
    }

    return {
      appId,
      locale,
      steps,
      meta: { kind, fieldType, mutationText, generator: "manual" },
    };
  }, [
    appId,
    locale,
    kind,
    fieldType,
    mutationText,
    enableTapAndInput,
    tapX,
    tapY,
  ]);

  const effectiveTestcase = generatedTestcase || baseTestCase;

  async function refreshRuns() {
    try {
      const r = await fetch("http://localhost:4545/runs");
      const j = await r.json();
      if (j.ok) setRuns(j.runs || []);
    } catch (e) {
      console.warn("Could not refresh runs:", e);
    }
  }

  async function run() {
    setErr("");
    setRunning(true);
    setRunResult(null);
    try {
      const r = await fetch("http://localhost:4545/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(effectiveTestcase),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Run failed");
      setRunResult(j);
      refreshRuns();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setRunning(false);
    }
  }

  async function generateFromGoal() {
    setErr("");
    setGenerating(true);
    try {
      const r = await fetch("http://localhost:4545/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, appId, mutationText }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Generate failed");
      setGeneratedTestcase(j.testcase);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setGenerating(false);
    }
  }

  const crashTone = runResult?.crash?.crashed
    ? "red"
    : runResult
    ? "green"
    : "gray";

  return (
    <ThemeProvider theme={theme}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8 transition-colors duration-300">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-3">
                <TerminalIcon className="w-8 h-8 text-blue-600" />
                Input Mutation Studio
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                Transform natural language goals into executable test cases with
                AI, simulate edge-case mutations, and track crash evidence
                automatically.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <Badge tone="blue">Target: {appId}</Badge>
              <Badge tone={crashTone}>
                {runResult
                  ? runResult.crash?.crashed
                    ? "Crashed"
                    : "No Crash"
                  : "Status: Idle"}
              </Badge>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
              <IconButton
                onClick={() => {
                  console.log("Toggle clicked, current mode:", mode);
                  setMode((m) => (m === "light" ? "dark" : "light"));
                }}
                className="text-slate-500 hover:text-blue-500 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
                size="small"
              >
                {mode === "dark" ? (
                  <LightModeIcon fontSize="small" />
                ) : (
                  <DarkModeIcon fontSize="small" />
                )}
              </IconButton>
            </div>
          </header>

          <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-12">
              <div className="bg-blue-600/5 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-900/30 p-4 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                  <MagicIcon className="text-white w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                    Gemini Engine Active
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Runner uses UIAutomator semantics to locate items.
                    Descriptions like "Tap Login" are sufficient.
                  </p>
                </div>
              </div>
            </div>

            {/* Left Column */}
            <div className="lg:col-span-7 space-y-6">
              <Card
                title="Configuration"
                className="hover:border-blue-500/30 transition-colors"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      App Package
                    </label>
                    <Input
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                      placeholder="e.g. in.swiggy.android"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Field Type
                      </label>
                      <Select
                        value={fieldType}
                        onChange={(e) => setFieldType(e.target.value)}
                      >
                        <option value="phone">Phone Input</option>
                        <option value="text">General Text</option>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Mutation Strategy
                      </label>
                      <Select
                        value={kind}
                        onChange={(e) => setKind(e.target.value)}
                      >
                        <option value="PHONE_LONG">Very Long Digits</option>
                        <option value="PHONE_MIXED">Mixed Characters</option>
                        <option value="TEXT_EXPANSION">
                          Text Expansion (L10n)
                        </option>
                        <option value="SYMBOL_STRESS">Special Symbols</option>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Payload Preview
                    </label>
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono break-all text-slate-700 dark:text-slate-300">
                      {mutationText}
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Goal Generation">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Natural Language Goal
                    </label>
                    <MuiButton
                      variant="text"
                      color="primary"
                      size="small"
                      onClick={() => setOpenEdgeCaseReviewModal(true)}
                      className="text-xs font-bold"
                      startIcon={<MagicIcon size="small" />}
                    >
                      AI Review Edge-cases
                    </MuiButton>
                  </div>
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                    placeholder="Describe the steps..."
                  />
                  <div className="flex gap-3">
                    <Button
                      onClick={generateFromGoal}
                      disabled={generating}
                      className="flex-1"
                      icon={MagicIcon}
                    >
                      {generating ? "Reasoning..." : "Generate with Gemini"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setGeneratedTestcase(null)}
                      disabled={!generatedTestcase}
                      icon={RefreshIcon}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </Card>

              <Card title="Execution Queue">
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      downloadJson("testcase.json", effectiveTestcase)
                    }
                    icon={DownloadIcon}
                  >
                    Export JSON
                  </Button>
                  <Button
                    onClick={run}
                    disabled={running}
                    className="min-w-[140px]"
                    icon={PlayIcon}
                  >
                    {running ? "Running..." : "Run Emulator"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={refreshRuns}
                    icon={RefreshIcon}
                  >
                    Refresh List
                  </Button>
                </div>

                {err && (
                  <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs">
                    <span className="font-bold mr-2 uppercase">Error:</span>
                    {err}
                  </div>
                )}

                {runResult && (
                  <div
                    className={`mt-4 p-4 rounded-2xl border ${
                      runResult.crash?.crashed
                        ? "bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/30"
                        : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30 font-medium"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-50">
                        Last Run Summary
                      </span>
                      <Badge tone={runResult.crash?.crashed ? "red" : "green"}>
                        {runResult.crash?.crashed
                          ? "Crash Observed"
                          : "Successful Run"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-y-2 text-[11px] text-slate-600 dark:text-slate-400">
                      <div>Signals</div>
                      <div className="text-slate-900 dark:text-slate-200 uppercase font-bold">
                        {[
                          runResult.crash?.fatal ? "FATAL" : null,
                          runResult.crash?.anr ? "ANR" : null,
                          runResult.crash?.processDied ? "PROCESS_DIED" : null,
                        ]
                          .filter(Boolean)
                          .join(" • ") || "N/A"}
                      </div>
                      <div>Run ID</div>
                      <div className="font-mono">{runResult.runId}</div>
                      <div>Artifacts</div>
                      <div className="truncate" title={runResult.outDir}>
                        {runResult.outDir}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-5 space-y-6">
              <Card
                title="Testcase Definition"
                right={
                  <Badge tone={generatedTestcase ? "blue" : "gray"}>
                    {generatedTestcase ? "AI Generated" : "Manual Base"}
                  </Badge>
                }
              >
                <CodeBlock>
                  {JSON.stringify(effectiveTestcase, null, 2)}
                </CodeBlock>
              </Card>

              <Card title="Manual Fallback">
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={enableTapAndInput}
                        onChange={(e) => setEnableTapAndInput(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`w-10 h-5 rounded-full transition-colors ${
                          enableTapAndInput
                            ? "bg-blue-600"
                            : "bg-slate-200 dark:bg-slate-800"
                        }`}
                      />
                      <div
                        className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${
                          enableTapAndInput ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-500 transition-colors">
                      Enable Manual TAP+INPUT
                    </span>
                  </label>

                  {enableTapAndInput ? (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Tap X
                        </label>
                        <Input
                          value={tapX}
                          onChange={(e) => setTapX(e.target.value)}
                          placeholder="540"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Tap Y
                        </label>
                        <Input
                          value={tapY}
                          onChange={(e) => setTapY(e.target.value)}
                          placeholder="900"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic font-medium">
                      Manual overrides are disabled. Swiggy UI labels will be
                      used for element location.
                    </p>
                  )}
                </div>
              </Card>

              <Card title="History Pool">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-950 px-4 py-2 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400">
                    <div className="col-span-5">Run Hash</div>
                    <div className="col-span-3">Status</div>
                    <div className="col-span-4">Generator</div>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[400px] overflow-y-auto">
                    {runs.slice(0, 10).map((r) => (
                      <div
                        key={r.id}
                        className="grid grid-cols-12 px-4 py-3 text-[11px] items-center"
                      >
                        <div className="col-span-5 font-mono text-slate-500">
                          {r.id.slice(0, 8)}...
                        </div>
                        <div className="col-span-3">
                          <span
                            className={`font-bold ${
                              r.crash?.crashed
                                ? "text-rose-500"
                                : "text-emerald-500"
                            }`}
                          >
                            {r.crash?.crashed ? "CRASH" : "CLEAN"}
                          </span>
                        </div>
                        <div className="col-span-4 text-slate-400 capitalize truncate">
                          {r.meta?.generator || "manual"}
                        </div>
                      </div>
                    ))}
                    {runs.length === 0 && (
                      <div className="p-8 text-center text-slate-400 text-xs italic">
                        No previous runs recorded.
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </main>
        </div>

        <EdgeCaseReviewModal
          open={openEdgeCaseReviewModal}
          onClose={() => setOpenEdgeCaseReviewModal(false)}
        />
      </div>
    </ThemeProvider>
  );
}

// web/src/App.jsx
import { useMemo, useState } from "react";

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

function Card({ title, children, right }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>
          {title}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Badge({ children, tone = "gray" }) {
  const tones = {
    gray: { bg: "#f3f4f6", fg: "#374151", bd: "#e5e7eb" },
    blue: { bg: "#eff6ff", fg: "#1d4ed8", bd: "#bfdbfe" },
    green: { bg: "#ecfdf5", fg: "#047857", bd: "#a7f3d0" },
    red: { bg: "#fef2f2", fg: "#b91c1c", bd: "#fecaca" },
    amber: { bg: "#fffbeb", fg: "#b45309", bd: "#fde68a" },
  };
  const t = tones[tone] || tones.gray;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${t.bd}`,
        background: t.bg,
        color: t.fg,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #d1d5db",
        background: "#fff",
        color: "#111827",
        fontSize: 14,
        outline: "none",
        minWidth: 0,
        ...(props.style || {}),
      }}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #d1d5db",
        background: "#fff",
        color: "#111827",
        fontSize: 14,
        outline: "none",
        minWidth: 0,
        ...(props.style || {}),
      }}
    />
  );
}

function Button({ children, variant = "primary", ...props }) {
  const s =
    variant === "primary"
      ? { bg: "#2563eb", fg: "#fff", bd: "#2563eb" }
      : { bg: "#fff", fg: "#111827", bd: "#d1d5db" };

  return (
    <button
      {...props}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${s.bd}`,
        background: props.disabled ? "#9ca3af" : s.bg,
        color: props.disabled ? "#f9fafb" : s.fg,
        fontWeight: 900,
        fontSize: 14,
        cursor: props.disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function CodeBlock({ children }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: 12,
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "#0b1020",
        color: "#e5e7eb",
        fontSize: 12,
        overflowX: "auto",
        lineHeight: 1.45,
        minWidth: 0,
      }}
    >
      {children}
    </pre>
  );
}

export default function App() {
  const [appId, setAppId] = useState("in.swiggy.android");
  const [locale] = useState("en-US"); // kept for schema consistency

  const [fieldType, setFieldType] = useState("phone");
  const [kind, setKind] = useState("PHONE_LONG");

  const mutationText = useMemo(() => generateMutation(kind), [kind]);

  // Goal -> testcase generation (Gemini)
  const [goal, setGoal] = useState(
    "Open Swiggy, go to Profile, tap Login, then enter the edge-case value into the phone number input field."
  );
  const [generatedTestcase, setGeneratedTestcase] = useState(null);

  // Fallback manual mode (still useful if you need it)
  const [enableTapAndInput, setEnableTapAndInput] = useState(false);
  const [tapX, setTapX] = useState("540");
  const [tapY, setTapY] = useState("900");

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

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [err, setErr] = useState("");
  const [runs, setRuns] = useState([]);
  const [generating, setGenerating] = useState(false);

  async function refreshRuns() {
    const r = await fetch("http://localhost:4545/runs");
    const j = await r.json();
    if (j.ok) setRuns(j.runs || []);
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
        body: JSON.stringify({
          goal,
          appId,
          mutationText,
        }),
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
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f7fb",
        padding: 24,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      }}
    >
      <div
        style={{ width: "100%", margin: "0 auto", display: "grid", gap: 16 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 22, fontWeight: 1000, color: "#111827" }}>
              Input Mutation Studio (Swiggy)
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.4 }}>
              Goal → testcase JSON (Gemini) → selector-based replay (UIAutomator
              dump) → crash evidence (logcat).
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge tone="blue">Target: {appId}</Badge>
            <Badge>Locale: en-US</Badge>
            <Badge tone={crashTone}>
              Crash:{" "}
              {runResult ? (runResult.crash?.crashed ? "YES" : "NO") : "—"}
            </Badge>
          </div>
        </div>

        <div
          style={{
            background: "#ecfeff",
            border: "1px solid #a5f3fc",
            padding: 12,
            borderRadius: 12,
            color: "#155e75",
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          <b>Gemini mode:</b> Use Goal → Generate testcase. The runner will use
          UIAutomator dumps to locate elements by text/resource-id (no X/Y
          needed).
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 16,
          }}
        >
          <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
            <Card title="Configuration">
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div
                    style={{ fontSize: 12, fontWeight: 900, color: "#374151" }}
                  >
                    App package
                  </div>
                  <Input
                    value={appId}
                    style={{ width: "96%" }}
                    onChange={(e) => setAppId(e.target.value)}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        color: "#374151",
                      }}
                    >
                      Field type
                    </div>
                    <Select
                      value={fieldType}
                      onChange={(e) => setFieldType(e.target.value)}
                    >
                      <option value="phone">phone</option>
                      <option value="text">text</option>
                    </Select>
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        color: "#374151",
                      }}
                    >
                      Mutation type
                    </div>
                    <Select
                      value={kind}
                      onChange={(e) => setKind(e.target.value)}
                    >
                      <option value="PHONE_LONG">
                        phone: very long digits
                      </option>
                      <option value="PHONE_MIXED">phone: mixed chars</option>
                      <option value="TEXT_EXPANSION">text: expansion</option>
                      <option value="SYMBOL_STRESS">text: symbol stress</option>
                    </Select>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div
                    style={{ fontSize: 12, fontWeight: 900, color: "#374151" }}
                  >
                    Generated mutation
                  </div>
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "#f9fafb",
                      padding: 12,
                      fontSize: 13,
                      color: "#111827",
                      lineHeight: 1.4,
                      wordBreak: "break-word",
                    }}
                  >
                    {mutationText}
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Goal → Generate testcase">
              <div style={{ display: "grid", gap: 10 }}>
                <div
                  style={{ fontSize: 12, fontWeight: 900, color: "#374151" }}
                >
                  Goal (natural language)
                </div>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  rows={4}
                  style={{
                    width: "96%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    resize: "vertical",
                  }}
                />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button onClick={generateFromGoal} disabled={generating}>
                    {generating
                      ? "Generating..."
                      : "Generate testcase (Gemini)"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setGeneratedTestcase(null)}
                    disabled={!generatedTestcase}
                  >
                    Use manual testcase
                  </Button>
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Tip: keep goals specific: “Profile → Login → enter value in
                  phone input”.
                </div>
              </div>
            </Card>

            <Card title="Run">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button
                  variant="secondary"
                  onClick={() =>
                    downloadJson("testcase.json", effectiveTestcase)
                  }
                >
                  Download testcase.json
                </Button>
                <Button onClick={run} disabled={running}>
                  {running ? "Running..." : "Run on emulator"}
                </Button>
                <Button variant="secondary" onClick={refreshRuns}>
                  Refresh runs
                </Button>
              </div>

              {err ? (
                <div
                  style={{
                    marginTop: 12,
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    padding: 12,
                    borderRadius: 12,
                    color: "#991b1b",
                    whiteSpace: "pre-wrap",
                    fontSize: 13,
                  }}
                >
                  <b>Error</b>
                  <div style={{ marginTop: 6 }}>{err}</div>
                </div>
              ) : null}

              {runResult ? (
                <div
                  style={{
                    marginTop: 12,
                    background: runResult.crash?.crashed
                      ? "#fef2f2"
                      : "#ecfdf5",
                    border: `1px solid ${
                      runResult.crash?.crashed ? "#fecaca" : "#a7f3d0"
                    }`,
                    padding: 12,
                    borderRadius: 12,
                    color: runResult.crash?.crashed ? "#991b1b" : "#065f46",
                    fontSize: 13,
                    lineHeight: 1.4,
                  }}
                >
                  <b>Run OK</b>
                  <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                    <div>Crash: {runResult.crash?.crashed ? "YES" : "NO"}</div>
                    <div>
                      Signals:{" "}
                      {[
                        runResult.crash?.fatal ? "FATAL" : null,
                        runResult.crash?.anr ? "ANR" : null,
                        runResult.crash?.processDied ? "PROCESS_DIED" : null,
                      ]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </div>
                    <div>Run ID: {runResult.runId}</div>
                    <div>Artifacts: {runResult.outDir}</div>
                    <div>
                      Screenshots:{" "}
                      {runResult.screenshots?.join(", ") || "(none)"}
                    </div>
                  </div>
                </div>
              ) : null}
            </Card>

            <Card title="Recent runs (last 10)">
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "220px 110px 1fr",
                    background: "#f9fafb",
                    padding: 10,
                    fontWeight: 900,
                    fontSize: 12,
                  }}
                >
                  <div>Run</div>
                  <div>Crash</div>
                  <div>Meta</div>
                </div>
                {runs.slice(0, 10).map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "220px 110px 1fr",
                      padding: 10,
                      borderTop: "1px solid #eef2f7",
                      fontSize: 12,
                      gap: 8,
                    }}
                  >
                    <div style={{ fontFamily: "monospace" }}>{r.id}</div>
                    <div
                      style={{
                        fontWeight: 900,
                        color: r.crash?.crashed ? "#b91c1c" : "#047857",
                      }}
                    >
                      {r.crash?.crashed ? "YES" : "NO"}
                    </div>
                    <div style={{ color: "#374151" }}>
                      {r.meta
                        ? `${r.meta.generator || ""} • ${String(
                            r.meta.goal || ""
                          ).slice(0, 70)}`
                        : "(no meta)"}
                    </div>
                  </div>
                ))}
                {runs.length === 0 ? (
                  <div style={{ padding: 10, fontSize: 12, color: "#6b7280" }}>
                    No runs yet. Click “Run on emulator”.
                  </div>
                ) : null}
              </div>
            </Card>
          </div>

          <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
            <Card
              title="Effective testcase preview"
              right={
                generatedTestcase ? (
                  <Badge tone="blue">Gemini generated</Badge>
                ) : (
                  <Badge>Manual</Badge>
                )
              }
            >
              <CodeBlock>
                {JSON.stringify(effectiveTestcase, null, 2)}
              </CodeBlock>
            </Card>

            <Card title="Manual fallback (optional)">
              <label
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  fontSize: 13,
                  fontWeight: 900,
                  color: "#374151",
                }}
              >
                <input
                  type="checkbox"
                  checked={enableTapAndInput}
                  onChange={(e) => setEnableTapAndInput(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                Enable manual TAP+INPUT (X/Y)
              </label>

              {enableTapAndInput ? (
                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        color: "#374151",
                      }}
                    >
                      Tap X
                    </div>
                    <Input
                      value={tapX}
                      onChange={(e) => setTapX(e.target.value)}
                    />
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        color: "#374151",
                      }}
                    >
                      Tap Y
                    </div>
                    <Input
                      value={tapY}
                      onChange={(e) => setTapY(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                  Prefer Gemini mode unless Swiggy UI labels change and
                  selectors fail.
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

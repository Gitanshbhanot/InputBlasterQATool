// EdgeCaseReviewModal.jsx
// CRA-compatible JavaScript (no TypeScript)

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  IconButton,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useTheme } from "@mui/material/styles";
import { motion, AnimatePresence } from "framer-motion";
import ReactDiffViewer from "react-diff-viewer-continued";
import Lottie from "lottie-react";
import loadingAnim from "./lottie/loading-spinner.json";
import successAnim from "./lottie/success-check.json";
import rejectAnim from "./lottie/reject-cross.json";
import celebrateAnim from "./lottie/celebrate.json";

const DUMMY_FILES = [
  {
    fileName: "login_smoke_01.txt",
    originalSteps: [
      "Open Swiggy app",
      "Tap on login button",
      "Enter username: standardUser",
      "Enter password: standardPass",
      "Tap Continue",
      "Verify home screen is displayed",
    ],
    aiSteps: [
      "Open Swiggy app",
      "Tap on login button",
      "Enter username: veryLongUsername_1234567890!@#$%^&*()_+",
      "Enter password: (empty)",
      "Tap Continue",
      "Verify error message is displayed for invalid credentials",
    ],
  },
  {
    fileName: "signup_flow_02.txt",
    originalSteps: [
      "Open Swiggy app",
      "Tap on signup",
      "Enter phone: 9999999999",
      "Enter email: user@example.com",
      "Tap Verify OTP",
      "Enter OTP: 123456",
      "Tap Continue",
    ],
    aiSteps: [
      "Open Swiggy app",
      "Tap on signup",
      "Enter phone: 0000000000",
      "Enter email: user+alias..dot@example..com",
      "Tap Verify OTP",
      "Enter OTP: 000000",
      "Tap Continue",
    ],
  },
  {
    fileName: "address_add_03.txt",
    originalSteps: [
      "Navigate to Profile",
      "Tap Addresses",
      "Tap Add New",
      "Enter pincode: 560001",
      "Enter house number: 12",
      "Enter landmark: near park",
      "Tap Save",
    ],
    aiSteps: [
      "Navigate to Profile",
      "Tap Addresses",
      "Tap Add New",
      "Enter pincode: 999999",
      "Enter house number: 000000000000000000000000000000000000",
      "Enter landmark: (emoji) 🏁🏁🏁",
      "Tap Save",
    ],
  },
  {
    fileName: "search_restaurant_04.txt",
    originalSteps: [
      "Open Swiggy app",
      "Tap search",
      "Enter query: pizza",
      "Tap first result",
      "Verify restaurant page loads",
    ],
    aiSteps: [
      "Open Swiggy app",
      "Tap search",
      "Enter query: pizza' OR '1'='1",
      "Tap first result",
      "Verify restaurant page loads or shows safe no-results handling",
    ],
  },
  {
    fileName: "add_to_cart_05.txt",
    originalSteps: [
      "Open restaurant page",
      "Select item: Margherita",
      "Add quantity: 1",
      "Tap Add to cart",
      "Verify cart count is 1",
    ],
    aiSteps: [
      "Open restaurant page",
      "Select item: Margherita",
      "Add quantity: 999",
      "Tap Add to cart",
      "Verify quantity limit / validation is shown",
    ],
  },
  {
    fileName: "apply_coupon_06.txt",
    originalSteps: [
      "Open cart",
      "Tap Apply Coupon",
      "Enter coupon: NEWUSER50",
      "Tap Apply",
      "Verify discount is applied",
    ],
    aiSteps: [
      "Open cart",
      "Tap Apply Coupon",
      "Enter coupon: NEWUSER50\nDROP TABLE coupons; --",
      "Tap Apply",
      "Verify coupon input is sanitized and error is handled safely",
    ],
  },
  {
    fileName: "payment_upi_07.txt",
    originalSteps: [
      "Proceed to checkout",
      "Select payment method: UPI",
      "Enter UPI ID: user@upi",
      "Tap Pay",
      "Verify payment success screen",
    ],
    aiSteps: [
      "Proceed to checkout",
      "Select payment method: UPI",
      "Enter UPI ID: user@@upi",
      "Tap Pay",
      "Verify invalid UPI validation message",
    ],
  },
  {
    fileName: "rating_feedback_08.txt",
    originalSteps: [
      "Open order history",
      "Select last order",
      "Tap Rate Order",
      "Enter feedback: Good",
      "Tap Submit",
    ],
    aiSteps: [
      "Open order history",
      "Select last order",
      "Tap Rate Order",
      "Enter feedback: " + "A".repeat(300),
      "Tap Submit",
    ],
  },
  {
    fileName: "profile_update_09.txt",
    originalSteps: [
      "Open Profile",
      "Tap Edit",
      "Enter name: Rahul",
      "Enter email: rahul@example.com",
      "Tap Save",
    ],
    aiSteps: [
      "Open Profile",
      "Tap Edit",
      "Enter name: 𝓡𝓪𝓱𝓾𝓵<script>alert(1)</script>",
      "Enter email: rahul@",
      "Tap Save",
    ],
  },
  {
    fileName: "logout_10.txt",
    originalSteps: [
      "Open Profile",
      "Scroll down",
      "Tap Logout",
      "Confirm Logout",
    ],
    aiSteps: ["Open Profile", "Scroll down", "Tap Logout", "Confirm Logout"],
  },
];

function joinSteps(steps) {
  return (steps || []).join("\n");
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export default function EdgeCaseReviewModal({
  open,
  onClose,
  autoCloseMs = 3500,
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("md"));

  const [files, setFiles] = useState(DUMMY_FILES);
  const [index, setIndex] = useState(0);
  const [view, setView] = useState("git");

  const [phase, setPhase] = useState("review"); // review | decisionAnim | loadingNext | complete
  const [decision, setDecision] = useState(null); // accept | reject | null

  const timeoutsRef = useRef([]);

  const hasFiles = files && files.length > 0;
  const total = files.length;
  const current = hasFiles ? files[clamp(index, 0, total - 1)] : null;

  const progressValue = useMemo(() => {
    if (!hasFiles) return 0;
    return Math.round(((index + (phase === "complete" ? 1 : 0)) / total) * 100);
  }, [hasFiles, index, total, phase]);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setFiles(DUMMY_FILES);
    setIndex(0);
    setView("git");
    setPhase("review");
    setDecision(null);

    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => window.clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, []);

  // Auto-close after completion
  useEffect(() => {
    if (!open) return;
    if (phase !== "complete") return;

    const t = window.setTimeout(() => {
      onClose && onClose();
    }, autoCloseMs);

    timeoutsRef.current.push(t);
  }, [phase, open, onClose, autoCloseMs]);

  const nextFile = () => {
    const next = index + 1;
    if (next >= total) {
      setPhase("complete");
      setDecision(null);
      return;
    }
    setIndex(next);
    setPhase("review");
    setDecision(null);
  };

  const simulateDecision = (kind) => {
    if (!current) return;
    if (phase !== "review") return;

    setDecision(kind);
    setPhase("decisionAnim");

    // simulate apply/discard
    if (kind === "accept") {
      setFiles((prev) => {
        const copy = [...prev];
        const item = copy[index];
        copy[index] = { ...item, originalSteps: item.aiSteps };
        return copy;
      });
    }

    const t1 = window.setTimeout(() => {
      setPhase("loadingNext");
      const t2 = window.setTimeout(() => {
        nextFile();
      }, 1200);
      timeoutsRef.current.push(t2);
    }, 700);

    timeoutsRef.current.push(t1);
  };

  const handleClose = () => {
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];
    onClose && onClose();
  };

  const tabs = useMemo(
    () => [
      { title: "Git-style Diff", value: "git", content: null },
      { title: "Side-by-Side", value: "sideBySide", content: null },
      { title: "Cursor View", value: "cursor", content: null },
    ],
    []
  );

  const diffOld = current ? joinSteps(current.originalSteps) : "";
  const diffNew = current ? joinSteps(current.aiSteps) : "";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen={fullScreen}
      maxWidth="lg"
      fullWidth
      aria-labelledby="edgecase-review-title"
      aria-describedby="edgecase-review-description"
      PaperProps={{
        className:
          "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-[32px] overflow-hidden",
        style: {
          borderRadius: "32px",
          boxShadow: "none", // Using tailwind shadow instead to avoid MUI conflict
        },
      }}
      sx={{
        "& .MuiDialog-paper": {
          borderRadius: "32px",
        },
      }}
    >
      {/* Header Section */}
      <div className="relative px-6 py-6 border-b border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              Edge-case Review
            </h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              {hasFiles && phase !== "complete" ? (
                <>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                    {index + 1} of {total}
                  </span>
                  <span className="truncate max-w-[200px] sm:max-w-md font-medium text-slate-700 dark:text-slate-200">
                    {current?.fileName}
                  </span>
                </>
              ) : hasFiles && phase === "complete" ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium">
                  Review Complete
                </span>
              ) : (
                <span>No files to review</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end gap-1.5 w-48">
              <div className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <span>Overall Progress</span>
                <span>{progressValue}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressValue}%` }}
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                />
              </div>
            </div>

            <Tooltip title="Close" arrow>
              <IconButton
                aria-label="Close modal"
                onClick={handleClose}
                size="small"
                color="info"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      </div>

      <DialogContent
        id="edgecase-review-description"
        className="p-0 overflow-hidden"
      >
        <div className="max-h-[70vh] overflow-y-auto">
          {!hasFiles ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-48 h-48 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6">
                <Lottie animationData={loadingAnim} className="w-32" loop />
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-medium">
                No test files found.
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                Provide files to start an edge-case review.
              </p>
            </div>
          ) : phase === "complete" ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-64 mb-4">
                <Lottie animationData={celebrateAnim} loop={false} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                All done!
              </h3>
              <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                Your test files have been successfully updated with AI-generated
                edge cases.
              </p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8"
              >
                <button
                  onClick={handleClose}
                  className="px-8 py-3 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all active:scale-[0.98]"
                >
                  Close Review
                </button>
              </motion.div>
            </div>
          ) : (
            <div className="p-6">
              {/* Tab Switcher */}
              <div className="flex items-center justify-center mb-6">
                <div className="p-1 bg-slate-100 dark:bg-slate-900 rounded-xl flex gap-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => setView(tab.value)}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                        view === tab.value
                          ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm"
                          : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      {tab.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${index}-${view}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-950">
                      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            Diff Comparison
                          </span>
                        </div>

                        <AnimatePresence>
                          {phase === "decisionAnim" && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex items-center gap-1.5"
                            >
                              <div className="w-6 h-6">
                                <Lottie
                                  animationData={
                                    decision === "accept"
                                      ? successAnim
                                      : rejectAnim
                                  }
                                  loop={false}
                                />
                              </div>
                              <span
                                className={`text-[10px] font-bold uppercase ${
                                  decision === "accept"
                                    ? "text-green-500"
                                    : "text-red-500"
                                }`}
                              >
                                {decision === "accept"
                                  ? "Accepted"
                                  : "Rejected"}
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="relative min-h-[300px]">
                        {phase === "loadingNext" && (
                          <div className="absolute inset-0 z-10 backdrop-blur-sm bg-white/40 dark:bg-slate-950/40 flex flex-col items-center justify-center">
                            <Lottie
                              animationData={loadingAnim}
                              className="w-20"
                            />
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 transition-all">
                              Generating variations for next file...
                            </p>
                          </div>
                        )}

                        <div
                          className={
                            phase === "loadingNext"
                              ? "opacity-50 blur-[1px] transition-all"
                              : ""
                          }
                        >
                          {view === "cursor" ? (
                            <CursorView
                              originalSteps={current?.originalSteps || []}
                              aiSteps={current?.aiSteps || []}
                            />
                          ) : (
                            <div className="react-diff-custom border-none">
                              <ReactDiffViewer
                                oldValue={diffOld}
                                newValue={diffNew}
                                splitView={view === "sideBySide"}
                                showDiffOnly={false}
                                useDarkTheme={theme.palette.mode === "dark"}
                                styles={{
                                  variables: {
                                    dark: {
                                      diffViewerBackground: "#020617",
                                      diffViewerColor: "#cbd5e1",
                                      addedBackground: "rgba(34,197,94,0.15)",
                                      addedColor: "#cbd5e1",
                                      removedBackground: "rgba(239,68,68,0.15)",
                                      removedColor: "#cbd5e1",
                                      wordAddedBackground:
                                        "rgba(34,197,94,0.25)",
                                      wordRemovedBackground:
                                        "rgba(239,68,68,0.25)",
                                      lineNumberColor: "#475569",
                                      lineNumberBackground: "transparent",
                                      gutterBackground: "transparent",
                                      gutterColor: "#475569",
                                    },
                                    light: {
                                      diffViewerBackground: "#ffffff",
                                      diffViewerColor: "#1e293b",
                                      addedBackground: "rgba(34,197,94,0.1)",
                                      addedColor: "#1e293b",
                                      removedBackground: "rgba(239,68,68,0.08)",
                                      removedColor: "#1e293b",
                                      wordAddedBackground:
                                        "rgba(34,197,94,0.2)",
                                      wordRemovedBackground:
                                        "rgba(239,68,68,0.15)",
                                      lineNumberColor: "#94a3b8",
                                      lineNumberBackground: "#f8fafc",
                                      gutterBackground: "#f8fafc",
                                      gutterColor: "#94a3b8",
                                    },
                                  },
                                  contentText: {
                                    fontSize: 13,
                                    lineHeight: 1.6,
                                    fontFamily: "Menlo, monospace",
                                  },
                                  codeFold: { display: "none" },
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
                <div className="text-blue-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                </div>
                <p className="text-[11px] text-blue-700 dark:text-blue-500 leading-snug">
                  <span className="font-bold">Pro Tip:</span> Accept will
                  replace the original steps with AI-suggested edge cases.
                  Reject will keep the original file content and move to the
                  next item.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {hasFiles && phase !== "complete" && (
        <div className="px-6 py-4 flex items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="hidden sm:block">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-white">
              Action Required
            </p>
            <p className="text-xs text-slate-500 dark:text-white">
              {phase === "loadingNext"
                ? "Preparing next item..."
                : "Decide for this file"}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => simulateDecision("reject")}
              disabled={phase !== "review"}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                phase !== "review"
                  ? "opacity-50 cursor-not-allowed border-slate-200 text-slate-400"
                  : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 active:scale-[0.98]"
              }`}
            >
              Reject AI
            </button>

            <button
              onClick={() => simulateDecision("accept")}
              disabled={phase !== "review"}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                phase !== "review"
                  ? "opacity-50 cursor-not-allowed bg-slate-200 text-slate-400"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98]"
              }`}
            >
              Accept Changes
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

// --------------------
// Cursor View (custom)
// --------------------
function CursorView({ originalSteps, aiSteps }) {
  const maxLines = Math.max(originalSteps.length, aiSteps.length);

  return (
    <div
      className="overflow-hidden bg-slate-50 dark:bg-slate-900/50"
      aria-label="Cursor-style view"
    >
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800">
          <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-100/50 dark:bg-slate-800/50">
            Original Steps
          </div>
          <div className="p-4 space-y-1.5 min-h-[300px]">
            {originalSteps.length > 0 ? (
              Array.from({ length: maxLines }).map((_, i) => {
                const line = originalSteps[i] || "";
                const changed = line !== (aiSteps[i] || "");
                return (
                  <div
                    key={`o-${i}`}
                    className={`group flex items-start gap-3 rounded-lg px-3 py-2 text-xs font-mono transition-colors ${
                      changed
                        ? "bg-red-500/10 text-slate-800 dark:text-slate-200"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <span className="select-none text-[10px] font-bold opacity-30 w-5 text-right mt-0.5">
                      {i + 1}
                    </span>
                    <span className="break-words">
                      {line || (
                        <span className="opacity-20 italic">
                          No corresponding step
                        </span>
                      )}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex h-full items-center justify-center py-12 text-slate-400 italic text-xs">
                No steps found
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/30 dark:bg-slate-950/30">
          <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-blue-500 bg-blue-500/5 dark:bg-blue-500/10">
            AI Improved Version
          </div>
          <div className="p-4 space-y-1.5 min-h-[300px]">
            {aiSteps.length > 0 ? (
              Array.from({ length: maxLines }).map((_, i) => {
                const line = aiSteps[i] || "";
                const changed = line !== (originalSteps[i] || "");
                return (
                  <div
                    key={`a-${i}`}
                    className={`group flex items-start gap-3 rounded-lg px-3 py-2 text-xs font-mono transition-colors ${
                      changed
                        ? "bg-green-500/10 text-slate-900 dark:text-slate-50 font-medium"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <span className="select-none text-[10px] font-bold opacity-30 w-5 text-right mt-0.5">
                      {i + 1}
                    </span>
                    <span className="break-words">
                      {line || (
                        <span className="opacity-20 italic">Step removed</span>
                      )}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex h-full items-center justify-center py-12 text-slate-400 italic text-xs">
                No AI suggestions
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { peggyApi } from "@/lib/api";
import { SetupShell } from "@/components/setup/SetupShell";
import { StatusChip, type StatusChipTone } from "@/components/StatusChip";
import { monoSx, peggyColors } from "@/theme/peggyTheme";

type Check = { id: string; label: string; status: string; detail: string; fixCommand: string };

function displayLabel(check: Check) {
  if (check.id === "qdrant") return "Qdrant";
  if (check.id === "ollama") return "Ollama";
  if (check.id === "embeddings") return "Embeddings";
  if (check.id === "db_schema") return "Database";
  return check.label;
}

function statusMeta(check: Check): { label: string; tone: StatusChipTone; marker: string; solid?: boolean } {
  const s = (check.status || "").toLowerCase();
  if (s === "ok") {
    const label = check.id === "qdrant" || check.id === "ollama" ? "Running" : check.id === "embeddings" ? "Ready" : "Checked";
    return { label, tone: "accent", marker: peggyColors.accent };
  }
  if (s === "skip") return { label: "Skipped", tone: "neutral", marker: peggyColors.muted };
  if (check.id === "llm_configured" || check.id === "llm_reachable") {
    return { label: "Missing", tone: "warning", marker: peggyColors.warning, solid: true };
  }
  return { label: "Not running", tone: "destructive", marker: peggyColors.destructive, solid: true };
}

function overallCopy(checks: Check[]) {
  const problems = checks.filter((c) => {
    const s = (c.status || "").toLowerCase();
    return s !== "ok" && s !== "skip";
  });
  const ready = checks.filter((c) => (c.status || "").toLowerCase() === "ok").length;
  if (problems.length === 0) {
    return {
      chip: "Ready",
      tone: "accent" as const,
      title: "Peggy can search and answer",
      body: "These checks passed for the current backend environment.",
    };
  }
  const names = problems.map((c) => displayLabel(c)).join(" and ");
  return {
    chip: "Needs attention",
    tone: "destructive" as const,
    title: "Peggy can't search or answer yet",
    body: `${names}. Fix the items below, then recheck. Your data has not been touched.`,
  };
}

export default function SetupChecksPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["setup-checks"],
    queryFn: () => peggyApi.getSetupChecks(),
  });

  const checks = data?.checks ?? [];
  const readyCount = checks.filter((c) => (c.status || "").toLowerCase() === "ok").length;
  const summary = overallCopy(checks);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const copyReport = () => {
    const lines = checks.map((c) => `${displayLabel(c)}: ${c.status} — ${c.detail || "—"}${c.fixCommand ? `\n  ${c.fixCommand}` : ""}`);
    void copyText(`Peggy setup check\n${lines.join("\n")}`);
  };

  return (
    <SetupShell
      eyebrow="SETUP"
      title="Setup check"
      subtitle="Peggy runs on your computer. Fix anything marked red or amber, then recheck."
      backHref="/setup"
    >
      {isLoading ? (
        <Box sx={{ display: "grid", placeItems: "center", minHeight: 240 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">Could not load checks. Make sure the API is running and reachable.</Alert>
      ) : (
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <StatusChip
              tone={summary.tone}
              label={summary.chip}
              sx={
                summary.tone === "destructive"
                  ? { bgcolor: peggyColors.destructive, color: peggyColors.primaryForeground, borderColor: "transparent" }
                  : undefined
              }
            />
            <Typography variant="h6" sx={{ mt: 1.5 }}>
              {summary.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2, lineHeight: 1.6 }}>
              {summary.body}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={() => void refetch()} sx={{ textTransform: "none" }}>
                {isFetching ? <CircularProgress size={22} color="inherit" /> : "Recheck"}
              </Button>
              <Button variant="text" onClick={copyReport} sx={{ textTransform: "none", color: peggyColors.accent }}>
                Copy report
              </Button>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent, mb: 1 }}>
              {checks.length} CHECKS, {readyCount} READY
            </Typography>
            {checks.map((c) => {
              const meta = statusMeta(c);
              const showFix = !!(c.fixCommand && (c.status || "").toLowerCase() !== "ok" && (c.status || "").toLowerCase() !== "skip");
              return (
                <Box key={c.id}>
                  <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    sx={{ py: 1, px: 1, borderBottom: `0.5px solid ${peggyColors.border}` }}
                  >
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: "999px",
                        bgcolor: meta.marker,
                        border: `0.5px solid ${peggyColors.border}`,
                        flexShrink: 0,
                      }}
                    />
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={500}>{displayLabel(c)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {c.detail && c.detail !== "ok" ? c.detail : "Ready."}
                      </Typography>
                    </Stack>
                    <StatusChip
                      tone={meta.tone}
                      label={meta.label}
                      sx={
                        meta.solid
                          ? meta.tone === "destructive"
                            ? { bgcolor: peggyColors.destructive, color: peggyColors.primaryForeground, borderColor: "transparent" }
                            : { bgcolor: peggyColors.warning, color: peggyColors.foreground, borderColor: "transparent" }
                          : undefined
                      }
                    />
                  </Stack>
                  {showFix && (
                    <Stack spacing={0.5} sx={{ pl: 4.5, pb: 1, pt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Run this in a terminal from the Peggy folder:
                      </Typography>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        sx={{
                          bgcolor: peggyColors.muted,
                          border: `0.5px solid ${peggyColors.border}`,
                          borderRadius: 1,
                          pl: 2,
                          pr: 1,
                          py: 0.5,
                        }}
                      >
                        <Typography sx={{ ...monoSx, fontSize: 11, flex: 1, minWidth: 0 }}>
                          {c.fixCommand}
                        </Typography>
                        <Button
                          variant="text"
                          onClick={() => void copyText(c.fixCommand)}
                          sx={{ textTransform: "none", color: peggyColors.accent, flexShrink: 0 }}
                        >
                          Copy
                        </Button>
                      </Stack>
                    </Stack>
                  )}
                </Box>
              );
            })}
          </Paper>

          <Typography variant="caption" color="text.secondary">
            Still stuck? See docs/LOCAL.md in the Peggy folder. Nothing on this page is sent anywhere.
          </Typography>
        </Stack>
      )}
    </SetupShell>
  );
}

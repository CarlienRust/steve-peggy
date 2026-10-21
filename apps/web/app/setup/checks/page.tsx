"use client";

import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useQuery } from "@tanstack/react-query";
import { peggyApi } from "@/lib/api";
import { SetupShell } from "@/components/setup/SetupShell";
import { monoSx } from "@/theme/peggyTheme";

function CheckStatus({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const color =
    s === "ok" ? "success.main" : s === "error" ? "error.main" : s === "skip" ? "text.secondary" : "warning.main";
  const label = s || "unknown";
  return (
    <Typography variant="caption" sx={{ color, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {label}
    </Typography>
  );
}

export default function SetupChecksPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["setup-checks"],
    queryFn: () => peggyApi.getSetupChecks(),
  });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <SetupShell
      title="System checks"
      subtitle="These checks map to the current backend environment and include fix commands you can copy."
      backHref="/setup"
    >
      {isLoading ? (
        <Box sx={{ display: "grid", placeItems: "center", minHeight: 240 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">Could not load checks. Make sure the API is running and reachable.</Alert>
      ) : (
        <Stack spacing={2}>
          {(data?.checks ?? []).map((c) => (
            <Paper key={c.id} variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                  <Typography fontWeight={600}>{c.label}</Typography>
                  <CheckStatus status={c.status} />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {c.detail || "—"}
                </Typography>
                {c.fixCommand ? (
                  <Stack spacing={1} sx={{ pt: 0.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2">Fix command</Typography>
                      <Button
                        size="small"
                        startIcon={<ContentCopyIcon />}
                        onClick={() => void copy(c.fixCommand)}
                        sx={{ textTransform: "none" }}
                      >
                        Copy
                      </Button>
                    </Stack>
                    <Box
                      component="pre"
                      sx={{
                        ...monoSx,
                        m: 0,
                        p: 1.5,
                        bgcolor: "action.hover",
                        borderRadius: 1,
                        fontSize: 12,
                        overflow: "auto",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {c.fixCommand}
                    </Box>
                  </Stack>
                ) : null}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </SetupShell>
  );
}


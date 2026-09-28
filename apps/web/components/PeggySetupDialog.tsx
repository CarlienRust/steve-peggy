"use client";

import { useMemo, useState } from "react";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link as MuiLink,
  Stack,
  Typography,
} from "@mui/material";
import { monoSx } from "@/theme/peggyTheme";

const REPO_URL = "https://github.com/CarlienRust/steve-peggy";
const LOCAL_DOCS_URL = `${REPO_URL}/blob/main/docs/LOCAL.md`;

const ONE_TIME_COMMANDS = `chmod +x scripts/*.sh
./scripts/setup-local.sh
./scripts/install-qdrant.sh
ollama pull llama3.2`;

const DAILY_COMMANDS = `./scripts/start-local.sh
cd apps/web && npm run dev`;

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function CommandBlock({ label, commands }: { label: string; commands: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(commands);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
        <Typography variant="subtitle2">{label}</Typography>
        <IconButton size="small" aria-label={`Copy ${label}`} onClick={copy}>
          <ContentCopyIcon fontSize="small" />
        </IconButton>
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
        {commands}
      </Box>
      {copied && (
        <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: "block" }}>
          Copied
        </Typography>
      )}
    </Box>
  );
}

type PeggySetupDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function PeggySetupDialog({ open, onClose }: PeggySetupDialogProps) {
  const hosted = useMemo(() => {
    if (typeof window === "undefined") return true;
    return !isLocalHost(window.location.hostname);
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Setup Peggy locally</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5}>
          {hosted ? (
            <>
              <Alert severity="info">
                You can sign in here, but Peggy runs on your machine. Clone the repo, run the commands below, then open{" "}
                <strong>http://localhost:3000</strong>.
              </Alert>
              <Typography variant="body2" color="text.secondary">
                Clone the repository into a local folder (not iCloud if you can avoid it):
              </Typography>
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
                }}
              >
                git clone {REPO_URL}.git{"\n"}cd steve-peggy
              </Box>
              <CommandBlock label="One-time setup" commands={ONE_TIME_COMMANDS} />
            </>
          ) : (
            <>
              <Alert severity="success">You are on localhost. Start the local stack with the commands below.</Alert>
              <Typography variant="body2" color="text.secondary">
                Run these from the repo root (where <code>scripts/</code> lives).
              </Typography>
            </>
          )}

          <CommandBlock label="Every time you work" commands={DAILY_COMMANDS} />

          <Typography variant="body2" color="text.secondary">
            Keep Ollama running (<code>ollama serve</code> or the menu bar app) so gap analysis and chat work.
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Full details:{" "}
            <MuiLink href={LOCAL_DOCS_URL} target="_blank" rel="noopener">
              LOCAL.md
            </MuiLink>
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

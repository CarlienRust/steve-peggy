"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ChoiceCard } from "@/components/ChoiceCard";
import { MfaSettingsBlock } from "@/components/MfaSettingsBlock";
import { TrainingOptOutTable } from "@/components/TrainingOptOutTable";
import { formatApiError, peggyApi, queryKeys } from "@/lib/api";
import { useAuthSession } from "@/lib/authContext";
import { useWorkspace } from "@/lib/workspaceContext";

type Provider = "gemini" | "claude" | "chatgpt" | "groq" | "openrouter";

function asMode(raw: string | undefined): "standard" | "strict" {
  if (raw === "strict" || raw === "local_only") return "strict";
  return "standard";
}

export function PeggyAiSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeWorkspace, refetch } = useWorkspace();
  const { userId } = useAuthSession();
  const qc = useQueryClient();
  const [privacy, setPrivacy] = useState<"standard" | "strict">("standard");
  const [provider, setProvider] = useState<Provider>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [cap, setCap] = useState("");
  const [ack, setAck] = useState(false);
  const [clearKey, setClearKey] = useState(false);

  const llmQuery = useQuery({
    queryKey: queryKeys.llmSettings(userId ?? undefined),
    queryFn: () => peggyApi.getLlmSettings(),
    enabled: open,
  });

  useEffect(() => {
    if (open) setPrivacy(asMode(activeWorkspace?.privacy_mode));
  }, [open, activeWorkspace?.privacy_mode]);

  useEffect(() => {
    if (!open || !llmQuery.data) return;
    setProvider((llmQuery.data.provider as Provider) || "gemini");
    setCap(llmQuery.data.daily_token_cap != null ? String(llmQuery.data.daily_token_cap) : "");
    setAck(Boolean(llmQuery.data.training_opt_out_acknowledged));
    setApiKey("");
    setClearKey(false);
  }, [open, llmQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (activeWorkspace) {
        await peggyApi.updateWorkspace(activeWorkspace.id, { privacy_mode: privacy });
      }
      const capNum = cap.trim() === "" ? null : Number(cap);
      await peggyApi.putLlmSettings({
        provider,
        api_key: clearKey ? "" : apiKey.trim() ? apiKey.trim() : undefined,
        clear_key: clearKey,
        daily_token_cap: capNum != null && Number.isFinite(capNum) ? capNum : cap.trim() === "" ? 0 : undefined,
        training_opt_out_acknowledged: ack,
      });
    },
    onSuccess: () => {
      refetch();
      if (userId) {
        void qc.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
        void qc.invalidateQueries({ queryKey: queryKeys.llmSettings(userId) });
      }
      onClose();
    },
  });

  const storedLast4 = llmQuery.data?.has_key ? llmQuery.data.key_last4 : null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Peggy AI settings</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {!activeWorkspace ? (
            <Alert severity="info">Open a project to set Strict or Standard.</Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                {activeWorkspace.title}. Default: Standard.
              </Typography>
              <ChoiceCard
                title="Standard (recommended)"
                description="Hosted AI on. Project text may leave Peggy. Turn off training in the provider account."
                selected={privacy === "standard"}
                onSelect={() => setPrivacy("standard")}
                tag={{ label: "Hosted AI", tone: "warning" }}
              />
              <ChoiceCard
                title="Strict (AI help off)"
                description="No hosted AI for this project. Search and records stay on."
                selected={privacy === "strict"}
                onSelect={() => setPrivacy("strict")}
                tag={{ label: "No project AI", tone: "neutral" }}
              />
            </>
          )}

          <Typography variant="subtitle2">Your model</Typography>
          <Typography variant="body2" color="text.secondary">
            Default: platform Gemini. Paste a key for another provider. Turn training off in that account. Gemini Keep Activity cannot be set here.
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel id="peggy-llm-provider">Provider</InputLabel>
            <Select
              labelId="peggy-llm-provider"
              label="Provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
            >
              <MenuItem value="gemini">Gemini (default)</MenuItem>
              <MenuItem value="claude">Claude</MenuItem>
              <MenuItem value="chatgpt">ChatGPT</MenuItem>
              <MenuItem value="groq">Groq</MenuItem>
              <MenuItem value="openrouter">OpenRouter</MenuItem>
            </Select>
          </FormControl>
          <TextField
            type="password"
            label={storedLast4 && !clearKey ? `API key (••••${storedLast4})` : "API key"}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setClearKey(false);
            }}
            size="small"
            autoComplete="off"
            helperText="Leave blank to keep the stored key."
          />
          {storedLast4 ? (
            <Button
              size="small"
              onClick={() => {
                setClearKey(true);
                setApiKey("");
                setProvider("gemini");
              }}
              sx={{ textTransform: "none", alignSelf: "flex-start" }}
            >
              Clear key (use platform Gemini)
            </Button>
          ) : null}
          <TextField
            label="Daily token cap (optional)"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            size="small"
            helperText={`Empty = platform cap (${llmQuery.data?.platform_token_cap ?? "—"}). Cannot raise above that.`}
          />
          {privacy === "standard" ? <TrainingOptOutTable /> : null}
          <FormControlLabel
            control={<Checkbox checked={ack} onChange={(e) => setAck(e.target.checked)} />}
            label="I have turned off provider training (or I accept the risk)."
          />
          <MfaSettingsBlock />
          {save.isError ? <Alert severity="error">{formatApiError(save.error)}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Close
        </Button>
        <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()} sx={{ textTransform: "none" }}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

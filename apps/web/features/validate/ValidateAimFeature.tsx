"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { peggyApi, formatApiError, queryKeys } from "@/lib/api";
import { SourceCards } from "@/components/SourceCards";
import { useAuthSession } from "@/lib/authContext";
import { normalizeObjectives } from "@/lib/objectives";
import { useWorkspace } from "@/lib/workspaceContext";

function BulletList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
        {title}
      </Typography>
      <List dense disablePadding>
        {items.map((item, index) => (
          <ListItem key={`${index}-${item.slice(0, 32)}`} disablePadding sx={{ py: 0.35, alignItems: "flex-start" }}>
            <ListItemText primary={item} primaryTypographyProps={{ variant: "body2" }} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

export function ValidateAimFeature() {
  const { activeWorkspace } = useWorkspace();
  const { userId } = useAuthSession();
  const queryClient = useQueryClient();

  const literature = useQuery({
    queryKey: queryKeys.corpus("literature"),
    queryFn: () => peggyApi.listCorpus("literature"),
    enabled: !!userId,
  });

  const historyQuery = useQuery({
    queryKey: ["validate-aim-history", activeWorkspace?.id],
    queryFn: () => peggyApi.validateAimHistory(activeWorkspace!.id),
    enabled: !!activeWorkspace?.id,
  });

  const aim = activeWorkspace?.aim?.trim() ?? "";
  const objectives = normalizeObjectives(activeWorkspace?.objectives).filter((o) => o.text.trim());
  const literatureCount = literature.data?.count ?? 0;

  const checklist = useMemo(
    () => [
      { ok: !!aim, label: aim ? "Aim is set" : "Aim is empty" },
      { ok: objectives.length > 0, label: objectives.length > 0 ? "Objectives listed" : "No objectives" },
      {
        ok: literatureCount > 0,
        label: literatureCount > 0 ? `${literatureCount} literature paper(s) ingested` : "No literature ingested yet",
      },
    ],
    [aim, objectives.length, literatureCount]
  );

  const canRun = (!!aim || objectives.length > 0) && literatureCount > 0 && !!activeWorkspace?.id;

  const check = useMutation({
    mutationFn: () => peggyApi.validateAim(activeWorkspace!.id),
    onSuccess: () => {
      if (activeWorkspace?.id) {
        void queryClient.invalidateQueries({ queryKey: ["validate-aim-history", activeWorkspace.id] });
      }
    },
  });

  const lastRunId = historyQuery.data?.[0]?.id;
  const lastRunQuery = useQuery({
    queryKey: ["validate-aim-run", lastRunId],
    queryFn: () => peggyApi.validateAimRun(lastRunId!),
    enabled: !!lastRunId && !check.isPending,
  });

  const display = check.data ?? (check.isIdle ? lastRunQuery.data : undefined);
  const body = display?.body as Record<string, unknown> | undefined;

  return (
    <Stack spacing={3}>
      {!activeWorkspace && (
        <Alert severity="info">Select a project to validate its aim and objectives.</Alert>
      )}

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Project aim
        </Typography>
        <Typography variant="body2" color={aim ? "text.primary" : "text.secondary"} sx={{ whiteSpace: "pre-wrap" }}>
          {aim || "Not set. Edit the project to add an aim."}
        </Typography>
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Objectives
        </Typography>
        {objectives.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            None listed.
          </Typography>
        ) : (
          <List dense disablePadding>
            {objectives.map((obj, index) => (
              <ListItem key={obj.id} disablePadding sx={{ py: 0.25 }}>
                <ListItemText
                  primary={`${index + 1}. ${obj.text}`}
                  primaryTypographyProps={{
                    variant: "body2",
                    sx: { textDecoration: obj.status === "done" ? "line-through" : "none" },
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Checklist
        </Typography>
        <List dense disablePadding>
          {checklist.map((item) => (
            <ListItem key={item.label} disablePadding sx={{ py: 0.35 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                {item.ok ? (
                  <CheckCircleOutlineIcon fontSize="small" color="success" />
                ) : (
                  <ErrorOutlineIcon fontSize="small" color="warning" />
                )}
              </ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ variant: "body2" }} />
            </ListItem>
          ))}
        </List>
      </Box>

      <Stack direction="row" spacing={1.5} alignItems="center">
        <Button
          variant="contained"
          disabled={!canRun || check.isPending}
          onClick={() => check.mutate()}
          sx={{ textTransform: "none" }}
        >
          {check.isPending ? <CircularProgress size={20} color="inherit" /> : "Check against literature"}
        </Button>
        {!canRun && (
          <Typography variant="caption" color="text.secondary">
            Add an aim or objectives and ingest literature first.
          </Typography>
        )}
      </Stack>

      {check.isError && <Alert severity="error">{formatApiError(check.error)}</Alert>}

      {display && body && (
        <Stack spacing={2}>
          {typeof body.summary === "string" && body.summary && (
            <Typography variant="body1">{body.summary}</Typography>
          )}
          <BulletList title="Wording issues" items={(body.wording_issues as string[]) ?? []} />
          <BulletList title="Supported by literature" items={(body.supported as string[]) ?? []} />
          <BulletList title="Not well supported" items={(body.not_supported as string[]) ?? []} />
          {display.limitations?.length > 0 && (
            <Alert severity="warning">
              {display.limitations.map((lim, i) => (
                <Typography key={i} variant="body2">
                  {lim}
                </Typography>
              ))}
            </Alert>
          )}
          {display.sources?.length > 0 && <SourceCards sources={display.sources} />}
        </Stack>
      )}
    </Stack>
  );
}

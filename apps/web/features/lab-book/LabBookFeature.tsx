"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";
import { formatApiError, peggyApi, queryKeys, type LabBookCategory, type LabBookEntry } from "@/lib/api";
import { useWorkspace } from "@/lib/workspaceContext";

const CATEGORIES: LabBookCategory[] = ["progress", "meeting", "idea", "methods", "other"];

export function LabBookFeature() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<LabBookCategory>("progress");
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<LabBookEntry | null>(null);

  const listQuery = useQuery({
    queryKey: queryKeys.labBook(workspaceId),
    queryFn: () => peggyApi.listLabBook(workspaceId!),
    enabled: !!workspaceId,
  });

  const createEntry = useMutation({
    mutationFn: () => peggyApi.createLabBookEntry(workspaceId!, { category, body }),
    onSuccess: () => {
      setBody("");
      void queryClient.invalidateQueries({ queryKey: queryKeys.labBook(workspaceId) });
    },
  });

  const updateEntry = useMutation({
    mutationFn: () =>
      peggyApi.updateLabBookEntry(workspaceId!, editing!.id, { category: editing!.category, body: editing!.body }),
    onSuccess: () => {
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.labBook(workspaceId) });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: (id: string) => peggyApi.deleteLabBookEntry(workspaceId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.labBook(workspaceId) }),
  });

  return (
    <>
      <PageHeader
        eyebrow="07 · Lab book"
        title="Lab book"
        description="Progress, meeting, idea, and methods notes for this project."
      />
      <PageSection>
        <Stack spacing={2}>
          {createEntry.isError ? <Alert severity="error">{formatApiError(createEntry.error)}</Alert> : null}
          {listQuery.isError ? <Alert severity="error">{formatApiError(listQuery.error)}</Alert> : null}
          <FormControl size="small" sx={{ maxWidth: 240 }}>
            <InputLabel>Category</InputLabel>
            <Select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as LabBookCategory)}
            >
              {CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="New note"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
          <Button
            variant="contained"
            sx={{ alignSelf: "flex-start", textTransform: "none" }}
            disabled={!body.trim() || createEntry.isPending}
            onClick={() => createEntry.mutate()}
          >
            Add note
          </Button>
          <Stack spacing={1.5}>
            {(listQuery.data?.entries ?? []).map((entry) => (
              <Paper key={entry.id} variant="outlined" sx={{ p: 2 }}>
                {editing?.id === entry.id ? (
                  <Stack spacing={1}>
                    <FormControl size="small">
                      <InputLabel>Category</InputLabel>
                      <Select
                        label="Category"
                        value={editing.category}
                        onChange={(e) =>
                          setEditing({ ...editing, category: e.target.value as LabBookCategory })
                        }
                      >
                        {CATEGORIES.map((c) => (
                          <MenuItem key={c} value={c}>
                            {c}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      value={editing.body}
                      onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                      multiline
                      minRows={3}
                    />
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="contained" onClick={() => updateEntry.mutate()}>
                        Save
                      </Button>
                      <Button size="small" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <>
                    <Typography variant="caption" color="text.secondary">
                      {entry.category} · {entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>
                      {entry.body}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Button size="small" onClick={() => setEditing(entry)}>
                        Edit
                      </Button>
                      <Button size="small" color="warning" onClick={() => deleteEntry.mutate(entry.id)}>
                        Delete
                      </Button>
                    </Stack>
                  </>
                )}
              </Paper>
            ))}
            {(listQuery.data?.entries.length ?? 0) === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No lab book notes yet.
              </Typography>
            ) : null}
          </Stack>
        </Stack>
      </PageSection>
    </>
  );
}

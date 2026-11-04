"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { LocalDevBanner } from "@/components/LocalDevBanner";
import { formatApiError, peggyApi, queryKeys, type CalendarEvent, type CalendarEventKind } from "@/lib/api";
import { useAuthSession } from "@/lib/authContext";
import { eyebrowSx } from "@/theme/peggyTheme";

const KINDS: CalendarEventKind[] = [
  "deadline",
  "meeting",
  "check_in",
  "ethics_renewal",
  "conference",
  "grant",
  "step",
  "aim",
  "objective",
  "other",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string) {
  return new Date(value).toISOString();
}

function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number | null; date: Date | null }> = [];
  for (let i = 0; i < startPad; i += 1) cells.push({ day: null, date: null });
  for (let d = 1; d <= days; d += 1) cells.push({ day: d, date: new Date(year, month, d) });
  return cells;
}

function sameDay(iso: string, date: Date) {
  const d = new Date(iso);
  return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
}

type Draft = {
  title: string;
  kind: CalendarEventKind;
  starts_at: string;
  ends_at: string;
  notes: string;
  workspace_id: string;
};

const emptyDraft = (): Draft => ({
  title: "",
  kind: "deadline",
  starts_at: toLocalInput(new Date().toISOString()),
  ends_at: "",
  notes: "",
  workspace_id: "",
});

export function CalendarFeature() {
  const { ready, userId } = useAuthSession();
  const queryClient = useQueryClient();
  const [filterWs, setFilterWs] = useState("");
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fromProjectOpen, setFromProjectOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [projectId, setProjectId] = useState("");
  const [pickedDate, setPickedDate] = useState(toLocalInput(new Date().toISOString()).slice(0, 16));
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const workspacesQuery = useQuery({
    queryKey: queryKeys.workspaces(userId ?? undefined),
    queryFn: () => peggyApi.listWorkspaces(),
    enabled: ready && !!userId,
  });
  const eventsQuery = useQuery({
    queryKey: queryKeys.calendar(filterWs || undefined),
    queryFn: () => peggyApi.listCalendarEvents(filterWs || undefined),
    enabled: ready && !!userId,
  });
  const designQuery = useQuery({
    queryKey: ["study-design", projectId],
    queryFn: () => peggyApi.getStudyDesign(projectId),
    enabled: fromProjectOpen && !!projectId,
  });

  const saveEvent = useMutation({
    mutationFn: () =>
      peggyApi.createCalendarEvent({
        title: draft.title.trim(),
        kind: draft.kind,
        starts_at: fromLocalInput(draft.starts_at),
        ends_at: draft.ends_at ? fromLocalInput(draft.ends_at) : null,
        notes: draft.notes,
        workspace_id: draft.workspace_id || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setDialogOpen(false);
      setDraft(emptyDraft());
    },
  });

  const deleteEvent = useMutation({
    mutationFn: (id: string) => peggyApi.deleteCalendarEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar"] }),
  });

  const addFromProject = useMutation({
    mutationFn: async () => {
      const ws = workspacesQuery.data?.workspaces.find((w) => w.id === projectId);
      const sd = designQuery.data?.study_design;
      const starts = fromLocalInput(pickedDate);
      const jobs: Array<Promise<unknown>> = [];
      for (const key of selectedKeys) {
        if (key.startsWith("aim:")) {
          const aim = ws?.aims?.find((a) => a.id === key.slice(4));
          if (aim?.text) {
            jobs.push(
              peggyApi.createCalendarEvent({
                title: aim.text,
                kind: "aim",
                starts_at: starts,
                workspace_id: projectId,
                source_type: "aim",
                source_id: aim.id,
              })
            );
          }
        } else if (key.startsWith("obj:")) {
          const obj = ws?.objectives?.find((o) => o.id === key.slice(4));
          if (obj?.text) {
            jobs.push(
              peggyApi.createCalendarEvent({
                title: obj.text,
                kind: "objective",
                starts_at: starts,
                workspace_id: projectId,
                source_type: "objective",
                source_id: obj.id,
              })
            );
          }
        } else if (key.startsWith("step:")) {
          const steps = [...(sd?.methodsPlan?.steps ?? []), ...(sd?.analysisPlan?.steps ?? [])];
          const step = steps.find((s) => s.id === key.slice(5));
          if (step?.title) {
            jobs.push(
              peggyApi.createCalendarEvent({
                title: step.title,
                kind: "step",
                starts_at: starts,
                workspace_id: projectId,
                source_type: "plan_step",
                source_id: step.id,
              })
            );
          }
        } else if (key === "ethics") {
          const expiry = sd?.ethics?.expiryDate;
          if (expiry) {
            jobs.push(
              peggyApi.createCalendarEvent({
                title: "Ethics expiry",
                kind: "ethics_renewal",
                starts_at: new Date(`${expiry}T09:00:00`).toISOString(),
                workspace_id: projectId,
                source_type: "ethics",
                source_id: "expiryDate",
              })
            );
          }
        }
      }
      await Promise.all(jobs);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setFromProjectOpen(false);
      setSelectedKeys([]);
    },
  });

  const events = eventsQuery.data?.events ?? [];
  const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor]);
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const workspaces = workspacesQuery.data?.workspaces ?? [];
  const selectedWs = workspaces.find((w) => w.id === projectId);
  const steps = [
    ...(designQuery.data?.study_design.methodsPlan?.steps ?? []),
    ...(designQuery.data?.study_design.analysisPlan?.steps ?? []),
  ];
  const expiry = designQuery.data?.study_design.ethics?.expiryDate;

  return (
    <Box>
      <LocalDevBanner />
      <Typography sx={eyebrowSx}>HOME</Typography>
      <Typography variant="h4" fontWeight={600} sx={{ mb: 1 }}>
        Calendar
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
        Account-level dates. Link an event to a project if you want. Dates are only created when you pick them.
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Project</InputLabel>
          <Select
            label="Project"
            value={filterWs}
            onChange={(e) => setFilterWs(e.target.value)}
          >
            <MenuItem value="">All projects</MenuItem>
            {workspaces.map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {w.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <IconButton
          aria-label="Previous month"
          onClick={() =>
            setCursor((c) => ({ year: c.month === 0 ? c.year - 1 : c.year, month: c.month === 0 ? 11 : c.month - 1 }))
          }
        >
          <ChevronLeftIcon />
        </IconButton>
        <Typography sx={{ alignSelf: "center", minWidth: 140, textAlign: "center" }}>{monthLabel}</Typography>
        <IconButton
          aria-label="Next month"
          onClick={() =>
            setCursor((c) => ({ year: c.month === 11 ? c.year + 1 : c.year, month: c.month === 11 ? 0 : c.month + 1 }))
          }
        >
          <ChevronRightIcon />
        </IconButton>
        <Button
          variant="contained"
          onClick={() => {
            setDraft(emptyDraft());
            setDialogOpen(true);
          }}
        >
          Add event
        </Button>
        <Button variant="outlined" onClick={() => setFromProjectOpen(true)}>
          Add from this project
        </Button>
      </Stack>
      {eventsQuery.isError ? <Alert severity="error">{formatApiError(eventsQuery.error)}</Alert> : null}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 0.5,
          mb: 3,
        }}
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <Typography key={d} variant="caption" color="text.secondary">
            {d}
          </Typography>
        ))}
        {cells.map((cell, i) => (
          <Box
            key={i}
            sx={{
              minHeight: 72,
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              p: 0.5,
              bgcolor: cell.day ? "background.paper" : "action.hover",
            }}
          >
            {cell.day ? (
              <>
                <Typography variant="caption">{cell.day}</Typography>
                {cell.date
                  ? events
                      .filter((ev) => sameDay(ev.starts_at, cell.date as Date))
                      .slice(0, 3)
                      .map((ev) => (
                        <Typography key={ev.id} variant="caption" noWrap display="block">
                          {ev.title}
                        </Typography>
                      ))
                  : null}
              </>
            ) : null}
          </Box>
        ))}
      </Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Events this month
      </Typography>
      <Stack spacing={1}>
        {events
          .filter((ev) => {
            const d = new Date(ev.starts_at);
            return d.getFullYear() === cursor.year && d.getMonth() === cursor.month;
          })
          .map((ev: CalendarEvent) => (
            <Stack
              key={ev.id}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1 }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={600}>{ev.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {ev.kind} · {new Date(ev.starts_at).toLocaleString()}
                </Typography>
              </Box>
              <Button size="small" color="warning" onClick={() => deleteEvent.mutate(ev.id)}>
                Delete
              </Button>
            </Stack>
          ))}
        {events.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No events yet.
          </Typography>
        ) : null}
      </Stack>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add event</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} fullWidth />
            <FormControl fullWidth>
              <InputLabel>Kind</InputLabel>
              <Select
                label="Kind"
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as CalendarEventKind })}
              >
                {KINDS.map((k) => (
                  <MenuItem key={k} value={k}>
                    {k.replace(/_/g, " ")}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Starts"
              type="datetime-local"
              value={draft.starts_at}
              onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Ends"
              type="datetime-local"
              value={draft.ends_at}
              onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth>
              <InputLabel>Project</InputLabel>
              <Select
                label="Project"
                value={draft.workspace_id}
                onChange={(e) => setDraft({ ...draft, workspace_id: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {workspaces.map((w) => (
                  <MenuItem key={w.id} value={w.id}>
                    {w.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Notes"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              multiline
              minRows={2}
            />
            {saveEvent.isError ? <Alert severity="error">{formatApiError(saveEvent.error)}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!draft.title.trim() || saveEvent.isPending} onClick={() => saveEvent.mutate()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={fromProjectOpen} onClose={() => setFromProjectOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add from this project</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Project</InputLabel>
              <Select label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {workspaces.map((w) => (
                  <MenuItem key={w.id} value={w.id}>
                    {w.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Date for selected items"
              type="datetime-local"
              value={pickedDate}
              onChange={(e) => setPickedDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Aims, objectives, and steps use this date. Ethics uses the expiry date already on the project."
            />
            {selectedWs?.aims?.map((aim) => (
              <Stack key={aim.id} direction="row" alignItems="center">
                <Checkbox
                  checked={selectedKeys.includes(`aim:${aim.id}`)}
                  onChange={(e) =>
                    setSelectedKeys((keys) =>
                      e.target.checked ? [...keys, `aim:${aim.id}`] : keys.filter((k) => k !== `aim:${aim.id}`)
                    )
                  }
                />
                <Typography variant="body2">Aim: {aim.text || "(empty)"}</Typography>
              </Stack>
            ))}
            {selectedWs?.objectives?.map((obj) => (
              <Stack key={obj.id} direction="row" alignItems="center">
                <Checkbox
                  checked={selectedKeys.includes(`obj:${obj.id}`)}
                  onChange={(e) =>
                    setSelectedKeys((keys) =>
                      e.target.checked ? [...keys, `obj:${obj.id}`] : keys.filter((k) => k !== `obj:${obj.id}`)
                    )
                  }
                />
                <Typography variant="body2">Objective: {obj.text}</Typography>
              </Stack>
            ))}
            {steps.map((step) => (
              <Stack key={step.id} direction="row" alignItems="center">
                <Checkbox
                  checked={selectedKeys.includes(`step:${step.id}`)}
                  onChange={(e) =>
                    setSelectedKeys((keys) =>
                      e.target.checked ? [...keys, `step:${step.id}`] : keys.filter((k) => k !== `step:${step.id}`)
                    )
                  }
                />
                <Typography variant="body2">Step: {step.title}</Typography>
              </Stack>
            ))}
            {expiry ? (
              <Stack direction="row" alignItems="center">
                <Checkbox
                  checked={selectedKeys.includes("ethics")}
                  onChange={(e) =>
                    setSelectedKeys((keys) => (e.target.checked ? [...keys, "ethics"] : keys.filter((k) => k !== "ethics")))
                  }
                />
                <Typography variant="body2">Ethics expiry ({expiry})</Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No ethics expiry date on this project.
              </Typography>
            )}
            {addFromProject.isError ? <Alert severity="error">{formatApiError(addFromProject.error)}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFromProjectOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!projectId || selectedKeys.length === 0 || addFromProject.isPending}
            onClick={() => addFromProject.mutate()}
          >
            Create events
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

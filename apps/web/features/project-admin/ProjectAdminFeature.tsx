"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { InfoTip } from "@/components/InfoTip";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";
import { formatApiError, peggyApi, queryKeys, type PaperRecord } from "@/lib/api";
import type { ProjectAdminData, ProjectAdminGrant, ProjectAdminOutput } from "@/lib/studyDesign";
import { useWorkspace } from "@/lib/workspaceContext";

type DocField =
  | "mouPaperId"
  | "studentRegistrationPaperIds"
  | "dataTransferPaperIds"
  | "coInvestigatorPaperIds"
  | "fundingPaperIds";

function newId() {
  return crypto.randomUUID();
}

function emptyGrant(): ProjectAdminGrant {
  return { id: newId(), name: "", amount: "", awardedAt: "", notes: "" };
}

function emptyOutput(): ProjectAdminOutput {
  return { id: newId(), kind: "manuscript", title: "", date: "", venue: "", status: "" };
}

function idsFor(admin: ProjectAdminData, field: DocField): number[] {
  if (field === "mouPaperId") return admin.mouPaperId != null ? [admin.mouPaperId] : [];
  return admin[field] ?? [];
}

function papersFor(papers: PaperRecord[], ids: number[]) {
  const set = new Set(ids);
  return papers.filter((p) => p.id != null && set.has(p.id));
}

export function ProjectAdminFeature() {
  const { activeWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadField, setUploadField] = useState<DocField>("mouPaperId");
  const adminQuery = useQuery({
    queryKey: queryKeys.projectAdmin(activeWorkspace?.id),
    queryFn: () => peggyApi.getProjectAdmin(activeWorkspace!.id),
    enabled: !!activeWorkspace?.id,
  });
  const saved = adminQuery.data?.project_admin ?? {};
  const [draft, setDraft] = useState<ProjectAdminData | null>(null);
  const admin = draft ?? saved;
  const grants = admin.grants ?? [];
  const outputs = admin.outputs ?? [];

  const docsQuery = useQuery({
    queryKey: queryKeys.corpus("project_documents", activeWorkspace?.id),
    queryFn: () => peggyApi.listCorpus("project_documents", activeWorkspace?.id),
    enabled: !!activeWorkspace?.id,
  });
  const allDocs = docsQuery.data?.papers ?? [];

  const patch = (next: Partial<ProjectAdminData>) => {
    setDraft({ ...admin, ...next });
  };

  const persistAdmin = async (next: ProjectAdminData) => {
    const data = await peggyApi.putProjectAdmin(activeWorkspace!.id, next);
    queryClient.setQueryData(queryKeys.projectAdmin(activeWorkspace?.id), data);
    setDraft(null);
    return data;
  };

  const saveMut = useMutation({
    mutationFn: () => persistAdmin(admin),
  });

  const uploadMut = useMutation({
    mutationFn: async ({ file, field }: { file: File; field: DocField }) => {
      const res = await peggyApi.uploadDocument(file, {
        sourceType: "project_documents",
        title: file.name.replace(/\.pdf$/i, ""),
        workspaceId: activeWorkspace?.id,
      });
      if (res.status === "duplicate") throw new Error(res.message ?? "Already uploaded");
      const paperId = res.paper_id;
      if (paperId == null) return res;
      const next: ProjectAdminData = { ...admin };
      if (field === "mouPaperId") next.mouPaperId = paperId;
      else {
        const current = idsFor(admin, field);
        next[field] = current.includes(paperId) ? current : [...current, paperId];
      }
      await persistAdmin(next);
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.corpus("project_documents", activeWorkspace?.id),
      });
    },
  });

  const viewDoc = async (id: number) => {
    const file = await peggyApi.getPaperFile(id);
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const unlinkMut = useMutation({
    mutationFn: async ({ id, field }: { id: number; field: DocField }) => {
      const next: ProjectAdminData = { ...admin };
      if (field === "mouPaperId") next.mouPaperId = next.mouPaperId === id ? null : next.mouPaperId;
      else next[field] = idsFor(admin, field).filter((n) => n !== id);
      await persistAdmin(next);
      await peggyApi.deletePaper(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.corpus("project_documents", activeWorkspace?.id),
      });
    },
  });

  const pickFile = (field: DocField) => {
    setUploadField(field);
    fileRef.current?.click();
  };

  const renderDocs = (field: DocField) => {
    const rows = papersFor(allDocs, idsFor(admin, field));
    if (rows.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          No file uploaded.
        </Typography>
      );
    }
    return rows.map((p) =>
      p.id == null ? null : (
        <Paper key={p.id} variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ flex: 1 }}>
              {p.title || p.original_filename || "Document"}
            </Typography>
            <Button size="small" sx={{ textTransform: "none" }} onClick={() => void viewDoc(p.id!)}>
              View
            </Button>
            <Button
              size="small"
              color="warning"
              sx={{ textTransform: "none" }}
              onClick={() => unlinkMut.mutate({ id: p.id!, field })}
            >
              Remove
            </Button>
          </Stack>
        </Paper>
      )
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="02 · Project admin"
        title="Project admin"
        info="Registration, dates, grants, outputs, files."
      />
      <PageSection>
        <Stack spacing={2}>
          {saveMut.isError ? <Alert severity="error">{formatApiError(saveMut.error)}</Alert> : null}
          {uploadMut.isError ? <Alert severity="error">{formatApiError(uploadMut.error)}</Alert> : null}
          <TextField
            label="Student registration"
            value={admin.studentRegistration ?? ""}
            onChange={(e) => patch({ studentRegistration: e.target.value })}
            fullWidth
            InputProps={{
              endAdornment: <InfoTip title="Optional. Upload the PDF below." />,
            }}
          />
          <Button
            variant="outlined"
            sx={{ textTransform: "none", alignSelf: "flex-start" }}
            onClick={() => pickFile("studentRegistrationPaperIds")}
            disabled={uploadMut.isPending || !activeWorkspace}
          >
            Upload registration PDF
          </Button>
          {renderDocs("studentRegistrationPaperIds")}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Start date"
              type="date"
              value={admin.startDate ?? ""}
              onChange={(e) => patch({ startDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="End date"
              type="date"
              value={admin.endDate ?? ""}
              onChange={(e) => patch({ endDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>

          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) uploadMut.mutate({ file, field: uploadField });
            }}
          />

          <Typography variant="subtitle2">MOU</Typography>
          <Button
            variant="outlined"
            sx={{ textTransform: "none", alignSelf: "flex-start" }}
            onClick={() => pickFile("mouPaperId")}
            disabled={uploadMut.isPending || !activeWorkspace}
          >
            {uploadMut.isPending && uploadField === "mouPaperId" ? "Uploading…" : "Upload MOU"}
          </Button>
          {renderDocs("mouPaperId")}

          <Typography variant="subtitle2">Co-investigator document</Typography>
          <Button
            variant="outlined"
            sx={{ textTransform: "none", alignSelf: "flex-start" }}
            onClick={() => pickFile("coInvestigatorPaperIds")}
            disabled={uploadMut.isPending || !activeWorkspace}
          >
            Upload co-investigator PDF
          </Button>
          {renderDocs("coInvestigatorPaperIds")}

          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="subtitle2">Data transfer (optional)</Typography>
            <InfoTip title="Data transfer agreements or similar PDFs." />
          </Stack>
          <Button
            variant="outlined"
            sx={{ textTransform: "none", alignSelf: "flex-start" }}
            onClick={() => pickFile("dataTransferPaperIds")}
            disabled={uploadMut.isPending || !activeWorkspace}
          >
            Upload data transfer PDF
          </Button>
          {renderDocs("dataTransferPaperIds")}

          <Typography variant="subtitle2">Funding and grant documents</Typography>
          <Button
            variant="outlined"
            sx={{ textTransform: "none", alignSelf: "flex-start" }}
            onClick={() => pickFile("fundingPaperIds")}
            disabled={uploadMut.isPending || !activeWorkspace}
          >
            Upload funding PDF
          </Button>
          {renderDocs("fundingPaperIds")}

          <Typography variant="subtitle2">Grants awarded</Typography>
          {grants.map((g, i) => (
            <Paper key={g.id} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <TextField
                    label="Name"
                    value={g.name}
                    onChange={(e) => {
                      const next = grants.map((row, idx) => (idx === i ? { ...row, name: e.target.value } : row));
                      patch({ grants: next });
                    }}
                    fullWidth
                  />
                  <IconButton aria-label="Remove grant" onClick={() => patch({ grants: grants.filter((_, idx) => idx !== i) })}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <TextField
                    label="Amount"
                    value={g.amount}
                    onChange={(e) => {
                      const next = grants.map((row, idx) => (idx === i ? { ...row, amount: e.target.value } : row));
                      patch({ grants: next });
                    }}
                    fullWidth
                  />
                  <TextField
                    label="Awarded"
                    type="date"
                    value={g.awardedAt}
                    onChange={(e) => {
                      const next = grants.map((row, idx) => (idx === i ? { ...row, awardedAt: e.target.value } : row));
                      patch({ grants: next });
                    }}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Stack>
                <TextField
                  label="Notes"
                  value={g.notes}
                  onChange={(e) => {
                    const next = grants.map((row, idx) => (idx === i ? { ...row, notes: e.target.value } : row));
                    patch({ grants: next });
                  }}
                  fullWidth
                />
              </Stack>
            </Paper>
          ))}
          <Button variant="text" sx={{ textTransform: "none", alignSelf: "flex-start" }} onClick={() => patch({ grants: [...grants, emptyGrant()] })}>
            Add grant
          </Button>

          <Typography variant="subtitle2">Outputs</Typography>
          {outputs.map((o, i) => (
            <Paper key={o.id} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1}>
                  <TextField
                    select
                    SelectProps={{ native: true }}
                    label="Kind"
                    value={o.kind}
                    onChange={(e) => {
                      const kind = e.target.value as ProjectAdminOutput["kind"];
                      const next = outputs.map((row, idx) => (idx === i ? { ...row, kind } : row));
                      patch({ outputs: next });
                    }}
                    sx={{ minWidth: 160 }}
                  >
                    <option value="manuscript">Manuscript</option>
                    <option value="conference">Conference</option>
                    <option value="other">Other</option>
                  </TextField>
                  <TextField
                    label="Title"
                    value={o.title}
                    onChange={(e) => {
                      const next = outputs.map((row, idx) => (idx === i ? { ...row, title: e.target.value } : row));
                      patch({ outputs: next });
                    }}
                    fullWidth
                  />
                  <IconButton aria-label="Remove output" onClick={() => patch({ outputs: outputs.filter((_, idx) => idx !== i) })}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <TextField
                    label="Date"
                    type="date"
                    value={o.date}
                    onChange={(e) => {
                      const next = outputs.map((row, idx) => (idx === i ? { ...row, date: e.target.value } : row));
                      patch({ outputs: next });
                    }}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <TextField
                    label="Venue"
                    value={o.venue}
                    onChange={(e) => {
                      const next = outputs.map((row, idx) => (idx === i ? { ...row, venue: e.target.value } : row));
                      patch({ outputs: next });
                    }}
                    fullWidth
                  />
                  <TextField
                    select
                    SelectProps={{ native: true }}
                    label="Status"
                    value={o.status || ""}
                    onChange={(e) => {
                      const next = outputs.map((row, idx) => (idx === i ? { ...row, status: e.target.value } : row));
                      patch({ outputs: next });
                    }}
                    helperText="Writing stage"
                    fullWidth
                  >
                    <option value=""></option>
                    <option value="planned">Planned (idea, not started)</option>
                    <option value="in_progress">In progress (drafting)</option>
                    <option value="submitted">Submitted (under review)</option>
                    <option value="accepted">Accepted</option>
                    <option value="published">Published</option>
                    <option value="presented">Presented</option>
                    <option value="withdrawn">Withdrawn</option>
                  </TextField>
                </Stack>
              </Stack>
            </Paper>
          ))}
          <Button variant="text" sx={{ textTransform: "none", alignSelf: "flex-start" }} onClick={() => patch({ outputs: [...outputs, emptyOutput()] })}>
            Add output
          </Button>

          <Button
            variant="contained"
            sx={{ textTransform: "none", alignSelf: "flex-start" }}
            disabled={!activeWorkspace || saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? "Saving…" : "Save"}
          </Button>
        </Stack>
      </PageSection>
    </>
  );
}

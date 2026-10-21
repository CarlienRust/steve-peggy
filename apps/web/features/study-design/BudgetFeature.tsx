"use client";

import { useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { StudyDesignSaveBar } from "@/features/study-design/StudyDesignSaveBar";
import type { BudgetLineItem } from "@/lib/studyDesign";
import { DEFAULT_BUDGET_LINE_ITEMS } from "@/lib/studyDesign";
import { detectPhiFlags, phiWarningMessage } from "@/lib/sensitiveData";
import { ObjectiveLinkSelect } from "@/components/ObjectiveLinkSelect";
import { linkTargetOptions, normalizeObjectives } from "@/lib/objectives";
import { monoSx, peggyColors } from "@/theme/peggyTheme";

function parseAmount(value: string): number {
  const n = parseFloat(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatTotal(amounts: number[], currency: string): string {
  const sum = amounts.reduce((a, b) => a + b, 0);
  if (sum === 0) return "—";
  return `${currency} ${sum.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatNumber(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  return amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function BudgetFeature() {
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, saveSection, commitSection, isSectionDirty, savingSection } = useStudyDesign(
    activeWorkspace?.id
  );
  const budget = studyDesign.budget ?? {};
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<BudgetLineItem | null>(null);

  const lineItems = useMemo(
    () => (budget.lineItems?.length ? budget.lineItems : DEFAULT_BUDGET_LINE_ITEMS()),
    [budget.lineItems]
  );

  const currency = budget.currency ?? "ZAR";

  if (!activeWorkspace) {
    return <Alert severity="info">Select a project to describe your study budget.</Alert>;
  }

  const onPhiBlur = (field: string, text: string) => {
    setFieldWarnings((prev) => ({ ...prev, [field]: phiWarningMessage(detectPhiFlags(text)) }));
  };

  const updateLineItems = (next: BudgetLineItem[]) => {
    saveSection("budget", { lineItems: next });
  };

  const amounts = lineItems.map((r) => parseAmount(r.amount));
  const total = amounts.reduce((a, b) => a + b, 0);
  const linkedTotal = lineItems
    .filter((r) => (r.objectiveIds ?? []).length > 0)
    .map((r) => parseAmount(r.amount))
    .reduce((a, b) => a + b, 0);
  const linkedPct = total > 0 ? Math.round((linkedTotal / total) * 100) : 0;
  const unlinkedLines = lineItems.filter(
    (r) => (r.objectiveIds ?? []).length === 0 && (r.category || r.notes || r.amount || r.description)
  );

  const objectives = normalizeObjectives(activeWorkspace?.objectives);
  const linkOptions = linkTargetOptions(activeWorkspace?.aim, objectives);
  const objectiveIndexById = useMemo(() => {
    const m = new Map<string, number>();
    objectives.forEach((o, idx) => m.set(o.id, idx + 1));
    return m;
  }, [objectives]);

  const objectiveLabels = (ids: string[] | undefined) => {
    const arr = (ids ?? []).filter(Boolean);
    if (arr.length === 0) return "None";
    const nums = arr
      .map((id) => objectiveIndexById.get(id))
      .filter((n): n is number => typeof n === "number")
      .sort((a, b) => a - b);
    if (nums.length === 0) return "None";
    return nums.map((n) => `O${n}`).join(", ");
  };

  const openEdit = (row: BudgetLineItem) => {
    setEditRow({ ...row, objectiveIds: row.objectiveIds ?? [] });
    setEditOpen(true);
  };

  const applyEdit = () => {
    if (!editRow) return;
    updateLineItems(lineItems.map((r) => (r.id === editRow.id ? editRow : r)));
    setEditOpen(false);
  };

  const addLine = () => {
    const row: BudgetLineItem = {
      id: `row-${Date.now()}`,
      category: "",
      description: "",
      amount: "",
      notes: "",
      objectiveIds: [],
    };
    updateLineItems([...lineItems, row]);
    openEdit(row);
  };

  const removeLine = (id: string) => updateLineItems(lineItems.filter((r) => r.id !== id));

  return (
    <>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          {[
            {
              label: "TOTAL BUDGET",
              value: formatNumber(total),
              sub: `${lineItems.length} line item${lineItems.length === 1 ? "" : "s"}`,
            },
            {
              label: "LINKED TO OBJECTIVES",
              value: total > 0 ? `${linkedPct}%` : "—",
              sub: total > 0 ? `${formatNumber(linkedTotal)} of ${formatNumber(total)}` : "—",
            },
            {
              label: "NOT LINKED",
              value: String(unlinkedLines.length),
              sub: unlinkedLines[0]?.category || "—",
            },
          ].map((card) => (
            <Paper key={card.label} variant="outlined" sx={{ p: 2.5, flex: 1 }}>
              <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent }}>
                {card.label}
              </Typography>
              <Typography variant="h3" sx={{ mt: 0.5, fontSize: 36, letterSpacing: "-0.72px", fontWeight: 600 }}>
                {card.value}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {card.sub}
              </Typography>
            </Paper>
          ))}
        </Stack>

        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 2 }}>
            <Stack spacing={0.4}>
              <Typography variant="subtitle1" fontWeight={600}>
                Line items
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Link lines to objectives. Unlinked lines are allowed.
              </Typography>
            </Stack>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={addLine} sx={{ textTransform: "none" }}>
              Add line
            </Button>
          </Stack>
          <Divider />

          <Box sx={{ bgcolor: peggyColors.surface, px: 2, py: 1 }}>
            <Stack
              direction="row"
              spacing={2}
              sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: "text.secondary" }}
            >
              <Box sx={{ width: 200 }}>CATEGORY</Box>
              <Box sx={{ flex: 1 }}>NOTES</Box>
              <Box sx={{ width: 90 }}>OBJECTIVES</Box>
              <Box sx={{ width: 120, textAlign: "right" }}>AMOUNT</Box>
              <Box sx={{ width: 130 }} />
            </Stack>
          </Box>
          <Divider />

          {lineItems.map((row) => (
            <Box key={row.id} sx={{ px: 2, py: 1.5, borderBottom: `0.5px solid ${peggyColors.border}` }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography fontWeight={600} sx={{ width: 200 }}>
                  {row.category || "—"}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  {row.notes || row.description || "—"}
                </Typography>
                <Typography
                  sx={{
                    ...monoSx,
                    width: 90,
                    color: (row.objectiveIds ?? []).length ? peggyColors.accent : "text.secondary",
                  }}
                >
                  {objectiveLabels(row.objectiveIds)}
                </Typography>
                <Typography sx={{ ...monoSx, width: 120, textAlign: "right", color: "text.primary" }}>
                  {row.amount ? row.amount : "—"}
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ width: 130, justifyContent: "flex-end" }}>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => openEdit(row)}
                    sx={{ textTransform: "none", color: peggyColors.accent }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => removeLine(row.id)}
                    sx={{ textTransform: "none", color: peggyColors.accent }}
                  >
                    Delete
                  </Button>
                </Stack>
              </Stack>
            </Box>
          ))}

          <Box sx={{ bgcolor: peggyColors.surface, px: 2, py: 1.25 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography fontWeight={600} sx={{ width: 200 }}>
                Total
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Box sx={{ width: 90 }} />
              <Typography fontWeight={600} sx={{ width: 120, textAlign: "right" }}>
                {formatNumber(total)}
              </Typography>
              <Box sx={{ width: 130 }} />
            </Stack>
          </Box>
        </Paper>

        {unlinkedLines.length > 0 ? (
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "1.2px", color: peggyColors.accent }}>
              NEXT STEP
            </Typography>
            <Typography variant="h6" sx={{ mt: 0.5 }}>
              One line is not linked to an objective
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Link {unlinkedLines[0]?.category || "this line"} to an objective, or leave it as general costs. Both are
              fine.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button variant="contained" sx={{ textTransform: "none" }} onClick={() => openEdit(unlinkedLines[0])}>
                Link to objective
              </Button>
              <Button variant="outlined" sx={{ textTransform: "none" }} href="/study-design/proposal">
                Open Proposal
              </Button>
            </Stack>
          </Paper>
        ) : null}

        <StudyDesignSaveBar
          dirty={isSectionDirty("budget")}
          saving={savingSection === "budget"}
          onSave={() => commitSection("budget", { ...budget, lineItems })}
        />
      </Stack>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editRow?.category ? "Edit line" : "Add line"}</DialogTitle>
        <DialogContent dividers>
          {editRow ? (
            <Stack spacing={2}>
              <TextField
                label="Category"
                value={editRow.category}
                onChange={(e) => setEditRow({ ...editRow, category: e.target.value })}
                fullWidth
              />
              <TextField
                label="Notes"
                value={editRow.notes}
                onChange={(e) => setEditRow({ ...editRow, notes: e.target.value })}
                fullWidth
                onBlur={(e) => onPhiBlur("notes", e.target.value)}
                error={!!fieldWarnings.notes}
                helperText={fieldWarnings.notes}
              />
              <TextField
                label="Amount"
                value={editRow.amount}
                onChange={(e) => setEditRow({ ...editRow, amount: e.target.value })}
                fullWidth
                sx={monoSx}
              />
              <ObjectiveLinkSelect
                options={linkOptions}
                value={editRow.objectiveIds ?? []}
                onChange={(ids) => setEditRow({ ...editRow, objectiveIds: ids })}
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={applyEdit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

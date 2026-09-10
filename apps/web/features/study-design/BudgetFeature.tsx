"use client";

import { useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useWorkspace } from "@/lib/workspaceContext";
import { useStudyDesign } from "@/lib/useStudyDesign";
import type { BudgetLineItem } from "@/lib/studyDesign";
import { DEFAULT_BUDGET_LINE_ITEMS } from "@/lib/studyDesign";
import { detectPhiFlags, phiWarningMessage } from "@/lib/sensitiveData";
import { monoSx, peggyColors } from "@/theme/peggyTheme";

const cellFieldSx = {
  "& .MuiInputBase-root": { fontSize: "0.8125rem" },
  "& .MuiInput-underline:before": { borderBottom: "none" },
  "& .MuiInput-underline:after": { borderBottom: "none" },
  "& .MuiInput-underline:hover:not(.Mui-disabled):before": { borderBottom: "none" },
};

function parseAmount(value: string): number {
  const n = parseFloat(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatTotal(amounts: number[], currency: string): string {
  const sum = amounts.reduce((a, b) => a + b, 0);
  if (sum === 0) return "—";
  return `${currency} ${sum.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function escapeTsvCell(value: string): string {
  if (/[\t\n"]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function buildBudgetTableTsv(
  lineItems: BudgetLineItem[],
  currency: string,
  fundingSource: string,
  totalLabel: string
): string {
  const headers = ["Expense category", "Description", `Amount (${currency})`, "Notes"];
  const rows = lineItems
    .filter((r) => r.category || r.description || r.amount || r.notes)
    .map((r) =>
      [r.category, r.description, r.amount, r.notes].map((c) => escapeTsvCell(c)).join("\t")
    );
  const total = formatTotal(
    lineItems.map((r) => parseAmount(r.amount)),
    currency
  );
  const lines = [headers.join("\t"), ...rows, ["", "", totalLabel, total].join("\t")];
  if (fundingSource.trim()) {
    lines.unshift(`Funding source\t${escapeTsvCell(fundingSource.trim())}`);
    lines.unshift("");
  }
  return lines.join("\n").trim();
}

export function BudgetFeature() {
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, saveSection, isSaving } = useStudyDesign(activeWorkspace?.id);
  const budget = studyDesign.budget ?? {};
  const legacySummary = studyDesign.samples?.budget;
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});
  const [copyOpen, setCopyOpen] = useState(false);

  const lineItems = useMemo(
    () => (budget.lineItems?.length ? budget.lineItems : DEFAULT_BUDGET_LINE_ITEMS()),
    [budget.lineItems]
  );

  const currency = budget.currency ?? "ZAR";
  const summaryValue = budget.summary ?? legacySummary ?? "";
  const fundingRequired = !!budget.fundingSourceRequired;

  if (!activeWorkspace) {
    return <Alert severity="info">Select a project to describe your study budget.</Alert>;
  }

  const onPhiBlur = (field: string, text: string) => {
    setFieldWarnings((prev) => ({ ...prev, [field]: phiWarningMessage(detectPhiFlags(text)) }));
  };

  const updateLineItems = (next: BudgetLineItem[]) => {
    saveSection("budget", { lineItems: next });
  };

  const updateRow = (id: string, patch: Partial<BudgetLineItem>) => {
    updateLineItems(lineItems.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    updateLineItems([
      ...lineItems,
      { id: `row-${Date.now()}`, category: "", description: "", amount: "", notes: "" },
    ]);
  };

  const removeRow = (id: string) => {
    if (lineItems.length <= 1) return;
    updateLineItems(lineItems.filter((row) => row.id !== id));
  };

  const copyTable = async () => {
    const tsv = buildBudgetTableTsv(lineItems, currency, summaryValue, "Total");
    try {
      await navigator.clipboard.writeText(tsv);
      setCopyOpen(true);
    } catch {
      // fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = tsv;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopyOpen(true);
    }
  };

  const amounts = lineItems.map((r) => parseAmount(r.amount));
  const fundingSourceError = fundingRequired && !summaryValue.trim();

  return (
    <>
      <Stack spacing={2}>
        <FormControlLabel
          control={
            <Checkbox
              checked={fundingRequired}
              onChange={(e) => saveSection("budget", { fundingSourceRequired: e.target.checked })}
            />
          }
          label="Funding source required (e.g. grant or sponsor must be named)"
        />

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label={fundingRequired ? "Funding source" : "Funding source (optional)"}
            placeholder="e.g. FMHS faculty seed grant; 18-month MSc"
            value={summaryValue}
            onChange={(e) => saveSection("budget", { summary: e.target.value })}
            onBlur={(e) => onPhiBlur("summary", e.target.value)}
            fullWidth
            size="small"
            required={fundingRequired}
            error={fundingSourceError || !!fieldWarnings.summary}
            helperText={
              fundingSourceError
                ? "Name the funder or sponsor when funding source is required."
                : fieldWarnings.summary || (fundingRequired ? "Required for grant and proposal sections." : undefined)
            }
          />
          <TextField
            label="Currency"
            value={currency}
            onChange={(e) => saveSection("budget", { currency: e.target.value })}
            size="small"
            sx={{ width: { xs: "100%", sm: 120 }, ...monoSx }}
          />
        </Stack>

        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Typography variant="subtitle2">List of expenses</Typography>
          <Button size="small" startIcon={<ContentCopyIcon />} onClick={copyTable} variant="outlined">
            Copy table
          </Button>
        </Stack>

        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{
            borderColor: peggyColors.border,
            "& .MuiTableCell-root": {
              borderColor: peggyColors.border,
              py: 0.5,
              px: 1,
              verticalAlign: "middle",
            },
          }}
        >
          <Table size="small" sx={{ tableLayout: "fixed" }}>
            <TableHead>
              <TableRow sx={{ bgcolor: peggyColors.muted }}>
                {["Expense category", "Description", "Amount", "Notes", ""].map((h) => (
                  <TableCell
                    key={h || "actions"}
                    sx={{
                      ...monoSx,
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "text.secondary",
                      width:
                        h === "Expense category" ? "18%" : h === "Amount" ? "14%" : h === "" ? "40px" : undefined,
                    }}
                  >
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {lineItems.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <TextField
                      value={row.category}
                      onChange={(e) => updateRow(row.id, { category: e.target.value })}
                      placeholder="Expense"
                      variant="standard"
                      fullWidth
                      size="small"
                      sx={cellFieldSx}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={row.description}
                      onChange={(e) => updateRow(row.id, { description: e.target.value })}
                      placeholder="Description"
                      variant="standard"
                      fullWidth
                      size="small"
                      sx={cellFieldSx}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={row.amount}
                      onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                      placeholder="0"
                      variant="standard"
                      fullWidth
                      size="small"
                      sx={{ ...cellFieldSx, ...monoSx }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={row.notes}
                      onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                      placeholder="Notes"
                      variant="standard"
                      fullWidth
                      size="small"
                      sx={cellFieldSx}
                    />
                  </TableCell>
                  <TableCell padding="checkbox">
                    <IconButton
                      size="small"
                      aria-label="Remove expense row"
                      onClick={() => removeRow(row.id)}
                      disabled={lineItems.length <= 1}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ bgcolor: peggyColors.muted }}>
                <TableCell colSpan={2} sx={{ ...monoSx, fontWeight: 600, fontSize: "0.8125rem" }}>
                  Total
                </TableCell>
                <TableCell sx={{ ...monoSx, fontWeight: 600, fontSize: "0.8125rem" }}>
                  {formatTotal(amounts, currency)}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <Box>
          <Button size="small" startIcon={<AddIcon />} onClick={addRow} sx={{ alignSelf: "flex-start" }}>
            Add expense
          </Button>
        </Box>

        <TextField
          label="Spending constraints"
          multiline
          minRows={2}
          placeholder="e.g. No paid software; open-source tools only; no participant payments"
          value={budget.constraints ?? ""}
          onChange={(e) => saveSection("budget", { constraints: e.target.value })}
          onBlur={(e) => onPhiBlur("constraints", e.target.value)}
          fullWidth
          size="small"
          error={!!fieldWarnings.constraints}
          helperText={
            fieldWarnings.constraints ||
            "Limits that methods and analysis planners should respect."
          }
        />

        {isSaving && (
          <Typography variant="caption" color="text.secondary">
            Saving…
          </Typography>
        )}
      </Stack>

      <Snackbar
        open={copyOpen}
        autoHideDuration={2500}
        onClose={() => setCopyOpen(false)}
        message="Table copied — paste into Excel or Sheets"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}

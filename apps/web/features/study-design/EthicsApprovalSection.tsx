"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { PaperRecord } from "@/lib/api";
import type { StudyDesignEthics } from "@/lib/studyDesign";
import { peggyColors } from "@/theme/peggyTheme";

type EthicsApprovalSectionProps = {
  ethics: StudyDesignEthics;
  onSave: (patch: Partial<StudyDesignEthics>) => void;
  papers: PaperRecord[];
  onUploadClick: () => void;
};

function formatShortDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function SummaryRow({
  label,
  value,
  actionLabel,
  onAction,
}: {
  label: string;
  value: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="center"
      sx={{ py: 1, px: 1, borderBottom: `0.5px solid ${peggyColors.border}`, width: "100%" }}
    >
      <Typography fontWeight={500} sx={{ width: 140, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1, lineHeight: 1.6 }}>
        {value}
      </Typography>
      <Button variant="text" onClick={onAction} sx={{ textTransform: "none", color: peggyColors.accent, flexShrink: 0 }}>
        {actionLabel}
      </Button>
    </Stack>
  );
}

export function EthicsApprovalSection({ ethics, onSave, papers, onUploadClick }: EthicsApprovalSectionProps) {
  const [committeeOpen, setCommitteeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [committee, setCommittee] = useState(ethics.fmhsTrack ?? "");
  const [approvalObtained, setApprovalObtained] = useState(!!ethics.approvalObtained);
  const [approvalDate, setApprovalDate] = useState(ethics.approvalDate ?? "");
  const [expiryDate, setExpiryDate] = useState(ethics.expiryDate ?? "");
  const [acknowledgedSafety, setAcknowledgedSafety] = useState(!!ethics.acknowledgedSafety);

  const latestPaper = papers[0];
  const letterValue = papers.length
    ? `Uploaded${latestPaper?.ingested_at ? ` · ${formatShortDate(latestPaper.ingested_at)}` : ""}`
    : "Not uploaded";

  const statusValue = ethics.approvalObtained
    ? `Approved${ethics.approvalDate ? ` · ${formatShortDate(ethics.approvalDate)}` : ""}`
    : "Not yet obtained";

  const openCommittee = () => {
    setCommittee(ethics.fmhsTrack ?? "");
    setCommitteeOpen(true);
  };

  const openStatus = () => {
    setApprovalObtained(!!ethics.approvalObtained);
    setApprovalDate(ethics.approvalDate ?? "");
    setExpiryDate(ethics.expiryDate ?? "");
    setAcknowledgedSafety(!!ethics.acknowledgedSafety);
    setStatusOpen(true);
  };

  return (
    <>
      <SummaryRow
        label="Committee"
        value={ethics.fmhsTrack?.trim() || "Not set"}
        actionLabel="Change"
        onAction={openCommittee}
      />
      <SummaryRow label="Status" value={statusValue} actionLabel="Update" onAction={openStatus} />
      <SummaryRow label="Approval letter" value={letterValue} actionLabel="Upload" onAction={onUploadClick} />

      <Dialog open={committeeOpen} onClose={() => setCommitteeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Committee</DialogTitle>
        <DialogContent>
          <TextField
            label="Committee"
            value={committee}
            onChange={(e) => setCommittee(e.target.value)}
            placeholder="e.g. UCT HREC · FMHS"
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCommitteeOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              onSave({ fmhsTrack: committee.trim() || undefined });
              setCommitteeOpen(false);
            }}
            sx={{ textTransform: "none" }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={statusOpen} onClose={() => setStatusOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ethics approval status</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControlLabel
              control={
                <Checkbox checked={approvalObtained} onChange={(e) => setApprovalObtained(e.target.checked)} />
              }
              label="Ethics approval already obtained"
            />
            <FormControlLabel
              control={
                <Checkbox checked={acknowledgedSafety} onChange={(e) => setAcknowledgedSafety(e.target.checked)} />
              }
              label="I will not paste identifiable participant data into Peggy"
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Approval date"
                type="date"
                value={approvalDate}
                onChange={(e) => setApprovalDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
                sx={{ minWidth: 160 }}
              />
              <TextField
                label="Expiry / renewal date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
                sx={{ minWidth: 160, flex: 1 }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStatusOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              onSave({
                approvalObtained,
                acknowledgedSafety,
                approvalDate: approvalDate || undefined,
                expiryDate: expiryDate || undefined,
              });
              setStatusOpen(false);
            }}
            sx={{ textTransform: "none" }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

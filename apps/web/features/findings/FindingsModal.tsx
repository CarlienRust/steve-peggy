"use client";

import { Dialog, DialogContent, DialogTitle, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { IngestForm } from "@/features/ingest/IngestFeature";

export function FindingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>Add our findings</DialogTitle>
      <IconButton aria-label="Close" onClick={onClose} sx={{ position: "absolute", right: 12, top: 12 }}>
        <CloseIcon />
      </IconButton>
      <DialogContent dividers>
        <IngestForm variant="findings" onIngestSuccess={onClose} />
      </DialogContent>
    </Dialog>
  );
}

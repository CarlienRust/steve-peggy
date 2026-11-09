"use client";

import { Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";

const ROWS: { platform: string; optOut: string; how: string }[] = [
  { platform: "Claude", optOut: "Yes", how: "Settings → Privacy → Help improve Claude" },
  { platform: "ChatGPT", optOut: "Yes", how: "Settings → Data Controls → Improve the model for everyone → Off" },
  { platform: "Google Gemini", optOut: "Yes", how: "Turn off Keep Activity" },
  { platform: "Microsoft Copilot", optOut: "Yes", how: "Privacy → Training on conversation activity → Off" },
  { platform: "Perplexity", optOut: "Yes", how: "Turn off AI Data Retention" },
  { platform: "Meta AI", optOut: "Limited", how: "Objection mechanisms exist in certain regions, but availability varies." },
];

export function TrainingOptOutTable() {
  return (
    <Paper variant="outlined" sx={{ overflow: "auto" }}>
      <Typography variant="subtitle2" sx={{ p: 1.5, pb: 0 }}>
        Turn off training in the provider account (Peggy cannot verify this)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, pt: 0.5, pb: 1 }}>
        Default Peggy uses Gemini. Later you will be able to link your own model. Until then, opt out of training on the
        account that serves this project.
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>AI platform</TableCell>
            <TableCell>Free opt-out available?</TableCell>
            <TableCell>How it works</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ROWS.map((row) => (
            <TableRow key={row.platform}>
              <TableCell>{row.platform}</TableCell>
              <TableCell>{row.optOut}</TableCell>
              <TableCell>{row.how}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

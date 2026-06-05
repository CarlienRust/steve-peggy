"use client";

import { Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";

type Gap = {
  topic?: string;
  status?: string;
  suggested_study?: string;
};

export function WorkflowResults({ mode, body }: { mode: string; body: Record<string, unknown> | null | undefined }) {
  if (!body) return null;

  if (mode === "gap_analysis") {
    const gaps = (body.gaps as Gap[]) ?? [];
    return (
      <Stack spacing={2}>
        {typeof body.summary === "string" && body.summary && (
          <Typography variant="body1">{body.summary}</Typography>
        )}
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Topic</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Suggested study</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {gaps.map((g, i) => (
                <TableRow key={i}>
                  <TableCell>{g.topic}</TableCell>
                  <TableCell>{g.status}</TableCell>
                  <TableCell>{g.suggested_study}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Stack>
    );
  }

  if (mode === "compare") {
    const agreement = (body.agreement as string[]) ?? [];
    const discrepancy = (body.discrepancy as string[]) ?? [];
    return (
      <Stack spacing={2}>
        {typeof body.summary === "string" && body.summary && (
          <Typography variant="body1">{body.summary}</Typography>
        )}
        {agreement.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Agreement with literature
            </Typography>
            {agreement.map((item, i) => (
              <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
                • {item}
              </Typography>
            ))}
          </Paper>
        )}
        {discrepancy.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Discrepancies
            </Typography>
            {discrepancy.map((item, i) => (
              <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
                • {item}
              </Typography>
            ))}
          </Paper>
        )}
      </Stack>
    );
  }

  return null;
}

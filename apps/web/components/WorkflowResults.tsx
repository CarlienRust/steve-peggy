"use client";

import { Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import {
  hasAbstractSections,
  hasProposalSections,
  normalizeWorkflowBody,
} from "@/lib/normalizeWorkflowBody";

type Gap = {
  topic?: string;
  status?: string;
  suggested_study?: string;
  evidence_basis?: string;
  paper_count?: number;
};

export function WorkflowResults({ mode, body: rawBody }: { mode: string; body: Record<string, unknown> | null | undefined }) {
  const body = normalizeWorkflowBody(rawBody ?? undefined);
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
                <TableCell>Evidence</TableCell>
                <TableCell>Papers</TableCell>
                <TableCell>Suggested study</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {gaps.map((g, i) => (
                <TableRow key={i}>
                  <TableCell>{g.topic}</TableCell>
                  <TableCell>{g.status}</TableCell>
                  <TableCell>{g.evidence_basis ?? "—"}</TableCell>
                  <TableCell>{g.paper_count ?? "—"}</TableCell>
                  <TableCell>{g.suggested_study}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Stack>
    );
  }

  if (mode === "methods_plan" || mode === "analysis_plan") {
    const reviewKeys = ["strengths", "gaps", "recommendations", "ethics_flags"] as const;
    const isReview = reviewKeys.some((k) => Array.isArray(body[k]) && (body[k] as unknown[]).length > 0);
    if (isReview) {
      return (
        <Stack spacing={2}>
          {reviewKeys.map((key) => {
            const items = (body[key] as string[]) ?? [];
            if (!items.length) return null;
            return (
              <Paper key={key} variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, textTransform: "capitalize" }}>
                  {key.replace(/_/g, " ")}
                </Typography>
                {items.map((item, i) => (
                  <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
                    • {item}
                  </Typography>
                ))}
              </Paper>
            );
          })}
        </Stack>
      );
    }
    const suggestSections: { key: string; multi?: boolean }[] =
      mode === "methods_plan"
        ? [
            { key: "design" },
            { key: "endpoints", multi: true },
            { key: "procedures", multi: true },
            { key: "sample_size_note" },
            { key: "budget_fit_tools", multi: true },
            { key: "citations", multi: true },
          ]
        : [
            { key: "primary_analyses", multi: true },
            { key: "models_or_tests", multi: true },
            { key: "power_or_sample_note" },
            { key: "software", multi: true },
            { key: "citations", multi: true },
          ];
    const budgetTiers = body.budget_tiers as Record<string, string> | undefined;
    return (
      <Stack spacing={2}>
        {suggestSections.map(({ key, multi }) => {
          const raw = body[key];
          if (multi) {
            const items = (raw as string[]) ?? [];
            if (!items.length) return null;
            return (
              <Paper key={key} variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, textTransform: "capitalize" }}>
                  {key.replace(/_/g, " ")}
                </Typography>
                {items.map((item, i) => (
                  <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
                    • {item}
                  </Typography>
                ))}
              </Paper>
            );
          }
          if (typeof raw !== "string" || !raw.trim()) return null;
          return (
            <Paper key={key} variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, textTransform: "capitalize" }}>
                {key.replace(/_/g, " ")}
              </Typography>
              <Typography variant="body2">{raw}</Typography>
            </Paper>
          );
        })}
        {budgetTiers && Object.keys(budgetTiers).length > 0 ? (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Budget tiers
            </Typography>
            {Object.entries(budgetTiers).map(([tier, note]) => (
              <Typography key={tier} variant="body2" sx={{ mb: 0.5 }}>
                <strong>{tier}:</strong> {note}
              </Typography>
            ))}
          </Paper>
        ) : null}
      </Stack>
    );
  }

  if (mode === "proposal" && hasProposalSections(body)) {
    const full = typeof body.full_text === "string" ? body.full_text.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const sections: { key: string; label: string }[] = [
      { key: "summary", label: "Summary" },
      { key: "background", label: "Background" },
      { key: "methods", label: "Methods" },
      { key: "analysis", label: "Analysis" },
      { key: "sample_size", label: "Sample size" },
      { key: "timeline", label: "Timeline" },
      { key: "ethics_note", label: "Ethics" },
    ];
    const aims = Array.isArray(body.aims) ? (body.aims as string[]).filter(Boolean) : [];
    if (full) {
      return (
        <Paper variant="outlined" sx={{ p: 2 }}>
          {title ? (
            <Typography variant="h6" sx={{ mb: 2 }}>
              {title}
            </Typography>
          ) : null}
          <Typography variant="body2" component="div" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            {full}
          </Typography>
        </Paper>
      );
    }
    return (
      <Stack spacing={2}>
        {title ? (
          <Typography variant="h6" fontWeight={600}>
            {title}
          </Typography>
        ) : null}
        {sections.map(({ key, label }) => {
          const text = typeof body[key] === "string" ? (body[key] as string).trim() : "";
          if (!text) return null;
          return (
            <Paper key={key} variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {label}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                {text}
              </Typography>
            </Paper>
          );
        })}
        {aims.length > 0 ? (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Aims
            </Typography>
            {aims.map((a, i) => (
              <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
                • {a}
              </Typography>
            ))}
          </Paper>
        ) : null}
      </Stack>
    );
  }

  if (mode === "conference_abstract" && hasAbstractSections(body)) {
    const sections = [
      { key: "introduction", label: "Introduction" },
      { key: "methods", label: "Methods" },
      { key: "results", label: "Results" },
      { key: "conclusion", label: "Conclusion" },
    ] as const;
    const full = typeof body.full_text === "string" ? body.full_text.trim() : "";
    const wordCount = typeof body.word_count === "number" ? body.word_count : null;
    return (
      <Stack spacing={2}>
        {wordCount != null ? (
          <Typography variant="caption" color="text.secondary">
            About {wordCount} words
          </Typography>
        ) : null}
        {full ? (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
              {full}
            </Typography>
          </Paper>
        ) : (
          sections.map(({ key, label }) => {
            const text = typeof body[key] === "string" ? (body[key] as string).trim() : "";
            if (!text) return null;
            return (
              <Paper key={key} variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {label}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                  {text}
                </Typography>
              </Paper>
            );
          })
        )}
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

  const listSections = Object.entries(body).filter(([, v]) => Array.isArray(v) && (v as unknown[]).length > 0);
  const textSections = Object.entries(body).filter(
    ([, v]) => typeof v === "string" && v.trim().length > 0
  );

  if (listSections.length === 0 && textSections.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" component="pre" sx={{ whiteSpace: "pre-wrap", m: 0 }}>
          {JSON.stringify(body, null, 2)}
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      {textSections.map(([key, value]) => (
        <Paper key={key} variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, textTransform: "capitalize" }}>
            {key.replace(/_/g, " ")}
          </Typography>
          <Typography variant="body2">{value as string}</Typography>
        </Paper>
      ))}
      {listSections.map(([key, value]) => (
        <Paper key={key} variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, textTransform: "capitalize" }}>
            {key.replace(/_/g, " ")}
          </Typography>
          {(value as string[]).map((item, i) => (
            <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
              • {typeof item === "string" ? item : JSON.stringify(item)}
            </Typography>
          ))}
        </Paper>
      ))}
    </Stack>
  );
}

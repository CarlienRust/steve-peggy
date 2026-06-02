import { Accordion, AccordionDetails, AccordionSummary, Chip, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { SourceCitation } from "@/lib/api";
import { eyebrowSx, monoSx } from "@/theme/peggyTheme";

export function SourceCards({
  sources,
  confidence,
  limitations,
}: {
  sources: SourceCitation[];
  confidence?: string;
  limitations?: string[];
}) {
  return (
    <Stack spacing={1.5} sx={{ mt: 3 }}>
      {confidence && (
        <Chip
          label={`Confidence: ${confidence}`}
          size="small"
          color={confidence === "low" ? "warning" : confidence === "high" ? "success" : "default"}
          variant="outlined"
        />
      )}
      {limitations?.map((l) => (
        <Typography key={l} variant="caption" color="text.secondary">
          Limitation: {l}
        </Typography>
      ))}
      <Typography sx={{ ...eyebrowSx, mt: 1 }}>Sources</Typography>
      {sources.map((s) => (
        <Accordion key={s.chunk_id} disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {s.title} ({s.year}) — {s.relevance_score.toFixed(2)}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="caption" color="text.secondary" display="block">
              {s.authors}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, lineHeight: 1.6 }}>
              {s.excerpt}
            </Typography>
            <Typography sx={{ ...monoSx, fontSize: 10, color: "text.secondary", mt: 1 }}>
              chunk_id: {s.chunk_id}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Stack>
  );
}

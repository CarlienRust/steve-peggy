"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { peggyApi, formatApiError, queryKeys, type PaperRecord } from "@/lib/api";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { useWorkspace } from "@/lib/workspaceContext";
import {
  formatStudyDesignSections,
  type ProjectContextSection,
} from "@/lib/projectContext";
import { eyebrowSx } from "@/theme/peggyTheme";

type ProjectContextImportProps = {
  onImport: (text: string) => void;
  sections?: ProjectContextSection[];
  showAutoContextNote?: boolean;
};

const SECTION_LABELS: Record<ProjectContextSection, string> = {
  samples: "Samples & datasets (form)",
  methods: "Methods plan",
  analysis: "Analysis plan",
  findings: "Our findings (corpus)",
  datasets: "Sample dataset PDFs",
};

export function ProjectContextImport({
  onImport,
  sections = ["samples", "methods", "analysis", "findings", "datasets"],
  showAutoContextNote = false,
}: ProjectContextImportProps) {
  const { activeWorkspace } = useWorkspace();
  const { studyDesign } = useStudyDesign(activeWorkspace?.id);
  const [selected, setSelected] = useState<Set<ProjectContextSection>>(new Set(sections));
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const findingsQuery = useQuery({
    queryKey: queryKeys.corpus("own_findings"),
    queryFn: () => peggyApi.listCorpus("own_findings"),
    enabled: sections.includes("findings"),
  });
  const datasetsQuery = useQuery({
    queryKey: queryKeys.corpus("sample_datasets"),
    queryFn: () => peggyApi.listCorpus("sample_datasets"),
    enabled: sections.includes("datasets"),
  });

  const findings = findingsQuery.data?.papers ?? [];
  const datasets = datasetsQuery.data?.papers ?? [];
  const corpusSections = sections.filter((s) => s === "findings" || s === "datasets");

  const toggleSection = (id: ProjectContextSection) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePaper = (id: number) => {
    setSelectedPaperIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasStudyDesignContent =
    (sections.includes("samples") && formatStudyDesignSections(studyDesign, ["samples"])) ||
    (sections.includes("methods") && formatStudyDesignSections(studyDesign, ["methods"])) ||
    (sections.includes("analysis") && formatStudyDesignSections(studyDesign, ["analysis"]));

  const importSelected = async () => {
    setImporting(true);
    setImportError(null);
    try {
      const blocks: string[] = [];
      const designSections = sections.filter(
        (s): s is "samples" | "methods" | "analysis" => s === "samples" || s === "methods" || s === "analysis"
      );
      const designText = formatStudyDesignSections(
        studyDesign,
        designSections.filter((s) => selected.has(s))
      );
      if (designText) blocks.push(designText);

      if (selectedPaperIds.size > 0) {
        for (const id of selectedPaperIds) {
          if (selected.has("findings")) {
            const paper = findings.find((p) => p.id === id);
            if (paper?.id) {
              const res = await peggyApi.getPaperText(paper.id);
              const header = paper.title ? `## Our findings: ${paper.title}` : `## Our findings ${id}`;
              blocks.push(res.text ? `${header}\n\n${res.text}` : `${header}\n\n(No indexed text)`);
              continue;
            }
          }
          if (selected.has("datasets")) {
            const paper = datasets.find((p) => p.id === id);
            if (paper?.id) {
              const res = await peggyApi.getPaperText(paper.id);
              const header = paper.title ? `## Sample dataset: ${paper.title}` : `## Sample dataset ${id}`;
              blocks.push(res.text ? `${header}\n\n${res.text}` : `${header}\n\n(No indexed text)`);
            }
          }
        }
      }

      if (blocks.length === 0) return;
      onImport(blocks.join("\n\n---\n\n"));
    } catch (err) {
      setImportError(formatApiError(err));
    } finally {
      setImporting(false);
    }
  };

  const renderPaperList = (papers: PaperRecord[], label: ProjectContextSection) => {
    if (!selected.has(label)) return null;
    if (papers.length === 0) return null;
    return (
      <List dense disablePadding sx={{ mt: 1 }}>
        {papers.map((p) =>
          p.id != null ? (
            <ListItem key={p.id} disablePadding>
              <ListItemButton onClick={() => togglePaper(p.id!)} dense>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Checkbox checked={selectedPaperIds.has(p.id)} tabIndex={-1} disableRipple />
                </ListItemIcon>
                <ListItemText primary={p.title || "Untitled"} secondary={p.year || label} />
              </ListItemButton>
            </ListItem>
          ) : null
        )}
      </List>
    );
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography sx={eyebrowSx}>Import from project</Typography>
      {showAutoContextNote && activeWorkspace && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Study design context is included automatically when a project is selected.
        </Typography>
      )}

      <Stack spacing={0.5}>
        {sections
          .filter((s) => s !== "findings" && s !== "datasets")
          .map((s) => (
            <FormControlLabel
              key={s}
              control={<Checkbox checked={selected.has(s)} onChange={() => toggleSection(s)} />}
              label={SECTION_LABELS[s]}
            />
          ))}
        {sections.includes("findings") && findings.length > 0 && (
          <FormControlLabel
            control={<Checkbox checked={selected.has("findings")} onChange={() => toggleSection("findings")} />}
            label={`${SECTION_LABELS.findings} (${findings.length})`}
          />
        )}
        {sections.includes("datasets") && datasets.length > 0 && (
          <FormControlLabel
            control={<Checkbox checked={selected.has("datasets")} onChange={() => toggleSection("datasets")} />}
            label={`${SECTION_LABELS.datasets} (${datasets.length})`}
          />
        )}
      </Stack>

      {renderPaperList(findings, "findings")}
      {renderPaperList(datasets, "datasets")}

      <Button
        variant="outlined"
        size="small"
        sx={{ mt: 2 }}
        disabled={importing || (!hasStudyDesignContent && selectedPaperIds.size === 0)}
        onClick={() => void importSelected()}
      >
        {importing ? <CircularProgress size={20} /> : "Import selected into text"}
      </Button>
      {importError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {importError}
        </Alert>
      )}
      {corpusSections.every((s) => (s === "findings" ? findings.length === 0 : datasets.length === 0)) &&
        !hasStudyDesignContent && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Fill in Study Design sections or add findings to import content here.
          </Typography>
        )}
    </Paper>
  );
}

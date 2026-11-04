"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";
import { DisabledTooltipButton } from "@/components/DisabledTooltipButton";
import { peggyApi, queryKeys } from "@/lib/api";
import { suggestTest, type GroupCount, type OutcomeType, type Pairing, type TestSelector } from "@/lib/analysisTestSelector";
import { profileTable, type ColumnKind } from "@/lib/columnStats";
import { parsePastedTable } from "@/lib/parsePastedTable";
import { blocksLlmGuidance } from "@/lib/sensitiveData";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { useWorkspace } from "@/lib/workspaceContext";

export function AnalysisToolFeature() {
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, commitSection, isSaving } = useStudyDesign(activeWorkspace?.id);
  const blocked = blocksLlmGuidance(studyDesign.samples?.identifierLevel);
  const saved = studyDesign.analysisTool ?? {};

  const [fileName, setFileName] = useState(saved.fileName ?? "");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [search, setSearch] = useState("");
  const [columnFilter, setColumnFilter] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [selector, setSelector] = useState<TestSelector>({
    outcome: saved.lastSelector?.outcome ?? "continuous",
    groups: saved.lastSelector?.groups ?? "2",
    pairing: saved.lastSelector?.pairing ?? "independent",
  });
  const [kindOverrides, setKindOverrides] = useState<Record<string, ColumnKind>>(saved.columnTypes ?? {});
  const [sampleId, setSampleId] = useState("");
  const [sampleLoading, setSampleLoading] = useState(false);

  const datasets = useQuery({
    queryKey: queryKeys.corpus("sample_datasets", activeWorkspace?.id),
    queryFn: () => peggyApi.listCorpus("sample_datasets", activeWorkspace?.id),
    enabled: !!activeWorkspace?.id,
  });
  const samplePapers = datasets.data?.papers ?? [];

  const profiles = useMemo(() => {
    const base = profileTable(headers, rows);
    return base.map((p) => {
      const override = kindOverrides[p.name];
      return override && override !== p.kind ? { ...p, kind: override } : p;
    });
  }, [headers, rows, kindOverrides]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (q && !row.some((c) => c.toLowerCase().includes(q))) return false;
      if (columnFilter) {
        const idx = headers.indexOf(columnFilter);
        if (idx >= 0 && !row[idx]?.trim()) return false;
      }
      return true;
    });
  }, [rows, search, columnFilter, headers]);

  const outcomeProfile = profiles.find((p) => p.kind === "continuous") ?? profiles[0];
  const suggestion = suggestTest(selector, outcomeProfile?.parametricHint);

  const onFile = async (file: File) => {
    setParseError(null);
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".tsv") && !lower.endsWith(".txt")) {
      setParseError("CSV only for now (also TSV/plain text). SPSS files are not supported in v1.");
      return;
    }
    applyParsed(file.name, parsePastedTable(await file.text()));
  };

  const applyParsed = (name: string, parsed: ReturnType<typeof parsePastedTable>) => {
    if ("error" in parsed) {
      setParseError(parsed.error);
      return;
    }
    setFileName(name);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    const inferred: Record<string, ColumnKind> = {};
    for (const p of profileTable(parsed.headers, parsed.rows)) inferred[p.name] = p.kind;
    setKindOverrides(inferred);
  };

  const loadSample = async () => {
    const id = Number(sampleId);
    if (!id) return;
    setParseError(null);
    setSampleLoading(true);
    try {
      const paper = samplePapers.find((p) => p.id === id);
      const text = await peggyApi.getPaperText(id);
      applyParsed(paper?.title || "Sample dataset", parsePastedTable(text.text || ""));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Could not load sample file.");
    } finally {
      setSampleLoading(false);
    }
  };

  const saveMeta = () => {
    const columnTypes: Record<string, ColumnKind> = {};
    for (const p of profiles) columnTypes[p.name] = p.kind;
    void commitSection("analysisTool", {
      fileName,
      columnTypes,
      lastSelector: selector,
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="04 · Analysis tool"
        title="Analysis tool"
        description="Use a sample dataset already on this project, or upload a new CSV. Peggy does not store the CSV; you can save column types and the last test choice."
      />
      <PageSection>
        <Stack spacing={2}>
          <Alert severity="info">CSV only for now. SPSS is not supported in this version.</Alert>
          {blocked ? (
            <Alert severity="warning">
              Samples are marked identifiable. Update Samples & datasets to de-identified before uploading a data file.
            </Alert>
          ) : null}
          {samplePapers.length > 0 ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <FormControl size="small" sx={{ minWidth: 260 }} disabled={blocked}>
                <InputLabel>Sample dataset on this project</InputLabel>
                <Select
                  label="Sample dataset on this project"
                  value={sampleId}
                  onChange={(e) => setSampleId(e.target.value)}
                >
                  {samplePapers.map((p) => (
                    <MenuItem key={p.id} value={String(p.id)}>
                      {p.title || `File ${p.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                disabled={blocked || !sampleId || sampleLoading}
                sx={{ textTransform: "none" }}
                onClick={() => void loadSample()}
              >
                {sampleLoading ? "Loading…" : "Use this file"}
              </Button>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No sample datasets on this project yet. Upload one on Samples, or add a CSV below.
            </Typography>
          )}
          <DisabledTooltipButton title={blocked ? "Blocked while samples are identifiable" : ""}>
            <Button component="label" variant="outlined" disabled={blocked} sx={{ textTransform: "none", alignSelf: "flex-start" }}>
              Upload new CSV
              <input
                type="file"
                hidden
                accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                disabled={blocked}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFile(file);
                  e.target.value = "";
                }}
              />
            </Button>
          </DisabledTooltipButton>
          {parseError ? <Alert severity="error">{parseError}</Alert> : null}
          {fileName ? (
            <Typography variant="body2" color="text.secondary">
              Loaded: {fileName} ({rows.length} rows). File stays in this browser session.
            </Typography>
          ) : saved.fileName ? (
            <Typography variant="body2" color="text.secondary">
              Last saved file name: {saved.fileName} (reload the CSV to see the table).
            </Typography>
          ) : null}

          {headers.length > 0 ? (
            <>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <TextField
                  size="small"
                  label="Search rows"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Require column</InputLabel>
                  <Select
                    label="Require column"
                    value={columnFilter}
                    onChange={(e) => setColumnFilter(e.target.value)}
                  >
                    <MenuItem value="">None</MenuItem>
                    {headers.map((h) => (
                      <MenuItem key={h} value={h}>
                        {h}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {headers.map((h) => (
                      <TableCell key={h}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRows.slice(0, 80).map((row, i) => (
                    <TableRow key={i}>
                      {headers.map((_, c) => (
                        <TableCell key={c}>{row[c]}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredRows.length > 80 ? (
                <Typography variant="caption">Showing first 80 of {filteredRows.length} matching rows.</Typography>
              ) : null}

              <Typography variant="subtitle2">Column summaries</Typography>
              {profiles.map((p) => (
                <Stack key={p.name} spacing={0.5} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography fontWeight={600}>{p.name}</Typography>
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <InputLabel>Type</InputLabel>
                      <Select
                        label="Type"
                        value={p.kind}
                        onChange={(e) =>
                          setKindOverrides((prev) => ({ ...prev, [p.name]: e.target.value as ColumnKind }))
                        }
                      >
                        <MenuItem value="continuous">Continuous</MenuItem>
                        <MenuItem value="categorical">Categorical</MenuItem>
                      </Select>
                    </FormControl>
                  </Stack>
                  {p.kind === "continuous" ? (
                    <Typography variant="body2">
                      n={p.n} missing={p.missing}
                      {p.mean != null ? ` mean=${p.mean.toFixed(3)}` : ""}
                      {p.sd != null ? ` sd=${p.sd.toFixed(3)}` : ""}
                      {p.median != null ? ` median=${p.median.toFixed(3)}` : ""}
                      {p.min != null ? ` min=${p.min}` : ""}
                      {p.max != null ? ` max=${p.max}` : ""}
                      {p.shapiroW != null ? ` Shapiro-like W'=${p.shapiroW.toFixed(3)}` : ""}
                      {` → ${p.parametricHint === "parametric" ? "parametric tests OK" : p.parametricHint === "nonparametric" ? "prefer non-parametric" : ""}`}
                    </Typography>
                  ) : (
                    <Typography variant="body2">
                      n={p.n} missing={p.missing}. Frequencies:{" "}
                      {(p.frequencies ?? []).map((f) => `${f.value} (${f.count})`).join("; ") || "none"}
                    </Typography>
                  )}
                </Stack>
              ))}
            </>
          ) : null}

          <Typography variant="subtitle2">Test selector</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Outcome</InputLabel>
              <Select
                label="Outcome"
                value={selector.outcome}
                onChange={(e) => setSelector({ ...selector, outcome: e.target.value as OutcomeType })}
              >
                <MenuItem value="continuous">Continuous</MenuItem>
                <MenuItem value="ordinal">Ordinal</MenuItem>
                <MenuItem value="categorical">Categorical</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Groups</InputLabel>
              <Select
                label="Groups"
                value={selector.groups}
                onChange={(e) => setSelector({ ...selector, groups: e.target.value as GroupCount })}
              >
                <MenuItem value="1">1</MenuItem>
                <MenuItem value="2">2</MenuItem>
                <MenuItem value="3plus">3 or more</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Design</InputLabel>
              <Select
                label="Design"
                value={selector.pairing}
                onChange={(e) => setSelector({ ...selector, pairing: e.target.value as Pairing })}
              >
                <MenuItem value="independent">Independent</MenuItem>
                <MenuItem value="paired">Paired / repeated</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Alert severity="success">
            Suggested test: {suggestion.test}. {suggestion.why} Peggy does not run the test.
          </Alert>
          <Button
            variant="contained"
            sx={{ alignSelf: "flex-start", textTransform: "none" }}
            disabled={isSaving}
            onClick={saveMeta}
          >
            {isSaving ? "Saving…" : "Save column types and selector"}
          </Button>
        </Stack>
      </PageSection>
    </>
  );
}

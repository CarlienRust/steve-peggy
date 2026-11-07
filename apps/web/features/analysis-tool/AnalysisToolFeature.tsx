"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { PageHeader } from "@/components/PageHeader";
import { DisabledTooltipButton } from "@/components/DisabledTooltipButton";
import { peggyApi, queryKeys } from "@/lib/api";
import { suggestTest, type GroupCount, type OutcomeType, type Pairing, type TestSelector } from "@/lib/analysisTestSelector";
import { profileTable, type ColumnKind } from "@/lib/columnStats";
import { parsePastedTable } from "@/lib/parsePastedTable";
import { parseSavTable } from "@/lib/parseSavTable";
import { blocksLlmGuidance } from "@/lib/sensitiveData";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { useWorkspace } from "@/lib/workspaceContext";
import { eyebrowSx } from "@/theme/peggyTheme";

function kindToOutcome(kind: ColumnKind | undefined): OutcomeType {
  if (kind === "categorical") return "categorical";
  return "continuous";
}

const PAGE_SIZE = 20;

export function AnalysisToolFeature() {
  const { activeWorkspace } = useWorkspace();
  const { studyDesign, commitSection, isSaving } = useStudyDesign(activeWorkspace?.id);
  const blocked = blocksLlmGuidance(studyDesign.samples?.identifierLevel);
  const saved = studyDesign.analysisTool ?? {};

  const [fileName, setFileName] = useState(saved.fileName ?? "");
  const [headers, setHeaders] = useState<string[]>(saved.headers ?? []);
  const [rows, setRows] = useState<string[][]>(saved.rows ?? []);
  const [hydrated, setHydrated] = useState(!!saved.headers?.length);
  const [search, setSearch] = useState("");
  const [columnFilter, setColumnFilter] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [datasetNote, setDatasetNote] = useState<string | null>(null);
  const [selector, setSelector] = useState<TestSelector>({
    outcome: saved.lastSelector?.outcome ?? "continuous",
    groups: saved.lastSelector?.groups ?? "2",
    pairing: saved.lastSelector?.pairing ?? "independent",
  });
  const [kindOverrides, setKindOverrides] = useState<Record<string, ColumnKind>>(saved.columnTypes ?? {});
  const [sampleId, setSampleId] = useState("");
  const [sampleLoading, setSampleLoading] = useState(false);
  const [outcomeColumn, setOutcomeColumn] = useState("");
  const [guideCols, setGuideCols] = useState<string[]>([]);
  const [whyOpen, setWhyOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [adminCols, setAdminCols] = useState<string[]>(saved.adminColumns ?? []);
  const [page, setPage] = useState(0);
  const [summaryCols, setSummaryCols] = useState<string[]>([]);

  useEffect(() => {
    if (hydrated) return;
    if (!saved.headers?.length) return;
    setFileName(saved.fileName ?? "");
    setHeaders(saved.headers);
    setRows(saved.rows ?? []);
    setAdminCols(saved.adminColumns ?? []);
    setSummaryCols(saved.headers.slice(0, Math.min(3, saved.headers.length)));
    const first =
      saved.headers.find((h) => !(saved.adminColumns ?? []).includes(h)) ?? saved.headers[0] ?? "";
    setOutcomeColumn(first);
    if (first) setGuideCols([first]);
    setHydrated(true);
  }, [hydrated, saved.adminColumns, saved.fileName, saved.headers, saved.rows]);

  const datasets = useQuery({
    queryKey: queryKeys.corpus("sample_datasets", activeWorkspace?.id),
    queryFn: () => peggyApi.listCorpus("sample_datasets", activeWorkspace?.id),
    enabled: !!activeWorkspace?.id,
  });
  const samplePapers = datasets.data?.papers ?? [];

  const dataHeaders = useMemo(
    () => headers.filter((h) => !adminCols.includes(h)),
    [headers, adminCols]
  );

  const profiles = useMemo(() => {
    const base = profileTable(headers, rows);
    return base.map((p) => {
      const override = kindOverrides[p.name];
      return override && override !== p.kind ? { ...p, kind: override } : p;
    });
  }, [headers, rows, kindOverrides]);

  const dataProfiles = useMemo(
    () => profiles.filter((p) => dataHeaders.includes(p.name)),
    [profiles, dataHeaders]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        if (q && !row.some((c) => c.toLowerCase().includes(q))) return false;
        if (columnFilter) {
          const idx = headers.indexOf(columnFilter);
          if (idx >= 0 && !row[idx]?.trim()) return false;
        }
        return true;
      });
  }, [rows, search, columnFilter, headers]);

  const pageRows = filteredRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const outcomeProfile =
    (outcomeColumn ? dataProfiles.find((p) => p.name === outcomeColumn) : undefined) ??
    dataProfiles.find((p) => p.kind === "continuous") ??
    dataProfiles[0];
  const suggestion = suggestTest(selector, outcomeProfile?.parametricHint);

  const applyParsed = (name: string, parsed: ReturnType<typeof parsePastedTable>) => {
    if ("error" in parsed) {
      setParseError(parsed.error);
      return;
    }
    setDatasetNote(parsed.warning ?? null);
    setFileName(name);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setAdminCols([]);
    setPage(0);
    setSummaryCols(parsed.headers.slice(0, Math.min(3, parsed.headers.length)));
    const inferred: Record<string, ColumnKind> = {};
    for (const p of profileTable(parsed.headers, parsed.rows)) inferred[p.name] = p.kind;
    setKindOverrides(inferred);
    const first = parsed.headers[0] ?? "";
    setOutcomeColumn(first);
    setGuideCols(first ? [first] : []);
    if (first && inferred[first]) {
      setSelector((s) => ({ ...s, outcome: kindToOutcome(inferred[first]) }));
    }
  };

  const onFile = async (file: File) => {
    setParseError(null);
    setDatasetNote(null);
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".sav") || lower.endsWith(".zsav")) {
      applyParsed(file.name, await parseSavTable(file));
      return;
    }
    if (!lower.endsWith(".csv") && !lower.endsWith(".tsv") && !lower.endsWith(".txt")) {
      setParseError("Use CSV, TSV, plain text, or SPSS SAV.");
      return;
    }
    applyParsed(file.name, parsePastedTable(await file.text()));
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
      headers,
      rows,
      columnTypes,
      adminColumns: adminCols,
      lastSelector: selector,
    });
  };

  const fileInput = (
    <input
      type="file"
      hidden
      accept=".csv,.tsv,.txt,.sav,.zsav,text/csv,text/tab-separated-values,application/x-spss-sav"
      disabled={blocked}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void onFile(file);
        e.target.value = "";
      }}
    />
  );

  return (
    <>
      <PageHeader
        eyebrow="ANALYSIS TOOL"
        title="Statistical analysis"
        description="Configure and prepare your statistical analysis."
      />
      <Stack spacing={3}>
        {blocked ? (
          <Alert severity="warning">
            Samples are marked identifiable. Update Samples & datasets to de-identified before uploading a data file.
          </Alert>
        ) : null}

        <Box>
          <Typography sx={{ ...eyebrowSx, mb: 1.5 }}>01 Dataset</Typography>
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              borderRadius: 2,
              textAlign: "center",
              borderStyle: dragOver ? "dashed" : "solid",
              bgcolor: dragOver ? "action.hover" : "background.paper",
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!blocked) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file && !blocked) void onFile(file);
            }}
          >
            <Typography fontWeight={600} sx={{ mb: 0.5 }}>
              Upload dataset
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Drag and drop or browse files. CSV, TSV, or SPSS SAV. Save configuration to keep the file on this project.
            </Typography>
            <DisabledTooltipButton title={blocked ? "Blocked while samples are identifiable" : ""}>
              <Button component="label" variant="contained" disabled={blocked}>
                Upload dataset
                {fileInput}
              </Button>
            </DisabledTooltipButton>
          </Paper>
          {samplePapers.length > 0 ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ mt: 2 }}>
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
                onClick={() => void loadSample()}
              >
                {sampleLoading ? "Loading…" : "Use this file"}
              </Button>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              No sample datasets on this project yet. Upload one on Samples, or add a CSV or SAV above.
            </Typography>
          )}
          {parseError ? <Alert severity="error" sx={{ mt: 1.5 }}>{parseError}</Alert> : null}
          {datasetNote ? <Alert severity="info" sx={{ mt: 1.5 }}>{datasetNote}</Alert> : null}
          {fileName ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Loaded: {fileName} ({rows.length} rows). Click Save configuration to store this dataset on the project.
            </Typography>
          ) : null}
        </Box>

        <Box>
          <Typography sx={{ ...eyebrowSx, mb: 1.5 }}>02 Dataset overview</Typography>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Stack spacing={2}>
              {headers.length > 0 ? (
                <>
                  <Autocomplete
                    multiple
                    size="small"
                    options={headers}
                    value={adminCols}
                    onChange={(_, value) => {
                      setAdminCols(value);
                      if (outcomeColumn && value.includes(outcomeColumn)) {
                        const next = headers.find((h) => !value.includes(h)) ?? "";
                        setOutcomeColumn(next);
                        const kind = profiles.find((p) => p.name === next)?.kind;
                        if (kind) setSelector((s) => ({ ...s, outcome: kindToOutcome(kind) }));
                      }
                    }}
                    renderTags={(value, getTagProps) =>
                      value.map((option, i) => <Chip {...getTagProps({ index: i })} key={option} label={option} size="small" />)
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Admin-related columns"
                        placeholder="IDs, interviewer fields, not for tests"
                      />
                    )}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Outcome and suggested tests use participant columns only ({dataHeaders.length} of {headers.length}).
                    Admin columns stay in the table.
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <TextField
                      size="small"
                      label="Search rows"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(0);
                      }}
                    />
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <InputLabel>Require column</InputLabel>
                      <Select
                        label="Require column"
                        value={columnFilter}
                        onChange={(e) => {
                          setColumnFilter(e.target.value);
                          setPage(0);
                        }}
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
                  <TableContainer sx={{ maxHeight: 360, border: 1, borderColor: "divider", borderRadius: 1 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>#</TableCell>
                          {headers.map((h) => (
                            <TableCell key={h} sx={{ whiteSpace: "nowrap" }}>
                              {h}
                              {adminCols.includes(h) ? (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  Admin
                                </Typography>
                              ) : null}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pageRows.map(({ row, index }) => (
                          <TableRow key={index} hover>
                            <TableCell>{index + 1}</TableCell>
                            {headers.map((_, c) => (
                              <TableCell key={c} sx={{ whiteSpace: "nowrap" }}>
                                {row[c]}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={filteredRows.length}
                    page={page}
                    onPageChange={(_, next) => setPage(next)}
                    rowsPerPage={PAGE_SIZE}
                    rowsPerPageOptions={[PAGE_SIZE]}
                  />
                  <Autocomplete
                    multiple
                    size="small"
                    options={headers}
                    value={summaryCols}
                    onChange={(_, value) => setSummaryCols(value)}
                    renderTags={(value, getTagProps) =>
                      value.map((option, i) => <Chip {...getTagProps({ index: i })} key={option} label={option} size="small" />)
                    }
                    renderInput={(params) => (
                      <TextField {...params} label="Column summaries to show" placeholder="Choose columns" />
                    )}
                  />
                  {profiles
                    .filter((p) => summaryCols.includes(p.name))
                    .map((p) => (
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
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Load a dataset to set column types, preview rows, and see descriptives.
                </Typography>
              )}
            </Stack>
          </Paper>
        </Box>

        <Box>
          <Typography sx={{ ...eyebrowSx, mb: 1.5 }}>03 Analysis guidance</Typography>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Stack spacing={2}>
              <Autocomplete
                multiple
                size="small"
                options={dataHeaders}
                value={guideCols.filter((c) => dataHeaders.includes(c))}
                onChange={(_, value) => {
                  setGuideCols(value);
                  const first = value[0] ?? "";
                  setOutcomeColumn(first);
                  const kind = profiles.find((p) => p.name === first)?.kind;
                  if (kind) setSelector((s) => ({ ...s, outcome: kindToOutcome(kind) }));
                }}
                disabled={dataHeaders.length === 0}
                renderTags={(value, getTagProps) =>
                  value.map((option, i) => <Chip {...getTagProps({ index: i })} key={option} label={option} size="small" />)
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Columns to guide the test"
                    placeholder="Select participant columns"
                    helperText="Peggy uses these columns to suggest a test. Admin columns are excluded."
                  />
                )}
              />
              <FormControl size="small" fullWidth>
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
              <FormControl size="small" fullWidth>
                <InputLabel>Study design</InputLabel>
                <Select
                  label="Study design"
                  value={selector.pairing}
                  onChange={(e) => setSelector({ ...selector, pairing: e.target.value as Pairing })}
                >
                  <MenuItem value="independent">Independent</MenuItem>
                  <MenuItem value="paired">Paired / repeated</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Outcome type</InputLabel>
                <Select
                  label="Outcome type"
                  value={selector.outcome}
                  onChange={(e) => setSelector({ ...selector, outcome: e.target.value as OutcomeType })}
                >
                  <MenuItem value="continuous">Continuous</MenuItem>
                  <MenuItem value="ordinal">Ordinal</MenuItem>
                  <MenuItem value="categorical">Categorical</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary">
                Suggested test
              </Typography>
              <Typography fontWeight={600}>
                {suggestion.test}
              </Typography>
              {whyOpen ? (
                <Typography variant="body2">
                  {suggestion.why}
                  {guideCols.length ? ` Columns: ${guideCols.join(", ")}.` : ""} Peggy does not run the test.
                </Typography>
              ) : null}
              <Button size="small" variant="outlined" onClick={() => setWhyOpen((v) => !v)}>
                Why this test?
              </Button>
            </Stack>
          </Paper>
        </Box>

        <Button variant="contained" sx={{ alignSelf: "flex-start" }} disabled={isSaving} onClick={saveMeta}>
          {isSaving ? "Saving…" : "Save configuration"}
        </Button>
      </Stack>
    </>
  );
}

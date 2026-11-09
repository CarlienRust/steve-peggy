"use client";

import { useEffect, useMemo, useState } from "react";
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
import { suggestTest, type GroupCount, type OutcomeType, type Pairing, type TestSelector } from "@/lib/analysisTestSelector";
import { runSuggestedTest } from "@/lib/analysisRun";
import { formatSuppressedCount, profileTable, type ColumnKind } from "@/lib/columnStats";
import { parsePastedTable } from "@/lib/parsePastedTable";
import { looksLikeSavFile, parseSavTable } from "@/lib/parseSavTable";
import { blocksLlmGuidance } from "@/lib/sensitiveData";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { useWorkspace } from "@/lib/workspaceContext";
import { eyebrowSx } from "@/theme/peggyTheme";
import { defaultAdminColumns, groupSizeWarns, smallestGroupSize } from "@/lib/identifierColumns";
import { clearAnalysisRows, loadAnalysisRows, saveAnalysisRows } from "@/lib/analysisIdb";
import { dictionaryCsv } from "@/lib/analysisDictionary";
import { missingVsPlan } from "@/lib/analysisPlanCheck";
import { starterPython, starterR } from "@/lib/analysisStarterScript";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { peggyApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

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

  const [fileName, setFileName] = useState("");
  const [datasetLabel, setDatasetLabel] = useState(saved.label ?? "");
  const [headers, setHeaders] = useState<string[]>(saved.headers ?? []);
  const [rows, setRows] = useState<string[][]>([]);
  const [hydrated, setHydrated] = useState(!!saved.headers?.length);
  const [cellThreshold, setCellThreshold] = useState(5);
  const [quasiCols, setQuasiCols] = useState<string[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePreview, setSharePreview] = useState("");
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
  const [outcomeColumn, setOutcomeColumn] = useState("");
  const [guideCols, setGuideCols] = useState<string[]>([]);
  const [whyOpen, setWhyOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [adminCols, setAdminCols] = useState<string[]>(saved.adminColumns ?? []);
  const [page, setPage] = useState(0);
  const [summaryCols, setSummaryCols] = useState<string[]>([]);
  const [runResult, setRunResult] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated) return;
    if (!saved.headers?.length) return;
    setDatasetLabel(saved.label ?? "");
    setHeaders(saved.headers);
    setRows([]);
    setAdminCols(saved.adminColumns ?? []);
    if (activeWorkspace?.id) {
      void loadAnalysisRows(activeWorkspace.id).then((stored) => {
        if (stored?.length) setRows(stored);
      });
    }
    setSummaryCols(saved.headers.slice(0, Math.min(3, saved.headers.length)));
    const first =
      saved.headers.find((h) => !(saved.adminColumns ?? []).includes(h)) ?? saved.headers[0] ?? "";
    setOutcomeColumn(first);
    if (first) setGuideCols([first]);
    setHydrated(true);
  }, [hydrated, saved.adminColumns, saved.label, saved.headers, activeWorkspace?.id]);

  const dataHeaders = useMemo(
    () => headers.filter((h) => !adminCols.includes(h)),
    [headers, adminCols]
  );

  const profiles = useMemo(
    () => profileTable(headers, rows, kindOverrides),
    [headers, rows, kindOverrides]
  );

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
    setDatasetLabel((prev) => prev || name.replace(/\.[^.]+$/, ""));
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setAdminCols(defaultAdminColumns(parsed.headers));
    if (activeWorkspace?.id) void saveAnalysisRows(activeWorkspace.id, parsed.rows);
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
    if (lower.endsWith(".sav") || lower.endsWith(".zsav") || (await looksLikeSavFile(file))) {
      applyParsed(file.name, await parseSavTable(file));
      return;
    }
    if (!lower.endsWith(".csv") && !lower.endsWith(".tsv") && !lower.endsWith(".txt")) {
      setParseError("Use CSV, TSV, plain text, or SPSS SAV.");
      return;
    }
    applyParsed(file.name, parsePastedTable(await file.text()));
  };

  const columnRoles = useMemo(() => {
    const roles: Record<string, string> = {};
    for (const h of headers) roles[h] = adminCols.includes(h) ? "admin" : "analysis";
    return roles;
  }, [headers, adminCols]);

  const analysisProfiles = useMemo(
    () => profiles.filter((p) => !adminCols.includes(p.name)),
    [profiles, adminCols]
  );

  const aggregates = useMemo(() => {
    return analysisProfiles.map((p) => ({
      name: p.name,
      kind: p.kind,
      n: p.n,
      missingPercent: p.missingPercent,
      mean: p.mean,
      sd: p.sd,
      median: p.median,
      iqr: p.iqr,
      frequencies: (p.frequencies ?? []).map((f) => ({
        value: f.value,
        count: formatSuppressedCount(f.count, cellThreshold),
      })),
    }));
  }, [analysisProfiles, cellThreshold]);

  const coverage = useQuery({
    queryKey: ["confounder-audit", activeWorkspace?.id],
    queryFn: () => peggyApi.getConfounderAudit(activeWorkspace!.id),
    enabled: !!activeWorkspace?.id,
  });

  const planGaps = useMemo(() => {
    const planText = [
      studyDesign.analysisPlan?.userPlan,
      ...(studyDesign.analysisPlan?.steps ?? []).map((s) => (typeof s === "string" ? s : s.title)),
    ]
      .filter(Boolean)
      .join("\n");
    const items = coverage.data?.items ?? [];
    const similarN = items.reduce((a, b) => a + b.papers, 0) || items.length;
    return missingVsPlan(
      headers.filter((h) => !adminCols.includes(h)),
      planText,
      items,
      similarN || 6
    );
  }, [studyDesign.analysisPlan, coverage.data, headers, adminCols]);

  const saveMeta = () => {
    const columnTypes: Record<string, ColumnKind> = {};
    for (const p of profiles) columnTypes[p.name] = p.kind;
    void commitSection("analysisTool", {
      label: datasetLabel.trim() || "Dataset",
      headers,
      columnRoles,
      columnTypes,
      aggregates,
      adminColumns: adminCols,
      lastSelector: selector,
      cellThreshold,
    });
  };

  const downloadBlob = (name: string, text: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
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
              CSV, TSV, or SPSS SAV. Table rows stay in this browser only. Save stores the dataset label, headers, roles, types, and aggregates. No rows go to the server.
            </Typography>
            <DisabledTooltipButton title={blocked ? "Blocked while samples are identifiable" : ""}>
              <Button component="label" variant="contained" disabled={blocked}>
                Upload dataset
                {fileInput}
              </Button>
            </DisabledTooltipButton>
          </Paper>
          {parseError ? <Alert severity="error" sx={{ mt: 1.5 }}>{parseError}</Alert> : null}
          {datasetNote ? <Alert severity="info" sx={{ mt: 1.5 }}>{datasetNote}</Alert> : null}
          <TextField
            size="small"
            label="Dataset label"
            value={datasetLabel}
            onChange={(e) => setDatasetLabel(e.target.value)}
            sx={{ mt: 1.5, maxWidth: 360 }}
          />
          {rows.length ? (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              Table stored in this browser only ({rows.length} rows{fileName ? `, from ${fileName}` : ""}).
              <Button
                size="small"
                sx={{ ml: 1, textTransform: "none" }}
                onClick={() => {
                  setRows([]);
                  if (activeWorkspace?.id) void clearAnalysisRows(activeWorkspace.id);
                }}
              >
                Clear
              </Button>
            </Alert>
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
                      setSummaryCols((prev) => prev.filter((c) => !value.includes(c)));
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
                    Identifier-like headers are tagged admin and excluded from statistics. You can change the list.
                    Outcome and tests use analysis columns only ({dataHeaders.length} of {headers.length}).
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <TextField
                      size="small"
                      type="number"
                      label="Small-cell threshold"
                      value={cellThreshold}
                      onChange={(e) => setCellThreshold(Math.max(1, Number(e.target.value) || 5))}
                      sx={{ width: 180 }}
                    />
                    <Autocomplete
                      multiple
                      size="small"
                      options={dataHeaders}
                      value={quasiCols}
                      onChange={(_, v) => setQuasiCols(v)}
                      sx={{ minWidth: 260, flex: 1 }}
                      renderInput={(params) => (
                        <TextField {...params} label="Quasi-identifiers for group size" placeholder="age band, sex, site" />
                      )}
                    />
                  </Stack>
                  {groupSizeWarns(
                    smallestGroupSize(
                      rows,
                      quasiCols.map((c) => headers.indexOf(c)).filter((i) => i >= 0)
                    ),
                    cellThreshold
                  ) ? (
                    <Alert severity="warning">
                      Smallest group size is below {cellThreshold}. Consider broader bands or fewer quasi-identifiers.
                    </Alert>
                  ) : null}
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
                    options={dataHeaders}
                    value={summaryCols.filter((c) => dataHeaders.includes(c))}
                    onChange={(_, value) => setSummaryCols(value.filter((c) => !adminCols.includes(c)))}
                    renderTags={(value, getTagProps) =>
                      value.map((option, i) => <Chip {...getTagProps({ index: i })} key={option} label={option} size="small" />)
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Column summaries to show"
                        placeholder="Participant columns only"
                        helperText="Admin-related columns are excluded."
                      />
                    )}
                  />
                  {profiles
                    .filter((p) => summaryCols.includes(p.name) && dataHeaders.includes(p.name))
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
                          n={p.n} missing={p.missingPercent != null ? `${p.missingPercent.toFixed(1)}%` : p.missing}
                          {p.mean != null ? ` mean=${p.mean.toFixed(3)}` : ""}
                          {p.sd != null ? ` sd=${p.sd.toFixed(3)}` : ""}
                          {p.median != null ? ` median=${p.median.toFixed(3)}` : ""}
                          {p.iqr != null ? ` IQR=${p.iqr.toFixed(3)}` : ""}
                          {p.min != null ? ` min=${p.min}` : ""}
                          {p.max != null ? ` max=${p.max}` : ""}
                          {p.shapiroW != null ? ` Shapiro-like W'=${p.shapiroW.toFixed(3)}` : ""}
                          {` → ${p.parametricHint === "parametric" ? "parametric tests OK" : p.parametricHint === "nonparametric" ? "prefer non-parametric" : ""}`}
                        </Typography>
                      ) : (
                        <Stack spacing={0.5}>
                          <Typography variant="body2">
                            n={p.n} missing={p.missingPercent != null ? `${p.missingPercent.toFixed(1)}%` : p.missing}. Categories: {(p.frequencies ?? []).length}.
                          </Typography>
                          {(p.frequencies ?? []).map((f) => (
                            <Typography key={f.value} variant="body2">
                              {f.value || "(blank)"} — {formatSuppressedCount(f.count, cellThreshold)}
                              {p.n ? ` (${((100 * f.count) / p.n).toFixed(1)}%)` : ""}
                            </Typography>
                          ))}
                        </Stack>
                      )}
                      {p.histogram?.length ? (
                        <Stack direction="row" spacing={0.25} alignItems="flex-end" sx={{ height: 40, mt: 0.5 }}>
                          {p.histogram.map((b) => (
                            <Box
                              key={b.bin}
                              title={`${b.bin}: ${formatSuppressedCount(b.count, cellThreshold)}`}
                              sx={{
                                flex: 1,
                                bgcolor: "primary.main",
                                opacity: 0.7,
                                height: `${Math.max(4, (100 * b.count) / Math.max(...p.histogram!.map((x) => x.count), 1))}%`,
                              }}
                            />
                          ))}
                        </Stack>
                      ) : null}
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
                  {guideCols.length ? ` Columns: ${guideCols.join(", ")}.` : ""}
                </Typography>
              ) : null}
              <Button size="small" variant="outlined" onClick={() => setWhyOpen((v) => !v)}>
                Why this test?
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={!outcomeColumn || rows.length === 0}
                onClick={() => {
                  const oi = headers.indexOf(outcomeColumn);
                  const gi = guideCols[1] ? headers.indexOf(guideCols[1]) : -1;
                  const outcomeVals = rows.map((r) => (oi >= 0 ? r[oi] ?? "" : ""));
                  const groupVals = gi >= 0 ? rows.map((r) => r[gi] ?? "") : undefined;
                  const result = runSuggestedTest(suggestion, outcomeVals, groupVals);
                  setRunResult(result.summary);
                  setWhyOpen(true);
                }}
              >
                Run on this dataset
              </Button>
              {runResult ? <Typography variant="body2">{runResult}</Typography> : null}
              <Typography variant="caption" color="text.secondary">
                Uses the first selected guide column as the outcome and the second as the grouping column when present.
                p-values are normal approximations, not a full stats package.
              </Typography>
            </Stack>
          </Paper>
        </Box>

        {planGaps.length ? (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography fontWeight={600} sx={{ mb: 1 }}>
              Check against the analysis plan
            </Typography>
            {planGaps.map((g) => (
              <Typography key={g} variant="body2">
                {g}
              </Typography>
            ))}
          </Paper>
        ) : null}

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button variant="contained" disabled={isSaving} onClick={saveMeta}>
            {isSaving ? "Saving…" : "Save configuration"}
          </Button>
          <Button
            variant="outlined"
            disabled={!headers.length}
            onClick={() =>
              downloadBlob(
                "data-dictionary.csv",
                dictionaryCsv(headers, columnRoles, Object.fromEntries(profiles.map((p) => [p.name, p.kind])), profiles, cellThreshold, adminCols)
              )
            }
          >
            Export dictionary CSV
          </Button>
          <Button
            variant="outlined"
            disabled={!headers.length}
            onClick={() =>
              downloadBlob(
                "starter.py",
                starterPython(
                  headers.filter((h) => !adminCols.includes(h)),
                  columnRoles,
                  (studyDesign.analysisPlan?.steps ?? []).map((s) => (typeof s === "string" ? s : s.title))
                )
              )
            }
          >
            Python starter
          </Button>
          <Button
            variant="outlined"
            disabled={!headers.length}
            onClick={() =>
              downloadBlob(
                "starter.R",
                starterR(
                  headers.filter((h) => !adminCols.includes(h)),
                  columnRoles,
                  (studyDesign.analysisPlan?.steps ?? []).map((s) => (typeof s === "string" ? s : s.title))
                )
              )
            }
          >
            R starter
          </Button>
          <Button
            variant="outlined"
            disabled={!headers.length}
            onClick={() => {
              setSharePreview(JSON.stringify({ label: datasetLabel, headers: headers.filter((h) => !adminCols.includes(h)), columnRoles, aggregates }, null, 2));
              setShareOpen(true);
            }}
          >
            Share summary with Peggy
          </Button>
        </Stack>
      </Stack>
      <ConfirmDialog
        open={shareOpen}
        title="Share dataset summary?"
        body={`This sends class D aggregates only (no rows). Preview:\n${sharePreview.slice(0, 800)}`}
        confirmLabel="Share"
        onCancel={() => setShareOpen(false)}
        onConfirm={() => {
          if (!activeWorkspace?.id) return;
          void peggyApi
            .shareDatasetSummary(activeWorkspace.id, {
              label: datasetLabel,
              headers: headers.filter((h) => !adminCols.includes(h)),
              columnRoles,
              aggregates,
            })
            .then(() => setShareOpen(false));
        }}
      />
    </>
  );
}

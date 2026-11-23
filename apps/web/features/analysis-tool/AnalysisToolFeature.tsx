"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
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
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { PageHeader } from "@/components/PageHeader";
import { DisabledTooltipButton } from "@/components/DisabledTooltipButton";
import { InfoTip } from "@/components/InfoTip";
import { suggestTest, type GroupCount, type OutcomeType, type Pairing, type TestSelector } from "@/lib/analysisTestSelector";
import { runSuggestedTest } from "@/lib/analysisRun";
import { formatSuppressedCount, profileTable, type ColumnKind } from "@/lib/columnStats";
import { blocksLlmGuidance } from "@/lib/sensitiveData";
import { useStudyDesign } from "@/lib/useStudyDesign";
import { useWorkspace } from "@/lib/workspaceContext";
import { eyebrowSx } from "@/theme/peggyTheme";
import { defaultAdminColumns, groupSizeWarns, smallestGroupSize } from "@/lib/identifierColumns";
import { clearAnalysisRows, loadAnalysisRows, saveAnalysisRows } from "@/lib/analysisIdb";
import { dictionaryCsv } from "@/lib/analysisDictionary";
import { missingVsPlan } from "@/lib/analysisPlanCheck";
import { clipTable } from "@/lib/analysis/uploadGuard";
import { parseAnalysisFile, parseCorpusDataset } from "@/lib/analysis/parseAnalysisTable";
import { parsePastedTable } from "@/lib/parsePastedTable";
import { getAnalysisFunction, listAnalysisFunctions } from "@/lib/analysis/registry";
import { DATASET_UPLOAD_ACCEPT, datasetUploadTitle } from "@/lib/datasetFiles";
import { descriptivePython, descriptiveR, descriptiveSpss } from "@/lib/analysis/templates/descriptive";
import { regressionPython, regressionR } from "@/lib/analysis/templates/regressionScripts";
import { analysisProjectFiles, buildZip } from "@/lib/analysis/projectZip";
import { fitOls } from "@/lib/analysis/engines/regression";
import { ComputeProfileEditor } from "@/components/ComputeProfileEditor";
import { RunPathsPanel } from "@/features/analysis-tool/RunPathsPanel";
import { AnalysisRoutePanel } from "@/features/analysis-tool/AnalysisRoutePanel";
import { AnalysisRunsPanel } from "@/features/analysis-tool/AnalysisRunsPanel";
import { ResultsImportPanel } from "@/features/analysis-tool/ResultsImportPanel";
import {
  microbiomePython,
  snpGuidance,
  mlGuidance,
  dietPython,
  exposomePython,
  omicsPython,
} from "@/lib/analysis/templates/domainScripts";
import type { ScriptContext } from "@/lib/analysis/templates/render";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatApiError, peggyApi, queryKeys, type PaperRecord } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function kindToOutcome(kind: ColumnKind | undefined): OutcomeType {
  if (kind === "categorical") return "categorical";
  return "continuous";
}

const PAGE_SIZE = 20;

const ANALYSIS_FUNCTIONS = listAnalysisFunctions().filter((f) => f.id !== "dataset-description");

export function AnalysisToolFeature() {
  const { activeWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
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
  const [runResult, setRunResult] = useState<string | null>(saved.lastRunSummary ?? null);
  const [functionId, setFunctionId] = useState(
    saved.activeFunctionId && saved.activeFunctionId !== "dataset-description"
      ? saved.activeFunctionId
      : "linear-regression"
  );
  const [toolTab, setToolTab] = useState(0);
  const [descIds, setDescIds] = useState<number[]>([]);
  const [descPrimary, setDescPrimary] = useState<number | null>(null);
  const [analysisIds, setAnalysisIds] = useState<number[]>([]);
  const [analysisPrimary, setAnalysisPrimary] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [predictors, setPredictors] = useState<string[]>([]);
  const [regSummary, setRegSummary] = useState<string | null>(
    saved.lastRegression && typeof saved.lastRegression === "object"
      ? JSON.stringify(saved.lastRegression)
      : null
  );

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
    if (saved.cellThreshold) setCellThreshold(saved.cellThreshold);
    if (saved.lastRunSummary) setRunResult(saved.lastRunSummary);
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
    const clipped = clipTable(parsed.headers, parsed.rows);
    if (clipped.note) setDatasetNote((parsed.warning ? parsed.warning + " " : "") + clipped.note);
    setHeaders(clipped.headers);
    setRows(clipped.rows);
    setAdminCols(defaultAdminColumns(clipped.headers));
    if (activeWorkspace?.id) void saveAnalysisRows(activeWorkspace.id, clipped.rows);
    setPage(0);
    setSummaryCols(clipped.headers.slice(0, Math.min(3, clipped.headers.length)));
    const inferred: Record<string, ColumnKind> = {};
    for (const p of profileTable(clipped.headers, clipped.rows)) inferred[p.name] = p.kind;
    setKindOverrides(inferred);
    const first = clipped.headers[0] ?? "";
    setOutcomeColumn(first);
    setGuideCols(first ? [first] : []);
    if (first && inferred[first]) {
      setSelector((s) => ({ ...s, outcome: kindToOutcome(inferred[first]) }));
    }
  };

  const onFile = async (file: File) => {
    setParseError(null);
    setDatasetNote(null);
    const parsed = await parseAnalysisFile(file);
    if ("error" in parsed) {
      setParseError(parsed.error);
      return;
    }
    applyParsed(parsed.name, { headers: parsed.headers, rows: parsed.rows, warning: parsed.warning });
  };

  const datasetsQuery = useQuery({
    queryKey: queryKeys.corpus("sample_datasets", activeWorkspace?.id),
    queryFn: () => peggyApi.listCorpus("sample_datasets", activeWorkspace?.id),
    enabled: !!activeWorkspace?.id,
  });
  const datasetPapers = datasetsQuery.data?.papers ?? [];

  const loadPaper = async (paper: PaperRecord) => {
    if (!paper.id) return;
    setParseError(null);
    setTableLoading(true);
    try {
      const parsed = await parseCorpusDataset(paper);
      if ("error" in parsed) {
        setParseError(parsed.error);
        return;
      }
      applyParsed(parsed.name, { headers: parsed.headers, rows: parsed.rows, warning: parsed.warning });
      setDatasetLabel(paper.title || parsed.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setParseError(formatApiError(e));
    } finally {
      setTableLoading(false);
    }
  };

  const deleteMut = useMutation({
    mutationFn: (id: number) => peggyApi.deletePaper(id),
    onSuccess: (_, id) => {
      if (activeWorkspace?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.corpus("sample_datasets", activeWorkspace.id) });
      }
      setDescIds((prev) => prev.filter((x) => x !== id));
      setAnalysisIds((prev) => prev.filter((x) => x !== id));
      setDescPrimary((prev) => (prev === id ? null : prev));
      setAnalysisPrimary((prev) => (prev === id ? null : prev));
    },
    onError: (e) => setParseError(formatApiError(e)),
  });

  const toggleDataset = (
    paper: PaperRecord,
    ids: number[],
    setIds: (next: number[]) => void,
    primary: number | null,
    setPrimary: (id: number | null) => void,
    on: boolean
  ) => {
    const id = paper.id;
    if (id == null) return;
    const next = on ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((x) => x !== id);
    setIds(next);
    const nextPrimary = primary && next.includes(primary) ? primary : next[0] ?? null;
    setPrimary(nextPrimary);
    if (nextPrimary != null) {
      const toLoad = nextPrimary === id ? paper : datasetPapers.find((p) => p.id === nextPrimary);
      if (toLoad) void loadPaper(toLoad);
    }
  };

  const uploadAndStore = async (file: File) => {
    setParseError(null);
    setDatasetNote(null);
    const parsed = await parseAnalysisFile(file);
    if ("error" in parsed) {
      setParseError(parsed.error);
      return;
    }
    if (!activeWorkspace?.id) {
      applyParsed(parsed.name, { headers: parsed.headers, rows: parsed.rows, warning: parsed.warning });
      return;
    }
    setUploading(true);
    try {
      await peggyApi.uploadDocument(file, {
        sourceType: "sample_datasets",
        title: datasetUploadTitle(file),
        workspaceId: activeWorkspace.id,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.corpus("sample_datasets", activeWorkspace.id) });
    } catch (e) {
      setParseError((e as Error).message);
    } finally {
      setUploading(false);
    }
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
      similarN || 6,
      (studyDesign.analysisPlan?.steps ?? []).map((s) => (typeof s === "string" ? { title: s } : s))
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
      lastRunSummary: runResult ?? undefined,
      activeFunctionId: functionId,
      lastRegression: (() => {
        if (!regSummary) return undefined;
        try {
          return JSON.parse(regSummary) as Record<string, unknown>;
        } catch {
          return undefined;
        }
      })(),
    });
  };

  const analysisFn = getAnalysisFunction(functionId) ?? ANALYSIS_FUNCTIONS[0];

  const scriptCtx: ScriptContext = {
    headers,
    roles: columnRoles,
    adminColumns: adminCols,
    cellThreshold,
    covariates: [
      ...(studyDesign.analysisPlan?.covariateEntries ?? []).map((c) => c.description),
      ...(coverage.data?.items ?? []).map((i) => i.covariate),
    ].filter(Boolean),
    planSteps: (studyDesign.analysisPlan?.steps ?? []).map((s) => (typeof s === "string" ? s : s.title)),
    seed: 1,
    dataPath: "data/your-file.csv",
    outcome: outcomeColumn,
    predictors,
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
      accept={DATASET_UPLOAD_ACCEPT}
      disabled={blocked}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void uploadAndStore(file);
        e.target.value = "";
      }}
    />
  );

  return (
    <>
      <PageHeader
        eyebrow="ANALYSIS TOOL"
        title="Statistical analysis"
        info="Upload. Descriptives. Then one function."
      />
      <Stack spacing={3}>
        {blocked ? (
          <Alert severity="warning">
            Samples are identifiable. Switch to de-identified on Samples before upload.
          </Alert>
        ) : null}

        <Tabs
          value={toolTab}
          onChange={(_, v) => {
            setToolTab(v);
            const id = v === 1 ? descPrimary : v === 2 ? analysisPrimary : null;
            const paper = id != null ? datasetPapers.find((p) => p.id === id) : undefined;
            if (paper) void loadPaper(paper);
          }}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ mb: 1 }}
        >
          <Tab label="Datasets" sx={{ textTransform: "none" }} />
          <Tab label="Descriptives" sx={{ textTransform: "none" }} />
          <Tab label="Analysis" sx={{ textTransform: "none" }} />
        </Tabs>

        {toolTab === 0 ? (
        <Box>
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              borderRadius: 2,
              textAlign: "center",
              borderStyle: dragOver ? "dashed" : "solid",
              bgcolor: dragOver ? "action.hover" : "background.paper",
              mb: 2,
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
              if (file && !blocked) void uploadAndStore(file);
            }}
          >
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center" sx={{ mb: 2 }}>
              <Typography fontWeight={600}>
                Upload dataset
              </Typography>
              <InfoTip title="CSV, TSV, or SPSS SAV. Rows stay in this browser." />
            </Stack>
            <DisabledTooltipButton title={blocked ? "Blocked while samples are identifiable" : ""}>
              <Button component="label" variant="contained" disabled={blocked || uploading}>
                {uploading ? "Uploading…" : "Upload dataset"}
                {fileInput}
              </Button>
            </DisabledTooltipButton>
          </Paper>
          {parseError ? <Alert severity="error" sx={{ mb: 1.5 }}>{parseError}</Alert> : null}
          {datasetNote ? <Alert severity="info" sx={{ mb: 1.5 }}>{datasetNote}</Alert> : null}
          <Paper variant="outlined">
            {datasetsQuery.isLoading ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                Loading datasets…
              </Typography>
            ) : datasetsQuery.isError ? (
              <Typography variant="body2" color="error" sx={{ p: 2 }}>
                {formatApiError(datasetsQuery.error)}
              </Typography>
            ) : datasetPapers.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No datasets yet. Upload above or on Samples.
              </Typography>
            ) : (
              datasetPapers.map((p) => (
                <Stack
                  key={p.id ?? p.title}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ px: 2, py: 0.5, borderBottom: 1, borderColor: "divider" }}
                >
                  <Typography variant="body2">{p.title || "Untitled"}</Typography>
                  <IconButton
                    size="small"
                    aria-label="Delete"
                    disabled={!p.id || deleteMut.isPending}
                    onClick={() => {
                      if (p.id) deleteMut.mutate(p.id);
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))
            )}
          </Paper>
        </Box>
        ) : null}

        {toolTab === 1 ? (
        <Box>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1.5 }}>
            <Typography sx={eyebrowSx}>Descriptives</Typography>
            <InfoTip title="Tick a file from Datasets." />
          </Stack>
          {datasetPapers.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Upload files on Datasets first.
            </Alert>
          ) : (
            <Paper variant="outlined" sx={{ mb: 1.5 }}>
              {datasetPapers.map((p) => {
                const id = p.id;
                if (id == null) return null;
                return (
                  <FormControlLabel
                    key={id}
                    sx={{ display: "flex", mx: 0, px: 2, py: 0.5, borderBottom: 1, borderColor: "divider" }}
                    control={
                      <Checkbox
                        checked={descIds.includes(id)}
                        onChange={(_, on) =>
                          toggleDataset(p, descIds, setDescIds, descPrimary, setDescPrimary, on)
                        }
                      />
                    }
                    label={p.title || "Untitled"}
                  />
                );
              })}
            </Paper>
          )}
          {descIds.length > 1 ? (
            <FormControl size="small" sx={{ mb: 1.5, minWidth: 240 }}>
              <InputLabel>Show table</InputLabel>
              <Select
                label="Show table"
                value={descPrimary ?? ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setDescPrimary(id);
                  const paper = datasetPapers.find((p) => p.id === id);
                  if (paper) void loadPaper(paper);
                }}
              >
                {descIds.map((id) => (
                  <MenuItem key={id} value={id}>
                    {datasetPapers.find((p) => p.id === id)?.title || id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
          {descIds.length === 0 && datasetPapers.length > 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Choose one or more files uploaded on Datasets.
            </Alert>
          ) : null}
          <TextField
            size="small"
            label="Dataset label"
            value={datasetLabel}
            onChange={(e) => setDatasetLabel(e.target.value)}
            sx={{ mb: 1.5, maxWidth: 360 }}
          />
          {parseError ? <Alert severity="error" sx={{ mb: 1.5 }}>{parseError}</Alert> : null}
          {datasetNote ? <Alert severity="info" sx={{ mb: 1.5 }}>{datasetNote}</Alert> : null}
          {tableLoading ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <CircularProgress size={18} />
              <Typography variant="body2">Loading table…</Typography>
            </Stack>
          ) : null}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Stack spacing={2}>
              {headers.length > 0 && !tableLoading ? (
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
                    Admin columns are excluded from stats ({dataHeaders.length} of {headers.length} used).
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
                          {p.shapiroW != null
                            ? ` Shapiro–Francia-style W′=${p.shapiroW.toFixed(3)} (approximate, not a Shapiro–Wilk p-value)`
                            : ""}
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
              ) : Array.isArray(saved.aggregates) && saved.aggregates.length ? (
                <>
                  <Typography variant="body2" color="text.secondary">
                    Last saved descriptives (no table loaded in this browser).
                  </Typography>
                  {(saved.aggregates as { name?: string; kind?: string; n?: number; missingPercent?: number; mean?: number; sd?: number }[]).map(
                    (p) => (
                      <Typography key={String(p.name)} variant="body2">
                        {p.name} ({p.kind}): n={p.n}
                        {p.missingPercent != null ? ` missing=${p.missingPercent}%` : ""}
                        {p.mean != null ? ` mean=${p.mean}` : ""}
                        {p.sd != null ? ` sd=${p.sd}` : ""}
                      </Typography>
                    )
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Load a dataset to set column types, preview rows, and see descriptives. After Save last results you can
                  reopen those numbers without the file.
                </Typography>
              )}
            </Stack>
          </Paper>
          {headers.length ? (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mt: 2 }}>
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
                <Typography fontWeight={600}>
                  Which tests fit these columns
                </Typography>
                <InfoTip title="First column is outcome. Second is grouping." />
              </Stack>
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
                  renderInput={(params) => (
                    <TextField {...params} label="Columns" placeholder="Outcome, then grouping column" />
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
                <Typography fontWeight={600}>{suggestion.test}</Typography>
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
                    void commitSection("analysisTool", {
                      ...(studyDesign.analysisTool ?? {}),
                      lastRunSummary: result.summary,
                      lastSelector: selector,
                    });
                  }}
                >
                  Run on this dataset
                </Button>
                {runResult ? (
                  <Alert severity="success">Last result: {runResult}</Alert>
                ) : null}
              </Stack>
            </Paper>
          ) : null}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
            <Button variant="contained" disabled={isSaving || !headers.length} onClick={saveMeta}>
              {isSaving ? "Saving…" : "Save last results"}
            </Button>
            <InfoTip title="Stores summaries. Not rows." />
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
            <Button variant="outlined" disabled={!headers.length} onClick={() => downloadBlob("describe.py", descriptivePython(scriptCtx))}>
              Python starter
            </Button>
            <Button variant="outlined" disabled={!headers.length} onClick={() => downloadBlob("describe.R", descriptiveR(scriptCtx))}>
              R starter
            </Button>
            <Button variant="outlined" disabled={!headers.length} onClick={() => downloadBlob("describe.sps", descriptiveSpss(scriptCtx))}>
              SPSS syntax
            </Button>
            <Button
              variant="outlined"
              disabled={!headers.length}
              onClick={() => {
                const blob = buildZip(
                  analysisProjectFiles({
                    "scripts/describe.py": descriptivePython(scriptCtx),
                    "scripts/describe.R": descriptiveR(scriptCtx),
                    "scripts/describe.sps": descriptiveSpss(scriptCtx),
                  })
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "peggy-analysis-template.zip";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Project ZIP
            </Button>
            <DisabledTooltipButton
              title={
                activeWorkspace?.privacy_mode === "strict"
                  ? "Share is off on Strict projects (no dataset summary to a hosted model)."
                  : ""
              }
            >
              <Button
                variant="outlined"
                disabled={!headers.length || activeWorkspace?.privacy_mode === "strict"}
                onClick={() => {
                  setSharePreview(JSON.stringify({ label: datasetLabel, headers: headers.filter((h) => !adminCols.includes(h)), columnRoles, aggregates }, null, 2));
                  setShareOpen(true);
                }}
              >
                Share summary with Peggy
              </Button>
            </DisabledTooltipButton>
          </Stack>
          {headers.length ? (
            <Button sx={{ mt: 2, textTransform: "none" }} onClick={() => setToolTab(2)}>
              Next: Analysis
            </Button>
          ) : null}
        </Box>
        ) : null}

        {toolTab === 2 ? (
        <Box>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1.5 }}>
            <Typography sx={eyebrowSx}>Analysis</Typography>
            <InfoTip title="Pick a function. Tick datasets." />
          </Stack>
          <FormControl size="small" sx={{ minWidth: 280, mb: 2, mr: 1 }}>
            <InputLabel>Function</InputLabel>
            <Select
              label="Function"
              value={functionId}
              onChange={(e) => setFunctionId(e.target.value)}
            >
              {ANALYSIS_FUNCTIONS.map((f) => (
                <MenuItem key={f.id} value={f.id}>
                  {f.label} ({f.status})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {datasetPapers.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Upload files on Datasets first.
            </Alert>
          ) : (
            <Paper variant="outlined" sx={{ mb: 1.5, maxWidth: 560 }}>
              {datasetPapers.map((p) => {
                const id = p.id;
                if (id == null) return null;
                return (
                  <FormControlLabel
                    key={id}
                    sx={{ display: "flex", mx: 0, px: 2, py: 0.5, borderBottom: 1, borderColor: "divider" }}
                    control={
                      <Checkbox
                        checked={analysisIds.includes(id)}
                        onChange={(_, on) =>
                          toggleDataset(p, analysisIds, setAnalysisIds, analysisPrimary, setAnalysisPrimary, on)
                        }
                      />
                    }
                    label={p.title || "Untitled"}
                  />
                );
              })}
            </Paper>
          )}
          {analysisIds.length > 1 ? (
            <FormControl size="small" sx={{ mb: 1.5, minWidth: 240 }}>
              <InputLabel>Show table</InputLabel>
              <Select
                label="Show table"
                value={analysisPrimary ?? ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setAnalysisPrimary(id);
                  const paper = datasetPapers.find((p) => p.id === id);
                  if (paper) void loadPaper(paper);
                }}
              >
                {analysisIds.map((id) => (
                  <MenuItem key={id} value={id}>
                    {datasetPapers.find((p) => p.id === id)?.title || id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
          {analysisIds.length === 0 && datasetPapers.length > 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Choose one or more files uploaded on Datasets.
            </Alert>
          ) : null}
          {parseError && toolTab === 2 ? <Alert severity="error" sx={{ mb: 1.5 }}>{parseError}</Alert> : null}
          {tableLoading && toolTab === 2 ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <CircularProgress size={18} />
              <Typography variant="body2">Loading table…</Typography>
            </Stack>
          ) : null}
          {analysisFn ? (
            <Typography variant="body2" sx={{ mb: 2 }}>
              Steps: {analysisFn.steps.map((s, i) => `${i + 1}. ${s.label}`).join(" → ")}
            </Typography>
          ) : null}
          {functionId === "linear-regression" ? (
          <>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
              <Typography fontWeight={600}>OLS</Typography>
              <InfoTip title="JavaScript OLS. Confirm in R or statsmodels." />
            </Stack>
            <FormControl size="small" sx={{ minWidth: 240, mb: 1, mr: 1 }}>
              <InputLabel>Outcome</InputLabel>
              <Select
                label="Outcome"
                value={outcomeColumn}
                onChange={(e) => setOutcomeColumn(e.target.value)}
              >
                {dataHeaders.map((h) => (
                  <MenuItem key={h} value={h}>
                    {h}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {(coverage.data?.items ?? []).length ? (
              <Typography variant="body2" sx={{ mb: 1 }}>
                Similar-study covariates: {(coverage.data?.items ?? []).map((i) => i.covariate).join(", ")}
              </Typography>
            ) : null}
            {(studyDesign.analysisPlan?.covariateEntries ?? []).length ? (
              <Typography variant="body2" sx={{ mb: 1 }}>
                Plan covariates: {(studyDesign.analysisPlan?.covariateEntries ?? []).map((c) => c.description).join(", ")}
              </Typography>
            ) : null}
            <Autocomplete
              multiple
              size="small"
              options={dataHeaders.filter((h) => h !== outcomeColumn)}
              value={predictors}
              onChange={(_, v) => setPredictors(v)}
              renderInput={(params) => <TextField {...params} label="Predictors (numeric)" />}
              sx={{ maxWidth: 480, mb: 1 }}
            />
            <Button
              variant="contained"
              disabled={!outcomeColumn || !predictors.length || !rows.length}
              onClick={() => {
                const y = rows.map((r) => r[headers.indexOf(outcomeColumn)] ?? "");
                const preds = predictors.map((name) => ({
                  name,
                  values: rows.map((r) => r[headers.indexOf(name)] ?? ""),
                }));
                const out = fitOls(y, preds);
                if ("error" in out) {
                  setRegSummary(null);
                  setRunResult(out.error);
                  return;
                }
                setRegSummary(JSON.stringify(out));
                setRunResult(
                  `OLS n=${out.n} R²=${out.rSquared.toFixed(3)} (approx. p / 1.96 CI). Influential rows (Cook’s D > ${out.cookThreshold.toFixed(3)}): ${out.nInfluential}.`
                );
              }}
            >
              Fit OLS on this dataset
            </Button>
            {regSummary ? (
              <Alert severity="info" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
                {regSummary.slice(0, 1200)}
              </Alert>
            ) : null}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              <Button
                variant="outlined"
                disabled={!outcomeColumn || !predictors.length}
                onClick={() => downloadBlob("ols.py", regressionPython(scriptCtx))}
              >
                OLS Python script
              </Button>
              <Button
                variant="outlined"
                disabled={!outcomeColumn || !predictors.length}
                onClick={() => downloadBlob("ols.R", regressionR(scriptCtx))}
              >
                OLS R script
              </Button>
            </Stack>
          </Paper>
          </>
          ) : (
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            {analysisFn ? <RunPathsPanel fn={analysisFn} /> : null}
            {functionId === "gut-microbiome-feature" ? (
              <Button variant="outlined" onClick={() => downloadBlob("microbiome_qc.py", microbiomePython(scriptCtx))}>
                Microbiome QC script
              </Button>
            ) : null}
            {functionId === "genomics-snp-panel" ? (
              <Button variant="outlined" onClick={() => downloadBlob("snp_qc.txt", snpGuidance(scriptCtx))}>
                SNP guidance
              </Button>
            ) : null}
            {functionId === "ml-review" ? (
              <Button variant="outlined" onClick={() => downloadBlob("ml_review.txt", mlGuidance(scriptCtx))}>
                ML review notes
              </Button>
            ) : null}
            {functionId === "diet-analysis" ? (
              <Button variant="outlined" onClick={() => downloadBlob("diet_checklist.py", dietPython(scriptCtx))}>
                Diet checklist script
              </Button>
            ) : null}
            {functionId === "exposome" ? (
              <Button variant="outlined" onClick={() => downloadBlob("exposome_qc.py", exposomePython(scriptCtx))}>
                Exposome script
              </Button>
            ) : null}
            {functionId === "omics-generic" ? (
              <Button variant="outlined" onClick={() => downloadBlob("omics_qc.py", omicsPython(scriptCtx))}>
                Omics QC script
              </Button>
            ) : null}
          </Stack>
          )}

        {planGaps.length || (coverage.data?.importedCovariates ?? []).length ? (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography fontWeight={600} sx={{ mb: 1 }}>
              Check against the analysis plan
            </Typography>
            {planGaps.map((g) => (
              <Typography key={g} variant="body2">
                {g}
              </Typography>
            ))}
            {(coverage.data?.importedCovariates ?? []).length ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                From imported class D results: {(coverage.data?.importedCovariates ?? []).join(", ")}
              </Typography>
            ) : null}
          </Paper>
        ) : null}
          <Typography fontWeight={600} sx={{ mt: 2, mb: 1 }}>Record and import</Typography>
        {activeWorkspace?.id ? (
          <>
            <AnalysisRoutePanel
              workspaceId={activeWorkspace.id}
              functionId={functionId}
              planCompleted={studyDesign.analysisPlan?.draftStatus === "completed"}
            />
            <ResultsImportPanel
              onSave={(payload) => {
                void commitSection("analysisTool", {
                  ...(studyDesign.analysisTool ?? {}),
                  importedResults: payload,
                });
              }}
            />
            <AnalysisRunsPanel workspaceId={activeWorkspace.id} functionId={functionId} />
            <Paper variant="outlined" sx={{ p: 2 }}>
              <ComputeProfileEditor workspaceId={activeWorkspace.id} />
            </Paper>
          </>
        ) : (
          <Alert severity="info">Select a project.</Alert>
        )}
        </Box>
        ) : null}
      </Stack>
      <ConfirmDialog
        open={shareOpen}
        title="Share dataset summary?"
        body={`Class D aggregates only. Preview:\n${sharePreview.slice(0, 800)}`}
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

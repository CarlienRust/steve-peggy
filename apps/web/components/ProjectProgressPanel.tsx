"use client";

import { useState } from "react";
import Link from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  Collapse,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type {
  ObjectiveProgressSnapshot,
  ProjectProgressSnapshot,
  ProgressStage,
} from "@/lib/projectProgress";
import { objectiveLinkSummary } from "@/lib/projectProgress";
import type { ProjectTask } from "@/lib/studyDesign";
import { normalizeObjectives, type WorkspaceObjective } from "@/lib/objectives";
import { cardHoverSx, eyebrowSx, peggyColors } from "@/theme/peggyTheme";

type ProjectProgressPanelProps = {
  progress: ProjectProgressSnapshot;
  objectiveProgress?: ObjectiveProgressSnapshot;
  objectives?: WorkspaceObjective[];
  projectTasks?: ProjectTask[];
  orphanLinkCount?: number;
  onEditProject?: () => void;
  onToggleObjectiveDone?: (objectiveId: string, done: boolean) => void;
  onToggleObjectiveTask?: (objectiveId: string, taskId: string, done: boolean) => void;
  onAddObjectiveTask?: (objectiveId: string, text: string) => void;
  onToggleProjectTask?: (taskId: string, done: boolean) => void;
  onAddProjectTask?: (text: string) => void;
  togglingObjectiveId?: string | null;
  savingTasks?: boolean;
};

function NextStepAction({
  stage,
  onEditProject,
  prominent,
}: {
  stage: ProgressStage;
  onEditProject?: () => void;
  prominent?: boolean;
}) {
  if (stage.action === "edit-project" && onEditProject) {
    return (
      <Button
        variant={prominent ? "contained" : "outlined"}
        endIcon={<ArrowForwardIcon />}
        onClick={onEditProject}
        sx={{ textTransform: "none", alignSelf: "flex-start" }}
      >
        {stage.label}
      </Button>
    );
  }
  if (stage.href) {
    return (
      <Button
        component={Link}
        href={stage.href}
        variant={prominent ? "contained" : "outlined"}
        endIcon={<ArrowForwardIcon />}
        sx={{ textTransform: "none", alignSelf: "flex-start" }}
      >
        {stage.label}
      </Button>
    );
  }
  return (
    <Typography variant="body2" fontWeight={500}>
      {stage.label}
    </Typography>
  );
}

function TaskChecklist({
  tasks,
  onToggle,
  disabled,
}: {
  tasks: { id: string; text: string; status: "open" | "done" }[];
  onToggle?: (taskId: string, done: boolean) => void;
  disabled?: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        No tasks yet.
      </Typography>
    );
  }
  return (
    <Stack spacing={0.25}>
      {tasks.map((task) => (
        <FormControlLabel
          key={task.id}
          control={
            <Checkbox
              size="small"
              checked={task.status === "done"}
              disabled={disabled || !onToggle}
              onChange={(e) => onToggle?.(task.id, e.target.checked)}
            />
          }
          label={
            <Typography
              variant="body2"
              sx={{ textDecoration: task.status === "done" ? "line-through" : "none", color: task.status === "done" ? "text.secondary" : "text.primary" }}
            >
              {task.text}
            </Typography>
          }
          sx={{ m: 0, alignItems: "flex-start" }}
        />
      ))}
    </Stack>
  );
}

export function ProjectProgressPanel({
  progress,
  objectiveProgress,
  objectives,
  projectTasks = [],
  orphanLinkCount = 0,
  onEditProject,
  onToggleObjectiveDone,
  onToggleObjectiveTask,
  onAddObjectiveTask,
  onToggleProjectTask,
  onAddProjectTask,
  togglingObjectiveId,
  savingTasks,
}: ProjectProgressPanelProps) {
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [expandedObjectiveId, setExpandedObjectiveId] = useState<string | null>(null);
  const [newObjectiveTaskText, setNewObjectiveTaskText] = useState<Record<string, string>>({});
  const [newProjectTaskText, setNewProjectTaskText] = useState("");
  const [projectTasksOpen, setProjectTasksOpen] = useState(false);

  const pct = progress.totalCount > 0 ? Math.round((progress.completedCount / progress.totalCount) * 100) : 0;
  const allDone = progress.completedCount === progress.totalCount && progress.totalCount > 0;
  const objectiveRows = (objectiveProgress?.rows ?? []).filter((row) => !row.isAim);
  const normalizedObjectives = normalizeObjectives(objectives);

  const tasksForObjective = (objectiveId: string) =>
    normalizedObjectives.find((o) => o.id === objectiveId)?.tasks ?? [];

  return (
    <Paper
      sx={{
        p: { xs: 2.5, sm: 3 },
        bgcolor: peggyColors.surface,
        borderRadius: 2,
        border: `0.5px solid ${peggyColors.border}`,
      }}
    >
      <Stack spacing={3}>
        {orphanLinkCount > 0 && (
          <Alert severity="warning" sx={{ alignItems: "flex-start" }}>
            {orphanLinkCount} link{orphanLinkCount === 1 ? "" : "s"} point to removed objectives or aim. Edit the project
            and save to clean them up, or re-link work in methods, analysis, and findings.
          </Alert>
        )}

        {objectiveProgress && objectiveProgress.totalCount > 0 && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.25 }}>
              <Typography sx={eyebrowSx}>Objectives</Typography>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                {objectiveProgress.completedCount} of {objectiveProgress.totalCount} done
              </Typography>
            </Stack>
            <Stack spacing={1.5}>
              {objectiveRows.map((row) => {
                const expanded = expandedObjectiveId === row.id;
                const tasks = tasksForObjective(row.id);
                const openTaskCount = tasks.filter((t) => t.status !== "done").length;
                return (
                  <Box
                    key={row.id}
                    sx={{
                      p: 1.5,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      bgcolor: row.status === "done" ? "action.hover" : "background.paper",
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      {row.status === "done" ? (
                        <CheckCircleIcon sx={{ fontSize: 20, color: "success.main", mt: 0.25 }} />
                      ) : (
                        <RadioButtonUncheckedIcon sx={{ fontSize: 20, color: "text.disabled", mt: 0.25 }} />
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.25, flex: 1 }}>
                            {row.label}
                          </Typography>
                          {(tasks.length > 0 || onAddObjectiveTask) && (
                            <IconButton
                              size="small"
                              aria-label={expanded ? "Hide tasks" : "Show tasks"}
                              onClick={() => setExpandedObjectiveId(expanded ? null : row.id)}
                              sx={{ transform: expanded ? "rotate(180deg)" : "none" }}
                            >
                              <ExpandMoreIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mb: 0.75 }}>
                          {row.text}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                          {objectiveLinkSummary(row)}
                          {tasks.length > 0 && ` · ${openTaskCount} open task${openTaskCount === 1 ? "" : "s"}`}
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={1}>
                          {row.methodsSteps > 0 && (
                            <Button component={Link} href="/study-design/methods-plan" size="small" sx={{ textTransform: "none" }}>
                              Methods
                            </Button>
                          )}
                          {row.analysisSteps > 0 && (
                            <Button component={Link} href="/study-design/analysis-plan" size="small" sx={{ textTransform: "none" }}>
                              Analysis
                            </Button>
                          )}
                          {row.findings > 0 && (
                            <Button component={Link} href="/results/findings" size="small" sx={{ textTransform: "none" }}>
                              Findings
                            </Button>
                          )}
                        </Stack>
                        <Collapse in={expanded}>
                          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                            <TaskChecklist
                              tasks={tasks}
                              onToggle={onToggleObjectiveTask ? (taskId, done) => onToggleObjectiveTask(row.id, taskId, done) : undefined}
                              disabled={savingTasks}
                            />
                            {onAddObjectiveTask && (
                              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                <TextField
                                  size="small"
                                  placeholder="Add task"
                                  value={newObjectiveTaskText[row.id] ?? ""}
                                  onChange={(e) =>
                                    setNewObjectiveTaskText((prev) => ({ ...prev, [row.id]: e.target.value }))
                                  }
                                  fullWidth
                                  disabled={savingTasks}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const text = (newObjectiveTaskText[row.id] ?? "").trim();
                                      if (text) {
                                        onAddObjectiveTask(row.id, text);
                                        setNewObjectiveTaskText((prev) => ({ ...prev, [row.id]: "" }));
                                      }
                                    }
                                  }}
                                />
                                <Button
                                  size="small"
                                  variant="outlined"
                                  disabled={savingTasks || !(newObjectiveTaskText[row.id] ?? "").trim()}
                                  onClick={() => {
                                    const text = (newObjectiveTaskText[row.id] ?? "").trim();
                                    if (!text) return;
                                    onAddObjectiveTask(row.id, text);
                                    setNewObjectiveTaskText((prev) => ({ ...prev, [row.id]: "" }));
                                  }}
                                  sx={{ textTransform: "none", flexShrink: 0 }}
                                >
                                  Add
                                </Button>
                              </Stack>
                            )}
                          </Box>
                        </Collapse>
                      </Box>
                      {onToggleObjectiveDone && (
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={row.status === "done"}
                              disabled={togglingObjectiveId === row.id}
                              onChange={(e) => onToggleObjectiveDone(row.id, e.target.checked)}
                            />
                          }
                          label="Done"
                          sx={{ m: 0, flexShrink: 0 }}
                        />
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>

            {(projectTasks.length > 0 || onAddProjectTask) && (
              <Box sx={{ mt: 2 }}>
                <Button
                  size="small"
                  endIcon={<ExpandMoreIcon sx={{ transform: projectTasksOpen ? "rotate(180deg)" : "none" }} />}
                  onClick={() => setProjectTasksOpen((v) => !v)}
                  sx={{ textTransform: "none", mb: projectTasksOpen ? 1 : 0 }}
                >
                  Project tasks ({projectTasks.filter((t) => t.status !== "done").length} open)
                </Button>
                <Collapse in={projectTasksOpen}>
                  <Box sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}>
                    <TaskChecklist
                      tasks={projectTasks}
                      onToggle={onToggleProjectTask}
                      disabled={savingTasks}
                    />
                    {onAddProjectTask && (
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <TextField
                          size="small"
                          placeholder="Add project task"
                          value={newProjectTaskText}
                          onChange={(e) => setNewProjectTaskText(e.target.value)}
                          fullWidth
                          disabled={savingTasks}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const text = newProjectTaskText.trim();
                              if (text) {
                                onAddProjectTask(text);
                                setNewProjectTaskText("");
                              }
                            }
                          }}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={savingTasks || !newProjectTaskText.trim()}
                          onClick={() => {
                            const text = newProjectTaskText.trim();
                            if (!text) return;
                            onAddProjectTask(text);
                            setNewProjectTaskText("");
                          }}
                          sx={{ textTransform: "none", flexShrink: 0 }}
                        >
                          Add
                        </Button>
                      </Stack>
                    )}
                  </Box>
                </Collapse>
              </Box>
            )}
          </Box>
        )}

        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.25 }}>
            <Typography sx={eyebrowSx}>Project setup</Typography>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              {progress.completedCount} of {progress.totalCount}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: "action.hover",
              "& .MuiLinearProgress-bar": { borderRadius: 4, bgcolor: peggyColors.accent },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: "block" }}>
            {allDone ? "All setup stages complete for this project." : `${pct}% complete`}
          </Typography>
        </Box>

        {progress.nextStep && !allDone && (
          <Box>
            <Typography
              component="h2"
              variant="h2"
              sx={{ fontSize: "1rem", fontWeight: 600, letterSpacing: "-0.01em", mb: 1.25 }}
            >
              Next step
            </Typography>
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {progress.nextStep.reason ?? "Start here to move the project forward."}
              </Typography>
              <NextStepAction stage={progress.nextStep} onEditProject={onEditProject} prominent />
            </Stack>
          </Box>
        )}

        {allDone && (
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            Every setup stage is done. Use the sidebar to revisit any section or run a new comparison in Results.
          </Typography>
        )}

        <Accordion
          expanded={roadmapOpen}
          onChange={(_, expanded) => setRoadmapOpen(expanded)}
          disableGutters
          elevation={0}
          sx={{
            bgcolor: "transparent",
            "&:before": { display: "none" },
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2" fontWeight={600}>
              {roadmapOpen ? "Hide full roadmap" : "Show full roadmap"}
              {!roadmapOpen && (
                <Typography component="span" variant="body2" color="text.secondary" fontWeight={400} sx={{ ml: 1 }}>
                  ({progress.completedCount}/{progress.totalCount} done)
                </Typography>
              )}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Stack spacing={0}>
              {progress.stages.map((stage, index) => {
                const isLast = index === progress.stages.length - 1;
                return (
                  <Stack key={stage.id} direction="row" spacing={1.5} sx={{ minHeight: isLast ? "auto" : 44 }}>
                    <Stack alignItems="center" sx={{ width: 24, flexShrink: 0 }}>
                      {stage.done ? (
                        <CheckCircleIcon sx={{ fontSize: 20, color: "success.main" }} />
                      ) : (
                        <RadioButtonUncheckedIcon sx={{ fontSize: 20, color: "text.disabled" }} />
                      )}
                      {!isLast && (
                        <Box
                          sx={{
                            width: 2,
                            flex: 1,
                            minHeight: 12,
                            bgcolor: stage.done ? peggyColors.accent : "action.hover",
                            opacity: stage.done ? 0.5 : 0.35,
                            borderRadius: 1,
                            my: 0.25,
                          }}
                        />
                      )}
                    </Stack>
                    <Box sx={{ pb: isLast ? 0 : 1.5, pt: 0.15, flex: 1 }}>
                      {stage.action === "edit-project" && onEditProject ? (
                        <Typography
                          component="button"
                          type="button"
                          onClick={onEditProject}
                          variant="body2"
                          sx={{
                            border: 0,
                            bgcolor: "transparent",
                            p: 0,
                            cursor: "pointer",
                            font: "inherit",
                            fontWeight: stage.done ? 400 : 500,
                            color: stage.done ? "text.secondary" : "text.primary",
                            textAlign: "left",
                            textDecoration: stage.done ? "line-through" : "none",
                            "&:hover": { color: peggyColors.accent },
                          }}
                        >
                          {stage.label}
                        </Typography>
                      ) : stage.href ? (
                        <Typography
                          component={Link}
                          href={stage.href}
                          variant="body2"
                          sx={{
                            fontWeight: stage.done ? 400 : 500,
                            color: stage.done ? "text.secondary" : "text.primary",
                            textDecoration: stage.done ? "line-through" : "none",
                            display: "inline-block",
                            ...(!stage.done ? cardHoverSx : {}),
                            "&:hover": { color: peggyColors.accent, textDecoration: stage.done ? "line-through" : "underline" },
                          }}
                        >
                          {stage.label}
                        </Typography>
                      ) : (
                        <Typography
                          variant="body2"
                          color={stage.done ? "text.secondary" : "text.primary"}
                          sx={{ textDecoration: stage.done ? "line-through" : "none" }}
                        >
                          {stage.label}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          </AccordionDetails>
        </Accordion>
      </Stack>
    </Paper>
  );
}

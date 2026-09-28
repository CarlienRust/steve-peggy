"use client";

import Link from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import {
  Box,
  Button,
  FormControlLabel,
  LinearProgress,
  Paper,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import type {
  ObjectiveProgressSnapshot,
  ProjectProgressSnapshot,
  ProgressStage,
} from "@/lib/projectProgress";
import { objectiveLinkSummary } from "@/lib/projectProgress";
import { cardHoverSx, eyebrowSx, peggyColors } from "@/theme/peggyTheme";

type ProjectProgressPanelProps = {
  progress: ProjectProgressSnapshot;
  objectiveProgress?: ObjectiveProgressSnapshot;
  onEditProject?: () => void;
  onToggleObjectiveDone?: (objectiveId: string, done: boolean) => void;
  togglingObjectiveId?: string | null;
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

export function ProjectProgressPanel({
  progress,
  objectiveProgress,
  onEditProject,
  onToggleObjectiveDone,
  togglingObjectiveId,
}: ProjectProgressPanelProps) {
  const pct = progress.totalCount > 0 ? Math.round((progress.completedCount / progress.totalCount) * 100) : 0;
  const allDone = progress.completedCount === progress.totalCount && progress.totalCount > 0;
  const objectiveRows = (objectiveProgress?.rows ?? []).filter((row) => !row.isAim);

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
        {objectiveProgress && objectiveProgress.totalCount > 0 && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.25 }}>
              <Typography sx={eyebrowSx}>Objectives</Typography>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                {objectiveProgress.completedCount} of {objectiveProgress.totalCount} done
              </Typography>
            </Stack>
            <Stack spacing={1.5}>
              {objectiveRows.map((row) => (
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
                      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.25 }}>
                        {row.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mb: 0.75 }}>
                        {row.text}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                        {objectiveLinkSummary(row)}
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
                          <Button component={Link} href="/results/report" size="small" sx={{ textTransform: "none" }}>
                            Findings
                          </Button>
                        )}
                      </Stack>
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
              ))}
            </Stack>
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
                Start here to move the project forward.
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

        {progress.laterSteps.length > 0 && (
          <Box>
            <Typography
              component="h2"
              variant="h2"
              sx={{ fontSize: "1rem", fontWeight: 600, letterSpacing: "-0.01em", mb: 1.25 }}
            >
              Possible next steps
            </Typography>
            <Stack spacing={1}>
              {progress.laterSteps.map((stage, index) => (
                <Stack
                  key={stage.id}
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{
                    pl: 1.5,
                    borderLeft: index === 0 ? `2px solid ${peggyColors.border}` : "none",
                    ml: 0.5,
                  }}
                >
                  <Typography
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      bgcolor: "action.hover",
                      color: "text.secondary",
                      fontSize: 11,
                      fontWeight: 600,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}
                  </Typography>
                  <NextStepAction stage={stage} onEditProject={onEditProject} />
                </Stack>
              ))}
            </Stack>
          </Box>
        )}

        <Box>
          <Typography
            component="h2"
            variant="h2"
            sx={{ fontSize: "1rem", fontWeight: 600, letterSpacing: "-0.01em", mb: 1.5 }}
          >
            Full roadmap
          </Typography>
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
        </Box>
      </Stack>
    </Paper>
  );
}

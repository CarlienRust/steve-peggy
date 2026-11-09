"use client";

import { Box, IconButton, Paper, Stack, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { Workspace } from "@/lib/api";
import { peggyColors } from "@/theme/peggyTheme";

export function ProjectCard({
  workspace,
  onOpen,
  onRename,
  onDelete,
}: {
  workspace: Workspace;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const privacy =
    workspace.privacy_mode === "standard" || workspace.privacy_mode === "hosted_allowed"
      ? "Standard (hosted AI)"
      : "Strict (AI help off)";
  return (
    <Paper
      variant="outlined"
      onClick={onOpen}
      sx={{
        p: 2.5,
        cursor: "pointer",
        "&:hover": { borderColor: peggyColors.primary, bgcolor: "action.hover" },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={600} noWrap>
            {workspace.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {privacy}
            {workspace.last_opened_at ? ` · Last opened ${new Date(workspace.last_opened_at).toLocaleDateString()}` : ""}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
          <IconButton size="small" aria-label="Open project" onClick={onOpen}>
            <OpenInNewIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" aria-label="Rename project" onClick={onRename}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" aria-label="Delete project" onClick={onDelete}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
      {workspace.aim ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {workspace.aim}
        </Typography>
      ) : null}
    </Paper>
  );
}

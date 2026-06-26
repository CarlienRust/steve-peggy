"use client";

import { FormControl, MenuItem, Select, Typography } from "@mui/material";
import Link from "next/link";
import { useWorkspace } from "@/lib/workspaceContext";
import { eyebrowSx } from "@/theme/peggyTheme";

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, setActiveWorkspaceId, isLoading } = useWorkspace();

  if (isLoading) {
    return (
      <Typography sx={{ ...eyebrowSx, fontSize: 10, mb: 2 }} color="text.secondary">
        Workspace…
      </Typography>
    );
  }

  if (workspaces.length === 0) {
    return (
      <Typography
        component={Link}
        href="/workspaces"
        sx={{ ...eyebrowSx, fontSize: 10, mb: 2, display: "block", textDecoration: "none", color: "primary.main" }}
      >
        + Create workspace
      </Typography>
    );
  }

  return (
    <FormControl size="small" fullWidth sx={{ mb: 2 }}>
      <Typography sx={{ ...eyebrowSx, fontSize: 10, mb: 0.75 }}>Active workspace</Typography>
      <Select
        value={activeWorkspace?.id ?? ""}
        onChange={(e) => setActiveWorkspaceId(e.target.value)}
        displayEmpty
        sx={{ fontSize: "0.8125rem" }}
      >
        {workspaces.map((ws) => (
          <MenuItem key={ws.id} value={ws.id}>
            {ws.title}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

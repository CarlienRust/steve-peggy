"use client";

import { Box, Stack, Typography } from "@mui/material";
import { useWorkspace } from "@/lib/workspaceContext";
import { eyebrowSx } from "@/theme/peggyTheme";

export function ProjectAimSection() {
  const { activeWorkspace } = useWorkspace();

  if (!activeWorkspace?.aim && !(activeWorkspace?.objectives?.length ?? 0)) {
    return null;
  }

  return (
    <Box
      sx={{
        mb: 3,
        p: 2.5,
        borderRadius: 1,
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Typography sx={{ ...eyebrowSx, mb: 1.5 }}>Project · {activeWorkspace?.title}</Typography>
      {activeWorkspace?.aim && (
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: activeWorkspace.objectives?.length ? 2 : 0 }}>
          <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>
            Aim:{" "}
          </Box>
          {activeWorkspace.aim}
        </Typography>
      )}
      {(activeWorkspace?.objectives?.length ?? 0) > 0 && (
        <Stack spacing={0.5}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Objectives
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5, color: "text.secondary" }}>
            {activeWorkspace!.objectives!.map((obj, i) => (
              <Typography component="li" variant="body2" key={i} sx={{ lineHeight: 1.6 }}>
                {obj}
              </Typography>
            ))}
          </Box>
        </Stack>
      )}
    </Box>
  );
}

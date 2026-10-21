"use client";

import CloseIcon from "@mui/icons-material/Close";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { Box, Drawer, IconButton, Typography } from "@mui/material";
import { ChatFeature } from "@/features/chat/ChatFeature";
import { peggyColors, monoSx } from "@/theme/peggyTheme";

export const ASK_PEGGY_DRAWER_W = 400;

export function AskPeggyDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: ASK_PEGGY_DRAWER_W,
          maxWidth: "92vw",
          bgcolor: "background.paper",
          borderLeft: `0.5px solid ${peggyColors.border}`,
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <ChatBubbleOutlineIcon fontSize="small" />
        <Typography sx={{ fontWeight: 600, flex: 1 }}>Ask Peggy</Typography>
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ px: 2, py: 1 }}>
        <Typography sx={{ ...monoSx, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "text.secondary" }}>
          Context
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          Uses this project and page.
        </Typography>
      </Box>

      <Box sx={{ px: 2, pb: 2 }}>
        <ChatFeature />
      </Box>
    </Drawer>
  );
}


"use client";

import { Box, Link, Paper, Stack, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { LocalDevBanner } from "@/components/LocalDevBanner";
import { USEFUL_LINK_GROUPS } from "@/lib/usefulLinks";
import { eyebrowSx, peggyColors } from "@/theme/peggyTheme";

export function UsefulLinksPage() {
  return (
    <Box>
      <LocalDevBanner />
      <Typography sx={eyebrowSx}>RESOURCES</Typography>
      <Typography variant="h4" fontWeight={600} letterSpacing="-0.02em" sx={{ mb: 1 }}>
        Useful links
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 3, maxWidth: 720 }}>
        External tools and databases Peggy users often use alongside their projects. Links open in a new tab.
      </Typography>

      <Stack spacing={3}>
        {USEFUL_LINK_GROUPS.map((group) => (
          <Box key={group.id}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              {group.title}
            </Typography>
            <Stack spacing={1.5}>
              {group.links.map((item) => (
                <Paper
                  key={item.href}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    "&:hover": { borderColor: peggyColors.primary, bgcolor: "action.hover" },
                  }}
                >
                  <Link
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="hover"
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 2,
                      color: "text.primary",
                      textDecoration: "none",
                      "&:hover": { color: "primary.main" },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={600}>{item.label}</Typography>
                      {item.description ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, lineHeight: 1.6 }}>
                          {item.description}
                        </Typography>
                      ) : null}
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        {item.href.replace(/^https:\/\//, "")}
                      </Typography>
                    </Box>
                    <OpenInNewIcon fontSize="small" sx={{ flexShrink: 0, mt: 0.25, color: "text.secondary" }} />
                  </Link>
                </Paper>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

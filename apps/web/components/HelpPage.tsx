"use client";

import { Box, Paper, Stack, Typography } from "@mui/material";
import { LocalDevBanner } from "@/components/LocalDevBanner";
import { PLATFORM_HELP_SECTIONS } from "@/lib/platformHelp";
import { eyebrowSx } from "@/theme/peggyTheme";

export function HelpPage() {
  return (
    <Box>
      <LocalDevBanner />
      <Typography sx={eyebrowSx}>GUIDE</Typography>
      <Typography variant="h4" fontWeight={600} letterSpacing="-0.02em" sx={{ mb: 1 }}>
        Help using Peggy
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 3, maxWidth: 720 }}>
        Short tips for navigation, validation, study design, and chat. Your data stays in the project you choose unless
        you export it.
      </Typography>

      <Stack spacing={3}>
        {PLATFORM_HELP_SECTIONS.map((section) => (
          <Box key={section.id}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
              {section.title}
            </Typography>
            <Stack spacing={1.5}>
              {section.items.map((item) => (
                <Paper key={item.heading} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography fontWeight={600} sx={{ mb: 0.75 }}>
                    {item.heading}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {item.body}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

import { Stack, Typography } from "@mui/material";
import { eyebrowSx } from "@/theme/peggyTheme";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <Stack spacing={1.5} sx={{ mb: 4, maxWidth: 720 }}>
      {eyebrow && <Typography sx={eyebrowSx}>{eyebrow}</Typography>}
      <Typography variant="h1" sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" } }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640 }}>
          {description}
        </Typography>
      )}
    </Stack>
  );
}

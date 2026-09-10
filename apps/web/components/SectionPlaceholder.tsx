import { Alert, Paper, Typography } from "@mui/material";
import { PageHeader } from "@/components/PageHeader";

type SectionPlaceholderProps = {
  eyebrow?: string;
  title: string;
  description: string;
};

export function SectionPlaceholder({ eyebrow, title, description }: SectionPlaceholderProps) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <Paper sx={{ p: 3 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Coming soon — this section is planned for a future release.
        </Alert>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Paper>
    </>
  );
}

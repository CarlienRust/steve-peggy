import Link from "next/link";
import { Box, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import { PageHeader } from "@/components/PageHeader";
import { getNavGroup, type NavGroupItem } from "@/lib/navigation";
import { cardHoverSx, monoSx } from "@/theme/peggyTheme";

type SectionHubProps = {
  groupHref: string;
  title: string;
  description: string;
};

function HubCard({ child, group }: { child: NavGroupItem["children"][number]; group: NavGroupItem }) {
  const disabled = child.disabled || child.ready === false;
  const inner = (
    <>
      <Stack spacing={1}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {child.label}
          </Typography>
          {child.ready === false && (
            <Chip label="Soon" size="small" variant="outlined" sx={{ ...monoSx, fontSize: 10 }} />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
          {child.description}
        </Typography>
        <Typography sx={{ ...monoSx, fontSize: 11, color: "text.secondary", pt: 0.5 }}>
          {group.num} · {group.label}
        </Typography>
      </Stack>
    </>
  );

  if (disabled) {
    return (
      <Paper variant="outlined" sx={{ p: 2.5, height: "100%", opacity: 0.65, cursor: "not-allowed" }}>
        {inner}
      </Paper>
    );
  }

  return (
    <Paper
      component={Link}
      href={child.href}
      variant="outlined"
      sx={{
        p: 2.5,
        height: "100%",
        textDecoration: "none",
        color: "inherit",
        display: "block",
        ...cardHoverSx,
      }}
    >
      {inner}
    </Paper>
  );
}

export function SectionHub({ groupHref, title, description }: SectionHubProps) {
  const group = getNavGroup(groupHref);
  if (!group) return null;

  return (
    <Box>
      <PageHeader eyebrow={`${group.num} · ${group.label}`} title={title} description={description} />
      <Grid container spacing={2}>
        {group.children.map((child) => (
          <Grid item xs={12} sm={6} key={child.href}>
            <HubCard child={child} group={group} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

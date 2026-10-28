"use client";

import { useState } from "react";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import { OutputsAbstractTab } from "@/features/outputs/OutputsAbstractTab";
import { OutputsFiguresTab } from "@/features/outputs/OutputsFiguresTab";
import { OutputsTablesTab } from "@/features/outputs/OutputsTablesTab";
import { eyebrowSx } from "@/theme/peggyTheme";

const TABS = [
  { id: "figures", label: "Figures" },
  { id: "tables", label: "Tables" },
  { id: "abstract", label: "Abstract" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function OutputsFeature() {
  const [tab, setTab] = useState<TabId>("figures");

  return (
    <Box sx={{ width: "100%" }}>
      <Typography sx={{ ...eyebrowSx, mb: 2 }}>OUTPUTS</Typography>
      <Typography variant="h1" sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 600, letterSpacing: "-0.02em", mb: 1 }}>
        Figures, tables, and abstract
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mb: 2.5 }}>
        Design figures externally, build tables from findings, and iterate conference abstract drafts.
      </Typography>

      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v as TabId)}
        sx={{ mb: 3, minHeight: 0, "& .MuiTab-root": { textTransform: "none", minHeight: 0, py: 1.25 } }}
      >
        {TABS.map((t) => (
          <Tab key={t.id} value={t.id} label={t.label} />
        ))}
      </Tabs>

      {tab === "figures" ? <OutputsFiguresTab /> : null}
      {tab === "tables" ? <OutputsTablesTab /> : null}
      {tab === "abstract" ? <OutputsAbstractTab /> : null}
    </Box>
  );
}

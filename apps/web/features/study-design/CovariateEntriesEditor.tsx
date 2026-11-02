"use client";

import { Button, IconButton, MenuItem, Stack, TextField } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { LinkTargetOption } from "@/components/ObjectiveLinkSelect";
import type { CovariateEntry } from "@/lib/studyDesign";

type CovariateEntriesEditorProps = {
  entries: CovariateEntry[];
  options: LinkTargetOption[];
  onChange: (next: CovariateEntry[]) => void;
  disabled?: boolean;
};

function scopeFromOption(id: string): CovariateEntry["scope"] {
  if (id === "project") return "project";
  return "aim";
}

export function CovariateEntriesEditor({ entries, options, onChange, disabled }: CovariateEntriesEditorProps) {
  const updateAt = (index: number, patch: Partial<CovariateEntry>) => {
    onChange(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };

  return (
    <Stack spacing={1.5}>
      {entries.map((entry, index) => (
        <Stack key={entry.id} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <TextField
            label="Covariates / adjustment set"
            value={entry.description}
            onChange={(e) => updateAt(index, { description: e.target.value })}
            fullWidth
            size="small"
            disabled={disabled}
          />
          <TextField
            select
            label="Scope"
            size="small"
            value={entry.scope === "project" ? "project" : entry.scopeId || "project"}
            onChange={(e) => {
              const id = e.target.value;
              if (id === "project") {
                updateAt(index, { scope: "project", scopeId: undefined });
                return;
              }
              const opt = options.find((o) => o.id === id);
              const isObjective = opt?.label.startsWith("Objective");
              updateAt(index, {
                scope: isObjective ? "objective" : scopeFromOption(id),
                scopeId: id,
              });
            }}
            sx={{ minWidth: 200 }}
            disabled={disabled}
          >
            {options.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <IconButton aria-label="Remove covariates" disabled={disabled} onClick={() => onChange(entries.filter((_, i) => i !== index))}>
            <DeleteOutlineIcon />
          </IconButton>
        </Stack>
      ))}
      <Button
        startIcon={<AddIcon />}
        disabled={disabled}
        sx={{ alignSelf: "flex-start", textTransform: "none" }}
        onClick={() =>
          onChange([
            ...entries,
            { id: crypto.randomUUID(), description: "", scope: "project" },
          ])
        }
      >
        Add covariates
      </Button>
    </Stack>
  );
}

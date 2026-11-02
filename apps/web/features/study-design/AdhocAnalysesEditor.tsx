"use client";

import { Button, IconButton, Stack, TextField } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { ObjectiveLinkSelect, type LinkTargetOption } from "@/components/ObjectiveLinkSelect";
import type { AdhocAnalysis } from "@/lib/studyDesign";

type AdhocAnalysesEditorProps = {
  items: AdhocAnalysis[];
  options: LinkTargetOption[];
  onChange: (next: AdhocAnalysis[]) => void;
  disabled?: boolean;
};

export function AdhocAnalysesEditor({ items, options, onChange, disabled }: AdhocAnalysesEditorProps) {
  const updateAt = (index: number, patch: Partial<AdhocAnalysis>) => {
    onChange(items.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };

  return (
    <Stack spacing={2}>
      {items.map((item, index) => (
        <Stack key={item.id} spacing={1} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <TextField
              label="Test title"
              value={item.title}
              onChange={(e) => updateAt(index, { title: e.target.value })}
              fullWidth
              size="small"
              disabled={disabled}
            />
            <IconButton aria-label="Remove test" disabled={disabled} onClick={() => onChange(items.filter((_, i) => i !== index))}>
              <DeleteOutlineIcon />
            </IconButton>
          </Stack>
          <TextField
            label="Variable or covariate"
            value={item.target}
            onChange={(e) => updateAt(index, { target: e.target.value })}
            fullWidth
            size="small"
            disabled={disabled}
          />
          <TextField
            label="Notes (optional)"
            value={item.notes ?? ""}
            onChange={(e) => updateAt(index, { notes: e.target.value })}
            fullWidth
            size="small"
            multiline
            minRows={2}
            disabled={disabled}
          />
          <ObjectiveLinkSelect
            options={options}
            value={item.linkIds ?? []}
            onChange={(ids) => updateAt(index, { linkIds: ids })}
            label="Link (optional)"
            disabled={disabled}
          />
        </Stack>
      ))}
      <Button
        startIcon={<AddIcon />}
        disabled={disabled}
        sx={{ alignSelf: "flex-start", textTransform: "none" }}
        onClick={() =>
          onChange([...items, { id: crypto.randomUUID(), title: "", target: "", notes: "", linkIds: [] }])
        }
      >
        Add test
      </Button>
    </Stack>
  );
}

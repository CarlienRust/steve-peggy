import { Chip, type ChipProps, alpha } from "@mui/material";
import { peggyColors, monoSx } from "@/theme/peggyTheme";

export type StatusChipTone = "neutral" | "accent" | "warning" | "destructive";

export function StatusChip({
  tone = "neutral",
  variant,
  sx,
  ...props
}: Omit<ChipProps, "color"> & { tone?: StatusChipTone }) {
  const style =
    tone === "accent"
      ? {
          bgcolor: peggyColors.primary,
          color: peggyColors.primaryForeground,
          borderColor: "transparent",
        }
      : tone === "warning"
        ? {
            bgcolor: alpha(peggyColors.warning, 0.18),
            color: peggyColors.foreground,
            borderColor: alpha(peggyColors.warning, 0.35),
          }
        : tone === "destructive"
          ? {
              bgcolor: alpha(peggyColors.destructive, 0.18),
              color: peggyColors.foreground,
              borderColor: alpha(peggyColors.destructive, 0.35),
            }
          : {
              bgcolor: alpha(peggyColors.muted, 0.75),
              color: peggyColors.mutedForeground,
              borderColor: peggyColors.border,
            };

  return (
    <Chip
      variant={variant ?? "outlined"}
      {...props}
      sx={{
        ...monoSx,
        fontSize: 11,
        height: 26,
        borderRadius: 999,
        borderWidth: "0.5px",
        ...style,
        ...sx,
      }}
    />
  );
}


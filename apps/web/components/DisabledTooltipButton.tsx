import { Tooltip, type TooltipProps } from "@mui/material";
import { type ReactElement } from "react";

export function DisabledTooltipButton({
  title,
  children,
  placement,
}: {
  title: TooltipProps["title"];
  placement?: TooltipProps["placement"];
  children: ReactElement;
}) {
  // MUI tooltips do not fire on disabled elements; wrap in span.
  return (
    <Tooltip title={title} placement={placement ?? "top"} arrow>
      <span style={{ display: "inline-flex" }}>{children}</span>
    </Tooltip>
  );
}


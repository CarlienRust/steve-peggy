import { PropsWithChildren } from "react";
import { SetupStateProvider } from "@/components/setup/SetupState";

export default function SetupLayout({ children }: PropsWithChildren) {
  return <SetupStateProvider>{children}</SetupStateProvider>;
}


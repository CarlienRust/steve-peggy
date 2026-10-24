"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { monoSx } from "@/theme/peggyTheme";
import { createClient } from "@/lib/supabase/client";
import { useAuthSession } from "@/lib/authContext";
import { isAuthOptional } from "@/lib/localMode";
import { peggyApi, queryKeys } from "@/lib/api";
import { StatusChip } from "@/components/StatusChip";
import { saveActiveWorkspaceId } from "@/lib/userProfile";

export type SidebarProfileVariant = "project" | "home";

type ResearcherProfileProps = {
  variant?: SidebarProfileVariant;
};

/** Opens beside the sidebar row (to the right), not below it. */
const profileMenuPlacement = {
  anchorOrigin: { vertical: "center" as const, horizontal: "right" as const },
  transformOrigin: { vertical: "center" as const, horizontal: "left" as const },
  slotProps: { paper: { sx: { ml: 0.75 } } },
};

export function ResearcherProfile({ variant = "project" }: ResearcherProfileProps) {
  const router = useRouter();
  const { ready, userId } = useAuthSession();
  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.profile(userId ?? undefined),
    queryFn: () => peggyApi.getProfileOptional(),
    enabled: ready && !!userId && !isAuthOptional(),
    retry: false,
  });

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const logout = async () => {
    saveActiveWorkspaceId(null);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const switchProject = () => {
    saveActiveWorkspaceId(null);
    router.push("/");
  };

  const displayName = profile?.display_name ?? "Researcher";
  const showSwitchProject = variant === "project";

  if (isAuthOptional()) {
    return (
      <Box sx={{ mt: "auto", pt: 3, borderTop: 1, borderColor: "divider" }}>
        <Button
          fullWidth
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          sx={{
            textTransform: "none",
            justifyContent: "space-between",
            color: "text.primary",
            py: 1,
            px: 1,
          }}
        >
          <Box sx={{ textAlign: "left", minWidth: 0 }}>
            <Typography fontWeight={500} noWrap>
              Local researcher
            </Typography>
            <Typography sx={{ ...monoSx, fontSize: 11, color: "text.secondary" }} noWrap>
              SQLite · solo mode
            </Typography>
          </Box>
          <ChevronRightIcon fontSize="small" color="action" />
        </Button>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          {...profileMenuPlacement}
        >
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              router.push("/setup/checks");
            }}
          >
            <ListItemIcon>
              <SettingsOutlinedIcon fontSize="small" />
            </ListItemIcon>
            Settings
          </MenuItem>
        </Menu>
        <Tooltip title="Tips for navigation, validate, and chat">
          <Button
            fullWidth
            size="small"
            variant="text"
            startIcon={<HelpOutlineIcon fontSize="small" />}
            onClick={() => router.push("/help")}
            sx={{ mt: 1.5, textTransform: "none", fontSize: "0.8125rem", justifyContent: "flex-start" }}
          >
            Help
          </Button>
        </Tooltip>
        {showSwitchProject ? (
          <Button
            fullWidth
            size="small"
            variant="text"
            startIcon={<SwapHorizIcon fontSize="small" />}
            onClick={switchProject}
            sx={{ mt: 1.5, textTransform: "none", fontSize: "0.8125rem", justifyContent: "flex-start" }}
          >
            Switch project
          </Button>
        ) : null}
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ mt: "auto", pt: 3, borderTop: 1, borderColor: "divider" }}>
        <Button
          fullWidth
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          sx={{
            textTransform: "none",
            justifyContent: "space-between",
            color: "text.primary",
            py: 1,
            px: 1,
          }}
        >
          <Box sx={{ textAlign: "left", minWidth: 0 }}>
            <Typography fontWeight={500} noWrap>
              {isLoading ? "…" : displayName}
            </Typography>
            {profile?.email ? (
              <Typography sx={{ fontSize: 11, color: "text.secondary" }} noWrap>
                {profile.email}
              </Typography>
            ) : null}
          </Box>
          <ChevronRightIcon fontSize="small" color="action" />
        </Button>
        {!profile && !isLoading ? (
          <StatusChip label="Profile incomplete" tone="warning" sx={{ mt: 1 }} />
        ) : null}

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          {...profileMenuPlacement}
        >
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              router.push(profile ? "/onboarding?update=1" : "/onboarding");
            }}
          >
            <ListItemIcon>
              <PersonOutlineIcon fontSize="small" />
            </ListItemIcon>
            Update profile
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              router.push("/setup/checks");
            }}
          >
            <ListItemIcon>
              <SettingsOutlinedIcon fontSize="small" />
            </ListItemIcon>
            Settings
          </MenuItem>
        </Menu>

        {showSwitchProject ? (
          <Tooltip title="Return to Home and pick another project">
            <Button
              fullWidth
              size="small"
              variant="text"
              startIcon={<SwapHorizIcon fontSize="small" />}
              onClick={switchProject}
              sx={{ mt: 1.5, textTransform: "none", fontSize: "0.8125rem", justifyContent: "flex-start" }}
            >
              Switch project
            </Button>
          </Tooltip>
        ) : null}
        <Tooltip title="Tips for navigation, validate, and chat">
          <Button
            fullWidth
            size="small"
            variant="text"
            startIcon={<HelpOutlineIcon fontSize="small" />}
            onClick={() => router.push("/help")}
            sx={{ mt: 1.5, textTransform: "none", fontSize: "0.8125rem", justifyContent: "flex-start" }}
          >
            Help
          </Button>
        </Tooltip>
        <Button
          fullWidth
          size="small"
          variant="outlined"
          startIcon={<LogoutIcon fontSize="small" />}
          onClick={logout}
          sx={{ mt: 2, textTransform: "none", fontSize: "0.8125rem" }}
        >
          Log out
        </Button>
      </Box>
    </>
  );
}

/**
 * useMuteToggle - Shared icon/label/click mapping for the two MuteButton
 * placements (Toolbar and Floating). Keeps the behavior consistent.
 */

import { ComponentType } from "react";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import { useMusic } from "../../../contexts";

type SvgIcon = ComponentType<{ fontSize?: "inherit" | "small" | "medium" | "large" }>;

interface MuteToggle {
  Icon: SvgIcon;
  label: string;
  onClick: () => void;
}

export function useMuteToggle(): MuteToggle {
  const { preference, toggle } = useMusic();
  const isOn = preference === "on";
  return {
    Icon: isOn ? VolumeUpIcon : VolumeOffIcon,
    label: isOn ? "Mute music" : "Unmute music",
    onClick: toggle,
  };
}

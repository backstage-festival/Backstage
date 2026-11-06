import { Image } from "expo-image";

import { size as sizeTokens } from "@/theme/theme";
import type { IconName } from "@/types/components";

import { ICON_SOURCES } from "./iconSources";

export interface IconProps {
  name: IconName;
  /** Edge length in dp. Defaults to `size.icon` (24). */
  size?: number;
  color: string;
}

/**
 * Interface icon (H04). The WebP files are white on transparent; the visible
 * colour comes from `tintColor`, which the parent always passes from the
 * theme. Decorative – never an accessibility element; the parent owns the
 * TalkBack label.
 */
export function Icon({ name, size = sizeTokens.icon, color }: IconProps) {
  return (
    <Image
      testID={`icon-${name}`}
      source={ICON_SOURCES[name]}
      tintColor={color}
      contentFit="contain"
      style={{ width: size, height: size }}
      // expo-image's ImageStyle has no pointerEvents; the ViewProps prop does the same.
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no"
    />
  );
}

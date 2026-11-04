// TEMP: replaced with WebP + tintColor in #43
import { View } from "react-native";

import type { IconName } from "@/types/components";

export interface IconProps {
  name: IconName;
  size: number;
  color: string;
}

/**
 * Placeholder: reserves size × size in the layout so components keep their
 * final geometry. Decorative – never an accessibility element.
 */
export function Icon({ name, size, color }: IconProps) {
  void color;
  return (
    <View
      testID={`icon-${name}`}
      style={{ width: size, height: size, pointerEvents: "none" }}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}

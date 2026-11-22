import { memo } from "react";
import { View } from "react-native";

import type { StopCardProps } from "@/types/components";

import { DepartureRow } from "./DepartureRow";
import { StopHeader } from "./StopHeader";

/**
 * C05 · StopCard – a stop with its departures. The header is StopHeader, so
 * a flat list can render the same header as a row of its own (Powrót).
 */
function StopCardBase({ name, meta, freshness, departures, onGuide }: StopCardProps) {
  const firstSkm = departures.findIndex((d) => d.kind === "skm");

  return (
    <View>
      <StopHeader name={name} meta={meta} freshness={freshness} onGuide={onGuide} />
      {departures.map((departure, index) => (
        <DepartureRow
          key={`${departure.line}-${departure.time}-${index}`}
          {...departure}
          spellOutKind={index === firstSkm}
        />
      ))}
    </View>
  );
}

export const StopCard = memo(StopCardBase);

// Each require() must be a static string literal so Metro can bundle the
// asset and pick the @2x/@3x/@4x density at runtime; a computed path or an
// import statement for .webp is not an option here.
import type { ImageRequireSource } from "react-native";

import type { IconName } from "@/types/components";

/**
 * Base file for every interface icon (H04). Only the 1x file is referenced –
 * Metro resolves the density variant for the device.
 *
 * Typed as Record<IconName, …> so typecheck fails if an icon name is missing
 * here or an unknown key is added.
 */
export const ICON_SOURCES: Readonly<Record<IconName, ImageRequireSource>> = {
  plan: require("../../assets/icons/plan.webp"),
  map: require("../../assets/icons/map.webp"),
  crew: require("../../assets/icons/crew.webp"),
  tent: require("../../assets/icons/tent.webp"),
  return: require("../../assets/icons/return.webp"),
  tram: require("../../assets/icons/tram.webp"),
  add: require("../../assets/icons/add.webp"),
  minus: require("../../assets/icons/minus.webp"),
  inPlan: require("../../assets/icons/inPlan.webp"),
  close: require("../../assets/icons/close.webp"),
  warning: require("../../assets/icons/warning.webp"),
  signal: require("../../assets/icons/signal.webp"),
  noSignal: require("../../assets/icons/noSignal.webp"),
  sync: require("../../assets/icons/sync.webp"),
  clock: require("../../assets/icons/clock.webp"),
  pin: require("../../assets/icons/pin.webp"),
  arrowRight: require("../../assets/icons/arrowRight.webp"),
  arrowLeft: require("../../assets/icons/arrowLeft.webp"),
  chevronRight: require("../../assets/icons/chevronRight.webp"),
  chevronDown: require("../../assets/icons/chevronDown.webp"),
  download: require("../../assets/icons/download.webp"),
  share: require("../../assets/icons/share.webp"),
  bell: require("../../assets/icons/bell.webp"),
  bellOff: require("../../assets/icons/bellOff.webp"),
  eye: require("../../assets/icons/eye.webp"),
  eyeOff: require("../../assets/icons/eyeOff.webp"),
  weather: require("../../assets/icons/weather.webp"),
  locate: require("../../assets/icons/locate.webp"),
  north: require("../../assets/icons/north.webp"),
  navArrow: require("../../assets/icons/navArrow.webp"),
  flag: require("../../assets/icons/flag.webp"),
  parking: require("../../assets/icons/parking.webp"),
  moon: require("../../assets/icons/moon.webp"),
  calendar: require("../../assets/icons/calendar.webp"),
  stage: require("../../assets/icons/stage.webp"),
  toilet: require("../../assets/icons/toilet.webp"),
  water: require("../../assets/icons/water.webp"),
  medical: require("../../assets/icons/medical.webp"),
  gate: require("../../assets/icons/gate.webp"),
  food: require("../../assets/icons/food.webp"),
  more: require("../../assets/icons/more.webp"),
};

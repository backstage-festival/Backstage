// tsconfig limits global types to "jest"; this test needs Node's fs/path.
/// <reference types="node" />
import fs from "fs";
import path from "path";

import { ICON_NAMES } from "@/types/components";

import { ICON_SOURCES } from "../iconSources";

const ICONS_DIR = path.resolve(__dirname, "../../../assets/icons");
const DENSITIES = ["", "@2x", "@3x", "@4x"] as const;

describe("interface icons (H04)", () => {
  it("has 41 unique names", () => {
    expect(ICON_NAMES).toHaveLength(41);
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
  });

  it("maps every name to a source and nothing else", () => {
    expect(Object.keys(ICON_SOURCES).sort()).toEqual([...ICON_NAMES].sort());
  });

  it.each(ICON_NAMES)("%s has all four density files", (name) => {
    for (const density of DENSITIES) {
      expect(fs.existsSync(path.join(ICONS_DIR, `${name}${density}.webp`))).toBe(true);
    }
  });
});

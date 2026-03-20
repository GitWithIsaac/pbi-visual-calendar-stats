# Multi-Stat Calendar Visual — Design Spec

**Date:** 2026-03-20
**Project:** `pbi-visual-calendar-stats` (fork of Beyondsoft BCI Calendar)
**Phase:** 1
**Status:** Approved

---

## Overview

Modify the existing BCI Calendar Power BI custom visual to display multiple measure values per calendar day cell, replacing the current single-measure limitation. The end goal is a CEO-facing monthly calendar that shows key property management stats (occupancy, ADR, arrivals, departures, leads, etc.) for each day of the month.

---

## Background

The source system (OSCAR) does not store historical snapshots. The SQL layer reconstructs point-in-time stats by querying reservations data filtered to a date range, producing one row per day with multiple measure columns. The visual consumes this output and renders it as a calendar.

The base visual is deprecated by Microsoft but functional. This fork is for internal use only — AppSource compatibility is not required.

---

## Design Decisions

### Cell Layout — Color-Banded Pills

Each day cell displays the day number at the top-right, followed by one pill per measure stacked vertically. Each pill has a lightly tinted background and colored text, both derived from the measure's assigned color.

```
┌─────────────┐
│           1 │  ← day number
│     18      │  ← measure 1 (blue tint)
│    $142     │  ← measure 2 (green tint)
│    85%      │  ← measure 3 (red tint)
│      4      │  ← measure 4 (purple tint)
│      3      │  ← measure 5 (orange tint)
└─────────────┘
```

No labels inside the cell. A legend (color swatch + measure name) identifies each row.

### Legend

Rendered inside the visual as a separate element. Position is user-configurable via the format pane:

- **Top** — horizontal strip between month title and weekday header row
- **Bottom** — horizontal strip below the calendar grid
- **Right** (default) — vertical panel to the right of the calendar grid

Legend can be hidden via a toggle. Each entry shows the color swatch and the measure's display name as defined in the PBI data model.

### Cell Background Color

The existing gradient/fixed cell background coloring is preserved but made optional. A new format setting lets the user designate one measure as the "background stat." When set, the cell background is colored using the existing `calendarColors` gradient/fixed logic applied to that measure's value. Defaults to off (no background color).

---

## Data Model Changes

### `capabilities.json`

- Remove `"max": 1` from the `measure` condition in `dataViewMappings`. This allows the user to drag multiple fields into the "Measure Data" bucket.
- `category` (Date Field) and `tooltipmeasure` roles are unchanged.
- Keep `"supportsHighlight": true`.

### `CalendarDataPoint` interface (`visual.ts`)

Replace the single `value`/`valueText` pair with a `measures` array:

```typescript
interface MeasureValue {
    value: number;
    valueText: string;
    displayName: string;
}

interface CalendarDataPoint extends SelectableDataPoint {
    measures: MeasureValue[];   // one entry per bound measure field, positional
    category: string;
    rowdata: any;
    key: string;
    highlight?: boolean;
    selectionId: ISelectionId;
}
```

### `visualTransform()` (`visual.ts`)

Loop over all columns in `categorical.values` (instead of just `[0]`) to build the `measures` array for each data point. The primary measure for selection/highlight purposes remains `categorical.values[0]`.

---

## Format Pane Settings

### New settings

| Section | Setting | Type | Default |
|---|---|---|---|
| `measureColors` | `color1` … `color5` | Color | Blue, Green, Red, Purple, Orange |
| `legend` | `show` | Toggle | On |
| `legend` | `position` | Enum: `top` / `bottom` / `right` | `right` |
| `backgroundStat` | `enabled` | Toggle | Off |
| `backgroundStat` | `measureIndex` | Enum: None / Measure 1–5 | None |

### Existing settings preserved

All existing `calendar`, `calendarColors`, `dataLabels`, `showWeeks` format sections are kept. `dataLabels` text size/weight/color applies globally to all measure pills (not per-measure) in Phase 1. `calendarColors` gradient/fixed settings activate only when `backgroundStat.enabled` is on.

---

## Rendering Changes (`bciCalendar.js`)

### Cell structure

Each non-empty `<td>` currently appends:
```
.bci-calendar-parent
  .bci-calendar-day      ← day number
  .bci-calendar-dataLabel  ← single value
```

New structure:
```
.bci-calendar-parent
  .bci-calendar-day         ← day number (unchanged)
  .bci-calendar-pill-0      ← measure 1 pill
  .bci-calendar-pill-1      ← measure 2 pill
  ...
  .bci-calendar-pill-N
```

Each pill `div`:
- `background-color`: light tint of the measure's color (e.g. 15% opacity)
- `color`: full measure color
- `font-size`, `font-weight`: from `dataLabels` settings
- `text-align`: center
- `border-radius`: 2px
- `padding`: 0 2px
- `margin-bottom`: 1px

### Legend rendering

A `div.bci-calendar-legend` is appended outside the `<table>`. Its position in the DOM and CSS flex layout changes based on `legend.position`:

- `top` / `bottom`: horizontal flex row, inserted before or after the table
- `right`: the table and legend are wrapped in a flex row container, legend as a vertical column

Each legend entry: color swatch (9×9px, border-radius 2px) + measure display name.

### Background color

When `backgroundStat.enabled` is true, the existing `getColor(dataValue)` function is called with the value of the designated measure index. Otherwise the `<td>` background is left unset (transparent).

---

## What Is Not Changing (Phase 1)

- Month/year header display and alignment
- Weekday row format and week start day
- Week number display and placement
- Cell border styling
- Cross-filter click behavior and report bookmarks
- Tooltip behavior (already shows all `rowdata` columns on hover)
- Selection/highlight/dimming behavior (driven by first measure)

---

## Out of Scope (Phase 1)

- Per-measure font size / color overrides in the format pane
- More than 5 simultaneous measures
- Conditional formatting per measure
- Tooltip customization beyond current behavior

---

## Files to Modify

| File | Change |
|---|---|
| `capabilities.json` | Remove `measure` max constraint; add `measureColors`, `legend`, `backgroundStat` objects |
| `src/visual.ts` | Update `CalendarDataPoint`, `CalendarSettings`, `visualTransform()`, `enumerateObjectInstances()` |
| `src/bciCalendar.js` | Update cell rendering loop, add legend rendering, update background color logic |
| `style/visual.less` | Add `.bci-calendar-pill`, `.bci-calendar-legend` styles |

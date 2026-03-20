# Multi-Stat Calendar Visual Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify the BCI Calendar Power BI custom visual to display up to 5 color-coded measure values per day cell, with a configurable legend and optional background color tied to a primary stat.

**Architecture:** The existing single-measure data pipeline is widened at every layer — `capabilities.json` allows up to 5 measures, `visualTransform()` collects them into a `measures[]` array per data point, and `bciCalendar.js` renders each measure as a color-banded pill div inside the day cell. A legend div is rendered outside the table in a flex container whose layout direction is controlled by a new format-pane setting.

**Tech Stack:** TypeScript (PBI extensibility API 1.11.0), D3 v3, LESS, `powerbi-visuals-tools` 1.x (`pbiviz` CLI)

---

## File Map

| File | What changes |
|---|---|
| `capabilities.json` | Set measure max to 5; add `measureColors`, `legend`, `backgroundStat` format objects |
| `src/visual.ts` | Add `MeasureValue` interface; update `CalendarDataPoint`, `CalendarSettings`; rewrite `visualTransform()`; add `enumerateObjectInstances()` cases |
| `src/bciCalendar.js` | Accept parent container; create wrapper div; replace single `dataLabel` with pills loop; add legend rendering; update background color to respect `backgroundStat` |
| `style/visual.less` | Add `.bci-calendar-container`, `.bci-calendar-pill`, `.bci-calendar-legend` rules; remove `.bci-calendar-dataLabel` |
| `src/colorUtils.js` | **New** — pure JS utility: `hexToRgb()`, `pillBackground()`, `pillForeground()` |

---

## Task 1: Environment Setup

**Files:** none modified

- [ ] **Step 1: Install pbiviz CLI globally**

```bash
npm install -g powerbi-visuals-tools@1.13.0
pbiviz --version
```

Expected: prints `1.13.x`

> If you see a version conflict, try `npm install -g powerbi-visuals-tools@1.x` to get the latest 1.x release. The 3.x tool uses a different project structure and is not compatible with this codebase.

- [ ] **Step 2: Install project dependencies**

```bash
cd pbi-visual-calendar-stats
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Verify baseline build**

```bash
npm run package
```

Expected: `dist/bciCalendar.pbiviz` is created (or updated). If it fails, check that all `externalJS` paths in `pbiviz.json` exist inside `node_modules/`.

- [ ] **Step 4: Commit baseline node_modules state (lockfile only)**

```bash
git add package-lock.json 2>/dev/null || true
git commit -m "chore: npm install baseline" --allow-empty
```

---

## Task 2: Color Utility (`src/colorUtils.js`)

Pure functions for deriving pill background tints from a hex color. Extracted into their own file so they can be unit tested without the PBI host.

**Files:**
- Create: `src/colorUtils.js`
- Create: `src/colorUtils.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/colorUtils.test.js`:

```js
const { hexToRgb, pillBackground, pillForeground } = require('./colorUtils');

test('hexToRgb parses 6-digit hex', () => {
    expect(hexToRgb('#2563eb')).toEqual({ r: 37, g: 99, b: 235 });
});

test('hexToRgb returns null for invalid input', () => {
    expect(hexToRgb('notacolor')).toBeNull();
    expect(hexToRgb(null)).toBeNull();
});

test('pillBackground produces rgba with 0.15 alpha', () => {
    expect(pillBackground('#2563eb')).toBe('rgba(37,99,235,0.15)');
});

test('pillBackground falls back to transparent on invalid color', () => {
    expect(pillBackground(null)).toBe('transparent');
});

test('pillForeground returns the original color unchanged', () => {
    expect(pillForeground('#2563eb')).toBe('#2563eb');
});

test('pillForeground falls back to #333 on invalid color', () => {
    expect(pillForeground(null)).toBe('#333');
});
```

- [ ] **Step 2: Install jest and run to confirm all fail**

```bash
npm install --save-dev jest
npx jest src/colorUtils.test.js
```

Expected: 6 failing tests (module not found).

- [ ] **Step 3: Implement `src/colorUtils.js`**

```js
function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return null;
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function pillBackground(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) return 'transparent';
    return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.15)';
}

function pillForeground(hex) {
    if (!hex || !hexToRgb(hex)) return '#333';
    return hex;
}

if (typeof module !== 'undefined') {
    module.exports = { hexToRgb, pillBackground, pillForeground };
}
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npx jest src/colorUtils.test.js
```

Expected: 6 passing tests.

- [ ] **Step 5: Add `colorUtils.js` to `pbiviz.json` external scripts**

In `pbiviz.json`, add `"src/colorUtils.js"` to the `externalJS` array **before** `bciCalendar.js` (which does not exist there yet — it is compiled in via the TypeScript build, but `bciCalendar.js` is a plain JS file included separately):

> Note: `bciCalendar.js` is listed in `src/bciCalendar.d.ts` and referenced from `visual.ts`. Check whether `pbiviz.json` currently includes it under `externalJS`. If not, add both `"src/colorUtils.js"` and `"src/bciCalendar.js"` there in that order.

- [ ] **Step 6: Verify build still works**

```bash
npm run package
```

Expected: builds without errors.

- [ ] **Step 7: Commit**

```bash
git add src/colorUtils.js src/colorUtils.test.js pbiviz.json package.json package-lock.json
git commit -m "feat: add colorUtils for pill color derivation"
```

---

## Task 3: `capabilities.json` — Measure Cap + New Format Objects

**Files:**
- Modify: `capabilities.json`

- [ ] **Step 1: Update the measure max and add new format objects**

In `capabilities.json`:

**a) In `dataViewMappings[0].conditions[0]`**, change:
```json
"measure": { "max": 1 }
```
to:
```json
"measure": { "max": 5 }
```

**b) Add three new top-level objects inside `"objects": { ... }`** (alongside the existing `calendar`, `showWeeks`, `calendarColors`, `dataLabels` objects):

```json
"measureColors": {
    "displayName": "Measure Colors",
    "properties": {
        "color1": { "displayName": "Measure 1 Color", "type": { "fill": { "solid": { "color": true } } } },
        "color2": { "displayName": "Measure 2 Color", "type": { "fill": { "solid": { "color": true } } } },
        "color3": { "displayName": "Measure 3 Color", "type": { "fill": { "solid": { "color": true } } } },
        "color4": { "displayName": "Measure 4 Color", "type": { "fill": { "solid": { "color": true } } } },
        "color5": { "displayName": "Measure 5 Color", "type": { "fill": { "solid": { "color": true } } } }
    }
},
"legend": {
    "displayName": "Legend",
    "properties": {
        "show": { "displayName": "Show Legend", "type": { "bool": true } },
        "position": {
            "displayName": "Position",
            "type": {
                "enumeration": [
                    { "value": "top",    "displayName": "Top"    },
                    { "value": "bottom", "displayName": "Bottom" },
                    { "value": "right",  "displayName": "Right"  }
                ]
            }
        }
    }
},
"backgroundStat": {
    "displayName": "Background Color Stat",
    "properties": {
        "enabled": { "displayName": "Enable Background Color", "type": { "bool": true } },
        "measureIndex": {
            "displayName": "Stat",
            "type": {
                "enumeration": [
                    { "value": "0", "displayName": "None"      },
                    { "value": "1", "displayName": "Measure 1" },
                    { "value": "2", "displayName": "Measure 2" },
                    { "value": "3", "displayName": "Measure 3" },
                    { "value": "4", "displayName": "Measure 4" },
                    { "value": "5", "displayName": "Measure 5" }
                ]
            }
        }
    }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run package
```

Expected: builds without errors. If you see a schema validation error, double-check JSON syntax — a trailing comma is the most common mistake.

- [ ] **Step 3: Commit**

```bash
git add capabilities.json
git commit -m "feat: capabilities — allow 5 measures, add measureColors/legend/backgroundStat"
```

---

## Task 4: `visual.ts` — Interfaces and Settings

**Files:**
- Modify: `src/visual.ts`

- [ ] **Step 1: Add `MeasureValue` interface and update `CalendarDataPoint`**

After the existing `CalendarDataPoint` interface, add:

```typescript
interface MeasureValue {
    value: number;
    valueText: string;
    displayName: string;
}
```

Replace the `CalendarDataPoint` interface body:

```typescript
interface CalendarDataPoint extends SelectableDataPoint {
    measures: MeasureValue[];   // positional, one per bound measure field
    category: string;
    rowdata: any;
    key: string;
    highlight?: boolean;
    selectionId: ISelectionId;
}
```

> Remove the old `value`, `valueText` fields entirely. They are replaced by `measures[0].value` and `measures[0].valueText` where needed.

- [ ] **Step 2: Add new settings interfaces**

After the existing `WeekNumberSettings` interface, add:

```typescript
interface MeasureColorSettings {
    color1: Fill;
    color2: Fill;
    color3: Fill;
    color4: Fill;
    color5: Fill;
}

interface LegendSettings {
    show: boolean;
    position: string;
}

interface BackgroundStatSettings {
    enabled: boolean;
    measureIndex: number;
}
```

- [ ] **Step 3: Update `CalendarSettings` interface**

Add three new fields to `CalendarSettings`:

```typescript
interface CalendarSettings {
    // ... existing fields unchanged ...
    measureColors: MeasureColorSettings;
    legend: LegendSettings;
    backgroundStat: BackgroundStatSettings;
}
```

- [ ] **Step 4: Add defaults to `defaultSettings`**

Inside `visualTransform()`, add to the `defaultSettings` object:

```typescript
measureColors: {
    color1: { solid: { color: '#2563eb' } },
    color2: { solid: { color: '#16a34a' } },
    color3: { solid: { color: '#dc2626' } },
    color4: { solid: { color: '#9333ea' } },
    color5: { solid: { color: '#ea580c' } }
},
legend: {
    show: true,
    position: 'right'
},
backgroundStat: {
    enabled: false,
    measureIndex: 0
}
```

- [ ] **Step 5: Read new settings from `objects` in `calendarSettings`**

In the `calendarSettings` block inside `visualTransform()`, add:

```typescript
measureColors: {
    color1: getValue<Fill>(objects, 'measureColors', 'color1', defaultSettings.measureColors.color1),
    color2: getValue<Fill>(objects, 'measureColors', 'color2', defaultSettings.measureColors.color2),
    color3: getValue<Fill>(objects, 'measureColors', 'color3', defaultSettings.measureColors.color3),
    color4: getValue<Fill>(objects, 'measureColors', 'color4', defaultSettings.measureColors.color4),
    color5: getValue<Fill>(objects, 'measureColors', 'color5', defaultSettings.measureColors.color5),
},
legend: {
    show: getValue<boolean>(objects, 'legend', 'show', defaultSettings.legend.show),
    position: getValue<string>(objects, 'legend', 'position', defaultSettings.legend.position)
},
backgroundStat: {
    enabled: getValue<boolean>(objects, 'backgroundStat', 'enabled', defaultSettings.backgroundStat.enabled),
    measureIndex: parseInt(getValue<string>(objects, 'backgroundStat', 'measureIndex', '0')) || 0
}
```

- [ ] **Step 6: Verify build**

```bash
npm run package
```

Expected: TypeScript compilation errors about `value`/`valueText` usages — these are expected and will be fixed in Task 5.

- [ ] **Step 7: Commit interfaces (pre-transform)**

```bash
git add src/visual.ts
git commit -m "feat: visual.ts interfaces — MeasureValue, multi-measure settings"
```

---

## Task 5: `visual.ts` — `visualTransform()` Data Loop

**Files:**
- Modify: `src/visual.ts`

- [ ] **Step 1: Replace the data point loop**

Find the existing loop `for (let i = 0, len = Math.max(...); i < len; i++)` and replace it entirely.

> The original loop used `Math.max(category.values.length, dataValue.values.length)` to guard against mismatched lengths. In a PBI categorical mapping, all value columns are guaranteed to have the same length as the category column, so `category.values.length` is the correct and sufficient bound. The `Math.max` guard is safe to drop.

```typescript
for (let i = 0, len = category.values.length; i < len; i++) {
    if (!category.values[i]) continue;

    let selectionIdBuilder = host.createSelectionIdBuilder().withCategory(category, i);
    let selectionId = selectionIdBuilder.createSelectionId();
    let highlight: any = categorical.values[0].highlights && categorical.values[0].highlights[i] !== null;

    let measures: MeasureValue[] = categorical.values.map((col) => {
        let textFormat = valueFormatter.create({
            value: calendarSettings.dataLabels.unit,
            precision: calendarSettings.dataLabels.precision,
            format: valueFormatter.getFormatStringByColumn(col.source)
        });
        return {
            value: col.values[i] !== null ? parseFloat(String(col.values[i])) : NaN,
            valueText: textFormat.format(col.values[i]),
            displayName: col.source.displayName
        };
    });

    // Note: selectionId is constructed three times here (selectionId, key, and the
    // inline one in the push). This mirrors the original codebase pattern exactly —
    // do not consolidate unless you are refactoring the whole selection system.
    calendarDataPoints.push({
        category: <string>category.values[i],
        measures: measures,
        rowdata: tabledata[i],
        selected: false,
        identity: selectionId,
        key: (selectionIdBuilder.createSelectionId() as ISelectionId).getKey(),
        highlight: highlight,
        selectionId: host.createSelectionIdBuilder()
            .withCategory(category, i)
            .createSelectionId()
    });
}
```

- [ ] **Step 2: Update `hasHighlights` assignment**

Change:
```typescript
viewModel.hasHighlights = !!(dataValue.highlights);
```
to:
```typescript
viewModel.hasHighlights = !!(categorical.values[0] && categorical.values[0].highlights);
```

Also remove the line `let dataValue = categorical.values[0];` (no longer needed — the loop now handles all values directly).

- [ ] **Step 3: Remove unused `valueFormat` variable**

Remove:
```typescript
let valueFormat = valueFormatter.create({
    value: calendarSettings.dataLabels.unit,
    precision: calendarSettings.dataLabels.precision
});
```
This is now handled inside the loop per-column.

- [ ] **Step 4: Verify build**

```bash
npm run package
```

Expected: remaining build errors will be in `getTooltipData` and `bciCalendar.js` which still reference `.value`/`.valueText` — these are fixed in later tasks.

- [ ] **Step 5: Commit**

```bash
git add src/visual.ts
git commit -m "feat: visual.ts — visualTransform builds measures[] array per data point"
```

---

## Task 6: `visual.ts` — `enumerateObjectInstances()`

**Files:**
- Modify: `src/visual.ts`

- [ ] **Step 1: Add new cases to the switch statement**

Inside `enumerateObjectInstances()`, add after the existing `case 'dataLabels':` block:

```typescript
case 'measureColors':
    objectEnumeration.push({
        objectName: objectName,
        properties: {
            color1: this.calendarSettings.measureColors.color1,
            color2: this.calendarSettings.measureColors.color2,
            color3: this.calendarSettings.measureColors.color3,
            color4: this.calendarSettings.measureColors.color4,
            color5: this.calendarSettings.measureColors.color5
        },
        selector: null
    });
    break;
case 'legend':
    objectEnumeration.push({
        objectName: objectName,
        properties: {
            show: this.calendarSettings.legend.show,
            position: this.calendarSettings.legend.position
        },
        selector: null
    });
    break;
case 'backgroundStat':
    objectEnumeration.push({
        objectName: objectName,
        properties: {
            enabled: this.calendarSettings.backgroundStat.enabled,
            measureIndex: String(this.calendarSettings.backgroundStat.measureIndex)
        },
        selector: null
    });
    break;
```

- [ ] **Step 2: Verify build**

```bash
npm run package
```

Expected: should compile cleanly now except for any remaining `value`/`valueText` references in tooltip code (handled in the next step).

- [ ] **Step 3: Fix `getTooltipData` to work with `measures[]`**

The tooltip currently reads `value.data.value` (single value). Update `getTooltipData` to still work — it already uses `rowdata` for the actual tooltip content, so the fix is minimal:

```typescript
private static getTooltipData(value: any, cols: any, locale: string, displayUnit: number, precision: number): VisualTooltipDataItem[] {
    var zip = rows => rows[0].map((_, c) => rows.map(row => row[c]));
    var tooltips = [];
    // use measures[0].value as the guard (was value.data.value)
    if (value.data != null && value.data.measures && value.data.measures.length > 0 && !isNaN(value.data.measures[0].value)) {
        var tooltipdata = zip([cols, value.data.rowdata]);
        var date = new Date(value.data.category).toLocaleDateString(locale);
        tooltipdata.forEach((t) => {
            let format = valueFormatter.create({
                format: valueFormatter.getFormatStringByColumn(t[0]),
                value: displayUnit,
                precision: precision
            });
            let temp = {};
            let val;
            if (t[0].roles.measure) {
                val = format.format(t[1]);
            } else {
                val = valueFormatter.format(t[1], format.options.format);
            }
            temp['header'] = date;
            temp['displayName'] = t[0].displayName;
            temp['value'] = val;
            tooltips.push(temp);
        });
    } else {
        tooltips.push({ 'displayName': 'No Data' });
    }
    return tooltips;
}
```

- [ ] **Step 4: Verify clean build**

```bash
npm run package
```

Expected: builds with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/visual.ts
git commit -m "feat: visual.ts — enumerateObjectInstances for new settings, fix tooltip"
```

---

## Task 7: `style/visual.less` — Pill and Legend Styles

**Files:**
- Modify: `style/visual.less`

- [ ] **Step 1: Replace `.bci-calendar-dataLabel` and add new rules**

Remove the existing `.bci-calendar-dataLabel` rule (lines 29–37 — the absolute-positioned block). Replace with:

```less
/* Deprecated: .bci-calendar-dataLabel replaced by pills */

.bci-calendar-container {
    display: flex;
    width: 100%;
    height: 100%;
}

.bci-calendar-container.legend-top,
.bci-calendar-container.legend-bottom {
    flex-direction: column;
}

.bci-calendar-container.legend-right {
    flex-direction: row;
}

.bci-calendar-pill {
    display: block;
    border-radius: 2px;
    padding: 0 2px;
    margin-bottom: 1px;
    text-align: center;
    line-height: 1.3;
    /* background-color and color set inline by bciCalendar.js */
}

.bci-calendar-legend {
    display: flex;
    flex-shrink: 0;
    gap: 6px;
}

.bci-calendar-container.legend-top .bci-calendar-legend,
.bci-calendar-container.legend-bottom .bci-calendar-legend {
    flex-direction: row;
    flex-wrap: wrap;
    padding: 4px 0;
    border-top: 1px solid #eee;
}

.bci-calendar-container.legend-top .bci-calendar-legend {
    border-top: none;
    border-bottom: 1px solid #eee;
}

.bci-calendar-container.legend-right .bci-calendar-legend {
    flex-direction: column;
    justify-content: center;
    padding: 0 8px;
    border-left: 1px solid #eee;
}

.bci-calendar-legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: 'Segoe UI', helvetica, arial, sans-serif;
    white-space: nowrap;
}

.bci-calendar-legend-swatch {
    width: 9px;
    height: 9px;
    border-radius: 2px;
    flex-shrink: 0;
}
```

- [ ] **Step 2: Verify build**

```bash
npm run package
```

Expected: builds without errors.

- [ ] **Step 3: Commit**

```bash
git add style/visual.less
git commit -m "feat: visual.less — pill and legend styles, remove dataLabel"
```

---

## Task 8: `bciCalendar.js` — Container Wrapper and Call Site

The current `loadCalendar()` receives the `<table>` element directly. We need to work from the parent container so we can insert the legend alongside the table.

**Files:**
- Modify: `src/bciCalendar.js`
- Modify: `src/visual.ts` (constructor + update)

- [ ] **Step 1: Update the `Visual` class field type and constructor in `visual.ts`**

**a) Change the type declaration** in the `Visual` class body. Find:

```typescript
private table: d3.Selection<HTMLTableElement>;
```

Replace with:

```typescript
private table: d3.Selection<HTMLElement>;
```

**b) Update the constructor.** Find and remove the `append('table')` call:

```typescript
let table = this.table = d3.select(options.element)
    .append('table').classed(this.className, true);
```

Replace with:

```typescript
this.table = d3.select(options.element);
```

`this.table` now holds a selection of the root container div PBI provides. The `<table>` will be created inside `bciCalendar.js` on each render instead.

- [ ] **Step 2: Remove the `attr`/`style` calls on `this.table` in `update()`**

In `update()`, find and **remove** these lines (they sized and positioned the `<table>` directly — the container div does not need them, and the `margin` styles would conflict with the new flex layout):

```typescript
this.table
    .attr({
        width: width,
        height: height
    })
    .style({
        'margin-left': margins.left + 'px',
        'margin-top': margins.top + 'px'
    });
```

The `this.table.selectAll('*').remove()` line that follows remains unchanged — it correctly clears the container before each render.

- [ ] **Step 3: Harden `className` derivation in `bciCalendar.js`**

Near the top of `bciCalendar.loadCalendar`, find:

```js
var className = calendar.attr("class");
```

Replace with:

```js
var className = 'bci-calendar';
```

`element` is now the root container div (no class). Hardcoding the class name is correct — it matches the class applied to the `<table>` in the next step and all downstream `id` and selector lookups depend on it.

- [ ] **Step 4: Create the container wrapper and table in `bciCalendar.js`**

Replace `var calendar = element;` (and the line immediately after it that sets `var className`) with:

```js
var container = element.append('div')
    .attr('class', 'bci-calendar-container');

// Apply legend position class for CSS flex layout
var legendPos = (settings.legend && settings.legend.position) || 'right';
if (settings.legend && settings.legend.show !== false) {
    container.classed('legend-' + legendPos, true);
}

// If legend is top, create its element before the table
var legendEl = null;
if (settings.legend && settings.legend.show !== false && legendPos === 'top') {
    legendEl = container.append('div').attr('class', 'bci-calendar-legend');
}

var table = container.append('table').classed(className, true);
var calendar = table;
```

> `this.table.selectAll('*').remove()` in `update()` clears the root container on every render, so `container` and everything inside it is destroyed and rebuilt each time. This is correct behavior inherited from the original visual.

- [ ] **Step 5: Verify build**

```bash
npm run package
```

Expected: builds without errors.

- [ ] **Step 6: Commit**

```bash
git add src/bciCalendar.js src/visual.ts
git commit -m "feat: bciCalendar — container wrapper, accept parent div instead of table"
```

---

## Task 9: `bciCalendar.js` — Pill Rendering

Replace the single `dataLabel` rendering loop with a pills loop.

**Files:**
- Modify: `src/bciCalendar.js`

- [ ] **Step 1: Update `self` initializer to use `measures[]`**

The existing `self = { ... }` block at the top of `loadCalendar` computes `minValue`, `centerValue`, and `maxValue` from `d.value` (the old single-value field):

```js
// OLD — remove this block:
self = {
    ...
    minValue: settings.calendarColors.minValue || d3.min(viewModel.dataPoints.map(function(d) { return d.value; })),
    centerValue: settings.calendarColors.centerValue || d3.mean(viewModel.dataPoints.map(function(d) { return d.value; })),
    maxValue: settings.calendarColors.maxValue || d3.max(viewModel.dataPoints.map(function(d) { return d.value; }))
};
```

Replace the three `d.value` references with `d.measures[0] ? d.measures[0].value : NaN`. The background color scale always uses the first measure as the baseline (the designated `backgroundStat` measure value is passed explicitly in Task 9 Step 2 — these min/max values only set the scale domain):

```js
self = {
    calendar: element,
    viewModel: viewModel,
    settings: settings,
    selectionManager: selectionManager,
    allowInteractions: allowInteractions,
    minValue: settings.calendarColors.minValue || d3.min(viewModel.dataPoints.map(function(d) {
        return d.measures[0] ? d.measures[0].value : NaN;
    })),
    centerValue: settings.calendarColors.centerValue || d3.mean(viewModel.dataPoints.map(function(d) {
        return d.measures[0] ? d.measures[0].value : NaN;
    })),
    maxValue: settings.calendarColors.maxValue || d3.max(viewModel.dataPoints.map(function(d) {
        return d.measures[0] ? d.measures[0].value : NaN;
    }))
};
```

- [ ] **Step 2: Build the color array from settings**

After the `self = { ... }` block, add:

```js
var measureColorKeys = ['color1', 'color2', 'color3', 'color4', 'color5'];
self.measureColors = measureColorKeys.map(function(key) {
    return (settings.measureColors && settings.measureColors[key] && settings.measureColors[key].solid)
        ? settings.measureColors[key].solid.color
        : null;
});
// default palette for any missing color slots
var defaultColors = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c'];
self.measureColors = self.measureColors.map(function(c, i) {
    return c || defaultColors[i];
});
```

- [ ] **Step 3: Replace the data point rendering loop**

Find the existing loop (lines ~223–250 in the original) that loops over `viewModel.dataPoints` and appends `.bci-calendar-dataLabel`. Replace it entirely:

```js
// Render pills for each data point
for (var i = 0; i < viewModel.dataPoints.length; i++) {
    var dataPoint = viewModel.dataPoints[i];
    var date = new Date(dataPoint.category);
    var year = date.getFullYear();
    var month = date.getMonth();
    var day = date.getDate();
    var id = className + '-' + year.toString() + month.toString() + day.toString();
    var td = d3.select('#' + id);

    // Background color from primary stat (if enabled)
    var bgColor = '';
    var bgEnabled = settings.backgroundStat && settings.backgroundStat.enabled;
    var bgIndex = settings.backgroundStat ? (settings.backgroundStat.measureIndex - 1) : -1;
    if (bgEnabled && bgIndex >= 0 && dataPoint.measures[bgIndex]) {
        bgColor = getColor(dataPoint.measures[bgIndex].value);
    }
    if (bgColor) td.style('background-color', bgColor);

    // Render one pill per measure
    if (settings.dataLabels.show) {
        var parent = d3.select('#' + id + ' .' + className + '-parent');
        dataPoint.measures.forEach(function(measure, idx) {
            if (isNaN(measure.value)) return;
            var fg = pillForeground(self.measureColors[idx]);
            var bg = pillBackground(self.measureColors[idx]);
            parent.append('div')
                .attr('class', className + '-pill')
                .style({
                    'background-color': bg,
                    'color': fg,
                    'font-size': settings.dataLabels.textSize + 'px',
                    'font-weight': settings.dataLabels.fontWeight
                })
                .text(measure.valueText);
        });
    }
}
```

> `pillForeground` and `pillBackground` come from `colorUtils.js` which is loaded as a global via `externalJS` in `pbiviz.json`.

- [ ] **Step 4: Verify build and dev server**

```bash
npm run package
# Then start dev server for visual verification:
npm run start
```

In PBI Desktop, open a report, add the Developer Visual, bind a Date column and 2–3 measure columns. Expected: pills appear in each day cell with tinted colors.

- [ ] **Step 5: Commit**

```bash
git add src/bciCalendar.js
git commit -m "feat: bciCalendar — render measure pills per day cell"
```

---

## Task 10: `bciCalendar.js` — Legend Rendering

**Files:**
- Modify: `src/bciCalendar.js`

- [ ] **Step 1: Add legend rendering after the pills loop**

After the pills loop, add:

```js
// Render legend
if (settings.legend && settings.legend.show !== false) {
    var legendPos = settings.legend.position || 'right';

    // If top, legendEl was already created before the table (Task 8).
    // For bottom and right, create it now.
    if (legendPos !== 'top') {
        legendEl = container.append('div').attr('class', 'bci-calendar-legend');
    }

    viewModel.dataPoints[0].measures.forEach(function(measure, idx) {
        var color = self.measureColors[idx] || '#999';
        var item = legendEl.append('div').attr('class', 'bci-calendar-legend-item');
        item.append('div')
            .attr('class', 'bci-calendar-legend-swatch')
            .style('background-color', color);
        item.append('span')
            .style({
                'font-size': (settings.dataLabels.textSize || 9) + 'px',
                // fontColor is an existing field on CalendarSettings from the original codebase
                // (calendar.fontColor). Defensive fallback in case it is null/undefined.
                'color': (settings.fontColor && settings.fontColor.solid && settings.fontColor.solid.color) || '#333'
            })
            .text(measure.displayName);
    });
}
```

> `legendEl` was declared in Task 8 — it is either pre-created (for `top`) or null. The `container` variable is also from Task 8.

- [ ] **Step 2: Verify build and dev server**

```bash
npm run package && npm run start
```

In PBI Desktop: expected legend appears to the right of the calendar. Change the Legend Position format setting to Top/Bottom — verify layout changes accordingly. Toggle "Show Legend" off — verify legend disappears.

- [ ] **Step 3: Commit**

```bash
git add src/bciCalendar.js
git commit -m "feat: bciCalendar — legend rendering with configurable position"
```

---

## Task 11: End-to-End Verification and Package

**Files:** none modified

- [ ] **Step 1: Run unit tests**

```bash
npx jest src/colorUtils.test.js
```

Expected: 6 passing.

- [ ] **Step 2: Build final package**

```bash
npm run package
```

Expected: `dist/bciCalendar.pbiviz` produced with no errors.

- [ ] **Step 3: Import into PBI Desktop and smoke test**

Import `dist/bciCalendar.pbiviz` as a custom visual. Create a simple table with:
- A `Date` column (one row per day for a single month)
- 5 measure columns (e.g., integers or decimals)

Bind them to the visual and verify:

| Check | Expected |
|---|---|
| Day cells show 5 pills | ✓ |
| Each pill has distinct tinted background | ✓ |
| Legend appears on the right with correct labels | ✓ |
| Format pane > Legend Position = Top | Legend moves above calendar |
| Format pane > Legend Position = Bottom | Legend moves below calendar |
| Format pane > Show Legend = Off | Legend hidden |
| Format pane > Background Color Stat = Enabled, Stat = Measure 1 | Cell background colored by first measure |
| Format pane > Background Color Stat = Enabled, Stat = None | No background color |
| Clicking a day cross-filters other visuals | ✓ (inherited from original) |
| Tooltip on hover shows all measure values | ✓ |

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: multi-stat calendar visual — phase 1 complete"
```

---

## Troubleshooting

**`pbiviz start` error: "Cannot find module"**
Run `npm install` again. The dev server requires all `externalJS` paths to exist.

**TypeScript error on `getValue<Fill>`**
The `getValue` helper is declared in `objectEnumerationUtility.ts`. If the compiler can't find it, check `tsconfig.json` includes all `src/*.ts` files.

**Pills not appearing**
Check browser console in the PBI dev visual frame (F12). A common issue is `pillBackground is not defined` — verify `colorUtils.js` is in `pbiviz.json` `externalJS` and listed before `bciCalendar.js`.

**Legend overlaps calendar on narrow visual**
The flex container depends on the visual panel being wide enough. The `legend-right` layout works best when the visual is at least 600px wide. For narrow panels, Bottom position is more reliable.

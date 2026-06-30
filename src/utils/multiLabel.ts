import cloneDeep from "lodash/cloneDeep";
import { uuidv4 } from "@/utils/uuid";
import { normalizeVariableKey } from "@/utils/variables";
import {
  ElementType,
  type MultiLabelSettings,
  type Page,
  type PrintElement,
} from "@/types";

export interface LabelRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CellPosition {
  index: number;
  row: number;
  col: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
}

/** Number of labels rendered on a single page. */
export const getMultiLabelPerPage = (ml: MultiLabelSettings): number => {
  const rows = Math.max(1, Math.round(ml.rows || 1));
  const cols = Math.max(1, Math.round(ml.cols || 1));
  return rows * cols;
};

/**
 * How many label rows fit on a single page given the page height. A row that
 * would partially overflow the bottom of the page is pushed to the next page.
 * Never returns more than the designed row count, and at least 1.
 */
export const getMultiLabelRowsPerPage = (
  ml: MultiLabelSettings,
  pageHeight: number,
): number => {
  const rows = Math.max(1, Math.round(ml.rows || 1));
  if (!pageHeight || pageHeight <= 0) return rows;
  const labelHeight = Math.max(1, ml.labelHeight || 1);
  const gapY = Math.max(0, ml.gapY || 0);
  const marginTop = ml.marginTop || 0;
  const available = pageHeight - marginTop;
  if (available <= 0) return 1;
  const fit = Math.floor((available + gapY) / (labelHeight + gapY));
  return Math.max(1, Math.min(rows, fit));
};

/** Rectangle (px) of the first label, which acts as the editable template. */
export const getLabelRegion = (ml: MultiLabelSettings): LabelRegion => ({
  x: ml.marginLeft || 0,
  y: ml.marginTop || 0,
  width: Math.max(1, ml.labelWidth || 1),
  height: Math.max(1, ml.labelHeight || 1),
});

/**
 * Build a `MultiLabelSettings` from a MULTI_LABEL element. The element itself is
 * the first label cell (x/y = grid origin, width/height = label size) and holds
 * the grid config; appearance reuses the standard style fields.
 */
export const multiLabelSettingsFromElement = (
  el: PrintElement,
): MultiLabelSettings => ({
  enabled: true,
  dataVariable: el.dataVariable || "",
  rows: Math.max(1, Math.round(el.rows || 1)),
  cols: Math.max(1, Math.round(el.cols || 1)),
  labelWidth: Math.max(1, el.width || 1),
  labelHeight: Math.max(1, el.height || 1),
  gapX: Math.max(0, el.gapX || 0),
  gapY: Math.max(0, el.gapY || 0),
  marginLeft: el.x || 0,
  marginTop: el.y || 0,
  direction: el.direction === "column" ? "column" : "row",
  backgroundColor: el.style?.backgroundColor || "transparent",
  borderStyle: (el.style?.borderStyle as MultiLabelSettings["borderStyle"]) || "none",
  borderWidth: el.style?.borderWidth || 0,
  borderColor: el.style?.borderColor || "#000000",
});

/** Locate the (single) multi-label container element in a list, if any. */
export const findMultiLabelElement = (
  elements: PrintElement[],
): PrintElement | null =>
  elements.find((e) => e.type === ElementType.MULTI_LABEL) || null;

/** Center-point hit test: is the element considered part of label #1? */
export const isElementInRegion = (
  element: PrintElement,
  region: LabelRegion,
): boolean => {
  const cx = (element.x || 0) + (element.width || 0) / 2;
  const cy = (element.y || 0) + (element.height || 0) / 2;
  return (
    cx >= region.x &&
    cx <= region.x + region.width &&
    cy >= region.y &&
    cy <= region.y + region.height
  );
};

/**
 * Split a page's elements into:
 * - labelElements: inside label #1, used as the per-label template
 * - decorElements: outside the label region, treated as page decorations
 */
export const classifyLabelElements = (
  elements: PrintElement[],
  ml: MultiLabelSettings,
): { labelElements: PrintElement[]; decorElements: PrintElement[] } => {
  const region = getLabelRegion(ml);
  const labelElements: PrintElement[] = [];
  const decorElements: PrintElement[] = [];
  elements.forEach((el) => {
    // The container element itself is neither a per-label template nor a page
    // decoration — it is a design-time guide and is dropped from output.
    if (el.type === ElementType.MULTI_LABEL) return;
    if (isElementInRegion(el, region)) {
      labelElements.push(el);
    } else {
      decorElements.push(el);
    }
  });
  return { labelElements, decorElements };
};

/** Resolve the grid position (and offset relative to label #1) of a cell. */
export const getCellPosition = (
  cellIndex: number,
  ml: MultiLabelSettings,
): CellPosition => {
  const rows = Math.max(1, Math.round(ml.rows || 1));
  const cols = Math.max(1, Math.round(ml.cols || 1));
  const labelWidth = Math.max(1, ml.labelWidth || 1);
  const labelHeight = Math.max(1, ml.labelHeight || 1);
  const gapX = Math.max(0, ml.gapX || 0);
  const gapY = Math.max(0, ml.gapY || 0);

  let row: number;
  let col: number;
  if (ml.direction === "column") {
    col = Math.floor(cellIndex / rows);
    row = cellIndex % rows;
  } else {
    row = Math.floor(cellIndex / cols);
    col = cellIndex % cols;
  }

  const x = (ml.marginLeft || 0) + col * (labelWidth + gapX);
  const y = (ml.marginTop || 0) + row * (labelHeight + gapY);

  return {
    index: cellIndex,
    row,
    col,
    x,
    y,
    offsetX: x - (ml.marginLeft || 0),
    offsetY: y - (ml.marginTop || 0),
  };
};

/** All cell positions for one page (rows * cols). */
export const getPageCellPositions = (
  ml: MultiLabelSettings,
): CellPosition[] => {
  const perPage = getMultiLabelPerPage(ml);
  const cells: CellPosition[] = [];
  for (let i = 0; i < perPage; i += 1) {
    cells.push(getCellPosition(i, ml));
  }
  return cells;
};

/**
 * Bake a data-row value into an element's content and clear its variable so the
 * downstream renderer shows the literal value instead of trying to resolve the
 * (now array-scoped) variable key against testData/variables.
 */
export const bakeLabelVariable = (
  element: PrintElement,
  row: Record<string, any>,
): void => {
  const rawVar = element.variable || "";
  const key = normalizeVariableKey(rawVar);
  if (!key) return;
  if (!Object.prototype.hasOwnProperty.call(row, key)) return;

  const value = row[key];
  const stringValue =
    value === undefined || value === null ? "" : String(value);

  if (element.type === ElementType.TEXT) {
    const token = rawVar.trim().startsWith("@") ? rawVar.trim() : `@${key}`;
    const content = element.content ?? "";
    element.content = content.includes(token)
      ? content.split(token).join(stringValue)
      : stringValue;
  } else {
    // barcode / qrcode / image: value is the raw content.
    element.content = stringValue;
  }

  element.variable = "";
};

/** Synthesize a background/border rectangle element for a label cell. */
export const createLabelBackgroundElement = (
  cellX: number,
  cellY: number,
  ml: MultiLabelSettings,
): PrintElement | null => {
  const hasBackground =
    !!ml.backgroundColor &&
    ml.backgroundColor !== "transparent" &&
    ml.backgroundColor !== "none";
  const hasBorder = ml.borderStyle !== "none" && (ml.borderWidth || 0) > 0;
  if (!hasBackground && !hasBorder) return null;

  return {
    id: uuidv4(),
    type: ElementType.RECT,
    x: cellX,
    y: cellY,
    width: Math.max(1, ml.labelWidth || 1),
    height: Math.max(1, ml.labelHeight || 1),
    printable: true,
    style: {
      zIndex: 0,
      backgroundColor: hasBackground ? ml.backgroundColor : "transparent",
      borderStyle: hasBorder ? ml.borderStyle : "none",
      borderWidth: hasBorder ? ml.borderWidth : 0,
      borderColor: ml.borderColor || "#000000",
      borderRadius: 0,
    },
  } as PrintElement;
};

/**
 * Expand the design (page 0 label template) into a full multi-label grid across
 * as many pages as the data array needs. When no data is bound, a single page is
 * filled with the template design (rows * cols copies) so the layout is visible.
 */
export const expandMultiLabelPages = (params: {
  pages: Page[];
  multiLabel: MultiLabelSettings;
  dataArray?: any[] | null;
  pageHeight?: number;
}): Page[] => {
  const { pages, multiLabel: ml } = params;
  if (!pages || pages.length === 0) return cloneDeep(pages || []);

  const basePage = pages[0];
  const { labelElements, decorElements } = classifyLabelElements(
    basePage.elements || [],
    ml,
  );

  // Force pagination when the full grid doesn't fit the page height: each page
  // only holds the rows that fully fit (a partially-overflowing row is pushed to
  // the next page). Without a page height the full designed grid stays as one page.
  const rowsPerPage = params.pageHeight
    ? getMultiLabelRowsPerPage(ml, params.pageHeight)
    : Math.max(1, Math.round(ml.rows || 1));
  const mlPage: MultiLabelSettings = { ...ml, rows: rowsPerPage };

  const perPage = getMultiLabelPerPage(mlPage);
  const designedTotal = getMultiLabelPerPage(ml);
  const hasData =
    Array.isArray(params.dataArray) && params.dataArray.length > 0;
  const dataArray = hasData ? (params.dataArray as any[]) : null;
  // With data: one label per data row. Without data: render the full designed
  // grid (rows * cols) anyway, paginated to fit.
  const count = hasData ? (dataArray as any[]).length : designedTotal;
  const pagesNeeded = Math.max(1, Math.ceil(count / perPage));

  const resultPages: Page[] = [];

  for (let p = 0; p < pagesNeeded; p += 1) {
    const pageElements: PrintElement[] = [];

    // Page decorations repeat on every generated page.
    decorElements.forEach((el) => {
      const cloned = cloneDeep(el);
      cloned.id = uuidv4();
      pageElements.push(cloned);
    });

    for (let cell = 0; cell < perPage; cell += 1) {
      const globalIndex = p * perPage + cell;
      if (globalIndex >= count) break;

      const pos = getCellPosition(cell, mlPage);

      const background = createLabelBackgroundElement(pos.x, pos.y, mlPage);
      if (background) pageElements.push(background);

      const row =
        hasData && (dataArray as any[])[globalIndex] &&
        typeof (dataArray as any[])[globalIndex] === "object"
          ? ((dataArray as any[])[globalIndex] as Record<string, any>)
          : null;

      labelElements.forEach((el) => {
        const cloned = cloneDeep(el);
        cloned.id = uuidv4();
        cloned.x = (el.x || 0) + pos.offsetX;
        cloned.y = (el.y || 0) + pos.offsetY;
        if (row) bakeLabelVariable(cloned, row);
        pageElements.push(cloned);
      });
    }

    resultPages.push({ id: uuidv4(), elements: pageElements });
  }

  return resultPages;
};

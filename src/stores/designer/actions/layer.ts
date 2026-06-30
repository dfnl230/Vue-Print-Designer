// @ts-nocheck
import { defineStore } from "pinia";
import { uuidv4 } from "@/utils/uuid";
import cloneDeep from "lodash/cloneDeep";
import {
  type DesignerState,
  type PrintElement,
  type TableColumn,
  type Page,
  type Guide,
  ElementType,
  type CustomElementTemplate,
  type WatermarkSettings,
  type CustomElementEditSnapshot,
  type BrandingSettings,
  type DesignerFontOption,
  type ListContextMenuConfig,
  type ListContextMenuItem,
  type TemplateModalFormConfig,
  type TemplateModalField,
} from "@/types";
import {
  getCrudConfig,
  buildEndpoint,
  buildFetchOptions,
} from "../../../utils/crudConfig";
import { toast } from "../../../utils/toast";
import {
  canCopyEntity,
  canDeleteEntity,
  canEditEntity,
  normalizeEntityConstraints,
  applyModalExtraValues,
  mergeExt,
} from "../../../utils/entityConstraints";
import { useTemplateStore } from "../../templates";
import { normalizeVariableKey } from "../../../utils/variables";
import i18n from "../../../locales";
import { defaultWatermark, defaultBranding, HISTORY_ACTION, hasOwn, inferElementUpdateHistoryAction, loadWatermark, loadDeveloperMode, loadPaginationDebugLogs, loadRenderDebugLogs, loadTextQuickToolbarEnabled, loadStatusBarVisible, getElementZIndex, getLayerSortedElements, buildLayerAssignments, canLayerMoveInPage, normalizeContextMenuConfig, normalizeTemplateModalFields, normalizeTemplateModalFormConfig, inferVariableFromContent, normalizeDesignerFontOptions, getEffectiveTableColumns, getNumericCellStyleHeight, getTableRowExplicitHeight, isHeaderFooterLineStyle, normalizeHeaderFooterLineStyle, normalizeHeaderFooterLineColor, normalizeHeaderFooterLineWidth, normalizeHeaderFooterLineSpanMode, normalizeHeaderFooterLineSpan, normalizeHeaderFooterLineRenderingEnabled, escapeAttributeSelectorValue, getCellBorderInsetRect, querySelectorAcrossDocumentAndShadowRoots } from '../helpers';
import type { LayerMoveMode, HeaderFooterLineStyle, HeaderFooterLineSpanMode, EmbeddedCellBounds, EffectiveTableRows } from '../helpers';

export const layerActions = {
  bringElementsToFront(ids: string[]) {
      if (!ids || ids.length === 0) return;
      const idSet = new Set(ids);
      const selectedTableIds = new Set<string>();
      for (const page of this.pages) {
        const selectedInPage = page.elements.filter(
          (el) =>
            idSet.has(el.id) &&
            !el.locked &&
            // The multi-label container must stay behind its label content.
            el.type !== ElementType.MULTI_LABEL,
        );

        selectedInPage.forEach((el) => {
          if (el.type === ElementType.TABLE) {
            selectedTableIds.add(el.id);
          }
        });

        if (selectedInPage.length === 0) continue;
        let maxNonSelected = 0;
        for (const el of page.elements) {
          if (idSet.has(el.id) && !el.locked) continue;
          maxNonSelected = Math.max(maxNonSelected, el.style.zIndex || 1);
        }
        const needsRaise = selectedInPage.some(
          (el) => (el.style.zIndex || 1) <= maxNonSelected,
        );
        if (!needsRaise) continue;
        let nextZ = maxNonSelected + 1;
        const orderedIds = ids.filter((id) =>
          selectedInPage.some((el) => el.id === id),
        );
        for (const id of orderedIds) {
          const index = page.elements.findIndex((el) => el.id === id);
          if (index === -1) continue;
          const el = page.elements[index];
          page.elements[index] = {
            ...el,
            style: { ...el.style, zIndex: nextZ },
          };
          nextZ += 1;
        }
      }

      this.ensureEmbeddedElementsAboveTables(selectedTableIds);
    },

  moveElementsLayer(ids: string[], mode: LayerMoveMode) {
      if (!this.isTemplateEditable) return;
      if (!ids || ids.length === 0) return;

      const idSet = new Set(ids);
      const unlockedIds = new Set<string>();
      const selectedTableIds = new Set<string>();
      for (const page of this.pages) {
        for (const el of page.elements) {
          if (idSet.has(el.id) && !el.locked) {
            unlockedIds.add(el.id);
            if (el.type === ElementType.TABLE) {
              selectedTableIds.add(el.id);
            }
          }
        }
      }
      if (unlockedIds.size === 0) return;

      const pageAssignments: Array<{
        pageIndex: number;
        assignments: Map<string, number>;
      }> = [];
      for (let pageIndex = 0; pageIndex < this.pages.length; pageIndex += 1) {
        if (!canLayerMoveInPage(this.pages[pageIndex], unlockedIds, mode)) {
          continue;
        }

        const assignments = buildLayerAssignments(
          this.pages[pageIndex],
          unlockedIds,
          mode,
        );
        if (assignments && assignments.size > 0) {
          pageAssignments.push({ pageIndex, assignments });
        }
      }

      if (pageAssignments.length === 0) return;

      this.snapshot(HISTORY_ACTION.ELEMENT_LAYER);
      for (const { pageIndex, assignments } of pageAssignments) {
        const page = this.pages[pageIndex];
        for (let i = 0; i < page.elements.length; i += 1) {
          const el = page.elements[i];
          if (el.locked) continue;
          const targetZ = assignments.get(el.id);
          if (!targetZ || getElementZIndex(el) === targetZ) continue;
          page.elements[i] = {
            ...el,
            style: {
              ...el.style,
              zIndex: targetZ,
            },
          };
        }
      }

      this.ensureEmbeddedElementsAboveTables(selectedTableIds);
    },

  reorderElementsLayer(sourceId: string, targetId: string, position: "before" | "after") {
      if (!this.isTemplateEditable) return;
      if (sourceId === targetId) return;

      for (let pageIndex = 0; pageIndex < this.pages.length; pageIndex += 1) {
        const page = this.pages[pageIndex];
        const sourceIndex = page.elements.findIndex(e => e.id === sourceId);
        const targetIndex = page.elements.findIndex(e => e.id === targetId);

        if (sourceIndex === -1 || targetIndex === -1) continue;
        if (page.elements[sourceIndex].locked) continue; // Cannot reorder locked items freely

        const ordered = getLayerSortedElements(page);
        
        const sourceOrderedIndex = ordered.findIndex(item => item.element.id === sourceId);
        if (sourceOrderedIndex === -1) continue;
        const sourceItem = ordered[sourceOrderedIndex];
        ordered.splice(sourceOrderedIndex, 1);

        const newTargetOrderedIndex = ordered.findIndex(item => item.element.id === targetId);
        if (newTargetOrderedIndex === -1) continue;

        // Position mapping: 
        // Component structure panel is sorted Z-Descending (Top to Bottom visually)
        // `ordered` array is Z-Ascending (Bottom to Top visually)
        // If Structure Panel position is "before" (place ABOVE visually): we insert AFTER in Z-Ascending array
        // If Structure Panel position is "after" (place BELOW visually): we insert BEFORE in Z-Ascending array
        let insertIndex = newTargetOrderedIndex;
        if (position === "before") {
          // Put *after* the target in the ascending array (higher Z)
          insertIndex = newTargetOrderedIndex + 1;
        }

        ordered.splice(insertIndex, 0, sourceItem);

        this.snapshot(HISTORY_ACTION.ELEMENT_LAYER);

        ordered.forEach((item, idx) => {
          const targetZ = idx + 1;
          const elIndex = page.elements.findIndex(e => e.id === item.element.id);
          if (elIndex !== -1) {
            const el = page.elements[elIndex];
            if (getElementZIndex(el) !== targetZ) {
               page.elements[elIndex] = {
                 ...el,
                 style: { ...(el.style || {}), zIndex: targetZ }
               };
            }
          }
        });
      }
    },

  canMoveElementsLayer(ids: string[], mode: LayerMoveMode) {
      if (!this.isTemplateEditable) return false;
      if (!ids || ids.length === 0) return false;

      const idSet = new Set(ids);
      const unlockedIds = new Set<string>();
      for (const page of this.pages) {
        for (const el of page.elements) {
          if (idSet.has(el.id) && !el.locked) {
            unlockedIds.add(el.id);
          }
        }
      }

      if (unlockedIds.size === 0) return false;

      for (let pageIndex = 0; pageIndex < this.pages.length; pageIndex += 1) {
        if (canLayerMoveInPage(this.pages[pageIndex], unlockedIds, mode)) {
          return true;
        }
      }

      return false;
    },

  sendElementsToBack(ids: string[]) {
      this.moveElementsLayer(ids, "back");
    },

  moveElementsBackward(ids: string[]) {
      this.moveElementsLayer(ids, "backward");
    }
};

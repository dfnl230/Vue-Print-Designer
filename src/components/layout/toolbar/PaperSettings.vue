<script setup lang="ts">
import {
  ref,
  watch,
  computed,
  inject,
  nextTick,
  onMounted,
  onUnmounted,
} from "vue";
import { useI18n } from "@/locales";
import { useDesignerStore } from "@/stores/designer";
import { PAPER_SIZES, type PaperSizeKey } from "@/constants/paper";
import { pxToUnit, unitToPx, type Unit } from "@/utils/units";
import Settings from "~icons/material-symbols/settings";
import ChevronDown from "~icons/material-symbols/expand-more";
import Plus from "~icons/material-symbols/add";
import X from "~icons/material-symbols/close";
import ColorPicker from "@/components/common/ColorPicker.vue";

const { t } = useI18n();
const store = useDesignerStore();
const modalContainer = inject("modal-container", ref<HTMLElement | null>(null));

const selectedPaper = ref<PaperSizeKey>("A4");
const customWidth = ref(PAPER_SIZES.A4.width);
const customHeight = ref(PAPER_SIZES.A4.height);
const showPaperSettings = ref(false);
const showAdvancedSettings = ref(false);
const showHeaderFooterLineSettings = ref(false);
const useUnifiedHeaderFooterLineSettings = ref(true);
const paperSettingsTriggerRef = ref<HTMLElement | null>(null);
const paperSettingsMenuStyle = ref<Record<string, string>>({});
const isPageSettingsReadOnly = computed(() => !store.isTemplateEditable);

type HeaderFooterLineStyle = "solid" | "dashed" | "dotted";
type HeaderFooterLineSpanMode = "value" | "percent";

const normalizeHeaderFooterLineStyle = (
  value: unknown,
): HeaderFooterLineStyle => {
  return value === "solid" || value === "dotted" ? value : "dashed";
};

const normalizeHeaderFooterLineWidth = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.round(numeric));
};

const normalizeHeaderFooterLineSpanMode = (
  value: unknown,
): HeaderFooterLineSpanMode => {
  return value === "percent" ? "percent" : "value";
};

const normalizeHeaderFooterLineSpan = (
  value: unknown,
  mode: HeaderFooterLineSpanMode,
) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return mode === "percent" ? 100 : 100;
  if (mode === "percent") {
    return Math.min(100, Math.max(1, Number(numeric.toFixed(2))));
  }
  return Math.max(1, Math.round(numeric));
};

const lineStyleOptions = computed(() => [
  { label: t("properties.option.solid"), value: "solid" as const },
  { label: t("properties.option.dashed"), value: "dashed" as const },
  { label: t("properties.option.dotted"), value: "dotted" as const },
]);

const lineSpanModeOptions = computed(() => [
  {
    label: t("editor.headerFooterLineSpanModeValue"),
    value: "value" as const,
  },
  {
    label: t("editor.headerFooterLineSpanModePercent"),
    value: "percent" as const,
  },
]);

const getPrintableLineAreaWidth = () => {
  const spacingX = store.pageSpacingX || 0;
  return Math.max(1, store.canvasSize.width - spacingX * 2);
};

const areHeaderFooterLineSettingsUnified = () => {
  const headerSpanMode = normalizeHeaderFooterLineSpanMode(
    store.headerLineSpanMode,
  );
  const footerSpanMode = normalizeHeaderFooterLineSpanMode(
    store.footerLineSpanMode,
  );
  return (
    normalizeHeaderFooterLineStyle(store.headerLineStyle) ===
      normalizeHeaderFooterLineStyle(store.footerLineStyle) &&
    (store.headerLineColor || "#f87171") ===
      (store.footerLineColor || "#f87171") &&
    normalizeHeaderFooterLineWidth(store.headerLineWidth) ===
      normalizeHeaderFooterLineWidth(store.footerLineWidth) &&
    headerSpanMode === footerSpanMode &&
    normalizeHeaderFooterLineSpan(store.headerLineSpan, headerSpanMode) ===
      normalizeHeaderFooterLineSpan(store.footerLineSpan, footerSpanMode)
  );
};

const syncFooterLineSettingsWithHeader = () => {
  const headerSpanMode = normalizeHeaderFooterLineSpanMode(
    store.headerLineSpanMode,
  );
  store.setFooterLineStyle(
    normalizeHeaderFooterLineStyle(store.headerLineStyle),
  );
  store.setFooterLineColor(store.headerLineColor || "#f87171");
  store.setFooterLineWidth(
    normalizeHeaderFooterLineWidth(store.headerLineWidth),
  );
  store.setFooterLineSpanMode(headerSpanMode);
  store.setFooterLineSpan(
    normalizeHeaderFooterLineSpan(store.headerLineSpan, headerSpanMode),
  );
};

const applyHeaderLineStyle = (style: HeaderFooterLineStyle) => {
  if (!store.enableHeaderFooterLineRendering) return;
  store.setHeaderLineStyle(style);
  if (useUnifiedHeaderFooterLineSettings.value) {
    store.setFooterLineStyle(style);
  }
};

const applyFooterLineStyle = (style: HeaderFooterLineStyle) => {
  if (!store.enableHeaderFooterLineRendering) return;
  store.setFooterLineStyle(style);
};

const applyHeaderLineColor = (color?: string) => {
  if (!store.enableHeaderFooterLineRendering) return;
  const nextColor = color || "#f87171";
  store.setHeaderLineColor(nextColor);
  if (useUnifiedHeaderFooterLineSettings.value) {
    store.setFooterLineColor(nextColor);
  }
};

const applyFooterLineColor = (color?: string) => {
  if (!store.enableHeaderFooterLineRendering) return;
  store.setFooterLineColor(color || "#f87171");
};

const applyHeaderLineWidth = (width: number) => {
  if (!store.enableHeaderFooterLineRendering) return;
  const normalized = normalizeHeaderFooterLineWidth(width);
  store.setHeaderLineWidth(normalized);
  if (useUnifiedHeaderFooterLineSettings.value) {
    store.setFooterLineWidth(normalized);
  }
};

const applyFooterLineWidth = (width: number) => {
  if (!store.enableHeaderFooterLineRendering) return;
  store.setFooterLineWidth(normalizeHeaderFooterLineWidth(width));
};

const applyHeaderLineSpanMode = (mode: HeaderFooterLineSpanMode) => {
  if (!store.enableHeaderFooterLineRendering) return;
  const nextMode = normalizeHeaderFooterLineSpanMode(mode);
  const printableWidth = getPrintableLineAreaWidth();
  const currentMode = normalizeHeaderFooterLineSpanMode(
    store.headerLineSpanMode,
  );
  const currentSpan = normalizeHeaderFooterLineSpan(
    store.headerLineSpan,
    currentMode,
  );
  const spanPx =
    currentMode === "percent"
      ? (printableWidth * currentSpan) / 100
      : currentSpan;
  const converted =
    nextMode === "percent" ? (spanPx / printableWidth) * 100 : spanPx;
  const nextSpan = normalizeHeaderFooterLineSpan(converted, nextMode);

  store.setHeaderLineSpanMode(nextMode);
  store.setHeaderLineSpan(nextSpan);

  if (useUnifiedHeaderFooterLineSettings.value) {
    store.setFooterLineSpanMode(nextMode);
    store.setFooterLineSpan(nextSpan);
  }
};

const applyFooterLineSpanMode = (mode: HeaderFooterLineSpanMode) => {
  if (!store.enableHeaderFooterLineRendering) return;
  const nextMode = normalizeHeaderFooterLineSpanMode(mode);
  const printableWidth = getPrintableLineAreaWidth();
  const currentMode = normalizeHeaderFooterLineSpanMode(
    store.footerLineSpanMode,
  );
  const currentSpan = normalizeHeaderFooterLineSpan(
    store.footerLineSpan,
    currentMode,
  );
  const spanPx =
    currentMode === "percent"
      ? (printableWidth * currentSpan) / 100
      : currentSpan;
  const converted =
    nextMode === "percent" ? (spanPx / printableWidth) * 100 : spanPx;

  store.setFooterLineSpanMode(nextMode);
  store.setFooterLineSpan(normalizeHeaderFooterLineSpan(converted, nextMode));
};

const applyHeaderLineSpanValue = (value: number) => {
  if (!store.enableHeaderFooterLineRendering) return;
  const mode = normalizeHeaderFooterLineSpanMode(store.headerLineSpanMode);
  const nextRaw =
    mode === "percent"
      ? Number(value)
      : unitToPx(Number(value), store.unit as Unit);
  const nextSpan = normalizeHeaderFooterLineSpan(nextRaw, mode);
  store.setHeaderLineSpan(nextSpan);
  if (useUnifiedHeaderFooterLineSettings.value) {
    store.setFooterLineSpanMode(mode);
    store.setFooterLineSpan(nextSpan);
  }
};

const applyFooterLineSpanValue = (value: number) => {
  if (!store.enableHeaderFooterLineRendering) return;
  const mode = normalizeHeaderFooterLineSpanMode(store.footerLineSpanMode);
  const nextRaw =
    mode === "percent"
      ? Number(value)
      : unitToPx(Number(value), store.unit as Unit);
  store.setFooterLineSpan(normalizeHeaderFooterLineSpan(nextRaw, mode));
};

const getHeaderLineSpanInputValue = () => {
  const mode = normalizeHeaderFooterLineSpanMode(store.headerLineSpanMode);
  const span = normalizeHeaderFooterLineSpan(store.headerLineSpan, mode);
  if (mode === "percent") return span;
  return formatUnitValue(span);
};

const getFooterLineSpanInputValue = () => {
  const mode = normalizeHeaderFooterLineSpanMode(store.footerLineSpanMode);
  const span = normalizeHeaderFooterLineSpan(store.footerLineSpan, mode);
  if (mode === "percent") return span;
  return formatUnitValue(span);
};

const getLineWidthInputValue = (type: "header" | "footer") => {
  const width =
    type === "header"
      ? normalizeHeaderFooterLineWidth(store.headerLineWidth)
      : normalizeHeaderFooterLineWidth(store.footerLineWidth);
  return formatUnitValue(width);
};

const toggleUnifiedHeaderFooterLineSettings = () => {
  if (!store.enableHeaderFooterLineRendering) return;
  useUnifiedHeaderFooterLineSettings.value =
    !useUnifiedHeaderFooterLineSettings.value;
  if (useUnifiedHeaderFooterLineSettings.value) {
    syncFooterLineSettingsWithHeader();
  }
};

const toggleHeaderFooterLineRendering = () => {
  if (isPageSettingsReadOnly.value) return;
  store.setEnableHeaderFooterLineRendering(
    !store.enableHeaderFooterLineRendering,
  );
};

const updatePaperSettingsMenuPosition = () => {
  if (!showPaperSettings.value) return;
  const trigger = paperSettingsTriggerRef.value;
  if (!trigger) return;

  const rect = trigger.getBoundingClientRect();
  const menuWidth = 256;
  const viewportPadding = 8;
  const left = Math.min(
    Math.max(rect.left, viewportPadding),
    window.innerWidth - menuWidth - viewportPadding,
  );
  const top = Math.max(rect.bottom + 8, viewportPadding);

  paperSettingsMenuStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
  };
};

const canvasBackground = computed({
  get: () => store.canvasBackground,
  set: (val) => store.setCanvasBackground(val),
});

const watermarkText = computed({
  get: () => store.watermark?.text || "",
  set: (val) => store.setWatermark({ text: val }),
});

const watermarkEnabled = computed({
  get: () => store.watermark?.enabled ?? false,
  set: (val) => store.setWatermark({ enabled: Boolean(val) }),
});

const watermarkAngle = computed({
  get: () => store.watermark?.angle ?? -30,
  set: (val) => store.setWatermark({ angle: Number(val) }),
});

const watermarkColor = computed({
  get: () => store.watermark?.color || "#000000",
  set: (val) => store.setWatermark({ color: val }),
});

const watermarkOpacity = computed({
  get: () => Math.round(((store.watermark?.opacity ?? 0.1) * 100) as number),
  set: (val) => {
    const next = Math.max(0, Math.min(100, Number(val)));
    store.setWatermark({ opacity: next / 100 });
  },
});

const watermarkSize = computed({
  get: () => formatUnitValue(store.watermark?.size ?? 24),
  set: (val) =>
    store.setWatermark({ size: unitToPx(Number(val), store.unit as Unit) }),
});

const watermarkDensity = computed({
  get: () => formatUnitValue(store.watermark?.density ?? 160),
  set: (val) =>
    store.setWatermark({ density: unitToPx(Number(val), store.unit as Unit) }),
});

const pageSpacingX = computed({
  get: () => formatUnitValue(store.pageSpacingX || 0),
  set: (val) =>
    store.setPageSpacingX(unitToPx(Number(val), store.unit as Unit)),
});

const pageSpacingY = computed({
  get: () => formatUnitValue(store.pageSpacingY || 0),
  set: (val) =>
    store.setPageSpacingY(unitToPx(Number(val), store.unit as Unit)),
});

const unitLabel = computed(() => {
  if (store.unit === "px") return t("common.px");
  if (store.unit === "pt") return t("common.pt");
  if (store.unit === "in") return t("common.in");
  if (store.unit === "cm") return t("common.cm");
  return t("common.mm");
});

const formatUnitValue = (px: number) => {
  const value = pxToUnit(px, store.unit as Unit);
  return store.unit === "px" ? Math.round(value) : Number(value.toFixed(1));
};

const handlePaperChange = () => {
  if (isPageSettingsReadOnly.value) return;
  if (selectedPaper.value !== "CUSTOM") {
    const size = PAPER_SIZES[selectedPaper.value];
    customWidth.value = size.width;
    customHeight.value = size.height;
    store.setCanvasSize(size.width, size.height);
  }
};

const applyCustomSize = () => {
  if (isPageSettingsReadOnly.value) return;
  store.setCanvasSize(customWidth.value, customHeight.value);
  if (
    !Object.values(PAPER_SIZES).some(
      (s) => s.width === customWidth.value && s.height === customHeight.value,
    )
  ) {
    selectedPaper.value = "CUSTOM";
  }
};

const togglePaperSettings = () => {
  if (isPageSettingsReadOnly.value) return;
  showPaperSettings.value = !showPaperSettings.value;
};

const openAdvancedSettings = () => {
  if (isPageSettingsReadOnly.value) return;
  showAdvancedSettings.value = true;
};

const openHeaderFooterLineSettings = () => {
  if (isPageSettingsReadOnly.value) return;
  useUnifiedHeaderFooterLineSettings.value =
    areHeaderFooterLineSettingsUnified();
  showHeaderFooterLineSettings.value = true;
};

// Sync local state with store
watch(
  () => store.canvasSize,
  (newSize) => {
    customWidth.value = newSize.width;
    customHeight.value = newSize.height;

    // Find matching paper size
    const match = Object.entries(PAPER_SIZES).find(
      ([_, size]) =>
        size.width === newSize.width && size.height === newSize.height,
    );

    if (match) {
      selectedPaper.value = match[0] as PaperSizeKey;
    } else {
      selectedPaper.value = "CUSTOM";
    }
  },
  { immediate: true },
);

watch(showAdvancedSettings, (val) => {
  store.setDisableGlobalShortcuts(val);
});

watch(showHeaderFooterLineSettings, (val) => {
  store.setDisableGlobalShortcuts(val);
});

watch(showPaperSettings, (val) => {
  if (!val) {
    showHeaderFooterLineSettings.value = false;
    return;
  }
  useUnifiedHeaderFooterLineSettings.value =
    areHeaderFooterLineSettingsUnified();
  nextTick(() => {
    updatePaperSettingsMenuPosition();
  });
});

watch(isPageSettingsReadOnly, (readOnly) => {
  if (readOnly) {
    showPaperSettings.value = false;
    showAdvancedSettings.value = false;
    showHeaderFooterLineSettings.value = false;
  }
});

onMounted(() => {
  window.addEventListener("resize", updatePaperSettingsMenuPosition);
  window.addEventListener("scroll", updatePaperSettingsMenuPosition, true);
});

onUnmounted(() => {
  window.removeEventListener("resize", updatePaperSettingsMenuPosition);
  window.removeEventListener("scroll", updatePaperSettingsMenuPosition, true);
});
</script>

<template>
  <div class="relative" ref="paperSettingsTriggerRef">
    <button
      type="button"
      @click="togglePaperSettings"
      :disabled="isPageSettingsReadOnly"
      class="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      :title="t('editor.paperSettings')"
    >
      <Settings class="w-4 h-4" />
      <span class="text-xs w-20 text-center px-2 py-0.5 truncate">
        {{ selectedPaper === "CUSTOM" ? t("editor.custom") : selectedPaper }}
      </span>
      <ChevronDown class="w-4 h-4" />
    </button>

    <Teleport :to="modalContainer || 'body'">
      <div
        v-if="showPaperSettings"
        class="fixed inset-0 z-[1999] pointer-events-auto"
        @click="showPaperSettings = false"
      ></div>

      <div
        v-if="showPaperSettings"
        class="fixed w-64 max-h-[calc(100vh-56px)] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl z-[2000] pointer-events-auto flex flex-col overflow-hidden"
        :style="paperSettingsMenuStyle"
        @click.stop
      >
        <div class="px-4 pt-4 pb-3 shrink-0">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {{ t("editor.paperSettings") }}
          </h3>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-3">
          <div>
            <label
              class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
              >{{ t("editor.sizePreset") }}</label
            >
            <select
              v-model="selectedPaper"
              @change="handlePaperChange"
              class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
            >
              <option
                v-for="(size, key) in PAPER_SIZES"
                :key="key"
                :value="key"
                class="dark:bg-gray-800 dark:text-gray-200"
              >
                {{ key }} ({{ formatUnitValue(size.width) }}{{ unitLabel }} x
                {{ formatUnitValue(size.height) }}{{ unitLabel }})
              </option>
              <option
                value="CUSTOM"
                class="dark:bg-gray-800 dark:text-gray-200"
              >
                {{ t("editor.custom") }}
              </option>
            </select>
          </div>

          <div>
            <label
              class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
              >{{ t("editor.unit") }}</label
            >
            <select
              :value="store.unit"
              @change="
                (e) =>
                  store.setUnit((e.target as HTMLSelectElement).value as Unit)
              "
              class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
            >
              <option value="mm" class="dark:bg-gray-800 dark:text-gray-200">
                {{ t("common.mm") }}
              </option>
              <option value="cm" class="dark:bg-gray-800 dark:text-gray-200">
                {{ t("common.cm") }}
              </option>
              <option value="in" class="dark:bg-gray-800 dark:text-gray-200">
                {{ t("common.in") }}
              </option>
              <option value="pt" class="dark:bg-gray-800 dark:text-gray-200">
                {{ t("common.pt") }}
              </option>
              <option value="px" class="dark:bg-gray-800 dark:text-gray-200">
                {{ t("common.px") }}
              </option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                >{{ t("common.width") }} ({{ unitLabel }})</label
              >
              <input
                type="number"
                :value="formatUnitValue(customWidth)"
                @change="
                  (e) => {
                    customWidth = unitToPx(
                      Number((e.target as HTMLInputElement).value),
                      store.unit as Unit,
                    );
                    applyCustomSize();
                  }
                "
                class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                >{{ t("common.height") }} ({{ unitLabel }})</label
              >
              <input
                type="number"
                :value="formatUnitValue(customHeight)"
                @change="
                  (e) => {
                    customHeight = unitToPx(
                      Number((e.target as HTMLInputElement).value),
                      store.unit as Unit,
                    );
                    applyCustomSize();
                  }
                "
                class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                >{{ t("editor.spacingX") }} ({{ unitLabel }})</label
              >
              <input
                type="number"
                :value="pageSpacingX"
                @change="
                  (e) => {
                    pageSpacingX = Number((e.target as HTMLInputElement).value);
                  }
                "
                class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                >{{ t("editor.spacingY") }} ({{ unitLabel }})</label
              >
              <input
                type="number"
                :value="pageSpacingY"
                @change="
                  (e) => {
                    pageSpacingY = Number((e.target as HTMLInputElement).value);
                  }
                "
                class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
              />
            </div>
          </div>

        <div class="mt-4 flex items-center justify-between">
          <span class="text-sm text-gray-700 dark:text-gray-200 font-medium">{{
            t("editor.showMarginLines")
          }}</span>
          <button
            @click="store.setShowMarginLines(!store.showMarginLines)"
            class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            :class="
              store.showMarginLines
                ? 'bg-blue-600 dark:bg-blue-500'
                : 'bg-gray-200 dark:bg-gray-700'
            "
          >
            <span class="sr-only">Toggle margin lines</span>
            <span
              aria-hidden="true"
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
              :class="store.showMarginLines ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>

        <div class="mt-3 flex items-center justify-between">
          <span class="text-sm text-gray-700 dark:text-gray-200 font-medium">{{
            t("editor.allowDragOutsideCanvas")
          }}</span>
          <button
            @click="
              store.setAllowDragOutsideCanvas(!store.allowDragOutsideCanvas)
            "
            class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            :class="
              store.allowDragOutsideCanvas
                ? 'bg-blue-600 dark:bg-blue-500'
                : 'bg-gray-200 dark:bg-gray-700'
            "
          >
            <span class="sr-only"
              >Toggle allowing elements to be dragged outside canvas</span
            >
            <span
              aria-hidden="true"
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
              :class="
                store.allowDragOutsideCanvas ? 'translate-x-5' : 'translate-x-0'
              "
            />
          </button>
        </div>

        <div class="mt-3 flex items-center justify-between">
          <span class="text-sm text-gray-700 dark:text-gray-200 font-medium">{{
            t("settings.textQuickToolbar")
          }}</span>
          <button
            @click="store.setShowTextQuickToolbar(!store.showTextQuickToolbar)"
            class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            :class="
              store.showTextQuickToolbar
                ? 'bg-blue-600 dark:bg-blue-500'
                : 'bg-gray-200 dark:bg-gray-700'
            "
          >
            <span class="sr-only">{{ t("settings.textQuickToolbar") }}</span>
            <span
              aria-hidden="true"
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
              :class="
                store.showTextQuickToolbar ? 'translate-x-5' : 'translate-x-0'
              "
            />
          </button>
        </div>

        <div class="mt-3 flex items-center justify-between">
          <span class="text-sm text-gray-700 dark:text-gray-200 font-medium">{{
            t("editor.showCornerMarkers")
          }}</span>
          <button
            @click="store.setShowCornerMarkers(!store.showCornerMarkers)"
            class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            :class="
              store.showCornerMarkers
                ? 'bg-blue-600 dark:bg-blue-500'
                : 'bg-gray-200 dark:bg-gray-700'
            "
          >
            <span class="sr-only">Toggle corner markers</span>
            <span
              aria-hidden="true"
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
              :class="
                store.showCornerMarkers ? 'translate-x-5' : 'translate-x-0'
              "
            />
          </button>
        </div>

        <div class="mt-3 flex items-center justify-between">
          <span class="text-sm text-gray-700 dark:text-gray-200 font-medium">{{
            t("editor.showGrid")
          }}</span>
          <button
            @click="store.setShowGrid(!store.showGrid)"
            class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            :class="
              store.showGrid
                ? 'bg-blue-600 dark:bg-blue-500'
                : 'bg-gray-200 dark:bg-gray-700'
            "
          >
            <span class="sr-only">Toggle grid</span>
            <span
              aria-hidden="true"
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
              :class="store.showGrid ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>

        <div class="mt-3 flex items-center justify-between">
          <span class="text-sm text-gray-700 dark:text-gray-200 font-medium">{{
            t("editor.backgroundColor")
          }}</span>
          <ColorPicker
            v-model="canvasBackground"
            :allow-transparent="true"
            default-color="#ffffff"
            placement="bottom-end"
            :teleport-to-body="true"
          >
            <template #trigger="{ color, open }">
              <div
                class="w-8 h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer relative overflow-hidden hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                :class="{
                  'ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-1 dark:ring-offset-gray-900':
                    open,
                }"
              >
                <div
                  class="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAGUlEQVQYV2M4gwZ+5wNisxL//8n04mEeRAAAhNwX869V4DYAAAAASUVORK5CYII=')] opacity-50"
                ></div>
                <div
                  class="absolute inset-0"
                  :style="{
                    backgroundColor:
                      color === 'transparent' ? 'transparent' : color,
                  }"
                ></div>
                <div
                  v-if="color === 'transparent'"
                  class="absolute inset-0 flex items-center justify-center"
                >
                  <div class="w-full h-[1px] bg-red-500 rotate-45"></div>
                </div>
              </div>
            </template>
          </ColorPicker>
        </div>

        <div class="border-t border-gray-200 dark:border-gray-700 my-4 pt-3">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {{ t("editor.headerFooter") }}
            </h3>
            <button
              type="button"
              :title="t('editor.headerFooterLineAdvancedSettings')"
              @click="openHeaderFooterLineSettings"
              class="inline-flex h-6 w-6 items-center justify-center rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Settings class="h-3.5 w-3.5" />
            </button>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <button
                  @click="store.setShowHeaderLine(!store.showHeaderLine)"
                  class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                  :class="
                    store.showHeaderLine
                      ? 'bg-blue-600 dark:bg-blue-500'
                      : 'bg-gray-200 dark:bg-gray-700'
                  "
                >
                  <span class="sr-only">Toggle header line</span>
                  <span
                    aria-hidden="true"
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
                    :class="
                      store.showHeaderLine ? 'translate-x-4' : 'translate-x-0'
                    "
                  />
                </button>
                <label class="text-xs text-gray-600 dark:text-gray-400">{{
                  t("editor.headerLine")
                }}</label>
              </div>
              <div class="flex items-center gap-1">
                <input
                  type="number"
                  :value="formatUnitValue(store.headerHeight)"
                  @change="
                    (e) =>
                      store.setHeaderHeight(
                        unitToPx(
                          Number((e.target as HTMLInputElement).value),
                          store.unit as Unit,
                        ),
                      )
                  "
                  class="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none text-right"
                  min="0"
                />
                <span class="text-xs text-gray-500 dark:text-gray-400">{{
                  unitLabel
                }}</span>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <button
                  @click="store.setShowFooterLine(!store.showFooterLine)"
                  class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                  :class="
                    store.showFooterLine
                      ? 'bg-blue-600 dark:bg-blue-500'
                      : 'bg-gray-200 dark:bg-gray-700'
                  "
                >
                  <span class="sr-only">Toggle footer line</span>
                  <span
                    aria-hidden="true"
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
                    :class="
                      store.showFooterLine ? 'translate-x-4' : 'translate-x-0'
                    "
                  />
                </button>
                <label class="text-xs text-gray-600 dark:text-gray-400">{{
                  t("editor.footerLine")
                }}</label>
              </div>
              <div class="flex items-center gap-1">
                <input
                  type="number"
                  :value="formatUnitValue(store.footerHeight)"
                  @change="
                    (e) =>
                      store.setFooterHeight(
                        unitToPx(
                          Number((e.target as HTMLInputElement).value),
                          store.unit as Unit,
                        ),
                      )
                  "
                  class="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none text-right"
                  min="0"
                />
                <span class="text-xs text-gray-500 dark:text-gray-400">{{
                  unitLabel
                }}</span>
              </div>
            </div>
          </div>
        </div>

        </div>

        <div class="shrink-0 border-t border-gray-200 dark:border-gray-700">
          <div class="p-3 space-y-2">
            <button
              @click="
                store.addPage();
                showPaperSettings = false;
              "
              :disabled="isPageSettingsReadOnly"
              class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus class="w-4 h-4" />
              <span>{{ t("editor.addNewPage") }}</span>
            </button>
            <button
              @click="openAdvancedSettings"
              :disabled="isPageSettingsReadOnly"
              class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Settings class="w-4 h-4" />
              <span>{{ t("editor.advancedSettings") }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport :to="modalContainer || 'body'">
      <div
        v-if="showHeaderFooterLineSettings"
        class="fixed inset-0 z-[2001] flex items-center justify-center bg-black/50 pointer-events-auto"
        @click.self="showHeaderFooterLineSettings = false"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[560px] max-w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
        >
          <div
            class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0"
          >
            <h3
              class="text-base font-semibold text-gray-800 dark:text-gray-200"
            >
              {{ t("editor.headerFooterLineAdvancedSettings") }}
            </h3>
            <button
              @click="showHeaderFooterLineSettings = false"
              class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500 dark:text-gray-400"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="p-4 overflow-y-auto space-y-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {{ t("editor.enableHeaderFooterLineRendering") }}
                </p>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {{ t("editor.headerFooterLineDisabledHint") }}
                </p>
              </div>
              <button
                @click="toggleHeaderFooterLineRendering"
                class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                :class="
                  store.enableHeaderFooterLineRendering
                    ? 'bg-blue-600 dark:bg-blue-500'
                    : 'bg-gray-300 dark:bg-gray-700'
                "
              >
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
                  :class="
                    store.enableHeaderFooterLineRendering
                      ? 'translate-x-5'
                      : 'translate-x-0'
                  "
                />
              </button>
            </div>

            <div
              class="space-y-4"
              :class="{
                'opacity-50 pointer-events-none':
                  !store.enableHeaderFooterLineRendering,
              }"
            >
              <div class="flex items-center justify-between">
                <span
                  class="text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  {{ t("editor.unifiedHeaderFooterLineSettings") }}
                </span>
                <button
                  @click="toggleUnifiedHeaderFooterLineSettings"
                  :disabled="!store.enableHeaderFooterLineRendering"
                  class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                  :class="
                    useUnifiedHeaderFooterLineSettings
                      ? 'bg-blue-600 dark:bg-blue-500'
                      : 'bg-gray-300 dark:bg-gray-700'
                  "
                >
                  <span
                    aria-hidden="true"
                    class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
                    :class="
                      useUnifiedHeaderFooterLineSettings
                        ? 'translate-x-5'
                        : 'translate-x-0'
                    "
                  />
                </button>
              </div>

              <div v-if="useUnifiedHeaderFooterLineSettings" class="space-y-3">
                <div>
                  <label
                    class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                  >
                    {{ t("editor.headerFooterLineStyleLabel") }}
                  </label>
                  <select
                    :disabled="!store.enableHeaderFooterLineRendering"
                    :value="
                      normalizeHeaderFooterLineStyle(store.headerLineStyle)
                    "
                    @change="
                      (e) =>
                        applyHeaderLineStyle(
                          normalizeHeaderFooterLineStyle(
                            (e.target as HTMLSelectElement).value,
                          ),
                        )
                    "
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                  >
                    <option
                      v-for="option in lineStyleOptions"
                      :key="`unified-${option.value}`"
                      :value="option.value"
                      class="dark:bg-gray-800 dark:text-gray-200"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                    >
                      {{ t("editor.headerFooterLineHorizontalWidthModeLabel") }}
                    </label>
                    <select
                      :disabled="!store.enableHeaderFooterLineRendering"
                      :value="
                        normalizeHeaderFooterLineSpanMode(
                          store.headerLineSpanMode,
                        )
                      "
                      @change="
                        (e) =>
                          applyHeaderLineSpanMode(
                            normalizeHeaderFooterLineSpanMode(
                              (e.target as HTMLSelectElement).value,
                            ),
                          )
                      "
                      class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                    >
                      <option
                        v-for="option in lineSpanModeOptions"
                        :key="`span-mode-unified-${option.value}`"
                        :value="option.value"
                        class="dark:bg-gray-800 dark:text-gray-200"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label
                      class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                    >
                      {{ t("editor.headerFooterLineHorizontalWidthLabel") }}
                    </label>
                    <div class="relative">
                      <input
                        type="number"
                        :min="
                          normalizeHeaderFooterLineSpanMode(
                            store.headerLineSpanMode,
                          ) === 'percent'
                            ? 1
                            : 0
                        "
                        :step="
                          normalizeHeaderFooterLineSpanMode(
                            store.headerLineSpanMode,
                          ) === 'percent'
                            ? 1
                            : store.unit === 'px'
                              ? 1
                              : 0.1
                        "
                        :disabled="!store.enableHeaderFooterLineRendering"
                        :value="getHeaderLineSpanInputValue()"
                        @change="
                          (e) =>
                            applyHeaderLineSpanValue(
                              Number((e.target as HTMLInputElement).value),
                            )
                        "
                        class="w-full px-2 py-1.5 pr-10 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                      />
                      <span
                        class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400"
                      >
                        {{
                          normalizeHeaderFooterLineSpanMode(
                            store.headerLineSpanMode,
                          ) === "percent"
                            ? "%"
                            : unitLabel
                        }}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                  >
                    {{ t("editor.headerFooterLineWidthLabel") }} ({{
                      unitLabel
                    }})
                  </label>
                  <input
                    type="number"
                    min="0"
                    :step="store.unit === 'px' ? 1 : 0.1"
                    :disabled="!store.enableHeaderFooterLineRendering"
                    :value="getLineWidthInputValue('header')"
                    @change="
                      (e) =>
                        applyHeaderLineWidth(
                          unitToPx(
                            Number((e.target as HTMLInputElement).value),
                            store.unit as Unit,
                          ),
                        )
                    "
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label
                    class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                  >
                    {{ t("editor.headerFooterLineColorLabel") }}
                  </label>
                  <ColorPicker
                    :model-value="store.headerLineColor || '#f87171'"
                    @update:model-value="applyHeaderLineColor"
                    default-color="#f87171"
                    placement="bottom-end"
                    :teleport-to-body="true"
                  >
                    <template #trigger="{ color, open }">
                      <div
                        class="w-8 h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer relative overflow-hidden hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                        :class="{
                          'ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-1 dark:ring-offset-gray-900':
                            open,
                        }"
                      >
                        <div
                          class="absolute inset-0"
                          :style="{ backgroundColor: color }"
                        ></div>
                      </div>
                    </template>
                  </ColorPicker>
                </div>
              </div>

              <div v-else class="space-y-5">
                <div class="space-y-3">
                  <h4
                    class="text-sm font-medium text-gray-700 dark:text-gray-200"
                  >
                    {{ t("editor.headerLine") }}
                  </h4>

                  <div>
                    <label
                      class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                    >
                      {{ t("editor.headerFooterLineStyleLabel") }}
                    </label>
                    <select
                      :disabled="!store.enableHeaderFooterLineRendering"
                      :value="
                        normalizeHeaderFooterLineStyle(store.headerLineStyle)
                      "
                      @change="
                        (e) =>
                          applyHeaderLineStyle(
                            normalizeHeaderFooterLineStyle(
                              (e.target as HTMLSelectElement).value,
                            ),
                          )
                      "
                      class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                    >
                      <option
                        v-for="option in lineStyleOptions"
                        :key="`header-${option.value}`"
                        :value="option.value"
                        class="dark:bg-gray-800 dark:text-gray-200"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </div>

                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                      >
                        {{
                          t("editor.headerFooterLineHorizontalWidthModeLabel")
                        }}
                      </label>
                      <select
                        :disabled="!store.enableHeaderFooterLineRendering"
                        :value="
                          normalizeHeaderFooterLineSpanMode(
                            store.headerLineSpanMode,
                          )
                        "
                        @change="
                          (e) =>
                            applyHeaderLineSpanMode(
                              normalizeHeaderFooterLineSpanMode(
                                (e.target as HTMLSelectElement).value,
                              ),
                            )
                        "
                        class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                      >
                        <option
                          v-for="option in lineSpanModeOptions"
                          :key="`span-mode-header-${option.value}`"
                          :value="option.value"
                          class="dark:bg-gray-800 dark:text-gray-200"
                        >
                          {{ option.label }}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label
                        class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                      >
                        {{ t("editor.headerFooterLineHorizontalWidthLabel") }}
                      </label>
                      <div class="relative">
                        <input
                          type="number"
                          :min="
                            normalizeHeaderFooterLineSpanMode(
                              store.headerLineSpanMode,
                            ) === 'percent'
                              ? 1
                              : 0
                          "
                          :step="
                            normalizeHeaderFooterLineSpanMode(
                              store.headerLineSpanMode,
                            ) === 'percent'
                              ? 1
                              : store.unit === 'px'
                                ? 1
                                : 0.1
                          "
                          :disabled="!store.enableHeaderFooterLineRendering"
                          :value="getHeaderLineSpanInputValue()"
                          @change="
                            (e) =>
                              applyHeaderLineSpanValue(
                                Number((e.target as HTMLInputElement).value),
                              )
                          "
                          class="w-full px-2 py-1.5 pr-10 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                        />
                        <span
                          class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400"
                        >
                          {{
                            normalizeHeaderFooterLineSpanMode(
                              store.headerLineSpanMode,
                            ) === "percent"
                              ? "%"
                              : unitLabel
                          }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                    >
                      {{ t("editor.headerFooterLineWidthLabel") }} ({{
                        unitLabel
                      }})
                    </label>
                    <input
                      type="number"
                      min="0"
                      :step="store.unit === 'px' ? 1 : 0.1"
                      :disabled="!store.enableHeaderFooterLineRendering"
                      :value="getLineWidthInputValue('header')"
                      @change="
                        (e) =>
                          applyHeaderLineWidth(
                            unitToPx(
                              Number((e.target as HTMLInputElement).value),
                              store.unit as Unit,
                            ),
                          )
                      "
                      class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label
                      class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                    >
                      {{ t("editor.headerFooterLineColorLabel") }}
                    </label>
                    <ColorPicker
                      :model-value="store.headerLineColor || '#f87171'"
                      @update:model-value="applyHeaderLineColor"
                      default-color="#f87171"
                      placement="bottom-end"
                      :teleport-to-body="true"
                    >
                      <template #trigger="{ color, open }">
                        <div
                          class="w-8 h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer relative overflow-hidden hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                          :class="{
                            'ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-1 dark:ring-offset-gray-900':
                              open,
                          }"
                        >
                          <div
                            class="absolute inset-0"
                            :style="{ backgroundColor: color }"
                          ></div>
                        </div>
                      </template>
                    </ColorPicker>
                  </div>
                </div>

                <div
                  class="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3"
                >
                  <h4
                    class="text-sm font-medium text-gray-700 dark:text-gray-200"
                  >
                    {{ t("editor.footerLine") }}
                  </h4>

                  <div>
                    <label
                      class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                    >
                      {{ t("editor.headerFooterLineStyleLabel") }}
                    </label>
                    <select
                      :disabled="!store.enableHeaderFooterLineRendering"
                      :value="
                        normalizeHeaderFooterLineStyle(store.footerLineStyle)
                      "
                      @change="
                        (e) =>
                          applyFooterLineStyle(
                            normalizeHeaderFooterLineStyle(
                              (e.target as HTMLSelectElement).value,
                            ),
                          )
                      "
                      class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                    >
                      <option
                        v-for="option in lineStyleOptions"
                        :key="`footer-${option.value}`"
                        :value="option.value"
                        class="dark:bg-gray-800 dark:text-gray-200"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </div>

                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                      >
                        {{
                          t("editor.headerFooterLineHorizontalWidthModeLabel")
                        }}
                      </label>
                      <select
                        :disabled="!store.enableHeaderFooterLineRendering"
                        :value="
                          normalizeHeaderFooterLineSpanMode(
                            store.footerLineSpanMode,
                          )
                        "
                        @change="
                          (e) =>
                            applyFooterLineSpanMode(
                              normalizeHeaderFooterLineSpanMode(
                                (e.target as HTMLSelectElement).value,
                              ),
                            )
                        "
                        class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                      >
                        <option
                          v-for="option in lineSpanModeOptions"
                          :key="`span-mode-footer-${option.value}`"
                          :value="option.value"
                          class="dark:bg-gray-800 dark:text-gray-200"
                        >
                          {{ option.label }}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label
                        class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                      >
                        {{ t("editor.headerFooterLineHorizontalWidthLabel") }}
                      </label>
                      <div class="relative">
                        <input
                          type="number"
                          :min="
                            normalizeHeaderFooterLineSpanMode(
                              store.footerLineSpanMode,
                            ) === 'percent'
                              ? 1
                              : 0
                          "
                          :step="
                            normalizeHeaderFooterLineSpanMode(
                              store.footerLineSpanMode,
                            ) === 'percent'
                              ? 1
                              : store.unit === 'px'
                                ? 1
                                : 0.1
                          "
                          :disabled="!store.enableHeaderFooterLineRendering"
                          :value="getFooterLineSpanInputValue()"
                          @change="
                            (e) =>
                              applyFooterLineSpanValue(
                                Number((e.target as HTMLInputElement).value),
                              )
                          "
                          class="w-full px-2 py-1.5 pr-10 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                        />
                        <span
                          class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400"
                        >
                          {{
                            normalizeHeaderFooterLineSpanMode(
                              store.footerLineSpanMode,
                            ) === "percent"
                              ? "%"
                              : unitLabel
                          }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                    >
                      {{ t("editor.headerFooterLineWidthLabel") }} ({{
                        unitLabel
                      }})
                    </label>
                    <input
                      type="number"
                      min="0"
                      :step="store.unit === 'px' ? 1 : 0.1"
                      :disabled="!store.enableHeaderFooterLineRendering"
                      :value="getLineWidthInputValue('footer')"
                      @change="
                        (e) =>
                          applyFooterLineWidth(
                            unitToPx(
                              Number((e.target as HTMLInputElement).value),
                              store.unit as Unit,
                            ),
                          )
                      "
                      class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label
                      class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                    >
                      {{ t("editor.headerFooterLineColorLabel") }}
                    </label>
                    <ColorPicker
                      :model-value="store.footerLineColor || '#f87171'"
                      @update:model-value="applyFooterLineColor"
                      default-color="#f87171"
                      placement="bottom-end"
                      :teleport-to-body="true"
                    >
                      <template #trigger="{ color, open }">
                        <div
                          class="w-8 h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer relative overflow-hidden hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                          :class="{
                            'ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-1 dark:ring-offset-gray-900':
                              open,
                          }"
                        >
                          <div
                            class="absolute inset-0"
                            :style="{ backgroundColor: color }"
                          ></div>
                        </div>
                      </template>
                    </ColorPicker>
                  </div>
                </div>
              </div>
            </div>

            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ t("editor.headerFooterLineAdvancedHint") }}
            </p>
          </div>

          <div
            class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end shrink-0 rounded-b-lg"
          >
            <button
              @click="showHeaderFooterLineSettings = false"
              class="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 border border-red-200 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs transition-colors"
            >
              <X class="w-4 h-4 shrink-0" />
              {{ t("common.close") }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport :to="modalContainer || 'body'">
      <div
        v-if="showAdvancedSettings"
        class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 pointer-events-auto"
        @click.self="showAdvancedSettings = false"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[640px] max-w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
        >
          <div
            class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0"
          >
            <h3
              class="text-base font-semibold text-gray-800 dark:text-gray-200"
            >
              {{ t("editor.advancedSettings") }}
            </h3>
            <button
              @click="showAdvancedSettings = false"
              class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500 dark:text-gray-400"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="p-4 overflow-y-auto space-y-4">
            <div>
              <h3
                class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3"
              >
                {{ t("editor.watermark") }}
              </h3>

              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span
                    class="text-sm text-gray-700 dark:text-gray-200 font-medium"
                    >{{ t("editor.watermarkEnable") }}</span
                  >
                  <button
                    @click="watermarkEnabled = !watermarkEnabled"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                    :class="
                      watermarkEnabled
                        ? 'bg-blue-600 dark:bg-blue-500'
                        : 'bg-gray-200 dark:bg-gray-700'
                    "
                  >
                    <span class="sr-only">Toggle watermark</span>
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
                      :class="
                        watermarkEnabled ? 'translate-x-5' : 'translate-x-0'
                      "
                    />
                  </button>
                </div>

                <div>
                  <label
                    class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                    >{{ t("editor.watermarkText") }}</label
                  >
                  <input
                    v-model="watermarkText"
                    type="text"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                    :placeholder="t('editor.watermarkTextPlaceholder')"
                  />
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                      >{{ t("editor.watermarkAngle") }}</label
                    >
                    <input
                      v-model.number="watermarkAngle"
                      type="number"
                      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label
                      class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                      >{{ t("editor.watermarkOpacity") }}</label
                    >
                    <input
                      v-model.number="watermarkOpacity"
                      type="number"
                      min="0"
                      max="100"
                      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                      >{{ t("editor.watermarkSize") }} ({{ unitLabel }})</label
                    >
                    <input
                      v-model.number="watermarkSize"
                      type="number"
                      min="1"
                      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label
                      class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                      >{{ t("editor.watermarkDensity") }} ({{
                        unitLabel
                      }})</label
                    >
                    <input
                      v-model.number="watermarkDensity"
                      type="number"
                      min="20"
                      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
                    >{{ t("editor.watermarkColor") }}</label
                  >
                  <ColorPicker
                    v-model="watermarkColor"
                    default-color="#000000"
                    placement="bottom-end"
                    :teleport-to-body="true"
                  >
                    <template #trigger="{ color, open }">
                      <div
                        class="w-8 h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer relative overflow-hidden hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                        :class="{
                          'ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-1 dark:ring-offset-gray-900':
                            open,
                        }"
                      >
                        <div
                          class="absolute inset-0"
                          :style="{ backgroundColor: color }"
                        ></div>
                      </div>
                    </template>
                  </ColorPicker>
                </div>
              </div>
            </div>
          </div>

          <div
            class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end shrink-0 rounded-b-lg"
          >
            <button
              @click="showAdvancedSettings = false"
              class="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 border border-red-200 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs transition-colors"
            >
              <X class="w-4 h-4 shrink-0" />
              {{ t("common.close") }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<template>
  <footer
    class="h-6 bg-white border-t border-gray-200 dark:bg-gray-900 dark:border-gray-700 text-xs flex items-center px-3 text-gray-500 dark:text-gray-400 z-30 flex-none select-none relative"
  >
        <!-- 横向全宽进度条（操作时居中悬浮） -->
        <template v-if="printProgress">
          <div
            class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 flex items-center gap-2"
            style="pointer-events: none;"
          >
            <div
              class="w-1/3 md:w-2/5 h-2.5 bg-gray-200/80 rounded-full overflow-hidden shadow-sm"
              style="min-width: 140px; max-width: 340px;"
            >
              <div
                class="h-full bg-blue-500 transition-all duration-200"
                :style="{ width: progressPercent + '%' }"
              />
            </div>
            <span
              class="rounded px-1 text-[10px] font-semibold tabular-nums text-blue-900 dark:bg-gray-950/70 dark:text-white select-none whitespace-nowrap"
              style="letter-spacing: 0.3px;"
            >{{ progressPercent }}%</span>
          </div>
        </template>
    <!-- Left: operation info -->
    <div class="flex-1 flex items-center gap-3 min-w-0 truncate relative z-10">
      <!-- Print/export progress -->
      <template v-if="printProgress">
        <span class="flex items-center gap-2">
          <HourglassEmpty v-if="isSavingProgress" class="w-3.5 h-3.5 text-current" />
          <span
            v-else-if="isPreparingProgress"
            class="inline-block w-3 h-3 rounded-full bg-current animate-pulse"
          />
          <Loading v-else class="w-3.5 h-3.5 text-current animate-spin" />
          <span>{{ progressText }}</span>
        </span>
      </template>

      <!-- Rotating -->
      <template v-else-if="store.isRotating">
        <span class="flex items-center gap-1.5">
          <RotateRight class="w-3.5 h-3.5 text-current" />
          <span>{{ rotatingText }}</span>
        </span>
      </template>

      <!-- Resizing -->
      <template v-else-if="store.isResizing">
        <span class="flex items-center gap-1.5">
          <OpenInFull class="w-3.5 h-3.5 text-current" />
          <span>{{ resizingText }}</span>
        </span>
      </template>

      <!-- Dragging -->
      <template v-else-if="store.isDragging">
        <span class="flex items-center gap-1.5">
          <OpenWith class="w-3.5 h-3.5 text-current" />
          <span>{{ draggingText }}</span>
        </span>
      </template>

      <!-- Multiple elements selected -->
      <template v-else-if="selectedCount > 1">
        <span class="flex items-center gap-1.5">
          <Layers class="w-3.5 h-3.5 text-current" />
          <span>{{ t('properties.selectedElements', { n: selectedCount }) }}</span>
        </span>
      </template>

      <!-- Single element selected -->
      <template v-else-if="selectedElement">
        <span class="font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
          <component v-if="selectedElementIcon" :is="selectedElementIcon" class="w-3.5 h-3.5 text-current" />
          <span>{{ t('elements.' + selectedElement.type) }}</span>
        </span>
        <span class="text-gray-400 hidden sm:inline">
          {{ t('properties.label.x') }}:&nbsp;{{ fmt(selectedElement.x) }}&nbsp;&nbsp;
          {{ t('properties.label.y') }}:&nbsp;{{ fmt(selectedElement.y) }}
        </span>
        <span class="text-gray-400 hidden sm:inline">
          {{ fmt(selectedElement.width) }}&nbsp;×&nbsp;{{ fmt(selectedElement.height) }}&nbsp;{{ unitText }}&nbsp;&nbsp;
          {{ t('properties.label.zIndex') }}:&nbsp;{{ selectedElementLayer }}
        </span>
      </template>

      <!-- Ready -->
      <template v-else>
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-green-500 dark:bg-green-400" />
          <span>{{ t('statusBar.ready') }}</span>
        </span>
      </template>
    </div>

    <!-- Right: zoom + copyright -->
    <div class="flex items-center gap-3 ml-3 shrink-0">
      <div class="hidden md:inline-flex items-center gap-1 text-gray-400">
        <ZoomIn class="w-3.5 h-3.5 text-current" />
        <span>{{ t('statusBar.zoom') }}&nbsp;{{ zoomPercent }}%</span>
      </div>
      <div
        v-if="showTemplateSaveStatus"
        class="hidden md:inline-flex items-center gap-1 text-gray-400"
        :title="templateSaveStatusText"
      >
        <Loading v-if="isTemplateSaving" class="w-3.5 h-3.5 text-current animate-spin" />
        <Check v-else-if="!isTemplateUnsaved" class="w-3.5 h-3.5 text-current" />
        <SaveIcon v-else class="w-3.5 h-3.5 text-current" />
        <span class="hidden lg:inline">{{ templateSaveStatusText }}</span>
      </div>
      <div
        v-if="showCloudLinkStatus"
        class="hidden sm:inline-flex items-center gap-1"
        :title="remoteConnected ? t('statusBar.connection.cloudConnected') : t('statusBar.connection.cloudDisconnected')"
      >
        <Cloud class="w-3.5 h-3.5" />
        <Check v-if="remoteConnected" class="w-3 h-3 text-current" />
        <Close v-else class="w-3 h-3 text-current" />
      </div>
      <div
        v-if="showClientLinkStatus"
        class="hidden sm:inline-flex items-center gap-1"
        :title="localConnected ? t('statusBar.connection.clientConnected') : t('statusBar.connection.clientDisconnected')"
      >
        <Computer class="w-3.5 h-3.5" />
        <Check v-if="localConnected" class="w-3 h-3 text-current" />
        <Close v-else class="w-3 h-3 text-current" />
      </div>
      <a
        href="https://printdot.cc"
        target="_blank"
        rel="noopener noreferrer"
        class="text-gray-400 hover:text-blue-500 transition-colors duration-150"
      >PrintDot © {{ currentYear }}</a>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue';
import { useI18n } from "@/locales";
import { useDesignerStore } from "@/stores/designer";
import { useTemplateStore } from "@/stores/templates";
import { usePrintSettings } from "@/composables/usePrintSettings";
import { pxToUnit, type Unit } from "@/utils/units";
import Loading from "@/svg/components/LoadingIcon.vue";
import HourglassEmpty from "~icons/material-symbols/hourglass-empty";
import OpenWith from "~icons/material-symbols/open-with";
import OpenInFull from "~icons/material-symbols/open-in-full";
import RotateRight from "~icons/material-symbols/rotate-right";
import Layers from "~icons/material-symbols/layers";
import SaveIcon from "~icons/material-symbols/save";
import Check from "~icons/material-symbols/check";
import Close from "~icons/material-symbols/close";
import Cloud from "~icons/material-symbols/cloud";
import Computer from "~icons/material-symbols/computer";
import ZoomIn from "~icons/material-symbols/zoom-in";
import Type from "~icons/material-symbols/text-fields";
import Numbers from "~icons/material-symbols/numbers";
import ImageIcon from "~icons/material-symbols/image";
import TableIcon from "~icons/material-symbols/table-chart";
import BarcodeIcon from "~icons/material-symbols/barcode";
import QrCodeIcon from "~icons/material-symbols/qr-code";
import HorizontalRuleIcon from "~icons/material-symbols/horizontal-rule";
import CheckBoxOutlineBlank from "~icons/material-symbols/check-box-outline-blank";
import RadioButtonUnchecked from "~icons/material-symbols/radio-button-unchecked";

const { t } = useI18n();
const store = useDesignerStore();
const templateStore = useTemplateStore();
const { localStatus, remoteStatus } = usePrintSettings();

const selectedElement = computed(() => store.selectedElement);
const selectedCount = computed(() => store.selectedElementIds?.length ?? 0);
const printProgress = computed(() => store.printProgress);
const unitText = computed(() => t(`common.${store.unit || "mm"}`));
const selectedElementLayer = computed(() => {
  const z = selectedElement.value?.style?.zIndex;
  return Number.isFinite(z) ? Number(z) : 1;
});
const selectedElementName = computed(() => {
  const type = selectedElement.value?.type;
  if (!type) return "";
  return t("elements." + type);
});

const draggingText = computed(() => {
  if (selectedCount.value > 1) {
    return t("statusBar.draggingMultiple", { n: selectedCount.value });
  }

  if (selectedElementName.value) {
    return t("statusBar.draggingElement", {
      element: selectedElementName.value,
    });
  }

  return t("statusBar.dragging");
});

const resizingText = computed(() => {
  if (selectedCount.value > 1) {
    return t("statusBar.resizingMultiple", { n: selectedCount.value });
  }

  if (selectedElementName.value) {
    return t("statusBar.resizingElement", {
      element: selectedElementName.value,
    });
  }

  return t("statusBar.resizing");
});

const rotatingText = computed(() => {
  if (selectedCount.value > 1) {
    return t("statusBar.rotatingMultiple", { n: selectedCount.value });
  }

  if (selectedElementName.value) {
    return t("statusBar.rotatingElement", {
      element: selectedElementName.value,
    });
  }

  return t("statusBar.rotating");
});

const elementIconMap: Record<string, Component> = {
  text: Type,
  image: ImageIcon,
  table: TableIcon,
  line: HorizontalRuleIcon,
  rect: CheckBoxOutlineBlank,
  circle: RadioButtonUnchecked,
  barcode: BarcodeIcon,
  qrcode: QrCodeIcon,
  pageNumber: Numbers,
  custom: Numbers,
};

const selectedElementIcon = computed<Component | null>(() => {
  const type = selectedElement.value?.type;
  if (!type) return null;
  return elementIconMap[type] || null;
});

const zoomPercent = computed(() => Math.round((store.zoom ?? 1) * 100));

const currentYear = new Date().getFullYear();

function fmt(px: number): string {
  const v = pxToUnit(px, (store.unit || 'mm') as Unit);
  return String(v);
}

const progressText = computed(() => {
  const p = printProgress.value;
  if (!p) return '';
  if (p.message) return p.message;
  const phaseKey = `statusBar.progress.${p.phase}`;
  const phaseText = t(phaseKey);
  if (phaseText !== phaseKey) return phaseText;
  return t('statusBar.progress.rendering');
});

const progressPercent = computed(() => {
  const p = printProgress.value;
  if (!p || p.total <= 0) return 0;
  return Math.round((p.current / p.total) * 100);
});

const isPreparingProgress = computed(() => {
  const p = printProgress.value;
  if (!p) return false;
  return p.message === t("statusBar.progress.preparing");
});

const isSavingProgress = computed(() => {
  const p = printProgress.value;
  if (!p) return false;
  return p.message === t("statusBar.progress.saving");
});

const isTemplateSaving = computed(() => templateStore.isSaving);
const isTemplateUnsaved = computed(() => templateStore.hasUnsavedChanges);
const showTemplateSaveStatus = computed(() => {
  return Boolean(templateStore.currentTemplateId) || isTemplateSaving.value || isTemplateUnsaved.value;
});
const templateSaveStatusText = computed(() => {
  if (isTemplateSaving.value) return t("statusBar.template.saving");
  if (isTemplateUnsaved.value) return t("statusBar.template.unsaved");
  return t("statusBar.template.saved");
});

const localConnected = computed(() => localStatus.value === "connected");
const remoteConnected = computed(() => remoteStatus.value === "connected");
const showClientLinkStatus = computed(() => store.showClientLink !== false);
const showCloudLinkStatus = computed(() => store.showCloudLink !== false);
</script>

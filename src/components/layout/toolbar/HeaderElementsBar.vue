<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "@/locales";
import { useDesignerStore } from "@/stores/designer";
import Type from "~icons/material-symbols/text-fields";
import Numbers from "~icons/material-symbols/numbers";
import Image from "~icons/material-symbols/image";
import Table from "~icons/material-symbols/table-chart";
import Barcode from "~icons/material-symbols/barcode";
import QrCode from "~icons/material-symbols/qr-code";
import HorizontalRule from "~icons/material-symbols/horizontal-rule";
import CheckBoxOutlineBlank from "~icons/material-symbols/check-box-outline-blank";
import RadioButtonUnchecked from "~icons/material-symbols/radio-button-unchecked";
import Star from "~icons/material-symbols/star";
import SwapHoriz from "~icons/material-symbols/swap-horiz";
import KeyboardArrowLeft from "~icons/material-symbols/keyboard-arrow-left";
import KeyboardArrowRight from "~icons/material-symbols/keyboard-arrow-right";
import { ElementType, type CustomElementTemplate } from "@/types";

const { t } = useI18n();
const store = useDesignerStore();

const activeList = ref<"standard" | "custom">("standard");
const customElements = computed(() => store.customElements);
const hasCustomElements = computed(() => customElements.value.length > 0);
const elementsScrollRef = ref<HTMLElement | null>(null);
const elementsContentRef = ref<HTMLElement | null>(null);
const isElementsOverflowing = ref(false);
const canScrollElementsLeft = ref(false);
const canScrollElementsRight = ref(false);
const viewportWidth = ref(
  typeof window === "undefined" ? 1920 : window.innerWidth,
);
const SMALL_SCREEN_BREAKPOINT = 1360;
let elementsResizeObserver: ResizeObserver | null = null;

type HeaderElementItem = {
  type: ElementType;
  label: string;
  icon: any;
};

const standardGroups: HeaderElementItem[][] = [
  [
    { type: ElementType.TEXT, label: "elementsPanel.text", icon: Type },
    { type: ElementType.IMAGE, label: "elementsPanel.image", icon: Image },
    {
      type: ElementType.PAGE_NUMBER,
      label: "elementsPanel.pagination",
      icon: Numbers,
    },
  ],
  [
    { type: ElementType.TABLE, label: "elementsPanel.table", icon: Table },
    {
      type: ElementType.BARCODE,
      label: "elementsPanel.barcode",
      icon: Barcode,
    },
    { type: ElementType.QRCODE, label: "elementsPanel.qrcode", icon: QrCode },
  ],
  [
    {
      type: ElementType.LINE,
      label: "elementsPanel.line",
      icon: HorizontalRule,
    },
    {
      type: ElementType.RECT,
      label: "elementsPanel.rect",
      icon: CheckBoxOutlineBlank,
    },
    {
      type: ElementType.CIRCLE,
      label: "elementsPanel.circle",
      icon: RadioButtonUnchecked,
    },
  ],
];

const isCustomList = computed(() => activeList.value === "custom");
const nextListLabel = computed(() =>
  isCustomList.value ? t("elementsPanel.standard") : t("elementsPanel.custom"),
);

const toggleList = () => {
  activeList.value = isCustomList.value ? "standard" : "custom";
};

const handleDragStart = (event: DragEvent, type: ElementType) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData("application/json", JSON.stringify({ type }));
    event.dataTransfer.effectAllowed = "copy";
  }
};

const handleDragStartCustom = (
  event: DragEvent,
  template: CustomElementTemplate,
) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        type: template.element.type,
        payload: template.element,
      }),
    );
    event.dataTransfer.effectAllowed = "copy";
  }
};

const getCustomIcon = (type: ElementType) => {
  switch (type) {
    case ElementType.TEXT:
      return Type;
    case ElementType.IMAGE:
      return Image;
    case ElementType.TABLE:
      return Table;
    case ElementType.PAGE_NUMBER:
      return Numbers;
    case ElementType.BARCODE:
      return Barcode;
    case ElementType.QRCODE:
      return QrCode;
    case ElementType.LINE:
      return HorizontalRule;
    case ElementType.RECT:
      return CheckBoxOutlineBlank;
    case ElementType.CIRCLE:
      return RadioButtonUnchecked;
    default:
      return Star;
  }
};

const shouldShowCustomTypeDivider = (index: number) => {
  if (index <= 0) return false;
  const current = customElements.value[index];
  const previous = customElements.value[index - 1];
  if (!current || !previous) return false;
  return current.element.type !== previous.element.type;
};

const shouldShowElementScrollArrows = computed(
  () =>
    viewportWidth.value <= SMALL_SCREEN_BREAKPOINT &&
    isElementsOverflowing.value,
);

const updateElementsScrollState = () => {
  const container = elementsScrollRef.value;
  if (!container) {
    isElementsOverflowing.value = false;
    canScrollElementsLeft.value = false;
    canScrollElementsRight.value = false;
    return;
  }

  const maxScrollLeft = Math.max(
    container.scrollWidth - container.clientWidth,
    0,
  );
  isElementsOverflowing.value = maxScrollLeft > 4;
  canScrollElementsLeft.value = container.scrollLeft > 2;
  canScrollElementsRight.value = container.scrollLeft < maxScrollLeft - 2;
};

const handleElementsScroll = () => {
  updateElementsScrollState();
};

const scrollElements = (direction: "backward" | "forward") => {
  const container = elementsScrollRef.value;
  if (!container) return;
  const offset = Math.max(Math.round(container.clientWidth * 0.7), 180);
  container.scrollBy({
    left: direction === "backward" ? -offset : offset,
    behavior: "smooth",
  });
};

const handleElementsResize = () => {
  viewportWidth.value = window.innerWidth;
  updateElementsScrollState();
};

watch(activeList, () => {
  nextTick(() => {
    updateElementsScrollState();
  });
});

watch(hasCustomElements, (hasItems) => {
  if (!hasItems && isCustomList.value) {
    activeList.value = "standard";
  }
});

watch(
  () => customElements.value.length,
  () => {
    nextTick(() => {
      updateElementsScrollState();
    });
  },
);

onMounted(() => {
  window.addEventListener("resize", handleElementsResize);
  nextTick(() => {
    updateElementsScrollState();
    elementsResizeObserver = new ResizeObserver(() => {
      updateElementsScrollState();
    });
    if (elementsScrollRef.value) {
      elementsResizeObserver.observe(elementsScrollRef.value);
    }
    if (elementsContentRef.value) {
      elementsResizeObserver.observe(elementsContentRef.value);
    }
  });
});

onUnmounted(() => {
  window.removeEventListener("resize", handleElementsResize);
  if (elementsResizeObserver) {
    elementsResizeObserver.disconnect();
    elementsResizeObserver = null;
  }
});
</script>

<template>
  <div class="flex min-w-0 w-full max-w-[860px] justify-center">
    <div class="flex min-w-0 max-w-full items-center overflow-hidden">
      <button
        v-if="hasCustomElements"
        type="button"
        class="shrink-0 flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-md bg-white text-gray-700 hover:bg-gray-50"
        :title="nextListLabel"
        @click="toggleList"
      >
        <SwapHoriz class="w-4 h-4" />
      </button>

      <div
        v-if="hasCustomElements"
        class="h-8 w-px bg-gray-300 shrink-0 mx-2"
      ></div>

      <div class="min-w-0 flex-1 max-w-full flex items-center gap-1">
        <button
          v-if="shouldShowElementScrollArrows"
          type="button"
          class="shrink-0 flex items-center justify-center p-1 rounded text-gray-500 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-35 dark:text-gray-300 dark:hover:bg-gray-700"
          :disabled="!canScrollElementsLeft"
          :title="t('editor.toolbarScrollPrev')"
          :aria-label="t('editor.toolbarScrollPrev')"
          @click="scrollElements('backward')"
        >
          <KeyboardArrowLeft class="h-4 w-4" />
        </button>

        <div
          ref="elementsScrollRef"
          class="min-w-0 flex-1 max-w-full overflow-x-auto no-scrollbar"
          @scroll="handleElementsScroll"
        >
          <div
            ref="elementsContentRef"
            v-if="!isCustomList"
            class="flex w-max min-w-max items-center gap-1.5 pr-1"
          >
            <template
              v-for="(group, groupIndex) in standardGroups"
              :key="`group-${groupIndex}`"
            >
              <div
                v-if="groupIndex > 0"
                class="h-8 w-px bg-gray-300 shrink-0"
              ></div>
              <div
                v-for="item in group"
                :key="item.type"
                class="flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-1 rounded-md bg-white text-gray-700 cursor-move hover:bg-gray-50"
                draggable="true"
                :title="t(item.label)"
                @dragstart="(e) => handleDragStart(e, item.type)"
              >
                <component :is="item.icon" class="w-4 h-4" />
                <span
                  class="w-full px-0.5 text-center text-[10px] leading-3 truncate"
                  >{{ t(item.label) }}</span
                >
              </div>
            </template>
          </div>

          <div
            v-else-if="customElements.length === 0"
            class="text-xs text-gray-500 px-1"
          >
            {{ t("elementsPanel.noCustomElements") }}
          </div>

          <div
            ref="elementsContentRef"
            v-else
            class="flex w-max min-w-max items-center gap-1.5 pr-1"
          >
            <template v-for="(item, index) in customElements" :key="item.id">
              <div
                v-if="shouldShowCustomTypeDivider(index)"
                class="h-8 w-px bg-gray-300 shrink-0"
              ></div>
              <div
                class="flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-1 rounded-md bg-white text-gray-700 cursor-move hover:bg-gray-50"
                draggable="true"
                :title="item.name"
                @dragstart="(e) => handleDragStartCustom(e, item)"
              >
                <component
                  :is="getCustomIcon(item.element.type)"
                  class="w-4 h-4"
                />
                <span
                  class="w-full px-0.5 text-center text-[10px] leading-3 truncate"
                  >{{ item.name }}</span
                >
              </div>
            </template>
          </div>
        </div>

        <button
          v-if="shouldShowElementScrollArrows"
          type="button"
          class="shrink-0 flex items-center justify-center p-1 rounded text-gray-500 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-35 dark:text-gray-300 dark:hover:bg-gray-700"
          :disabled="!canScrollElementsRight"
          :title="t('editor.toolbarScrollNext')"
          :aria-label="t('editor.toolbarScrollNext')"
          @click="scrollElements('forward')"
        >
          <KeyboardArrowRight class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>

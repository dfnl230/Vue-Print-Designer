<script setup lang="ts">
import { onMounted, watch, ref, nextTick, computed, inject } from "vue";
import type { PrintElement } from "@/types";
import { useDesignerStore } from "@/stores/designer";
import { normalizeVariableKey } from "@/utils/variables";
import { usePrintSettings } from "@/composables/usePrintSettings";

const props = defineProps<{
  element: PrintElement;
}>();

const store = useDesignerStore();
const { printQuality } = usePrintSettings();
const registerRenderTask = inject<((task: Promise<void>) => void) | null>(
  "registerRenderTask",
  null,
);

const qrSrc = ref("");
const qrRef = ref<HTMLImageElement | null>(null);

const getPrintQualityScale = () => {
  if (printQuality.value === "fast") return 0.5;
  if (printQuality.value === "high") return 1.5;
  if (printQuality.value === "ultra") return 2;
  return 1;
};

const waitForImageReady = async (img: HTMLImageElement) => {
  if (typeof img.decode === "function") {
    try {
      await img.decode();
      return;
    } catch {
      // Fall back to load/error events below.
    }
  }

  if (img.complete) return;

  await new Promise<void>((resolve) => {
    img.addEventListener("load", () => resolve(), { once: true });
    img.addEventListener("error", () => resolve(), { once: true });
  });
};

const resolvedContent = computed(() => {
  const variable = props.element.variable || "";
  if (store.isExporting && variable) {
    const key = normalizeVariableKey(variable);
    if (
      key &&
      (store as any).variables &&
      Object.prototype.hasOwnProperty.call((store as any).variables, key)
    ) {
      const value = (store as any).variables[key];
      if (value !== undefined && value !== null) {
        return String(value);
      }
    }
    if (key && Object.prototype.hasOwnProperty.call(store.testData, key)) {
      const value = store.testData[key];
      if (value !== undefined && value !== null) {
        return String(value);
      }
    }
  }

  // 即使不是导出模式，只要有 testData 并且有匹配的 variable，就展示 testData
  if (!store.isExporting && props.element.variable) {
    const key = normalizeVariableKey(props.element.variable);
    if (key && Object.prototype.hasOwnProperty.call(store.testData, key)) {
      const value = store.testData[key];
      if (value !== undefined && value !== null) {
        return String(value);
      }
    }
  }

  return (
    props.element.variable || props.element.content || "https://example.com"
  );
});

const renderQR = async () => {
  try {
    const qrcodeModule = await import("qrcode");
    const QRCode = (qrcodeModule as any)?.default || qrcodeModule;
    const content = resolvedContent.value;
    const qualityScale = getPrintQualityScale();
    const pixelWidth = Math.max(
      64,
      Math.ceil(
        Math.max(props.element.width || 0, props.element.height || 0) *
          qualityScale,
      ),
    );

    qrSrc.value = await QRCode.toDataURL(content, {
      width: pixelWidth,
      margin: 0,
      color: {
        dark: props.element.style.color || "#000000",
        light: "#00000000",
      },
      errorCorrectionLevel:
        (props.element.style as any).qrErrorCorrection || "M",
    });

    await nextTick();
    if (qrRef.value) await waitForImageReady(qrRef.value);
  } catch (e) {
    console.error("QR render error", e);
  }
};

onMounted(() => {
  const task = nextTick().then(renderQR);
  if (registerRenderTask) registerRenderTask(task);
});

watch(
  () => [
    props.element.content,
    props.element.variable,
    props.element.style,
    props.element.width,
    props.element.height,
    printQuality.value,
    store.isExporting,
    store.testData,
    (store as any).variables,
  ],
  () => {
    const task = nextTick().then(renderQR);
    if (registerRenderTask) registerRenderTask(task);
  },
  { deep: true },
);
</script>

<script lang="ts">
import type { ElementPropertiesSchema } from "@/types";
export const elementPropertiesSchema: ElementPropertiesSchema = {
  sections: [
    {
      title: "properties.section.content",
      tab: "properties",
      fields: [
        {
          label: "properties.label.content",
          type: "text",
          target: "element",
          key: "content",
          placeholder: "properties.label.qrContentPlaceholder",
        },
        {
          label: "properties.label.variable",
          type: "text",
          target: "element",
          key: "variable",
          placeholder: "@variable",
        },
      ],
    },
    {
      title: "properties.section.qrSettings",
      tab: "style",
      fields: [
        {
          label: "properties.label.errorCorrection",
          type: "select",
          target: "style",
          key: "qrErrorCorrection",
          options: [
            { label: "properties.option.eccLow", value: "L" },
            { label: "properties.option.eccMedium", value: "M" },
            { label: "properties.option.eccQuartile", value: "Q" },
            { label: "properties.option.eccHigh", value: "H" },
          ],
        },
        {
          label: "properties.label.color",
          type: "color",
          target: "style",
          key: "color",
        },
      ],
    },
  ],
};
</script>

<template>
  <div class="w-full h-full flex items-center justify-center overflow-hidden">
    <img
      ref="qrRef"
      v-if="qrSrc"
      :src="qrSrc"
      class="w-full h-full object-contain pointer-events-none"
      draggable="false"
    />
  </div>
</template>

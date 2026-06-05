<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, inject } from "vue";
import { useI18n } from "@/locales";
import { usePrint } from "@/utils/print";
import { useJsonBlobModal } from "@/composables/useJsonBlobModal";
import { useTemplateStore } from "@/stores/templates";
import { useDesignerStore } from "@/stores/designer";
import Printer from "~icons/material-symbols/print";
import Loading from "@/svg/components/LoadingIcon.vue";
import FilePdf from "~icons/material-symbols/picture-as-pdf";
import FileOutput from "~icons/material-symbols/file-download";
import Image from "~icons/material-symbols/image";
import Close from "~icons/material-symbols/close";
import ZoomIn from "~icons/material-symbols/zoom-in";
import ZoomOut from "~icons/material-symbols/zoom-out";
import DataObject from "~icons/material-symbols/data-object";
import CodeEditorModal from "@/components/common/CodeEditorModal.vue";

const props = defineProps<{
  visible: boolean;
  htmlContent: string;
  width: number;
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
}>();

const { t } = useI18n();
const store = useDesignerStore();
const modalContainer = inject("modal-container", ref<HTMLElement | null>(null));
const {
  exportPdf: exportPdfHtml,
  exportHtml,
  getPdfBlob,
  exportImages,
  getImageBlob,
} = usePrint();
const templateStore = useTemplateStore();
const previewContainer = ref<HTMLElement | null>(null);
const wrapperRef = ref<HTMLElement | null>(null);
const zoomPercent = ref(100);

const {
  showJsonModal,
  jsonContent,
  modalTitle,
  modalLanguage,
  canSaveJson,
  isJsonReadOnly,
  handleViewJson,
  handleViewImageBlob,
  handleViewPdfBlob,
  handleSaveJson,
} = useJsonBlobModal({
  getPages: () =>
    previewContainer.value
      ? (Array.from(
          previewContainer.value.querySelectorAll(".print-page"),
        ) as HTMLElement[])
      : [],
  getImageBlob,
  getPdfBlob,
});

const setPreviewingState = (active: boolean) => {
  document.documentElement.classList.toggle("previewing", active);
  document.body.classList.toggle("previewing", active);
};

watch(
  () => props.visible,
  (val) => {
    if (!val) {
      zoomPercent.value = 100;
    }
    store.setDisableGlobalShortcuts(val);
    setPreviewingState(val);
  },
);

const handleClose = () => {
  emit("update:visible", false);
};

const handlePrint = () => {
  window.dispatchEvent(new CustomEvent("designer:print"));
};

const handlePdf = async () => {
  if (previewContainer.value) {
    if (store.isGeneratingPdf) return;
    store.isGeneratingPdf = true;
    try {
      const pages = Array.from(
        previewContainer.value.querySelectorAll(".print-page")
      ) as HTMLElement[];
      await exportPdfHtml(pages, `${getExportBaseName()}.pdf`);
    } finally {
      store.isGeneratingPdf = false;
    }
  }
};

const handleExportHtmlBtn = async () => {
  if (previewContainer.value) {
    if (store.isGeneratingHtml) return;
    store.isGeneratingHtml = true;
    try {
      const pages = Array.from(
        previewContainer.value.querySelectorAll(".print-page")
      ) as HTMLElement[];
      await exportHtml(pages, `${getExportBaseName()}.html`);
    } finally {
      store.isGeneratingHtml = false;
    }
  }
};

const handleExportImages = async () => {
  if (previewContainer.value) {
    if (store.isGeneratingImages) return;
    store.isGeneratingImages = true;
    try {
      const pages = Array.from(
        previewContainer.value.querySelectorAll(".print-page")
      ) as HTMLElement[];
      await exportImages(pages, getExportBaseName());
    } finally {
      store.isGeneratingImages = false;
    }
  }
};

const getExportBaseName = () => {
  const current = templateStore.templates.find(
    (t) => t.id === templateStore.currentTemplateId,
  );
  const rawName = (current?.name || "print-design").trim();
  const safeName =
    rawName
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim() || "print-design";
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${safeName}-${yyyy}${mm}${dd}`;
};

const handleZoomIn = () => {
  zoomPercent.value = Math.min(500, zoomPercent.value + 10);
};

const handleZoomOut = () => {
  zoomPercent.value = Math.max(20, zoomPercent.value - 10);
};

const handleWheel = (e: WheelEvent) => {
  if (e.ctrlKey) {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  }
};

const handleCtrlKey = (e: KeyboardEvent) => {
  if (e.key === "Control" || e.key === "Meta") {
    if (e.type === "keydown" && !e.repeat) {
      wrapperRef.value?.addEventListener("wheel", handleWheel, {
        passive: false,
      });
    } else if (e.type === "keyup") {
      wrapperRef.value?.removeEventListener("wheel", handleWheel);
    }
  }
};

const handleBlur = () => {
  wrapperRef.value?.removeEventListener("wheel", handleWheel);
};

const handleKeydown = (e: KeyboardEvent) => {
  if (props.visible && e.key === "Escape") {
    handleClose();
  }
  handleCtrlKey(e);
};

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("keyup", handleCtrlKey);
  window.addEventListener("blur", handleBlur);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("keyup", handleCtrlKey);
  window.removeEventListener("blur", handleBlur);
  wrapperRef.value?.removeEventListener("wheel", handleWheel);
  if (props.visible) {
    store.setDisableGlobalShortcuts(false);
  }
  setPreviewingState(false);
});
</script>

<template>
  <Teleport :to="modalContainer || 'body'">
    <div
      v-if="visible"
      class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 pointer-events-auto"
      @click.self="handleClose"
    >
      <div
        class="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col overflow-hidden"
      >
        <!-- Header -->
        <div
          class="relative flex items-center justify-between px-4 py-3 border-b border-gray-200"
        >
          <h3 class="text-base font-semibold text-gray-800">
            {{ t("preview.title") }}
          </h3>

          <!-- Zoom Control -->
          <div
            class="absolute left-1/2 -translate-x-1/2 flex items-center gap-2"
          >
            <button
              @click="handleZoomOut"
              class="p-1 hover:bg-gray-100 rounded text-gray-600 transition-colors"
              :title="t('preview.zoomOut')"
            >
              <ZoomOut class="w-4 h-4" />
            </button>
            <input
              type="range"
              min="20"
              max="500"
              step="10"
              v-model.number="zoomPercent"
              class="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:hover:scale-110"
            />
            <button
              @click="handleZoomIn"
              class="p-1 hover:bg-gray-100 rounded text-gray-600 transition-colors"
              :title="t('preview.zoomIn')"
            >
              <ZoomIn class="w-4 h-4" />
            </button>
            <span class="text-xs text-gray-600 w-9 text-right select-none"
              >{{ zoomPercent }}%</span
            >
          </div>

          <button
            @click="handleClose"
            class="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <Close class="w-4 h-4" />
          </button>
        </div>

        <!-- Content -->
        <div
          class="flex-1 overflow-auto bg-gray-100 p-8"
          ref="wrapperRef"
        >
          <div
            ref="previewContainer"
            class="preview-content mx-auto pb-4"
            :style="`width: ${width}px; zoom: ${zoomPercent / 100}`"
            v-html="htmlContent"
          ></div>
        </div>

        <!-- Footer -->
        <div
          class="px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex justify-end gap-2.5 shrink-0 rounded-b-lg"
        >
          <button
            @click="handlePrint"
            :disabled="store.isGeneratingPrint"
            class="whitespace-nowrap px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
          >
            <Loading v-if="store.isGeneratingPrint" class="w-4 h-4 shrink-0 animate-spin" />
            <Printer v-else class="w-4 h-4 shrink-0" />
            {{ t("editor.print") }}
          </button>
          <button
            @click="handlePdf"
            :disabled="store.isGeneratingPdf"
            class="whitespace-nowrap px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
          >
            <Loading v-if="store.isGeneratingPdf" class="w-4 h-4 shrink-0 animate-spin" />
            <FileOutput v-else class="w-4 h-4 shrink-0" />
            {{ t("editor.exportPdf") }}
          </button>
          <button
            @click="handleExportImages"
            :disabled="store.isGeneratingImages"
            class="whitespace-nowrap px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
          >
            <Loading v-if="store.isGeneratingImages" class="w-4 h-4 shrink-0 animate-spin" />
            <FileOutput v-else class="w-4 h-4 shrink-0" />
            {{ t("editor.exportImage") }}
          </button>
          <button
            @click="handleExportHtmlBtn"
            :disabled="store.isGeneratingHtml"
            class="whitespace-nowrap px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
          >
            <Loading v-if="store.isGeneratingHtml" class="w-4 h-4 shrink-0 animate-spin" />
            <FileOutput v-else class="w-4 h-4 shrink-0" />
            {{ t("editor.exportHtml") }}
          </button>
          <button
            v-if="store.showDeveloperMode"
            @click="handleViewImageBlob"
            class="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-xs text-gray-700 flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-100"
          >
            <DataObject class="w-4 h-4 shrink-0" />
            {{ t("editor.viewImageBlob") }}
          </button>
          <button
            v-if="store.showDeveloperMode"
            @click="handleViewPdfBlob"
            class="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-xs text-gray-700 flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-100"
          >
            <DataObject class="w-4 h-4 shrink-0" />
            {{ t("editor.viewPdfBlob") }}
          </button>
          <button
            v-if="store.showDeveloperMode"
            @click="handleViewJson"
            class="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-xs text-gray-700 flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-100"
          >
            <DataObject class="w-4 h-4 shrink-0" />
            {{ t("editor.viewJson") }}
          </button>
          <button
            @click="handleClose"
            class="whitespace-nowrap px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-xs text-gray-700 flex items-center gap-1.5 transition-colors"
          >
            <Close class="w-4 h-4 shrink-0" />
            {{ t("common.close") }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <CodeEditorModal
    v-model:visible="showJsonModal"
    :title="modalTitle"
    :value="jsonContent"
    :language="modalLanguage"
    :read-only="isJsonReadOnly"
    :show-save-button="canSaveJson"
    :show-copy-button="true"
    @update:value="jsonContent = $event"
    @save="handleSaveJson"
  />
</template>

<style scoped>
/* Ensure the preview content styling matches print expectations */
:deep(.print-page) {
  margin-bottom: 40px;
  background: white;
  box-shadow: none !important; /* Remove shadows in preview if desired, or keep for visual separation */
  position: relative !important; /* Reset position for stack flow */
  left: auto !important;
  top: auto !important;
}

/* Force default cursor for all elements in preview */
.preview-content :deep(*) {
  cursor: default !important;
}
</style>

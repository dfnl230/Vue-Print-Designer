<script setup lang="ts">
import {
  watch,
  onMounted,
  onUnmounted,
  computed,
  inject,
  ref,
  defineAsyncComponent,
} from "vue";
import { useI18n } from "@/locales";
import { useDesignerStore } from "@/stores/designer";
import { useTheme } from "@/composables/useTheme";
import Close from "~icons/material-symbols/close";
import Save from "~icons/material-symbols/save";
import ContentCopy from "~icons/material-symbols/content-copy";
import Check from "~icons/material-symbols/check";

const Editor = defineAsyncComponent(() =>
  import("@guolao/vue-monaco-editor").then((m) => m.Editor),
);

const { t } = useI18n();
const { isDark } = useTheme();
const modalContainer = inject("modal-container", ref<HTMLElement | null>(null));

const props = defineProps<{
  visible: boolean;
  title: string;
  value: string;
  language: string;
  readOnly?: boolean;
  showCopyButton?: boolean;
  showSaveButton?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:visible", visible: boolean): void;
  (e: "update:value", value: string): void;
  (e: "close"): void;
  (e: "save"): void;
}>();

const store = useDesignerStore();

const editorOptions = computed(() => ({
  minimap: { enabled: true },
  lineNumbers: "on",
  glyphMargin: false,
  folding: true,
  wordWrap: "on",
  automaticLayout: true,
  scrollBeyondLastLine: false,
  theme: isDark.value ? "vs-dark" : "vs",
  fontSize: 14,
  fontFamily: 'Consolas, "Courier New", monospace',
  renderLineHighlight: "none",
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  contextmenu: true,
}));

const shouldShowCopyButton = computed(
  () => props.showCopyButton ?? !!props.readOnly,
);

const isReadOnly = computed(() => !!props.readOnly);

const shouldShowSaveButton = computed(
  () => (props.showSaveButton ?? false) && !isReadOnly.value,
);

const accessModeLabel = computed(() => {
  return isReadOnly.value
    ? t("common.readOnly") || "Read Only"
    : t("common.readWrite") || "Read/Write";
});

const accessModeClass = computed(() => {
  return isReadOnly.value
    ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
    : "theme-bg text-white";
});

const copyState = ref<"idle" | "success">("idle");
let copyStateTimer: number | null = null;

const copyButtonLabel = computed(() => {
  if (copyState.value === "success") {
    return t("common.copied") || "Copied";
  }
  return t("common.copy") || "Copy";
});

const resetCopyState = () => {
  if (copyStateTimer !== null) {
    window.clearTimeout(copyStateTimer);
    copyStateTimer = null;
  }
  copyState.value = "idle";
};

const showCopySuccessFeedback = () => {
  copyState.value = "success";
  if (copyStateTimer !== null) {
    window.clearTimeout(copyStateTimer);
  }
  copyStateTimer = window.setTimeout(() => {
    copyState.value = "idle";
    copyStateTimer = null;
  }, 1500);
};

const copyWithExecCommand = (text: string) => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
};

const handleCopy = async () => {
  const text = props.value || "";
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      showCopySuccessFeedback();
      return;
    }
    if (copyWithExecCommand(text)) {
      showCopySuccessFeedback();
    }
  } catch {
    if (copyWithExecCommand(text)) {
      showCopySuccessFeedback();
    }
  }
};

const handleChange = (val: string | undefined) => {
  emit("update:value", val || "");
};

const handleClose = () => {
  emit("update:visible", false);
  emit("close");
};

const handleSave = () => {
  emit("save");
};

const handleKeydown = (e: KeyboardEvent) => {
  if (props.visible && e.key === "Escape") {
    handleClose();
  }
};

watch(
  () => props.visible,
  (val) => {
    store.setDisableGlobalShortcuts(val);
    if (!val) {
      resetCopyState();
    }
  },
);

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  resetCopyState();
  window.removeEventListener("keydown", handleKeydown);
  if (props.visible) {
    store.setDisableGlobalShortcuts(false);
  }
});
</script>

<template>
  <Teleport :to="modalContainer || 'body'">
    <div
      v-if="visible"
      :class="{ dark: isDark }"
      class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 pointer-events-auto"
      @click.self="handleClose"
    >
      <div
        class="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-[60vw] h-[80vh] flex flex-col overflow-hidden animate-fade-in"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0"
        >
          <div class="flex items-center gap-2">
            <h3
              class="text-base font-semibold text-gray-800 dark:text-gray-100"
            >
              {{ title }}
            </h3>
            <span
              class="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-mono uppercase"
              >{{ language }}</span
            >
            <span
              class="px-2 py-0.5 rounded text-xs font-medium"
              :class="accessModeClass"
            >
              {{ accessModeLabel }}
            </span>
          </div>
          <button
            @click="handleClose"
            class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
          >
            <Close class="w-4 h-4" />
          </button>
        </div>
        <!-- Content -->
        <div class="flex-1 overflow-hidden relative">
          <Editor
            :value="value"
            :language="language"
            :options="{ ...editorOptions, readOnly: readOnly }"
            @update:value="handleChange"
            class="w-full h-full"
          />
        </div>

        <!-- Footer -->
        <div
          class="px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 flex justify-end gap-2.5 rounded-b-lg shrink-0"
        >
          <button
            v-if="shouldShowSaveButton"
            @click="handleSave"
            class="flex items-center gap-1.5 px-3 py-1.5 theme-bg-strong text-white rounded hover:opacity-90 transition-opacity text-xs"
          >
            <Save class="w-4 h-4" />
            {{ t("common.save") }}
          </button>
          <button
            v-if="shouldShowCopyButton"
            @click="handleCopy"
            class="flex items-center gap-1.5 px-3 py-1.5 border dark:border-gray-600 font-medium rounded transition-colors text-xs min-w-[64px]"
            :class="
              copyState === 'success'
                ? 'theme-border theme-bg text-white'
                : 'border-gray-300 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
            "
          >
            <Check v-if="copyState === 'success'" class="w-4 h-4" />
            <ContentCopy v-else class="w-4 h-4" />
            {{ copyButtonLabel }}
          </button>
          <button
            @click="handleClose"
            class="whitespace-nowrap px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5 transition-colors"
          >
            <Close class="w-4 h-4" />
            {{ t("common.close") }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>

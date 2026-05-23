<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useDesignerStore } from "@/stores/designer";
import { useTemplateStore } from "@/stores/templates";
import HeaderToolbar from "./toolbar/HeaderToolbar.vue";
import HeaderElementsBar from "./toolbar/HeaderElementsBar.vue";
import HelpModal from "./help/HelpModal.vue";
import SettingsModal from "./settings/SettingsModal.vue";
import defaultLogo from "@/assets/logo.png";
import Save from "~icons/material-symbols/save";
import Loading from "~icons/material-symbols/progress-activity";
import ChevronDown from "~icons/material-symbols/expand-more";
import SaveAs from "~icons/material-symbols/save-as";
import PreviewIcon from "~icons/material-symbols/preview";
import PrinterIcon from "~icons/material-symbols/print";
import FileOutput from "~icons/material-symbols/file-download";
import DataObject from "~icons/material-symbols/data-object";
import HelpCircleIcon from "~icons/material-symbols/help";
import SettingsIcon from "~icons/material-symbols/settings";

const { t } = useI18n();
const store = useDesignerStore();
const templateStore = useTemplateStore();
const designerInstanceId = inject<string | null>("designer-instance-id", null);
const showExportMenu = ref(false);

const showLogo = computed(() => store.branding?.showLogo !== false);
const showTitle = computed(() => store.branding?.showTitle !== false);
const logoSrc = computed(() => store.branding?.logoUrl || defaultLogo);
const titleText = computed(() => store.branding?.title || t("common.appTitle"));

const dispatchDesignerEvent = (
  name: string,
  detail: Record<string, any> = {},
) => {
  const payload = { ...detail };
  if (designerInstanceId) {
    payload.__designerInstanceId = designerInstanceId;
  }
  window.dispatchEvent(new CustomEvent(name, { detail: payload }));
};

const handleSave = () => {
  dispatchDesignerEvent("designer:save");
};

const closeExportMenu = () => {
  showExportMenu.value = false;
};

const handleSaveAs = () => {
  const currentId = templateStore.currentTemplateId;
  if (currentId) {
    dispatchDesignerEvent("designer:save-as", { id: currentId });
  }
  closeExportMenu();
};

const handlePreview = () => {
  dispatchDesignerEvent("designer:preview");
  closeExportMenu();
};

const handlePrint = () => {
  dispatchDesignerEvent("designer:print");
  closeExportMenu();
};

const handleExportPdf = () => {
  dispatchDesignerEvent("designer:export-pdf");
  closeExportMenu();
};

const handleExportHtml = () => {
  dispatchDesignerEvent("designer:export-html");
  closeExportMenu();
};

const handleExportImages = () => {
  dispatchDesignerEvent("designer:export-images");
  closeExportMenu();
};

const handleViewImageBlob = () => {
  dispatchDesignerEvent("designer:view-blob");
  closeExportMenu();
};

const handleViewPdfBlob = () => {
  dispatchDesignerEvent("designer:view-pdf-blob");
  closeExportMenu();
};

const handleViewJson = () => {
  dispatchDesignerEvent("designer:view-json");
  closeExportMenu();
};

const handleOpenHelp = () => {
  store.setShowHelp(true);
  closeExportMenu();
};

const handleOpenSettings = () => {
  store.setShowSettings(true);
  closeExportMenu();
};
</script>

<template>
  <div class="z-[6000] relative isolate shadow-sm">
    <header
      class="h-14 bg-white border-b border-gray-200 grid grid-cols-[minmax(0,1fr)_minmax(0,clamp(360px,58vw,860px))_minmax(0,1fr)] items-center gap-3 px-4 min-w-0"
    >
      <div class="flex min-w-0 items-center gap-2 justify-self-start">
        <img
          v-if="showLogo"
          :src="logoSrc"
          alt="Logo"
          class="w-8 h-8 object-contain"
        />
        <h1
          v-if="showTitle"
          class="hidden md:block max-w-[180px] truncate font-semibold text-gray-700"
        >
          {{ titleText }}
        </h1>
      </div>

      <div class="min-w-0 flex justify-center overflow-hidden">
        <HeaderElementsBar />
      </div>

      <div class="relative justify-self-end shrink-0 min-w-max">
        <div class="flex items-center shadow-sm">
          <button
            @click="handleSave"
            :disabled="templateStore.isSaving"
            class="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-l-md hover:bg-blue-700 transition-colors text-sm border-r border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Loading v-if="templateStore.isSaving" class="w-4 h-4 animate-spin" />
            <Save v-else class="w-4 h-4" />
            <span class="whitespace-nowrap">{{ t("common.save") }}</span>
          </button>
          <button
            @click="showExportMenu = !showExportMenu"
            class="shrink-0 px-2 py-1.5 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 transition-colors text-sm flex items-center"
          >
            <ChevronDown class="w-5 h-5" />
          </button>
        </div>

        <div
          v-if="showExportMenu"
          class="absolute top-full right-0 mt-2 w-max min-w-[160px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-lg p-1 z-[3200] flex flex-col gap-1"
        >
          <button
            @click="handleSaveAs"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <SaveAs class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.saveAsTemplate") }}</span>
          </button>
          <button
            @click="handlePreview"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <PreviewIcon class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.preview") }}</span>
          </button>
          <button
            @click="handlePrint"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <PrinterIcon class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.print") }}</span>
          </button>
          <button
            @click="handleExportPdf"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <FileOutput class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.exportPdf") }}</span>
          </button>
          <button
            @click="handleExportHtml"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <FileOutput class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.exportHtml") }}</span>
          </button>
          <button
            @click="handleExportImages"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <FileOutput class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.exportImage") }}</span>
          </button>
          <button
            v-if="store.showDeveloperMode"
            @click="handleViewImageBlob"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <DataObject class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.viewImageBlob") }}</span>
          </button>
          <button
            v-if="store.showDeveloperMode"
            @click="handleViewPdfBlob"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <DataObject class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.viewPdfBlob") }}</span>
          </button>
          <button
            v-if="store.showDeveloperMode"
            @click="handleViewJson"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <DataObject class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.viewJson") }}</span>
          </button>
          <div class="h-px bg-gray-200 dark:bg-gray-700 my-0.5"></div>
          <button
            @click="handleOpenHelp"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <HelpCircleIcon class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.help") }}</span>
          </button>
          <button
            @click="handleOpenSettings"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <SettingsIcon class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.settings") }}</span>
          </button>
        </div>
        <div
          v-if="showExportMenu"
          class="fixed inset-0 z-[3199]"
          @click="closeExportMenu"
        ></div>
      </div>
    </header>

    <div
      class="relative z-[2001] bg-gray-100 border-b border-gray-200 flex items-center min-w-0"
    >
      <div class="flex-1 min-w-0">
        <HeaderToolbar />
      </div>
    </div>

    <HelpModal
      :show="store.showHelp"
      @update:show="store.setShowHelp($event)"
    />
    <SettingsModal
      :show="store.showSettings"
      @update:show="store.setShowSettings($event)"
    />
  </div>
</template>

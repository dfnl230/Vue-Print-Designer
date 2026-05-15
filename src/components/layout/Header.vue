<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useDesignerStore } from "@/stores/designer";
import HeaderToolbar from "./toolbar/HeaderToolbar.vue";
import HelpModal from "./help/HelpModal.vue";
import SettingsModal from "./settings/SettingsModal.vue";
import defaultLogo from "@/assets/logo.png";

const { t } = useI18n();
const store = useDesignerStore();

const showLogo = computed(() => store.branding?.showLogo !== false);
const showTitle = computed(() => store.branding?.showTitle !== false);
const logoSrc = computed(() => store.branding?.logoUrl || defaultLogo);
const titleText = computed(() => store.branding?.title || t("common.appTitle"));
</script>

<template>
  <header
    class="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-[2000] relative shadow-sm"
  >
    <div class="flex items-center gap-2">
      <img
        v-if="showLogo"
        :src="logoSrc"
        alt="Logo"
        class="w-8 h-8 object-contain"
      />
      <h1 v-if="showTitle" class="font-semibold text-gray-700">
        {{ titleText }}
      </h1>
    </div>

    <HeaderToolbar
      @toggle-help="store.setShowHelp(true)"
      @toggle-settings="store.setShowSettings(true)"
    />

    <HelpModal
      :show="store.showHelp"
      @update:show="store.setShowHelp($event)"
    />
    <SettingsModal
      :show="store.showSettings"
      @update:show="store.setShowSettings($event)"
    />
  </header>
</template>

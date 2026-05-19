import { computed, ref } from "vue";
import cloneDeep from "lodash/cloneDeep";
import { useI18n } from "vue-i18n";
import { useDesignerStore } from "@/stores/designer";
import { useTemplateStore } from "@/stores/templates";
import { toast } from "@/utils/toast";

export interface UseJsonBlobModalOptions {
  getPages: () => HTMLElement[] | null | undefined;
  getImageBlob: (pages: HTMLElement[]) => Promise<Blob>;
  getPdfBlob: (pages: HTMLElement[]) => Promise<Blob>;
}

const readBlobAsDataUrl = (blob: Blob) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      resolve((reader.result as string) || "");
    };
    reader.onerror = () => {
      reject(new Error("Failed to read blob"));
    };
  });
};

export const useJsonBlobModal = (options: UseJsonBlobModalOptions) => {
  const { t } = useI18n();
  const store = useDesignerStore();
  const templateStore = useTemplateStore();

  const showJsonModal = ref(false);
  const jsonContent = ref("");
  const modalTitle = ref("");
  const modalLanguage = ref("json");

  const canSaveJson = computed(
    () => store.showDeveloperMode && modalLanguage.value === "json",
  );

  const openModal = (content: string, title: string, language: string) => {
    jsonContent.value = content;
    modalTitle.value = title;
    modalLanguage.value = language;
    showJsonModal.value = true;
  };

  const handleViewJson = () => {
    const data = {
      pages: cloneDeep(store.pages),
      canvasSize: cloneDeep(store.canvasSize),
      guides: cloneDeep(store.guides),
      zoom: store.zoom,
      showGrid: store.showGrid,
      allowDragOutsideCanvas: store.allowDragOutsideCanvas,
      headerHeight: store.headerHeight,
      footerHeight: store.footerHeight,
      showHeaderLine: store.showHeaderLine,
      showFooterLine: store.showFooterLine,
      showMinimap: store.showMinimap,
      showHistoryPanel: store.showHistoryPanel,
      canvasBackground: store.canvasBackground,
    };

    openModal(JSON.stringify(data, null, 2), t("preview.templateJson"), "json");
  };

  const handleViewImageBlob = async () => {
    try {
      const pages = options.getPages?.() || [];
      if (!pages.length) return;

      const blob = await options.getImageBlob(pages);
      const content = await readBlobAsDataUrl(blob);
      openModal(content, t("editor.viewImageBlob"), "text");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate blob");
    }
  };

  const handleViewPdfBlob = async () => {
    try {
      const pages = options.getPages?.() || [];
      if (!pages.length) return;

      const blob = await options.getPdfBlob(pages);
      const content = await readBlobAsDataUrl(blob);
      openModal(content, t("editor.viewPdfBlob"), "text");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF blob");
    }
  };

  const handleSaveJson = async () => {
    if (!canSaveJson.value) return;

    let parsed: Record<string, any> | null = null;
    try {
      const value = jsonContent.value?.trim() || "{}";
      const json = JSON.parse(value);
      if (json && typeof json === "object" && !Array.isArray(json)) {
        parsed = json;
      }
    } catch {
      parsed = null;
    }

    if (!parsed) {
      toast.error(t("common.invalidJson"));
      return;
    }

    store.applyTemplateJsonToDesigner(parsed);

    const current = templateStore.templates.find(
      (item) => item.id === templateStore.currentTemplateId,
    );
    if (current) {
      try {
        await templateStore.saveCurrentTemplate(current.name);
      } catch {
        return;
      }
    }
  };

  return {
    showJsonModal,
    jsonContent,
    modalTitle,
    modalLanguage,
    canSaveJson,
    handleViewJson,
    handleViewImageBlob,
    handleViewPdfBlob,
    handleSaveJson,
  };
};

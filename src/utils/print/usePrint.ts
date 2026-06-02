import { nextTick } from "vue";
import cloneDeep from "lodash/cloneDeep";
import { uuidv4 } from "@/utils/uuid";
import { useDesignerStore } from "@/stores/designer";
import { ElementType, type Page } from "@/types";
import { usePrintSettings } from "@/composables/usePrintSettings";
import { toast } from "@/utils/toast";
import i18n from "@/locales";
import baseStyles from "@/style.css?inline";
import { isShadowDomContent, lockViewportScroll } from "./dom";
import { createPrintExecutor } from "./printChannel";
import { createRenderEngine } from "./renderEngine";
import { createZipBlob } from "./zipBuilder";

export const usePrint = () => {
  const store = useDesignerStore();
  const {
    printMode,
    silentPrint,
    localSettings,
    localStatus,
    remoteStatus,
    localPrintOptions,
    remotePrintOptions,
    localWsUrl,
    remoteSelectedClientId,
    fetchRemoteClients,
    fetchRemotePrinters,
    submitRemoteTask,
    exportImageMerged,
  } = usePrintSettings();

  const createRepeatedPages = (originalPages: Page[]): Page[] => {
    const original = cloneDeep(originalPages);
    if (original.length === 0) return original;

    const hasHeader = store.headerHeight > 0 && store.showHeaderLine;
    const hasFooter = store.footerHeight > 0 && store.showFooterLine;

    const basePage = original[0];
    const canvasHeight = store.canvasSize.height;
    const marginTop = store.pageSpacingY || 0;
    const marginBottom = store.pageSpacingY || 0;
    const headerBoundary = store.headerHeight + marginTop;
    const footerBoundary = canvasHeight - (store.footerHeight + marginBottom);

    const repeatHeaders = hasHeader
      ? basePage.elements.filter((e) => {
          const bounds = store.getElementBoundsAtPosition(e, e.x, e.y);
          return bounds.maxY <= headerBoundary;
        })
      : [];

    const repeatFooters = hasFooter
      ? basePage.elements.filter((e) => {
          const bounds = store.getElementBoundsAtPosition(e, e.x, e.y);
          return bounds.minY >= footerBoundary;
        })
      : [];

    const repeatPerPageElements = basePage.elements.filter(
      (e) => e.type !== ElementType.TABLE && e.repeatPerPage === true,
    );
    const repeatMap = new Map<string, (typeof basePage.elements)[number]>();
    [...repeatHeaders, ...repeatFooters, ...repeatPerPageElements].forEach(
      (el) => {
        repeatMap.set(el.id, el);
      },
    );
    const repeatedElements = Array.from(repeatMap.values());
    if (repeatedElements.length === 0) return original;

    const withRepeats = cloneDeep(original);
    for (let i = 0; i < withRepeats.length; i++) {
      if (i === 0) continue;
      const page = withRepeats[i];

      const clonedIdByOriginalId = new Map<string, string>();
      repeatedElements.forEach((el) => {
        clonedIdByOriginalId.set(el.id, uuidv4());
      });

      for (const el of repeatedElements) {
        const cloned = cloneDeep(el);
        cloned.id = clonedIdByOriginalId.get(el.id) || uuidv4();
        if (
          cloned.embeddedInTableId &&
          clonedIdByOriginalId.has(cloned.embeddedInTableId)
        ) {
          cloned.embeddedInTableId = clonedIdByOriginalId.get(
            cloned.embeddedInTableId,
          );
        }
        page.elements.push(cloned);
      }
    }
    return withRepeats;
  };

  const prepareEnvironment = async (
    options: { mutateStore?: boolean; setExporting?: boolean } = {},
  ) => {
    const mutateStore = options.mutateStore === true;
    const setExporting = options.setExporting === true;

    const previousSelection = store.selectedElementId;
    const previousShowGrid = store.showGrid;
    const previousZoom = store.zoom;
    const previousPages = cloneDeep(store.pages);
    const previousShowHeaderLine = store.showHeaderLine;
    const previousShowFooterLine = store.showFooterLine;
    const previousShowCornerMarkers = store.showCornerMarkers;
    const previousIsExporting = Boolean(store.isExporting);
    const previousBodyHasExporting =
      document.body.classList.contains("exporting");

    const previousHtmlOverflowX = document.documentElement.style.overflowX;
    const previousHtmlOverflowY = document.documentElement.style.overflowY;
    const previousBodyOverflowX = document.body.style.overflowX;
    const previousBodyOverflowY = document.body.style.overflowY;

    if (mutateStore) {
      store.selectElement(null);
      store.setShowGrid(false);
      store.setZoom(1);
      store.pages = createRepeatedPages(store.pages);
      store.setShowHeaderLine(false);
      store.setShowFooterLine(false);
      store.showCornerMarkers = false;
    }

    if (setExporting) {
      store.setIsExporting(true);
      document.body.classList.add("exporting");
    }

    if (mutateStore || setExporting) {
      document.documentElement.style.overflowX = "hidden";
      document.documentElement.style.overflowY = "hidden";
      document.body.style.overflowX = "hidden";
      document.body.style.overflowY = "hidden";

      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return () => {
      if (
        document.body.classList.contains("exporting") &&
        !previousBodyHasExporting
      ) {
        document.body.classList.remove("exporting");
      }

      if (store.isExporting !== previousIsExporting) {
        store.setIsExporting(previousIsExporting);
      }

      if (store.showCornerMarkers !== previousShowCornerMarkers) {
        store.showCornerMarkers = previousShowCornerMarkers;
      }

      if (mutateStore || setExporting) {
        document.documentElement.style.overflowX = previousHtmlOverflowX;
        document.documentElement.style.overflowY = previousHtmlOverflowY;
        document.body.style.overflowX = previousBodyOverflowX;
        document.body.style.overflowY = previousBodyOverflowY;
      }

      if (mutateStore) {
        store.setShowGrid(previousShowGrid);
        store.selectElement(previousSelection);
        store.setZoom(previousZoom);
        store.pages = previousPages;
        store.setShowHeaderLine(previousShowHeaderLine);
        store.setShowFooterLine(previousShowFooterLine);
      }
    };
  };

  const {
    getPrintHtml,
    resolveRenderSource,
    processContentForImage,
    generatePageImages,
    createPdfDocument,
  } = createRenderEngine({
    store,
    createRepeatedPages,
    prepareEnvironment,
  });

  const exportPdf = async (
    content?: HTMLElement | string | HTMLElement[],
    filename = "print-design.pdf",
  ) => {
    try {
      const targetContent =
        content ||
        (Array.from(document.querySelectorAll(".print-page")) as HTMLElement[]);
      const pdf = await createPdfDocument(targetContent);
      pdf.save(filename);
    } catch (error) {
      console.error("Export PDF failed", error);
      toast.error(i18n.global.t("toast.exportPdfFailed"));
    }
  };

  const exportHtml = async (
    content?: HTMLElement | string | HTMLElement[],
    filename = "print-design.html",
  ) => {
    try {
      const targetContent =
        content ||
        (Array.from(document.querySelectorAll(".print-page")) as HTMLElement[]);
      const html = await getPrintHtml(targetContent as HTMLElement[]);

      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${filename}</title>
  <style>
    ${baseStyles}
    body {
      background-color: #f3f4f6;
      padding: 20px;
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

      const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.endsWith(".html") ? filename : `${filename}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export HTML failed", error);
      toast.error("Export HTML failed");
    }
  };

  const browserPrint = async (
    content: HTMLElement | string | HTMLElement[],
  ) => {
    const restoreViewport = lockViewportScroll(!isShadowDomContent(content));
    try {
      const pdf = await createPdfDocument(content);
      const blob = pdf.output("blob");
      const blobUrl = URL.createObjectURL(blob);

      const isEdge = /Edg\//.test(navigator.userAgent);
      if (isEdge) {
        const popup = window.open(blobUrl, "_blank", "noopener,noreferrer");
        if (!popup) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        popup.addEventListener("beforeunload", () => {
          URL.revokeObjectURL(blobUrl);
        });

        popup.onload = () => {
          try {
            popup.focus();
            popup.print();
          } finally {
            setTimeout(() => {
              URL.revokeObjectURL(blobUrl);
            }, 1000);
          }
        };
        return { status: "success", mode: "browser" };
      }

      await new Promise<void>((resolve) => {
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.left = "0";
        iframe.style.top = "0";
        iframe.style.width = "0px";
        iframe.style.height = "0px";
        iframe.style.border = "0";
        iframe.style.visibility = "hidden";
        iframe.src = blobUrl;
        document.body.appendChild(iframe);

        iframe.onload = () => {
          const win = iframe.contentWindow;
          if (win) {
            win.focus();
            setTimeout(() => {
              win.print();
            }, 100);
          }
          setTimeout(() => {
            if (iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }
            URL.revokeObjectURL(blobUrl);
            resolve();
          }, 1000);
        };
      });
      return { status: "success", mode: "browser" };
    } catch (error) {
      console.error("Print failed", error);
      toast.error("Print failed");
      throw error;
    } finally {
      restoreViewport();
    }
  };

  const stitchImages = async (images: string[]): Promise<string> => {
    if (images.length === 0) return "";

    const firstImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = images[0];
    });

    const imgWidth = firstImg.width;
    const imgHeight = firstImg.height;
    const totalHeight = imgHeight * images.length;

    const canvas = document.createElement("canvas");
    canvas.width = imgWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    ctx.drawImage(firstImg, 0, 0);

    for (let i = 1; i < images.length; i++) {
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, i * imgHeight);
          resolve();
        };
        img.onerror = reject;
        img.src = images[i];
      });
    }

    return canvas.toDataURL("image/jpeg", 0.8);
  };

  const exportImages = async (
    content?: HTMLElement | string | HTMLElement[],
    filenamePrefix = "print-design",
  ) => {
    try {
      const targetContent =
        content ||
        (Array.from(document.querySelectorAll(".print-page")) as HTMLElement[]);
      const restore = await prepareEnvironment({
        mutateStore: false,
        setExporting: false,
      });
      const restoreViewport = lockViewportScroll(
        !isShadowDomContent(targetContent),
      );

      const width = store.canvasSize.width;
      const height = store.canvasSize.height;

      let cleanup: (() => void) | null = null;
      const source = await resolveRenderSource(targetContent);
      cleanup = source.cleanup;

      const { container, tempWrapper } = await processContentForImage(
        source.content,
        width,
        height,
        true,
        source.getComputedStyleFn,
      );

      try {
        const pageImages = await generatePageImages(container, width, height);

        if (pageImages.length === 0) return;

        if (exportImageMerged.value) {
          const finalImage = await stitchImages(pageImages);

          const link = document.createElement("a");
          link.href = finalImage;
          link.download = `${filenamePrefix}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          const zipEntries = await Promise.all(
            pageImages.map(async (dataUrl: string, index: number) => {
              const response = await fetch(dataUrl);
              const blob = await response.blob();
              return {
                filename: `${filenamePrefix}-${index + 1}.jpg`,
                data: blob,
              };
            }),
          );

          const zipBlob = await createZipBlob(zipEntries);
          const zipUrl = URL.createObjectURL(zipBlob);
          const link = document.createElement("a");
          link.href = zipUrl;
          link.download = `${filenamePrefix}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(zipUrl);
        }
      } finally {
        if (tempWrapper && tempWrapper.parentNode) {
          tempWrapper.parentNode.removeChild(tempWrapper);
        }
        if (cleanup) {
          cleanup();
        }
        restoreViewport();
        restore();
      }
    } catch (error) {
      console.error("Export Images failed", error);
      toast.error("Export Images failed");
    }
  };

  const getImageBlob = async (
    content: HTMLElement | string | HTMLElement[],
  ) => {
    try {
      const targetContent =
        content ||
        (Array.from(document.querySelectorAll(".print-page")) as HTMLElement[]);
      const restore = await prepareEnvironment({
        mutateStore: false,
        setExporting: false,
      });
      const restoreViewport = lockViewportScroll(
        !isShadowDomContent(targetContent),
      );

      const width = store.canvasSize.width;
      const height = store.canvasSize.height;

      let cleanup: (() => void) | null = null;
      const source = await resolveRenderSource(targetContent);
      cleanup = source.cleanup;

      const { container, tempWrapper } = await processContentForImage(
        source.content,
        width,
        height,
        true,
        source.getComputedStyleFn,
      );

      try {
        const pageImages = await generatePageImages(container, width, height);

        if (pageImages.length === 0) throw new Error("No images generated");

        const finalImage = await stitchImages(pageImages);
        const response = await fetch(finalImage);
        return await response.blob();
      } finally {
        if (tempWrapper && tempWrapper.parentNode) {
          tempWrapper.parentNode.removeChild(tempWrapper);
        }
        if (cleanup) {
          cleanup();
        }
        restoreViewport();
        restore();
      }
    } catch (error) {
      console.error("Get Image Blob failed", error);
      throw error;
    }
  };

  const getPdfBlob = async (content: HTMLElement | string | HTMLElement[]) => {
    try {
      const pdf = await createPdfDocument(content);
      return pdf.output("blob");
    } catch (error) {
      console.error("Get PDF Blob failed", error);
      throw error;
    }
  };

  const { print } = createPrintExecutor({
    printMode,
    silentPrint,
    localStatus,
    remoteStatus,
    localPrintOptions,
    remotePrintOptions,
    localSettings,
    localWsUrl,
    remoteSelectedClientId,
    fetchRemoteClients,
    fetchRemotePrinters,
    submitRemoteTask,
    getPdfBlob,
    browserPrint,
  });

  return {
    getPrintHtml,
    print,
    exportPdf,
    exportHtml,
    exportImages,
    getPdfBlob,
    getImageBlob,
  };
};

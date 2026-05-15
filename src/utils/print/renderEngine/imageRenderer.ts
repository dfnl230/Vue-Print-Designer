import { usePrintSettings } from "@/composables/usePrintSettings";
import { pxToMm } from "@/utils/units";
import {
  cleanElement,
  cloneElementWithStyles,
  isShadowDomContent,
  lockViewportScroll,
} from "../dom";
import type {
  DesignerStore,
  PrepareEnvironmentFn,
  RenderContent,
} from "./types";
import type { RenderSource } from "./iframeRenderer";

export interface ImageRendererDeps {
  store: DesignerStore;
  prepareEnvironment: PrepareEnvironmentFn;
  resolveRenderSource: (content: RenderContent) => Promise<RenderSource>;
  handleTablePagination: (
    container: HTMLElement,
    pageHeight: number,
    headerHeight: number,
    footerHeight: number,
    copyHeader: boolean,
    copyFooter: boolean,
  ) => number;
  updatePageNumbers: (container: HTMLElement, totalPages: number) => void;
}

// 创建图片/PDF 渲染模块：负责 HTML 预处理、分页截图与 PDF 生成。
export const createImageRenderer = (deps: ImageRendererDeps) => {
  const {
    store,
    prepareEnvironment,
    resolveRenderSource,
    handleTablePagination,
    updatePageNumbers,
  } = deps;

  // 生成打印预览 HTML：兼容字符串与 DOM 节点两种输入。
  const getPrintHtml = async (content?: HTMLElement[]): Promise<string> => {
    const targetContent =
      content ||
      (Array.from(document.querySelectorAll(".print-page")) as HTMLElement[]);
    const restore = await prepareEnvironment({
      mutateStore: false,
      setExporting: false,
    });

    const width = store.canvasSize.width;
    const height = store.canvasSize.height;

    let resultContainer: HTMLElement | null = null;
    let tempWrapper: HTMLElement | null = null;
    let cleanup: (() => void) | null = null;

    try {
      const source = await resolveRenderSource(targetContent);
      cleanup = source.cleanup;

      const result = await processContentForImage(
        source.content,
        width,
        height,
        true,
        source.getComputedStyleFn,
      );
      resultContainer = result.container;
      tempWrapper = result.tempWrapper;

      const previewContainer = document.createElement("div");
      previewContainer.style.width = "100%";
      previewContainer.style.display = "flex";
      previewContainer.style.flexDirection = "column";
      previewContainer.style.alignItems = "center";

      const paginatedPages = Array.from(resultContainer.children).filter(
        (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
      ) as HTMLElement[];

      paginatedPages.forEach((page, index) => {
        const clone = page.cloneNode(true) as HTMLElement;
        const isLastPage = index === paginatedPages.length - 1;

        clone.style.position = "relative";
        clone.style.left = "auto";
        clone.style.top = "auto";
        clone.style.width = `${width}px`;
        clone.style.height = `${height}px`;
        clone.style.margin = isLastPage ? "0" : "0 0 20px 0";
        clone.style.backgroundColor = store.canvasBackground;
        clone.style.transform = "none";

        previewContainer.appendChild(clone);
      });

      return previewContainer.outerHTML;
    } finally {
      if (tempWrapper && tempWrapper.parentNode) {
        tempWrapper.parentNode.removeChild(tempWrapper);
      }
      if (cleanup) {
        cleanup();
      }
      restore();
    }
  };

  // 将 SVG 转为 Canvas，避免导出图片时丢失矢量内容。
  const svgToCanvas = async (root: HTMLElement) => {
    const svgs = root.querySelectorAll("svg");
    if (svgs.length === 0) return;
    // @ts-ignore - 忽略 TS7016：canvg 的 package.json exports 导致类型解析异常
    const { Canvg } = await import("canvg");

    svgs.forEach((svg) => {
      const parent = svg.parentElement as HTMLElement | null;
      if (!parent) return;
      const style = getComputedStyle(parent);
      const w = parseFloat(style.width);
      const h = parseFloat(style.height);
      const canvas = document.createElement("canvas");
      canvas.width = Number.isFinite(w) ? Math.max(1, Math.round(w)) : 10;
      canvas.height = Number.isFinite(h) ? Math.max(1, Math.round(h)) : 10;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const serializer = new XMLSerializer();
      svg.setAttribute("width", `${w}px`);
      svg.setAttribute("height", `${h}px`);

      const str = serializer.serializeToString(svg);
      const instance = Canvg.fromString(ctx, str);
      instance.render();

      const img = document.createElement("img");
      img.src = canvas.toDataURL("image/png");
      img.style.width = `${w}px`;
      img.style.height = `${h}px`;
      img.style.display = "block";

      svg.before(img);
      parent.removeChild(svg);
    });
  };

  // 创建临时容器（保留兼容能力，供按页拼接流程复用）。
  const createTempContainer = (
    width: number,
    height: number,
    pagesCount: number,
  ): HTMLElement => {
    const temp = document.createElement("div");
    temp.className = "print_temp_container";
    temp.style.cssText =
      "position:fixed;left:0;top:0;z-index:-9999;overflow:hidden;height:0;box-sizing:border-box;";

    const container = document.createElement("div");
    container.style.position = "relative";
    container.style.width = `${width}px`;
    container.style.height = `${height * pagesCount}px`;
    container.style.backgroundColor = "#ffffff";

    temp.appendChild(container);
    document.body.appendChild(temp);

    return container;
  };

  // 渲染前预处理：克隆页面、清理节点、分页并同步页码。
  const processContentForImage = async (
    content: RenderContent,
    width: number,
    height: number,
    convertSvg = true,
    getComputedStyleFn: (
      elt: Element,
    ) => CSSStyleDeclaration = window.getComputedStyle,
  ) => {
    const tempHost = document.createElement("div");
    tempHost.style.position = "fixed";
    tempHost.style.left = "0";
    tempHost.style.top = "0";
    tempHost.style.width = "0";
    tempHost.style.height = "0";
    tempHost.style.overflow = "hidden";
    tempHost.style.zIndex = "-9999";
    tempHost.style.visibility = "hidden";
    tempHost.style.pointerEvents = "none";
    tempHost.className = "print_temp_container";
    document.body.appendChild(tempHost);

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "0";
    container.style.top = "0";
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    tempHost.appendChild(container);

    let pages: HTMLElement[] = [];
    if (typeof content === "string") {
      container.innerHTML = content;
      pages = Array.from(container.children).filter(
        (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
      ) as HTMLElement[];
    } else if (Array.isArray(content)) {
      pages = content;
    } else {
      if (content.classList.contains("design-workspace")) {
        pages = Array.from(content.children) as HTMLElement[];
      } else {
        pages = [content];
      }
    }

    pages.forEach((page, idx) => {
      const clone = cloneElementWithStyles(page, getComputedStyleFn);
      clone.style.position = "absolute";
      clone.style.left = "0";
      clone.style.top = `${idx * height}px`;
      clone.style.width = `${width}px`;
      clone.style.height = `${height}px`;
      clone.style.transform = "none";
      clone.style.backgroundColor = store.canvasBackground;

      clone
        .querySelectorAll('[data-print-exclude="true"]')
        .forEach((el) => el.remove());

      const wrappers = clone.querySelectorAll(".element-wrapper");
      wrappers.forEach((w, wrapperIndex) => {
        const el = w as HTMLElement;
        el.setAttribute("data-print-wrapper", "true");
        const top = parseFloat(el.style.top || "");
        const elHeight = parseFloat(el.style.height || "");
        const resolvedTop = Number.isFinite(top) ? top : 0;
        const resolvedHeight = Number.isFinite(elHeight)
          ? elHeight
          : el.getBoundingClientRect().height;
        el.setAttribute("data-original-top", `${resolvedTop}`);
        el.setAttribute("data-original-height", `${resolvedHeight}`);
        el.setAttribute("data-origin-page-index", `${idx}`);
        const wrapperSeq = `${idx}-${wrapperIndex}`;
        el.setAttribute("data-wrapper-seq", wrapperSeq);

        const table = el.querySelector("table");
        const autoHeightEl = el.querySelector('[data-auto-height="true"]');

        if (table) {
          el.setAttribute("data-flow-id", wrapperSeq);
          el.setAttribute("data-flow-kind", "table");
        } else if (autoHeightEl) {
          el.setAttribute("data-flow-id", wrapperSeq);
          el.setAttribute("data-flow-kind", "auto-height");
        } else {
          el.removeAttribute("data-flow-id");
          el.removeAttribute("data-flow-kind");
        }
      });

      cleanElement(clone);

      const svgs = clone.querySelectorAll("svg");
      svgs.forEach((svg) => {
        const rect = svg.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          const w = svg.getAttribute("width");
          const h = svg.getAttribute("height");
          if (w) svg.style.width = w.includes("px") ? w : `${w}px`;
          if (h) svg.style.height = h.includes("px") ? h : `${h}px`;
        }
      });

      container.appendChild(clone);
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    if (convertSvg) {
      await svgToCanvas(container);
    }

    const pagesCount = handleTablePagination(
      container,
      height,
      store.headerHeight,
      store.footerHeight,
      store.showHeaderLine,
      store.showFooterLine,
    );

    updatePageNumbers(container, pagesCount);
    container.style.height = `${height * pagesCount}px`;

    return { container, tempWrapper: tempHost, pagesCount };
  };

  // 将每页 DOM 渲染为 JPEG DataURL。
  const generatePageImages = async (
    container: HTMLElement,
    width: number,
    height: number,
  ): Promise<string[]> => {
    const pages = Array.from(container.children).filter(
      (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
    ) as HTMLElement[];

    pages.forEach((page) => {
      page.style.top = "0px";
    });

    const monacoLinks = Array.from(
      document.querySelectorAll('link[href*="monaco-editor"]'),
    );
    const linkParents = monacoLinks.map((link) => link.parentNode);
    monacoLinks.forEach((link) => link.parentNode?.removeChild(link));

    const printSettings = usePrintSettings();
    const printQualityStr = printSettings?.printQuality?.value ?? "normal";

    let printQualityScale = 1;
    let jpegQuality = 0.8;
    if (printQualityStr === "fast") {
      printQualityScale = 0.5;
      jpegQuality = 0.6;
    } else if (printQualityStr === "normal") {
      printQualityScale = 1;
      jpegQuality = 0.8;
    } else if (printQualityStr === "high") {
      printQualityScale = 1.5;
      jpegQuality = 0.9;
    } else if (printQualityStr === "ultra") {
      printQualityScale = 2;
      jpegQuality = 1.0;
    }

    try {
      // 渲染单页为图片数据。
      const generatePageImage = async (page: HTMLElement) => {
        const domToImageModule = await import("dom-to-image-more");
        const domtoimage =
          (domToImageModule as any)?.default || domToImageModule;
        const canvas = await domtoimage.toCanvas(page, {
          filter: (node: Node) => {
            if (node.nodeType === 1 && (node as Element).tagName === "LINK") {
              const href = (node as HTMLLinkElement).href;
              if (href && href.includes("monaco-editor")) {
                return false;
              }
            }
            return true;
          },
          scale: printQualityScale,
          width,
          height,
          useCORS: true,
          bgcolor: store.canvasBackground,
        });

        const ctx = canvas.getContext("2d");
        if (ctx) {
          (ctx as any).mozImageSmoothingEnabled = true;
          (ctx as any).webkitImageSmoothingEnabled = true;
          (ctx as any).msImageSmoothingEnabled = true;
          ctx.imageSmoothingEnabled = true;
        }

        return canvas.toDataURL("image/jpeg", jpegQuality);
      };

      const batchSize = 3;
      const pageImages: string[] = [];

      for (let i = 0; i < pages.length; i += batchSize) {
        const batch = pages.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((page) => generatePageImage(page)),
        );
        pageImages.push(...results);
      }

      return pageImages;
    } finally {
      monacoLinks.forEach((link, index) => {
        if (linkParents[index]) {
          linkParents[index]?.appendChild(link);
        }
      });
    }
  };

  // 生成 jsPDF 文档对象，并按页写入截图图像。
  const createPdfDocument = async (content: RenderContent) => {
    const restore = await prepareEnvironment({
      mutateStore: false,
      setExporting: false,
    });
    const restoreViewport = lockViewportScroll(!isShadowDomContent(content));

    const width = store.canvasSize.width;
    const height = store.canvasSize.height;
    const widthMm = pxToMm(width);
    const heightMm = pxToMm(height);

    let tempWrapper: HTMLElement | null = null;
    let cleanup: (() => void) | null = null;

    try {
      const source = await resolveRenderSource(content);
      cleanup = source.cleanup;

      const { container, tempWrapper: wrapper } = await processContentForImage(
        source.content,
        width,
        height,
        true,
        source.getComputedStyleFn,
      );
      tempWrapper = wrapper;

      const jsPdfModule = await import("jspdf");
      const jsPDF =
        (jsPdfModule as any)?.default ||
        (jsPdfModule as any)?.jsPDF ||
        jsPdfModule;
      const pdf = new jsPDF({
        orientation: width > height ? "l" : "p",
        unit: "mm",
        format: [widthMm, heightMm],
        hotfixes: ["px_scaling"],
      });

      const pageImages = await generatePageImages(container, width, height);

      pageImages.forEach((imgData, i) => {
        if (i > 0) pdf.addPage([widthMm, heightMm]);
        pdf.addImage(imgData, "JPEG", 0, 0, widthMm, heightMm);
      });

      return pdf;
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
  };

  return {
    getPrintHtml,
    processContentForImage,
    generatePageImages,
    createPdfDocument,
  };
};

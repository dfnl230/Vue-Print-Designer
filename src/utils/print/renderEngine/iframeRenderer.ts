import { createApp, h } from "vue";
import { createPinia } from "pinia";
import cloneDeep from "lodash/cloneDeep";
import { v4 as uuidv4 } from "uuid";
import type { Page, WatermarkSettings } from "@/types";
import i18n from "@/locales";
import PrintRenderer from "@/components/print/PrintRenderer.vue";
import baseStyles from "@/style.css?inline";
import type {
  CreateRepeatedPagesFn,
  DesignerStore,
  RenderContent,
} from "./types";

export type RenderSource = {
  content: RenderContent;
  cleanup: null | (() => void);
  getComputedStyleFn: (elt: Element) => CSSStyleDeclaration;
};

type PrintRenderPayload = {
  pages: Page[];
  canvasSize: { width: number; height: number };
  canvasBackground: string;
  headerHeight: number;
  footerHeight: number;
  pageSpacingX: number;
  pageSpacingY: number;
  showHeaderLine: boolean;
  showFooterLine: boolean;
  watermark: WatermarkSettings;
  unit: "mm" | "px" | "pt" | "in" | "cm";
  testData: Record<string, any>;
  variables: Record<string, any>;
};

const fallbackWatermark: WatermarkSettings = {
  enabled: false,
  text: "",
  angle: -30,
  color: "#000000",
  opacity: 0.1,
  size: 24,
  density: 160,
};

// 创建 iframe 渲染模块：负责将设计页渲染为可采集的 .print-page 内容。
export const createIframeRenderer = ({
  store,
  createRepeatedPages,
}: {
  store: DesignerStore;
  createRepeatedPages: CreateRepeatedPagesFn;
}) => {
  // 构建传给 PrintRenderer 的完整渲染载荷。
  const buildPrintRenderPayload = (): PrintRenderPayload => ({
    pages: createRepeatedPages(store.pages),
    canvasSize: { ...store.canvasSize },
    canvasBackground: store.canvasBackground,
    headerHeight: store.headerHeight,
    footerHeight: store.footerHeight,
    pageSpacingX: store.pageSpacingX || 0,
    pageSpacingY: store.pageSpacingY || 0,
    showHeaderLine: store.showHeaderLine,
    showFooterLine: store.showFooterLine,
    watermark: cloneDeep(store.watermark || fallbackWatermark),
    unit: store.unit || "mm",
    testData: cloneDeep(store.testData || {}),
    variables: cloneDeep(store.variables || {}),
  });

  // 等待渲染完成消息，超时则抛出错误。
  const waitForMessage = (token: string, type: string, timeoutMs = 15000) =>
    new Promise<any>((resolve, reject) => {
      const origin = window.location.origin;
      const timeoutId = window.setTimeout(() => {
        window.removeEventListener("message", handler);
        window.removeEventListener(
          `print-renderer:${type}`,
          customHandler as any,
        );
        reject(new Error(`Print renderer timeout: ${type}`));
      }, timeoutMs);

      const handler = (event: MessageEvent) => {
        if (event.origin !== origin) return;
        const data = event.data as { type?: string; token?: string };
        if (!data || data.type !== type || data.token !== token) return;
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        window.removeEventListener(
          `print-renderer:${type}`,
          customHandler as any,
        );
        resolve(data);
      };

      const customHandler = (event: CustomEvent) => {
        if (event.detail && event.detail.token === token) {
          window.clearTimeout(timeoutId);
          window.removeEventListener("message", handler);
          window.removeEventListener(
            `print-renderer:${type}`,
            customHandler as any,
          );
          resolve({ type, token });
        }
      };

      window.addEventListener("message", handler);
      window.addEventListener(`print-renderer:${type}`, customHandler as any);
    });

  // 在隐藏 iframe 中挂载 PrintRenderer，并返回渲染结果与清理函数。
  const renderPagesViaIframe = async () => {
    const token = uuidv4();
    const iframe = document.createElement("iframe");
    iframe.setAttribute("data-print-renderer", "true");
    iframe.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentDocument;
    const frameWin = iframe.contentWindow;
    if (!frameDoc || !frameWin) throw new Error("Print renderer not available");

    const style = frameDoc.createElement("style");
    style.textContent = baseStyles;
    frameDoc.head.appendChild(style);

    const mountEl = frameDoc.createElement("div");
    mountEl.id = "app";
    frameDoc.body.appendChild(mountEl);

    const payload = buildPrintRenderPayload();
    const app = createApp({
      render: () => h(PrintRenderer, { payload, token }),
    });

    app.use(createPinia());
    app.use(i18n);
    app.mount(mountEl);

    const cleanup = () => {
      app.unmount();
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    try {
      await waitForMessage(token, "print-renderer-rendered");

      const pages = Array.from(
        frameDoc.querySelectorAll(".print-page"),
      ) as HTMLElement[];
      return {
        pages,
        cleanup,
        getComputedStyleFn: frameWin.getComputedStyle.bind(frameWin),
      };
    } catch (error) {
      cleanup();
      throw error;
    }
  };

  // 统一解析渲染源：字符串直返，其它来源统一走 iframe 渲染。
  const resolveRenderSource = async (
    content: RenderContent,
  ): Promise<RenderSource> => {
    if (typeof content === "string") {
      return {
        content,
        cleanup: null,
        getComputedStyleFn: window.getComputedStyle,
      };
    }

    const iframeResult = await renderPagesViaIframe();
    return {
      content: iframeResult.pages,
      cleanup: iframeResult.cleanup,
      getComputedStyleFn: iframeResult.getComputedStyleFn,
    };
  };

  return { resolveRenderSource };
};

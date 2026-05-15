import { createIframeRenderer } from "./iframeRenderer";
import { createPagination } from "./pagination";
import { createImageRenderer } from "./imageRenderer";
import type {
  DesignerStore,
  PrepareEnvironmentFn,
  CreateRepeatedPagesFn,
} from "./types";

// 组装渲染引擎的三个子模块，对外暴露统一能力。
export const createRenderEngine = (deps: {
  store: DesignerStore;
  prepareEnvironment: PrepareEnvironmentFn;
  createRepeatedPages: CreateRepeatedPagesFn;
}) => {
  const { store, prepareEnvironment, createRepeatedPages } = deps;

  const { resolveRenderSource } = createIframeRenderer({
    store,
    createRepeatedPages,
  });
  const { updatePageNumbers, handleTablePagination } = createPagination({
    store,
  });
  const {
    getPrintHtml,
    processContentForImage,
    generatePageImages,
    createPdfDocument,
  } = createImageRenderer({
    store,
    prepareEnvironment,
    resolveRenderSource,
    handleTablePagination,
    updatePageNumbers,
  });

  return {
    getPrintHtml,
    resolveRenderSource,
    processContentForImage,
    generatePageImages,
    createPdfDocument,
  };
};

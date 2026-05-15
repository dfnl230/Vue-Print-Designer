import type { Page } from "@/types";
import type { useDesignerStore } from "@/stores/designer";
export type DesignerStore = ReturnType<typeof useDesignerStore>;
export type RenderContent = HTMLElement | string | HTMLElement[];
export type PrepareEnvironmentFn = (options?: {
  mutateStore?: boolean;
  setExporting?: boolean;
}) => Promise<() => void>;
export type CreateRepeatedPagesFn = (originalPages: Page[]) => Page[];

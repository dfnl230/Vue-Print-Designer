/**
 * 轻量 i18n 实现，替代 vue-i18n。
 *
 * 支持的功能：
 * - 嵌套 key 点路径解析（"a.b.c"）
 * - {placeholder} 插值
 * - 响应式 locale（ref），切换后所有 t() 自动更新
 * - Vue 插件 install，注入 $t 供模板使用
 * - useI18n() composable，返回 { t, locale }
 * - i18n.global.t / i18n.global.locale（兼容原有调用方式）
 */
import { ref, computed, type App, type Ref } from "vue";

type Messages = Record<string, any>;
type LocaleMessages = Record<string, Messages>;

export interface I18nOptions {
  locale: string;
  fallbackLocale?: string;
  messages: LocaleMessages;
}

// 用点路径从嵌套对象中取值
const resolvePath = (obj: Messages, path: string): string | undefined => {
  const parts = path.split(".");
  let cur: any = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return typeof cur === "string" ? cur : undefined;
};

// 替换 {key} 插值
const interpolate = (
  template: string,
  params?: Record<string, string | number>,
): string => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in params ? String(params[key]) : `{${key}}`,
  );
};

export type TranslateFn = (
  key: string,
  params?: Record<string, string | number> | string,
) => string;

export interface I18nGlobal {
  locale: Ref<string>;
  t: TranslateFn;
}

export interface I18nInstance {
  global: I18nGlobal;
  install(app: App): void;
}

export const createI18nInstance = (options: I18nOptions): I18nInstance => {
  const locale = ref(options.locale);
  const fallback = options.fallbackLocale ?? "en";
  const messages = options.messages;

  const t: TranslateFn = (key, params) => {
    const lang = locale.value;
    const msg =
      resolvePath(messages[lang] ?? {}, key) ??
      resolvePath(messages[fallback] ?? {}, key) ??
      key;
    if (typeof params === "string") return msg;
    return interpolate(msg, params);
  };

  const global: I18nGlobal = { locale, t };

  const install = (app: App) => {
    // 注入 $t 供模板使用（响应式：locale 变化时模板自动重渲染）
    app.config.globalProperties.$t = t;
    // 让模板中 $t 能响应 locale 变化——通过计算属性代理
    // 实际上 $t 是普通函数，模板里 $t("key") 不会自动追踪 locale。
    // 解决方案：把 locale 挂到 app，配合 provide/inject 或直接在模板里用 useI18n()。
    // 更简单：提供一个响应式的 $t wrapper（computed getter）。
    Object.defineProperty(app.config.globalProperties, "$t", {
      get() {
        // 访问 locale.value 建立响应式追踪
        void locale.value;
        return t;
      },
      configurable: true,
    });
  };

  return { global, install };
};

// useI18n composable
let _instance: I18nInstance | null = null;

export const setI18nInstance = (inst: I18nInstance) => {
  _instance = inst;
};

export const useI18n = (): { t: TranslateFn; locale: Ref<string> } => {
  if (!_instance) {
    throw new Error("[i18n] No i18n instance. Call setI18nInstance() first.");
  }
  return { t: _instance.global.t, locale: _instance.global.locale };
};

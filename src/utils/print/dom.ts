export const isShadowDomContent = (
  content?: HTMLElement | string | HTMLElement[],
) => {
  if (!content || typeof content === "string") return false;
  const first = Array.isArray(content) ? content[0] : content;
  if (!(first instanceof HTMLElement)) return false;
  return first.getRootNode() instanceof ShadowRoot;
};

export const lockViewportScroll = (reserveScrollbarGutter = true) => {
  const previousHtmlOverflowX = document.documentElement.style.overflowX;
  const previousHtmlOverflowY = document.documentElement.style.overflowY;
  const previousHtmlScrollbarGutter =
    document.documentElement.style.scrollbarGutter;
  const previousBodyOverflowX = document.body.style.overflowX;
  const previousBodyOverflowY = document.body.style.overflowY;
  const previousBodyScrollbarGutter = document.body.style.scrollbarGutter;

  // Reserve scrollbar gutter only when a viewport scrollbar currently exists.
  // Otherwise it introduces a visible blank strip on the right edge.
  const hasViewportScrollbar =
    window.innerWidth > document.documentElement.clientWidth;
  const shouldReserveScrollbarGutter =
    reserveScrollbarGutter && hasViewportScrollbar;

  document.documentElement.style.overflowX = "hidden";
  document.documentElement.style.overflowY = "hidden";
  document.documentElement.style.scrollbarGutter = shouldReserveScrollbarGutter
    ? "stable"
    : "";
  document.body.style.overflowX = "hidden";
  document.body.style.overflowY = "hidden";
  document.body.style.scrollbarGutter = shouldReserveScrollbarGutter
    ? "stable"
    : "";

  return () => {
    document.documentElement.style.overflowX = previousHtmlOverflowX;
    document.documentElement.style.overflowY = previousHtmlOverflowY;
    document.documentElement.style.scrollbarGutter =
      previousHtmlScrollbarGutter;
    document.body.style.overflowX = previousBodyOverflowX;
    document.body.style.overflowY = previousBodyOverflowY;
    document.body.style.scrollbarGutter = previousBodyScrollbarGutter;
  };
};

export const cleanElement = (element: HTMLElement) => {
  // Remove interactive classes.
  element.classList.remove(
    "group",
    "cursor-move",
    "select-none",
    "ring-2",
    "ring-blue-500",
    "ring-red-500",
    "hover:outline",
    "hover:outline-1",
    "hover:outline-blue-300",
  );

  const classesToRemove: string[] = [];
  element.classList.forEach((cls) => {
    if (
      cls.startsWith("hover:") ||
      cls.startsWith("focus:") ||
      cls.startsWith("active:")
    ) {
      classesToRemove.push(cls);
    }
  });
  classesToRemove.forEach((cls) => element.classList.remove(cls));

  const isTransparentBorder =
    element.style.borderColor === "transparent" ||
    element.style.border.includes("transparent") ||
    (element.style.borderStyle === "dashed" &&
      (element.style.borderColor === "transparent" ||
        (!element.style.borderColor &&
          element.style.border.includes("transparent"))));

  if (isTransparentBorder) {
    element.style.border = "none";
    element.style.outline = "none";
    element.style.boxShadow = "none";
  }

  Array.from(element.children).forEach((child) =>
    cleanElement(child as HTMLElement),
  );
};

const PRINT_CSS_PROPS = [
  "display", "position", "top", "right", "bottom", "left", "z-index", "float", "clear",
  "width", "height", "max-width", "max-height", "min-width", "min-height",
  "box-sizing", "margin-top", "margin-right", "margin-bottom", "margin-left", 
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "flex-direction", "justify-content", "align-items", "align-content", "align-self", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis",
  "grid-template-columns", "grid-template-rows", "grid-column", "grid-row", "gap",
  "background-color", "background-image", "background-size", "background-position", "background-repeat",
  "color", "font-size", "font-family", "font-weight", "font-style", "text-align", "text-decoration", "text-transform", "line-height",
  "direction", "letter-spacing", "word-spacing", "white-space", "word-break", "word-wrap", "text-overflow",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
  "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius",
  "box-shadow", "opacity", "transform", "transform-origin", "visibility", "overflow", "clip-path",
  "table-layout", "border-collapse", "border-spacing", "empty-cells", "vertical-align",
  "object-fit", "object-position",
  "fill", "stroke", "stroke-width"
];

export const cloneElementWithStyles = (
  element: HTMLElement,
  getComputedStyleFn: (
    elt: Element,
  ) => CSSStyleDeclaration = window.getComputedStyle,
): HTMLElement => {
  const clone = element.cloneNode(true) as HTMLElement;
  const queue: [HTMLElement, HTMLElement][] = [[element, clone]];

  while (queue.length > 0) {
    const [source, target] = queue.shift()!;

    if (source.nodeType === 1) {
      const computed = getComputedStyleFn(source);
      
      let cssText = computed.cssText;
      if (!cssText) {
        const len = PRINT_CSS_PROPS.length;
        const rules = [];
        for (let i = 0; i < len; i++) {
          const prop = PRINT_CSS_PROPS[i];
          const val = computed.getPropertyValue(prop);
          // 仅剔除绝对空值，保留明确设置的默认值以覆盖外部可能存在的全局样式
          if (val) {
            const priority = computed.getPropertyPriority(prop);
            rules.push(`${prop}: ${val}${priority ? " !important" : ""}`);
          }
        }
        cssText = rules.join("; ");
      }
      target.style.cssText = cssText;
    }

    for (let i = 0; i < source.children.length; i++) {
      if (target.children[i]) {
        queue.push([
          source.children[i] as HTMLElement,
          target.children[i] as HTMLElement,
        ]);
      }
    }
  }

  return clone;
};

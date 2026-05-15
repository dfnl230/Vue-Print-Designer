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

  document.documentElement.style.overflowX = "hidden";
  document.documentElement.style.overflowY = "hidden";
  document.documentElement.style.scrollbarGutter = reserveScrollbarGutter
    ? "stable"
    : "";
  document.body.style.overflowX = "hidden";
  document.body.style.overflowY = "hidden";
  document.body.style.scrollbarGutter = reserveScrollbarGutter ? "stable" : "";

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
      const style = target.style;

      for (let i = 0; i < computed.length; i++) {
        const prop = computed[i];
        style.setProperty(
          prop,
          computed.getPropertyValue(prop),
          computed.getPropertyPriority(prop),
        );
      }
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

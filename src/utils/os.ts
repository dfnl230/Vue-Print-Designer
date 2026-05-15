export const isMac = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
};

export const getModifierKey = (): string => {
  return isMac() ? "⌘" : "Ctrl";
};

export const getAltKey = (): string => {
  return isMac() ? "⌥" : "Alt";
};

export const getShiftKey = (): string => {
  return isMac() ? "⇧" : "Shift";
};

export const formatShortcut = (keys: string[]): string => {
  const isMacOs = isMac();
  return keys
    .map((key) => {
      switch (key.toLowerCase()) {
        case "ctrl":
        case "control":
          return isMacOs ? "⌘" : "Ctrl";
        case "alt":
          return isMacOs ? "⌥" : "Alt";
        case "shift":
          return isMacOs ? "⇧" : "Shift";
        case "enter":
          return isMacOs ? "⏎" : "Enter";
        case "backspace":
          return isMacOs ? "⌫" : "Backspace";
        case "delete":
          return isMacOs ? "⌦" : "Del";
        case "esc":
        case "escape":
          return "Esc";
        default:
          return key.toUpperCase();
      }
    })
    .join(" + ");
};

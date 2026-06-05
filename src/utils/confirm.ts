import { confirmCheckIconSvg, confirmCloseIconSvg } from "@/svg/templates";

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
}

class ConfirmManager {
  show(message: string, options: ConfirmOptions = {}): Promise<boolean> {
    return new Promise((resolve) => {
      const root = document.documentElement;
      const designerRoot = document.querySelector("[data-designer-root]") as HTMLElement | null;
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
      overlay.style.zIndex = "10001"; // above header and floating panels/masks
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.pointerEvents = "auto";

      const isDark =
        designerRoot?.classList.contains("dark") ||
        root.classList.contains("dark") ||
        document.body.classList.contains("dark") ||
        root.getAttribute("theme-mode") === "dark" ||
        document.body.getAttribute("theme-mode") === "dark";

      const dialog = document.createElement("div");
      dialog.style.backgroundColor = isDark ? "#111827" : "#ffffff"; // dark:bg-gray-900 / bg-white
      dialog.style.borderRadius = "0.5rem"; // rounded-lg
      dialog.style.width = "24rem"; // w-96 (384px)
      dialog.style.border = `1px solid ${isDark ? "#374151" : "#e5e7eb"}`;
      dialog.style.maxHeight = "90vh";
      dialog.style.boxShadow =
        "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"; // shadow-xl
      dialog.style.display = "flex";
      dialog.style.flexDirection = "column";
      dialog.style.overflow = "hidden";
      dialog.style.fontFamily = "inherit";

      // Header (matches Modal header height and border)
      const header = document.createElement("div");
      header.style.height = "52px";
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.justifyContent = "space-between";
      header.style.padding = "0 12px";
      header.style.borderBottom = `1px solid ${isDark ? "#1f2937" : "#e5e7eb"}`; // dark:border-gray-800 / border-gray-200
      header.style.flexShrink = "0";

      const titleEl = document.createElement("h3");
      titleEl.textContent = options.title || "提示";
      titleEl.style.margin = "0";
      titleEl.style.fontSize = "1rem"; // text-base
      titleEl.style.fontWeight = "600"; // font-semibold
      titleEl.style.color = isDark ? "#f3f4f6" : "#1f2937"; // dark:text-gray-100 / text-gray-800
      header.appendChild(titleEl);

      const headerCloseBtn = document.createElement("button");
      headerCloseBtn.type = "button";
      headerCloseBtn.innerHTML = confirmCloseIconSvg;
      headerCloseBtn.setAttribute("aria-label", "关闭");
      headerCloseBtn.style.display = "inline-flex";
      headerCloseBtn.style.alignItems = "center";
      headerCloseBtn.style.justifyContent = "center";
      headerCloseBtn.style.width = "28px";
      headerCloseBtn.style.height = "28px";
      headerCloseBtn.style.border = "none";
      headerCloseBtn.style.borderRadius = "9999px";
      headerCloseBtn.style.backgroundColor = "transparent";
      headerCloseBtn.style.color = isDark ? "#9ca3af" : "#6b7280";
      headerCloseBtn.style.cursor = "pointer";
      headerCloseBtn.style.transition = "background-color 0.15s ease, color 0.15s ease";
      headerCloseBtn.onmouseover = () => {
        headerCloseBtn.style.backgroundColor = isDark ? "#1f2937" : "#f3f4f6";
        headerCloseBtn.style.color = isDark ? "#f3f4f6" : "#374151";
      };
      headerCloseBtn.onmouseout = () => {
        headerCloseBtn.style.backgroundColor = "transparent";
        headerCloseBtn.style.color = isDark ? "#9ca3af" : "#6b7280";
      };
      headerCloseBtn.onclick = (e) => {
        e.stopPropagation();
        cleanup();
        resolve(false);
      };
      header.appendChild(headerCloseBtn);
      dialog.appendChild(header);

      // Body
      const body = document.createElement("div");
      body.style.padding = "16px"; // p-4
      body.style.backgroundColor = isDark ? "#111827" : "#ffffff";
      body.style.flex = "1 1 auto";
      body.style.minHeight = "0";
      body.style.overflowY = "auto";

      const msgEl = document.createElement("div");
      msgEl.textContent = message;
      msgEl.style.marginBottom = "16px"; // mb-4
      msgEl.style.fontSize = "0.875rem"; // text-sm
      msgEl.style.color = isDark ? "#d1d5db" : "#374151"; // dark:text-gray-300 / text-gray-700
      msgEl.style.lineHeight = "1.5";
      body.appendChild(msgEl);

      // Footer
      const footer = document.createElement("div");
      footer.style.display = "flex";
      footer.style.justifyContent = "flex-end";
      footer.style.gap = "8px"; // gap-2
      footer.style.height = "52px";
      footer.style.padding = "0 12px";
      footer.style.alignItems = "center";
      footer.style.borderTop = `1px solid ${isDark ? "#1f2937" : "#e5e7eb"}`;
      footer.style.backgroundColor = isDark ? "#111827" : "#f9fafb";
      footer.style.flexShrink = "0";
      footer.style.marginTop = "auto";

      // Cancel Button
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.style.display = "inline-flex";
      cancelBtn.style.alignItems = "center";
      cancelBtn.style.gap = "6px";
      cancelBtn.style.whiteSpace = "nowrap";
      cancelBtn.innerHTML = `
        ${confirmCloseIconSvg}
        <span>${options.cancelText || "取消"}</span>
      `;
      cancelBtn.style.padding = "6px 12px";
      cancelBtn.style.fontSize = "0.75rem";
      cancelBtn.style.border = `1px solid ${isDark ? "#4b5563" : "#d1d5db"}`;
      cancelBtn.style.borderRadius = "0.25rem";
      cancelBtn.style.cursor = "pointer";
      cancelBtn.style.transition = "background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease";
      cancelBtn.style.backgroundColor = "transparent";
      cancelBtn.style.color = isDark ? "#d1d5db" : "#374151";

      cancelBtn.onmouseover = () => {
        cancelBtn.style.backgroundColor = isDark ? "#374151" : "#f3f4f6";
      };
      cancelBtn.onmouseout = () => {
        cancelBtn.style.backgroundColor = "transparent";
      };

      // Confirm Button
      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.style.display = "inline-flex";
      confirmBtn.style.alignItems = "center";
      confirmBtn.style.gap = "6px";
      confirmBtn.innerHTML = `
        ${confirmCheckIconSvg}
        <span>${options.confirmText || "确定"}</span>
      `;
      confirmBtn.style.padding = "6px 12px";
      confirmBtn.style.fontSize = "0.8125rem";
      confirmBtn.style.fontWeight = "500";
      confirmBtn.style.border = "none";
      confirmBtn.style.borderRadius = "0.375rem";
      confirmBtn.style.cursor = "pointer";
      confirmBtn.style.transition = "background-color 0.15s ease";
      confirmBtn.style.backgroundColor = isDark ? "#3b82f6" : "#2563eb";
      confirmBtn.style.color = "#ffffff";

      confirmBtn.onmouseover = () => {
        confirmBtn.style.backgroundColor = isDark ? "#2563eb" : "#1d4ed8";
      };
      confirmBtn.onmouseout = () => {
        confirmBtn.style.backgroundColor = isDark ? "#3b82f6" : "#2563eb";
      };

      const cleanup = () => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
      };

      cancelBtn.onclick = (e) => {
        e.stopPropagation();
        cleanup();
        resolve(false);
      };

      confirmBtn.onclick = (e) => {
        e.stopPropagation();
        cleanup();
        resolve(true);
      };

      footer.appendChild(cancelBtn);
      footer.appendChild(confirmBtn);
      body.appendChild(msgEl);
      dialog.appendChild(body);
      dialog.appendChild(footer);
      overlay.appendChild(dialog);
      (designerRoot?.closest("body") || document.body).appendChild(overlay);

      overlay.onmousedown = (event) => {
        if (event.target === overlay) {
          cleanup();
          resolve(false);
        }
      };

      // Focus confirm button by default for quick keyboard submission
      setTimeout(() => confirmBtn.focus(), 10);
    });
  }
}

export const uiConfirm = new ConfirmManager();

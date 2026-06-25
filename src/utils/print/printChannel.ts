import {
  usePrintSettings,
  type PrintMode,
  type PrintOptions,
} from "@/composables/usePrintSettings";
import { appendClientHost } from "@/utils/clientHost";
import { toast } from "@/utils/toast";
import i18n from "@/locales";

type RefLike<T> = { value: T };

type PrintRequest = {
  mode?: PrintMode;
  options?: PrintOptions;
};

type PrintProgress = {
  phase: string;
  current: number;
  total: number;
  message: string;
};

type PrintExecutorDeps = {
  printMode: RefLike<PrintMode | undefined>;
  silentPrint: RefLike<boolean | undefined>;
  localStatus: RefLike<string | undefined>;
  remoteStatus: RefLike<string | undefined>;
  localPrintOptions: PrintOptions;
  remotePrintOptions: PrintOptions;
  localSettings: { secretKey: string };
  localWsUrl: RefLike<string | undefined>;
  remoteSelectedClientId: RefLike<string | undefined>;
  fetchRemoteClients: () => Promise<any>;
  fetchRemotePrinters: (
    clientId: string,
  ) => Promise<Array<{ printer_name?: string }>>;
  submitRemoteTask: (
    payload: Record<string, any>,
    timeoutMs?: number,
  ) => Promise<any>;
  getPdfBlob: (content: HTMLElement | string | HTMLElement[]) => Promise<Blob>;
  browserPrint: (content: HTMLElement | string | HTMLElement[]) => Promise<any>;
  browserPrintBlob: (pdfBlob: Blob) => Promise<any>;
  reportProgress?: (progress: PrintProgress | null) => void;
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read PDF blob"));
    reader.readAsDataURL(blob);
  });

const buildPrintPayload = (
  options: PrintOptions,
  content: string,
  key?: string,
) => {
  const payload: Record<string, any> = {
    printer: options.printer,
    content,
  };

  if (key) payload.key = key;
  if (options.jobName || options.copies || options.intervalMs) {
    payload.job = {
      ...(options.jobName ? { name: options.jobName } : {}),
      ...(options.copies ? { copies: options.copies } : {}),
      ...(options.intervalMs ? { intervalMs: options.intervalMs } : {}),
    };
  }
  if (options.pageRange || options.pageSet) {
    payload.pages = {
      ...(options.pageRange ? { range: options.pageRange } : {}),
      ...(options.pageSet ? { set: options.pageSet } : {}),
    };
  }
  if (options.scale || options.orientation) {
    payload.layout = {
      ...(options.scale ? { scale: options.scale } : {}),
      ...(options.orientation ? { orientation: options.orientation } : {}),
    };
  }
  if (options.colorMode) {
    payload.color = { mode: options.colorMode };
  }
  if (options.sidesMode) {
    payload.sides = { mode: options.sidesMode };
  }
  if (options.paperSize) {
    payload.paper = { size: options.paperSize };
  }
  if (options.trayBin) {
    payload.tray = { bin: options.trayBin };
  }
  return payload;
};

export const createPrintExecutor = (deps: PrintExecutorDeps) => {
  let localSocket: WebSocket | null = null;
  let localSocketUrl = "";
  let localSocketPromise: Promise<WebSocket> | null = null;
  let localQueue: Promise<any> = Promise.resolve();

  const reportProgress = (progress: PrintProgress | null) => {
    deps.reportProgress?.(progress);
  };

  const resetLocalSocket = () => {
    if (localSocket && localSocket.readyState === WebSocket.OPEN) {
      localSocket.close();
    }
    localSocket = null;
    localSocketUrl = "";
    localSocketPromise = null;
  };

  const getLocalSocket = (url: string) => {
    if (
      localSocket &&
      localSocket.readyState === WebSocket.OPEN &&
      localSocketUrl === url
    ) {
      return Promise.resolve(localSocket);
    }
    if (localSocketPromise) return localSocketPromise;

    localSocketUrl = url;
    localSocketPromise = new Promise<WebSocket>((resolve, reject) => {
      const socket = new WebSocket(url);
      const handleOpen = () => {
        socket.removeEventListener("open", handleOpen);
        socket.removeEventListener("error", handleError);
        localSocket = socket;
        localSocketPromise = null;
        resolve(socket);
      };
      const handleError = () => {
        socket.removeEventListener("open", handleOpen);
        socket.removeEventListener("error", handleError);
        resetLocalSocket();
        reject(new Error("Print connection failed"));
      };
      socket.addEventListener("open", handleOpen);
      socket.addEventListener("error", handleError);
    });

    return localSocketPromise;
  };

  const sendLocalWsPrint = (
    url: string,
    payload: Record<string, any>,
    _waitFor: "status",
    timeoutMs: number = 30000,
  ) => {
    localQueue = localQueue
      .catch(() => undefined)
      .then(
        () =>
          new Promise<any>(async (resolve, reject) => {
            let resolved = false;
            let socket: WebSocket | null = null;
            const timeoutId = window.setTimeout(() => {
              if (resolved) return;
              resolved = true;
              resetLocalSocket();
              reject(new Error("Print request timeout"));
            }, timeoutMs);

            const cleanup = () => {
              if (!socket) return;
              socket.removeEventListener("message", handleMessage);
              socket.removeEventListener("error", handleError);
              socket.removeEventListener("close", handleClose);
            };

            const handleMessage = (event: MessageEvent) => {
              if (resolved) return;
              try {
                const msg = JSON.parse(event.data);
                if (
                  msg.status === "success" ||
                  msg.status === "error" ||
                  msg.status === "ok" ||
                  msg.type === "print_result"
                ) {
                  resolved = true;
                  window.clearTimeout(timeoutId);
                  cleanup();
                  if (
                    msg.status === "success" ||
                    msg.status === "ok" ||
                    (msg.type === "print_result" && msg.status !== "error")
                  ) {
                    resolve(msg);
                  } else {
                    reject(new Error(msg.message || "Print failed"));
                  }
                }
              } catch (error) {
                if (event.data === "success" || event.data === "ok") {
                  resolved = true;
                  window.clearTimeout(timeoutId);
                  cleanup();
                  resolve({ status: "success", message: event.data });
                } else {
                  resolved = true;
                  window.clearTimeout(timeoutId);
                  cleanup();
                  reject(
                    error instanceof Error ? error : new Error("Print failed"),
                  );
                }
              }
            };

            const handleError = () => {
              if (resolved) return;
              resolved = true;
              window.clearTimeout(timeoutId);
              cleanup();
              resetLocalSocket();
              reject(new Error("Print connection failed"));
            };

            const handleClose = () => {
              if (resolved) return;
              resolved = true;
              window.clearTimeout(timeoutId);
              cleanup();
              resetLocalSocket();
              reject(new Error("Print connection closed"));
            };

            try {
              socket = await getLocalSocket(url);
              socket.addEventListener("message", handleMessage);
              socket.addEventListener("error", handleError);
              socket.addEventListener("close", handleClose);
              socket.send(JSON.stringify(appendClientHost(payload)));
            } catch (error) {
              resolved = true;
              window.clearTimeout(timeoutId);
              cleanup();
              reject(
                error instanceof Error
                  ? error
                  : new Error("Print connection failed"),
              );
            }
          }),
      );

    return localQueue;
  };

  const executePrint = async (
    acquirePdfBlob: () => Promise<Blob>,
    doBrowserPrint: () => Promise<any>,
    request?: PrintRequest,
  ) => {
    const mode = request?.mode || deps.printMode.value;

    if (mode === "browser") {
      return await doBrowserPrint();
    }

    const connectionOk =
      mode === "local"
        ? deps.localStatus.value === "connected"
        : deps.remoteStatus.value === "connected";
    if (!connectionOk) {
      return await doBrowserPrint();
    }

    const options =
      request?.options ||
      (mode === "local" ? deps.localPrintOptions : deps.remotePrintOptions);
    const currentOptions = { ...options };

    if (mode === "remote" && deps.silentPrint.value) {
      if (!deps.remoteSelectedClientId.value) {
        await deps.fetchRemoteClients();
      }
      if (!currentOptions.printer && deps.remoteSelectedClientId.value) {
        const printers = await deps.fetchRemotePrinters(
          deps.remoteSelectedClientId.value,
        );
        const fallbackPrinter = printers[0]?.printer_name || "";
        if (fallbackPrinter) {
          currentOptions.printer = fallbackPrinter;
          deps.remotePrintOptions.printer = fallbackPrinter;
        }
      }
    }

    if (mode === "local" && deps.silentPrint.value && !currentOptions.printer) {
      const { fetchLocalPrinters } = usePrintSettings();
      const localPrinters = await fetchLocalPrinters();
      const fallbackPrinter =
        localPrinters.find((p) => p.isDefault)?.name ||
        localPrinters[0]?.name ||
        "";
      if (fallbackPrinter) {
        currentOptions.printer = fallbackPrinter;
        deps.localPrintOptions.printer = fallbackPrinter;
      }
    }

    if (!currentOptions.printer) {
      toast.error(i18n.global.t("toast.printerRequired"));
      throw new Error("Printer is required");
    }

    let renderTicker: number | null = null;
    let reachedComplete = false;

    try {
      let renderProgress = 8;
      reportProgress({
        phase: "print",
        current: 0,
        total: 100,
        message: i18n.global.t("statusBar.progress.preparing"),
      });
      reportProgress({
        phase: "print",
        current: renderProgress,
        total: 100,
        message: i18n.global.t("statusBar.progress.rendering"),
      });

      renderTicker = window.setInterval(() => {
        renderProgress = Math.min(62, renderProgress + 3);
        reportProgress({
          phase: "print",
          current: renderProgress,
          total: 100,
          message: i18n.global.t("statusBar.progress.rendering"),
        });
        if (renderProgress >= 62 && renderTicker !== null) {
          window.clearInterval(renderTicker);
          renderTicker = null;
        }
      }, 120);

      const pdfBlob = await acquirePdfBlob();
      if (renderTicker !== null) {
        window.clearInterval(renderTicker);
        renderTicker = null;
      }

      reportProgress({
        phase: "print",
        current: 72,
        total: 100,
        message: i18n.global.t("statusBar.progress.preparing"),
      });
      const dataUrl = await blobToDataUrl(pdfBlob);

      reportProgress({
        phase: "print",
        current: 88,
        total: 100,
        message: i18n.global.t("statusBar.progress.printing"),
      });

      if (mode === "local") {
        const payload = buildPrintPayload(
          currentOptions,
          dataUrl,
          deps.localSettings.secretKey.trim(),
        );
        const result = await sendLocalWsPrint(
          deps.localWsUrl.value as string,
          payload,
          "status",
          currentOptions.timeout || 30000,
        );
        reachedComplete = true;
        reportProgress({
          phase: "print",
          current: 100,
          total: 100,
          message: i18n.global.t("statusBar.progress.printing"),
        });
        return result;
      }

      if (!deps.remoteSelectedClientId.value) {
        toast.error(i18n.global.t("toast.clientRequired"));
        throw new Error("Client is required");
      }

      const payload = buildPrintPayload(currentOptions, dataUrl);
      payload.cmd = "submit_task";
      payload.client_id = deps.remoteSelectedClientId.value;
      const result = await deps.submitRemoteTask(
        payload,
        currentOptions.timeout || 30000,
      );
      reachedComplete = true;
      reportProgress({
        phase: "print",
        current: 100,
        total: 100,
        message: i18n.global.t("statusBar.progress.printing"),
      });
      return result;
    } catch (error) {
      console.error("Print failed", error);
      toast.error(i18n.global.t("toast.printFailed"));
      throw error;
    } finally {
      if (renderTicker !== null) {
        window.clearInterval(renderTicker);
      }
      if (reachedComplete) {
        await new Promise((resolve) => setTimeout(resolve, 180));
      }
      reportProgress(null);
    }
  };

  const print = (
    content: HTMLElement | string | HTMLElement[],
    request?: PrintRequest,
  ) =>
    executePrint(
      () => deps.getPdfBlob(content),
      () => deps.browserPrint(content),
      request,
    );

  // 用已构建好的 PDF（如批量套打合成的多页 PDF）直接走打印路由，跳过渲染。
  const printPdf = (pdfBlob: Blob, request?: PrintRequest) =>
    executePrint(
      () => Promise.resolve(pdfBlob),
      () => deps.browserPrintBlob(pdfBlob),
      request,
    );

  return { print, printPdf };
};

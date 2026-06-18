const getPrintDesignerVersion = () =>
  typeof __PRINT_DESIGNER_VERSION__ === "string" &&
  __PRINT_DESIGNER_VERSION__.trim()
    ? __PRINT_DESIGNER_VERSION__.trim()
    : "0.0.0";

const createNonce = () => {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const encodeBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return globalThis.btoa(binary);
};

export const buildClientHostToken = () => {
  const location = typeof window === "undefined" ? null : window.location;
  const hostname = location?.hostname || "";
  const domain = hostname;
  const timestamp = Date.now();

  return encodeBase64(
    JSON.stringify({
      source: "vue-print-designer",
      version: getPrintDesignerVersion(),
      protocolVersion: 1,
      domain,
      host: location?.host || "",
      hostname,
      port: location?.port || "",
      origin: location?.origin || "",
      protocol: location?.protocol.replace(/:$/, "") || "",
      timestamp,
      issuedAt: new Date(timestamp).toISOString(),
      nonce: createNonce(),
    }),
  );
};

export const appendClientHost = <T extends Record<string, any>>(payload: T) => {
  const { clientHost: _clientHost, ...rest } = payload;
  return {
    ...rest,
    clientHost: buildClientHostToken(),
  };
};
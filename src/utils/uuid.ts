/**
 * 生成 UUID v4，优先使用 crypto.randomUUID()（现代浏览器/Node.js 均支持）。
 * 降级方案使用 crypto.getRandomValues() 手动拼装，保证在旧环境也能正常工作。
 */
export const uuidv4 = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // 降级：用 getRandomValues 手动构造 RFC 4122 v4 UUID
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
};

/**
 * 极简 PDF 构建器
 * 将多张 JPEG 图片按 PDF 1.4 规范组装为二进制 PDF，无需任何外部依赖。
 *
 * 页面尺寸单位：毫米（mm）；JPEG 尺寸通过解析 SOF 标记自动读取。
 */

/** buildPdfFromJpegs 的返回值，提供 save/output 两个接口 */
export interface PdfDocument {
  /** 下载 PDF 文件到本地 */
  save(filename: string): void;
  /** 以 Blob 形式返回 PDF 内容（兼容原 jsPDF output("blob") 调用方式） */
  output(type: "blob"): Blob;
}

/**
 * 将一组 JPEG DataURL 合成为 PDF 文档。
 * @param jpegDataUrls - 每页截图的 JPEG DataURL 数组，按顺序排列
 * @param widthMm      - 页面物理宽度（毫米）
 * @param heightMm     - 页面物理高度（毫米）
 */
export const buildPdfFromJpegs = (
  jpegDataUrls: string[],
  widthMm: number,
  heightMm: number,
): PdfDocument => {
  const PT_PER_MM = 2.8346456692913385;
  const wPt = (widthMm * PT_PER_MM).toFixed(3);
  const hPt = (heightMm * PT_PER_MM).toFixed(3);
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let pos = 0;

  const wr = (data: string | Uint8Array) => {
    const b = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(b);
    pos += b.length;
  };

  // 解码 base64 并读取 JPEG SOF 标记中的像素尺寸
  const jpegs = jpegDataUrls.map((url) => {
    const b64 = url.slice(url.indexOf(",") + 1);
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) buf[k] = bin.charCodeAt(k);
    let imgW = 0,
      imgH = 0;
    let i = 2; // 跳过 SOI (FF D8)
    while (i < buf.length - 3) {
      if (buf[i] !== 0xff) break;
      const mk = buf[i + 1];
      i += 2;
      if (mk === 0xd9) break; // EOI
      if (mk >= 0xd0 && mk <= 0xd7) continue; // RST（无长度字段）
      const segLen = (buf[i] << 8) | buf[i + 1];
      // SOF 标记：C0-C3, C5-C7, C9-CB, CD-CF（排除 C4/C8/CC）
      if (mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc && mk >= 0xc0 && mk <= 0xcf) {
        imgH = (buf[i + 3] << 8) | buf[i + 4];
        imgW = (buf[i + 5] << 8) | buf[i + 6];
        break;
      }
      i += segLen;
    }
    return { buf, imgW, imgH };
  });

  const n = jpegs.length;
  // 对象编号：1=Catalog, 2=Pages, 每页：3+3i=ImageXObject, 4+3i=ContentStream, 5+3i=Page
  const totalObjs = 3 + n * 3;
  const offsets: number[] = new Array(totalObjs).fill(0);

  wr("%PDF-1.4\n");
  wr(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // %âãÏÓ\n 二进制标记

  offsets[1] = pos;
  wr(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  offsets[2] = pos;
  const kids = Array.from({ length: n }, (_, i) => `${5 + i * 3} 0 R`).join(" ");
  wr(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${n} >>\nendobj\n`);

  for (let i = 0; i < n; i++) {
    const imgN = 3 + i * 3;
    const conN = 4 + i * 3;
    const pgN = 5 + i * 3;
    const { buf: jpg, imgW, imgH } = jpegs[i];

    offsets[imgN] = pos;
    wr(
      `${imgN} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH}` +
        ` /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`,
    );
    wr(jpg);
    wr(`\nendstream\nendobj\n`);

    const cs = enc.encode(`q ${wPt} 0 0 ${hPt} 0 0 cm /Im Do Q\n`);
    offsets[conN] = pos;
    wr(`${conN} 0 obj\n<< /Length ${cs.length} >>\nstream\n`);
    wr(cs);
    wr(`\nendstream\nendobj\n`);

    offsets[pgN] = pos;
    wr(
      `${pgN} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}]` +
        ` /Contents ${conN} 0 R /Resources << /XObject << /Im ${imgN} 0 R >> >> >>\nendobj\n`,
    );
  }

  const xrefPos = pos;
  wr(`xref\n0 ${totalObjs}\n`);
  wr(`0000000000 65535 f\r\n`);
  for (let i = 1; i < totalObjs; i++) {
    wr(`${String(offsets[i]).padStart(10, "0")} 00000 n\r\n`);
  }
  wr(`trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  const blob = new Blob(chunks, { type: "application/pdf" });

  return {
    save(filename: string) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    },
    output(_type: "blob"): Blob {
      return blob;
    },
  };
};

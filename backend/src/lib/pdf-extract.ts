import { inflateRawSync, inflateSync } from "zlib";

/**
 * Minimal, dependency-free PDF text extraction.
 *
 * Works on text-based PDFs (the kind produced by billing/ERP software,
 * commonly FlateDecode and/or ASCII85Decode filtered content streams).
 * Scanned/image PDFs yield little or no text and are reported as low
 * confidence so the UI can ask the user to review.
 */

const tryInflate = (buf: Buffer): Buffer => {
  try {
    return inflateSync(Buffer.from(buf));
  } catch {
    return inflateRawSync(Buffer.from(buf));
  }
};

/** PDF ASCII85 (Base85) decoder. Encoded streams end with an optional ~>. */
function ascii85Decode(data: Buffer): Buffer | null {
  let s = data.toString("latin1");
  const end = s.indexOf("~>");
  if (end !== -1) s = s.slice(0, end);
  s = s.replace(/[\s\r\n\t]/g, "");

  const bytes: number[] = [];
  let tuple = 0;
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "z") {
      if (count > 0) return null; // 'z' may not appear mid-tuple
      bytes.push(0, 0, 0, 0);
      continue;
    }
    const code = ch.charCodeAt(0) - 33; // alphabet spans 0x21 '!' .. 0x75 'u'
    if (code < 0 || code > 84) return null;
    tuple = tuple * 85 + code;
    count++;
    if (count === 5) {
      bytes.push((tuple >>> 24) & 0xff, (tuple >>> 16) & 0xff, (tuple >>> 8) & 0xff, tuple & 0xff);
      tuple = 0;
      count = 0;
    }
  }
  if (count === 1) return null; // a lone final char is invalid
  if (count > 1) {
    for (let i = count; i < 5; i++) tuple = tuple * 85 + 84;
    const n = count - 1; // final group yields n bytes
    const partial = [(tuple >>> 24) & 0xff, (tuple >>> 16) & 0xff, (tuple >>> 8) & 0xff];
    bytes.push(...partial.slice(0, n));
  }
  return Buffer.from(bytes);
}

/** PDF ASCIIHex (<....> or bare hex) decoder. */
function asciiHexDecode(data: Buffer): Buffer {
  const s = data.toString("latin1").replace(/\s+/g, "");
  const clean = s.includes(">") ? s.slice(0, s.indexOf(">")) : s;
  const bytes: number[] = [];
  for (let i = 0; i + 1 < clean.length; i += 2) {
    const byte = parseInt(clean.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) break;
    bytes.push(byte);
  }
  return Buffer.from(bytes);
}

/** Pull stream filter names out of a stream dictionary. */
function filtersFromDict(dict: string): string[] {
  const m = dict.match(/\/Filter\s*(\[)?\s*([^\]]*)\s*\]?/);
  const names = (m?.[2] ?? "").match(/\/[A-Za-z0-9]+/g) ?? [];
  return names.map((n) => n.slice(1));
}

function decodeStream(data: Buffer, dict: string): string | null {
  let body = data;
  // skip the /Length line and 'stream' keyword when the whole object is passed
  const streamIdx = body.indexOf("stream");
  if (streamIdx !== -1) {
    let start = streamIdx + 6;
    if (body[start] === 0x0d || body[start] === 0x0a) start += body[start] === 0x0d && body[start + 1] === 0x0a ? 2 : 1;
    const endIdx = body.indexOf("endstream", start);
    if (endIdx !== -1) body = body.subarray(start, endIdx);
  }

  // Embedded files (C2PA content-authenticity manifests, attachments) and
  // image XObjects are binary, never page text — reject them up front.
  if (/\/Type\s*\/EmbeddedFile|\/Subtype\s*\/Image/.test(dict)) return null;

  const filters = filtersFromDict(dict);
  if (filters.length === 0) {
    // Plain/uncompressed content stream (lenient: decode ops may still parse)
    return body.toString("latin1");
  }

  try {
    // /Filter lists the OUTERMOST filter first (ReportLab writes
    // [/ASCII85Decode /FlateDecode] with ASCII85 outermost), so the decoder
    // unwinds them in the same order they are listed.
    for (const f of filters) {
      if (f === "FlateDecode" || f === "Fl") {
        body = tryInflate(body);
      } else if (f === "ASCII85Decode" || f === "A85") {
        const d = ascii85Decode(body);
        if (d == null) return null;
        body = d;
      } else if (f === "ASCIIHexDecode" || f === "AHx") {
        body = asciiHexDecode(body);
      } else {
        return null; // unsupported filter -> cannot trust the text
      }
    }
    return body.toString("latin1");
  } catch {
    return null;
  }
}

function extractTextFromContent(content: string): string {
  let out = "";
  let textTokens: string[] = [];
  let hasAny = false;

  const emit = () => {
    if (textTokens.length === 0) return;
    hasAny = true;
    out += textTokens.join(" ") + "\n";
    textTokens = [];
  };

  let i = 0;
  const n = content.length;

  while (i < n) {
    const ch = content[i];

    if (ch === "(") {
      // Balanced parenthesized string
      let depth = 1;
      let s = "";
      i++;
      while (i < n && depth > 0) {
        const c = content[i];
        if (c === "\\") {
          const next = content[i + 1];
          if (next === "n") s += "\n";
          else if (next === "r") s += "\r";
          else if (next === "t") s += "\t";
          else if (next === "\\" || next === "(" || next === ")") s += next;
          else if (/[0-7]/.test(next ?? "")) {
            const octal = content.slice(i + 1, i + 4).match(/^([0-7]{1,3})/)?.[1] ?? "0";
            s += String.fromCharCode(parseInt(octal, 8));
            i += octal.length;
          }
          i += 2;
          continue;
        }
        if (c === "(") depth++;
        else if (c === ")") {
          depth--;
          if (depth === 0) break;
        }
        s += c;
        i++;
      }
      textTokens.push(s.trim() ? s : " ");
      i++;
      continue;
    }

    if (ch === "<") {
      // Hex string <....> (in content streams, these are usually text in hex)
      const end = content.indexOf(">", i);
      if (end === -1) {
        i++;
        continue;
      }
      const hex = content.slice(i + 1, end).replace(/\s+/g, "");
      if (/^[0-9a-fA-F]+$/.test(hex)) {
        let s = "";
        for (let j = 0; j + 1 < hex.length; j += 2) {
          s += String.fromCharCode(parseInt(hex.slice(j, j + 2), 16));
        }
        textTokens.push(s.trim() ? s : " ");
      }
      i = end + 1;
      continue;
    }

    if (ch === "[" && content.slice(i, i + 2) !== "[]") {
      i++;
      continue;
    }

    if (/[A-Za-z]/.test(ch)) {
      // Operator keyword (letters only)
      let j = i;
      while (j < n && /[A-Za-z]/.test(content[j])) j++;
      const op = content.slice(i, j);
      if (op === "Tj" || op === "'" || op === '"') emit();
      if (op === "TJ") {
        // collect array elements
        const close = content.indexOf("]", j);
        const arr = content.slice(j, close === -1 ? n : close);
        const arrText: string[] = [];
        let k = 0;
        while (k < arr.length) {
          if (arr[k] === "(") {
            let depth = 1;
            let s = "";
            k++;
            while (k < arr.length && depth > 0) {
              const c = arr[k];
              if (c === "\\") {
                const nex = arr[k + 1];
                if (nex === "n") s += "\n";
                else if (nex === "r") s += "\r";
                else if (nex === "t") s += "\t";
                else if (nex === "\\" || nex === "(" || nex === ")") s += nex;
                else if (/[0-7]/.test(nex ?? "")) {
                  const octal = arr.slice(k + 1, k + 4).match(/^([0-7]{1,3})/)?.[1] ?? "0";
                  s += String.fromCharCode(parseInt(octal, 8));
                  k += octal.length;
                }
                k += 2;
                continue;
              }
              if (c === "(") depth++;
              else if (c === ")") {
                depth--;
                if (depth === 0) break;
              }
              s += c;
              k++;
            }
            arrText.push(s.trim() ? s : " ");
            k++;
            continue;
          }
          k++;
        }
        emit();
        textTokens = arrText;
        emit();
        i = close === -1 ? n : close + 1;
        continue;
      }
      i = j;
      continue;
    }

    i++;
  }

  // flush trailing
  if (textTokens.length) {
    hasAny = true;
    out += textTokens.join(" ") + "\n";
  }

  if (!hasAny) return "";
  return out
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

export interface PdfExtraction {
  pages: number;
  text: string;
  lines: string[];
  confidence: "high" | "low";
}

export function extractPdfText(data: Buffer): PdfExtraction {
  const text = data.toString("latin1");
  const pageMatches = text.match(/\/Type\s*\/Page(?![s])/g);
  const pages = Math.max(1, pageMatches?.length ?? 1);

  const extracted: string[] = [];
  const streamRe = /<<([^>]*(?:>[^<]+)*?)\s*(?:\/Length\s+\d+\s*)?stream\r?\n/g;

  let match: RegExpExecArray | null;
  let ok = false;
  while ((match = streamRe.exec(text)) !== null) {
    const dict = match[1];
    const start = match.index + match[0].length;
    const endStreamIdx = text.indexOf("endstream", start);
    if (endStreamIdx === -1) continue;
    const body = data.subarray(start, endStreamIdx);
    const decoded = decodeStream(body, dict);
    if (decoded == null) continue;
    const contentText = extractTextFromContent(decoded);
    if (contentText) {
      ok = true;
      extracted.push(contentText);
    }
  }

  // Fallback for streams whose dictionary layout the regex above missed.
  if (!ok) {
    const allRe = /<<([^>]*(?:>[^<]+)*?)\s*(?:\/Length\s+\d+\s*)?stream\r?\n([\s\S]*?)endstream/g;
    while ((match = allRe.exec(text)) !== null) {
      const dict = match[1];
      const decoded = decodeStream(Buffer.from(match[2], "latin1"), dict);
      if (decoded == null) continue;
      const content = extractTextFromContent(decoded);
      if (content) {
        ok = true;
        extracted.push(content);
      }
    }
  }

  const joined = extracted.join("\n");
  const lines = joined.split("\n").filter((l) => l.trim().length > 0);

  const wordCount = joined.split(/\s+/).filter(Boolean).length;
  const confidence: "high" | "low" = wordCount >= 15 ? "high" : "low";

  return { pages, text: joined, lines, confidence };
}
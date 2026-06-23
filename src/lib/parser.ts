import { BindingRecord } from '../types';

const formatDateStr = (dateStr: string) => {
  if (dateStr === '未知时间') return dateStr;
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
};

const decodeQuotedPrintableUtf8 = (value: string) => {
  const bytes: number[] = [];
  const text = value.replace(/_/g, ' ');

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(text.slice(i + 1, i + 3))) {
      bytes.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(text.charCodeAt(i));
    }
  }

  return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
};

export const parseTextBlocks = (rawText: string) => {
  let text = rawText.replace(/=\r?\n/g, '');

  text = text.replace(/\r?\n[ \t]+/g, ' ');

  text = text.replace(/(\?=)\s+(=\?)/g, '$1$2');

  text = text.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (match, charset, encoding, data) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        const binStr = atob(data);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        return new TextDecoder(charset.toLowerCase() || 'utf-8').decode(bytes);
      }

      if (encoding.toUpperCase() === 'Q') {
        return decodeQuotedPrintableUtf8(data);
      }
    } catch {
      return match;
    }

    return match;
  });

  text = text.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return '=';
    }
  });

  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<[^>]*>?/gm, ' ');

  const bindings: Omit<BindingRecord, 'id'>[] = [];
  const newWelcomeEmails = new Set<string>();

  const dateMatch = text.match(/^(?:Date|Sent|发送时间|日期|时间)[^\S\n]*:[^\S\n]*(.+)$/im);
  let globalDate = '未知时间';
  if (dateMatch) {
    globalDate = formatDateStr(dateMatch[1].trim());
  }

  const welcomeRegex = /Welcome\s*to\s*Your\s*NFC\s*Google\s*Review/i;
  if (welcomeRegex.test(text)) {
    const toMatch =
      text.match(/^(?:To|收件人)[^\S\n]*:[^\S\n]*(.+)$/im) ||
      text.match(/To:\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);

    if (toMatch) {
      const emailMatch = toMatch[1].match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (emailMatch) {
        newWelcomeEmails.add(emailMatch[1].toLowerCase());
      }
    }
  }

  const sections = text.split(/Binding\s*Successful!?/i);
  if (sections.length > 1) {
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const accountMatch = section.match(/Account:\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);

      if (accountMatch) {
        let finalUrl = '-';
        let finalQr = '-';

        const urlLineMatch = section.match(/Target\s*URL:\s*([^\s]{20,})/i);
        if (urlLineMatch) {
          finalUrl = urlLineMatch[1].trim().replace(/&amp;/gi, '&');
        }

        const qrLineMatch = section.match(/QR\s*Code\s*ID:\s*([a-fA-F0-9-]{25,45})/i);
        if (qrLineMatch) {
          finalQr = qrLineMatch[1].trim();
        }

        bindings.push({
          account: accountMatch[1].trim().toLowerCase(),
          targetUrl: finalUrl,
          qrCodeId: finalQr,
          date: globalDate,
        });
      }
    }
  }

  return { bindings, newWelcomeEmails };
};

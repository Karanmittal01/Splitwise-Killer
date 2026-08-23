/**
 * A deliberately small vCard reader.
 *
 * Phones export contacts as .vcf, which is a line-based format from the 1990s.
 * We only need the name, the phone numbers and the email addresses, so this
 * skips everything else rather than pulling in a parser dependency.
 */

export type ParsedContact = {
  name: string;
  emails: string[];
  phones: string[];
};

/** Folded lines continue with a space or tab; join them before parsing. */
function unfold(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function decodeValue(rawKey: string, value: string): string {
  // Some exports quote-printable-encode anything non-ASCII. The escapes are
  // UTF-8 *bytes* ("José" is =C3=A9), so they have to be collected and decoded
  // together — one at a time gives you "JosÃ©".
  if (!/encoding=quoted-printable/i.test(rawKey)) return value;

  const bytes: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === "=" && /^[0-9A-F]{2}$/i.test(value.slice(i + 1, i + 3))) {
      bytes.push(Number.parseInt(value.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(value.charCodeAt(i));
    }
  }

  try {
    return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  } catch {
    return value;
  }
}

export function parseVCards(text: string): ParsedContact[] {
  const contacts: ParsedContact[] = [];
  let current: ParsedContact | null = null;
  let structuredName = "";

  for (const line of unfold(text)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const rawKey = line.slice(0, separator);
    const value = decodeValue(rawKey, line.slice(separator + 1).trim());
    const key = rawKey.split(";")[0].trim().toUpperCase().replace(/^ITEM\d+\./, "");

    if (key === "BEGIN" && value.toUpperCase() === "VCARD") {
      current = { name: "", emails: [], phones: [] };
      structuredName = "";
      continue;
    }
    if (!current) continue;

    if (key === "END") {
      const name = current.name || structuredName;
      if (current.emails.length > 0 || current.phones.length > 0) {
        contacts.push({ ...current, name: name || current.emails[0] || current.phones[0] });
      }
      current = null;
      continue;
    }

    if (key === "FN") current.name = value;
    // N is "Family;Given;Middle;Prefix;Suffix" — used when FN is missing.
    else if (key === "N" && !structuredName) {
      const [family = "", given = ""] = value.split(";");
      structuredName = [given, family].filter(Boolean).join(" ").trim();
    } else if (key === "EMAIL" && value) current.emails.push(value);
    else if (key === "TEL" && value) current.phones.push(value);
  }

  return contacts;
}

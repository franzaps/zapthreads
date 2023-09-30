export function getHex64(json: string, field: string): string {
  let len = field.length + 3;
  let idx = json.indexOf(`"${field}":`) + len;
  let s = json.slice(idx).indexOf(`"`) + idx + 1;
  return json.slice(s, s + 64);
}

export function getSubscriptionId(json: string): string | null {
  let idx = json.slice(0, 22).indexOf(`"EVENT"`);
  if (idx === -1) return null;

  let pstart = json.slice(idx + 7 + 1).indexOf(`"`);
  if (pstart === -1) return null;
  let start = idx + 7 + 1 + pstart;

  let pend = json.slice(start + 1, 80).indexOf(`"`);
  if (pend === -1) return null;
  let end = start + 1 + pend;

  return json.slice(start + 1, end);
}

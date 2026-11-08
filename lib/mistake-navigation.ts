export function mistakeAnchor(label: string) {
  return `problem-${Array.from(label.normalize("NFKC")).map((character) => character.codePointAt(0)!.toString(16)).join("-")}`;
}

export function mistakeReturnTarget(value: string | null) {
  if (!value || value.length > 1500) return null;
  return /^\/(fehlermuster|trades\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(#problem-[a-f0-9]+(?:-[a-f0-9]+)*)?$/.test(value) ? value : null;
}

export function mistakeEvidenceHref(href: string, label: string, tradeId?: string) {
  const returnTo = mistakeReturnTarget(`${tradeId ? `/trades/${tradeId}` : "/fehlermuster"}#${mistakeAnchor(label)}`) || "/fehlermuster";
  const url = new URL(href, "https://edgelog.invalid");
  url.searchParams.set("return_to", returnTo);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function revealMistakeAnchor(hash: string, root: Pick<Document, "getElementById"> = document) {
  if (!/^#problem-[a-f0-9]+(?:-[a-f0-9]+)*$/.test(hash)) return false;
  const item = root.getElementById(hash.slice(1));
  if (!item) return false;
  const evidence = item.querySelector("details");
  if (evidence) evidence.open = true;
  let parent = item.parentElement?.closest("details");
  while (parent) { parent.open = true; parent = parent.parentElement?.closest("details"); }
  item.scrollIntoView({ block: "start" });
  return true;
}

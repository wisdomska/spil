/**
 * Structured data for search engines and AI assistants (schema.org JSON-LD). A data block, not
 * a script that runs, so the page's script policy does not apply to it.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  // "<" escaped so a value can never close the tag early.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

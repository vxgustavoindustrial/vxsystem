import { supabase } from "./supabase";

const DOCUMENTS_BUCKET = "documents";
const PUBLIC_MARKER = `/storage/v1/object/public/${DOCUMENTS_BUCKET}/`;

function documentPath(urlOrPath: string) {
  const markerIndex = urlOrPath.indexOf(PUBLIC_MARKER);
  if (markerIndex >= 0) {
    return decodeURIComponent(urlOrPath.slice(markerIndex + PUBLIC_MARKER.length));
  }
  return urlOrPath;
}

function isExternalLink(urlOrPath: string) {
  return urlOrPath.startsWith("http") && !urlOrPath.includes(PUBLIC_MARKER);
}

export async function openDocumentFile(urlOrPath: string) {
  if (isExternalLink(urlOrPath)) {
    window.open(urlOrPath, "_blank", "noopener,noreferrer");
    return;
  }

  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(documentPath(urlOrPath), 60 * 60);

  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

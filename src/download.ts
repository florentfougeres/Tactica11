// Saving a generated file (PNG, MP4, .json). In the browser this is a plain
// download; in the macOS app (Tauri) anchor downloads aren't reliable in the
// system webview, so we ask for a path with the native "Enregistrer sous"
// dialog and write the bytes ourselves. Returns false if the user cancelled.
export const isDesktopApp = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function saveFile(blob: Blob, filename: string): Promise<boolean> {
  if (isDesktopApp()) {
    const [{ save }, { writeFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".") + 1) : "";
    const path = await save({
      defaultPath: filename,
      filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : undefined,
    });
    if (!path) return false;
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return true;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

// Desktop shell for Tactica11: the web app as-is, plus the dialog / fs
// plugins so exports (PNG, MP4, .json) can be saved through a native
// "Enregistrer sous" dialog — anchor downloads aren't reliable in WKWebView.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running Tactica11");
}

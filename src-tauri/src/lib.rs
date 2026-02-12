use tauri::{Emitter, Manager, menu::{Menu, MenuItem, Submenu, PredefinedMenuItem}};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Build the menu
      let menu = build_menu(app)?;
      app.set_menu(menu)?;

      // Handle menu events
      app.on_menu_event(move |app, event| {
        handle_menu_event(app, event);
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/// Build the application menu
fn build_menu(app: &tauri::App) -> Result<Menu<tauri::Wry>, tauri::Error> {
  // File menu
  let new_item = MenuItem::with_id(app, "new", "New", true, None::<&str>)?;
  let open_item = MenuItem::with_id(app, "open", "Open...", true, Some("CmdOrCtrl+O"))?;
  let save_item = MenuItem::with_id(app, "save", "Save As...", true, Some("CmdOrCtrl+S"))?;
  let export_png_item = MenuItem::with_id(app, "export_png", "Export PNG...", true, None::<&str>)?;
  let export_svg_item = MenuItem::with_id(app, "export_svg", "Export SVG...", true, None::<&str>)?;

  let file_menu = Submenu::with_items(
    app,
    "File",
    true,
    &[
      &new_item,
      &open_item,
      &save_item,
      &PredefinedMenuItem::separator(app)?,
      &export_png_item,
      &export_svg_item,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::quit(app, Some("Quit"))?,
    ],
  )?;

  // Edit menu
  let undo_item = MenuItem::with_id(app, "undo", "Undo", true, Some("CmdOrCtrl+Z"))?;
  let redo_item = MenuItem::with_id(app, "redo", "Redo", true, Some("CmdOrCtrl+Shift+Z"))?;
  let cut_item = MenuItem::with_id(app, "cut", "Cut", true, Some("CmdOrCtrl+X"))?;
  let copy_item = MenuItem::with_id(app, "copy", "Copy", true, Some("CmdOrCtrl+C"))?;
  let paste_item = MenuItem::with_id(app, "paste", "Paste", true, Some("CmdOrCtrl+V"))?;
  let delete_item = MenuItem::with_id(app, "delete", "Delete", true, Some("Backspace"))?;

  let edit_menu = Submenu::with_items(
    app,
    "Edit",
    true,
    &[
      &undo_item,
      &redo_item,
      &PredefinedMenuItem::separator(app)?,
      &cut_item,
      &copy_item,
      &paste_item,
      &delete_item,
    ],
  )?;

  // View menu
  let zoom_in_item = MenuItem::with_id(app, "zoom_in", "Zoom In", true, Some("CmdOrCtrl+="))?;
  let zoom_out_item = MenuItem::with_id(app, "zoom_out", "Zoom Out", true, Some("CmdOrCtrl+-"))?;
  let zoom_reset_item = MenuItem::with_id(app, "zoom_reset", "Reset Zoom", true, Some("CmdOrCtrl+0"))?;

  let view_menu = Submenu::with_items(
    app,
    "View",
    true,
    &[
      &zoom_in_item,
      &zoom_out_item,
      &zoom_reset_item,
    ],
  )?;

  // Build the main menu
  let menu = Menu::with_items(
    app,
    &[
      &file_menu,
      &edit_menu,
      &view_menu,
    ],
  )?;

  Ok(menu)
}

/// Handle menu events
fn handle_menu_event(app: &tauri::AppHandle, event: tauri::menu::MenuEvent) {
  let window = app.get_webview_window("main");

  if let Some(window) = window {
    match event.id().as_ref() {
      "new" => {
        let _ = window.emit("menu-new", ());
      }
      "open" => {
        let _ = window.emit("menu-open", ());
      }
      "save" => {
        let _ = window.emit("menu-save", ());
      }
      "export_png" => {
        let _ = window.emit("menu-export-png", ());
      }
      "export_svg" => {
        let _ = window.emit("menu-export-svg", ());
      }
      "undo" => {
        let _ = window.emit("menu-undo", ());
      }
      "redo" => {
        let _ = window.emit("menu-redo", ());
      }
      "cut" => {
        let _ = window.emit("menu-cut", ());
      }
      "copy" => {
        let _ = window.emit("menu-copy", ());
      }
      "paste" => {
        let _ = window.emit("menu-paste", ());
      }
      "delete" => {
        let _ = window.emit("menu-delete", ());
      }
      "zoom_in" => {
        let _ = window.emit("menu-zoom-in", ());
      }
      "zoom_out" => {
        let _ = window.emit("menu-zoom-out", ());
      }
      "zoom_reset" => {
        let _ = window.emit("menu-zoom-reset", ());
      }
      _ => {}
    }
  }
}

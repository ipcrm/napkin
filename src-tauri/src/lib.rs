#![recursion_limit = "256"]
use tauri::{Emitter, Manager, menu::{AboutMetadata, Menu, MenuItem, Submenu, PredefinedMenuItem}};

mod api;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![
      api::api_response,
      api::start_api_server,
      api::stop_api_server,
      api::get_api_status,
    ])
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

      // Create and manage API state
      let api_state = api::create_api_state(app.handle().clone());
      app.manage(api_state);

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/// Build the application menu
fn build_menu(app: &tauri::App) -> Result<Menu<tauri::Wry>, tauri::Error> {
  // App menu (macOS standard)
  let about_item = PredefinedMenuItem::about(
    app,
    Some("About Napkin"),
    Some(AboutMetadata {
      name: Some("Napkin".to_string()),
      version: Some(env!("CARGO_PKG_VERSION").to_string()),
      copyright: Some("Copyright (c) 2026 Napkin Contributors".to_string()),
      license: Some("MIT License".to_string()),
      website: Some("https://github.com/ipcrm/napkin".to_string()),
      ..Default::default()
    }),
  )?;
  let acknowledgments_item = MenuItem::with_id(app, "acknowledgments", "Acknowledgments...", true, None::<&str>)?;

  let app_menu = Submenu::with_items(
    app,
    "Napkin",
    true,
    &[
      &about_item,
      &acknowledgments_item,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::services(app, Some("Services"))?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::hide(app, Some("Hide Napkin"))?,
      &PredefinedMenuItem::hide_others(app, Some("Hide Others"))?,
      &PredefinedMenuItem::show_all(app, Some("Show All"))?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::quit(app, Some("Quit Napkin"))?,
    ],
  )?;

  // File menu
  let new_item = MenuItem::with_id(app, "new", "New", true, None::<&str>)?;
  let open_item = MenuItem::with_id(app, "open", "Open...", true, Some("CmdOrCtrl+O"))?;
  let save_item = MenuItem::with_id(app, "save", "Save", true, Some("CmdOrCtrl+S"))?;
  let save_as_item = MenuItem::with_id(app, "save_as", "Save As...", true, Some("CmdOrCtrl+Shift+S"))?;
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
      &save_as_item,
      &PredefinedMenuItem::separator(app)?,
      &export_png_item,
      &export_svg_item,
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

  let presentation_item = MenuItem::with_id(app, "presentation_mode", "Presentation Mode", true, Some("CmdOrCtrl+Shift+P"))?;

  let view_menu = Submenu::with_items(
    app,
    "View",
    true,
    &[
      &zoom_in_item,
      &zoom_out_item,
      &zoom_reset_item,
      &PredefinedMenuItem::separator(app)?,
      &presentation_item,
    ],
  )?;

  // Build the main menu
  let menu = Menu::with_items(
    app,
    &[
      &app_menu,
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
      "save_as" => {
        let _ = window.emit("menu-save-as", ());
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
      "presentation_mode" => {
        let _ = window.emit("menu-presentation-mode", ());
      }
      "acknowledgments" => {
        let _ = window.emit("menu-acknowledgments", ());
      }
      _ => {}
    }
  }
}

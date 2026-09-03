#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]
mod emergency;
mod gui;
mod input;
mod protocol;
mod server;
mod session;
#[cfg(any(target_os = "macos", target_os = "linux"))]
mod unix_input;
#[cfg(windows)]
mod windows_input;
fn main() -> eframe::Result {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let origin = if args.len() == 2 && args[0] == "--origin" {
        args[1].clone()
    } else {
        "https://lens-webmcp.netlify.app".into()
    };
    let options = eframe::NativeOptions {
        viewport: eframe::egui::ViewportBuilder::default()
            .with_inner_size([610.0, 650.0])
            .with_min_inner_size([480.0, 520.0]),
        ..Default::default()
    };
    eframe::run_native(
        "Lens Bridge",
        options,
        Box::new(move |cc| {
            cc.egui_ctx.set_visuals(eframe::egui::Visuals::light());
            Ok(Box::new(gui::Companion::new(origin)))
        }),
    )
}

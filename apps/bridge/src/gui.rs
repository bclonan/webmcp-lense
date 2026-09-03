use crate::{
    emergency, input,
    server::{self, App},
};
use eframe::egui;
use std::{
    sync::{Arc, atomic::Ordering},
    thread,
    time::{Duration, Instant},
};
use tiny_http::Server;

pub struct Companion {
    origin: String,
    app: Option<Arc<App>>,
    worker: Option<thread::JoinHandle<()>>,
    emergency: Option<emergency::EmergencyStop>,
    error: String,
}
impl Companion {
    pub fn new(origin: String) -> Self {
        let mut result = Self {
            origin,
            app: None,
            worker: None,
            emergency: None,
            error: String::new(),
        };
        result.start();
        result
    }
    fn start(&mut self) {
        self.error.clear();
        if !server::valid_origin(&self.origin) {
            self.error = "Enter one exact HTTPS website address without a path, or an HTTP localhost origin.".into();
            return;
        }
        let result = (|| -> Result<(), String> {
            let input = input::create()?;
            let server = Server::http(server::ADDRESS).map_err(|_| "Cannot open local port 47653. Quit the other Lens Bridge window, then click Start bridge.")?;
            let app = Arc::new(App::new(self.origin.clone(), input));
            let stop_app = app.clone();
            let emergency = emergency::install(move || stop_app.revoke("Emergency stop pressed"))
                .map_err(|e| {
                format!(
                    "Cannot register Ctrl+Alt+F10: {e}. Close any other Lens Bridge and try again."
                )
            })?;
            app.log("Bridge ready. Waiting for browser pairing.".into());
            self.app = Some(app.clone());
            self.emergency = Some(emergency);
            self.worker = Some(thread::spawn(move || server::serve(server, app)));
            Ok(())
        })();
        if let Err(error) = result {
            self.error = error;
        }
    }
    fn shutdown(&mut self) {
        if let Some(app) = self.app.take() {
            app.revoke("Companion closing");
            app.quitting.store(true, Ordering::SeqCst);
            if let Some(worker) = self.worker.take() {
                let _ = worker.join();
            }
            // Cancellation releases held keys/buttons before process exit.
            drop(app.executing.lock().unwrap());
        }
        self.emergency = None;
    }
}
impl Drop for Companion {
    fn drop(&mut self) {
        self.shutdown();
    }
}
impl eframe::App for Companion {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        ctx.request_repaint_after(Duration::from_millis(250));
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.heading("Lens Bridge");
            ui.label(format!("Version {} | Protocol {}",server::BRIDGE_VERSION,server::VERSION));
            ui.add_space(10.0);
            ui.label("Native mouse and keyboard control stays on this computer.");
            ui.label("Only the website below can pair. Keep this window open.");
            ui.separator();
            ui.label("Allowed website");
            ui.add_enabled(self.app.is_none(),egui::TextEdit::singleline(&mut self.origin).desired_width(f32::INFINITY));
            if let Some(app) = self.app.clone() {
                let (paired,id,code,seconds) = {
                    let mut session = app.session.lock().unwrap();
                    if session.token.is_some() && session.expires <= Instant::now() {
                        session.token = None;
                        app.control.stop();
                        app.log("Session expired".into());
                    }
                    (session.token.is_some(),session.id.clone(),session.code.clone(),session.code_expires.saturating_duration_since(Instant::now()).as_secs())
                };
                let stopped = app.control.stopped.load(Ordering::SeqCst);
                ui.add_space(10.0);
                ui.heading(if stopped { "Control paused" } else if paired { "Browser connected" } else { "Waiting for pairing" });
                if paired {
                    ui.label(format!("Session {}", &id[..8]));
                    ui.label("Mouse, keyboard, scroll and display dimensions available.");
                } else if !code.is_empty() && seconds > 0 && !stopped {
                    ui.label("1. Open Desktop setup on the website.");
                    ui.label("2. Copy this code and enter it in Pairing code.");
                    ui.horizontal(|ui| {
                        ui.monospace(&code);
                        if ui.button("Copy code").clicked() { ctx.copy_text(code.clone()); }
                    });
                    ui.label(format!("Single use. Expires in {}:{:02}.",seconds/60,seconds%60));
                    ui.label("3. Choose a screen in your browser and confirm its monitor.");
                } else { ui.label("Click New pairing code, then pair again in the website."); }
                ui.add_space(8.0);
                ui.horizontal_wrapped(|ui| {
                    if ui.button("Pause control").clicked() { app.revoke("Paused by user. Pair again to resume."); }
                    if ui.button("Disconnect").clicked() { app.revoke("Disconnected by user"); }
                    if ui.button("Clear pairing").clicked() { app.revoke("Pairing cleared by user"); }
                    if ui.button("New pairing code").clicked() && let Err(error) = app.renew() { self.error = error; }
                });
                ui.label("Pause and disconnect revoke the session. A new code is required to resume.");
                ui.colored_label(egui::Color32::DARK_RED,"Emergency stop: Ctrl+Alt+F10");
                ui.separator();
                ui.label("Local action log, latest 200 events. Text and pairing secrets are excluded.");
                egui::ScrollArea::vertical().max_height(180.0).stick_to_bottom(true).show(ui, |ui| {
                    for entry in app.log.lock().unwrap().iter() { ui.small(entry); }
                });
                if ui.button("Change website").clicked() { self.shutdown(); }
            } else if ui.button("Start bridge").clicked() { self.start(); }
            if !self.error.is_empty() {
                ui.separator();
                ui.colored_label(egui::Color32::DARK_RED,&self.error);
                #[cfg(target_os="macos")]
                ui.label("System Settings > Privacy & Security > Accessibility: allow Lens Bridge. Quit and reopen it. Screen Recording belongs to your browser, which shares the screen.");
                #[cfg(target_os="linux")]
                ui.label("Desktop input requires an X11 session with XTest, RandR and libxkbcommon. Wayland desktop input is unavailable.");
            }
            ui.separator();
            if ui.button("Quit bridge").clicked() { self.shutdown(); ctx.send_viewport_cmd(egui::ViewportCommand::Close); }
        });
    }
}

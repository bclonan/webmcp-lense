use crate::{
    input::InputBackend,
    protocol::{Bounds, Button, Command, Display, Key, Point},
};
use enigo::{Axis, Coordinate, Direction, Enigo, Keyboard, Mouse, Settings};
use std::{sync::Mutex, thread, time::Duration};

pub struct UnixInput {
    driver: Mutex<Enigo>,
}

impl UnixInput {
    pub fn new() -> Result<Self, String> {
        #[cfg(target_os = "linux")]
        if std::env::var("XDG_SESSION_TYPE").is_ok_and(|s| s.eq_ignore_ascii_case("wayland"))
            || std::env::var_os("WAYLAND_DISPLAY").is_some()
        {
            return Err("Wayland is not supported yet. Log in to an X11 session. Lens will not use XWayland as unrestricted desktop control.".into());
        }
        let screens = displays()?;
        if screens.is_empty() {
            return Err(
                "No active desktop monitors found. Start Lens in your graphical login session."
                    .into(),
            );
        }
        let driver = Enigo::new(&Settings {
            open_prompt_to_get_permissions: false,
            ..Settings::default()
        }).map_err(|e| format!("{e}. On macOS, allow the terminal running Lens under System Settings > Privacy & Security > Accessibility, then restart the bridge. On Linux, use an X11 session with libxkbcommon installed."))?;
        Ok(Self {
            driver: Mutex::new(driver),
        })
    }
}

fn combo(key: Key) -> Result<Vec<enigo::Key>, String> {
    use enigo::Key as K;
    Ok(match key {
        Key::Win => vec![K::Meta],
        Key::Enter => vec![K::Return],
        Key::Esc => vec![K::Escape],
        Key::Tab => vec![K::Tab],
        Key::Backspace => vec![K::Backspace],
        Key::Delete => vec![K::Delete],
        Key::SelectAll => vec![K::Control, K::Unicode('a')],
        Key::Copy => vec![K::Control, K::Unicode('c')],
        Key::Paste => vec![K::Control, K::Unicode('v')],
        Key::Save => vec![K::Control, K::Unicode('s')],
        Key::Close => vec![K::Alt, K::F4],
        Key::Left => vec![K::LeftArrow],
        Key::Right => vec![K::RightArrow],
        Key::Up => vec![K::UpArrow],
        Key::Down => vec![K::DownArrow],
        Key::CommandSelectAll
        | Key::CommandCopy
        | Key::CommandPaste
        | Key::CommandSave
        | Key::CommandClose
        | Key::Spotlight => {
            if !cfg!(target_os = "macos") {
                return Err("CMD shortcuts require macOS. Use CTRL shortcuts on Linux.".into());
            }
            vec![
                K::Meta,
                match key {
                    Key::CommandSelectAll => K::Unicode('a'),
                    Key::CommandCopy => K::Unicode('c'),
                    Key::CommandPaste => K::Unicode('v'),
                    Key::CommandSave => K::Unicode('s'),
                    Key::CommandClose => K::Unicode('w'),
                    _ => K::Space,
                },
            ]
        }
    })
}

impl InputBackend for UnixInput {
    fn coordinate_space(&self) -> &'static str {
        if cfg!(target_os = "macos") {
            "logical-points"
        } else {
            "physical-pixels"
        }
    }
    fn displays(&self) -> Vec<Display> {
        displays().unwrap_or_default()
    }
    fn geometry(&self) -> Bounds {
        crate::protocol::display_bounds(&self.displays())
    }
    fn execute(
        &self,
        command: &Command,
        check: &dyn Fn() -> Result<(), String>,
    ) -> Result<(), String> {
        check()?;
        let screens = displays()?;
        if screens.is_empty() {
            return Err("No active displays. Input stopped.".into());
        }
        command.validate(crate::protocol::display_bounds(&screens))?;
        let mut driver = self.driver.lock().map_err(|_| "Input driver unavailable")?;
        let move_to = |driver: &mut Enigo, p: Point| {
            driver
                .move_mouse(p.x, p.y, Coordinate::Abs)
                .map_err(|e| e.to_string())
        };
        match command {
            Command::Move { point, .. } => move_to(&mut driver, *point),
            Command::Click { point, button, .. } => {
                move_to(&mut driver, *point)?;
                check()?;
                let button = match button {
                    Button::Left => enigo::Button::Left,
                    Button::Right => enigo::Button::Right,
                };
                let down = driver
                    .button(button, Direction::Press)
                    .map_err(|e| e.to_string());
                let up = driver
                    .button(button, Direction::Release)
                    .map_err(|e| e.to_string());
                down.and(up)
            }
            Command::Drag {
                points,
                duration_ms,
                ..
            } => {
                move_to(&mut driver, points[0])?;
                check()?;
                let run = (|| {
                    driver
                        .button(enigo::Button::Left, Direction::Press)
                        .map_err(|e| e.to_string())?;
                    let ticks = (duration_ms / 10).max(2);
                    for tick in 1..=ticks {
                        check()?;
                        let position = tick as f64 / ticks as f64 * (points.len() - 1) as f64;
                        let index = (position.floor() as usize).min(points.len() - 2);
                        let t = position - index as f64;
                        let (a, b) = (points[index], points[index + 1]);
                        move_to(
                            &mut driver,
                            Point {
                                x: (a.x as f64 + (b.x - a.x) as f64 * t).round() as i32,
                                y: (a.y as f64 + (b.y - a.y) as f64 * t).round() as i32,
                            },
                        )?;
                        thread::sleep(Duration::from_millis(10));
                    }
                    Ok(())
                })();
                let release = driver
                    .button(enigo::Button::Left, Direction::Release)
                    .map_err(|e| e.to_string());
                run.and(release)
            }
            Command::Text { text, .. } => {
                // Check cancellation between characters, without using the clipboard.
                for ch in text.chars() {
                    check()?;
                    driver
                        .text(ch.encode_utf8(&mut [0; 4]))
                        .map_err(|e| e.to_string())?;
                }
                Ok(())
            }
            Command::Key { key, .. } => {
                let keys = combo(*key)?;
                let mut pressed = Vec::new();
                let run = (|| {
                    for key in keys {
                        check()?;
                        // Also release a key whose press may have partially failed.
                        pressed.push(key);
                        driver
                            .key(key, Direction::Press)
                            .map_err(|e| e.to_string())?;
                    }
                    Ok(())
                })();
                let mut release = Ok(());
                for key in pressed.into_iter().rev() {
                    if let Err(e) = driver.key(key, Direction::Release) {
                        release = Err(e.to_string());
                    }
                }
                run.and(release)
            }
            Command::Scroll { delta, .. } => {
                // Lens uses Windows wheel units: +120 is one upward notch.
                let notches = ((*delta as f64) / 120.0).round() as i32;
                if *delta != 0 && notches == 0 {
                    return Err(
                        "Use scroll increments of at least 60 wheel units on macOS and Linux."
                            .into(),
                    );
                }
                driver
                    .scroll(-notches, Axis::Vertical)
                    .map_err(|e| e.to_string())
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn displays() -> Result<Vec<Display>, String> {
    use core_graphics::display::CGDisplay;
    let ids =
        CGDisplay::active_displays().map_err(|e| format!("Cannot read macOS displays: {e}"))?;
    Ok(ids
        .into_iter()
        .map(|id| {
            let display = CGDisplay::new(id);
            // CGEvent uses the same logical coordinate space as CGDisplayBounds.
            // Retina capture pixels are mapped to these bounds by the browser.
            let bounds = display.bounds();
            Display {
                id: id.to_string(),
                name: format!("Display {id}"),
                primary: display.is_main(),
                bounds: Bounds {
                    x: bounds.origin.x.round() as i32,
                    y: bounds.origin.y.round() as i32,
                    width: bounds.size.width.round() as i32,
                    height: bounds.size.height.round() as i32,
                },
            }
        })
        .collect())
}

#[cfg(target_os = "linux")]
fn displays() -> Result<Vec<Display>, String> {
    use x11rb::{connection::Connection, protocol::randr::ConnectionExt};
    let (connection, screen) =
        x11rb::connect(None).map_err(|e| format!("Cannot connect to X11: {e}"))?;
    let root = connection.setup().roots[screen].root;
    let monitors = connection
        .randr_get_monitors(root, true)
        .map_err(|e| e.to_string())?
        .reply()
        .map_err(|e| format!("X11 RandR 1.5 monitor discovery failed: {e}"))?;
    Ok(monitors
        .monitors
        .into_iter()
        .map(|m| Display {
            id: m.name.to_string(),
            name: format!("Monitor {}", m.name),
            primary: m.primary,
            bounds: Bounds {
                x: m.x.into(),
                y: m.y.into(),
                width: m.width.into(),
                height: m.height.into(),
            },
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shortcuts_preserve_control_and_command_as_distinct_modifiers() {
        assert_eq!(
            combo(Key::Copy).unwrap(),
            vec![enigo::Key::Control, enigo::Key::Unicode('c')]
        );
        if cfg!(target_os = "macos") {
            assert_eq!(
                combo(Key::Spotlight).unwrap(),
                vec![enigo::Key::Meta, enigo::Key::Space]
            );
        } else {
            assert!(combo(Key::Spotlight).is_err());
        }
    }
}

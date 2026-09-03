use crate::{
    input::InputBackend,
    protocol::{Bounds, Button, Command, Display, Key, Point},
};
use std::{mem::size_of, ptr::null_mut, thread, time::Duration};
use windows_sys::Win32::{
    Foundation::{LPARAM, RECT},
    Graphics::Gdi::*,
    System::StationsAndDesktops::*,
    UI::{HiDpi::*, Input::KeyboardAndMouse::*, WindowsAndMessaging::*},
};
pub struct WindowsInput;
impl WindowsInput {
    pub fn new() -> Self {
        unsafe {
            SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        }
        Self
    }
    fn send(input: INPUT) -> Result<(), String> {
        if unsafe { SendInput(1, &input, size_of::<INPUT>() as i32) } == 1 {
            Ok(())
        } else {
            Err("Windows refused input. Elevated or secure desktops are not supported.".into())
        }
    }
    fn mouse(flags: u32, dx: i32, dy: i32, data: u32) -> Result<(), String> {
        Self::send(INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dx,
                    dy,
                    mouseData: data,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        })
    }
    fn key(vk: u16, scan: u16, flags: u32) -> Result<(), String> {
        Self::send(INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk,
                    wScan: scan,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        })
    }
    fn move_to(&self, point: Point) -> Result<(), String> {
        let b = self.geometry();
        Self::mouse(
            MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK,
            ((point.x - b.x) as i64 * 65535 / (b.width - 1) as i64) as i32,
            ((point.y - b.y) as i64 * 65535 / (b.height - 1) as i64) as i32,
            0,
        )
    }
    fn ordinary_desktop() -> Result<(), String> {
        unsafe {
            let desktop = OpenInputDesktop(0, 0, DESKTOP_READOBJECTS);
            if desktop.is_null() {
                return Err("Input desktop is inaccessible.".into());
            }
            let mut buffer = [0u16; 256];
            let mut needed = 0;
            let ok = GetUserObjectInformationW(
                desktop,
                UOI_NAME,
                buffer.as_mut_ptr().cast(),
                (buffer.len() * 2) as u32,
                &mut needed,
            );
            CloseDesktop(desktop);
            if ok == 0 {
                return Err("Cannot verify the input desktop.".into());
            }
            let name = String::from_utf16_lossy(
                &buffer[..buffer.iter().position(|c| *c == 0).unwrap_or(buffer.len())],
            );
            if !name.eq_ignore_ascii_case("Default") {
                return Err("Secure or alternate desktops are not supported.".into());
            }
        }
        Ok(())
    }
    fn combo(key: Key) -> Result<Vec<u16>, String> {
        Ok(match key {
            Key::Win => vec![VK_LWIN],
            Key::Enter => vec![VK_RETURN],
            Key::Esc => vec![VK_ESCAPE],
            Key::Tab => vec![VK_TAB],
            Key::Backspace => vec![VK_BACK],
            Key::Delete => vec![VK_DELETE],
            Key::SelectAll => vec![VK_CONTROL, 0x41],
            Key::Copy => vec![VK_CONTROL, 0x43],
            Key::Paste => vec![VK_CONTROL, 0x56],
            Key::Save => vec![VK_CONTROL, 0x53],
            Key::Close => vec![VK_MENU, VK_F4],
            Key::Left => vec![VK_LEFT],
            Key::Right => vec![VK_RIGHT],
            Key::Up => vec![VK_UP],
            Key::Down => vec![VK_DOWN],
            Key::CommandSelectAll
            | Key::CommandCopy
            | Key::CommandPaste
            | Key::CommandSave
            | Key::CommandClose
            | Key::Spotlight => {
                return Err("CMD shortcuts require macOS. Use CTRL shortcuts on Windows.".into());
            }
        })
    }
}
impl InputBackend for WindowsInput {
    fn displays(&self) -> Vec<Display> {
        unsafe extern "system" fn collect(
            monitor: HMONITOR,
            _: HDC,
            _: *mut RECT,
            data: LPARAM,
        ) -> i32 {
            let displays = unsafe { &mut *(data as *mut Vec<Display>) };
            let mut info: MONITORINFOEXW = unsafe { std::mem::zeroed() };
            info.monitorInfo.cbSize = size_of::<MONITORINFOEXW>() as u32;
            if unsafe { GetMonitorInfoW(monitor, &mut info.monitorInfo) } != 0 {
                let r = info.monitorInfo.rcMonitor;
                let name = String::from_utf16_lossy(
                    &info.szDevice[..info
                        .szDevice
                        .iter()
                        .position(|c| *c == 0)
                        .unwrap_or(info.szDevice.len())],
                );
                displays.push(Display {
                    id: name.clone(),
                    name,
                    bounds: Bounds {
                        x: r.left,
                        y: r.top,
                        width: r.right - r.left,
                        height: r.bottom - r.top,
                    },
                    primary: info.monitorInfo.dwFlags & 1 != 0,
                });
            }
            1
        }
        let mut displays: Vec<Display> = Vec::new();
        unsafe {
            EnumDisplayMonitors(
                null_mut(),
                std::ptr::null(),
                Some(collect),
                &mut displays as *mut Vec<Display> as LPARAM,
            );
        }
        displays.sort_by_key(|d| (d.bounds.x, d.bounds.y));
        displays
    }
    fn geometry(&self) -> Bounds {
        unsafe {
            Bounds {
                x: GetSystemMetrics(SM_XVIRTUALSCREEN),
                y: GetSystemMetrics(SM_YVIRTUALSCREEN),
                width: GetSystemMetrics(SM_CXVIRTUALSCREEN),
                height: GetSystemMetrics(SM_CYVIRTUALSCREEN),
            }
        }
    }
    fn execute(
        &self,
        command: &Command,
        check: &dyn Fn() -> Result<(), String>,
    ) -> Result<(), String> {
        check()?;
        Self::ordinary_desktop()?;
        match command {
            Command::Move { point, .. } => self.move_to(*point),
            Command::Click { point, button, .. } => {
                self.move_to(*point)?;
                check()?;
                let (down, up) = match button {
                    Button::Left => (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
                    Button::Right => (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
                };
                Self::mouse(down, 0, 0, 0)?;
                Self::mouse(up, 0, 0, 0)
            }
            Command::Drag {
                points,
                duration_ms,
                ..
            } => {
                self.move_to(points[0])?;
                check()?;
                Self::mouse(MOUSEEVENTF_LEFTDOWN, 0, 0, 0)?;
                let run = (|| {
                    let ticks = (duration_ms / 10).max(2);
                    for tick in 1..=ticks {
                        check()?;
                        Self::ordinary_desktop()?;
                        let position = tick as f64 / ticks as f64 * (points.len() - 1) as f64;
                        let index = (position.floor() as usize).min(points.len() - 2);
                        let t = position - index as f64;
                        let a = points[index];
                        let b = points[index + 1];
                        self.move_to(Point {
                            x: (a.x as f64 + (b.x - a.x) as f64 * t).round() as i32,
                            y: (a.y as f64 + (b.y - a.y) as f64 * t).round() as i32,
                        })?;
                        thread::sleep(Duration::from_millis(10));
                    }
                    Ok(())
                })();
                let release = Self::mouse(MOUSEEVENTF_LEFTUP, 0, 0, 0);
                run.and(release)
            }
            Command::Text { text, .. } => {
                for unit in text.encode_utf16() {
                    check()?;
                    Self::ordinary_desktop()?;
                    Self::key(0, unit, KEYEVENTF_UNICODE)?;
                    Self::key(0, unit, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP)?;
                }
                Ok(())
            }
            Command::Key { key, .. } => {
                let keys = Self::combo(*key)?;
                let mut pressed = Vec::new();
                let run = (|| {
                    for key in &keys {
                        check()?;
                        Self::key(*key, 0, 0)?;
                        pressed.push(*key);
                    }
                    Ok(())
                })();
                let mut release = Ok(());
                for key in pressed.iter().rev() {
                    if let Err(e) = Self::key(*key, 0, KEYEVENTF_KEYUP) {
                        release = Err(e);
                    }
                }
                run.and(release)
            }
            Command::Scroll { delta, .. } => Self::mouse(MOUSEEVENTF_WHEEL, 0, 0, *delta as u32),
        }
    }
}

#[cfg(test)]
mod display_tests {
    use super::*;
    #[test]
    fn enumerates_physical_monitors_without_sending_input() {
        let input = WindowsInput::new();
        let bounds = input.geometry();
        let displays = input.displays();
        assert!(
            !displays.is_empty(),
            "An interactive Windows desktop should report a monitor"
        );
        assert!(displays.iter().any(|display| display.primary));
        for display in displays {
            assert!(!display.id.is_empty());
            assert!(display.bounds.width > 0 && display.bounds.height > 0);
            assert!(display.bounds.x >= bounds.x && display.bounds.y >= bounds.y);
            assert!(display.bounds.x + display.bounds.width <= bounds.x + bounds.width);
            assert!(display.bounds.y + display.bounds.height <= bounds.y + bounds.height);
        }
    }
}

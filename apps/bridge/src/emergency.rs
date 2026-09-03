// Keep the registration alive for the lifetime of the server.
pub struct EmergencyStop {
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    _manager: global_hotkey::GlobalHotKeyManager,
}

pub fn install(stop: impl Fn() + Send + Sync + 'static) -> Result<EmergencyStop, String> {
    #[cfg(windows)]
    {
        let (send, recv) = std::sync::mpsc::channel();
        crate::windows_input::hotkey_loop(stop, send);
        if recv.recv() != Ok(true) {
            return Err("shortcut unavailable".into());
        }
        Ok(EmergencyStop {})
    }
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        use global_hotkey::{
            GlobalHotKeyEvent, GlobalHotKeyManager, HotKeyState,
            hotkey::{Code, HotKey, Modifiers},
        };
        let manager = GlobalHotKeyManager::new().map_err(|e| e.to_string())?;
        let hotkey = HotKey::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::F10);
        manager.register(hotkey).map_err(|e| e.to_string())?;
        std::thread::spawn(move || {
            while let Ok(event) = GlobalHotKeyEvent::receiver().recv() {
                if event.id == hotkey.id() && event.state == HotKeyState::Pressed {
                    stop();
                }
            }
            // Losing the independent stop listener also stops desktop input.
            stop();
        });
        Ok(EmergencyStop { _manager: manager })
    }
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    {
        let _ = stop;
        Err("unsupported platform".into())
    }
}

#[cfg(target_os = "macos")]
impl EmergencyStop {
    pub fn run(self) {
        // Dispatch Carbon's hotkey events on the same main thread as registration.
        #[link(name = "Carbon", kind = "framework")]
        unsafe extern "C" {
            fn RunApplicationEventLoop();
        }
        unsafe {
            RunApplicationEventLoop();
        }
    }
}

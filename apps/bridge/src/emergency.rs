// Keep the registration alive for the lifetime of the server.
pub struct EmergencyStop {
    #[cfg(windows)]
    stop: std::sync::Arc<std::sync::atomic::AtomicBool>,
    #[cfg(windows)]
    worker: Option<std::thread::JoinHandle<()>>,
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    _manager: global_hotkey::GlobalHotKeyManager,
}

pub fn install(stop: impl Fn() + Send + Sync + 'static) -> Result<EmergencyStop, String> {
    #[cfg(windows)]
    {
        let (send, recv) = std::sync::mpsc::channel();
        let ending = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let stopped = ending.clone();
        let worker = std::thread::spawn(move || unsafe {
            use windows_sys::Win32::UI::{Input::KeyboardAndMouse::*, WindowsAndMessaging::*};
            let registered = RegisterHotKey(
                std::ptr::null_mut(),
                1,
                MOD_CONTROL | MOD_ALT | MOD_NOREPEAT,
                VK_F10 as u32,
            ) != 0;
            let _ = send.send(registered);
            if !registered {
                return;
            }
            let mut message: MSG = std::mem::zeroed();
            while !stopped.load(std::sync::atomic::Ordering::SeqCst) {
                while PeekMessageW(&mut message, std::ptr::null_mut(), 0, 0, PM_REMOVE) != 0 {
                    if message.message == WM_HOTKEY {
                        stop();
                    }
                }
                std::thread::sleep(std::time::Duration::from_millis(10));
            }
            UnregisterHotKey(std::ptr::null_mut(), 1);
        });
        if recv.recv() != Ok(true) {
            return Err("shortcut unavailable".into());
        }
        Ok(EmergencyStop {
            stop: ending,
            worker: Some(worker),
        })
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
        // One handler replaces the previous registration on restart. A receiver thread
        // per restart would let a stale listener consume another session's stop key.
        GlobalHotKeyEvent::set_event_handler(Some(move |event: GlobalHotKeyEvent| {
            if event.id == hotkey.id() && event.state == HotKeyState::Pressed {
                stop();
            }
        }));
        Ok(EmergencyStop { _manager: manager })
    }
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    {
        let _ = stop;
        Err("unsupported platform".into())
    }
}

#[cfg(windows)]
impl Drop for EmergencyStop {
    fn drop(&mut self) {
        self.stop.store(true, std::sync::atomic::Ordering::SeqCst);
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

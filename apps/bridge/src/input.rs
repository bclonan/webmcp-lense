use crate::protocol::{Bounds, Command, Display};
pub trait InputBackend: Send + Sync {
    fn platform(&self) -> &'static str {
        std::env::consts::OS
    }
    fn coordinate_space(&self) -> &'static str {
        "physical-pixels"
    }
    fn geometry(&self) -> Bounds;
    fn displays(&self) -> Vec<Display> {
        vec![]
    }
    fn execute(
        &self,
        command: &Command,
        check: &dyn Fn() -> Result<(), String>,
    ) -> Result<(), String>;
}
#[cfg(windows)]
pub use crate::windows_input::WindowsInput;

pub fn create() -> Result<Box<dyn InputBackend>, String> {
    #[cfg(windows)]
    return Ok(Box::new(WindowsInput::new()));
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    return Ok(Box::new(crate::unix_input::UnixInput::new()?));
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    Err("Lens supports Windows, macOS and Linux X11.".into())
}

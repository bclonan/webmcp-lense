use crate::protocol::{Bounds, Command};
pub trait InputBackend: Send + Sync {
    fn geometry(&self) -> Bounds;
    fn execute(
        &self,
        command: &Command,
        check: &dyn Fn() -> Result<(), String>,
    ) -> Result<(), String>;
}
#[cfg(windows)]
pub use crate::windows_input::WindowsInput;

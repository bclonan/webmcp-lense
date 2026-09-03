use std::{
    collections::HashSet,
    sync::atomic::{AtomicBool, AtomicU64, Ordering},
    time::{Duration, Instant},
};
pub fn random_secret(bytes: usize) -> String {
    let mut data = vec![0; bytes];
    getrandom::fill(&mut data).expect("OS randomness unavailable");
    data.iter().map(|b| format!("{b:02x}")).collect()
}
pub fn equal_secret(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.bytes()
        .zip(b.bytes())
        .fold(0u8, |diff, (a, b)| diff | (a ^ b))
        == 0
}
pub struct Control {
    pub stopped: AtomicBool,
    pub epoch: AtomicU64,
}
impl Control {
    pub fn new() -> Self {
        Self {
            stopped: AtomicBool::new(false),
            epoch: AtomicU64::new(0),
        }
    }
    pub fn stop(&self) {
        self.stopped.store(true, Ordering::SeqCst);
        self.epoch.fetch_add(1, Ordering::SeqCst);
    }
    pub fn check(&self, epoch: u64) -> Result<(), String> {
        if self.stopped.load(Ordering::SeqCst) || self.epoch.load(Ordering::SeqCst) != epoch {
            Err(
                "Emergency stop is active. Click New pairing code in Lens Bridge and pair again."
                    .into(),
            )
        } else {
            Ok(())
        }
    }
}
pub struct Session {
    pub id: String,
    pub code: String,
    pub code_expires: Instant,
    pub token: Option<String>,
    pub expires: Instant,
    pub attempts: u32,
    pub attempt_window: Instant,
    pub seen: HashSet<String>,
}
impl Session {
    pub fn new() -> Self {
        Self {
            id: random_secret(16),
            code: random_secret(16),
            code_expires: Instant::now() + Duration::from_secs(300),
            token: None,
            expires: Instant::now(),
            attempts: 0,
            attempt_window: Instant::now(),
            seen: HashSet::new(),
        }
    }
    pub fn pair(&mut self, code: &str) -> Result<String, String> {
        if self.attempt_window.elapsed() > Duration::from_secs(30) {
            self.attempts = 0;
            self.attempt_window = Instant::now();
        }
        self.attempts += 1;
        if self.attempts > 5 {
            return Err("Pairing rate limit. Wait 30 seconds.".into());
        }
        if self.code_expires <= Instant::now() {
            self.code.clear();
            return Err("Pairing code expired. Click New pairing code in Lens Bridge.".into());
        }
        if self.code.is_empty() || !equal_secret(&self.code, code) {
            return Err("Invalid or consumed pairing code.".into());
        }
        let token = random_secret(32);
        self.token = Some(token.clone());
        self.code.clear();
        self.expires = Instant::now() + Duration::from_secs(1800);
        self.seen.clear();
        Ok(token)
    }
    pub fn authorized(&self, header: &str) -> bool {
        self.expires > Instant::now()
            && self
                .token
                .as_ref()
                .is_some_and(|token| equal_secret(&format!("Bearer {token}"), header))
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pairing_is_one_time_and_expires() {
        let mut s = Session::new();
        let code = s.code.clone();
        let token = s.pair(&code).unwrap();
        assert!(s.pair(&code).is_err());
        assert!(s.authorized(&format!("Bearer {token}")));
        assert!(!s.authorized("Bearer wrong"));
        s.expires = Instant::now();
        assert!(!s.authorized(&format!("Bearer {token}")));
    }
    #[test]
    fn stop_invalidates_inflight_epoch() {
        let c = Control::new();
        assert!(c.check(0).is_ok());
        c.stop();
        assert!(c.check(0).is_err());
        c.stopped.store(false, Ordering::SeqCst);
        assert!(c.check(0).is_err());
        assert!(c.check(1).is_ok());
    }
    #[test]
    fn expired_pairing_code_cannot_authorize() {
        let mut s = Session::new();
        let code = s.code.clone();
        s.code_expires = Instant::now();
        assert!(s.pair(&code).unwrap_err().contains("expired"));
        assert!(s.token.is_none());
    }
}

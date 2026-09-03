use crate::{
    input::InputBackend,
    protocol,
    session::{Control, Session},
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::{
    collections::VecDeque,
    io::Read,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};
pub const ADDRESS: &str = "127.0.0.1:47653";
pub const VERSION: u32 = 1;
pub const BRIDGE_VERSION: &str = env!("CARGO_PKG_VERSION");
const MAX_BODY: usize = 16384;
pub const COMMANDS: [&str; 6] = [
    "pointer.move",
    "pointer.click",
    "pointer.drag",
    "keyboard.text",
    "keyboard.key",
    "scroll",
];
pub fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
pub struct App {
    pub origin: String,
    pub session: Mutex<Session>,
    pub control: Control,
    pub input: Box<dyn InputBackend>,
    pub executing: Mutex<()>,
    pub quitting: AtomicBool,
    pub log: Mutex<VecDeque<String>>,
}
impl App {
    pub fn new(origin: String, input: Box<dyn InputBackend>) -> Self {
        Self {
            origin,
            input,
            session: Mutex::new(Session::new()),
            control: Control::new(),
            executing: Mutex::new(()),
            quitting: AtomicBool::new(false),
            log: Mutex::new(VecDeque::new()),
        }
    }
    pub fn log(&self, message: String) {
        let mut log = self.log.lock().unwrap();
        if log.len() == 200 {
            log.pop_front();
        }
        log.push_back(format!("{}  {message}", now()));
    }
    pub fn revoke(&self, reason: &str) {
        self.control.stop();
        let mut session = self.session.lock().unwrap();
        session.token = None;
        session.code.clear();
        drop(session);
        self.log(reason.into());
    }
    pub fn renew(&self) -> Result<(), String> {
        self.revoke("Previous pairing cleared");
        let _guard = self
            .executing
            .try_lock()
            .map_err(|_| "Input is finishing. Try again in a moment.")?;
        *self.session.lock().unwrap() = Session::new();
        self.control.stopped.store(false, Ordering::SeqCst);
        self.log("New pairing code issued, valid for five minutes".into());
        Ok(())
    }
    pub fn display_revision(&self) -> String {
        // Serialize geometry rather than hash with a platform-dependent algorithm.
        json!({"bounds":self.input.geometry(),"displays":self.input.displays()}).to_string()
    }
}
pub fn valid_origin(origin: &str) -> bool {
    let Ok(url) = url::Url::parse(origin) else {
        return false;
    };
    url.origin().ascii_serialization() == origin
        && url.username().is_empty()
        && url.password().is_none()
        && (url.scheme() == "https"
            || (url.scheme() == "http"
                && matches!(url.host_str(), Some("127.0.0.1" | "localhost"))))
}
fn header(request: &Request, name: &str) -> String {
    request
        .headers()
        .iter()
        .find(|h| h.field.as_str().as_str().eq_ignore_ascii_case(name))
        .map(|h| h.value.as_str().to_owned())
        .unwrap_or_default()
}
fn response(request: Request, status: u16, body: Value, origin: Option<&str>) {
    let mut response = Response::from_string(body.to_string()).with_status_code(StatusCode(status));
    for (name, value) in [
        ("Content-Type", "application/json"),
        ("Cache-Control", "no-store"),
        ("X-Content-Type-Options", "nosniff"),
    ] {
        response.add_header(Header::from_bytes(name, value).unwrap());
    }
    if let Some(origin) = origin {
        for (name, value) in [
            ("Access-Control-Allow-Origin", origin),
            ("Access-Control-Allow-Methods", "POST, OPTIONS"),
            (
                "Access-Control-Allow-Headers",
                "Content-Type, Authorization",
            ),
            ("Access-Control-Allow-Private-Network", "true"),
            ("Vary", "Origin"),
        ] {
            response.add_header(Header::from_bytes(name, value).unwrap());
        }
    }
    let _ = request.respond(response);
}
#[derive(Debug)]
struct Fault {
    code: &'static str,
    message: String,
}
fn fault(code: &'static str, message: impl Into<String>) -> Fault {
    Fault {
        code,
        message: message.into(),
    }
}
fn error_value(error: Fault) -> Value {
    json!({"protocolVersion":VERSION,"bridgeVersion":BRIDGE_VERSION,"timestamp":now(),"error":{"code":error.code,"message":error.message}})
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PairRequest {
    protocol_version: u32,
    code: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SessionRequest {
    protocol_version: u32,
    session_id: String,
    timestamp: u64,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ExecuteRequest {
    protocol_version: u32,
    session_id: String,
    timestamp: u64,
    display_revision: String,
    command: Value,
}
fn check_version(version: u32) -> Result<(), Fault> {
    if version != VERSION {
        return Err(fault(
            "protocol_mismatch",
            "This companion supports protocol 1. Update Lens and the companion.",
        ));
    }
    Ok(())
}
fn check_session(app: &App, authorization: &str, id: &str, timestamp: u64) -> Result<(), Fault> {
    let session = app.session.lock().unwrap();
    if !session.authorized(authorization) || id != session.id {
        return Err(fault(
            "session_expired",
            "Session expired or changed. Pair again.",
        ));
    }
    if now().abs_diff(timestamp) > 30_000 {
        return Err(fault(
            "stale_command",
            "Request is over 30 seconds old. Check your system clock.",
        ));
    }
    Ok(())
}
fn handle(mut request: Request, app: &App) {
    let origin = header(&request, "Origin");
    let host = header(&request, "Host");
    if origin != app.origin || !matches!(host.as_str(), "127.0.0.1:47653" | "localhost:47653") {
        response(
            request,
            403,
            error_value(fault("origin_denied", "Origin or Host not authorized")),
            None,
        );
        return;
    }
    if request.method() == &Method::Options {
        response(request, 200, json!({"ok":true}), Some(&origin));
        return;
    }
    if request.method() != &Method::Post {
        response(
            request,
            405,
            error_value(fault("invalid_request", "POST required")),
            Some(&origin),
        );
        return;
    }
    if header(&request, "Content-Type") != "application/json"
        || request.body_length().is_none_or(|n| n > MAX_BODY)
    {
        response(
            request,
            413,
            error_value(fault(
                "invalid_request",
                "Bounded application/json body required",
            )),
            Some(&origin),
        );
        return;
    }
    let path = request.url().to_owned();
    let authorization = header(&request, "Authorization");
    if path != "/pair" && !app.session.lock().unwrap().authorized(&authorization) {
        response(
            request,
            401,
            error_value(fault(
                "session_not_paired",
                "Pair this browser session first",
            )),
            Some(&origin),
        );
        return;
    }
    let mut body = String::new();
    if request
        .as_reader()
        .take((MAX_BODY + 1) as u64)
        .read_to_string(&mut body)
        .is_err()
        || body.len() > MAX_BODY
    {
        response(
            request,
            413,
            error_value(fault("invalid_request", "Invalid body")),
            Some(&origin),
        );
        return;
    }
    let outcome: Result<Value, Fault> = (|| {
        if path == "/pair" {
            let pair: PairRequest = serde_json::from_str(&body)
                .map_err(|_| fault("invalid_request", "Expected protocolVersion and code"))?;
            check_version(pair.protocol_version)?;
            app.control
                .check(app.control.epoch.load(Ordering::SeqCst))
                .map_err(|e| fault("control_paused", e))?;
            let mut session = app.session.lock().unwrap();
            let token = session
                .pair(&pair.code)
                .map_err(|e| fault("pairing_rejected", e))?;
            app.log("Browser paired for 30 minutes".into());
            return Ok(
                json!({"protocolVersion":VERSION,"bridgeVersion":BRIDGE_VERSION,"sessionId":session.id,"timestamp":now(),"token":token,"expiresIn":1800}),
            );
        }
        if path != "/execute" {
            let message: SessionRequest = serde_json::from_str(&body).map_err(|_| {
                fault(
                    "invalid_request",
                    "Expected protocolVersion, sessionId and timestamp",
                )
            })?;
            check_version(message.protocol_version)?;
            check_session(app, &authorization, &message.session_id, message.timestamp)?;
            if path == "/stop" || path == "/disconnect" {
                app.revoke("Browser disconnected. Input stopped.");
                return Ok(
                    json!({"protocolVersion":VERSION,"bridgeVersion":BRIDGE_VERSION,"sessionId":message.session_id,"timestamp":now(),"ok":true}),
                );
            }
            if path == "/capabilities" {
                return Ok(
                    json!({"protocolVersion":VERSION,"bridgeVersion":BRIDGE_VERSION,"sessionId":message.session_id,"timestamp":now(),"device":format!("{} {}",std::env::consts::OS,std::env::consts::ARCH),"platform":app.input.platform(),"coordinateSpace":app.input.coordinate_space(),"desktopBounds":app.input.geometry(),"displays":app.input.displays(),"displayRevision":app.display_revision(),"displayScale":1,"commands":COMMANDS,"keys":protocol::supported_keys(app.input.platform()),"emergencyStop":true}),
                );
            }
            return Err(fault("unsupported_action", "Unknown endpoint"));
        }
        let message: ExecuteRequest =
            serde_json::from_str(&body).map_err(|e| fault("invalid_command", e.to_string()))?;
        check_version(message.protocol_version)?;
        check_session(app, &authorization, &message.session_id, message.timestamp)?;
        let _execution = app.executing.try_lock().map_err(|_| {
            fault(
                "busy",
                "Another command is executing. Commands are not queued.",
            )
        })?;
        let epoch = app.control.epoch.load(Ordering::SeqCst);
        app.control
            .check(epoch)
            .map_err(|e| fault("control_paused", e))?;
        if message.display_revision != app.display_revision() {
            return Err(fault(
                "screen_changed",
                "Display layout changed. Reconnect and confirm the shared monitor.",
            ));
        }
        let kind = message
            .command
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("");
        if !COMMANDS.contains(&kind) {
            return Err(fault("unsupported_action", "Command type is not supported"));
        }
        if kind == "keyboard.key"
            && !protocol::supported_keys(app.input.platform()).contains(
                &message
                    .command
                    .get("key")
                    .and_then(Value::as_str)
                    .unwrap_or(""),
            )
        {
            return Err(fault(
                "unsupported_action",
                "This keyboard shortcut is unavailable on this platform",
            ));
        }
        let command: protocol::Command = serde_json::from_value(message.command.clone())
            .map_err(|e| fault("invalid_command", e.to_string()))?;
        command.validate(app.input.geometry()).map_err(|e| {
            fault(
                if e.contains("outside") {
                    "invalid_coordinates"
                } else {
                    "invalid_command"
                },
                e,
            )
        })?;
        {
            let mut session = app.session.lock().unwrap();
            if !session.authorized(&authorization) {
                return Err(fault("session_expired", "Session expired"));
            }
            if session.seen.len() >= 10000 {
                return Err(fault(
                    "session_expired",
                    "Session command limit reached. Pair again.",
                ));
            }
            if !session.seen.insert(command.id().to_owned()) {
                return Err(fault(
                    "duplicate_command",
                    "Command already received. Mutations are never replayed automatically.",
                ));
            }
        }
        let result = app.input.execute(&command, &|| {
            app.control.check(epoch)?;
            if !app.session.lock().unwrap().authorized(&authorization) {
                return Err("Session expired".into());
            }
            if message.display_revision != app.display_revision() {
                return Err("Display layout changed".into());
            }
            Ok(())
        });
        let timestamp = now();
        let mut receipt = json!({"id":command.id(),"ok":result.is_ok(),"executedAt":timestamp});
        let mut envelope = json!({"protocolVersion":VERSION,"bridgeVersion":BRIDGE_VERSION,"sessionId":message.session_id,"commandId":command.id(),"timestamp":timestamp,"status":if result.is_ok() {"completed"} else {"failed"}});
        if let Err(error) = &result {
            receipt["error"] = json!(error);
            envelope["error"] = json!({"code":if error.to_lowercase().contains("permission") {"permission_denied"} else {"execution_failed"},"message":error});
        }
        app.log(format!(
            "{} {} {}",
            command.id(),
            kind,
            if result.is_ok() {
                "completed"
            } else {
                "failed"
            }
        ));
        envelope["result"] = receipt;
        Ok(envelope)
    })();
    match outcome {
        Ok(body) => response(request, 200, body, Some(&origin)),
        Err(error) => {
            app.log(format!("Rejected {}: {}", path, error.code));
            response(request, 400, error_value(error), Some(&origin));
        }
    }
}
pub fn serve(server: Server, app: Arc<App>) {
    let active = Arc::new(AtomicUsize::new(0));
    while !app.quitting.load(Ordering::SeqCst) {
        let request = match server.recv_timeout(Duration::from_millis(100)) {
            Ok(Some(request)) => request,
            Ok(None) => continue,
            Err(_) => {
                app.revoke("Local server stopped");
                break;
            }
        };
        if active.fetch_add(1, Ordering::SeqCst) >= 16 {
            active.fetch_sub(1, Ordering::SeqCst);
            response(
                request,
                503,
                error_value(fault("busy", "Too many requests")),
                None,
            );
            continue;
        }
        let app = app.clone();
        let active = active.clone();
        thread::spawn(move || {
            handle(request, &app);
            active.fetch_sub(1, Ordering::SeqCst);
        });
    }
}
#[cfg(test)]
#[path = "http_tests.rs"]
mod http_tests;

mod emergency;
#[cfg(test)]
mod http_tests;
mod input;
mod protocol;
mod session;
#[cfg(any(target_os = "macos", target_os = "linux"))]
mod unix_input;
#[cfg(windows)]
mod windows_input;
use input::InputBackend;
use serde::Deserialize;
use serde_json::{Value, json};
use session::{Control, Session};
use std::{
    io::{self, BufRead, Read},
    sync::{
        Arc, Mutex,
        atomic::{AtomicUsize, Ordering},
    },
    thread,
    time::{SystemTime, UNIX_EPOCH},
};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};
const ADDRESS: &str = "127.0.0.1:47653";
const MAX_BODY: usize = 16384;
struct App {
    origin: String,
    session: Mutex<Session>,
    control: Control,
    input: Box<dyn InputBackend>,
    executing: Mutex<()>,
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
fn handle(mut request: Request, app: &App) {
    let origin = header(&request, "Origin");
    let host = header(&request, "Host");
    if origin != app.origin || (host != "127.0.0.1:47653" && host != "localhost:47653") {
        response(
            request,
            403,
            json!({"error":"Origin or Host not authorized"}),
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
            json!({"error":"POST required"}),
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
            json!({"error":"Bounded application/json body required"}),
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
            json!({"error":"Pair this browser session first"}),
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
        response(request, 413, json!({"error":"Invalid body"}), Some(&origin));
        return;
    }
    let outcome: Result<Value, String> = (|| match path.as_str() {
        "/pair" => {
            app.control
                .check(app.control.epoch.load(Ordering::SeqCst))?;
            #[derive(Deserialize)]
            #[serde(deny_unknown_fields)]
            struct Pair {
                code: String,
            }
            let pair: Pair =
                serde_json::from_str(&body).map_err(|_| "Expected only a pairing code")?;
            let token = app.session.lock().unwrap().pair(&pair.code)?;
            println!(
                "Browser paired. Authorization expires in 30 minutes. Ctrl+Alt+F10 stops input."
            );
            Ok(json!({"token":token,"expiresIn":1800}))
        }
        "/stop" | "/disconnect" => {
            if body != "{}" {
                return Err("Expected empty object".into());
            }
            app.control.stop();
            app.session.lock().unwrap().token = None;
            println!("STOPPED. Type enable in this console to issue a fresh pairing code.");
            Ok(json!({"ok":true}))
        }
        "/capabilities" => {
            app.control
                .check(app.control.epoch.load(Ordering::SeqCst))?;
            if body != "{}" {
                return Err("Expected empty object".into());
            }
            Ok(
                json!({"platform":app.input.platform(),"coordinateSpace":app.input.coordinate_space(),"desktopBounds":app.input.geometry(),"displays":app.input.displays(),"displayScale":1,"commands":["pointer.move","pointer.click","pointer.drag","keyboard.text","keyboard.key","scroll"],"emergencyStop":true}),
            )
        }
        "/execute" => {
            let _execution = app
                .executing
                .try_lock()
                .map_err(|_| "An input action is already executing. Commands are not queued.")?;
            let epoch = app.control.epoch.load(Ordering::SeqCst);
            app.control.check(epoch)?;
            let command: protocol::Command =
                serde_json::from_str(&body).map_err(|e| format!("Invalid command: {e}"))?;
            command.validate(app.input.geometry())?;
            {
                let mut session = app.session.lock().unwrap();
                if !session.authorized(&authorization) {
                    return Err("Session expired".into());
                }
                if session.seen.len() >= 10000 {
                    return Err("Session command limit reached. Pair again.".into());
                }
                if !session.seen.insert(command.id().to_owned()) {
                    return Err(
                        "Duplicate command ID. Mutations are never replayed automatically.".into(),
                    );
                }
            }
            let result = app.input.execute(&command, &|| {
                app.control.check(epoch)?;
                if !app.session.lock().unwrap().authorized(&authorization) {
                    return Err("Session expired".into());
                }
                Ok(())
            });
            let mut receipt = json!({"id":command.id(),"ok":result.is_ok(),"executedAt":SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64});
            if let Err(error) = result {
                receipt["error"] = json!(error);
            }
            Ok(receipt)
        }
        _ => Err("Unknown endpoint".into()),
    })();
    match outcome {
        Ok(body) => response(request, 200, body, Some(&origin)),
        Err(error) => response(request, 400, json!({"error":error}), Some(&origin)),
    }
}
fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let origin = if args.len() == 2 && args[0] == "--origin" {
        args[1].clone()
    } else if args.is_empty() {
        "http://127.0.0.1:5176".into()
    } else {
        eprintln!("Usage: lens-bridge [--origin http://127.0.0.1:5176]");
        return;
    };
    if !(origin.starts_with("http://127.0.0.1:")
        || origin.starts_with("http://localhost:")
        || origin.starts_with("https://"))
        || origin.contains(['\r', '\n', '@'])
        || origin.split("://").nth(1).is_none_or(|s| s.contains('/'))
    {
        eprintln!("Expected one exact HTTP localhost or HTTPS origin without a path.");
        return;
    }
    let input = match input::create() {
        Ok(input) => input,
        Err(error) => {
            eprintln!("Cannot start desktop input: {error}");
            std::process::exit(1);
        }
    };
    let server = Server::http(ADDRESS).expect("Cannot bind loopback port 47653");
    let app = Arc::new(App {
        origin,
        session: Mutex::new(Session::new()),
        control: Control::new(),
        input,
        executing: Mutex::new(()),
    });
    let stop_app = app.clone();
    let emergency = match emergency::install(move || {
        stop_app.control.stop();
        stop_app.session.lock().unwrap().token = None;
        println!("EMERGENCY STOP. Type enable to pair again.");
    }) {
        Ok(emergency) => emergency,
        Err(error) => {
            eprintln!(
                "Cannot register Ctrl+Alt+F10: {error}. Bridge refuses to start without its emergency hotkey."
            );
            std::process::exit(1);
        }
    };
    println!(
        "Lens bridge: {ADDRESS}\nAllowed browser: {}\nPairing code: {}\nNo elevation. No shell. Ctrl+Alt+F10 stops control.\nType stop to disable, enable to issue a fresh pairing code, or quit to exit.",
        app.origin,
        app.session.lock().unwrap().code
    );
    let console_app = app.clone();
    thread::spawn(move || {
        for line in io::stdin().lock().lines() {
            match line.unwrap_or_default().trim() {
                "stop" => {
                    console_app.control.stop();
                    console_app.session.lock().unwrap().token = None;
                    println!("STOPPED");
                }
                "enable" => {
                    console_app.control.stop();
                    if let Ok(_guard) = console_app.executing.try_lock() {
                        let mut session = console_app.session.lock().unwrap();
                        *session = Session::new();
                        console_app.control.stopped.store(false, Ordering::SeqCst);
                        println!("Pairing code: {}", session.code);
                    } else {
                        println!("Input is finishing its stop. Type enable again.");
                    }
                }
                "quit" => {
                    console_app.control.stop();
                    std::process::exit(0);
                }
                _ => println!("Commands: stop, enable, quit"),
            }
        }
        console_app.control.stop();
    });
    #[cfg(target_os = "macos")]
    {
        thread::spawn(move || serve(server, app));
        emergency.run();
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _emergency = emergency;
        serve(server, app);
    }
}

fn serve(server: Server, app: Arc<App>) {
    let active = Arc::new(AtomicUsize::new(0));
    for request in server.incoming_requests() {
        if active.fetch_add(1, Ordering::SeqCst) >= 16 {
            active.fetch_sub(1, Ordering::SeqCst);
            response(request, 503, json!({"error":"Too many requests"}), None);
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

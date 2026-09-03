use super::*;
use std::io::{Read, Write};
use std::net::TcpStream;
struct TestInput(Arc<AtomicUsize>);
impl InputBackend for TestInput {
    fn geometry(&self) -> protocol::Bounds {
        protocol::Bounds {
            x: -500,
            y: 0,
            width: 1500,
            height: 700,
        }
    }
    fn execute(
        &self,
        _: &protocol::Command,
        check: &dyn Fn() -> Result<(), String>,
    ) -> Result<(), String> {
        check()?;
        self.0.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }
}
#[test]
fn http_pairing_validation_receipts_and_stop_without_os_input() {
    let server = Server::http("127.0.0.1:0").unwrap();
    let address = server.server_addr().to_ip().unwrap();
    let count = Arc::new(AtomicUsize::new(0));
    let app = Arc::new(App::new(
        "http://127.0.0.1:5176".into(),
        Box::new(TestInput(count.clone())),
    ));
    let worker_app = app.clone();
    let worker = thread::spawn(move || serve(server, worker_app));
    let post = |path: &str, origin: &str, token: &str, body: Value| -> (u16, Value) {
        let mut stream = TcpStream::connect(address).unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        let body = body.to_string();
        write!(stream,"POST {path} HTTP/1.1\r\nHost: 127.0.0.1:47653\r\nOrigin: {origin}\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        (
            response.split_whitespace().nth(1).unwrap().parse().unwrap(),
            serde_json::from_str(response.split("\r\n\r\n").nth(1).unwrap()).unwrap(),
        )
    };
    let origin = "http://127.0.0.1:5176";
    let code = app.session.lock().unwrap().code.clone();
    assert_eq!(post("/execute", origin, "", json!({})).0, 401);
    assert_eq!(
        post(
            "/pair",
            "https://untrusted.example",
            "",
            json!({"protocolVersion":1,"code":code})
        )
        .0,
        403
    );
    assert_eq!(
        post(
            "/pair",
            origin,
            "",
            json!({"protocolVersion":2,"code":code})
        )
        .1["error"]["code"],
        "protocol_mismatch"
    );
    let (status, pair) = post(
        "/pair",
        origin,
        "",
        json!({"protocolVersion":1,"code":code}),
    );
    assert_eq!(status, 200);
    assert_eq!(
        post(
            "/pair",
            origin,
            "",
            json!({"protocolVersion":1,"code":code})
        )
        .0,
        400
    );
    let token = pair["token"].as_str().unwrap();
    let request = json!({"protocolVersion":1,"sessionId":pair["sessionId"],"timestamp":now()});
    let (status, capabilities) = post("/capabilities", origin, token, request.clone());
    assert_eq!(status, 200);
    assert_eq!(capabilities["protocolVersion"], 1);
    assert_eq!(capabilities["commands"].as_array().unwrap().len(), 6);
    let message = |command: Value| {
        let mut value = request.clone();
        value["displayRevision"] = capabilities["displayRevision"].clone();
        value["command"] = command;
        value
    };
    let command = json!({"id":"one","type":"pointer.move","point":{"x":-10,"y":10}});
    let (status, receipt) = post("/execute", origin, token, message(command.clone()));
    assert_eq!(status, 200);
    assert_eq!(receipt["result"]["ok"], true);
    assert_eq!(receipt["commandId"], "one");
    assert_eq!(receipt["sessionId"], pair["sessionId"]);
    assert_eq!(
        post("/execute", origin, token, message(command)).1["error"]["code"],
        "duplicate_command"
    );
    for (command, code) in [
        (
            json!({"id":"shell","type":"shell","text":"test"}),
            "unsupported_action",
        ),
        (
            json!({"id":"extra","type":"keyboard.text","text":"ok","extra":true}),
            "invalid_command",
        ),
        (
            json!({"id":"outside","type":"pointer.move","point":{"x":2000,"y":10}}),
            "invalid_coordinates",
        ),
    ] {
        assert_eq!(
            post("/execute", origin, token, message(command)).1["error"]["code"],
            code
        );
    }
    let valid = json!({"id":"two","type":"keyboard.text","text":"test"});
    let mut wrong = message(valid.clone());
    wrong["protocolVersion"] = json!(9);
    assert_eq!(
        post("/execute", origin, token, wrong).1["error"]["code"],
        "protocol_mismatch"
    );
    let mut wrong = message(valid.clone());
    wrong["sessionId"] = json!("wrong");
    assert_eq!(
        post("/execute", origin, token, wrong).1["error"]["code"],
        "session_expired"
    );
    let mut wrong = message(valid.clone());
    wrong["displayRevision"] = json!("old layout");
    assert_eq!(
        post("/execute", origin, token, wrong).1["error"]["code"],
        "screen_changed"
    );
    let mut wrong = message(valid.clone());
    wrong["timestamp"] = json!(0);
    assert_eq!(
        post("/execute", origin, token, wrong).1["error"]["code"],
        "stale_command"
    );
    assert_eq!(post("/disconnect", origin, token, request.clone()).0, 200);
    assert_eq!(post("/execute", origin, token, message(valid)).0, 401);
    app.renew().unwrap();
    let code = app.session.lock().unwrap().code.clone();
    let (_, repaired) = post(
        "/pair",
        origin,
        "",
        json!({"protocolVersion":1,"code":code}),
    );
    assert_ne!(pair["sessionId"], repaired["sessionId"]);
    assert_eq!(
        post(
            "/stop",
            origin,
            repaired["token"].as_str().unwrap(),
            json!({"protocolVersion":1,"sessionId":repaired["sessionId"],"timestamp":now()})
        )
        .0,
        200
    );
    app.quitting.store(true, Ordering::SeqCst);
    worker.join().unwrap();
    assert_eq!(count.load(Ordering::SeqCst), 1);
    assert!(
        !app.log
            .lock()
            .unwrap()
            .iter()
            .any(|line| line.contains(token))
    );
}
#[test]
fn origin_requires_exact_canonical_loopback_or_https_origin() {
    for origin in [
        "https://lens-webmcp.netlify.app",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
    ] {
        assert!(valid_origin(origin));
    }
    for origin in [
        "http://evil.example",
        "https://user:pass@example.com",
        "https://example.com/path",
        "https://example.com/",
        "https://example.com?x=1",
        "https://example.com#x",
        "https://example.com:443",
    ] {
        assert!(!valid_origin(origin));
    }
}

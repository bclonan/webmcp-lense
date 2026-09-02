use super::*;
use std::io::{Read, Write};
use std::net::TcpStream;
struct TestInput(Arc<AtomicUsize>);
impl InputBackend for TestInput {
    fn geometry(&self) -> protocol::Bounds {
        protocol::Bounds {
            x: 0,
            y: 0,
            width: 1000,
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
    let app = App {
        origin: "http://127.0.0.1:5176".into(),
        session: Mutex::new(Session::new()),
        control: Control::new(),
        input: Box::new(TestInput(count.clone())),
        executing: Mutex::new(()),
    };
    let code = app.session.lock().unwrap().code.clone();
    let worker = thread::spawn(move || {
        for _ in 0..9 {
            let request = server
                .recv_timeout(std::time::Duration::from_secs(5))
                .unwrap()
                .expect("test request missing");
            handle(request, &app);
        }
    });
    let post = |path: &str, origin: &str, token: &str, body: Value| -> (u16, Value) {
        let mut stream = TcpStream::connect(address).unwrap();
        stream
            .set_read_timeout(Some(std::time::Duration::from_secs(5)))
            .unwrap();
        let body = body.to_string();
        write!(stream,"POST {path} HTTP/1.1\r\nHost: 127.0.0.1:47653\r\nOrigin: {origin}\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        let status = response.split_whitespace().nth(1).unwrap().parse().unwrap();
        let value = serde_json::from_str(response.split("\r\n\r\n").nth(1).unwrap()).unwrap();
        (status, value)
    };
    let origin = "http://127.0.0.1:5176";
    assert_eq!(post("/execute", origin, "", json!({})).0, 401);
    assert_eq!(
        post(
            "/pair",
            "https://untrusted.example",
            "",
            json!({"code":code})
        )
        .0,
        403
    );
    let (status, pair) = post("/pair", origin, "", json!({"code":code}));
    assert_eq!(status, 200);
    let token = pair["token"].as_str().unwrap();
    let command = json!({"id":"one","type":"pointer.move","point":{"x":10,"y":10}});
    let (status, result) = post("/execute", origin, token, command.clone());
    assert_eq!(status, 200);
    assert_eq!(result["ok"], true);
    assert_eq!(result["id"], "one");
    assert_eq!(post("/execute", origin, token, command).0, 400);
    assert_eq!(
        post(
            "/execute",
            origin,
            token,
            json!({"id":"two","type":"shell","text":"test"})
        )
        .0,
        400
    );
    assert_eq!(
        post(
            "/execute",
            origin,
            token,
            json!({"id":"three","type":"keyboard.text","text":"ok","extra":true})
        )
        .0,
        400
    );
    assert_eq!(post("/stop", origin, token, json!({})).0, 200);
    assert_eq!(
        post(
            "/execute",
            origin,
            token,
            json!({"id":"four","type":"keyboard.text","text":"never"})
        )
        .0,
        401
    );
    worker.join().unwrap();
    assert_eq!(count.load(Ordering::SeqCst), 1);
}

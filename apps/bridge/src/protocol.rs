use serde::{Deserialize, Serialize};
#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Point {
    pub x: i32,
    pub y: i32,
}
#[derive(Clone, Copy, Serialize)]
pub struct Bounds {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}
#[derive(Debug, Deserialize)]
#[serde(tag = "type", deny_unknown_fields)]
pub enum Command {
    #[serde(rename = "pointer.move")]
    Move { id: String, point: Point },
    #[serde(rename = "pointer.click")]
    Click {
        id: String,
        point: Point,
        button: Button,
    },
    #[serde(rename = "pointer.drag")]
    Drag {
        id: String,
        points: Vec<Point>,
        #[serde(rename = "durationMs")]
        duration_ms: u64,
    },
    #[serde(rename = "keyboard.text")]
    Text { id: String, text: String },
    #[serde(rename = "keyboard.key")]
    Key { id: String, key: Key },
    #[serde(rename = "scroll")]
    Scroll { id: String, delta: i32 },
}
#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Button {
    Left,
    Right,
}
#[derive(Clone, Copy, Debug, Deserialize)]
pub enum Key {
    #[serde(rename = "WIN")]
    Win,
    #[serde(rename = "ENTER")]
    Enter,
    #[serde(rename = "ESC")]
    Esc,
    #[serde(rename = "TAB")]
    Tab,
    #[serde(rename = "BACKSPACE")]
    Backspace,
    #[serde(rename = "DELETE")]
    Delete,
    #[serde(rename = "CTRL+A")]
    SelectAll,
    #[serde(rename = "CTRL+C")]
    Copy,
    #[serde(rename = "CTRL+V")]
    Paste,
    #[serde(rename = "CTRL+S")]
    Save,
    #[serde(rename = "ALT+F4")]
    Close,
    #[serde(rename = "LEFT")]
    Left,
    #[serde(rename = "RIGHT")]
    Right,
    #[serde(rename = "UP")]
    Up,
    #[serde(rename = "DOWN")]
    Down,
}
impl Command {
    pub fn id(&self) -> &str {
        match self {
            Self::Move { id, .. }
            | Self::Click { id, .. }
            | Self::Drag { id, .. }
            | Self::Text { id, .. }
            | Self::Key { id, .. }
            | Self::Scroll { id, .. } => id,
        }
    }
    pub fn validate(&self, bounds: Bounds) -> Result<(), String> {
        if self.id().is_empty() || self.id().len() > 64 || !self.id().is_ascii() {
            return Err("Invalid command ID".into());
        }
        let point_valid = |p: &Point| {
            p.x >= bounds.x
                && p.y >= bounds.y
                && (p.x as i64) < bounds.x as i64 + bounds.width as i64
                && (p.y as i64) < bounds.y as i64 + bounds.height as i64
        };
        let valid = match self {
            Self::Move { point, .. } | Self::Click { point, .. } => point_valid(point),
            Self::Drag {
                points,
                duration_ms,
                ..
            } => {
                (2..=128).contains(&points.len())
                    && (50..=5000).contains(duration_ms)
                    && points.iter().all(point_valid)
            }
            Self::Text { text, .. } => {
                !text.is_empty() && text.encode_utf16().count() <= 2000 && !text.contains('\0')
            }
            Self::Scroll { delta, .. } => (-1200..=1200).contains(delta),
            Self::Key { .. } => true,
        };
        if valid {
            Ok(())
        } else {
            Err("Command exceeds payload, coordinate or duration limits".into())
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn b() -> Bounds {
        Bounds {
            x: -1920,
            y: 0,
            width: 3840,
            height: 1080,
        }
    }
    #[test]
    fn rejects_execution_and_unknown_fields() {
        assert!(
            serde_json::from_str::<Command>(r#"{"id":"a","type":"shell","text":"test"}"#).is_err()
        );
        assert!(
            serde_json::from_str::<Command>(
                r#"{"id":"a","type":"keyboard.text","text":"ok","shell":true}"#
            )
            .is_err()
        );
    }
    #[test]
    fn negative_monitor_is_valid_but_outside_is_not() {
        assert!(
            Command::Move {
                id: "a".into(),
                point: Point { x: -100, y: 20 }
            }
            .validate(b())
            .is_ok()
        );
        assert!(
            Command::Move {
                id: "a".into(),
                point: Point { x: 1920, y: 20 }
            }
            .validate(b())
            .is_err()
        );
    }
    #[test]
    fn enforces_text_and_drag_bounds() {
        assert!(
            Command::Text {
                id: "a".into(),
                text: "x".repeat(2001)
            }
            .validate(b())
            .is_err()
        );
        assert!(
            Command::Drag {
                id: "a".into(),
                points: vec![Point { x: 0, y: 0 }; 2],
                duration_ms: 5001
            }
            .validate(b())
            .is_err()
        );
        assert!(
            serde_json::from_str::<Command>(r#"{"id":"a","type":"keyboard.key","key":"WIN+R"}"#)
                .is_err()
        );
    }
}

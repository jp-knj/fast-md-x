use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

mod markdown_transform;
pub use markdown_transform::*;

#[derive(Serialize, Deserialize)]
pub struct FileMetadata {
    pub path: String,
    pub size: u64,
    pub mtime_ms: f64,
}

#[wasm_bindgen]
pub fn deps_digest(files_json: &str) -> String {
    let files: Vec<FileMetadata> = serde_json::from_str(files_json).unwrap_or_default();
    
    // Sort by path for stable order
    let mut sorted_files = files;
    sorted_files.sort_by(|a, b| a.path.cmp(&b.path));
    
    // Stable concatenation: path|size|mtimeMs\n
    let mut hasher = Sha256::new();
    for file in sorted_files {
        hasher.update(file.path.as_bytes());
        hasher.update(b"|");
        hasher.update(file.size.to_string().as_bytes());
        hasher.update(b"|");
        hasher.update((file.mtime_ms as i64).to_string().as_bytes());
        hasher.update(b"\n");
    }
    format!("{:x}", hasher.finalize())
}

#[wasm_bindgen]
pub fn normalize_content(input: &str) -> String {
    // Strip UTF-8 BOM represented as U+FEFF if present
    let s = if input.chars().next() == Some('\u{feff}') {
        input.chars().skip(1).collect::<String>()
    } else {
        input.to_string()
    };
    // Replace CRLF first, then remaining CR
    let s = s.replace("\r\n", "\n");
    s.replace('\r', "\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sha256_hex(s: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(s.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    #[test]
    fn digest_with_metadata() {
        let files = vec![
            FileMetadata {
                path: "/tmp/a.md".to_string(),
                size: 10,
                mtime_ms: 1234567890.0,
            },
            FileMetadata {
                path: "/tmp/b.md".to_string(),
                size: 0,
                mtime_ms: 0.0,
            },
        ];
        
        let json = serde_json::to_string(&files).unwrap();
        let digest = deps_digest(&json);
        
        // Expected: sorted by path
        let expected_content = "/tmp/a.md|10|1234567890\n/tmp/b.md|0|0\n";
        let expected = sha256_hex(expected_content);
        
        assert_eq!(digest, expected);
    }

    #[test]
    fn digest_empty_is_sha256_of_empty() {
        let json = "[]";
        let got = deps_digest(json);
        // sha256("")
        assert_eq!(got, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    }

    #[test]
    fn digest_is_order_invariant() {
        let files1 = vec![
            FileMetadata { path: "b.md".to_string(), size: 20, mtime_ms: 2000.0 },
            FileMetadata { path: "a.md".to_string(), size: 10, mtime_ms: 1000.0 },
        ];
        let files2 = vec![
            FileMetadata { path: "a.md".to_string(), size: 10, mtime_ms: 1000.0 },
            FileMetadata { path: "b.md".to_string(), size: 20, mtime_ms: 2000.0 },
        ];
        
        let json1 = serde_json::to_string(&files1).unwrap();
        let json2 = serde_json::to_string(&files2).unwrap();
        
        assert_eq!(deps_digest(&json1), deps_digest(&json2));
    }

    #[test]
    fn normalize_content_strips_bom_and_normalizes_newlines() {
        // BOM + CRLF
        let s = format!("{}{}", '\u{feff}', "line1\r\nline2\rline3\n");
        let n = normalize_content(&s);
        assert_eq!(n, "line1\nline2\nline3\n");
    }

    #[test]
    fn normalize_content_handles_empty() {
        assert_eq!(normalize_content(""), "");
    }

    #[test]
    fn normalize_content_preserves_lf() {
        assert_eq!(normalize_content("a\nb\nc"), "a\nb\nc");
    }
}
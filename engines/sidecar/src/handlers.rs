use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Sha256, Digest};
use tracing::debug;
use pulldown_cmark::{Parser, Options, html};

use crate::protocol::{RpcId, RpcResponse, create_response, create_error_response, INVALID_PARAMS, TRANSFORM_ERROR};

#[derive(Debug, Deserialize)]
struct TransformRequest {
    file: String,
    content: String,
    options: Option<TransformOptions>,
}

#[derive(Debug, Deserialize)]
struct TransformOptions {
    mode: Option<String>,
    sourcemap: Option<bool>,
    framework: Option<String>,
}

#[derive(Debug, Serialize)]
struct TransformResponse {
    code: String,
    map: Option<Value>,
    metadata: Option<Value>,
    dependencies: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct NormalizeRequest {
    content: String,
    #[serde(default)]
    remove_bom: bool,
    #[serde(default = "default_true")]
    normalize_lf: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Serialize)]
struct NormalizeResponse {
    content: String,
    changed: bool,
}

#[derive(Debug, Deserialize)]
struct ComputeDigestRequest {
    files: Vec<FileInfo>,
}

#[derive(Debug, Deserialize)]
struct FileInfo {
    path: String,
    size: u64,
    mtime: u64,
}

#[derive(Debug, Serialize)]
struct ComputeDigestResponse {
    digest: String,
}

pub fn handle_ping(id: RpcId) -> RpcResponse {
    create_response(id, json!({ "pong": true }))
}

pub fn handle_transform(id: RpcId, params: Option<Value>) -> RpcResponse {
    let params = match params {
        Some(p) => p,
        None => return create_error_response(id, INVALID_PARAMS, "Missing params".to_string(), None),
    };
    
    let req: TransformRequest = match serde_json::from_value(params) {
        Ok(r) => r,
        Err(e) => return create_error_response(id, INVALID_PARAMS, format!("Invalid params: {}", e), None),
    };
    
    debug!("Transform request for file: {}", req.file);
    
    // Simple frontmatter extraction
    let (frontmatter, content) = extract_frontmatter(&req.content);
    
    let mut metadata = json!({
        "file": req.file.clone(),
    });
    
    // Add frontmatter to metadata if present
    if let Some(fm) = frontmatter {
        metadata["frontmatter"] = fm;
    }
    
    // Determine file type
    let is_mdx = req.file.ends_with(".mdx");
    
    let transformed_code = if is_mdx {
        // For MDX, we do minimal preprocessing for now
        // Just extract imports/exports and pass through
        transform_mdx(&content, &req.file)
    } else {
        // For regular markdown, convert to HTML
        transform_markdown(&content, &req.file)
    };
    
    let response = match transformed_code {
        Ok(code) => TransformResponse {
            code,
            map: None,
            metadata: Some(metadata),
            dependencies: None,
        },
        Err(e) => {
            return create_error_response(id, TRANSFORM_ERROR, format!("Transform failed: {}", e), None);
        }
    };
    
    create_response(id, serde_json::to_value(response).unwrap())
}

fn transform_markdown(content: &str, file_path: &str) -> Result<String, String> {
    // Set up options for pulldown-cmark
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_SMART_PUNCTUATION);
    
    // Parse markdown
    let parser = Parser::new_ext(content, options);
    
    // Convert to HTML
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);
    
    // Wrap in ES module export
    let escaped_html = html_output
        .replace('\\', "\\\\")
        .replace('`', "\\`")
        .replace("${", "\\${");
    
    Ok(format!(
        r#"// Generated from: {}
export default `{}`;
"#,
        file_path,
        escaped_html
    ))
}

fn extract_frontmatter(content: &str) -> (Option<Value>, String) {
    let lines: Vec<&str> = content.lines().collect();
    
    // Check if content starts with frontmatter delimiter
    if lines.is_empty() || lines[0].trim() != "---" {
        return (None, content.to_string());
    }
    
    // Find the closing delimiter
    let mut end_index = None;
    for (i, line) in lines.iter().enumerate().skip(1) {
        if line.trim() == "---" {
            end_index = Some(i);
            break;
        }
    }
    
    if let Some(end) = end_index {
        // Extract YAML content
        let yaml_content = lines[1..end].join("\n");
        
        // Parse YAML to JSON
        let frontmatter = if let Ok(yaml_value) = serde_yaml::from_str::<serde_json::Value>(&yaml_content) {
            Some(yaml_value)
        } else {
            None
        };
        
        // Return frontmatter and content after the closing delimiter
        let remaining_content = lines[(end + 1)..].join("\n");
        (frontmatter, remaining_content)
    } else {
        // No closing delimiter found, treat all as content
        (None, content.to_string())
    }
}

fn transform_mdx(content: &str, file_path: &str) -> Result<String, String> {
    // For MDX, we need more complex processing
    // For now, just do basic preprocessing
    
    let mut imports = Vec::new();
    let mut exports = Vec::new();
    let mut body_lines = Vec::new();
    
    for line in content.lines() {
        if line.trim_start().starts_with("import ") {
            imports.push(line.to_string());
        } else if line.trim_start().starts_with("export ") && !line.contains("export default") {
            exports.push(line.to_string());
        } else {
            body_lines.push(line);
        }
    }
    
    let body = body_lines.join("\n");
    
    // For now, just pass through with minimal structure
    // In production, this would integrate with MDX compiler
    let mut result = String::new();
    
    result.push_str(&format!("// Generated from: {}\n", file_path));
    
    for import in imports {
        result.push_str(&import);
        result.push('\n');
    }
    
    if !exports.is_empty() {
        result.push('\n');
        for export in exports {
            result.push_str(&export);
            result.push('\n');
        }
    }
    
    // For now, wrap content as template literal
    // Real MDX would compile JSX here
    result.push_str("\nexport default `");
    result.push_str(&body.replace('\\', "\\\\").replace('`', "\\`").replace("${", "\\${"));
    result.push_str("`;\n");
    
    Ok(result)
}

pub fn handle_normalize(id: RpcId, params: Option<Value>) -> RpcResponse {
    let params = match params {
        Some(p) => p,
        None => return create_error_response(id, INVALID_PARAMS, "Missing params".to_string(), None),
    };
    
    let req: NormalizeRequest = match serde_json::from_value(params) {
        Ok(r) => r,
        Err(e) => return create_error_response(id, INVALID_PARAMS, format!("Invalid params: {}", e), None),
    };
    
    let mut content = req.content;
    let mut changed = false;
    
    // Remove BOM if requested
    if req.remove_bom && content.starts_with('\u{FEFF}') {
        content = content[3..].to_string();
        changed = true;
    }
    
    // Normalize line endings if requested
    if req.normalize_lf && content.contains("\r\n") {
        content = content.replace("\r\n", "\n");
        changed = true;
    }
    
    let response = NormalizeResponse {
        content,
        changed,
    };
    
    create_response(id, serde_json::to_value(response).unwrap())
}

pub fn handle_compute_digest(id: RpcId, params: Option<Value>) -> RpcResponse {
    let params = match params {
        Some(p) => p,
        None => return create_error_response(id, INVALID_PARAMS, "Missing params".to_string(), None),
    };
    
    let req: ComputeDigestRequest = match serde_json::from_value(params) {
        Ok(r) => r,
        Err(e) => return create_error_response(id, INVALID_PARAMS, format!("Invalid params: {}", e), None),
    };
    
    // Sort files by path for stable digest
    let mut files = req.files;
    files.sort_by(|a, b| a.path.cmp(&b.path));
    
    // Create digest string
    let mut hasher = Sha256::new();
    for file in files {
        hasher.update(format!("{}|{}|{}\n", file.path, file.size, file.mtime).as_bytes());
    }
    
    let digest = format!("{:x}", hasher.finalize());
    
    let response = ComputeDigestResponse { digest };
    
    create_response(id, serde_json::to_value(response).unwrap())
}
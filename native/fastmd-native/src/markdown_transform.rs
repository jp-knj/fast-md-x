use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use markdown::{to_html_with_options, Options, ParseOptions, CompileOptions};
use pulldown_cmark::{Parser as PulldownParser, Options as PulldownOptions, html};
use comrak::{markdown_to_html as comrak_html, ComrakOptions};

#[derive(Serialize, Deserialize, Debug)]
pub struct TransformOptions {
    pub engine: Option<String>,
    pub gfm: Option<bool>,
    pub tables: Option<bool>,
    pub footnotes: Option<bool>,
    pub strikethrough: Option<bool>,
    pub tasklist: Option<bool>,
    pub smart_punctuation: Option<bool>,
    pub heading_ids: Option<bool>,
    pub xhtml: Option<bool>,
}

impl Default for TransformOptions {
    fn default() -> Self {
        TransformOptions {
            engine: Some("markdown-rs".to_string()),
            gfm: Some(true),
            tables: Some(true),
            footnotes: Some(true),
            strikethrough: Some(true),
            tasklist: Some(true),
            smart_punctuation: Some(false),
            heading_ids: Some(true),
            xhtml: Some(false),
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct TransformResult {
    pub html: String,
    pub metadata: TransformMetadata,
}

#[derive(Serialize, Deserialize)]
pub struct TransformMetadata {
    pub word_count: usize,
    pub heading_count: usize,
    pub link_count: usize,
    pub image_count: usize,
    pub code_block_count: usize,
}

/// Transform markdown to HTML using markdown-rs
#[wasm_bindgen]
pub fn transform_markdown_rs(input: &str, options_json: Option<String>) -> String {
    let options = if let Some(json) = options_json {
        serde_json::from_str::<TransformOptions>(&json).unwrap_or_default()
    } else {
        TransformOptions::default()
    };

    let mut parse_options = ParseOptions::default();
    let mut compile_options = CompileOptions::default();

    // Configure based on options
    if options.gfm.unwrap_or(true) {
        parse_options = ParseOptions::gfm();
        compile_options.gfm_tagfilter = true;
    }

    if options.footnotes.unwrap_or(true) {
        parse_options.constructs.gfm_footnote_definition = true;
        parse_options.constructs.label_start_footnote = true;
    }

    if options.strikethrough.unwrap_or(true) {
        parse_options.constructs.gfm_strikethrough = true;
    }

    if options.tasklist.unwrap_or(true) {
        parse_options.constructs.gfm_task_list_item = true;
    }

    let md_options = Options {
        parse: parse_options,
        compile: compile_options,
    };

    let html = to_html_with_options(input, &md_options)
        .unwrap_or_else(|e| format!("<p>Error parsing markdown: {}</p>", e));

    let metadata = analyze_markdown(input);
    
    let result = TransformResult {
        html,
        metadata,
    };

    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

/// Transform markdown to HTML using pulldown-cmark
#[wasm_bindgen]
pub fn transform_markdown_pulldown(input: &str, options_json: Option<String>) -> String {
    let options = if let Some(json) = options_json {
        serde_json::from_str::<TransformOptions>(&json).unwrap_or_default()
    } else {
        TransformOptions::default()
    };

    let mut pulldown_options = PulldownOptions::empty();
    
    if options.tables.unwrap_or(true) {
        pulldown_options.insert(PulldownOptions::ENABLE_TABLES);
    }
    if options.footnotes.unwrap_or(true) {
        pulldown_options.insert(PulldownOptions::ENABLE_FOOTNOTES);
    }
    if options.strikethrough.unwrap_or(true) {
        pulldown_options.insert(PulldownOptions::ENABLE_STRIKETHROUGH);
    }
    if options.tasklist.unwrap_or(true) {
        pulldown_options.insert(PulldownOptions::ENABLE_TASKLISTS);
    }
    if options.smart_punctuation.unwrap_or(false) {
        pulldown_options.insert(PulldownOptions::ENABLE_SMART_PUNCTUATION);
    }
    if options.heading_ids.unwrap_or(true) {
        pulldown_options.insert(PulldownOptions::ENABLE_HEADING_ATTRIBUTES);
    }

    let parser = PulldownParser::new_ext(input, pulldown_options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);

    let metadata = analyze_markdown(input);
    
    let result = TransformResult {
        html: html_output,
        metadata,
    };

    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

/// Transform markdown to HTML using comrak
#[wasm_bindgen]
pub fn transform_markdown_comrak(input: &str, options_json: Option<String>) -> String {
    let options = if let Some(json) = options_json {
        serde_json::from_str::<TransformOptions>(&json).unwrap_or_default()
    } else {
        TransformOptions::default()
    };

    let mut comrak_options = ComrakOptions::default();
    
    // Configure extensions
    comrak_options.extension.table = options.tables.unwrap_or(true);
    comrak_options.extension.footnotes = options.footnotes.unwrap_or(true);
    comrak_options.extension.strikethrough = options.strikethrough.unwrap_or(true);
    comrak_options.extension.tasklist = options.tasklist.unwrap_or(true);
    comrak_options.extension.autolink = true;
    comrak_options.extension.description_lists = true;
    comrak_options.extension.front_matter_delimiter = Some("---".to_string());
    
    // Configure rendering
    comrak_options.render.hardbreaks = false;
    comrak_options.render.github_pre_lang = true;
    comrak_options.render.full_info_string = true;
    
    if options.xhtml.unwrap_or(false) {
        comrak_options.render.escape = true;
    }

    let html = comrak_html(input, &comrak_options);
    let metadata = analyze_markdown(input);
    
    let result = TransformResult {
        html,
        metadata,
    };

    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

/// Analyze markdown content and extract metadata
fn analyze_markdown(input: &str) -> TransformMetadata {
    let mut word_count = 0;
    let mut heading_count = 0;
    let mut link_count = 0;
    let mut image_count = 0;
    let mut code_block_count = 0;

    for line in input.lines() {
        let trimmed = line.trim();
        
        // Count headings
        if trimmed.starts_with('#') {
            heading_count += 1;
        }
        
        // Count words (simple approximation)
        word_count += trimmed.split_whitespace().count();
        
        // Count links and images (simple pattern matching)
        link_count += trimmed.matches("](").count();
        image_count += trimmed.matches("![").count();
        
        // Count code blocks
        if trimmed.starts_with("```") {
            code_block_count += 1;
        }
    }

    // Adjust code block count (each block has opening and closing)
    code_block_count = code_block_count / 2;

    TransformMetadata {
        word_count,
        heading_count,
        link_count,
        image_count,
        code_block_count,
    }
}

/// Apply custom transformation rules to markdown
#[wasm_bindgen]
pub fn apply_custom_rules(input: &str, rules_json: &str) -> String {
    #[derive(Deserialize)]
    struct Rule {
        pattern: String,
        replacement: String,
    }
    
    let rules: Vec<Rule> = serde_json::from_str(rules_json).unwrap_or_default();
    let mut result = input.to_string();
    
    for rule in rules {
        result = result.replace(&rule.pattern, &rule.replacement);
    }
    
    result
}

/// Transform markdown with full pipeline (rules + engine)
#[wasm_bindgen]
pub fn transform_markdown_full(
    input: &str, 
    rules_json: Option<String>,
    options_json: Option<String>
) -> String {
    // Apply custom rules first
    let processed = if let Some(rules) = rules_json {
        apply_custom_rules(input, &rules)
    } else {
        input.to_string()
    };
    
    // Determine which engine to use
    let options = if let Some(json) = &options_json {
        serde_json::from_str::<TransformOptions>(json).unwrap_or_default()
    } else {
        TransformOptions::default()
    };
    
    match options.engine.as_deref() {
        Some("pulldown") => transform_markdown_pulldown(&processed, options_json),
        Some("comrak") => transform_markdown_comrak(&processed, options_json),
        _ => transform_markdown_rs(&processed, options_json),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_markdown_rs_transform() {
        let input = "# Hello World\n\nThis is a **test**.";
        let result = transform_markdown_rs(input, None);
        let parsed: TransformResult = serde_json::from_str(&result).unwrap();
        assert!(parsed.html.contains("<h1>"));
        assert!(parsed.html.contains("<strong>"));
        assert_eq!(parsed.metadata.heading_count, 1);
    }

    #[test]
    fn test_pulldown_transform() {
        let input = "# Hello World\n\n- [ ] Task 1\n- [x] Task 2";
        let options = TransformOptions {
            tasklist: Some(true),
            ..Default::default()
        };
        let options_json = serde_json::to_string(&options).unwrap();
        let result = transform_markdown_pulldown(input, Some(options_json));
        let parsed: TransformResult = serde_json::from_str(&result).unwrap();
        assert!(parsed.html.contains("type=\"checkbox\""));
    }

    #[test]
    fn test_comrak_transform() {
        let input = "~~strikethrough~~ and **bold**";
        let options = TransformOptions {
            strikethrough: Some(true),
            ..Default::default()
        };
        let options_json = serde_json::to_string(&options).unwrap();
        let result = transform_markdown_comrak(input, Some(options_json));
        let parsed: TransformResult = serde_json::from_str(&result).unwrap();
        assert!(parsed.html.contains("<del>"));
        assert!(parsed.html.contains("<strong>"));
    }

    #[test]
    fn test_custom_rules() {
        let input = "Replace FOO with BAR";
        let rules = r#"[{"pattern": "FOO", "replacement": "BAR"}]"#;
        let result = apply_custom_rules(input, rules);
        assert_eq!(result, "Replace BAR with BAR");
    }

    #[test]
    fn test_metadata_extraction() {
        let input = "# Title\n\n## Subtitle\n\nSome text with [link](url) and ![image](img.png).\n\n```rust\ncode here\n```";
        let metadata = analyze_markdown(input);
        assert_eq!(metadata.heading_count, 2);
        assert_eq!(metadata.link_count, 2); // link + image both have ](
        assert_eq!(metadata.image_count, 1);
        assert_eq!(metadata.code_block_count, 1);
        assert!(metadata.word_count > 0);
    }
}
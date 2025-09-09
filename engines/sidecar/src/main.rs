use anyhow::Result;
use clap::Parser;
use std::io::{self, BufRead, BufReader, Write};
use tracing::{debug, error, info};

mod handlers;
mod protocol;
mod utils;

use protocol::{RpcMessage, RpcRequest, RpcResponse};

#[derive(Parser, Debug)]
#[command(name = "fastmd-sidecar")]
#[command(about = "FastMD Rust sidecar for high-performance MD/MDX processing")]
struct Args {
    #[arg(long, default_value = "info")]
    log_level: String,
    
    #[arg(long)]
    cache_dir: Option<String>,
}

fn main() -> Result<()> {
    let args = Args::parse();
    
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(args.log_level)
        .with_writer(io::stderr)
        .init();
    
    info!("FastMD sidecar starting");
    
    // Setup stdin/stdout for NDJSON communication
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let reader = BufReader::new(stdin.lock());
    
    // Process messages
    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                error!("Failed to read line: {}", e);
                continue;
            }
        };
        
        if line.trim().is_empty() {
            continue;
        }
        
        debug!("Received: {}", line);
        
        // Parse message
        let message: RpcMessage = match serde_json::from_str(&line) {
            Ok(m) => m,
            Err(e) => {
                error!("Failed to parse message: {}", e);
                let error_response = protocol::create_parse_error();
                writeln!(stdout, "{}", serde_json::to_string(&error_response)?)?;
                stdout.flush()?;
                continue;
            }
        };
        
        // Handle message
        match message {
            RpcMessage::Request(req) => {
                let response = handle_request(req);
                writeln!(stdout, "{}", serde_json::to_string(&response)?)?;
                stdout.flush()?;
            }
            RpcMessage::Notification(notif) => {
                handle_notification(notif);
            }
        }
    }
    
    info!("FastMD sidecar shutting down");
    Ok(())
}

fn handle_request(req: RpcRequest) -> RpcResponse {
    match req.method.as_str() {
        "ping" => handlers::handle_ping(req.id),
        "shutdown" => {
            info!("Shutdown requested");
            std::process::exit(0);
        }
        "transform" => handlers::handle_transform(req.id, req.params),
        "normalize" => handlers::handle_normalize(req.id, req.params),
        "computeDigest" => handlers::handle_compute_digest(req.id, req.params),
        _ => protocol::create_method_not_found(req.id),
    }
}

fn handle_notification(notif: protocol::RpcNotification) {
    match notif.method.as_str() {
        "log" => {
            if let Some(params) = notif.params {
                info!("Client log: {:?}", params);
            }
        }
        _ => {
            debug!("Unknown notification: {}", notif.method);
        }
    }
}
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum RpcMessage {
    Request(RpcRequest),
    Notification(RpcNotification),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RpcRequest {
    pub jsonrpc: String,
    pub id: RpcId,
    pub method: String,
    pub params: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RpcNotification {
    pub jsonrpc: String,
    pub method: String,
    pub params: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RpcResponse {
    pub jsonrpc: String,
    pub id: RpcId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<RpcError>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum RpcId {
    Number(i64),
    String(String),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

// Error codes
pub const PARSE_ERROR: i32 = -32700;
#[allow(dead_code)]
pub const INVALID_REQUEST: i32 = -32600;
pub const METHOD_NOT_FOUND: i32 = -32601;
pub const INVALID_PARAMS: i32 = -32602;
#[allow(dead_code)]
pub const INTERNAL_ERROR: i32 = -32603;

// Custom error codes
pub const TRANSFORM_ERROR: i32 = -32001;
#[allow(dead_code)]
pub const CACHE_ERROR: i32 = -32002;
#[allow(dead_code)]
pub const IO_ERROR: i32 = -32003;

pub fn create_response(id: RpcId, result: Value) -> RpcResponse {
    RpcResponse {
        jsonrpc: "2.0".to_string(),
        id,
        result: Some(result),
        error: None,
    }
}

pub fn create_error_response(id: RpcId, code: i32, message: String, data: Option<Value>) -> RpcResponse {
    RpcResponse {
        jsonrpc: "2.0".to_string(),
        id,
        result: None,
        error: Some(RpcError {
            code,
            message,
            data,
        }),
    }
}

pub fn create_parse_error() -> RpcResponse {
    RpcResponse {
        jsonrpc: "2.0".to_string(),
        id: RpcId::String("null".to_string()),
        result: None,
        error: Some(RpcError {
            code: PARSE_ERROR,
            message: "Parse error".to_string(),
            data: None,
        }),
    }
}

pub fn create_method_not_found(id: RpcId) -> RpcResponse {
    create_error_response(id, METHOD_NOT_FOUND, "Method not found".to_string(), None)
}
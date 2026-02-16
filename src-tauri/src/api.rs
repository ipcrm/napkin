use axum::{
    extract::State as AxumState,
    http::StatusCode,
    response::{
        sse::{Event as SseEvent, KeepAlive, Sse},
        IntoResponse, Json, Response,
    },
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::{oneshot, watch, Mutex};
use tokio_stream::StreamExt;
use tower_http::cors::{AllowOrigin, CorsLayer};
use uuid::Uuid;

const DEFAULT_PORT: u16 = 21420;
const REQUEST_TIMEOUT_SECS: u64 = 15;

// --- Shared state ---

pub struct ApiState {
    pub pending: Arc<Mutex<HashMap<String, oneshot::Sender<serde_json::Value>>>>,
    pub app_handle: tauri::AppHandle,
    pub server_shutdown: Arc<Mutex<Option<watch::Sender<bool>>>>,
}

type SharedApiState = Arc<ApiState>;

// --- Event payload sent to the webview ---

#[derive(Clone, Serialize)]
pub struct McpToolRequest {
    pub request_id: String,
    pub tool_name: String,
    pub arguments: serde_json::Value,
}

// --- Tauri commands ---

#[tauri::command]
pub fn api_response(
    request_id: String,
    result: serde_json::Value,
    state: tauri::State<'_, SharedApiState>,
) {
    let pending = state.pending.clone();
    tauri::async_runtime::spawn(async move {
        let mut map = pending.lock().await;
        if let Some(sender) = map.remove(&request_id) {
            let _ = sender.send(result);
        }
    });
}

#[tauri::command]
pub async fn start_api_server(
    state: tauri::State<'_, SharedApiState>,
) -> Result<u16, String> {
    let mut shutdown_guard = state.server_shutdown.lock().await;
    if shutdown_guard.is_some() {
        return Err("API server is already running".to_string());
    }

    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    *shutdown_guard = Some(shutdown_tx);
    drop(shutdown_guard);

    let shared = Arc::clone(state.inner());
    let port = DEFAULT_PORT;

    tauri::async_runtime::spawn(async move {
        let app = build_router(shared);
        let addr = format!("127.0.0.1:{}", port);
        let listener = match tokio::net::TcpListener::bind(&addr).await {
            Ok(l) => l,
            Err(e) => {
                log::error!("Failed to bind API server on {}: {}", addr, e);
                return;
            }
        };

        log::info!("MCP server listening on http://{}/mcp", addr);

        let mut rx = shutdown_rx;
        axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                while rx.changed().await.is_ok() {
                    if *rx.borrow() {
                        break;
                    }
                }
            })
            .await
            .unwrap_or_else(|e| log::error!("MCP server error: {}", e));

        log::info!("MCP server stopped");
    });

    Ok(port)
}

#[tauri::command]
pub async fn stop_api_server(
    state: tauri::State<'_, SharedApiState>,
) -> Result<(), String> {
    let mut shutdown_guard = state.server_shutdown.lock().await;
    if let Some(tx) = shutdown_guard.take() {
        let _ = tx.send(true);
        Ok(())
    } else {
        Err("API server is not running".to_string())
    }
}

#[tauri::command]
pub async fn get_api_status(
    state: tauri::State<'_, SharedApiState>,
) -> Result<bool, String> {
    let guard = state.server_shutdown.lock().await;
    Ok(guard.is_some())
}

// --- Router (MCP only) ---

fn build_router(state: SharedApiState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(|origin, _| {
            let origin = origin.as_bytes();
            origin == b"tauri://localhost"
                || origin == b"http://localhost"
                || origin == b"https://localhost"
                || origin.starts_with(b"http://localhost:")
                || origin.starts_with(b"http://127.0.0.1:")
        }))
        .allow_methods([axum::http::Method::GET, axum::http::Method::POST])
        .allow_headers([axum::http::header::CONTENT_TYPE]);

    Router::new()
        .route("/mcp", post(mcp_post_handler))
        .route("/mcp", get(mcp_sse_handler))
        .layer(cors)
        .with_state(state)
}

// --- Bridge: emit tool call to webview, await response ---

async fn bridge_tool_call(
    state: &SharedApiState,
    tool_name: &str,
    arguments: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let request_id = Uuid::new_v4().to_string();

    let (tx, rx) = oneshot::channel();
    {
        let mut pending = state.pending.lock().await;
        pending.insert(request_id.clone(), tx);
    }

    let payload = McpToolRequest {
        request_id: request_id.clone(),
        tool_name: tool_name.to_string(),
        arguments,
    };

    if let Err(e) = state.app_handle.emit("mcp-tool-request", &payload) {
        log::error!("Failed to emit mcp-tool-request: {}", e);
        let mut pending = state.pending.lock().await;
        pending.remove(&request_id);
        return Err(format!("Failed to emit event: {}", e));
    }

    match tokio::time::timeout(
        std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS),
        rx,
    )
    .await
    {
        Ok(Ok(value)) => Ok(value),
        Ok(Err(_)) => {
            log::error!("Bridge channel closed for request {}", request_id);
            Err("Internal error: bridge channel closed".to_string())
        }
        Err(_) => {
            log::error!("Bridge request {} timed out", request_id);
            let mut pending = state.pending.lock().await;
            pending.remove(&request_id);
            Err("Request timed out".to_string())
        }
    }
}

// --- MCP protocol ---

const MCP_PROTOCOL_VERSION: &str = "2025-03-26";
const MCP_SERVER_NAME: &str = "napkin";
const MCP_SERVER_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Deserialize)]
struct McpJsonRpcRequest {
    #[allow(dead_code)]
    jsonrpc: String,
    id: Option<serde_json::Value>,
    method: String,
    #[serde(default)]
    params: serde_json::Value,
}

fn mcp_error(id: Option<serde_json::Value>, code: i64, message: &str) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": {
            "code": code,
            "message": message,
        }
    })
}

fn mcp_result(id: Option<serde_json::Value>, result: serde_json::Value) -> serde_json::Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": result,
    })
}

fn mcp_tools_list() -> serde_json::Value {
    serde_json::json!([
        {
            "name": "get_canvas",
            "description": "Get the full canvas state including all shapes, viewport, and groups",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "additionalProperties": false,
            }
        },
        {
            "name": "list_shapes",
            "description": "List all shapes on the canvas, optionally filtered by type",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "description": "Filter by shape type (rectangle, ellipse, triangle, diamond, hexagon, star, cloud, cylinder, sticky, line, arrow, freedraw, text)",
                        "enum": ["rectangle", "ellipse", "triangle", "diamond", "hexagon", "star", "cloud", "cylinder", "sticky", "line", "arrow", "freedraw", "text"]
                    }
                },
                "additionalProperties": false,
            }
        },
        {
            "name": "get_shape",
            "description": "Get a single shape by its ID",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "Shape ID" }
                },
                "required": ["id"],
                "additionalProperties": false,
            }
        },
        {
            "name": "create_shape",
            "description": "Create a new shape on the canvas. For geometric shapes (rectangle, ellipse, triangle, diamond, hexagon, star, cloud, cylinder) provide x, y, width, height. For sticky notes, also provide text and optionally stickyColor. For text shapes, provide text, fontSize. Returns the created shape.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "description": "Shape type to create",
                        "enum": ["rectangle", "ellipse", "triangle", "diamond", "hexagon", "star", "cloud", "cylinder", "sticky", "text"]
                    },
                    "x": { "type": "number", "description": "X position" },
                    "y": { "type": "number", "description": "Y position" },
                    "width": { "type": "number", "description": "Width (default: 200)" },
                    "height": { "type": "number", "description": "Height (default: 150)" },
                    "strokeColor": { "type": "string", "description": "Stroke color (default: #000000)" },
                    "strokeWidth": { "type": "number", "description": "Stroke width (default: 2)" },
                    "fillColor": { "type": "string", "description": "Fill color (default: transparent)" },
                    "opacity": { "type": "number", "description": "Opacity 0-1 (default: 1)" },
                    "roughness": { "type": "number", "description": "Roughness 0-3 (default: 1)" },
                    "text": { "type": "string", "description": "Text content" },
                    "fontSize": { "type": "number", "description": "Font size for text shapes (default: 20)" },
                    "stickyColor": { "type": "string", "description": "Sticky note background color" },
                    "rotation": { "type": "number", "description": "Rotation in degrees" },
                    "strokeStyle": { "type": "string", "description": "Stroke style", "enum": ["solid", "dashed", "dotted"] },
                    "fillStyle": { "type": "string", "description": "Fill style", "enum": ["hachure", "solid", "zigzag", "cross-hatch", "dots"] }
                },
                "required": ["type", "x", "y"],
                "additionalProperties": false,
            }
        },
        {
            "name": "update_shape",
            "description": "Update properties of an existing shape. Only provide the properties you want to change.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "Shape ID to update" },
                    "x": { "type": "number" },
                    "y": { "type": "number" },
                    "width": { "type": "number" },
                    "height": { "type": "number" },
                    "strokeColor": { "type": "string" },
                    "strokeWidth": { "type": "number" },
                    "fillColor": { "type": "string" },
                    "opacity": { "type": "number" },
                    "roughness": { "type": "number" },
                    "text": { "type": "string" },
                    "rotation": { "type": "number" },
                    "strokeStyle": { "type": "string" },
                    "fillStyle": { "type": "string" }
                },
                "required": ["id"],
                "additionalProperties": false,
            }
        },
        {
            "name": "delete_shape",
            "description": "Delete a shape by its ID",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "Shape ID to delete" }
                },
                "required": ["id"],
                "additionalProperties": false,
            }
        },
        {
            "name": "create_image",
            "description": "Add an image to the canvas from a URL or base64 data URL. Supports PNG, JPEG, SVG, GIF. The image is embedded in the canvas.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "url": { "type": "string", "description": "Image source: an http/https URL or a base64 data URL (e.g. data:image/png;base64,...)" },
                    "x": { "type": "number", "description": "X position (default: 0)" },
                    "y": { "type": "number", "description": "Y position (default: 0)" },
                    "width": { "type": "number", "description": "Width (optional, auto-calculated from image if omitted)" },
                    "height": { "type": "number", "description": "Height (optional, auto-calculated from image if omitted)" }
                },
                "required": ["url"],
                "additionalProperties": false,
            }
        },
        {
            "name": "create_connection",
            "description": "Create a line or arrow connecting two shapes. The connection will bind to the shapes' connection points.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "fromShapeId": { "type": "string", "description": "Source shape ID" },
                    "toShapeId": { "type": "string", "description": "Target shape ID" },
                    "connectionType": {
                        "type": "string",
                        "description": "Type of connection (default: arrow)",
                        "enum": ["arrow", "line"]
                    },
                    "routingMode": {
                        "type": "string",
                        "description": "Line routing mode (default: direct)",
                        "enum": ["direct", "elbow", "curved"]
                    },
                    "text": { "type": "string", "description": "Label text on the connection" },
                    "strokeColor": { "type": "string" },
                    "strokeWidth": { "type": "number" }
                },
                "required": ["fromShapeId", "toShapeId"],
                "additionalProperties": false,
            }
        },
        {
            "name": "set_viewport",
            "description": "Set the canvas viewport (pan and zoom)",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "x": { "type": "number", "description": "Pan X offset" },
                    "y": { "type": "number", "description": "Pan Y offset" },
                    "zoom": { "type": "number", "description": "Zoom level (0.1 to 10)" }
                },
                "additionalProperties": false,
            }
        },
        {
            "name": "select_shapes",
            "description": "Select shapes on the canvas by their IDs",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "ids": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "Array of shape IDs to select"
                    }
                },
                "required": ["ids"],
                "additionalProperties": false,
            }
        },
        {
            "name": "list_tabs",
            "description": "List all open tabs",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "additionalProperties": false,
            }
        },
        {
            "name": "create_tab",
            "description": "Create a new tab",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "Tab title (default: Untitled)" }
                },
                "additionalProperties": false,
            }
        },
        {
            "name": "switch_tab",
            "description": "Switch to a different tab",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tabId": { "type": "string", "description": "Tab ID to switch to" }
                },
                "required": ["tabId"],
                "additionalProperties": false,
            }
        },
        {
            "name": "rename_tab",
            "description": "Rename a tab",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tabId": { "type": "string", "description": "Tab ID to rename" },
                    "title": { "type": "string", "description": "New title for the tab" }
                },
                "required": ["tabId", "title"],
                "additionalProperties": false,
            }
        },
        {
            "name": "bring_to_front",
            "description": "Move a shape to the top of the z-order (renders on top of all other shapes)",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "Shape ID to bring to front" }
                },
                "required": ["id"],
                "additionalProperties": false,
            }
        },
        {
            "name": "send_to_back",
            "description": "Move a shape to the bottom of the z-order (renders behind all other shapes)",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "Shape ID to send to back" }
                },
                "required": ["id"],
                "additionalProperties": false,
            }
        },
        {
            "name": "bring_forward",
            "description": "Move a shape one layer forward in z-order",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "Shape ID to bring forward" }
                },
                "required": ["id"],
                "additionalProperties": false,
            }
        },
        {
            "name": "send_backward",
            "description": "Move a shape one layer backward in z-order",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "Shape ID to send backward" }
                },
                "required": ["id"],
                "additionalProperties": false,
            }
        },
        {
            "name": "group_shapes",
            "description": "Group multiple shapes together",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "ids": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "Array of shape IDs to group (minimum 2)"
                    }
                },
                "required": ["ids"],
                "additionalProperties": false,
            }
        },
        {
            "name": "ungroup",
            "description": "Ungroup a shape group",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "groupId": { "type": "string", "description": "Group ID to ungroup" }
                },
                "required": ["groupId"],
                "additionalProperties": false,
            }
        },
        {
            "name": "clear_canvas",
            "description": "Clear all shapes from the canvas",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "additionalProperties": false,
            }
        },
        {
            "name": "batch_operations",
            "description": "Perform multiple create/update/delete operations in a single batch. Each operation specifies an action and the relevant data.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "operations": {
                        "type": "array",
                        "description": "Array of operations to perform",
                        "items": {
                            "type": "object",
                            "properties": {
                                "action": {
                                    "type": "string",
                                    "enum": ["create", "update", "delete"]
                                },
                                "data": {
                                    "type": "object",
                                    "description": "Shape data for create/update, or {id} for delete"
                                }
                            },
                            "required": ["action", "data"]
                        }
                    }
                },
                "required": ["operations"],
                "additionalProperties": false,
            }
        },
        {
            "name": "reorganize",
            "description": "Reorganize shapes on the canvas using an automatic layout algorithm. Applies to selected shape IDs (or all shapes if none specified). Supports grid layout (arranges shapes in a neat grid) and force-directed layout (positions shapes based on their connections). Bound arrows are automatically updated after layout.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "algorithm": {
                        "type": "string",
                        "description": "Layout algorithm to use",
                        "enum": ["grid", "force-directed"]
                    },
                    "shapeIds": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "Shape IDs to reorganize. If omitted, all shapes are reorganized."
                    },
                    "padding": { "type": "number", "description": "Padding between shapes for grid layout (default: 40)" },
                    "iterations": { "type": "number", "description": "Number of iterations for force-directed layout (default: 100)" }
                },
                "required": ["algorithm"],
                "additionalProperties": false,
            }
        },
        {
            "name": "set_snap_settings",
            "description": "Configure snapping behavior. Controls snap-to-grid, alignment hints (visual guide lines when edges/centers align), and object snap (magnetic snap to aligned positions).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "snapToGrid": { "type": "boolean", "description": "Enable/disable snap to grid (20px grid)" },
                    "alignmentHints": { "type": "boolean", "description": "Enable/disable alignment guide lines" },
                    "objectSnap": { "type": "boolean", "description": "Enable/disable magnetic snap to aligned shapes" }
                },
                "additionalProperties": false,
            }
        }
    ])
}

// --- MCP method dispatch ---

async fn handle_mcp_method(
    state: &SharedApiState,
    req: McpJsonRpcRequest,
) -> serde_json::Value {
    match req.method.as_str() {
        "initialize" => {
            mcp_result(req.id, serde_json::json!({
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": MCP_SERVER_NAME,
                    "version": MCP_SERVER_VERSION,
                }
            }))
        }
        "notifications/initialized" => {
            serde_json::Value::Null
        }
        "ping" => {
            mcp_result(req.id, serde_json::json!({}))
        }
        "tools/list" => {
            mcp_result(req.id, serde_json::json!({
                "tools": mcp_tools_list()
            }))
        }
        "tools/call" => {
            let tool_name = req.params.get("name")
                .and_then(|n| n.as_str())
                .unwrap_or("");
            let arguments = req.params.get("arguments")
                .cloned()
                .unwrap_or(serde_json::json!({}));

            let result = bridge_tool_call(state, tool_name, arguments).await;
            match result {
                Ok(content) => mcp_result(req.id, serde_json::json!({
                    "content": [{
                        "type": "text",
                        "text": serde_json::to_string_pretty(&content).unwrap_or_default()
                    }]
                })),
                Err(msg) => mcp_result(req.id, serde_json::json!({
                    "isError": true,
                    "content": [{
                        "type": "text",
                        "text": msg
                    }]
                })),
            }
        }
        _ => {
            mcp_error(req.id, -32601, &format!("Method not found: {}", req.method))
        }
    }
}

// --- HTTP handlers ---

async fn mcp_post_handler(
    AxumState(state): AxumState<SharedApiState>,
    Json(body): Json<serde_json::Value>,
) -> Response {
    if body.is_array() {
        let requests: Vec<McpJsonRpcRequest> = match serde_json::from_value(body) {
            Ok(r) => r,
            Err(e) => {
                let err = mcp_error(None, -32700, &format!("Parse error: {}", e));
                return Json(err).into_response();
            }
        };

        let mut results = Vec::new();
        for req in requests {
            let result = handle_mcp_method(&state, req).await;
            if !result.is_null() {
                results.push(result);
            }
        }
        Json(serde_json::Value::Array(results)).into_response()
    } else {
        let req: McpJsonRpcRequest = match serde_json::from_value(body) {
            Ok(r) => r,
            Err(e) => {
                let err = mcp_error(None, -32700, &format!("Parse error: {}", e));
                return Json(err).into_response();
            }
        };

        let is_notification = req.id.is_none();
        let result = handle_mcp_method(&state, req).await;

        if is_notification || result.is_null() {
            StatusCode::ACCEPTED.into_response()
        } else {
            Json(result).into_response()
        }
    }
}

async fn mcp_sse_handler(
    AxumState(_state): AxumState<SharedApiState>,
) -> Sse<impl tokio_stream::Stream<Item = Result<SseEvent, std::convert::Infallible>>> {
    let stream = tokio_stream::once(Ok(SseEvent::default().data(
        serde_json::to_string(&serde_json::json!({
            "jsonrpc": "2.0",
            "method": "notifications/ready",
        }))
        .unwrap(),
    )));

    let stream = stream.chain(tokio_stream::pending());
    Sse::new(stream).keep_alive(KeepAlive::default())
}

// --- Public helpers for lib.rs ---

pub fn create_api_state(app_handle: tauri::AppHandle) -> SharedApiState {
    Arc::new(ApiState {
        pending: Arc::new(Mutex::new(HashMap::new())),
        app_handle,
        server_shutdown: Arc::new(Mutex::new(None)),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mcp_error_has_correct_structure() {
        let err = mcp_error(Some(serde_json::json!(1)), -32601, "Method not found");
        assert_eq!(err["jsonrpc"], "2.0");
        assert_eq!(err["id"], 1);
        assert_eq!(err["error"]["code"], -32601);
        assert_eq!(err["error"]["message"], "Method not found");
    }

    #[test]
    fn mcp_error_with_null_id() {
        let err = mcp_error(None, -32700, "Parse error");
        assert!(err["id"].is_null());
        assert_eq!(err["error"]["code"], -32700);
    }

    #[test]
    fn mcp_result_has_correct_structure() {
        let res = mcp_result(Some(serde_json::json!(42)), serde_json::json!({"ok": true}));
        assert_eq!(res["jsonrpc"], "2.0");
        assert_eq!(res["id"], 42);
        assert_eq!(res["result"]["ok"], true);
    }

    #[test]
    fn mcp_tools_list_returns_expected_count() {
        let tools = mcp_tools_list();
        let arr = tools.as_array().expect("tools list should be an array");
        assert_eq!(arr.len(), 24);
    }

    #[test]
    fn mcp_tools_list_entries_have_required_fields() {
        let tools = mcp_tools_list();
        for tool in tools.as_array().unwrap() {
            assert!(tool["name"].is_string(), "tool missing name");
            assert!(tool["description"].is_string(), "tool missing description");
            assert!(tool["inputSchema"].is_object(), "tool missing inputSchema");
            assert_eq!(tool["inputSchema"]["type"], "object");
        }
    }

    #[test]
    fn mcp_tools_list_contains_expected_tools() {
        let tools = mcp_tools_list();
        let names: Vec<&str> = tools
            .as_array()
            .unwrap()
            .iter()
            .map(|t| t["name"].as_str().unwrap())
            .collect();

        let expected = [
            "get_canvas",
            "list_shapes",
            "get_shape",
            "create_shape",
            "update_shape",
            "delete_shape",
            "create_image",
            "create_connection",
            "set_viewport",
            "select_shapes",
            "list_tabs",
            "create_tab",
            "switch_tab",
            "rename_tab",
            "bring_to_front",
            "send_to_back",
            "bring_forward",
            "send_backward",
            "group_shapes",
            "ungroup",
            "clear_canvas",
            "batch_operations",
            "reorganize",
            "set_snap_settings",
        ];
        for name in &expected {
            assert!(names.contains(name), "missing tool: {}", name);
        }
    }
}

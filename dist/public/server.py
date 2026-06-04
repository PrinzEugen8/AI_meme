from __future__ import annotations

import argparse
import asyncio
import gzip
import hashlib
import json
import os
from pathlib import Path
import struct
import sys
from time import perf_counter, time
import uuid
from typing import Any


def _ensure_repo_root() -> Path:
    here = Path(__file__).resolve().parent
    for root in (here.parent, here.parent.parent):
        if (root / "neko_room").is_dir():
            root_str = str(root)
            if root_str not in sys.path:
                sys.path.insert(0, root_str)
            return root
    return here.parent


_REPO_ROOT = _ensure_repo_root()

from fastapi import FastAPI, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


DEFAULT_ASR_ENDPOINT = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel"
DEFAULT_ASR_RESOURCE = "volc.seedasr.sauc.duration"
DEFAULT_TTS_ENDPOINT = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
ASR_UPSTREAM_FIRST_AUDIO_STALE_MS = 8000
ASR_FORWARD_AUDIO_GAP_WARN_MS = 3000

MESSAGE_TYPE_FULL_CLIENT_REQUEST = 0x1
MESSAGE_TYPE_AUDIO_ONLY_REQUEST = 0x2
MESSAGE_TYPE_FULL_SERVER_RESPONSE = 0x9
MESSAGE_TYPE_SERVER_ERROR = 0xF
FLAG_POS_SEQUENCE = 0x1
FLAG_NEG_SEQUENCE = 0x3
SERIALIZATION_NONE = 0x0
SERIALIZATION_JSON = 0x1
COMPRESSION_GZIP = 0x1

app = FastAPI(title="AI Meme Neko Public Relay")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Relay-Elapsed-Ms", "X-Relay-Http-Client", "X-Relay-Request-Id"],
)

_HTTP_CLIENT: Any | None = None


@app.get("/relay/health")
async def relay_health() -> dict[str, bool]:
    _write_relay_log({"route": "health", "status": "ok"})
    return {"ok": True}


@app.post("/relay/client-event")
async def relay_client_event(payload: dict[str, Any]) -> dict[str, bool]:
    safe: dict[str, Any] = {
        "route": "client_event",
        "event": str(payload.get("event") or "client_event")[:80],
    }
    allowed = {
        "mode",
        "rhythm",
        "action",
        "confidence",
        "reason",
        "text_chars",
        "text_hash",
        "text_preview",
        "reply_chars",
        "reply_hash",
        "reply_preview",
        "turn_id",
        "source",
        "buffer_items",
        "wait_ms",
        "delay_ms",
        "elapsed_ms",
        "relay_ms",
        "status",
        "ok",
        "prompt_chars",
        "temperature",
        "max_tokens",
        "purpose",
        "audio_bytes",
    }
    for key in allowed:
        if key not in payload:
            continue
        value = payload.get(key)
        if isinstance(value, (int, float, bool)):
            safe[key] = value
        else:
            safe[key] = str(value or "")[:160]
    _write_relay_log(safe)
    return {"ok": True}


async def _http_client() -> Any:
    global _HTTP_CLIENT
    client = _HTTP_CLIENT
    if client is not None and not getattr(client, "is_closed", False):
        return client
    import httpx

    _HTTP_CLIENT = httpx.AsyncClient(
        timeout=httpx.Timeout(60.0, connect=10.0),
        limits=httpx.Limits(max_connections=100, max_keepalive_connections=20, keepalive_expiry=60.0),
    )
    return _HTTP_CLIENT


def _relay_headers(started: float, request_id: str | None = None) -> dict[str, str]:
    elapsed_ms = int((perf_counter() - started) * 1000)
    headers = {
        "X-Relay-Elapsed-Ms": str(max(0, elapsed_ms)),
        "X-Relay-Http-Client": "httpx-shared",
    }
    if request_id:
        headers["X-Relay-Request-Id"] = request_id
    return headers


@app.on_event("shutdown")
async def _shutdown_http_client() -> None:
    global _HTTP_CLIENT
    client = _HTTP_CLIENT
    _HTTP_CLIENT = None
    if client is not None:
        await client.aclose()


@app.post("/relay/llm")
async def relay_llm(payload: dict[str, Any]) -> Response:
    started = perf_counter()
    request_id = str(uuid.uuid4())
    api_base = ""
    provider = ""
    model = ""
    messages: Any = []
    thinking_disabled = False
    try:
        api_key = _required(payload, "api_key")
        api_base = _normalize_openai_base(str(payload.get("api_base") or ""))
        provider = str(payload.get("provider") or "")
        model = str(payload.get("model") or "")
        messages = payload.get("messages") or []
        body = {
            "model": model,
            "messages": messages,
            "temperature": payload.get("temperature", 0.2),
            "max_tokens": payload.get("max_tokens", 160),
            "response_format": payload.get("response_format") or {"type": "json_object"},
        }
        thinking_disabled = _should_disable_thinking(provider=provider, api_base=api_base, model=model)
        if thinking_disabled:
            body["thinking"] = {"type": "disabled"}
        client = await _http_client()
        response = await client.post(
            f"{api_base}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=body,
        )
        _write_relay_log(
            {
                "route": "llm",
                "request_id": request_id,
                "status": response.status_code,
                "elapsed_ms": _elapsed_ms(started),
                "provider": provider,
                "model": model,
                "thinking_disabled": thinking_disabled,
                "prompt_chars": _messages_char_count(messages),
                "prompt_hash": _hash_json(messages),
                "response_bytes": len(response.content or b""),
            }
        )
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/json"),
            headers=_relay_headers(started, request_id),
        )
    except Exception as exc:
        _write_relay_log(
            {
                "route": "llm",
                "request_id": request_id,
                "status": "error",
                "elapsed_ms": _elapsed_ms(started),
                "provider": provider,
                "model": model,
                "thinking_disabled": thinking_disabled,
                "prompt_chars": _messages_char_count(messages),
                "prompt_hash": _hash_json(messages) if messages else "",
                "error_type": type(exc).__name__,
            }
        )
        raise


@app.post("/relay/volc-tts")
async def relay_volc_tts(payload: dict[str, Any]) -> Response:
    started = perf_counter()
    request_id = str(uuid.uuid4())
    voice = ""
    text = ""
    resource_id = ""
    purpose = str(payload.get("purpose") or "")
    meme_id = str(payload.get("meme_id") or "")
    try:
        appid = _required(payload, "appid")
        token = _required(payload, "access_token")
        voice = _required(payload, "voice_type")
        text = _required(payload, "text")
        resource_id = str(payload.get("resource_id") or "volc.megatts.default")
        endpoint = str(payload.get("endpoint") or DEFAULT_TTS_ENDPOINT)
        body = {
            "user": {"uid": "public_web"},
            "req_params": {
                "text": text,
                "speaker": voice,
                "audio_params": {
                    "format": "mp3",
                    "sample_rate": int(payload.get("sample_rate") or 24000),
                    "speech_rate": 1,
                    "speed_ratio": float(payload.get("speed_ratio") or 1),
                    "volume_ratio": float(payload.get("volume_ratio") or 1),
                    "pitch_ratio": float(payload.get("pitch_ratio") or 1),
                },
            },
        }
        headers = {
            "Content-Type": "application/json",
            "X-Api-App-Id": appid,
            "X-Api-App-Key": appid,
            "X-Api-Access-Key": token,
            "X-Api-Resource-Id": resource_id,
            "X-Api-Request-Id": request_id,
        }
        client = await _http_client()
        response = await client.post(endpoint, headers=headers, json=body)
        _write_relay_log(
            {
                "route": "volc_tts",
                "request_id": request_id,
                "status": response.status_code,
                "elapsed_ms": _elapsed_ms(started),
                "purpose": purpose,
                "meme_id": meme_id,
                "voice_type": voice,
                "resource_id": resource_id,
                "text_chars": len(text),
                "text_hash": _hash_text(text),
                "audio_bytes": len(response.content or b""),
            }
        )
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type=response.headers.get("content-type", "application/octet-stream"),
            headers=_relay_headers(started, request_id),
        )
    except Exception as exc:
        _write_relay_log(
            {
                "route": "volc_tts",
                "request_id": request_id,
                "status": "error",
                "elapsed_ms": _elapsed_ms(started),
                "purpose": purpose,
                "meme_id": meme_id,
                "voice_type": voice,
                "resource_id": resource_id,
                "text_chars": len(text),
                "text_hash": _hash_text(text) if text else "",
                "error_type": type(exc).__name__,
            }
        )
        raise


@app.websocket("/relay/volc-asr")
async def relay_volc_asr(client: WebSocket) -> None:
    started = perf_counter()
    request_id = str(uuid.uuid4())
    asr_state = _new_asr_state()
    asr_state["request_id"] = request_id
    endpoint = DEFAULT_ASR_ENDPOINT
    resource_id = DEFAULT_ASR_RESOURCE
    await client.accept()
    _log_asr_event(asr_state, started, "client_ws_accepted", endpoint=endpoint, resource_id=resource_id)
    try:
        start = await client.receive_json()
    except Exception:
        await client.send_json({"type": "error", "message": "ASR relay 缺少启动参数。"})
        await client.close()
        _log_asr_close(asr_state, started, status="start_error", endpoint=endpoint, resource_id=resource_id, error_type="missing_start")
        return

    api_key = str(start.get("api_key") or start.get("access_token") or "").strip()
    endpoint = str(start.get("endpoint") or DEFAULT_ASR_ENDPOINT).strip()
    resource_id = str(start.get("resource_id") or DEFAULT_ASR_RESOURCE).strip()
    sample_rate = int(start.get("sample_rate") or 16000)
    end_window_size = int(start.get("end_window_size") or 1200)
    continuous_streaming = bool(start.get("continuous_streaming"))
    packet_target_ms = int(start.get("packet_target_ms") or 0)
    start_reason = str(start.get("reason") or "speech").strip()[:80] or "speech"
    asr_state["client_start_reason"] = start_reason
    asr_state["continuous_streaming"] = continuous_streaming
    asr_state["packet_target_ms"] = packet_target_ms
    if "reconnect" in start_reason or "rotate" in start_reason:
        asr_state["reconnect_reason"] = start_reason
    _log_asr_event(
        asr_state,
        started,
        "client_start_received",
        endpoint=endpoint,
        resource_id=resource_id,
        sample_rate=sample_rate,
        end_window_size=end_window_size,
        continuous_streaming=continuous_streaming,
        packet_target_ms=packet_target_ms,
        client_start_reason=start_reason,
        has_api_key=bool(api_key),
    )
    start_event = _asr_client_note_event(start_reason)
    if start_event != "client_note":
        _log_asr_event(
            asr_state,
            started,
            start_event,
            endpoint=endpoint,
            resource_id=resource_id,
            client_start_reason=start_reason,
        )
    if not api_key:
        await client.send_json({"type": "error", "message": "ASR relay 缺少火山 API Key（新版控制台）。"})
        await client.close()
        _log_asr_close(asr_state, started, status="start_error", endpoint=endpoint, resource_id=resource_id, error_type="missing_api_key")
        return

    try:
        import websockets
    except Exception:
        await client.send_json({"type": "error", "message": "服务端缺少 websockets 依赖。"})
        await client.close()
        _log_asr_close(asr_state, started, status="start_error", endpoint=endpoint, resource_id=resource_id, error_type="missing_websockets")
        return

    # 新版控制台 https://www.volcengine.com/docs/6561/1354869
    headers = {
        "X-Api-Key": api_key,
        "X-Api-Resource-Id": resource_id,
        "X-Api-Request-Id": request_id,
        "X-Api-Sequence": "-1",
    }
    try:
        asr_state["upstream_connect_started_at"] = perf_counter()
        _log_asr_event(asr_state, started, "upstream_connect_start", endpoint=endpoint, resource_id=resource_id)
        upstream = await _connect_websocket(websockets, endpoint, headers)
    except Exception as exc:
        asr_state["connect_error_detail"] = _safe_error(exc)
        _log_asr_event(
            asr_state,
            started,
            "upstream_connect_error",
            endpoint=endpoint,
            resource_id=resource_id,
            error_type=type(exc).__name__,
            error_detail=_safe_error(exc),
            connect_elapsed_ms=_state_delta_ms(asr_state, "upstream_connect_started_at", None),
        )
        await client.send_json({"type": "error", "message": _asr_connect_error(exc)})
        await client.close()
        _log_asr_close(asr_state, started, status="connect_error", endpoint=endpoint, resource_id=resource_id, error_type=type(exc).__name__)
        return

    asr_state["upstream_connect_at"] = perf_counter()
    logid = _response_header(upstream, "X-Tt-Logid")
    _log_asr_event(
        asr_state,
        started,
        "upstream_connect_ok",
        endpoint=endpoint,
        resource_id=resource_id,
        logid=logid,
        connect_elapsed_ms=_state_delta_ms(asr_state, "upstream_connect_started_at", "upstream_connect_at"),
    )

    async with upstream:
        asr_state["upstream_init_sent_at"] = perf_counter()
        try:
            await upstream.send(_full_client_request(sample_rate=sample_rate, end_window_size=end_window_size))
            _log_asr_event(asr_state, started, "upstream_init_sent", endpoint=endpoint, resource_id=resource_id, logid=logid)
            first = await upstream.recv()
        except Exception as exc:
            detail = _safe_error(exc)
            asr_state["close_error_detail"] = detail
            _log_asr_event(
                asr_state,
                started,
                "upstream_init_error",
                endpoint=endpoint,
                resource_id=resource_id,
                logid=logid,
                error_type=type(exc).__name__,
                error_detail=detail,
                upstream_init_ms=_state_delta_ms(asr_state, "upstream_init_sent_at", None),
            )
            try:
                await client.send_json({"type": "error", "message": f"火山 ASR 初始化失败：{detail}"})
                await client.close()
            except Exception:
                pass
            _log_asr_close(asr_state, started, status="upstream_error", endpoint=endpoint, resource_id=resource_id, logid=logid, error_type=type(exc).__name__)
            return
        parsed = _parse_server_message(first, asr_state)
        first_error = next((item for item in parsed if item.get("type") == "error"), None)
        if first_error:
            detail = first_error.get("message") or "火山 ASR 初始化失败。"
            if logid:
                detail += f"（logid: {logid}）"
            await client.send_json({"type": "error", "message": detail})
            await client.close()
            _log_asr_event(
                asr_state,
                started,
                "upstream_init_error",
                endpoint=endpoint,
                resource_id=resource_id,
                logid=logid,
                error_type="initial_server_error",
                **_asr_text_log_fields(detail, field="error"),
            )
            _log_asr_close(asr_state, started, status="upstream_error", endpoint=endpoint, resource_id=resource_id, logid=logid, error_type="initial_server_error")
            return
        asr_state["upstream_ready_at"] = perf_counter()
        _log_asr_event(
            asr_state,
            started,
            "upstream_init_ok",
            endpoint=endpoint,
            resource_id=resource_id,
            logid=logid,
            upstream_init_ms=_state_delta_ms(asr_state, "upstream_init_sent_at", "upstream_ready_at"),
        )
        await client.send_json({"type": "ready", "request_id": request_id})
        _log_asr_event(
            asr_state,
            started,
            "ready_sent",
            endpoint=endpoint,
            resource_id=resource_id,
            logid=logid,
        )
        browser_task = asyncio.create_task(_browser_to_upstream(client, upstream, asr_state, started, endpoint, resource_id, logid))
        upstream_task = asyncio.create_task(_upstream_to_browser(upstream, client, asr_state, started, endpoint, resource_id, logid))
        done, pending = await asyncio.wait({browser_task, upstream_task}, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
        for task in done:
            try:
                task.result()
            except Exception as exc:
                if not asr_state.get("close_error_detail"):
                    asr_state["close_error_detail"] = _safe_error(exc)
    _log_asr_event(asr_state, started, "relay_closed", endpoint=endpoint, resource_id=resource_id, logid=logid)
    _log_asr_close(asr_state, started, status="closed", endpoint=endpoint, resource_id=resource_id, logid=logid)


def _response_header(ws: Any, name: str) -> str:
    for attr in ("response_headers",):
        container = getattr(ws, attr, None)
        if container is not None:
            try:
                value = container.get(name) or container.get(name.lower())
                if value:
                    return str(value)
            except Exception:
                pass
    response = getattr(ws, "response", None)
    headers = getattr(response, "headers", None)
    if headers is not None:
        try:
            return str(headers.get(name) or headers.get(name.lower()) or "")
        except Exception:
            return ""
    return ""


async def _connect_websocket(websockets_module: Any, endpoint: str, headers: dict[str, str]) -> Any:
    clean_headers = {key: value for key, value in headers.items() if key.lower() != "host"}
    try:
        return await websockets_module.connect(endpoint, additional_headers=clean_headers, max_size=None)
    except TypeError:
        return await websockets_module.connect(endpoint, extra_headers=clean_headers, max_size=None)


def _asr_connect_error(exc: Exception) -> str:
    message = _safe_error(exc)
    lowered = message.lower()
    if "400" in message or "rejected" in lowered or "bad status" in lowered:
        message += (
            "。请确认新版控制台 API Key 正确、已开通大模型流式语音识别，"
            "Resource ID 与开通版本一致（2.0 小时版：volc.seedasr.sauc.duration）。"
        )
    return f"连接火山 ASR 失败：{message}"


async def _browser_to_upstream(
    client: WebSocket,
    upstream: Any,
    asr_state: dict[str, Any],
    started: float,
    endpoint: str,
    resource_id: str,
    logid: str,
) -> None:
    sequence = 1
    while True:
        try:
            message = await client.receive()
        except WebSocketDisconnect as exc:
            asr_state["client_disconnect_code"] = getattr(exc, "code", None)
            asr_state["client_stop_reason"] = asr_state.get("client_stop_reason") or _asr_disconnect_reason(asr_state)
            _log_asr_event(
                asr_state,
                started,
                "client_disconnect",
                endpoint=endpoint,
                resource_id=resource_id,
                logid=logid,
                client_disconnect_code=asr_state.get("client_disconnect_code"),
                client_stop_reason=asr_state.get("client_stop_reason"),
            )
            break
        if message.get("type") == "websocket.disconnect":
            asr_state["client_stop_reason"] = asr_state.get("client_stop_reason") or _asr_disconnect_reason(asr_state)
            _log_asr_event(
                asr_state,
                started,
                "client_disconnect",
                endpoint=endpoint,
                resource_id=resource_id,
                logid=logid,
                client_stop_reason=asr_state.get("client_stop_reason"),
            )
            break
        if message.get("bytes") is not None:
            chunk = message["bytes"] or b""
            asr_state["audio_bytes_in"] = int(asr_state.get("audio_bytes_in", 0)) + len(chunk)
            if chunk and not asr_state.get("first_browser_audio_at"):
                asr_state["first_browser_audio_at"] = perf_counter()
                _log_asr_event(
                    asr_state,
                    started,
                    "first_browser_audio",
                    endpoint=endpoint,
                    resource_id=resource_id,
                    logid=logid,
                    audio_bytes=len(chunk),
                    audio_bytes_in=asr_state["audio_bytes_in"],
                )
            near_zero = _is_near_zero_pcm16(chunk)
            if near_zero and not asr_state.get("continuous_streaming"):
                asr_state["dropped_zero_audio_bytes"] = int(asr_state.get("dropped_zero_audio_bytes", 0)) + len(chunk)
                continue
            if near_zero:
                asr_state["near_zero_audio_bytes_forwarded"] = int(asr_state.get("near_zero_audio_bytes_forwarded", 0)) + len(chunk)
            now = perf_counter()
            if not asr_state.get("first_forwarded_audio_at"):
                ready_at = float(asr_state.get("upstream_ready_at") or 0.0)
                ready_to_first_audio_ms = int(max(0, (now - ready_at) * 1000)) if ready_at else None
                asr_state["ready_to_first_audio_ms"] = ready_to_first_audio_ms
                if (
                    ready_to_first_audio_ms is not None
                    and ready_to_first_audio_ms > ASR_UPSTREAM_FIRST_AUDIO_STALE_MS
                    and not asr_state.get("continuous_streaming")
                ):
                    asr_state["stale_before_first_audio"] = True
                    asr_state["client_stop_reason"] = asr_state.get("client_stop_reason") or "server_stale_before_first_audio"
                    message_text = "火山 ASR ready 后空闲过久，正在换新连接。"
                    _remember_asr_error(asr_state, message_text, error_type="ready_idle_stale")
                    _log_asr_event(
                        asr_state,
                        started,
                        "stale_before_first_audio",
                        endpoint=endpoint,
                        resource_id=resource_id,
                        logid=logid,
                        audio_bytes=len(chunk),
                        audio_bytes_in=asr_state["audio_bytes_in"],
                        ready_to_first_audio_ms=ready_to_first_audio_ms,
                    )
                    if not asr_state.get("asr_error_sent"):
                        asr_state["asr_error_sent"] = True
                        try:
                            await client.send_json({
                                "type": "error",
                                "code": "ready_idle_stale",
                                "message": message_text,
                            })
                        except Exception as exc:
                            asr_state["close_error_detail"] = asr_state.get("close_error_detail") or _safe_error(exc)
                    break
                asr_state["first_forwarded_audio_at"] = now
                asr_state["first_audio_at"] = now
                _log_asr_event(
                    asr_state,
                    started,
                    "first_forwarded_audio",
                    endpoint=endpoint,
                    resource_id=resource_id,
                    logid=logid,
                    audio_bytes=len(chunk),
                    sequence=sequence + 1,
                )
            previous_forwarded_at = float(asr_state.get("last_forwarded_audio_at") or 0.0)
            if previous_forwarded_at:
                gap_ms = int(max(0, (now - previous_forwarded_at) * 1000))
                asr_state["max_forward_audio_gap_ms"] = max(
                    int(asr_state.get("max_forward_audio_gap_ms", 0)),
                    gap_ms,
                )
                if gap_ms > ASR_FORWARD_AUDIO_GAP_WARN_MS:
                    asr_state["large_audio_gap_count"] = int(asr_state.get("large_audio_gap_count", 0)) + 1
                    asr_state["last_large_audio_gap_ms"] = gap_ms
                    _log_asr_event(
                        asr_state,
                        started,
                        "forwarded_audio_gap",
                        endpoint=endpoint,
                        resource_id=resource_id,
                        logid=logid,
                        gap_ms=gap_ms,
                        audio_bytes=len(chunk),
                        sequence=sequence + 1,
                        large_audio_gap_count=asr_state["large_audio_gap_count"],
                        last_client_note_reason=asr_state.get("last_client_note_reason", ""),
                    )
            asr_state["last_audio_at"] = now
            asr_state["last_forwarded_audio_at"] = now
            sequence += 1
            asr_state["audio_bytes_forwarded"] = int(asr_state.get("audio_bytes_forwarded", 0)) + len(chunk)
            asr_state["forwarded_packet_count"] = int(asr_state.get("forwarded_packet_count", 0)) + 1
            await upstream.send(_audio_packet(chunk, sequence=sequence))
        elif message.get("text"):
            try:
                payload = json.loads(message["text"])
            except json.JSONDecodeError:
                continue
            if payload.get("type") == "client_note":
                reason = str(payload.get("reason") or "client_note")[:80]
                asr_state["last_client_note_reason"] = reason
                if "reconnect" in reason or "rotate" in reason:
                    asr_state["reconnect_reason"] = reason
                _log_asr_event(
                    asr_state,
                    started,
                    _asr_client_note_event(reason),
                    endpoint=endpoint,
                    resource_id=resource_id,
                    logid=logid,
                    client_note_reason=reason,
                )
                continue
            if payload.get("type") == "stop":
                asr_state["client_stop_reason"] = str(payload.get("reason") or "client_stop")[:80]
                _log_asr_event(
                    asr_state,
                    started,
                    "client_stop",
                    endpoint=endpoint,
                    resource_id=resource_id,
                    logid=logid,
                    client_stop_reason=asr_state["client_stop_reason"],
                )
                stop_event = _asr_client_note_event(asr_state["client_stop_reason"])
                if stop_event != "client_note":
                    _log_asr_event(
                        asr_state,
                        started,
                        stop_event,
                        endpoint=endpoint,
                        resource_id=resource_id,
                        logid=logid,
                        client_stop_reason=asr_state["client_stop_reason"],
                    )
                await upstream.send(_audio_packet(b"", sequence=-(sequence + 1)))
                break


async def _upstream_to_browser(
    upstream: Any,
    client: WebSocket,
    asr_state: dict[str, Any],
    started: float,
    endpoint: str,
    resource_id: str,
    logid: str,
) -> None:
    try:
        async for message in upstream:
            parsed = _parse_server_message(message, asr_state)
            for item in parsed:
                kind = item.get("type")
                if kind == "partial" and not asr_state.get("logged_first_partial"):
                    asr_state["logged_first_partial"] = True
                    _log_asr_event(
                        asr_state,
                        started,
                        "first_partial",
                        endpoint=endpoint,
                        resource_id=resource_id,
                        logid=logid,
                        start_time=item.get("start_time"),
                        end_time=item.get("end_time"),
                        **_asr_text_log_fields(item.get("text", "")),
                    )
                elif kind == "final" and not asr_state.get("logged_first_final"):
                    asr_state["logged_first_final"] = True
                    _log_asr_event(
                        asr_state,
                        started,
                        "first_final",
                        endpoint=endpoint,
                        resource_id=resource_id,
                        logid=logid,
                        start_time=item.get("start_time"),
                        end_time=item.get("end_time"),
                        **_asr_text_log_fields(item.get("text", "")),
                    )
                elif kind == "error":
                    if asr_state.get("asr_error_sent"):
                        asr_state["duplicate_upstream_error_count"] = int(asr_state.get("duplicate_upstream_error_count", 0)) + 1
                        _log_asr_event(
                            asr_state,
                            started,
                            "upstream_server_error_duplicate",
                            endpoint=endpoint,
                            resource_id=resource_id,
                            logid=logid,
                            error_type=asr_state.get("last_asr_error_type", "server_error"),
                            duplicate_upstream_error_count=asr_state["duplicate_upstream_error_count"],
                            **_asr_text_log_fields(item.get("message", ""), field="error"),
                        )
                        continue
                    asr_state["asr_error_sent"] = True
                    _log_asr_event(
                        asr_state,
                        started,
                        "upstream_server_error",
                        endpoint=endpoint,
                        resource_id=resource_id,
                        logid=logid,
                        error_type=asr_state.get("last_asr_error_type", "server_error"),
                        **_asr_text_log_fields(item.get("message", ""), field="error"),
                    )
                    await client.send_json(item)
                    return
                await client.send_json(item)
    finally:
        close_code = getattr(upstream, "close_code", None)
        close_reason = getattr(upstream, "close_reason", "")
        if close_code is not None:
            asr_state["upstream_close_code"] = close_code
        if close_reason:
            asr_state["upstream_close_reason"] = str(close_reason)[:120]
        _log_asr_event(
            asr_state,
            started,
            "upstream_closed",
            endpoint=endpoint,
            resource_id=resource_id,
            logid=logid,
            upstream_close_code=asr_state.get("upstream_close_code"),
            upstream_close_reason=asr_state.get("upstream_close_reason", ""),
        )


def _full_client_request(sample_rate: int, end_window_size: int = 1200) -> bytes:
    payload = {
        "user": {"uid": "public_web"},
        "audio": {"format": "pcm", "codec": "raw", "rate": sample_rate, "bits": 16, "channel": 1},
        "request": {
            "model_name": "bigmodel",
            "enable_itn": True,
            "enable_punc": True,
            "show_utterances": True,
            "result_type": "single",
            "end_window_size": end_window_size,
        },
    }
    encoded = gzip.compress(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
    return _header(MESSAGE_TYPE_FULL_CLIENT_REQUEST, FLAG_POS_SEQUENCE, SERIALIZATION_JSON, COMPRESSION_GZIP) + struct.pack(">iI", 1, len(encoded)) + encoded


def _audio_packet(pcm: bytes, *, sequence: int) -> bytes:
    encoded = gzip.compress(pcm) if pcm else b""
    if sequence < 0:
        # Final packet: flags=0b0010, no sequence field.
        return (
            _header(MESSAGE_TYPE_AUDIO_ONLY_REQUEST, 0x2, SERIALIZATION_NONE, COMPRESSION_GZIP)
            + struct.pack(">I", len(encoded))
            + encoded
        )
    return (
        _header(MESSAGE_TYPE_AUDIO_ONLY_REQUEST, FLAG_POS_SEQUENCE, SERIALIZATION_NONE, COMPRESSION_GZIP)
        + struct.pack(">iI", sequence, len(encoded))
        + encoded
    )


def _is_near_zero_pcm16(chunk: bytes) -> bool:
    if len(chunk) < 32:
        return False
    sample_count = min(len(chunk) // 2, 800)
    peak = 0
    for index in range(sample_count):
        start = index * 2
        sample = int.from_bytes(chunk[start : start + 2], "little", signed=True)
        peak = max(peak, abs(sample))
        if peak > 3:
            return False
    return True


def _header(message_type: int, flags: int, serialization: int, compression: int) -> bytes:
    return bytes([(1 << 4) | 1, (message_type << 4) | flags, (serialization << 4) | compression, 0])


def _new_asr_state() -> dict[str, Any]:
    return {
        "sent_final_keys": set(),
        "last_partial_key": None,
        "final_texts": [],
        "final_norm_history": "",
        "final_end_watermark": None,
        "last_partial_norm": "",
        "partial_count": 0,
        "final_count": 0,
        "combined_final_count": 0,
        "stale_utterance_count": 0,
        "trimmed_cumulative_count": 0,
        "dropped_cumulative_count": 0,
        "audio_bytes_in": 0,
        "audio_bytes_forwarded": 0,
        "dropped_zero_audio_bytes": 0,
        "near_zero_audio_bytes_forwarded": 0,
        "forwarded_packet_count": 0,
        "continuous_streaming": False,
        "packet_target_ms": 0,
        "upstream_connect_started_at": 0.0,
        "upstream_connect_at": 0.0,
        "upstream_init_sent_at": 0.0,
        "upstream_ready_at": 0.0,
        "first_browser_audio_at": 0.0,
        "first_forwarded_audio_at": 0.0,
        "ready_to_first_audio_ms": None,
        "stale_before_first_audio": False,
        "last_forwarded_audio_at": 0.0,
        "max_forward_audio_gap_ms": 0,
        "large_audio_gap_count": 0,
        "last_large_audio_gap_ms": 0,
        "first_audio_at": 0.0,
        "last_audio_at": 0.0,
        "first_partial_at": 0.0,
        "first_final_at": 0.0,
        "logged_first_partial": False,
        "logged_first_final": False,
        "asr_error_count": 0,
        "asr_error_sent": False,
        "duplicate_upstream_error_count": 0,
        "last_asr_error": "",
        "last_asr_error_at": 0.0,
        "last_asr_error_type": "",
        "client_start_reason": "",
        "client_stop_reason": "",
        "reconnect_reason": "",
        "last_client_note_reason": "",
        "client_disconnect_code": None,
        "upstream_close_code": None,
        "upstream_close_reason": "",
        "connect_error_detail": "",
        "close_error_detail": "",
    }


def _mark_asr_emit(state: dict[str, Any], kind: str) -> None:
    key = "first_final_at" if kind == "final" else "first_partial_at"
    if not state.get(key):
        state[key] = perf_counter()


def _remember_asr_error(state: dict[str, Any], message: str, *, error_type: str = "server_error") -> None:
    clean = str(message or "").strip()
    state["asr_error_count"] = int(state.get("asr_error_count", 0)) + 1
    state["last_asr_error"] = clean[:240]
    state["last_asr_error_at"] = perf_counter()
    state["last_asr_error_type"] = error_type


def _parse_server_message(
    message: bytes | str,
    state: dict[str, Any],
) -> list[dict[str, Any]]:
    if isinstance(message, str):
        try:
            payload = json.loads(message)
        except json.JSONDecodeError:
            return []
        return _payload_to_client_messages(payload, final=False, state=state)
    data = bytes(message)
    if len(data) < 4:
        return []
    header_size = (data[0] & 0x0F) * 4
    message_type = data[1] >> 4
    flags = data[1] & 0x0F
    compression = data[2] & 0x0F
    cursor = header_size
    sequence = 0
    if len(data) >= cursor + 8:
        sequence = struct.unpack(">i", data[cursor : cursor + 4])[0]
        payload_size = struct.unpack(">I", data[cursor + 4 : cursor + 8])[0]
        cursor += 8
        payload = data[cursor : cursor + payload_size]
    else:
        payload = data[cursor:]
    if compression == COMPRESSION_GZIP and payload:
        try:
            payload = gzip.decompress(payload)
        except Exception:
            pass
    text = payload.decode("utf-8", errors="ignore") if payload else ""
    if message_type == MESSAGE_TYPE_SERVER_ERROR:
        clean_error = _clean_asr_error(text)
        _remember_asr_error(state, clean_error)
        return [{"type": "error", "message": clean_error}]
    if message_type != MESSAGE_TYPE_FULL_SERVER_RESPONSE:
        return []
    try:
        decoded = json.loads(text)
    except json.JSONDecodeError:
        return []
    return _payload_to_client_messages(decoded, final=(sequence < 0 or flags == FLAG_NEG_SEQUENCE), state=state)


def _payload_to_client_messages(
    payload: Any,
    *,
    final: bool,
    state: dict[str, Any],
) -> list[dict[str, Any]]:
    utterance_messages = _extract_utterance_messages(payload, state)
    if utterance_messages:
        return utterance_messages
    text = _trim_cumulative_text(_extract_text(payload), state)
    if not text:
        return []
    if final:
        key = (None, None, text)
        sent_final_keys: set[tuple[int | None, int | None, str]] = state["sent_final_keys"]
        if key in sent_final_keys:
            return []
        sent_final_keys.add(key)
        _remember_final_text(state, text)
        state["final_count"] = int(state.get("final_count", 0)) + 1
        _mark_asr_emit(state, "final")
        return [{"type": "final", "text": text}]
    partial_key = (None, None, text)
    if partial_key == state.get("last_partial_key"):
        return []
    state["last_partial_key"] = partial_key
    state["last_partial_norm"] = _compact_text(text)
    state["partial_count"] = int(state.get("partial_count", 0)) + 1
    _mark_asr_emit(state, "partial")
    return [{"type": "partial", "text": text}]


def _extract_utterance_messages(
    payload: Any,
    state: dict[str, Any],
) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    pending_partial: dict[str, Any] | None = None
    final_candidates: list[dict[str, Any]] = []
    sent_final_keys: set[tuple[int | None, int | None, str]] = state["sent_final_keys"]
    for item in _find_utterances(payload):
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or item.get("utterance") or item.get("sentence") or "").strip()
        if not text:
            continue
        start_time = _optional_int(item.get("start_time"))
        end_time = _optional_int(item.get("end_time"))
        is_final = _truthy(item.get("definite"))
        if _is_stale_asr_span(state, start_time, end_time):
            state["stale_utterance_count"] = int(state.get("stale_utterance_count", 0)) + 1
            state["dropped_cumulative_count"] = int(state.get("dropped_cumulative_count", 0)) + 1
            continue
        text = _trim_cumulative_text(text, state)
        if not text:
            continue
        if is_final:
            key = (start_time, end_time, text)
            if key in sent_final_keys:
                continue
            final_candidates.append({
                "type": "final",
                "text": text,
                "start_time": start_time,
                "end_time": end_time,
            })
        else:
            pending_partial = {
                "type": "partial",
                "text": text,
                "start_time": start_time,
                "end_time": end_time,
            }
    if final_candidates:
        emitted: list[dict[str, Any]] = []
        for candidate in final_candidates:
            text = str(candidate.get("text") or "").strip()
            start_time = candidate.get("start_time")
            end_time = candidate.get("end_time")
            if _is_stale_asr_span(state, start_time, end_time):
                state["stale_utterance_count"] = int(state.get("stale_utterance_count", 0)) + 1
                state["dropped_cumulative_count"] = int(state.get("dropped_cumulative_count", 0)) + 1
                continue
            key = (start_time, end_time, text)
            if key in sent_final_keys:
                continue
            sent_final_keys.add(key)
            _remember_final_text(state, text, start_time=start_time, end_time=end_time)
            emitted.append(candidate)
        if emitted:
            if len(emitted) == 1:
                messages.append(emitted[0])
            else:
                state["combined_final_count"] = int(state.get("combined_final_count", 0)) + 1
                messages.append({
                    "type": "final",
                    "text": " ".join(str(item["text"]).strip() for item in emitted if str(item.get("text") or "").strip()),
                    "start_time": next((item.get("start_time") for item in emitted if item.get("start_time") is not None), None),
                    "end_time": next((item.get("end_time") for item in reversed(emitted) if item.get("end_time") is not None), None),
                })
            state["final_count"] = int(state.get("final_count", 0)) + 1
            _mark_asr_emit(state, "final")
    if pending_partial:
        partial_text = _trim_cumulative_text(str(pending_partial["text"]).strip(), state)
        if _is_stale_asr_span(state, pending_partial.get("start_time"), pending_partial.get("end_time")):
            state["stale_utterance_count"] = int(state.get("stale_utterance_count", 0)) + 1
            state["dropped_cumulative_count"] = int(state.get("dropped_cumulative_count", 0)) + 1
            partial_text = ""
        partial_key = (pending_partial.get("start_time"), pending_partial.get("end_time"), partial_text)
        if partial_text and partial_key != state.get("last_partial_key"):
            state["last_partial_key"] = partial_key
            state["last_partial_norm"] = _compact_text(partial_text)
            state["partial_count"] = int(state.get("partial_count", 0)) + 1
            _mark_asr_emit(state, "partial")
            pending_partial["text"] = partial_text
            messages.append(pending_partial)
    return messages


def _find_utterances(value: Any) -> list[Any]:
    found: list[Any] = []

    def visit(item: Any, key: str = "") -> None:
        if isinstance(item, dict):
            for child_key, child in item.items():
                child_key_lower = str(child_key).lower()
                if child_key_lower == "utterances" and isinstance(child, list):
                    found.extend(child)
                else:
                    visit(child, child_key_lower)
        elif isinstance(item, list) and key != "utterances":
            for child in item:
                visit(child, key)

    visit(value)
    return found


def _extract_text(value: Any) -> str:
    found: list[str] = []

    def visit(item: Any, key: str = "") -> None:
        if isinstance(item, dict):
            for child_key, child in item.items():
                visit(child, str(child_key).lower())
        elif isinstance(item, list):
            for child in item:
                visit(child, key)
        elif isinstance(item, str) and key in {"text", "sentence", "utterance"}:
            cleaned = item.strip()
            if cleaned:
                found.append(cleaned)

    visit(value)
    return max(found, key=len) if found else ""


def _trim_cumulative_text(text: str, state: dict[str, Any]) -> str:
    current = str(text or "").strip()
    if not current:
        return ""
    final_texts = [str(item).strip() for item in state.get("final_texts", []) if str(item).strip()]
    current_norm = _compact_text(current)
    history_norm = str(state.get("final_norm_history") or "")
    if not final_texts or not history_norm:
        return current
    if current in final_texts or current_norm == history_norm:
        state["dropped_cumulative_count"] = int(state.get("dropped_cumulative_count", 0)) + 1
        return ""
    prefixes = ["".join(final_texts), " ".join(final_texts), *final_texts[::-1]]
    for prefix in prefixes:
        if prefix and current.startswith(prefix):
            trimmed = current[len(prefix):].strip()
            if trimmed:
                state["trimmed_cumulative_count"] = int(state.get("trimmed_cumulative_count", 0)) + 1
            else:
                state["dropped_cumulative_count"] = int(state.get("dropped_cumulative_count", 0)) + 1
            return trimmed
    for previous in final_texts[-8:]:
        previous_norm = _compact_text(previous)
        if previous_norm and len(previous_norm) >= 2 and current_norm.startswith(previous_norm):
            trimmed = _trim_normalized_prefix(current, previous_norm)
            if trimmed and _compact_text(trimmed) != current_norm:
                state["trimmed_cumulative_count"] = int(state.get("trimmed_cumulative_count", 0)) + 1
                return trimmed
            state["dropped_cumulative_count"] = int(state.get("dropped_cumulative_count", 0)) + 1
            return ""
    if current_norm.startswith(history_norm):
        trimmed = _trim_normalized_prefix(current, history_norm)
        if trimmed and _compact_text(trimmed) != current_norm:
            state["trimmed_cumulative_count"] = int(state.get("trimmed_cumulative_count", 0)) + 1
            return trimmed
        state["dropped_cumulative_count"] = int(state.get("dropped_cumulative_count", 0)) + 1
        return ""
    for prefix in prefixes:
        prefix_norm = _compact_text(prefix)
        if prefix_norm and current_norm == prefix_norm:
            state["dropped_cumulative_count"] = int(state.get("dropped_cumulative_count", 0)) + 1
            return ""
    if history_norm in current_norm:
        state["dropped_cumulative_count"] = int(state.get("dropped_cumulative_count", 0)) + 1
        return ""
    recent_hits = 0
    for previous in final_texts[-4:]:
        previous_norm = _compact_text(previous)
        if previous_norm and previous_norm in current_norm:
            recent_hits += 1
        if previous_norm and len(previous_norm) >= 4 and previous_norm in current_norm and len(current_norm) > len(previous_norm) + 20:
            state["dropped_cumulative_count"] = int(state.get("dropped_cumulative_count", 0)) + 1
            return ""
    if recent_hits >= 2 and len(current_norm) > 40:
        state["dropped_cumulative_count"] = int(state.get("dropped_cumulative_count", 0)) + 1
        return ""
    if len(current_norm) > 120 and history_norm in current_norm:
        state["dropped_cumulative_count"] = int(state.get("dropped_cumulative_count", 0)) + 1
        return ""
    return current


def _remember_final_text(
    state: dict[str, Any],
    text: str,
    *,
    start_time: int | None = None,
    end_time: int | None = None,
) -> None:
    clean = str(text or "").strip()
    if not clean:
        return
    state["final_texts"].append(clean)
    if len(state["final_texts"]) > 24:
        state["final_texts"] = state["final_texts"][-24:]
    state["final_norm_history"] = _compact_text("".join(state["final_texts"]))
    if end_time is not None:
        current = state.get("final_end_watermark")
        if current is None or end_time > int(current):
            state["final_end_watermark"] = end_time


def _is_stale_asr_span(state: dict[str, Any], start_time: Any, end_time: Any) -> bool:
    end = _optional_int(end_time)
    if end is None:
        return False
    watermark = state.get("final_end_watermark")
    if watermark is None:
        return False
    return end <= int(watermark)


def _trim_normalized_prefix(raw: str, prefix_norm: str) -> str:
    cursor = 0
    for index, char in enumerate(str(raw or "")):
        normalized = _compact_text(char)
        if not normalized:
            continue
        if cursor >= len(prefix_norm) or normalized != prefix_norm[cursor]:
            return raw
        cursor += 1
        if cursor == len(prefix_norm):
            return raw[index + 1 :].strip()
    return ""


def _should_disable_thinking(*, provider: str, api_base: str, model: str) -> bool:
    provider_lower = str(provider or "").lower()
    base_lower = str(api_base or "").lower()
    model_lower = str(model or "").lower()
    return (
        provider_lower == "deepseek"
        or "deepseek" in base_lower
        or provider_lower == "volc_ark"
        or ("ark.cn-" in base_lower and "volces.com" in base_lower)
        or model_lower.startswith("doubao-seed-2-0-")
    )


def _elapsed_ms(started: float) -> int:
    return max(0, int((perf_counter() - started) * 1000))


def _state_elapsed_ms(started: float, state: dict[str, Any], key: str) -> int | None:
    value = state.get(key)
    if not value:
        return None
    try:
        return max(0, int((float(value) - started) * 1000))
    except Exception:
        return None


def _state_delta_ms(state: dict[str, Any], start_key: str, end_key: str | None) -> int | None:
    start_value = state.get(start_key)
    if not start_value:
        return None
    end_value = perf_counter() if end_key is None else state.get(end_key)
    if not end_value:
        return None
    try:
        return max(0, int((float(end_value) - float(start_value)) * 1000))
    except Exception:
        return None


def _hash_text(value: str) -> str:
    text = str(value or "")
    if not text:
        return ""
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()[:16]


def _hash_json(value: Any) -> str:
    try:
        text = json.dumps(value, ensure_ascii=False, sort_keys=True)
    except Exception:
        text = str(value)
    return _hash_text(text)


def _messages_char_count(messages: Any) -> int:
    try:
        return len(json.dumps(messages or [], ensure_ascii=False))
    except Exception:
        return len(str(messages or ""))


def _write_relay_log(event: dict[str, Any]) -> None:
    payload = {
        "timestamp": time(),
        **event,
    }
    log_dir = _REPO_ROOT / "logs"
    try:
        log_dir.mkdir(parents=True, exist_ok=True)
        with (log_dir / "public_relay.jsonl").open("a", encoding="utf-8") as file:
            file.write(json.dumps(payload, ensure_ascii=False, sort_keys=True) + "\n")
    except Exception:
        pass


def _log_asr_event(
    state: dict[str, Any],
    started: float,
    event: str,
    *,
    endpoint: str = "",
    resource_id: str = "",
    logid: str = "",
    **fields: Any,
) -> None:
    payload: dict[str, Any] = {
        "route": "volc_asr_event",
        "event": event,
        "request_id": state.get("request_id", ""),
        "elapsed_ms": _elapsed_ms(started),
    }
    if endpoint:
        payload["endpoint_hash"] = _hash_text(endpoint)
    if resource_id:
        payload["resource_id"] = resource_id
    if logid:
        payload["logid"] = logid
    payload.update({key: value for key, value in fields.items() if value is not None})
    _write_relay_log(payload)


def _asr_text_log_fields(text: Any, *, field: str = "text") -> dict[str, Any]:
    clean = str(text or "").replace("\r", " ").replace("\n", " ")
    clean = " ".join(clean.split())
    return {
        f"{field}_chars": len(clean),
        f"{field}_hash": _hash_text(clean),
        f"{field}_preview": clean[:60],
    }


def _asr_client_note_event(reason: str) -> str:
    clean = str(reason or "").strip()
    known = {
        "call_start",
        "vad_gate_open",
        "vad_gate_close",
        "tail_finish",
        "segment_rotate",
        "session_rotate",
        "recoverable_timeout_reconnect",
        "idle_disconnect",
    }
    return clean if clean in known else "client_note"


def _asr_disconnect_reason(state: dict[str, Any]) -> str:
    note = str(state.get("last_client_note_reason") or "").strip()
    if note:
        return note[:80]
    if int(state.get("asr_error_count", 0)) > 0:
        return "upstream_timeout_recoverable"
    return "websocket_disconnect"


def _log_asr_close(
    state: dict[str, Any],
    started: float,
    *,
    status: str,
    endpoint: str,
    resource_id: str,
    logid: str = "",
    error_type: str = "",
) -> None:
    _write_relay_log(
        {
            "route": "volc_asr",
            "request_id": state.get("request_id", ""),
            "status": status,
            "elapsed_ms": _elapsed_ms(started),
            "resource_id": resource_id,
            "endpoint_hash": _hash_text(endpoint),
            "logid": logid,
            "error_type": error_type,
            "error_detail": str(state.get("connect_error_detail") or state.get("close_error_detail") or "")[:240],
            "upstream_connect_ms": _state_delta_ms(state, "upstream_connect_started_at", "upstream_connect_at"),
            "upstream_ready_ms": _state_elapsed_ms(started, state, "upstream_ready_at"),
            "first_audio_ms": _state_elapsed_ms(started, state, "first_audio_at"),
            "first_browser_audio_ms": _state_elapsed_ms(started, state, "first_browser_audio_at"),
            "first_forwarded_audio_ms": _state_elapsed_ms(started, state, "first_forwarded_audio_at"),
            "ready_to_first_audio_ms": state.get("ready_to_first_audio_ms"),
            "stale_before_first_audio": bool(state.get("stale_before_first_audio")),
            "max_forward_audio_gap_ms": int(state.get("max_forward_audio_gap_ms", 0)),
            "large_audio_gap_count": int(state.get("large_audio_gap_count", 0)),
            "last_large_audio_gap_ms": int(state.get("last_large_audio_gap_ms", 0)),
            "last_audio_ms": _state_elapsed_ms(started, state, "last_audio_at"),
            "last_forwarded_audio_ms": _state_elapsed_ms(started, state, "last_forwarded_audio_at"),
            "first_partial_ms": _state_elapsed_ms(started, state, "first_partial_at"),
            "first_final_ms": _state_elapsed_ms(started, state, "first_final_at"),
            "asr_error_count": int(state.get("asr_error_count", 0)),
            "asr_error_sent": bool(state.get("asr_error_sent")),
            "duplicate_upstream_error_count": int(state.get("duplicate_upstream_error_count", 0)),
            "last_asr_error": str(state.get("last_asr_error") or "")[:240],
            "last_asr_error_ms": _state_elapsed_ms(started, state, "last_asr_error_at"),
            "last_asr_error_type": state.get("last_asr_error_type", ""),
            "client_start_reason": state.get("client_start_reason", ""),
            "client_stop_reason": state.get("client_stop_reason", ""),
            "reconnect_reason": state.get("reconnect_reason", ""),
            "client_disconnect_code": state.get("client_disconnect_code"),
            "upstream_close_code": state.get("upstream_close_code"),
            "upstream_close_reason": state.get("upstream_close_reason", ""),
            "audio_bytes_in": int(state.get("audio_bytes_in", 0)),
            "audio_bytes_forwarded": int(state.get("audio_bytes_forwarded", 0)),
            "dropped_zero_audio_bytes": int(state.get("dropped_zero_audio_bytes", 0)),
            "near_zero_audio_bytes_forwarded": int(state.get("near_zero_audio_bytes_forwarded", 0)),
            "forwarded_packet_count": int(state.get("forwarded_packet_count", 0)),
            "continuous_streaming": bool(state.get("continuous_streaming")),
            "packet_target_ms": int(state.get("packet_target_ms", 0)),
            "billable_audio_ms_est": int(int(state.get("audio_bytes_forwarded", 0)) / 32),
            "partial_count": int(state.get("partial_count", 0)),
            "final_count": int(state.get("final_count", 0)),
            "combined_final_count": int(state.get("combined_final_count", 0)),
            "stale_utterance_count": int(state.get("stale_utterance_count", 0)),
            "trimmed_cumulative_count": int(state.get("trimmed_cumulative_count", 0)),
            "dropped_cumulative_count": int(state.get("dropped_cumulative_count", 0)),
        }
    )


def _normalize_openai_base(raw: str) -> str:
    base = raw.strip().rstrip("/")
    if not base:
        raise ValueError("缺少 LLM API Base")
    base = base.removesuffix("/chat/completions")
    if "ark.cn-" in base and "volces.com" in base and not base.endswith("/api/v3"):
        base += "/api/v3"
    elif not base.endswith("/v1") and not base.endswith("/api/v3"):
        base += "/v1"
    return base


def _required(payload: dict[str, Any], key: str) -> str:
    value = str(payload.get(key) or "").strip()
    if not value:
        raise ValueError(f"缺少参数：{key}")
    return value


def _optional_int(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y"}
    return False


def _clean_asr_error(text: str) -> str:
    message = _extract_error_text(text) or str(text or "").strip() or "火山 ASR 返回错误。"
    message_lower = message.lower()
    if "rpc timeout" in message_lower or "waiting next packet timeout" in message_lower or "timeout" in message_lower:
        return "火山 ASR 本轮超时，正在自动重连。"
    if "session has ended" in message_lower or "session ended" in message_lower:
        return "火山 ASR 本轮会话已结束，正在自动重连。"
    return message.replace("\n", " ")[:180]


def _extract_error_text(raw: str) -> str:
    try:
        value = json.loads(raw)
    except Exception:
        return ""
    found: list[str] = []

    def visit(item: Any, key: str = "") -> None:
        if isinstance(item, dict):
            for child_key, child in item.items():
                visit(child, str(child_key).lower())
        elif isinstance(item, list):
            for child in item:
                visit(child, key)
        elif isinstance(item, str) and key in {"error", "message", "msg", "detail"}:
            cleaned = item.strip()
            if cleaned:
                found.append(cleaned)

    visit(value)
    return max(found, key=len) if found else ""


def _compact_text(value: str) -> str:
    return "".join(str(value or "").lower().split())


def _safe_error(exc: Exception) -> str:
    return str(exc).replace("\n", " ")[:160]


def _public_dir() -> Path:
    env_dir = os.getenv("PUBLIC_WEB_DIR")
    if env_dir:
        return Path(env_dir).resolve()
    here = Path(__file__).resolve().parent
    if (here / "index.html").exists():
        return here
    return (here.parent / "dist" / "public").resolve()


app.mount("/", StaticFiles(directory=_public_dir(), html=True), name="public")


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve public web app with BYOK model relays.")
    parser.add_argument("--host", default=os.getenv("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "8898")))
    args = parser.parse_args()
    import uvicorn

    public_dir = _public_dir()
    _write_relay_log(
        {
            "route": "startup",
            "status": "ok",
            "host": args.host,
            "port": args.port,
            "public_dir": str(public_dir),
            "http_client": "httpx-shared",
        }
    )
    print(f"Serving public web app from {public_dir}")
    print("Relay endpoints ready: /relay/health /relay/llm /relay/volc-tts /relay/volc-asr")
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()

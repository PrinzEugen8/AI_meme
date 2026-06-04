AI接梗机 公网 BYOK 后端中转版
请在仓库根目录运行: python -m public_web.server （设置 PUBLIC_WEB_DIR 指向本目录）
或在本目录运行 server.py（需整个仓库在旁，以便 import neko_room）。
提供 /relay/health、/relay/llm、/relay/volc-tts、/relay/volc-asr。
浏览器本地处理停止词/梗匹配；后端仅转发 LLM/TTS/ASR。勿用 python -m http.server。

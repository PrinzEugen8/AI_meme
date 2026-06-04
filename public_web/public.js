const STORAGE_KEY = "ai_meme_neko_public_byok_v1";
const MEME_MANIFEST = "./memes.public.json";
const MEME_DB_NAME = "ai_meme_neko_public_memes";
const MEME_DB_STORE = "kv";
const IDB_AUDIO_PREFIX = "audio:";
const MEME_TTS_DB_NAME = "ai_meme_neko_public_meme_tts";
const MEME_TTS_DB_STORE = "kv";
const MEME_TTS_PREFIX = "meme-tts:";
const TTS_TRANSLATION_CACHE_KEY = "ai_meme_neko_public_tts_translation_cache_v1";
const DEFAULT_AUDIO_CACHE_PREFIX = "ai-meme-neko-default-audio-";
const DEFAULT_AUDIO_CACHE_CONCURRENCY = 2;
const DEFAULT_ASR_RESOURCE = "volc.seedasr.sauc.duration";
const DEFAULT_ASR_ENDPOINT = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel";

const DEFAULT_STOP_TRIGGERS = [
  "停止", "停止播放", "停一下", "停掉", "别放了", "别播了", "不要放了", "不要播了", "闭嘴", "住口", "安静",
];

const DEFAULT_AI_REPLY_PERSONA = (
  "你是一个雌小鬼猫娘 AI 接梗助手。说话像真人闲聊，短、灵活、会看气氛；"
  + "可以嘴硬、吐槽、轻微挑衅，但不要长篇说教，不要 Markdown，不要一问一答客服腔。"
);

const RHYTHM_PRESETS = {
  quiet: {
    label: "安静回复",
    cooldownSeconds: 8,
    maxRepliesPerMinute: 4,
    proactiveEnabled: true,
    proactiveIdleSeconds: 90,
  },
  balanced: {
    label: "均衡陪聊",
    cooldownSeconds: 5,
    maxRepliesPerMinute: 8,
    proactiveEnabled: true,
    proactiveIdleSeconds: 60,
  },
  chatty: {
    label: "积极捧哏",
    cooldownSeconds: 2.2,
    maxRepliesPerMinute: 18,
    proactiveEnabled: true,
    proactiveIdleSeconds: 45,
  },
};

const DEFAULTS = {
  mode: "keyword",
  llmProvider: "volc_ark",
  llmBase: "https://ark.cn-beijing.volces.com/api/v3",
  llmModel: "doubao-seed-2-0-lite-260215",
  llmKey: "",
  ttsAppid: "",
  ttsToken: "",
  ttsVoice: "",
  ttsResource: "seed-icl-2.0",
  ttsEndpoint: "https://openspeech.bytedance.com/api/v3/tts/unidirectional",
  ttsEncoding: "mp3",
  ttsSampleRate: 24000,
  ttsLanguage: "zh",
  asrApiKey: "",
  asrResource: DEFAULT_ASR_RESOURCE,
  asrEndpoint: DEFAULT_ASR_ENDPOINT,
  stopTriggers: DEFAULT_STOP_TRIGGERS,
  aiReplyEnabled: true,
  aiPersona: DEFAULT_AI_REPLY_PERSONA,
  aiRhythmPreset: "chatty",
  aiMaxChars: 48,
  aiCooldown: RHYTHM_PRESETS.chatty.cooldownSeconds,
  aiTemperature: 0.75,
  aiContextMessages: 8,
  aiMemeCandidateLimit: 50,
  aiMemoryEnabled: true,
  aiMemoryLimit: 3,
  aiMemoryItems: [],
  aiProactiveEnabled: true,
  aiProactiveIdle: 60,
};

const PROVIDERS = {
  volc_ark: {
    label: "火山方舟 API Key",
    base: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-2-0-lite-260215",
  },
  deepseek: {
    label: "DeepSeek API Key",
    base: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
  },
  custom: {
    label: "API Key",
    base: "",
    model: "",
  },
};

const TTS_LANGUAGE_LABELS = {
  zh: "中文",
  ja: "日文",
};

const MODE_HELP = {
  keyword: "关键词触发版：浏览器识别到触发词后直接播放本地梗音频，不需要 LLM/TTS Key。",
  semantic: "语义理解版：浏览器识别语音，关键词直接播；无关键词时通过后端中转 LLM 判断是否接梗。",
  neko: "AI猫娘版：火山在线 ASR + 后端中转 LLM + 后端中转火山 TTS。",
};

const LLM_MEME_SYSTEM_PROMPT = (
  "Fast meme-only Timing Gate judge. Actions: play_meme or no_reply only. Never output reply text. "
  + "Judge trigger_transcript; recent_dialogue is context. local_rule_matches are hints only. "
  + "Pick play_meme only when one candidate_meme naturally lands now with confidence >= 0.75; otherwise no_reply. "
  + "meme_id must be from candidate_memes or null. Output compact JSON: action, meme_id, confidence, reason, timing."
  + "只输出 JSON，例如：{\"action\":\"no_reply\",\"meme_id\":null,\"confidence\":0.92,"
  + "\"reason\":\"不适合接梗\",\"timing\":\"等待\"}"
);

const NEKO_REPLY_COOLDOWN_MS = 4500;
const NEKO_MEME_MIN_CONFIDENCE = 0.6;
const NEKO_REPLY_MIN_CONFIDENCE = 0.45;
const NEKO_REPLY_QUEUE_MAX_AGE_MS = 8000;
const TRIGGER_RANDOM_SCORE_WINDOW = 0.14;
const ASR_FALLBACK_FINAL_SILENCE_MS = 950;
const ASR_SILENCE_RMS = 0.012;
const ASR_VAD_PREROLL_MS = 700;
const ASR_VAD_ATTACK_MS = 80;
const ASR_VAD_HOLD_MS = 1800;
const ASR_VAD_TAIL_MS = 1400;
const ASR_IDLE_DISCONNECT_MS = 60000;
const ASR_SESSION_MAX_MS = 40000;
const ASR_RECONNECT_DELAY_MS = 250;
const ASR_RELAY_READY_TIMEOUT_MS = 15000;
const ASR_READY_NO_AUDIO_STALE_MS = 6000;
const ASR_VAD_FINAL_CLOSE_MS = 900;
const ASR_VAD_PENDING_MAX_MS = 10000;
const ASR_RECOVERY_BUFFER_MS = 10000;
const ASR_CONTINUOUS_STREAMING = true;
const ASR_PACKET_TARGET_MS = 180;
const ASR_VAD_OPEN_RMS_FLOOR = 0.012;
const ASR_VAD_CLOSE_RMS_FLOOR = 0.008;
const ASR_VAD_OPEN_PEAK_FLOOR = 0.045;
const ASR_TURN_COALESCE_MS = 1000;
const ASR_TURN_FAST_FLUSH_MS = 550;
const ASR_TURN_MEDIUM_FLUSH_MS = 700;
const ASR_TURN_SHORT_FLUSH_MS = 1150;
const ASR_TURN_MAX_WAIT_MS = 2500;
const ASR_TURN_MAX_ITEMS = 2;
const ASR_SHORT_TAIL_RE = /^[吗呢吧啊呀么嘛呗噢哦喔哇嗯唔诶欸？！?！,.，。]{1,2}$/;
const ASR_RECOVERABLE_ERROR_NOTICE_EVERY = 3;
const SPEECH_NETWORK_MAX_RETRIES = 3;
const SPEECH_NETWORK_RETRY_MS = 1800;
const SPEECH_MOBILE_RESTART_MS = 1800;
const SPEECH_DESKTOP_RESTART_MS = 1200;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let settings = loadSettings();
let defaultMemes = [];
let memes = [];
let recognition = null;
let recognizing = false;
let callActive = false;
let activeCallMode = null;
let currentAudio = null;
let audioContext = null;
let partialLine = null;
let lastPlayedAt = new Map();
let lastNekoReplyAt = 0;
let nekoReplyTimestamps = [];
let pendingNekoReply = null;
let pendingNekoReplyTimer = null;
let relayBackendOk = null;
let recognitionBlocked = false;
let selectedMemeId = "";
let memeObjectUrls = new Map();
let asrSocket = null;
let asrSocketOpening = null;
let asrMediaStream = null;
let asrAudioContext = null;
let asrProcessor = null;
let asrSource = null;
let asrGateOpen = false;
let asrVoiceAttackMs = 0;
let asrLastVoiceAt = 0;
let asrNoiseFloorRms = 0.006;
let asrPrerollFrames = [];
let asrPrerollMs = 0;
let asrPendingFrames = [];
let asrPendingMs = 0;
let asrRecoveryFrames = [];
let asrRecoveryMs = 0;
let asrPacketFrames = [];
let asrPacketMs = 0;
let asrTailTimer = null;
let asrIdleCloseTimer = null;
let asrSessionRotateTimer = null;
let asrReadyIdleTimer = null;
let asrReconnectTimer = null;
let asrSocketSerial = 0;
let asrRelayState = "closed";
let asrReadyAt = 0;
let asrRecoverableNoticeAt = 0;
let asrAwaitingFinal = false;
let asrTailStartedAt = 0;
let asrUploadedAudioMs = 0;
let asrSavedSilentMs = 0;
let asrRecoverableErrorCount = 0;
let localMicStream = null;
let localMicStarting = null;
let localMicStopRequested = false;
let browserTtsUtterance = null;
let recognitionRestartTimer = null;
let recognitionManualStop = false;
let speechNetworkErrorCount = 0;
let speechNetworkFailureNotified = false;
let speechIdleTimer = null;
let lastSpeechAt = 0;
let lastDisclosureMode = null;
let asrLatestPartial = "";
let asrSilentSince = 0;
let lastAsrFinalNorm = "";
let lastAsrFinalText = "";
let lastAsrFinalAt = 0;
let lastAsrFinalStart = null;
let lastAsrFinalEnd = null;
let lastAsrFinalEndWatermark = null;
let asrFinalHistory = [];
let asrFinalNormHistory = "";
let lastAsrErrorText = "";
let lastAsrErrorAt = 0;
let asrTurnBuffer = [];
let asrTurnFlushTimer = null;
let asrTurnStartedAt = 0;
let asrTurnActiveId = "";
let asrTurnSerial = 0;
let confirmedDialogue = [];

const el = (id) => document.getElementById(id);

const preCall = el("preCall");
const callScreen = el("callScreen");
const dialogueLog = el("dialogueLog");
const settingsPanel = el("settingsPanel");

init().catch((error) => {
  appendLine("system", `初始化失败：${error.message || error}`);
});

async function init() {
  const loaded = await loadMemes();
  defaultMemes = loaded.defaultItems;
  memes = loaded.items;
  selectedMemeId = memes[0]?.id || "";
  bindUi();
  renderSettings();
  renderMode();
  renderMemePanel();
  renderSupportNotice();
  await checkRelayHealth();
  warmDefaultAudioCache().catch((error) => console.debug("default audio cache warm failed", error));
  if (location.hash === "#settings") openSettings();
}

async function loadMemes() {
  const response = await fetch(MEME_MANIFEST);
  if (!response.ok) throw new Error(`梗库加载失败：${response.status}`);
  const payload = await response.json();
  const defaultItems = cloneMemes(Array.isArray(payload.items) ? payload.items : []);
  const custom = await loadCustomMemePack();
  return {
    defaultItems,
    items: custom?.items?.length ? custom.items : cloneMemes(defaultItems),
  };
}

function bindUi() {
  el("startCall").addEventListener("click", startCall);
  el("stopCall").addEventListener("click", stopCall);
  el("settingsOpenTop").addEventListener("click", openSettings);
  el("settingsOpenCall").addEventListener("click", openSettings);
  el("settingsClose").addEventListener("click", closeSettings);
  settingsPanel.addEventListener("click", (event) => {
    if (event.target === settingsPanel) closeSettings();
  });
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      collectSettings();
      settings.mode = button.dataset.mode;
      renderMode();
      renderSettings();
      renderSupportNotice();
      switchActiveCallMode(settings.mode);
    });
  });
  el("llmProvider").addEventListener("change", () => {
    const provider = el("llmProvider").value;
    settings.llmProvider = provider;
    const preset = PROVIDERS[provider] || PROVIDERS.custom;
    if (preset.base) settings.llmBase = preset.base;
    if (preset.model) settings.llmModel = preset.model;
    renderSettings();
  });
  el("saveSettings").addEventListener("click", () => {
    collectSettings();
    saveSettings();
    renderMode();
    renderSupportNotice();
    closeSettings();
    appendLine("system", "本机设置已保存。");
  });
  el("clearSettings").addEventListener("click", () => {
    if (!confirm("确认清除这个浏览器里的 BYOK 配置？")) return;
    localStorage.removeItem(STORAGE_KEY);
    settings = defaultSettings();
    renderSettings();
    renderMode();
    renderSupportNotice();
    appendLine("system", "本机配置已清除。");
  });
  el("exportSettings").addEventListener("click", exportSettings);
  el("importSettings").addEventListener("change", importSettings);
  el("testLlm").addEventListener("click", testLlm);
  el("testTts").addEventListener("click", testTts);
  el("aiRhythmPreset").addEventListener("change", applyAiRhythmPreset);
  el("resetAiReplyDefaults").addEventListener("click", resetAiReplyDefaults);
  el("clearAiMemory").addEventListener("click", clearAiMemory);
  el("resetStopDefaults").addEventListener("click", resetStopDefaults);

  el("memeSelect").addEventListener("change", () => {
    selectedMemeId = el("memeSelect").value;
    populateMemeEditor();
  });
  el("saveMemeEdit").addEventListener("click", saveMemeEdit);
  el("resetMemeEdit").addEventListener("click", populateMemeEditor);
  el("exportMemePack").addEventListener("click", exportMemePack);
  el("importMemePack").addEventListener("change", importMemePack);
  el("restoreDefaultMemes").addEventListener("click", restoreDefaultMemes);
  el("prebuildMissingMemeTts").addEventListener("click", () => prebuildMemeTts({ force: false }));
  el("prebuildAllMemeTts").addEventListener("click", () => prebuildMemeTts({ force: true }));
  el("clearMemeTtsCache").addEventListener("click", clearMemeTtsCache);
  const clearDefaultAudio = el("clearDefaultAudioCache");
  if (clearDefaultAudio) clearDefaultAudio.addEventListener("click", clearDefaultAudioCache);
}

function openSettings() {
  renderSettings();
  renderMemePanel();
  settingsPanel.classList.add("open");
  settingsPanel.setAttribute("aria-hidden", "false");
}

function closeSettings() {
  settingsPanel.classList.remove("open");
  settingsPanel.setAttribute("aria-hidden", "true");
}

function loadSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
  } catch (_) {
    return defaultSettings();
  }
}

function saveSettings() {
  settings = normalizeSettings(settings);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function collectSettings() {
  settings = {
    ...settings,
    mode: settings.mode || "keyword",
    llmProvider: el("llmProvider").value,
    llmBase: el("llmBase").value.trim(),
    llmModel: el("llmModel").value.trim(),
    llmKey: el("llmKey").value.trim(),
    ttsAppid: el("ttsAppid").value.trim(),
    ttsToken: el("ttsToken").value.trim(),
    ttsVoice: el("ttsVoice").value.trim(),
    ttsResource: el("ttsResource").value.trim() || DEFAULTS.ttsResource,
    ttsLanguage: el("ttsLanguage").value || "zh",
    asrApiKey: el("asrApiKey").value.trim(),
    asrResource: el("asrResource").value.trim() || DEFAULT_ASR_RESOURCE,
    stopTriggers: parseListInput(el("stopTriggers").value),
    aiReplyEnabled: el("aiReplyEnabled").checked,
    aiPersona: el("aiPersona").value.trim() || DEFAULT_AI_REPLY_PERSONA,
    aiRhythmPreset: el("aiRhythmPreset").value || "chatty",
    aiMaxChars: Number(el("aiMaxChars").value || 48),
    aiCooldown: Number(el("aiCooldown").value || presetFor(el("aiRhythmPreset").value).cooldownSeconds),
    aiTemperature: Number(el("aiTemperature").value || 0.75),
    aiContextMessages: Number(el("aiContextMessages").value || 8),
    aiMemeCandidateLimit: Number(el("aiMemeCandidateLimit").value || 50),
    aiMemoryEnabled: el("aiMemoryEnabled").checked,
    aiMemoryLimit: Number(el("aiMemoryLimit").value || 0),
    aiProactiveEnabled: el("aiProactiveEnabled").checked,
    aiProactiveIdle: Number(el("aiProactiveIdle").value || 60),
  };
  settings = normalizeSettings(settings);
}

function renderSettings() {
  el("llmProvider").value = settings.llmProvider || "volc_ark";
  el("llmBase").value = settings.llmBase || "";
  el("llmModel").value = settings.llmModel || "";
  el("llmKey").value = settings.llmKey || "";
  el("llmKeyLabel").textContent = (PROVIDERS[settings.llmProvider] || PROVIDERS.custom).label;
  el("ttsAppid").value = settings.ttsAppid || "";
  el("ttsToken").value = settings.ttsToken || "";
  el("ttsVoice").value = settings.ttsVoice || "";
  el("ttsResource").value = settings.ttsResource || DEFAULTS.ttsResource;
  el("ttsLanguage").value = settings.ttsLanguage || "zh";
  el("asrApiKey").value = settings.asrApiKey || "";
  el("asrResource").value = settings.asrResource || DEFAULT_ASR_RESOURCE;
  el("stopTriggers").value = listToLines(settings.stopTriggers);
  el("aiReplyEnabled").checked = Boolean(settings.aiReplyEnabled);
  el("aiPersona").value = settings.aiPersona || DEFAULT_AI_REPLY_PERSONA;
  Object.entries(RHYTHM_PRESETS).forEach(([value, preset]) => {
    const option = el("aiRhythmPreset").querySelector(`option[value="${value}"]`);
    if (option) option.textContent = preset.label;
  });
  el("aiRhythmPreset").value = settings.aiRhythmPreset || "chatty";
  el("aiMaxChars").value = settings.aiMaxChars || 48;
  el("aiCooldown").value = settings.aiCooldown ?? presetFor(settings.aiRhythmPreset).cooldownSeconds;
  el("aiTemperature").value = settings.aiTemperature ?? 0.75;
  el("aiContextMessages").value = settings.aiContextMessages || 8;
  el("aiMemeCandidateLimit").value = settings.aiMemeCandidateLimit || 50;
  el("aiMemoryEnabled").checked = Boolean(settings.aiMemoryEnabled);
  el("aiMemoryLimit").value = settings.aiMemoryLimit ?? 3;
  el("aiProactiveEnabled").checked = Boolean(settings.aiProactiveEnabled);
  el("aiProactiveIdle").value = settings.aiProactiveIdle || presetFor(settings.aiRhythmPreset).proactiveIdleSeconds;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === settings.mode);
  });
  el("modeHelp").textContent = MODE_HELP[settings.mode] || "";
  el("localAsrStatus").textContent = SpeechRecognition
    ? "当前浏览器支持 Web Speech。关键词触发和语义理解版使用这个本地识别入口。"
    : "当前浏览器不支持 Web Speech；关键词触发和语义理解版建议使用 Chrome 或 Edge。";
  syncSettingsBlocks();
}

function setBlockVisible(id, visible) {
  el(id).classList.toggle("hidden", !visible);
}

function syncSettingsBlocks() {
  const mode = settings.mode || "keyword";
  const modeChanged = lastDisclosureMode !== mode;
  lastDisclosureMode = mode;
  const visible = {
    modeSettingsBlock: true,
    localAsrBlock: mode !== "neko",
    llmSettingsBlock: mode !== "keyword",
    volcSettingsBlock: mode === "neko",
    aiReplySettingsBlock: mode === "neko",
    stopSettingsBlock: true,
    memeSettingsBlock: true,
    localConfigBlock: true,
  };
  Object.entries(visible).forEach(([id, isVisible]) => setBlockVisible(id, isVisible));
  if (!modeChanged) return;
  const missingLlm = mode !== "keyword" && !hasLlm();
  const missingVolc = mode === "neko" && (!hasVolcAsr() || !hasTts());
  setBlockOpen("localAsrBlock", mode === "keyword");
  setBlockOpen("llmSettingsBlock", missingLlm || mode === "semantic");
  setBlockOpen("volcSettingsBlock", missingVolc);
  setBlockOpen("aiReplySettingsBlock", mode === "neko");
  setBlockOpen("stopSettingsBlock", false);
  setBlockOpen("memeSettingsBlock", false);
}

function setBlockOpen(id, open) {
  const node = el(id);
  if (node) node.open = Boolean(open);
}

function defaultSettings() {
  return {
    ...DEFAULTS,
    stopTriggers: [...DEFAULT_STOP_TRIGGERS],
    aiMemoryItems: [],
  };
}

function defaultAiReplySettings() {
  const preset = RHYTHM_PRESETS.chatty;
  return {
    aiReplyEnabled: true,
    aiPersona: DEFAULT_AI_REPLY_PERSONA,
    aiRhythmPreset: "chatty",
    aiMaxChars: 48,
    aiCooldown: preset.cooldownSeconds,
    aiTemperature: 0.75,
    aiContextMessages: 8,
    aiMemeCandidateLimit: 50,
    aiMemoryEnabled: true,
    aiMemoryLimit: 3,
    aiProactiveEnabled: preset.proactiveEnabled,
    aiProactiveIdle: preset.proactiveIdleSeconds,
  };
}

function normalizeSettings(raw = {}) {
  const merged = { ...defaultSettings(), ...raw };
  const preset = presetFor(merged.aiRhythmPreset);
  merged.mode = ["keyword", "semantic", "neko"].includes(merged.mode) ? merged.mode : "keyword";
  merged.ttsResource = String(merged.ttsResource || "").trim();
  if (!merged.ttsResource || merged.ttsResource === "volc.megatts.default") merged.ttsResource = DEFAULTS.ttsResource;
  merged.ttsLanguage = ["zh", "ja"].includes(merged.ttsLanguage) ? merged.ttsLanguage : "zh";
  merged.stopTriggers = toStringList(merged.stopTriggers);
  if (!merged.stopTriggers.length) merged.stopTriggers = [...DEFAULT_STOP_TRIGGERS];
  merged.aiRhythmPreset = RHYTHM_PRESETS[merged.aiRhythmPreset] ? merged.aiRhythmPreset : "chatty";
  merged.aiPersona = String(merged.aiPersona || DEFAULT_AI_REPLY_PERSONA).trim() || DEFAULT_AI_REPLY_PERSONA;
  merged.aiMaxChars = clampNumber(merged.aiMaxChars, 6, 200, 48);
  merged.aiCooldown = clampNumber(merged.aiCooldown, 0, 600, preset.cooldownSeconds);
  merged.aiTemperature = clampNumber(merged.aiTemperature, 0, 2, 0.75);
  merged.aiContextMessages = Math.round(clampNumber(merged.aiContextMessages, 1, 24, 8));
  merged.aiMemeCandidateLimit = Math.round(clampNumber(merged.aiMemeCandidateLimit, 0, 512, 50));
  merged.aiMemoryLimit = Math.round(clampNumber(merged.aiMemoryLimit, 0, 20, 3));
  merged.aiMemoryItems = Array.isArray(merged.aiMemoryItems) ? merged.aiMemoryItems.slice(-80) : [];
  merged.aiProactiveIdle = clampNumber(merged.aiProactiveIdle, 5, 3600, preset.proactiveIdleSeconds);
  merged.aiReplyEnabled = Boolean(merged.aiReplyEnabled);
  merged.aiMemoryEnabled = Boolean(merged.aiMemoryEnabled);
  merged.aiProactiveEnabled = Boolean(merged.aiProactiveEnabled);
  return merged;
}

function presetFor(value) {
  return RHYTHM_PRESETS[value] || RHYTHM_PRESETS.chatty;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function applyAiRhythmPreset() {
  const preset = presetFor(el("aiRhythmPreset").value);
  el("aiCooldown").value = preset.cooldownSeconds;
  el("aiProactiveEnabled").checked = preset.proactiveEnabled;
  el("aiProactiveIdle").value = preset.proactiveIdleSeconds;
}

function resetAiReplyDefaults() {
  settings = normalizeSettings({
    ...settings,
    ...defaultAiReplySettings(),
  });
  saveSettings();
  renderSettings();
  setResult("aiReplyResult", "已恢复默认猫娘设置。", true);
}

function resetStopDefaults() {
  settings = normalizeSettings({
    ...settings,
    stopTriggers: [...DEFAULT_STOP_TRIGGERS],
  });
  saveSettings();
  renderSettings();
  setResult("stopResult", "已恢复默认停止词。", true);
}

function clearAiMemory() {
  settings = normalizeSettings({
    ...settings,
    aiMemoryItems: [],
  });
  saveSettings();
  setResult("aiReplyResult", "已清空本地轻量记忆。", true);
}

function renderMode() {
  const labels = { keyword: "关键词触发", semantic: "语义理解", neko: "AI猫娘" };
  el("modeStatus").textContent = labels[settings.mode] || labels.keyword;
}

function renderSupportNotice() {
  renderRelayStatus();
  const count = memes.length;
  const relayHint = settings.mode !== "keyword" && relayBackendOk === false
    ? " 当前不是带 /relay 的公网后端，AI、火山 TTS 和火山 ASR 不可用。"
    : "";
  if (settings.mode === "neko") {
    el("supportNotice").textContent = `已加载 ${count} 条梗；AI猫娘版需要填写 LLM 和火山语音参数，并通过后端中转模型请求。${relayHint}`;
    return;
  }
  if (!SpeechRecognition) {
    el("supportNotice").textContent = `当前浏览器不支持 Web Speech；请用 Chrome 或 Edge。${relayHint}`;
  } else if (!isSpeechSecureContext()) {
    el("supportNotice").textContent = `已加载 ${count} 条梗；公网麦克风需要 HTTPS。${relayHint}`;
  } else {
    el("supportNotice").textContent = `已加载 ${count} 条梗；点击开始通话后授权麦克风。${relayHint}`;
  }
}

function renderRelayStatus() {
  const node = el("relayStatus");
  if (!node) return;
  if (relayBackendOk === true) {
    node.textContent = settings.mode === "keyword"
      ? "后端中继已连接（关键词模式本地处理；语义/猫娘需 LLM/TTS/ASR 中转）。"
      : "后端中继已连接（LLM / TTS / ASR 转发可用）。";
    node.classList.remove("bad");
    return;
  }
  if (relayBackendOk === false) {
    node.textContent = "后端中继未连接：当前页面可能是 python -m http.server 或纯静态托管。请从仓库根目录运行 python -m public_web.server，或为 /relay 配置反代；否则 AI/火山 TTS/火山 ASR 都不可用。";
    node.classList.add("bad");
    return;
  }
  node.textContent = "正在检测后端中继…";
  node.classList.remove("bad");
}

async function checkRelayHealth() {
  try {
    const response = await fetch("/relay/health");
    relayBackendOk = response.ok;
  } catch (_) {
    relayBackendOk = false;
  }
  renderRelayStatus();
  renderSupportNotice();
}

function relayDeploymentHint(status) {
  if (status === 501 || status === 405 || status === 404) {
    return "当前页面不是通过公网后端 server.py 打开的；请运行 python -m public_web.server，或为 /relay 配置反代。";
  }
  return `relay 请求失败：${status}`;
}

function debugRelayTiming(label, response, startedAt) {
  const totalMs = Math.round(performance.now() - startedAt);
  const relayMs = response.headers.get("X-Relay-Elapsed-Ms");
  const clientKind = response.headers.get("X-Relay-Http-Client");
  console.debug(`${label} relay timing`, {
    total_ms: totalMs,
    relay_ms: relayMs ? Number(relayMs) : null,
    client: clientKind || null,
    status: response.status,
  });
}

function logClientEvent(event, fields = {}) {
  if (!relayBackendOk) return;
  const payload = {
    event: String(event || "client_event").slice(0, 80),
    mode: activeCallMode || settings.mode || "",
    rhythm: settings.aiRhythmPreset || "",
  };
  const text = fields.text;
  const replyText = fields.reply_text;
  Object.entries(fields).forEach(([key, value]) => {
    if (["text", "reply_text"].includes(key) || value == null) return;
    if (typeof value === "number" || typeof value === "boolean") payload[key] = value;
    else payload[key] = String(value).slice(0, 120);
  });
  Object.assign(payload, compactLogText(text, "text"));
  Object.assign(payload, compactLogText(replyText, "reply"));
  try {
    fetch("/relay/client-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch (_) {}
}

function compactLogText(text, field) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return {};
  return {
    [`${field}_chars`]: clean.length,
    [`${field}_hash`]: hashString(clean),
    [`${field}_preview`]: clean.slice(0, 60),
  };
}

function nekoControllerSystemPrompt() {
  const preset = presetFor(settings.aiRhythmPreset);
  const replyEnabled = settings.aiReplyEnabled ? "允许 reply_tts" : "禁止 reply_tts，只能接自然合适的梗或 no_reply";
  const styleRule = settings.aiRhythmPreset === "quiet"
    ? "安静回复：少打断，但被点名、问句、情绪句、明显求反馈时必须自然接一句。"
    : settings.aiRhythmPreset === "balanced"
      ? "均衡陪聊：完整句、问题、情绪句、调试求助都要积极判断；不要长时间沉默。"
      : "积极捧哏：完整用户轮次默认要接一句短口语或自然接梗；只有噪声、重复、明显没说完才 wait/no_reply。";
  return (
    "你是 AI 接梗机的单次 Reply Controller，参考 MaiBot 的自然聊天节奏：先判断发言权，再决定接梗或短回复。"
    + "只能输出 JSON，action 只能是 play_meme、reply_tts、wait、no_reply。"
    + "先判断用户是否说完；明显没说完才 wait，空文本、噪声、重复才 no_reply。"
    + "如果该说话，优先看 candidate_memes 里有没有贴合当前语境、不会硬接的梗；有就 play_meme，meme_id 必须来自候选。"
    + "没有自然合适的梗时，输出 reply_tts，reply_text 是一句适合直接念出来的短句。"
    + "调试、日志、仓库、ASR、部署等工作语境也要像陪聊搭子一样捧一句，不要因为是工作内容就沉默。"
    + "不要暴露候选列表或内部判断；不要 Markdown；不要客服腔；不要长篇解释。"
    + "relevant_memories 只作为用户偏好和上下文参考，使用时要自然，不要复读记忆。"
    + "如果 reply_budget.allowed 为 false，普通陈述可 no_reply；但被点名、问句、情绪句、强求反馈时仍可 reply_tts。"
    + "字段必须包含 action、meme_id、reply_text、confidence、reason、timing、memory_notes；reason/timing 要短。"
    + `回复方式：${preset.label}；${styleRule}；${replyEnabled}；reply_text 不超过 ${settings.aiMaxChars || 48} 个字。`
    + `人设：${settings.aiPersona || DEFAULT_AI_REPLY_PERSONA}`
  );
}

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
}

function isIosBrowser() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

function matchStopPhrase(text) {
  const norm = normalizeText(text);
  if (!norm) return "";
  for (const phrase of (settings.stopTriggers?.length ? settings.stopTriggers : DEFAULT_STOP_TRIGGERS)) {
    const target = normalizeText(phrase);
    if (target && norm.includes(target)) return phrase;
  }
  return "";
}

function tryLocalStopAudio(text, { announce = false } = {}) {
  const phrase = matchStopPhrase(text);
  if (!phrase) return false;
  stopAudio();
  clearPendingNekoReply();
  if (announce) appendLine("system", `已停止播放：${phrase}`);
  return true;
}

function utteranceCharWeight(text) {
  let weight = 0;
  for (const char of String(text || "").trim()) {
    if (/[\p{L}\p{N}]/u.test(char)) weight += 1;
  }
  return weight;
}

function isWeakNekoTranscript(text) {
  const clean = String(text || "").trim();
  if (!clean) return true;
  const weight = utteranceCharWeight(clean);
  if (weight <= 0) return true;
  if (isShortAsrTail(clean) || isWeakNoise(clean)) return true;
  return weight <= 1;
}

function isDirectAddressOrEmotional(text) {
  const clean = String(text || "");
  const norm = normalizeText(clean);
  if (!norm) return false;
  if (/[?？!！]/.test(clean)) return true;
  const markers = [
    "猫娘", "小猫", "你说", "你觉得", "你看", "怎么办", "为什么", "咋办",
    "救命", "坏了", "完了", "笑死", "离谱", "绷不住", "麻了", "急了",
    "记忆", "回复", "不回", "听见", "在吗",
  ];
  return markers.some((item) => norm.includes(normalizeText(item)));
}

function shouldForceNekoFallback(text, decision = {}) {
  if (!settings.aiReplyEnabled || isWeakNekoTranscript(text)) return false;
  const action = String(decision?.action || "");
  if (!["", "wait", "no_reply"].includes(action)) return false;
  const budget = nekoReplyBudgetStatus(text);
  if (!budget.allowed && !budget.bypass) return false;
  if (isDirectAddressOrEmotional(text)) return true;
  if (settings.aiRhythmPreset === "chatty" && utteranceCharWeight(text) >= 4) return true;
  if (settings.aiRhythmPreset === "balanced" && /[?？!！]/.test(String(text))) return true;
  return false;
}

function quickNekoFallbackReply(text) {
  const clean = String(text || "");
  if (/ASR|识别|火山|超时|timeout|断连|日志|部署|仓库|分支|提交/i.test(clean)) {
    return "嗯，这块确实得盯紧，我跟你一起捋。";
  }
  if (/[?？]/.test(clean)) return "嗯哼，我在听，你这个问题可以继续展开。";
  if (/坏了|完了|救命|离谱|麻了|绷不住|笑死/.test(clean)) return "坏，味儿一下就上来了。";
  return settings.aiRhythmPreset === "chatty" ? "嗯哼，我跟上了，你接着说。" : "嗯，我听着呢。";
}

function listLocalMatches(text) {
  const scored = [];
  for (const meme of memes) {
    const match = matchScore(text, meme);
    if (match.score > 0) {
      scored.push({ ...meme, _score: match.score, _phrase: match.phrase, _kind: match.kind });
    }
  }
  scored.sort((a, b) => (b._score + (b.priority || 0) / 1000) - (a._score + (a.priority || 0) / 1000));
  return scored;
}

function chooseLocalMeme(text) {
  const scored = listLocalMatches(text);
  if (!scored.length) return null;
  const topScore = scored[0]._score;
  const pool = scored.filter((item) => topScore - item._score <= TRIGGER_RANDOM_SCORE_WINDOW);
  if (pool.length === 1) return pool[0];
  const weights = pool.map((item) => Math.max(1, Number(item.priority || 0)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = Math.random() * total;
  for (let index = 0; index < pool.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return pool[index];
  }
  return pool[pool.length - 1];
}

function markSpeechActivity() {
  lastSpeechAt = Date.now();
  speechNetworkErrorCount = 0;
  speechNetworkFailureNotified = false;
}

function startSpeechIdleWatch() {
  if (recognitionBlocked) return;
  clearSpeechIdleWatch();
  lastSpeechAt = Date.now();
  speechIdleTimer = window.setInterval(() => {
    if (!callActive || isNekoCallActive()) return;
    if (Date.now() - lastSpeechAt < 8000) return;
    if (recognitionBlocked) {
      appendLine("system", "本地 Web Speech 已停止，免费模式无法继续识别；请检查浏览器识别服务。");
    } else if (recognizing) {
      appendLine("system", "正在监听，但 8 秒内没有识别到文字；请确认浏览器麦克风权限和当前浏览器是否支持 Web Speech。");
    } else {
      appendLine("system", "本地语音识别尚未启动成功；请换 Chrome/Edge 或检查 HTTPS 与麦克风权限。");
    }
    clearSpeechIdleWatch();
  }, 2000);
}

function clearSpeechIdleWatch() {
  if (speechIdleTimer) {
    window.clearInterval(speechIdleTimer);
    speechIdleTimer = null;
  }
}

async function startCall() {
  if (callActive) return;
  collectSettings();
  activeCallMode = settings.mode || "keyword";
  enterCallScreen();
  try {
    await unlockAudio();
    if (isNekoCallActive()) {
      await startVolcRecognition();
    } else {
      await startBrowserRecognition();
      if (!recognitionBlocked) startSpeechIdleWatch();
    }
  } catch (error) {
    appendLine("system", `通话启动失败：${error.message || error}`);
    el("callStatus").textContent = "通话启动失败";
  }
}

function enterCallScreen() {
  preCall.classList.add("hidden");
  callScreen.classList.remove("hidden");
  callActive = true;
  recognitionBlocked = false;
  recognitionManualStop = false;
  partialLine = null;
  confirmedDialogue = [];
  speechNetworkErrorCount = 0;
  speechNetworkFailureNotified = false;
  resetAsrTextState();
  el("callStatus").textContent = "准备通话";
  appendLine("ai", "我在，开始吧。");
}

function stopCall() {
  callActive = false;
  activeCallMode = null;
  recognitionBlocked = true;
  recognitionManualStop = true;
  clearRecognitionRestartTimer();
  clearSpeechIdleWatch();
  stopRecognition();
  stopLocalMicKeepalive();
  stopVolcRecognition();
  clearPendingNekoReply();
  stopAudio();
  callScreen.classList.add("hidden");
  preCall.classList.remove("hidden");
}

function switchActiveCallMode(mode) {
  const nextMode = ["keyword", "semantic", "neko"].includes(mode) ? mode : "keyword";
  if (!callActive) {
    activeCallMode = null;
    return;
  }
  if (activeCallMode === nextMode) return;
  activeCallMode = nextMode;
  recognitionBlocked = false;
  recognitionManualStop = false;
  speechNetworkErrorCount = 0;
  speechNetworkFailureNotified = false;
  resetAsrTextState();
  partialLine = null;
  if (isNekoCallActive()) {
    clearSpeechIdleWatch();
    stopRecognition();
    stopLocalMicKeepalive();
    startVolcRecognition().catch((error) => {
      appendLine("system", `火山 ASR 启动失败：${error.message || error}`);
      el("callStatus").textContent = "语音识别不可用";
    });
    return;
  }
  stopVolcRecognition();
  el("callStatus").textContent = "正在请求麦克风权限";
  startBrowserRecognition()
    .then(() => {
      if (!recognitionBlocked && !isNekoCallActive()) startSpeechIdleWatch();
    })
    .catch((error) => {
      appendLine("system", `本地语音识别启动失败：${error.message || error}`);
      el("callStatus").textContent = "语音识别不可用";
    });
}

function isNekoCallActive() {
  return callActive && activeCallMode === "neko";
}

async function startVolcRecognition() {
  collectSettings();
  if (!isNekoCallActive()) return;
  stopLocalMicKeepalive();
  if (!isSpeechSecureContext()) {
    markRecognitionBlocked("AI猫娘在线 ASR 需要 HTTPS；localhost/127.0.0.1 本地预览可以直接用。");
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    markRecognitionBlocked("当前浏览器没有可用的麦克风采集接口。");
    return;
  }
  if (!hasVolcAsr()) {
    markRecognitionBlocked("AI猫娘版需要先在设置里填写豆包语音 ASR API Key 和 ASR Resource ID。");
    return;
  }
  try {
    el("callStatus").textContent = "正在请求麦克风权限";
    asrMediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    resetAsrVadState();
    setupVolcAudioPipeline(asrMediaStream);
    el("callStatus").textContent = "正在连接火山 ASR";
    ensureAsrRelaySocket({ reason: "call_start", keepIdle: true }).catch(handleAsrOpenError);
  } catch (error) {
    stopVolcRecognition();
    markRecognitionBlocked(`火山 ASR 启动失败：${error.message || error}`);
  }
}

function openAsrRelaySocket({ reason = "speech" } = {}) {
  return new Promise((resolve, reject) => {
    if (!isNekoCallActive()) {
      reject(new Error("当前模式不使用火山 ASR"));
      return;
    }
    const socket = new WebSocket(resolveRelayWs("/relay/volc-asr"));
    const timer = window.setTimeout(() => {
      reject(new Error("ASR relay ready 超时"));
      try { socket.__expectedClose = true; } catch (_) {}
      try { socket.close(); } catch (_) {}
    }, ASR_RELAY_READY_TIMEOUT_MS);
    socket.binaryType = "arraybuffer";
    try {
      socket.__asrReady = false;
      socket.__asrHadAudio = false;
    } catch (_) {}
    socket.onopen = () => {
      if (!isNekoCallActive()) {
        window.clearTimeout(timer);
        try { socket.__expectedClose = true; } catch (_) {}
        try { socket.close(); } catch (_) {}
        reject(new Error("当前模式不使用火山 ASR"));
        return;
      }
      socket.send(JSON.stringify({
        type: "start",
        reason,
        api_key: settings.asrApiKey,
        resource_id: settings.asrResource || DEFAULT_ASR_RESOURCE,
        endpoint: settings.asrEndpoint || DEFAULT_ASR_ENDPOINT,
        sample_rate: 16000,
        end_window_size: 1200,
        continuous_streaming: ASR_CONTINUOUS_STREAMING,
        packet_target_ms: ASR_PACKET_TARGET_MS,
      }));
    };
    socket.onerror = () => {
      window.clearTimeout(timer);
      try { socket.__openFailed = true; } catch (_) {}
      reject(new Error("ASR relay WebSocket 连接失败"));
    };
    socket.onmessage = (event) => {
      let payload = null;
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : null;
      } catch (_) {}
      if (payload?.type === "ready") {
        window.clearTimeout(timer);
        try {
          socket.__asrReady = true;
          socket.__asrRequestId = payload.request_id || "";
        } catch (_) {}
        resolve(socket);
        return;
      }
      handleAsrRelayMessage(event.data);
    };
    socket.onclose = () => {
      window.clearTimeout(timer);
      if (asrSocket === socket) {
        asrSocket = null;
        asrRelayState = "closed";
        asrReadyAt = 0;
      }
      if (!socket.__asrReady && !socket.__expectedClose) {
        try { socket.__openFailed = true; } catch (_) {}
        reject(new Error("ASR relay ready 前连接关闭"));
        return;
      }
      if (socket.__expectedClose) return;
      if (socket.__openFailed) return;
      if (callActive && !recognitionBlocked) {
        console.debug("ASR relay closed; reconnecting", { reason: "unexpected_close" });
        scheduleAsrReconnect("unexpected_close");
      }
    };
  });
}

function setupVolcAudioPipeline(stream) {
  if (!isNekoCallActive()) {
    stopVolcRecognition();
    return;
  }
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  asrAudioContext = new AudioContextCtor();
  asrSource = asrAudioContext.createMediaStreamSource(stream);
  asrProcessor = asrAudioContext.createScriptProcessor(4096, 1, 1);
  asrProcessor.onaudioprocess = (event) => {
    if (!isNekoCallActive()) {
      stopVolcRecognition();
      return;
    }
    if (recognitionBlocked) return;
    const samples = event.inputBuffer.getChannelData(0);
    observeAsrSilence(samples);
    const sampleRate = event.inputBuffer.sampleRate || asrAudioContext?.sampleRate || 48000;
    const pcm = floatToPcm16(resampleTo16k(samples, sampleRate));
    const frameMs = (samples.length / sampleRate) * 1000;
    if (ASR_CONTINUOUS_STREAMING) {
      processAsrContinuousFrame(samples, pcm, frameMs);
    } else {
      processAsrVadFrame(samples, pcm, frameMs);
    }
  };
  asrSource.connect(asrProcessor);
  asrProcessor.connect(asrAudioContext.destination);
}

function stopVolcRecognition() {
  closeAsrRelaySocket({ sendStop: true });
  clearAsrIdleCloseTimer();
  clearAsrReconnectTimer();
  if (asrProcessor) {
    try { asrProcessor.disconnect(); } catch (_) {}
    asrProcessor = null;
  }
  if (asrSource) {
    try { asrSource.disconnect(); } catch (_) {}
    asrSource = null;
  }
  if (asrAudioContext) {
    try { asrAudioContext.close(); } catch (_) {}
    asrAudioContext = null;
  }
  if (asrMediaStream) {
    asrMediaStream.getTracks().forEach((track) => track.stop());
    asrMediaStream = null;
  }
  resetAsrVadState();
  resetAsrTextState();
}

function isAsrRelayReady() {
  return Boolean(asrSocket && asrSocket.readyState === WebSocket.OPEN && asrSocket.__asrReady);
}

function processAsrContinuousFrame(samples, pcm, frameMs) {
  if (!isNekoCallActive()) {
    stopVolcRecognition();
    return;
  }
  if (!pcm?.byteLength) return;
  const levels = audioLevels(samples);
  const threshold = asrVadThreshold(levels.rms);
  const now = Date.now();
  const voice = levels.rms >= threshold.openRms || levels.peak >= threshold.openPeak;

  if (voice || levels.rms >= threshold.closeRms) {
    asrLastVoiceAt = now;
    asrVoiceAttackMs += frameMs;
    if (!asrGateOpen && asrVoiceAttackMs >= ASR_VAD_ATTACK_MS) {
      asrGateOpen = true;
      asrAwaitingFinal = false;
      asrTailStartedAt = 0;
      clearAsrTailTimer();
      clearAsrIdleCloseTimer();
      clearAsrReadyIdleTimer();
      sendAsrClientNote("vad_gate_open", { continuous_streaming: true });
      el("callStatus").textContent = "正在识别";
    }
  } else {
    updateAsrNoiseFloor(levels.rms);
    asrVoiceAttackMs = 0;
    asrSavedSilentMs += frameMs;
    if (asrGateOpen && now - asrLastVoiceAt > ASR_VAD_HOLD_MS) {
      asrGateOpen = false;
      asrAwaitingFinal = false;
      asrTailStartedAt = 0;
      sendAsrClientNote("vad_gate_close", { continuous_streaming: true });
      if (isNekoCallActive() && !recognitionBlocked) el("callStatus").textContent = "正在监听";
    }
  }

  queueAsrFrame(pcm, frameMs);
}

function processAsrVadFrame(samples, pcm, frameMs) {
  if (!isNekoCallActive()) {
    stopVolcRecognition();
    return;
  }
  if (!pcm?.byteLength) return;
  const levels = audioLevels(samples);
  const threshold = asrVadThreshold(levels.rms);
  const now = Date.now();
  const voice = levels.rms >= threshold.openRms || levels.peak >= threshold.openPeak;
  pushAsrPrerollFrame(pcm, frameMs);

  if (!asrGateOpen && asrAwaitingFinal) {
    if (voice) {
      asrVoiceAttackMs += frameMs;
      asrLastVoiceAt = now;
      queueAsrFrame(pcm, frameMs);
      if (asrVoiceAttackMs >= ASR_VAD_ATTACK_MS) {
        openAsrVoiceGate({ includePreroll: false });
      }
      return;
    }
    asrVoiceAttackMs = 0;
    queueAsrFrame(pcm, frameMs);
    if (now - asrTailStartedAt >= ASR_VAD_TAIL_MS) {
      finishAsrTailSession();
    }
    return;
  }

  if (!asrGateOpen) {
    updateAsrNoiseFloor(levels.rms);
    if (voice) {
      asrVoiceAttackMs += frameMs;
      asrLastVoiceAt = now;
      if (asrVoiceAttackMs >= ASR_VAD_ATTACK_MS) {
        openAsrVoiceGate();
      }
      return;
    }
    asrVoiceAttackMs = 0;
    asrSavedSilentMs += frameMs;
    return;
  }

  if (voice || levels.rms >= threshold.closeRms) {
    if (voice) asrLastVoiceAt = now;
    queueAsrFrame(pcm, frameMs);
    return;
  }

  if (now - asrLastVoiceAt <= ASR_VAD_HOLD_MS) {
    queueAsrFrame(pcm, frameMs);
    return;
  }

  closeAsrVoiceGate(pcm, frameMs);
}

function audioLevels(samples) {
  let sum = 0;
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.abs(samples[index]);
    sum += value * value;
    if (value > peak) peak = value;
  }
  return { rms: Math.sqrt(sum / Math.max(1, samples.length)), peak };
}

function updateAsrNoiseFloor(rms) {
  const clean = Math.max(0, Math.min(0.08, Number(rms) || 0));
  if (!asrNoiseFloorRms) {
    asrNoiseFloorRms = clean || 0.006;
    return;
  }
  asrNoiseFloorRms = asrNoiseFloorRms * 0.96 + clean * 0.04;
}

function asrVadThreshold() {
  const noise = Math.max(0.001, asrNoiseFloorRms || 0.006);
  return {
    openRms: Math.max(ASR_VAD_OPEN_RMS_FLOOR, Math.min(0.04, noise * 2.8 + 0.004)),
    closeRms: Math.max(ASR_VAD_CLOSE_RMS_FLOOR, Math.min(0.03, noise * 1.8 + 0.002)),
    openPeak: Math.max(ASR_VAD_OPEN_PEAK_FLOOR, Math.min(0.12, noise * 7)),
  };
}

function pushAsrPrerollFrame(pcm, durationMs) {
  asrPrerollFrames.push({ pcm, durationMs });
  asrPrerollMs += durationMs;
  while (asrPrerollFrames.length && asrPrerollMs > ASR_VAD_PREROLL_MS) {
    const frame = asrPrerollFrames.shift();
    asrPrerollMs -= frame?.durationMs || 0;
  }
}

function openAsrVoiceGate({ includePreroll = true } = {}) {
  asrGateOpen = true;
  asrAwaitingFinal = false;
  asrTailStartedAt = 0;
  asrVoiceAttackMs = 0;
  asrLastVoiceAt = Date.now();
  clearAsrTailTimer();
  clearAsrIdleCloseTimer();
  clearAsrReadyIdleTimer();
  sendAsrClientNote("vad_gate_open", { include_preroll: includePreroll });
  el("callStatus").textContent = "正在识别";
  const frames = includePreroll ? asrPrerollFrames.splice(0) : [];
  if (!includePreroll) asrPrerollFrames = [];
  asrPrerollMs = 0;
  queueAsrFrames(frames);
}

function closeAsrVoiceGate(pcm = null, frameMs = 0) {
  if (!asrGateOpen) return;
  asrGateOpen = false;
  asrAwaitingFinal = true;
  asrTailStartedAt = Date.now();
  asrVoiceAttackMs = 0;
  sendAsrClientNote("vad_gate_close");
  el("callStatus").textContent = "等待断句";
  if (pcm?.byteLength) queueAsrFrame(pcm, frameMs);
  scheduleAsrTailStop();
}

function queueAsrFrames(frames) {
  for (const frame of frames) queueAsrFrame(frame.pcm, frame.durationMs);
}

function trimAsrPendingFrames() {
  while (asrPendingFrames.length && asrPendingMs > ASR_VAD_PENDING_MAX_MS) {
    const frame = asrPendingFrames.shift();
    asrPendingMs -= frame?.durationMs || 0;
  }
}

function pushAsrRecoveryFrame(pcm, durationMs = 0) {
  if (!pcm?.byteLength) return;
  asrRecoveryFrames.push({ pcm, durationMs });
  asrRecoveryMs += durationMs || 0;
  while (asrRecoveryFrames.length && asrRecoveryMs > ASR_RECOVERY_BUFFER_MS) {
    const frame = asrRecoveryFrames.shift();
    asrRecoveryMs -= frame?.durationMs || 0;
  }
}

function restoreAsrRecoveryFramesToPending() {
  if (!asrRecoveryFrames.length) return;
  const restored = asrRecoveryFrames.map((frame) => ({
    pcm: frame.pcm,
    durationMs: frame.durationMs || 0,
  }));
  asrPendingFrames = restored.concat(asrPendingFrames);
  asrPendingMs += restored.reduce((total, frame) => total + (frame.durationMs || 0), 0);
  trimAsrPendingFrames();
}

function clearAsrRecoveryBuffer() {
  asrRecoveryFrames = [];
  asrRecoveryMs = 0;
}

function queueAsrFrame(pcm, durationMs = 0) {
  if (!pcm?.byteLength || recognitionBlocked || !isNekoCallActive()) return;
  asrPacketFrames.push({ pcm, durationMs });
  asrPacketMs += durationMs || 0;
  if (asrPacketMs < ASR_PACKET_TARGET_MS && asrPacketFrames.length < 8) return;
  flushAsrPacketBuffer();
}

function flushAsrPacketBuffer() {
  if (!asrPacketFrames.length) return;
  const packet = concatPcmBuffers(asrPacketFrames.map((frame) => frame.pcm));
  const durationMs = asrPacketMs;
  asrPacketFrames = [];
  asrPacketMs = 0;
  enqueueAsrPacket(packet, durationMs);
}

function concatPcmBuffers(buffers) {
  const views = buffers.map((buffer) => new Uint8Array(buffer));
  const total = views.reduce((sum, view) => sum + view.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const view of views) {
    out.set(view, offset);
    offset += view.byteLength;
  }
  return out.buffer;
}

function enqueueAsrPacket(pcm, durationMs = 0) {
  if (!pcm?.byteLength || recognitionBlocked || !isNekoCallActive()) return;
  asrPendingFrames.push({ pcm, durationMs });
  asrPendingMs += durationMs;
  trimAsrPendingFrames();
  ensureAsrRelaySocket({ reason: "speech" }).then(flushAsrPendingFrames).catch(handleAsrOpenError);
}

function flushAsrPendingFrames() {
  if (!isAsrRelayReady()) return;
  clearAsrReadyIdleTimer();
  while (asrPendingFrames.length) {
    const frame = asrPendingFrames.shift();
    asrPendingMs -= frame?.durationMs || 0;
    try {
      asrSocket.send(frame.pcm);
      try { asrSocket.__asrHadAudio = true; } catch (_) {}
      pushAsrRecoveryFrame(frame.pcm, frame.durationMs || 0);
      asrUploadedAudioMs += frame.durationMs || 0;
    } catch (error) {
      asrPendingFrames.unshift(frame);
      asrPendingMs += frame?.durationMs || 0;
      throw error;
    }
  }
}

function ensureAsrRelaySocket({ reason = "speech", keepIdle = false } = {}) {
  if (!isNekoCallActive()) {
    closeAsrRelaySocket({ sendStop: true, dropPending: true });
    return Promise.reject(new Error("当前模式不使用火山 ASR"));
  }
  if (isAsrRelayReady()) return Promise.resolve(asrSocket);
  if (asrSocketOpening) return asrSocketOpening;
  el("callStatus").textContent = "正在连接火山 ASR";
  asrRelayState = "opening";
  const serial = ++asrSocketSerial;
  asrSocketOpening = openAsrRelaySocket({ reason })
    .then((socket) => {
      if (serial !== asrSocketSerial || !isNekoCallActive()) {
        if (socket) {
          try { socket.__expectedClose = true; } catch (_) {}
          try { socket.close(); } catch (_) {}
        }
        return null;
      }
      asrSocket = socket;
      asrRelayState = "ready";
      asrReadyAt = Date.now();
      scheduleAsrSessionRotate();
      if (!asrGateOpen && !asrAwaitingFinal && !asrPendingFrames.length) {
        if (keepIdle && !ASR_CONTINUOUS_STREAMING) scheduleAsrReadyIdleStale();
        el("callStatus").textContent = "正在监听";
      } else {
        el("callStatus").textContent = asrAwaitingFinal ? "等待断句" : "正在识别";
        flushAsrPendingFrames();
      }
      return socket;
    })
    .catch((error) => {
      if (serial !== asrSocketSerial) return null;
      asrRelayState = "closed";
      throw error;
    })
    .finally(() => {
      if (serial === asrSocketSerial) asrSocketOpening = null;
    });
  return asrSocketOpening;
}

function handleAsrOpenError(error) {
  if (recognitionBlocked) return;
  closeAsrRelaySocket({ sendStop: false, reason: "open_error", dropPending: false });
  if (isNekoCallActive()) {
    const message = humanizeAsrError(`火山 ASR 连接失败：${error.message || error}`);
    if (isFatalAsrError(message)) {
      if (!isDuplicateAsrError(message)) appendLine("system", message);
      recognitionBlocked = true;
      stopVolcRecognition();
      el("callStatus").textContent = "语音识别不可用";
      return;
    }
    el("callStatus").textContent = "正在重连火山 ASR";
    if (!isDuplicateAsrError(message)) appendLine("system", `${message}，正在自动重连。`);
    scheduleAsrReconnect("open_error_retry", 1500);
  }
}

function scheduleAsrTailStop(delayMs = ASR_VAD_TAIL_MS) {
  clearAsrTailTimer();
  asrTailTimer = window.setTimeout(() => {
    asrTailTimer = null;
    if (!asrGateOpen && asrAwaitingFinal) finishAsrTailSession();
  }, delayMs);
}

function clearAsrTailTimer() {
  if (asrTailTimer) {
    window.clearTimeout(asrTailTimer);
    asrTailTimer = null;
  }
}

function scheduleAsrIdleClose(delayMs = ASR_IDLE_DISCONNECT_MS) {
  if (ASR_CONTINUOUS_STREAMING) return;
  clearAsrIdleCloseTimer();
  asrIdleCloseTimer = window.setTimeout(() => {
    asrIdleCloseTimer = null;
    if (!asrGateOpen && !asrAwaitingFinal && !asrPendingFrames.length) {
      closeAsrRelaySocket({ sendStop: true, reason: "idle_disconnect", dropPending: true });
    }
  }, delayMs);
}

function clearAsrIdleCloseTimer() {
  if (asrIdleCloseTimer) {
    window.clearTimeout(asrIdleCloseTimer);
    asrIdleCloseTimer = null;
  }
}

function scheduleAsrReadyIdleStale(delayMs = ASR_READY_NO_AUDIO_STALE_MS) {
  if (ASR_CONTINUOUS_STREAMING) return;
  clearAsrReadyIdleTimer();
  if (!isAsrRelayReady() || asrPendingFrames.length) return;
  asrReadyIdleTimer = window.setTimeout(() => {
    asrReadyIdleTimer = null;
    if (!isAsrRelayReady() || asrPendingFrames.length) return;
    if (asrSocket?.__asrHadAudio) return;
    console.debug("asr ready idle stale", { reason: "ready_idle_stale" });
    asrRelayState = "stale";
    closeAsrRelaySocket({ sendStop: true, reason: "ready_idle_stale", dropPending: false });
    if (isNekoCallActive() && !recognitionBlocked) el("callStatus").textContent = "正在监听";
  }, Math.max(0, delayMs));
}

function clearAsrReadyIdleTimer() {
  if (asrReadyIdleTimer) {
    window.clearTimeout(asrReadyIdleTimer);
    asrReadyIdleTimer = null;
  }
}

function scheduleAsrSessionRotate(delayMs = ASR_SESSION_MAX_MS) {
  if (ASR_CONTINUOUS_STREAMING) return;
  clearAsrSessionRotateTimer();
  asrSessionRotateTimer = window.setTimeout(() => {
    asrSessionRotateTimer = null;
    rotateAsrSessionIfIdle();
  }, Math.max(500, delayMs));
}

function clearAsrSessionRotateTimer() {
  if (asrSessionRotateTimer) {
    window.clearTimeout(asrSessionRotateTimer);
    asrSessionRotateTimer = null;
  }
}

function rotateAsrSessionIfIdle() {
  if (ASR_CONTINUOUS_STREAMING) return;
  if (!isNekoCallActive() || recognitionBlocked) return;
  if (!asrSocket || asrSocket.readyState !== WebSocket.OPEN) return;
  if (asrGateOpen || asrAwaitingFinal || asrPendingFrames.length) {
    scheduleAsrSessionRotate(1000);
    return;
  }
  console.debug("asr session rotate", { reason: "session_rotate" });
  closeAsrRelaySocket({ sendStop: true, reason: "session_rotate", dropPending: false });
  scheduleAsrReconnect("session_rotate", 0);
}

function closeAsrRelaySocket({ sendStop = true, reason = "client_stop", dropPending = true } = {}) {
  asrSocketSerial += 1;
  asrSocketOpening = null;
  const socket = asrSocket;
  asrSocket = null;
  asrRelayState = reason === "ready_idle_stale"
    ? "stale"
    : String(reason || "").includes("reconnect") ? "recovering" : "closed";
  asrReadyAt = 0;
  if (dropPending) {
    asrPendingFrames = [];
    asrPendingMs = 0;
    asrPacketFrames = [];
    asrPacketMs = 0;
    clearAsrRecoveryBuffer();
  }
  asrAwaitingFinal = false;
  asrTailStartedAt = 0;
  clearAsrTailTimer();
  clearAsrSessionRotateTimer();
  clearAsrReadyIdleTimer();
  if (!socket) return;
  try { socket.__expectedClose = true; } catch (_) {}
  try {
    if (socket.readyState === WebSocket.OPEN && !sendStop && reason) {
      socket.send(JSON.stringify({ type: "client_note", reason }));
    }
    if (socket.readyState === WebSocket.OPEN && sendStop) socket.send(JSON.stringify({ type: "stop", reason }));
    socket.close();
  } catch (_) {}
}

function finishAsrTailSession() {
  clearAsrTailTimer();
  asrAwaitingFinal = false;
  asrTailStartedAt = 0;
  sendAsrClientNote("tail_finish");
  if (!ASR_CONTINUOUS_STREAMING) {
    scheduleAsrIdleClose();
    if (isAsrRelayReady() && !asrPendingFrames.length) scheduleAsrReadyIdleStale();
  }
  if (isNekoCallActive() && !recognitionBlocked) {
    el("callStatus").textContent = "正在监听";
  }
}

function scheduleAsrReconnect(reason = "reconnect", delayMs = ASR_RECONNECT_DELAY_MS) {
  if (!isNekoCallActive() || recognitionBlocked) return;
  clearAsrReconnectTimer();
  asrReconnectTimer = window.setTimeout(() => {
    asrReconnectTimer = null;
    if (!isNekoCallActive() || recognitionBlocked) return;
    ensureAsrRelaySocket({ reason, keepIdle: true }).catch(handleAsrOpenError);
  }, Math.max(0, delayMs));
}

function clearAsrReconnectTimer() {
  if (asrReconnectTimer) {
    window.clearTimeout(asrReconnectTimer);
    asrReconnectTimer = null;
  }
}

function sendAsrClientNote(reason, extra = {}, socket = asrSocket) {
  if (!reason || !socket || socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(JSON.stringify({ type: "client_note", reason, ...extra }));
  } catch (_) {}
}

function resetAsrVadState({ dropPending = true } = {}) {
  asrGateOpen = false;
  asrVoiceAttackMs = 0;
  asrLastVoiceAt = 0;
  asrNoiseFloorRms = 0.006;
  asrPrerollFrames = [];
  asrPrerollMs = 0;
  if (dropPending) {
    asrPendingFrames = [];
    asrPendingMs = 0;
    asrPacketFrames = [];
    asrPacketMs = 0;
    clearAsrRecoveryBuffer();
  }
  asrAwaitingFinal = false;
  asrTailStartedAt = 0;
  asrUploadedAudioMs = 0;
  asrSavedSilentMs = 0;
  clearAsrTailTimer();
  clearAsrIdleCloseTimer();
  clearAsrSessionRotateTimer();
  clearAsrReadyIdleTimer();
  clearAsrReconnectTimer();
}

function resetAsrTextState() {
  resetAsrTurnBuffer();
  asrLatestPartial = "";
  asrSilentSince = 0;
  lastAsrFinalNorm = "";
  lastAsrFinalText = "";
  lastAsrFinalAt = 0;
  lastAsrFinalStart = null;
  lastAsrFinalEnd = null;
  lastAsrFinalEndWatermark = null;
  asrFinalHistory = [];
  asrFinalNormHistory = "";
}

function observeAsrSilence(samples) {
  if (!asrLatestPartial) {
    asrSilentSince = 0;
    return;
  }
  const rms = audioRms(samples);
  const now = Date.now();
  if (rms < ASR_SILENCE_RMS) {
    asrSilentSince = asrSilentSince || now;
    if (now - asrSilentSince >= ASR_FALLBACK_FINAL_SILENCE_MS) {
      finalizeAsrPartial("silence_fallback");
    }
  } else {
    asrSilentSince = 0;
  }
}

function audioRms(samples) {
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    sum += samples[index] * samples[index];
  }
  return Math.sqrt(sum / Math.max(1, samples.length));
}

function handleAsrRelayMessage(raw) {
  let payload;
  try {
    payload = typeof raw === "string" ? JSON.parse(raw) : {};
  } catch (_) {
    return;
  }
  if (payload.type === "error") {
    const message = humanizeAsrError(payload.message || payload.error || "ASR relay 异常");
    if (isRecoverableAsrError(message)) {
      const reason = payload.code === "ready_idle_stale"
        ? "ready_idle_stale_reconnect"
        : "recoverable_timeout_reconnect";
      handleRecoverableAsrError(message, { reason });
      return;
    }
    if (!isDuplicateAsrError(message)) appendLine("system", message);
    if (isFatalAsrError(message)) {
      recognitionBlocked = true;
      stopVolcRecognition();
      el("callStatus").textContent = "语音识别不可用";
      return;
    }
    handleRecoverableAsrError(message, { reason: "recoverable_asr_error" });
    return;
  }
  if (payload.type === "partial" || payload.type === "final") asrRecoverableErrorCount = 0;
  if (isStaleAsrPayload(payload)) return;
  const text = trimAsrCumulativeText(String(payload.text || "").trim());
  if (!text || isWeakNoise(text)) return;
  if (tryLocalStopAudio(text, { announce: payload.type === "final" })) {
    if (payload.type === "final") acceptAsrFinal(text, { dispatch: false, payload });
    else acceptAsrPartial(text, payload);
    return;
  }
  if (payload.type === "final") {
    acceptAsrFinal(text, { payload });
  } else {
    acceptAsrPartial(text, payload);
  }
}

function acceptAsrPartial(text, payload = {}) {
  if (isStaleAsrPayload(payload)) return;
  const clean = trimAsrCumulativeText(text);
  if (!clean || isDuplicateAsrFinal(clean, payload)) return;
  asrLatestPartial = clean;
  asrSilentSince = 0;
  addUserPartial(clean);
}

function acceptAsrFinal(text, { dispatch = true, payload = {} } = {}) {
  if (isStaleAsrPayload(payload)) return;
  const clean = trimAsrCumulativeText(text);
  asrLatestPartial = "";
  asrSilentSince = 0;
  if (!clean || isDuplicateAsrFinal(clean, payload)) return;
  markAsrFinal(clean, payload);
  clearAsrRecoveryBuffer();
  addUserFinal(clean);
  if (payload.type === "final" && asrAwaitingFinal) {
    scheduleAsrTailStop(ASR_VAD_FINAL_CLOSE_MS);
  }
  if (dispatch) enqueueAsrTurn(clean, { source: "final" });
}

function finalizeAsrPartial() {
  const raw = String(asrLatestPartial || "").trim();
  const text = trimAsrCumulativeText(raw);
  asrLatestPartial = "";
  asrSilentSince = 0;
  if (!text || isWeakNoise(text) || isDuplicateAsrFinal(text) || isSuspiciousAsrFallbackFinal(raw, text)) return;
  markAsrFinal(text);
  addUserFinal(text);
  enqueueAsrTurn(text, { source: "fallback" });
}

function enqueueAsrTurn(text, meta = {}) {
  const clean = String(text || "").trim();
  if (!clean) {
    logAsrTurnDrop("empty", { source: meta.source || "" });
    return;
  }
  if (isWeakNoise(clean)) {
    logAsrTurnDrop("weak_noise", { text: clean, source: meta.source || "" });
    return;
  }
  const now = Date.now();
  const source = meta.source || "";
  if (isShortAsrTail(clean)) {
    if (!asrTurnBuffer.length) {
      logAsrTurnDrop("orphan_short_tail", { text: clean, source });
      return;
    }
    const last = asrTurnBuffer[asrTurnBuffer.length - 1];
    last.text = joinAsrFragments(last.text, clean);
    last.at = now;
    last.tailMerged = true;
    const merged = mergeAsrTurnBuffer();
    const waitMs = now - (asrTurnStartedAt || now);
    const delayMs = getAsrTurnFlushDelay(merged, clean, {
      bufferItems: asrTurnBuffer.length,
      waitMs,
      tailMerged: true,
    });
    console.debug("asr turn merge tail", { text: clean, merged, source, delay_ms: delayMs });
    logClientEvent("asr_final_buffered", {
      turn_id: asrTurnActiveId,
      source,
      reason: "tail_merged",
      buffer_items: asrTurnBuffer.length,
      wait_ms: waitMs,
      delay_ms: delayMs,
      text: merged,
    });
    scheduleAsrTurnFlush(delayMs);
    return;
  }
  if (!asrTurnBuffer.length) {
    asrTurnStartedAt = now;
    asrTurnActiveId = nextAsrTurnId();
  }
  asrTurnBuffer.push({ text: clean, at: now, source });
  const merged = mergeAsrTurnBuffer();
  const waitedMs = now - (asrTurnStartedAt || now);
  const delayMs = getAsrTurnFlushDelay(merged, clean, {
    bufferItems: asrTurnBuffer.length,
    waitMs: waitedMs,
    tailMerged: false,
  });
  console.debug("asr turn enqueue", { text: clean, merged, source, size: asrTurnBuffer.length, delay_ms: delayMs });
  logClientEvent("asr_final_buffered", {
    turn_id: asrTurnActiveId,
    source,
    buffer_items: asrTurnBuffer.length,
    wait_ms: waitedMs,
    delay_ms: delayMs,
    text: merged,
  });
  scheduleAsrTurnFlush(delayMs);
}

function scheduleAsrTurnFlush(delayMs = ASR_TURN_COALESCE_MS) {
  clearAsrTurnFlushTimer();
  asrTurnFlushTimer = window.setTimeout(() => {
    asrTurnFlushTimer = null;
    flushAsrTurnBuffer();
  }, Math.max(0, delayMs));
}

function clearAsrTurnFlushTimer() {
  if (asrTurnFlushTimer) {
    window.clearTimeout(asrTurnFlushTimer);
    asrTurnFlushTimer = null;
  }
}

function resetAsrTurnBuffer() {
  clearAsrTurnFlushTimer();
  asrTurnBuffer = [];
  asrTurnStartedAt = 0;
  asrTurnActiveId = "";
}

function flushAsrTurnBuffer() {
  const text = mergeAsrTurnBuffer();
  const turnId = asrTurnActiveId;
  const bufferItems = asrTurnBuffer.length;
  const waitMs = asrTurnStartedAt ? Date.now() - asrTurnStartedAt : 0;
  const source = [...new Set(asrTurnBuffer.map((item) => item.source).filter(Boolean))].join(",");
  resetAsrTurnBuffer();
  if (!text) {
    logAsrTurnDrop("flush_empty", { turn_id: turnId, buffer_items: bufferItems, wait_ms: waitMs, source });
    return;
  }
  if (isWeakNoise(text)) {
    logAsrTurnDrop("flush_weak_noise", { turn_id: turnId, buffer_items: bufferItems, wait_ms: waitMs, source, text });
    return;
  }
  if (isShortAsrTail(text)) {
    logAsrTurnDrop("flush_short_tail", { turn_id: turnId, buffer_items: bufferItems, wait_ms: waitMs, source, text });
    return;
  }
  console.debug("asr turn flush", { text, turn_id: turnId, buffer_items: bufferItems, wait_ms: waitMs });
  logClientEvent("asr_turn_flush", {
    turn_id: turnId,
    buffer_items: bufferItems,
    wait_ms: waitMs,
    source,
    text,
  });
  handleTranscript(text, { turnId }).catch((error) => appendLine("system", error.message || String(error)));
}

function mergeAsrTurnBuffer() {
  const fragments = asrTurnBuffer.map((item) => String(item.text || "").trim()).filter(Boolean);
  if (!fragments.length) return "";
  let merged = fragments[0];
  for (const fragment of fragments.slice(1)) {
    merged = joinAsrFragments(merged, fragment);
  }
  return merged.trim();
}

function isShortAsrTail(text) {
  return ASR_SHORT_TAIL_RE.test(String(text || "").trim());
}

function nextAsrTurnId() {
  asrTurnSerial += 1;
  return `asr-${Date.now().toString(36)}-${asrTurnSerial}`;
}

function logAsrTurnDrop(reason, fields = {}) {
  const payload = { ...fields, reason };
  console.debug("asr turn drop", payload);
  logClientEvent("asr_turn_drop", payload);
}

function getAsrTurnFlushDelay(mergedText, latestFragment = "", state = {}) {
  const text = String(mergedText || "").trim();
  const latest = String(latestFragment || "").trim();
  const bufferItems = Number(state.bufferItems || 0);
  const waitMs = Math.max(0, Number(state.waitMs || 0));
  if (bufferItems >= ASR_TURN_MAX_ITEMS || waitMs >= ASR_TURN_MAX_WAIT_MS) return 0;
  const remainingMs = Math.max(0, ASR_TURN_MAX_WAIT_MS - waitMs);
  const weight = utteranceCharWeight(text);
  let delayMs = ASR_TURN_MEDIUM_FLUSH_MS;
  const completePunctuation = /[。！？?!]$/.test(text);
  const questionTail = /[吗呢么嘛]$/.test(text);
  const softTail = /[吧啊呀呗噢哦喔哇嗯唔诶欸]$/.test(text);

  if (!text || isShortAsrTail(text) || weight <= 2) {
    delayMs = ASR_TURN_SHORT_FLUSH_MS;
  } else if ((state.tailMerged && weight >= 4) || (questionTail && weight >= 4) || (completePunctuation && weight >= 3)) {
    delayMs = ASR_TURN_FAST_FLUSH_MS;
  } else if (weight >= 12) {
    delayMs = ASR_TURN_FAST_FLUSH_MS;
  } else if (weight >= 6) {
    delayMs = ASR_TURN_MEDIUM_FLUSH_MS;
  } else if (softTail || isShortAsrTail(latest)) {
    delayMs = ASR_TURN_SHORT_FLUSH_MS;
  }
  return Math.max(0, Math.min(delayMs, remainingMs));
}

function joinAsrFragments(left, right) {
  const a = String(left || "").trim();
  const b = String(right || "").trim();
  if (!a) return b;
  if (!b) return a;
  if (/^[，。！？、,.!?]/.test(b) || isShortAsrTail(b)) return `${a}${b}`;
  if (/[\u4e00-\u9fff]$/.test(a) && /^[\u4e00-\u9fff]/.test(b)) return `${a}${b}`;
  return `${a} ${b}`.trim();
}

function isDuplicateAsrFinal(text, payload = {}) {
  const norm = normalizeText(text);
  const start = payload.start_time ?? null;
  const end = payload.end_time ?? null;
  if (norm && start != null && end != null && start === lastAsrFinalStart && end === lastAsrFinalEnd && norm === lastAsrFinalNorm) {
    return true;
  }
  return Boolean(norm && norm === lastAsrFinalNorm && Date.now() - lastAsrFinalAt < 2500);
}

function markAsrFinal(text, payload = {}) {
  const clean = String(text || "").trim();
  const norm = normalizeText(clean);
  lastAsrFinalText = clean;
  lastAsrFinalNorm = norm;
  lastAsrFinalAt = Date.now();
  lastAsrFinalStart = payload.start_time ?? null;
  lastAsrFinalEnd = payload.end_time ?? null;
  const end = numberOrNull(payload.end_time);
  if (end != null && (lastAsrFinalEndWatermark == null || end > lastAsrFinalEndWatermark)) {
    lastAsrFinalEndWatermark = end;
  }
  if (clean && norm) {
    asrFinalHistory.push(clean);
    if (asrFinalHistory.length > 24) asrFinalHistory = asrFinalHistory.slice(-24);
    asrFinalNormHistory = normalizeText(asrFinalHistory.join(""));
  }
}

function trimAsrCumulativeText(text) {
  let clean = String(text || "").trim();
  if (!clean) return "";
  const cleanNorm = normalizeText(clean);
  if (!cleanNorm) return "";
  if (!asrFinalNormHistory && !lastAsrFinalNorm) return clean;
  if (asrFinalNormHistory && cleanNorm === asrFinalNormHistory) return "";
  if (lastAsrFinalNorm && cleanNorm === lastAsrFinalNorm) return "";
  const rawPrefixes = [
    asrFinalHistory.join(""),
    asrFinalHistory.join(" "),
    lastAsrFinalText,
  ].filter(Boolean);
  for (const prefix of rawPrefixes) {
    if (clean.startsWith(prefix)) {
      return clean.slice(prefix.length).trim();
    }
  }
  if (asrFinalNormHistory && cleanNorm.startsWith(asrFinalNormHistory)) {
    const trimmed = trimNormalizedPrefix(clean, asrFinalNormHistory);
    return normalizeText(trimmed) === cleanNorm ? "" : trimmed;
  }
  if (lastAsrFinalText && clean.startsWith(lastAsrFinalText)) {
    return clean.slice(lastAsrFinalText.length).trim();
  }
  if (lastAsrFinalNorm && cleanNorm.startsWith(lastAsrFinalNorm)) {
    const trimmed = trimNormalizedPrefix(clean, lastAsrFinalNorm);
    return normalizeText(trimmed) === cleanNorm ? "" : trimmed;
  }
  if (looksLikeAsrHistoryCumulative(clean, cleanNorm)) return "";
  return clean;
}

function looksLikeAsrHistoryCumulative(raw, rawNorm = normalizeText(raw)) {
  if (!rawNorm || !asrFinalHistory.length) return false;
  if (asrFinalNormHistory && rawNorm.includes(asrFinalNormHistory)) return true;
  let hits = 0;
  for (const item of asrFinalHistory.slice(-8)) {
    const norm = normalizeText(item);
    if (norm && rawNorm.includes(norm)) hits += 1;
  }
  if (hits >= 2 && raw.length > 60) return true;
  const lastNorm = normalizeText(lastAsrFinalText);
  return Boolean(lastNorm && lastNorm.length >= 4 && rawNorm.includes(lastNorm) && raw.length > Math.max(50, String(lastAsrFinalText || "").length + 20));
}

function isSuspiciousAsrFallbackFinal(raw, clean) {
  const rawNorm = normalizeText(raw);
  const cleanNorm = normalizeText(clean);
  if (!rawNorm || !cleanNorm) return true;
  if (rawNorm !== cleanNorm) return false;
  return looksLikeAsrHistoryCumulative(raw, rawNorm);
}

function isStaleAsrPayload(payload = {}) {
  const end = numberOrNull(payload.end_time);
  return Boolean(end != null && lastAsrFinalEndWatermark != null && end <= lastAsrFinalEndWatermark);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function trimNormalizedPrefix(raw, prefixNorm) {
  let cursor = 0;
  for (let index = 0; index < raw.length && cursor < prefixNorm.length; index += 1) {
    const normalized = normalizeText(raw[index]);
    if (!normalized) continue;
    if (normalized !== prefixNorm[cursor]) return raw;
    cursor += 1;
    if (cursor === prefixNorm.length) return raw.slice(index + 1).trim();
  }
  return raw;
}

function humanizeAsrError(raw) {
  let text = String(raw || "").trim();
  try {
    const parsed = JSON.parse(text);
    text = findErrorText(parsed) || text;
  } catch (_) {}
  const lower = text.toLowerCase();
  if (lower.includes("ready_idle_stale") || lower.includes("stale") || text.includes("空闲过久") || text.includes("换新连接")) {
    return "火山 ASR 本轮连接已过期，正在换新连接。";
  }
  if (lower.includes("rpc timeout") || lower.includes("waiting next packet timeout") || lower.includes("timeout")) {
    return "火山 ASR 本轮超时，正在自动重连。";
  }
  if (lower.includes("session has ended") || lower.includes("session ended")) {
    return "火山 ASR 本轮会话已结束，正在自动重连。";
  }
  return text.replace(/\s+/g, " ").slice(0, 180) || "ASR relay 异常";
}

function findErrorText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(findErrorText).find(Boolean) || "";
  if (typeof value === "object") {
    for (const key of ["error", "message", "msg", "detail"]) {
      if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
    }
    for (const item of Object.values(value)) {
      const found = findErrorText(item);
      if (found) return found;
    }
  }
  return "";
}

function isDuplicateAsrError(message) {
  const text = String(message || "");
  const duplicate = text === lastAsrErrorText && Date.now() - lastAsrErrorAt < 4000;
  lastAsrErrorText = text;
  lastAsrErrorAt = Date.now();
  return duplicate;
}

function isRecoverableAsrError(message) {
  return /超时|timeout|会话已结束|session has ended|session ended|连接已过期|空闲过久|换新连接|ready_idle_stale|stale/i.test(String(message || ""));
}

function handleRecoverableAsrError(message, { reason = "recoverable_timeout_reconnect" } = {}) {
  asrRecoverableErrorCount += 1;
  asrRelayState = "recovering";
  restoreAsrRecoveryFramesToPending();
  closeAsrRelaySocket({ sendStop: false, reason, dropPending: false });
  resetAsrVadState({ dropPending: false });
  if (!isNekoCallActive()) return;
  el("callStatus").textContent = "正在重连火山 ASR";
  const notice = asrRecoverableErrorCount >= ASR_RECOVERABLE_ERROR_NOTICE_EVERY
    ? `${message} 如果连续出现，请检查火山 ASR 服务状态或网络。`
    : message;
  const now = Date.now();
  if (now - asrRecoverableNoticeAt > 60000 && !isDuplicateAsrError(notice)) {
    asrRecoverableNoticeAt = now;
    appendLine("system", notice);
  }
  scheduleAsrReconnect(reason, 0);
}

function isFatalAsrError(message) {
  return /缺少火山 API Key|服务端缺少 websockets|ASR relay WebSocket 连接失败|ASR relay 连接超时|鉴权|认证|未授权|unauthorized|forbidden|bad status|rejected|InvalidStatus|HTTP 400|HTTP 401|HTTP 403|Resource ID|开通大模型流式语音识别/i.test(String(message || ""));
}

async function startLocalMicKeepalive() {
  if (isNekoCallActive() || localMicStream) return localMicStream;
  if (localMicStarting) return localMicStarting;
  localMicStopRequested = false;
  localMicStarting = navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  }).then((stream) => {
    if (localMicStopRequested || isNekoCallActive() || !callActive) {
      stream.getTracks().forEach((track) => track.stop());
      return null;
    }
    localMicStream = stream;
    return stream;
  }).finally(() => {
    localMicStarting = null;
  });
  return localMicStarting;
}

function stopLocalMicKeepalive() {
  localMicStopRequested = true;
  if (localMicStream) {
    localMicStream.getTracks().forEach((track) => track.stop());
    localMicStream = null;
  }
}

async function startBrowserRecognition() {
  if (isNekoCallActive()) return;
  if (isIosBrowser()) {
    markRecognitionBlocked("iOS Safari 不支持 Web Speech 关键词/语义模式，请改用 Android Chrome 或 PC。");
    return;
  }
  if (!SpeechRecognition) {
    markRecognitionBlocked("当前浏览器不支持 Web Speech，请换 Chrome 或 Edge。");
    return;
  }
  if (!isSpeechSecureContext()) {
    markRecognitionBlocked("公网使用麦克风需要 HTTPS；localhost/127.0.0.1 本地预览可以直接用。");
    return;
  }
  stopLocalMicKeepalive();
  el("callStatus").textContent = "正在启动本地语音识别";
  if (isNekoCallActive() || !callActive || recognitionBlocked) return;
  startRecognition();
}

function startRecognition() {
  if (!SpeechRecognition || recognitionBlocked || recognizing) return;
  recognition = recognition || new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.continuous = !isMobileBrowser();
  recognition.interimResults = true;
  recognition.onstart = () => {
    recognizing = true;
    el("callStatus").textContent = "正在通话";
  };
  recognition.onend = () => {
    recognizing = false;
    scheduleRecognitionRestart();
  };
  recognition.onerror = (event) => {
    const error = String(event.error || "unknown");
    if (error === "aborted") return;
    if (error === "no-speech") {
      el("callStatus").textContent = "正在通话";
      return;
    }
    if (error === "network") {
      handleSpeechNetworkError();
      return;
    }
    appendLine("system", speechErrorMessage(error));
    if (isFatalSpeechError(error)) {
      recognitionBlocked = true;
      clearRecognitionRestartTimer();
      clearSpeechIdleWatch();
      el("callStatus").textContent = "语音识别不可用";
    }
  };
  recognition.onresult = (event) => {
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const text = String(result[0]?.transcript || "").trim();
      if (!text || isWeakNoise(text)) continue;
      markSpeechActivity();
      if (tryLocalStopAudio(text, { announce: result.isFinal })) {
        if (result.isFinal) addUserFinal(text);
        else addUserPartial(text);
        continue;
      }
      if (result.isFinal) {
        addUserFinal(text);
        handleTranscript(text).catch((error) => appendLine("system", error.message || String(error)));
      } else {
        addUserPartial(text);
      }
    }
  };
  try {
    recognition.start();
  } catch (error) {
    if (callActive && !recognizing && !recognitionBlocked) {
      scheduleRecognitionRestart(defaultRecognitionRestartDelay());
    } else if (error) {
      appendLine("system", `启动语音识别失败：${error.message || error}`);
    }
  }
}

function handleSpeechNetworkError() {
  speechNetworkErrorCount += 1;
  if (speechNetworkErrorCount <= SPEECH_NETWORK_MAX_RETRIES) {
    el("callStatus").textContent = `本地语音识别重连中 (${speechNetworkErrorCount}/${SPEECH_NETWORK_MAX_RETRIES})`;
    console.debug("Web Speech network retry", speechNetworkErrorCount);
    scheduleRecognitionRestart(SPEECH_NETWORK_RETRY_MS);
    return;
  }
  recognitionBlocked = true;
  clearRecognitionRestartTimer();
  clearSpeechIdleWatch();
  el("callStatus").textContent = "语音识别不可用";
  if (!speechNetworkFailureNotified) {
    speechNetworkFailureNotified = true;
    appendLine("system", speechErrorMessage("network"));
  }
}

function defaultRecognitionRestartDelay() {
  return isMobileBrowser() ? SPEECH_MOBILE_RESTART_MS : SPEECH_DESKTOP_RESTART_MS;
}

function scheduleRecognitionRestart(delayMs = defaultRecognitionRestartDelay()) {
  if (!callActive || isNekoCallActive() || recognitionBlocked || recognitionManualStop) return;
  clearRecognitionRestartTimer();
  recognitionRestartTimer = window.setTimeout(() => {
    recognitionRestartTimer = null;
    if (callActive && !recognitionBlocked && !recognizing) startRecognition();
  }, delayMs);
}

function clearRecognitionRestartTimer() {
  if (recognitionRestartTimer) {
    window.clearTimeout(recognitionRestartTimer);
    recognitionRestartTimer = null;
  }
}

function stopRecognition() {
  recognitionManualStop = true;
  clearRecognitionRestartTimer();
  if (!recognition) return;
  try {
    recognition.stop();
  } catch (_) {
    try { recognition.abort(); } catch (_) {}
  }
  recognizing = false;
}

function markRecognitionBlocked(message) {
  recognitionBlocked = true;
  el("callStatus").textContent = "语音识别不可用";
  appendLine("system", message);
}

function isSpeechSecureContext() {
  const host = location.hostname;
  return window.isSecureContext || host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isFatalSpeechError(error) {
  return ["not-allowed", "service-not-allowed", "audio-capture"].includes(String(error));
}

function speechErrorMessage(error) {
  const messages = {
    "not-allowed": "麦克风权限被拒绝；请在浏览器地址栏里允许麦克风。",
    "service-not-allowed": "浏览器语音识别服务不可用；请换 Chrome/Edge。",
    "audio-capture": "没有检测到可用麦克风；请检查设备输入。",
    network: "浏览器 Web Speech 网络识别服务连接失败；免费模式无法继续识别，请换网络/Chrome/Edge，或切到 AI猫娘使用火山 ASR。",
    "no-speech": "没有识别到说话声，我会继续听。",
    aborted: "语音识别已停止。",
  };
  return messages[error] || `语音识别异常：${error || "unknown"}`;
}

async function handleTranscript(text, context = {}) {
  if (tryLocalStopAudio(text, { announce: true })) return;
  if (isWeakNekoTranscript(text)) {
    logClientEvent("neko_gate_block", { turn_id: context.turnId || "", reason: "weak_transcript", text });
    return;
  }
  const mode = activeCallMode || settings.mode || "keyword";

  if (mode === "keyword") {
    const chosen = chooseLocalMeme(text);
    if (chosen) await playMeme(chosen, "关键词命中");
    return;
  }

  if (mode === "semantic") {
    const local = chooseLocalMeme(text);
    if (local) {
      await playMeme(local, "关键词命中");
      return;
    }
    if (!hasLlm()) {
      appendLine("system", "语义模式需要 LLM API Key。");
      return;
    }
    if (relayBackendOk === false) {
      appendLine("system", relayDeploymentHint(501));
      return;
    }
    let decision;
    try {
      decision = await decideMeme(text, context);
    } catch (error) {
      appendLine("system", error.message || String(error));
      return;
    }
    if (decision.action === "play_meme" && validMemeId(decision.meme_id)) {
      const meme = memes.find((item) => item.id === decision.meme_id);
      await playMeme(meme, decision.reason || "LLM 接梗");
      return;
    }
    console.debug("semantic no_reply", decision);
    return;
  }

  const local = bestLocalMatch(text);
  if (local && hasDirectMatch(text, local)) {
    await playMeme(local, "直通触发");
    return;
  }
  if (!hasLlm()) {
    appendLine("system", "AI猫娘模式需要 LLM API Key。");
    return;
  }
  if (relayBackendOk === false) {
    appendLine("system", relayDeploymentHint(501));
    return;
  }
  let decision;
  try {
    decision = await decideController(text, local, context);
  } catch (error) {
    appendLine("system", error.message || String(error));
    return;
  }
  logClientEvent("neko_decision", {
    turn_id: context.turnId || "",
    action: decision.action || "",
    confidence: decisionConfidence(decision),
    reason: decision.reason || "",
    text,
  });
  if (decision.action === "play_meme" && validMemeId(decision.meme_id) && decisionConfidence(decision) >= NEKO_MEME_MIN_CONFIDENCE) {
    const meme = memes.find((item) => item.id === decision.meme_id);
    await playMeme(meme, decision.reason || "LLM 接梗");
    return;
  }
  if (decision.action === "reply_tts" && decision.reply_text && settings.aiReplyEnabled) {
    if (decisionConfidence(decision) < NEKO_REPLY_MIN_CONFIDENCE && !isDirectAddressOrEmotional(text)) {
      console.debug("neko reply low confidence", decision);
    } else {
      await speakOrQueueNekoReply(clampReplyText(decision.reply_text), decision.reason || "LLM 回复", text, context);
      return;
    }
  }
  if (shouldForceNekoFallback(text, decision)) {
    await speakOrQueueNekoReply(clampReplyText(quickNekoFallbackReply(text)), "积极捧哏兜底", text, context);
    return;
  }
  if (decision.action === "wait") {
    console.debug("neko wait", decision);
    return;
  }
  console.debug("neko no_reply", decision);
}

function decisionConfidence(decision) {
  const value = Number(decision?.confidence);
  return Number.isFinite(value) ? value : 0;
}

function bestLocalMatch(text) {
  const scored = [];
  for (const meme of memes) {
    const match = matchScore(text, meme);
    if (match.score > 0) scored.push({ ...meme, _score: match.score, _phrase: match.phrase, _kind: match.kind });
  }
  scored.sort((a, b) => (b._score + (b.priority || 0) / 1000) - (a._score + (a.priority || 0) / 1000));
  return scored[0] || null;
}

function matchScore(text, meme) {
  const groups = [
    ["direct", meme.direct_triggers || [], 5],
    ["trigger", meme.triggers || [], 4],
    ["example", meme.examples || [], 3],
  ];
  for (const [kind, phrases, score] of groups) {
    for (const phrase of phrases) {
      if (containsPhrase(text, phrase)) return { kind, phrase, score: score + Math.min(0.5, String(phrase).length * 0.02) };
    }
  }
  return { score: 0 };
}

function hasDirectMatch(text, meme) {
  return (meme.direct_triggers || []).some((phrase) => containsPhrase(text, phrase));
}

function containsPhrase(text, phrase) {
  const left = normalizeText(text);
  const right = normalizeText(phrase);
  return Boolean(right && left.includes(right));
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "").trim();
}

function clampReplyText(text) {
  const limit = Math.round(clampNumber(settings.aiMaxChars, 6, 200, 48));
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > limit ? clean.slice(0, limit) : clean;
}

function semanticCandidates(text, limit = 50) {
  const query = new Set([...normalizeText(text)].filter((char) => /[\p{L}\p{N}]/u.test(char)));
  const scored = memes.map((meme) => {
    const local = matchScore(text, meme).score;
    const blob = normalizeText([
      meme.id,
      meme.title,
      meme.description,
      meme.voice_text,
      ...(meme.triggers || []),
      ...(meme.direct_triggers || []),
      ...(meme.examples || []),
      ...(meme.situations || []),
      ...(meme.tags || []),
    ].join(" "));
    let overlap = 0;
    query.forEach((char) => { if (blob.includes(char)) overlap += 1; });
    return { meme, score: local * 10 + overlap + (meme.priority || 0) / 1000 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ meme }) => compactMeme(meme));
}

function compactMeme(meme) {
  return {
    id: meme.id,
    title: meme.title,
    description: meme.description || "",
    voice_text: meme.voice_text || "",
    triggers: meme.triggers || [],
    direct_triggers: meme.direct_triggers || [],
    examples: (meme.examples || []).slice(0, 3),
    situations: (meme.situations || []).slice(0, 3),
    avoid: (meme.avoid || []).slice(0, 3),
  };
}

async function decideMeme(text, context = {}) {
  const payload = {
    trigger_transcript: text,
    recent_dialogue: recentDialogue(8),
    candidate_memes: semanticCandidates(text, 16),
  };
  return requestJsonDecision([
    { role: "system", content: LLM_MEME_SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(payload) },
  ], 0, 160, context);
}

async function decideController(text, local, context = {}) {
  const replyBudget = nekoReplyBudgetStatus(text);
  const contextLimit = Math.round(clampNumber(settings.aiContextMessages, 1, 24, 8));
  const candidateLimit = Math.round(clampNumber(settings.aiMemeCandidateLimit, 0, 512, 50));
  const memoryLimit = Math.round(clampNumber(settings.aiMemoryLimit, 0, 20, 3));
  const payload = {
    transcript: text,
    recent_dialogue: recentDialogue(contextLimit),
    relevant_memories: relevantMemories(text, memoryLimit),
    local_match: local ? compactMeme(local) : null,
    candidate_memes: semanticCandidates(text, candidateLimit),
    reply_budget: {
      allowed: settings.aiReplyEnabled && replyBudget.allowed,
      cooldown_seconds: replyBudget.cooldown_seconds,
      max_replies_per_minute: replyBudget.max_replies_per_minute,
      recent_replies_per_minute: replyBudget.recent_replies_per_minute,
      blocked_reason: replyBudget.blocked_reason,
      bypass: replyBudget.bypass,
    },
    reply_settings: {
      reply_enabled: Boolean(settings.aiReplyEnabled),
      style: presetFor(settings.aiRhythmPreset).label,
      max_chars: settings.aiMaxChars,
      proactive_enabled: Boolean(settings.aiProactiveEnabled),
      proactive_idle_seconds: settings.aiProactiveIdle,
      direct_or_emotional: isDirectAddressOrEmotional(text),
      complete_utterance_default_reply: settings.aiRhythmPreset === "chatty",
    },
  };
  return requestJsonDecision([
    { role: "system", content: nekoControllerSystemPrompt() },
    { role: "user", content: JSON.stringify(payload) },
  ], settings.aiTemperature ?? 0.65, 220, context);
}

function nekoReplyBudgetStatus(text = "", now = Date.now()) {
  const cooldownMs = Math.max(0, Number(settings.aiCooldown ?? NEKO_REPLY_COOLDOWN_MS / 1000) * 1000);
  const preset = presetFor(settings.aiRhythmPreset);
  const maxPerMinute = Math.max(0, Number(preset.maxRepliesPerMinute || 0));
  const bypass = isDirectAddressOrEmotional(text);
  pruneNekoReplyTimestamps(now);
  let blockedReason = "";
  if (now - lastNekoReplyAt < cooldownMs && !bypass) blockedReason = "cooldown";
  else if (maxPerMinute > 0 && nekoReplyTimestamps.length >= maxPerMinute && !bypass) blockedReason = "minute_cap";
  return {
    allowed: !blockedReason,
    blocked_reason: blockedReason,
    bypass,
    cooldown_seconds: cooldownMs / 1000,
    max_replies_per_minute: maxPerMinute,
    recent_replies_per_minute: nekoReplyTimestamps.length,
  };
}

function pruneNekoReplyTimestamps(now = Date.now()) {
  const cutoff = now - 60000;
  nekoReplyTimestamps = nekoReplyTimestamps.filter((item) => item >= cutoff);
}

function reserveNekoReplySlot(now = Date.now()) {
  lastNekoReplyAt = now;
  pruneNekoReplyTimestamps(now);
  nekoReplyTimestamps.push(now);
}

function isAudioActive() {
  if (browserTtsUtterance) return true;
  return Boolean(currentAudio && !currentAudio.paused && !currentAudio.ended);
}

function canStartOrdinaryNekoReply(text = "", { ignoreAudio = false } = {}) {
  const budget = nekoReplyBudgetStatus(text);
  if (!budget.allowed) {
    console.debug("neko reply blocked", budget);
    logClientEvent("neko_reply_blocked", { reason: budget.blocked_reason, text });
    return false;
  }
  if (!ignoreAudio && isAudioActive()) {
    console.debug("neko reply blocked", { blocked_reason: "audio_active" });
    logClientEvent("neko_reply_blocked", { reason: "audio_active", text });
    return false;
  }
  return true;
}

async function speakOrQueueNekoReply(text, reason = "", transcript = "", context = {}) {
  const clean = clampReplyText(text);
  if (!clean || !settings.aiReplyEnabled) return;
  if (canStartOrdinaryNekoReply(transcript)) {
    clearPendingNekoReply();
    logClientEvent("neko_reply_played", { turn_id: context.turnId || "", reason, text: transcript, reply_text: clean });
    await speakReply(clean, reason, context);
    return;
  }
  const budget = nekoReplyBudgetStatus(transcript);
  if (!isAudioActive() || (!budget.allowed && !budget.bypass)) return;
  pendingNekoReply = {
    text: clean,
    reason,
    transcript,
    context,
    expiresAt: Date.now() + NEKO_REPLY_QUEUE_MAX_AGE_MS,
  };
  logClientEvent("neko_reply_queued", { turn_id: context.turnId || "", reason, text: transcript, reply_text: clean });
  schedulePendingNekoReply();
}

function schedulePendingNekoReply(delayMs = 450) {
  if (pendingNekoReplyTimer) window.clearTimeout(pendingNekoReplyTimer);
  pendingNekoReplyTimer = window.setTimeout(() => {
    pendingNekoReplyTimer = null;
    tryPlayPendingNekoReply().catch((error) => console.debug("pending neko reply failed", error));
  }, Math.max(0, delayMs));
}

async function tryPlayPendingNekoReply() {
  if (!pendingNekoReply || !callActive) return;
  if (Date.now() > pendingNekoReply.expiresAt) {
    clearPendingNekoReply();
    return;
  }
  if (isAudioActive()) {
    schedulePendingNekoReply();
    return;
  }
  const item = pendingNekoReply;
  clearPendingNekoReply();
  if (!canStartOrdinaryNekoReply(item.transcript, { ignoreAudio: true })) return;
  logClientEvent("neko_reply_played", { turn_id: item.context?.turnId || "", reason: item.reason, text: item.transcript, reply_text: item.text });
  await speakReply(item.text, item.reason, item.context || {});
}

function clearPendingNekoReply() {
  pendingNekoReply = null;
  if (pendingNekoReplyTimer) {
    window.clearTimeout(pendingNekoReplyTimer);
    pendingNekoReplyTimer = null;
  }
}

async function requestJsonDecision(messages, temperature, maxTokens, context = {}) {
  collectSettings();
  if (!hasLlm()) throw new Error("缺少 LLM API Key");
  const startedAt = performance.now();
  const promptChars = llmMessagesCharCount(messages);
  logClientEvent("llm_request_start", {
    turn_id: context.turnId || "",
    purpose: context.llmPurpose || "decision",
    prompt_chars: promptChars,
    temperature,
    max_tokens: maxTokens,
  });
  const response = await fetch("/relay/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: settings.llmProvider,
      api_base: settings.llmBase,
      api_key: settings.llmKey,
      model: settings.llmModel,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });
  debugRelayTiming("llm", response, startedAt);
  const relayMs = Number(response.headers.get("X-Relay-Elapsed-Ms") || 0) || null;
  if (!response.ok) {
    logClientEvent("llm_response_done", {
      turn_id: context.turnId || "",
      purpose: context.llmPurpose || "decision",
      ok: false,
      status: response.status,
      elapsed_ms: Math.round(performance.now() - startedAt),
      relay_ms: relayMs,
      prompt_chars: promptChars,
    });
    throw new Error(relayDeploymentHint(response.status));
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  const result = extractJsonObject(content);
  logClientEvent("llm_response_done", {
    turn_id: context.turnId || "",
    purpose: context.llmPurpose || "decision",
    ok: true,
    status: response.status,
    elapsed_ms: Math.round(performance.now() - startedAt),
    relay_ms: relayMs,
    prompt_chars: promptChars,
  });
  return result;
}

function llmMessagesCharCount(messages) {
  try {
    return (messages || []).reduce((total, message) => total + String(message?.content || "").length, 0);
  } catch (_) {
    return 0;
  }
}

async function prepareTtsText(text, options = {}) {
  const clean = String(text || "").trim();
  if (!clean) return "";
  const language = options.language || settings.ttsLanguage || "zh";
  if (language !== "ja") return clean;
  return translateTextForTts(clean, "ja", options);
}

async function translateTextForTts(text, targetLanguage, options = {}) {
  const clean = String(text || "").trim();
  if (!clean || targetLanguage !== "ja") return clean;
  if (!hasLlm()) throw new Error("日文语音需要 LLM API Key 用于翻译。");
  const cacheKey = ttsTranslationCacheKey(clean, targetLanguage);
  const cached = ttsTranslationCacheGet(cacheKey);
  if (cached) return cached;
  const result = await requestJsonDecision([
    {
      role: "system",
      content: "Translate the user's TTS text into natural spoken Japanese. Keep it short and suitable for direct voice synthesis. Preserve the character attitude, do not add explanations, do not use Markdown. Output JSON only: {\"text\":\"...\"}.",
    },
    {
      role: "user",
      content: JSON.stringify({
        target_language: "ja-JP",
        text: clean,
      }),
    },
  ], 0.1, Math.max(80, Math.min(260, clean.length * 3)), {
    turnId: options.turnId || "",
    llmPurpose: "tts_translate",
  });
  const translated = String(result?.text || result?.translation || "").trim();
  if (!translated) throw new Error("日文语音翻译没有返回文本。");
  ttsTranslationCacheSet(cacheKey, translated);
  logClientEvent("tts_text_translated", {
    turn_id: options.turnId || "",
    purpose: options.purpose || "",
    target_language: targetLanguage,
    text: clean,
    reply_text: translated,
  });
  return translated;
}

function ttsTranslationCacheKey(text, targetLanguage) {
  const fingerprint = {
    schema: 1,
    target_language: targetLanguage,
    provider: settings.llmProvider || "",
    model: settings.llmModel || "",
    text: String(text || "").trim(),
  };
  return hashString(JSON.stringify(fingerprint));
}

function loadTtsTranslationCache() {
  try {
    const value = JSON.parse(localStorage.getItem(TTS_TRANSLATION_CACHE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch (_) {
    return {};
  }
}

function saveTtsTranslationCache(cache) {
  try {
    const entries = Object.entries(cache || {}).slice(-300);
    localStorage.setItem(TTS_TRANSLATION_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch (_) {}
}

function ttsTranslationCacheGet(key) {
  const cache = loadTtsTranslationCache();
  return String(cache[key] || "").trim();
}

function ttsTranslationCacheSet(key, value) {
  const cache = loadTtsTranslationCache();
  cache[key] = String(value || "").trim();
  saveTtsTranslationCache(cache);
}

function resolveRelayWs(path) {
  const base = location.protocol === "https:" ? "wss" : "ws";
  return `${base}://${location.host}${path}`;
}

function resampleTo16k(input, inputRate) {
  if (!input.length || inputRate === 16000) return input;
  const ratio = inputRate / 16000;
  const length = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    output[i] = input[Math.min(input.length - 1, Math.round(i * ratio))];
  }
  return output;
}

function floatToPcm16(samples) {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return out.buffer;
}

function normalizeOpenAiBase(raw) {
  let base = String(raw || DEFAULTS.llmBase).trim().replace(/\/+$/, "");
  base = base.replace(/\/chat\/completions$/, "");
  if (base.includes("ark.cn-") && base.includes("volces.com") && !base.endsWith("/api/v3")) {
    base += "/api/v3";
  } else if (!base.endsWith("/v1") && !base.endsWith("/api/v3")) {
    base += "/v1";
  }
  return base;
}

function extractJsonObject(content) {
  if (content && typeof content === "object") return content;
  const text = String(content || "");
  for (let start = text.indexOf("{"); start >= 0; start = text.indexOf("{", start + 1)) {
    let depth = 0;
    for (let end = start; end < text.length; end += 1) {
      if (text[end] === "{") depth += 1;
      if (text[end] === "}") depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, end + 1));
        } catch (_) {
          break;
        }
      }
    }
  }
  throw new Error("LLM 没有返回可解析 JSON");
}

async function playMeme(meme, reason = "") {
  if (!meme) return;
  const now = Date.now();
  const cooldown = Number(meme.cooldown_ms || 1200);
  if (now - (lastPlayedAt.get(meme.id) || 0) < cooldown) return;
  lastPlayedAt.set(meme.id, now);
  appendLine("ai", reason ? "哼，接住了。" : "哼，接住了。");
  lastNekoReplyAt = Date.now();
  const playbackUrl = await resolveMemePlaybackUrl(meme);
  if (!playbackUrl) return;
  await playUrl(playbackUrl);
}

async function resolveMemePlaybackUrl(meme) {
  const mode = String(meme.tts_mode || "auto").toLowerCase();
  const canUseTts = mode !== "audio" && String(meme.voice_text || "").trim();
  if (canUseTts) {
    const cachedUrl = await getMemeTtsObjectUrl(meme);
    if (cachedUrl) {
      console.debug("meme_tts_cache_hit", { meme_id: meme.id, mode });
      return cachedUrl;
    }
    console.debug("meme_tts_cache_miss", { meme_id: meme.id, mode });
    if (mode === "tts") appendLine("system", "这条梗语音还没有本机预制，已回退原梗音频。");
  }
  console.debug("original_audio", { meme_id: meme.id, mode });
  const rawUrl = meme.audio_url || "";
  const cachedDefaultUrl = await getDefaultAudioObjectUrl(rawUrl);
  if (cachedDefaultUrl) {
    console.debug("default_audio_cache_hit", { meme_id: meme.id, mode });
    return cachedDefaultUrl;
  }
  return rawUrl;
}

async function getMemeTtsObjectUrl(meme) {
  const key = memeTtsCacheKey(meme);
  if (!key) return "";
  const objectKey = `meme-tts://${key}`;
  if (memeObjectUrls.has(objectKey)) return memeObjectUrls.get(objectKey);
  const blob = await memeTtsGet(key);
  if (!blob) return "";
  const objectUrl = URL.createObjectURL(blob);
  memeObjectUrls.set(objectKey, objectUrl);
  return objectUrl;
}

async function speakReply(text, reason = "", context = {}) {
  reserveNekoReplySlot();
  if (!hasTts()) {
    let fallbackText = text;
    try {
      fallbackText = await prepareTtsText(text, { purpose: "browser_tts_fallback", turnId: context.turnId || "" });
    } catch (_) {}
    appendLine("ai", text);
    await speakBrowserFallback(fallbackText, "未配置火山语音");
    return;
  }
  el("callStatus").textContent = "合成语音中";
  try {
    const speechText = await prepareTtsText(text, { purpose: "neko_reply", turnId: context.turnId || "" });
    const audioBlob = await requestVolcTts(speechText, { purpose: "neko_reply", turnId: context.turnId || "" });
    appendLine("ai", text);
    await playBlob(audioBlob, { logTtsPlayback: true, turnId: context.turnId || "", text: speechText, reason });
  } catch (error) {
    appendLine("ai", text);
    const ok = await speakBrowserFallback(text, error);
    if (!ok) appendLine("system", ttsFetchErrorMessage(error));
  } finally {
    el("callStatus").textContent = "正在通话";
  }
}

async function speakBrowserFallback(text, reason = "") {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    if (reason === "未配置火山语音") appendLine("system", "未配置火山语音，浏览器语音兜底不可用，已只显示文字。");
    return false;
  }
  try {
    await speakWithBrowserTts(text);
    console.debug("browser tts fallback", reason);
    return true;
  } catch (error) {
    console.debug("browser tts fallback failed", error);
    if (reason === "未配置火山语音") appendLine("system", "未配置火山语音，浏览器语音兜底失败，已只显示文字。");
    return false;
  }
}

function speakWithBrowserTts(text) {
  return new Promise((resolve, reject) => {
    const content = String(text || "").trim();
    if (!content) {
      resolve();
      return;
    }
    stopBrowserTts();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = "zh-CN";
    utterance.rate = 1.05;
    utterance.pitch = 1.08;
    utterance.volume = 1;
    const voice = chooseBrowserTtsVoice();
    if (voice) utterance.voice = voice;
    let settled = false;
    const settleStarted = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.clearTimeout(startTimer);
      resolve();
    };
    const settleFailed = (error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(startTimer);
      browserTtsUtterance = null;
      reject(error);
    };
    const timer = window.setTimeout(() => {
      browserTtsUtterance = null;
      settleFailed(new Error("浏览器语音兜底超时"));
    }, Math.max(6000, content.length * 420));
    const startTimer = window.setTimeout(settleStarted, 800);
    utterance.onstart = settleStarted;
    utterance.onend = () => {
      window.clearTimeout(timer);
      window.clearTimeout(startTimer);
      browserTtsUtterance = null;
      tryPlayPendingNekoReply().catch((error) => console.debug("pending neko reply failed", error));
    };
    utterance.onerror = (event) => {
      window.clearTimeout(timer);
      browserTtsUtterance = null;
      settleFailed(new Error(event.error || "浏览器语音兜底失败"));
    };
    browserTtsUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  });
}

function chooseBrowserTtsVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  if (!voices.length) return null;
  const zhVoices = voices.filter((voice) => /^zh/i.test(voice.lang || "") || /Chinese|Mandarin|中文|普通话/i.test(voice.name || ""));
  const preferred = zhVoices.find((voice) => /xiaoxiao|xiaoyi|yunxi|xiaobei|microsoft|edge|natural/i.test(voice.name || ""));
  return preferred || zhVoices[0] || voices[0] || null;
}

function stopBrowserTts() {
  if (!window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
  } catch (_) {}
  browserTtsUtterance = null;
}

async function requestVolcTts(text, options = {}) {
  collectSettings();
  const startedAt = performance.now();
  logClientEvent("tts_request_start", {
    turn_id: options.turnId || "",
    purpose: options.purpose || "",
    text,
  });
  const response = await fetch("/relay/volc-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appid: settings.ttsAppid,
      access_token: settings.ttsToken,
      voice_type: settings.ttsVoice,
      resource_id: settings.ttsResource || DEFAULTS.ttsResource,
      endpoint: DEFAULTS.ttsEndpoint,
      text,
      sample_rate: 24000,
      purpose: options.purpose || "",
      meme_id: options.memeId || "",
    }),
  });
  debugRelayTiming("volc-tts", response, startedAt);
  const relayMs = Number(response.headers.get("X-Relay-Elapsed-Ms") || 0) || null;
  if (!response.ok) {
    logClientEvent("tts_response_done", {
      turn_id: options.turnId || "",
      purpose: options.purpose || "",
      ok: false,
      status: response.status,
      elapsed_ms: Math.round(performance.now() - startedAt),
      relay_ms: relayMs,
      text,
    });
    throw new Error(`TTS relay 请求失败：${response.status}`);
  }
  const raw = new Uint8Array(await response.arrayBuffer());
  const audioBytes = extractVolcAudio(raw);
  logClientEvent("tts_response_done", {
    turn_id: options.turnId || "",
    purpose: options.purpose || "",
    ok: true,
    status: response.status,
    elapsed_ms: Math.round(performance.now() - startedAt),
    relay_ms: relayMs,
    audio_bytes: audioBytes.byteLength,
    text,
  });
  return new Blob([audioBytes], { type: "audio/mpeg" });
}

function ttsFetchErrorMessage(error) {
  const raw = String(error?.message || error || "");
  if (/failed to fetch|load failed|networkerror/i.test(raw)) {
    return "TTS relay 请求失败，请确认当前页面是通过公网版后端服务打开的。";
  }
  return raw || "TTS 请求失败。";
}

function extractVolcAudio(raw) {
  if (looksLikeAudio(raw)) return raw;
  const text = new TextDecoder("utf-8").decode(raw);
  const chunks = [];
  for (const line of text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    try {
      collectAudioChunks(JSON.parse(line), chunks);
    } catch (_) {
      const direct = maybeBase64Audio(line);
      if (direct) chunks.push(direct);
    }
  }
  if (!chunks.length) {
    try {
      collectAudioChunks(JSON.parse(text), chunks);
    } catch (_) {}
  }
  if (!chunks.length) throw new Error(`TTS 响应没有音频数据：${text.slice(0, 120)}`);
  return concatUint8(chunks);
}

function collectAudioChunks(value, chunks) {
  if (!value) return;
  if (typeof value === "string") {
    const audio = maybeBase64Audio(value);
    if (audio) chunks.push(audio);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectAudioChunks(item, chunks));
    return;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (["data", "audio", "audio_data", "payload", "binary", "chunk"].includes(String(key).toLowerCase())) {
        collectAudioChunks(item, chunks);
      } else if (typeof item === "object") {
        collectAudioChunks(item, chunks);
      }
    }
  }
}

function maybeBase64Audio(value) {
  const text = String(value || "").trim();
  if (!/^[A-Za-z0-9+/=\s]+$/.test(text) || text.length < 32) return null;
  try {
    const binary = atob(text.replace(/\s+/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return looksLikeAudio(bytes) || bytes.length > 128 ? bytes : null;
  } catch (_) {
    return null;
  }
}

function looksLikeAudio(bytes) {
  return bytes?.length > 4 && (
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) ||
    (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) ||
    (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53)
  );
}

function concatUint8(chunks) {
  const total = chunks.reduce((sum, item) => sum + item.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    out.set(chunk, offset);
    offset += chunk.length;
  });
  return out;
}

async function playUrl(url, options = {}) {
  stopAudio();
  const absoluteUrl = await resolveAudioUrl(url);
  currentAudio = new Audio(absoluteUrl);
  currentAudio.preload = "auto";
  currentAudio.setAttribute("playsinline", "");
  const playbackStartedAt = performance.now();
  currentAudio.addEventListener("ended", () => {
    if (options.logTtsPlayback) {
      logClientEvent("tts_play_end", {
        turn_id: options.turnId || "",
        elapsed_ms: Math.round(performance.now() - playbackStartedAt),
        text: options.text || "",
      });
    }
    tryPlayPendingNekoReply().catch((error) => console.debug("pending neko reply failed", error));
  }, { once: true });
  try {
    await currentAudio.play();
    if (options.logTtsPlayback) {
      logClientEvent("tts_play_start", {
        turn_id: options.turnId || "",
        reason: options.reason || "",
        text: options.text || "",
      });
    }
  } catch (error) {
    appendLine("system", `音频播放失败：${error.message || error}。请点一次页面后重试，手机浏览器也要确认没有静音拦截。`);
    throw error;
  }
}

async function resolveAudioUrl(url) {
  const value = String(url || "");
  if (!value.startsWith("idb://")) return new URL(value, location.href).href;
  if (memeObjectUrls.has(value)) return memeObjectUrls.get(value);
  const blob = await idbGet(`${IDB_AUDIO_PREFIX}${value.slice("idb://".length)}`);
  if (!blob) throw new Error("导入梗库中的音频文件不存在");
  const objectUrl = URL.createObjectURL(blob);
  memeObjectUrls.set(value, objectUrl);
  return objectUrl;
}

async function playBlob(blob, options = {}) {
  const url = URL.createObjectURL(blob);
  try {
    await playUrl(url, options);
  } finally {
    if (currentAudio) currentAudio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
  }
}

function stopAudio() {
  stopBrowserTts();
  if (!currentAudio) return;
  try {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  } catch (_) {}
  currentAudio = null;
}

async function unlockAudio() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (AudioContextCtor) {
    audioContext = audioContext || new AudioContextCtor();
    try {
      await audioContext.resume();
      const source = audioContext.createBufferSource();
      source.buffer = audioContext.createBuffer(1, 1, 22050);
      source.connect(audioContext.destination);
      source.start(0);
    } catch (_) {}
  }
  const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQQAAAAAAA==");
  audio.volume = 0.01;
  audio.setAttribute("playsinline", "");
  try {
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
  } catch (_) {}
}

function addUserPartial(text) {
  if (!partialLine) {
    partialLine = appendLine("user", `你：${text}`, true);
  } else {
    partialLine.textContent = `你：${text}`;
  }
  scrollDialogue();
}

function addUserFinal(text) {
  if (partialLine) {
    partialLine.textContent = `你：${text}`;
    partialLine.classList.remove("partial");
    partialLine = null;
  } else {
    appendLine("user", `你：${text}`);
  }
  recordConfirmedDialogue("user", text);
  rememberDialogue("user", text);
}

function appendLine(kind, text, partial = false) {
  const node = document.createElement("p");
  node.className = `line ${kind}${partial ? " partial" : ""}`;
  node.textContent = kind === "ai" ? `AI：${text}` : text;
  dialogueLog.appendChild(node);
  scrollDialogue();
  if (!partial && kind === "ai" && callActive) {
    recordConfirmedDialogue("ai", text);
    rememberDialogue("ai", text);
  }
  return node;
}

function scrollDialogue() {
  dialogueLog.scrollTop = dialogueLog.scrollHeight;
}

function recentDialogue(limit) {
  return confirmedDialogue
    .slice(-limit)
    .map((item) => `${item.role === "user" ? "你" : "AI"}：${item.text}`);
}

function recordConfirmedDialogue(role, text) {
  const clean = String(text || "").trim();
  if (!clean || isWeakNoise(clean)) return;
  const last = confirmedDialogue[confirmedDialogue.length - 1];
  if (last?.role === role && last?.text === clean && Date.now() - Number(last.ts || 0) < 2500) return;
  confirmedDialogue = [...confirmedDialogue, { role, text: clean.slice(0, 220), ts: Date.now() }].slice(-80);
}

function rememberDialogue(role, text) {
  if (!settings.aiMemoryEnabled || settings.mode !== "neko") return;
  const clean = String(text || "").trim();
  if (!clean || isWeakNoise(clean)) return;
  const items = Array.isArray(settings.aiMemoryItems) ? settings.aiMemoryItems : [];
  const last = items[items.length - 1];
  if (last?.role === role && last?.text === clean && Date.now() - Number(last.ts || 0) < 3000) return;
  settings.aiMemoryItems = [...items, { role, text: clean.slice(0, 180), ts: Date.now() }].slice(-80);
  saveSettings();
}

function relevantMemories(text, limit) {
  if (!settings.aiMemoryEnabled || !limit) return [];
  const query = normalizeText(text);
  if (!query) return [];
  const queryChars = new Set([...query].filter((char) => /[\p{L}\p{N}]/u.test(char)));
  const scored = (settings.aiMemoryItems || []).slice(0, -2).map((item) => {
    const blob = normalizeText(item.text);
    let overlap = 0;
    queryChars.forEach((char) => { if (blob.includes(char)) overlap += 1; });
    const direct = blob && (query.includes(blob) || blob.includes(query)) ? 8 : 0;
    return { item, score: direct + overlap };
  }).filter(({ score }) => score > 0);
  scored.sort((a, b) => b.score - a.score || Number(b.item.ts || 0) - Number(a.item.ts || 0));
  return scored.slice(0, limit).map(({ item }) => `${item.role === "user" ? "用户" : "AI"}：${item.text}`);
}

function hasLlm() {
  return Boolean(settings.llmBase && settings.llmModel && settings.llmKey);
}

function hasTts() {
  return Boolean(settings.ttsAppid && settings.ttsToken && settings.ttsVoice);
}

function hasVolcAsr() {
  return Boolean(settings.asrApiKey && (settings.asrResource || DEFAULT_ASR_RESOURCE));
}


function validMemeId(id) {
  return memes.some((item) => item.id === id);
}

function isWeakNoise(text) {
  const clean = normalizeText(text);
  return /^(i|yeah|okay|ok|嗯|啊|呃|呃呃)$/.test(clean);
}

async function testLlm() {
  collectSettings();
  if (!hasLlm()) {
    setResult("llmResult", "请先填写 LLM API Key。", false);
    return;
  }
  if (relayBackendOk === false) {
    setResult("llmResult", relayDeploymentHint(501), false);
    return;
  }
  setResult("llmResult", "测试中...");
  try {
    const result = await requestJsonDecision([
      { role: "system", content: LLM_MEME_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          trigger_transcript: "现在测试大模型接梗裁判，正常情况下可以选择闭嘴。",
          recent_dialogue: [],
          candidate_memes: [],
        }),
      },
    ], 0, 80);
    setResult("llmResult", `可用：${result.action || "ok"}${result.reason ? `（${result.reason}）` : ""}`, true);
  } catch (error) {
    setResult("llmResult", error.message || String(error), false);
  }
}

async function testTts() {
  collectSettings();
  const text = "你好，公网版测试成功。";
  setResult("ttsResult", "测试中...");
  if (!hasTts()) {
    const ok = await speakBrowserFallback(text, "未配置火山语音");
    setResult("ttsResult", ok ? "未配置火山语音，已使用浏览器语音兜底。" : "未配置火山语音，浏览器语音兜底不可用。", ok);
    return;
  }
  try {
    const speechText = await prepareTtsText(text, { purpose: "tts_test" });
    const blob = await requestVolcTts(speechText, { purpose: "tts_test" });
    setResult("ttsResult", "可用，正在播放。", true);
    await playBlob(blob);
  } catch (error) {
    const ok = await speakBrowserFallback(text, error);
    setResult("ttsResult", ok ? "火山 TTS 不可用，已使用浏览器语音兜底。" : ttsFetchErrorMessage(error), ok);
  }
}

function setResult(id, text, ok = null) {
  const node = el(id);
  node.textContent = text;
  node.classList.toggle("ok", ok === true);
  node.classList.toggle("bad", ok === false);
}

function memeTtsEligible(meme) {
  return Boolean(meme && String(meme.voice_text || "").trim() && String(meme.tts_mode || "auto").toLowerCase() !== "audio");
}

function memeTtsCacheKey(meme) {
  if (!memeTtsEligible(meme)) return "";
  const fingerprint = {
    schema: 2,
    meme_id: meme.id,
    voice_text: String(meme.voice_text || "").trim(),
    tts_language: settings.ttsLanguage || "zh",
    llm_provider: settings.ttsLanguage === "ja" ? settings.llmProvider || "" : "",
    llm_model: settings.ttsLanguage === "ja" ? settings.llmModel || "" : "",
    voice_type: settings.ttsVoice || "",
    resource_id: settings.ttsResource || DEFAULTS.ttsResource,
    endpoint: DEFAULTS.ttsEndpoint,
    sample_rate: 24000,
    speed_ratio: 1,
    volume_ratio: 1,
    pitch_ratio: 1,
  };
  return `${MEME_TTS_PREFIX}${safeFileName(meme.id || "meme")}:${hashString(JSON.stringify(fingerprint))}`;
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function defaultAudioCacheSupported() {
  return Boolean(window.caches && window.Request && window.Response);
}

function defaultAudioUrls() {
  const urls = new Set();
  for (const meme of defaultMemes) {
    const raw = String(meme.audio_url || "").trim();
    if (!raw || raw.startsWith("idb://") || /^data:/i.test(raw)) continue;
    try {
      const url = new URL(raw, location.href);
      if (url.origin === location.origin) urls.add(url.href);
    } catch (_) {}
  }
  return [...urls];
}

function defaultAudioCacheName() {
  const urls = defaultAudioUrls().map((url) => {
    try {
      const parsed = new URL(url);
      return parsed.pathname;
    } catch (_) {
      return url;
    }
  }).sort();
  return `${DEFAULT_AUDIO_CACHE_PREFIX}${hashString(JSON.stringify(urls))}`;
}

async function updateDefaultAudioCacheSummary() {
  const node = el("defaultAudioCacheSummary");
  if (!node) return;
  const urls = defaultAudioUrls();
  if (!urls.length) {
    node.textContent = "默认梗音频 0 条。";
    return;
  }
  if (!defaultAudioCacheSupported()) {
    node.textContent = `当前浏览器不支持默认音频缓存，默认梗音频 ${urls.length} 条会按需请求。`;
    return;
  }
  try {
    const cache = await caches.open(defaultAudioCacheName());
    let cached = 0;
    for (const url of urls) {
      if (await cache.match(url)) cached += 1;
    }
    node.textContent = `默认梗音频 ${urls.length} 条，浏览器已缓存 ${cached} 条。`;
  } catch (error) {
    node.textContent = `默认梗音频缓存状态读取失败：${error.message || error}`;
  }
}

async function warmDefaultAudioCache() {
  if (!defaultAudioCacheSupported()) {
    await updateDefaultAudioCacheSummary();
    return;
  }
  const urls = defaultAudioUrls();
  if (!urls.length) {
    await updateDefaultAudioCacheSummary();
    return;
  }
  const cache = await caches.open(defaultAudioCacheName());
  let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const url = urls[cursor];
      cursor += 1;
      if (await cache.match(url)) continue;
      try {
        const response = await fetch(url, { cache: "force-cache" });
        if (response.ok) await cache.put(url, response.clone());
      } catch (error) {
        console.debug("default audio cache miss", { url, error });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(DEFAULT_AUDIO_CACHE_CONCURRENCY, urls.length) }, worker));
  await updateDefaultAudioCacheSummary();
}

async function getDefaultAudioObjectUrl(rawUrl) {
  if (!defaultAudioCacheSupported()) return "";
  let absoluteUrl = "";
  try {
    const url = new URL(String(rawUrl || ""), location.href);
    if (url.origin !== location.origin) return "";
    absoluteUrl = url.href;
  } catch (_) {
    return "";
  }
  const objectKey = `default-audio:${absoluteUrl}`;
  if (memeObjectUrls.has(objectKey)) return memeObjectUrls.get(objectKey);
  const cache = await caches.open(defaultAudioCacheName());
  let response = await cache.match(absoluteUrl);
  if (!response) {
    response = await fetch(absoluteUrl, { cache: "force-cache" });
    if (!response.ok) return "";
    await cache.put(absoluteUrl, response.clone());
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  memeObjectUrls.set(objectKey, objectUrl);
  updateDefaultAudioCacheSummary().catch(() => {});
  return objectUrl;
}

async function clearDefaultAudioCache() {
  if (!defaultAudioCacheSupported()) {
    setResult("memePackResult", "当前浏览器不支持默认音频缓存。", false);
    return;
  }
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.startsWith(DEFAULT_AUDIO_CACHE_PREFIX)).map((name) => caches.delete(name)));
  revokeDefaultAudioObjectUrls();
  await updateDefaultAudioCacheSummary();
  setResult("memePackResult", "已清除默认梗音频浏览器缓存。", true);
}

async function updateMemeTtsSummary() {
  const node = el("memeTtsSummary");
  if (!node) return;
  const eligible = memes.filter(memeTtsEligible);
  const language = TTS_LANGUAGE_LABELS[settings.ttsLanguage || "zh"] || "中文";
  let cached = 0;
  for (const meme of eligible) {
    if (await memeTtsGet(memeTtsCacheKey(meme))) cached += 1;
  }
  node.textContent = `可预制梗语音 ${eligible.length} 条，当前音色/${language}已缓存 ${cached} 条。预制语音只保存在这个浏览器本地。`;
}

async function prebuildMemeTts({ force = false } = {}) {
  collectSettings();
  if (!hasTts()) {
    setResult("memeTtsResult", "请先填写火山 TTS AppID、Access Token 和音色 ID。", false);
    return;
  }
  if (relayBackendOk === false) {
    setResult("memeTtsResult", relayDeploymentHint(501), false);
    return;
  }
  const candidates = memes.filter(memeTtsEligible);
  let done = 0;
  let skipped = 0;
  let failed = 0;
  for (const meme of candidates) {
    const key = memeTtsCacheKey(meme);
    if (!force && await memeTtsGet(key)) {
      skipped += 1;
      continue;
    }
    setResult("memeTtsResult", `预制中 ${done + failed + skipped + 1}/${candidates.length}：${meme.title || meme.id}`);
    try {
      const speechText = await prepareTtsText(meme.voice_text, { purpose: "meme_prebuild", memeId: meme.id });
      const blob = await requestVolcTts(speechText, { purpose: "meme_prebuild", memeId: meme.id });
      await memeTtsSet(key, blob);
      done += 1;
    } catch (error) {
      failed += 1;
      console.debug("meme tts prebuild failed", { meme_id: meme.id, error });
    }
  }
  await updateMemeTtsSummary();
  setResult("memeTtsResult", `预制完成：新增 ${done}，跳过 ${skipped}，失败 ${failed}。`, failed === 0);
}

async function clearMemeTtsCache() {
  if (!confirm("确认清除这个浏览器里的预制梗语音缓存？不会清除火山 Key 或梗库。")) return;
  await clearMemeTtsDb();
  revokeMemeObjectUrls();
  await updateMemeTtsSummary();
  setResult("memeTtsResult", "已清除预制梗语音缓存。", true);
}

function exportSettings() {
  collectSettings();
  const safe = { ...settings };
  const blob = new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" });
  downloadBlob(blob, "ai-meme-neko-public-settings.json");
}

async function importSettings(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    settings = normalizeSettings(imported);
    saveSettings();
    renderSettings();
    renderMode();
    renderSupportNotice();
    appendLine("system", "已导入本机配置。");
  } catch (error) {
    appendLine("system", `导入失败：${error.message || error}`);
  } finally {
    event.target.value = "";
  }
}

function renderMemePanel() {
  const audioCount = memes.filter((item) => item.audio_url).length;
  el("memeSummary").textContent = `当前梗库 ${memes.length} 条，带音频 ${audioCount} 条。导入梗库只保存在这个浏览器的 IndexedDB。`;
  updateDefaultAudioCacheSummary().catch((error) => {
    const node = el("defaultAudioCacheSummary");
    if (node) node.textContent = `默认梗音频缓存状态读取失败：${error.message || error}`;
  });
  updateMemeTtsSummary().catch((error) => {
    const node = el("memeTtsSummary");
    if (node) node.textContent = `预制梗语音状态读取失败：${error.message || error}`;
  });
  const select = el("memeSelect");
  const previous = selectedMemeId || select.value;
  select.innerHTML = "";
  memes.forEach((meme) => {
    const option = document.createElement("option");
    option.value = meme.id;
    option.textContent = `${meme.title || meme.id} (${meme.id})`;
    select.appendChild(option);
  });
  selectedMemeId = memes.some((item) => item.id === previous) ? previous : (memes[0]?.id || "");
  select.value = selectedMemeId;
  populateMemeEditor();
}

function populateMemeEditor() {
  const meme = memes.find((item) => item.id === selectedMemeId);
  setResult("memeEditResult", "");
  if (!meme) return;
  el("memeTitle").value = meme.title || "";
  el("memeTriggers").value = listToLines(meme.triggers);
  el("memeDirectTriggers").value = listToLines(meme.direct_triggers);
  el("memeDescription").value = meme.description || "";
  el("memeSituations").value = listToLines(meme.situations);
  el("memeAvoid").value = listToLines(meme.avoid);
  el("memeAudioFile").value = "";
}

async function saveMemeEdit() {
  const meme = memes.find((item) => item.id === selectedMemeId);
  if (!meme) return;
  try {
    meme.title = el("memeTitle").value.trim() || meme.id;
    meme.triggers = parseListInput(el("memeTriggers").value);
    meme.direct_triggers = parseListInput(el("memeDirectTriggers").value);
    meme.description = el("memeDescription").value.trim();
    meme.situations = parseListInput(el("memeSituations").value);
    meme.avoid = parseListInput(el("memeAvoid").value);
    const file = el("memeAudioFile").files?.[0];
    if (file) {
      const path = `assets/audio/user/${safeFileName(`${meme.id}-${file.name}`)}`;
      await idbSet(`${IDB_AUDIO_PREFIX}${path}`, file);
      meme.audio_url = `idb://${path}`;
    }
    await saveCustomMemePack();
    renderMemePanel();
    renderSupportNotice();
    setResult("memeEditResult", "已保存梗详情。", true);
  } catch (error) {
    setResult("memeEditResult", error.message || String(error), false);
  }
}

async function exportMemePack() {
  setResult("memePackResult", "正在导出...");
  try {
    const files = [];
    const exportedItems = [];
    const addedAudio = new Set();
    for (const meme of memes) {
      const item = cloneMeme(meme);
      if (item.audio_url) {
        const audio = await readAudioForExport(item.audio_url, item.id);
        if (audio?.bytes?.length) {
          item.audio_url = `./${audio.path}`;
          if (!addedAudio.has(audio.path)) {
            files.push({ name: audio.path, data: audio.bytes });
            addedAudio.add(audio.path);
          }
        }
      }
      exportedItems.push(item);
    }
    const manifest = {
      schema: 1,
      generated_by: "public_web",
      items: exportedItems,
      audio_copied: addedAudio.size,
      missing_audio: [],
    };
    files.unshift({
      name: "memes.public.json",
      data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
    });
    downloadBlob(new Blob([createZip(files)], { type: "application/zip" }), "ai-meme-neko-memes.zip");
    setResult("memePackResult", "已导出 ZIP。", true);
  } catch (error) {
    setResult("memePackResult", error.message || String(error), false);
  }
}

async function importMemePack(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  setResult("memePackResult", "正在导入...");
  try {
    const entries = await parseZip(file);
    const manifestName = [...entries.keys()].find((name) => name.endsWith("memes.public.json"))
      || [...entries.keys()].find((name) => name.endsWith(".json"));
    if (!manifestName) throw new Error("ZIP 中没有找到 memes.public.json");
    const manifest = JSON.parse(new TextDecoder("utf-8").decode(entries.get(manifestName)));
    const rawItems = Array.isArray(manifest.items) ? manifest.items : manifest;
    if (!Array.isArray(rawItems) || !rawItems.length) throw new Error("梗库 JSON 中没有 items");
    await clearMemeDb();
    const imported = [];
    for (const raw of rawItems) {
      const item = normalizeMemeItem(raw);
      const audioPath = exportAudioPath(item.audio_url || item.file || "");
      if (audioPath && entries.has(audioPath)) {
        const blob = new Blob([entries.get(audioPath)], { type: mimeForPath(audioPath) });
        await idbSet(`${IDB_AUDIO_PREFIX}${audioPath}`, blob);
        item.audio_url = `idb://${audioPath}`;
      }
      imported.push(item);
    }
    memes = imported;
    selectedMemeId = memes[0]?.id || "";
    await saveCustomMemePack();
    renderMemePanel();
    renderSupportNotice();
    setResult("memePackResult", "已导入梗库 ZIP。", true);
  } catch (error) {
    setResult("memePackResult", error.message || String(error), false);
  } finally {
    event.target.value = "";
  }
}

async function restoreDefaultMemes() {
  if (!confirm("确认恢复默认梗库？这会清除浏览器里导入或编辑过的梗库。")) return;
  await clearMemeDb();
  revokeMemeObjectUrls();
  memes = cloneMemes(defaultMemes);
  selectedMemeId = memes[0]?.id || "";
  warmDefaultAudioCache().catch((error) => console.debug("default audio cache warm failed", error));
  renderMemePanel();
  renderSupportNotice();
  setResult("memePackResult", "已恢复默认梗库。", true);
}

async function readAudioForExport(url, memeId) {
  if (url.startsWith("idb://")) {
    const path = url.slice("idb://".length);
    const blob = await idbGet(`${IDB_AUDIO_PREFIX}${path}`);
    return blob ? { path, bytes: new Uint8Array(await blob.arrayBuffer()) } : null;
  }
  const path = exportAudioPath(url) || `assets/audio/user/${safeFileName(`${memeId}.mp3`)}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  return { path, bytes: new Uint8Array(await response.arrayBuffer()) };
}

function exportAudioPath(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.startsWith("idb://")) return value.slice("idb://".length);
  if (value.startsWith("./")) return value.slice(2);
  try {
    const url = new URL(value, location.href);
    return url.pathname.replace(/^\/+/, "");
  } catch (_) {
    return value.replace(/^\/+/, "");
  }
}

function normalizeMemeItem(raw) {
  const id = String(raw.id || raw.title || cryptoRandomId()).trim();
  return {
    id,
    title: String(raw.title || id).trim(),
    audio_url: String(raw.audio_url || "").trim(),
    triggers: toStringList(raw.triggers),
    direct_triggers: toStringList(raw.direct_triggers),
    examples: toStringList(raw.examples),
    description: String(raw.description || "").trim(),
    situations: toStringList(raw.situations),
    tags: toStringList(raw.tags),
    avoid: toStringList(raw.avoid),
    voice_text: String(raw.voice_text || "").trim(),
    tts_mode: String(raw.tts_mode || "auto").trim() || "auto",
    priority: Number(raw.priority || 0),
    cooldown_ms: Number(raw.cooldown_ms || 1200),
    min_confidence: Number(raw.min_confidence || 0.7),
  };
}

function listToLines(value) {
  return toStringList(value).join("\n");
}

function parseListInput(value) {
  return String(value || "")
    .split(/\r?\n|，|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toStringList(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function cloneMemes(items) {
  return items.map(cloneMeme);
}

function cloneMeme(item) {
  return normalizeMemeItem(JSON.parse(JSON.stringify(item || {})));
}

async function loadCustomMemePack() {
  try {
    const pack = await idbGet("manifest");
    if (!pack?.items?.length) return null;
    return { items: cloneMemes(pack.items) };
  } catch (_) {
    return null;
  }
}

async function saveCustomMemePack() {
  await idbSet("manifest", { schema: 1, items: cloneMemes(memes), updated_at: new Date().toISOString() });
}

function openMemeDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("当前浏览器不支持 IndexedDB，无法保存自定义梗库。"));
      return;
    }
    const request = indexedDB.open(MEME_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(MEME_DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("打开 IndexedDB 失败"));
  });
}

async function idbGet(key) {
  const db = await openMemeDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEME_DB_STORE, "readonly");
    const request = tx.objectStore(MEME_DB_STORE).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbSet(key, value) {
  const db = await openMemeDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEME_DB_STORE, "readwrite");
    tx.objectStore(MEME_DB_STORE).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function clearMemeDb() {
  const db = await openMemeDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEME_DB_STORE, "readwrite");
    tx.objectStore(MEME_DB_STORE).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

function openMemeTtsDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("当前浏览器不支持 IndexedDB，无法保存预制梗语音。"));
      return;
    }
    const request = indexedDB.open(MEME_TTS_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(MEME_TTS_DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("打开预制语音 IndexedDB 失败"));
  });
}

async function memeTtsGet(key) {
  if (!key) return null;
  const db = await openMemeTtsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEME_TTS_DB_STORE, "readonly");
    const request = tx.objectStore(MEME_TTS_DB_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function memeTtsSet(key, blob) {
  const db = await openMemeTtsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEME_TTS_DB_STORE, "readwrite");
    tx.objectStore(MEME_TTS_DB_STORE).put(blob, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function clearMemeTtsDb() {
  const db = await openMemeTtsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEME_TTS_DB_STORE, "readwrite");
    tx.objectStore(MEME_TTS_DB_STORE).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

function createZip(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  files.forEach((file) => {
    const nameBytes = encoder.encode(normalizeZipPath(file.name));
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    const crc = crc32(data);
    const local = concatUint8([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc),
      u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes, data,
    ]);
    chunks.push(local);
    central.push(concatUint8([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc),
      u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), nameBytes,
    ]));
    offset += local.length;
  });
  const centralOffset = offset;
  central.forEach((entry) => {
    chunks.push(entry);
    offset += entry.length;
  });
  chunks.push(concatUint8([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(offset - centralOffset), u32(centralOffset), u16(0),
  ]));
  return concatUint8(chunks);
}

async function parseZip(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = new Map();
  const eocd = findEocd(bytes);
  if (eocd < 0) throw new Error("不是有效的 ZIP 文件");
  const count = readU16(bytes, eocd + 10);
  let cursor = readU32(bytes, eocd + 16);
  for (let index = 0; index < count; index += 1) {
    if (readU32(bytes, cursor) !== 0x02014b50) throw new Error("ZIP 中央目录损坏");
    const compression = readU16(bytes, cursor + 10);
    const compressedSize = readU32(bytes, cursor + 20);
    const nameLength = readU16(bytes, cursor + 28);
    const extraLength = readU16(bytes, cursor + 30);
    const commentLength = readU16(bytes, cursor + 32);
    const localOffset = readU32(bytes, cursor + 42);
    const name = new TextDecoder("utf-8").decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    if (compression !== 0) throw new Error("当前只支持本工具导出的无压缩 ZIP 包");
    const localNameLength = readU16(bytes, localOffset + 26);
    const localExtraLength = readU16(bytes, localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    entries.set(normalizeZipPath(name), bytes.slice(dataOffset, dataOffset + compressedSize));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function findEocd(bytes) {
  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (readU32(bytes, i) === 0x06054b50) return i;
  }
  return -1;
}

function normalizeZipPath(name) {
  return String(name || "").replace(/\\/g, "/").replace(/^\.?\//, "").replace(/^\/+/, "");
}

function u16(value) {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value) {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

function readU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

let crcTable = null;
function crc32(data) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function mimeForPath(path) {
  const lower = String(path).toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  return "application/octet-stream";
}

function safeFileName(value) {
  return String(value || "audio").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 120);
}

function cryptoRandomId() {
  return crypto.randomUUID ? crypto.randomUUID() : `meme_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function revokeMemeObjectUrls() {
  memeObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  memeObjectUrls = new Map();
}

function revokeDefaultAudioObjectUrls() {
  for (const [key, url] of memeObjectUrls.entries()) {
    if (!String(key).startsWith("default-audio:")) continue;
    URL.revokeObjectURL(url);
    memeObjectUrls.delete(key);
  }
}

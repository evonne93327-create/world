const DEFAULT_PALETTES = {
  "c_gray":   { name: "一般隨記", bg: "#EFE9DC", text: "#5A4F42" },
  "c_blue":   { name: "地理與勢力", bg: "#DCE7F0", text: "#28506B" },
  "c_green":  { name: "定稿與完成", bg: "#DCEAE1", text: "#2C5A44" },
  "c_purple": { name: "角色人物誌", bg: "#E7DFF0", text: "#553B76" },
  "c_orange": { name: "待釐清坑洞", bg: "#F3E1CC", text: "#8A4F1F" },
  "c_rose":   { name: "重要核心伏筆", bg: "#F3DAD5", text: "#8C3527" },
  "c_yellow": { name: "靈感隨筆", bg: "#F2E8C9", text: "#7A5B12" }
};

const COMMON_ICONS = ["📁", "🌍", "⚔️", "🛡️", "📜", "🏰", "🧙", "🐉", "🔮", "🔥", "💎", "🏛️", "👑", "🗡️", "🏹", "📖", "✨", "🔖"];
const MARKDOWN_HEADING_REGEX = /^#\s+(.+)/;
const CHAPTER_LINE_REGEX = /^(第[0-9一二三四五六七八九十百]+[章回卷節]|Chapter\s+[0-9]+)/i;
const DOC_HISTORY_LIMIT = 5000;
const HISTORY_SNAPSHOT_THROTTLE_MS = 1200;

const INITIAL_APP_DATA = { /* ... 填入原本的 INITIAL_APP_DATA 內容 ... */ };

let appData = JSON.parse(JSON.stringify(INITIAL_APP_DATA));
let activeWorldId = "w_main";
let activeDocId = "doc_1";
let activeFolderId = null;
let activeView = "editor";
let isBatchDeleteMode = false;
let batchSelectedFolders = new Set();
let batchSelectedDocs = new Set();
let iconPickerContext = { type: null, id: null };
let moveFolderTargetId = null;
let connectingSourceNodeId = null;
let collapsedFolders = {};
let docHistory = {}; 
let contentPersistTimer = null;
let pendingPersistInfo = null; 
let historySnapshotTimer = null;
let hashtagFilterActiveColor = null;

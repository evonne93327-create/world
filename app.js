/* ==========================================================
   1. 預設資料庫與書卷色盤 (墨與紙風格)
   ========================================================== */
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

const INITIAL_APP_DATA = {
  colorPalette: Object.assign({}, DEFAULT_PALETTES),
  tagSettings: {
    "帝國軍方": "c_blue",
    "反抗組織": "c_rose",
    "主角群": "c_purple"
  },
  worldviews: [
    {
      id: "w_main",
      name: "艾爾達斯主大陸",
      icon: "🌍",
      canvas: {
        nodes: [
          { id: "node_doc_1", docId: "doc_1", x: 40, y: 70 },
          { id: "node_doc_2", docId: "doc_2", x: 280, y: 150 }
        ],
        edges: [
          { id: "edge_1", source: "node_doc_1", target: "node_doc_2", label: "既敵對亦互相利用" }
        ]
      }
    },
    {
      id: "w_sub",
      name: "星界彼端 (外傳)",
      icon: "🔮",
      canvas: { nodes: [], edges: [] }
    }
  ],
  folders: [
    { id: "f_chars", worldId: "w_main", parentId: null, name: "核心角色群", icon: "👥" },
    { id: "f_knights", worldId: "w_main", parentId: "f_chars", name: "皇家騎士階級", icon: "⚔️" },
    { id: "f_lore", worldId: "w_main", parentId: null, name: "歷史年表", icon: "📜" }
  ],
  docs: [
    {
      id: "doc_1",
      worldId: "w_main",
      folderId: "f_knights",
      icon: "🛡️",
      title: "白銀騎士團長",
      content: "# 第一章 誓約之劍\n性格嚴謹肅穆，掌管皇城近衛軍，手握秘銀軍令狀。 #帝國軍方 #主角群\n\n# 第二章 北境之戰\n於舊曆340年率軍抵禦霜雪巨獸，戰役極為慘烈。",
      tags: ["帝國軍方", "主角群"],
      images: [],
      wordCount: 75,
      updatedAt: "2026-09-09 12:00"
    },
    {
      id: "doc_2",
      worldId: "w_main",
      folderId: "f_chars",
      icon: "🗡️",
      title: "暗夜遊俠",
      content: "# 第一章 陰影交匯\n遊走在黑市與皇城外圍的情報商人，表面玩世不恭，實際上是反抗軍的先鋒探子。 #反抗組織 #主角群",
      tags: ["反抗組織", "主角群"],
      images: [],
      wordCount: 52,
      updatedAt: "2026-09-09 12:10"
    }
  ]
};

let appData = JSON.parse(JSON.stringify(INITIAL_APP_DATA));
let activeWorldId = "w_main";
let activeDocId = "doc_1";
let activeFolderId = null;
let activeView = "editor";
let isBatchDeleteMode = false;
let collapsedFolders = {};
let iconPickerContext = { type: null, id: null };
let moveFolderTargetId = null;
let connectingSourceNodeId = null;

const saved = localStorage.getItem("novel_multi_world_data_v6");
if (saved) {
  try {
    const parsed = JSON.parse(saved);
    if (parsed && Array.isArray(parsed.docs) && parsed.docs.length > 0) {
      appData = parsed;
    }
  } catch (e) {
    console.error(e);
  }
}

if (!appData.worldviews.some(w => w.id === activeWorldId)) {
  activeWorldId = appData.worldviews[0] ? appData.worldviews[0].id : "w_main";
}

function saveData() {
  localStorage.setItem("novel_multi_world_data_v6", JSON.stringify(appData));
}

/* ==========================================================
   2. INITIALIZATION
   ========================================================== */
wwindow.addEventListener("DOMContentLoaded", function() {
  buildEmojiPicker();
  renderWorldRail();
  renderSidebarTree();
  updateWorldBadge();
  if (activeDocId) loadDocToEditor(activeDocId);
  setupCanvasEvents();
  setupGlobalClickDismiss();
  setupDirectoryContextMenu();
  setupDeleteKeyShortcut();
  setupHistoryNavigation();
});
/* ==========================================================
   瀏覽器返回鍵 (History API) 支援
   ========================================================== */
function setupHistoryNavigation() {
  if (!history.state) {
    history.replaceState({ view: 'editor', drawer: false }, "");
  }

  window.addEventListener("popstate", function(e) {
    const sidebar = document.getElementById("appSidebar");
    const isDrawerOpen = sidebar && sidebar.classList.contains("drawer-open");

    // 若側邊欄打開，返回鍵優先關閉側邊欄
    if (isDrawerOpen) {
      closeSidebarMobile();
      return;
    }

    // 若當前在白板，返回鍵退回文檔視圖
    if (activeView === 'canvas') {
      switchView('editor', false);
      return;
    }

    // 若有彈窗打開，返回鍵關閉彈窗
    const activeModal = document.querySelector(".modal-overlay.active");
    if (activeModal) {
      activeModal.classList.remove("active");
      return;
    }
  });
}
function toggleSidebarMenu() {
  const isMobile = window.innerWidth <= 768;
  const sidebar = document.getElementById("appSidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (isMobile) {
    const isOpen = sidebar.classList.contains("drawer-open");
    if (isOpen) {
      closeSidebarMobile();
    } else {
      sidebar.classList.add("drawer-open");
      overlay.classList.add("active");
      history.pushState({ drawer: true }, "");
    }
  } else {
    sidebar.classList.toggle("collapsed");
  }
}
function closeSidebarMobile() {
  const sidebar = document.getElementById("appSidebar");
  const overlay = document.getElementById("sidebarOverlay");
  if (sidebar) sidebar.classList.remove("drawer-open");
  if (overlay) overlay.classList.remove("active");
}

function updateWorldBadge() {
  const world = appData.worldviews.find(w => w.id === activeWorldId);
  if (world) {
    const icon = world.icon || '🌐';
    document.getElementById("currentWorldIcon").textContent = icon;
    document.getElementById("currentWorldName").textContent = world.name;
    document.getElementById("canvasWorldTitle").textContent = "🕸️ " + icon + " " + world.name + " · 專屬白板";
  }
  renderWorldRail();
}

/* ==========================================================
   3. WORLD RAIL (最左側世界觀切換欄)
   ========================================================== */
function renderWorldRail() {
  const container = document.getElementById("worldRailContainer");
  if (!container) return;
  container.innerHTML = "";

  appData.worldviews.forEach(function(world) {
    const btn = document.createElement("button");
    btn.className = "world-rail-btn " + (world.id === activeWorldId ? "active" : "");
    btn.title = world.name;
    btn.innerHTML = world.icon || "🌐";

    btn.onclick = function() {
      activeWorldId = world.id;
      activeFolderId = null;
      updateWorldBadge();
      renderSidebarTree();
      renderBreadcrumbs();
      if (activeView === 'canvas') renderCanvas();
    };

    container.appendChild(btn);
  });
}

function promptCreateWorldview() {
  const name = prompt("請輸入新世界觀名稱：", "新世界觀");
  if (name && name.trim()) {
    const newWorld = {
      id: "w_" + Date.now(),
      name: name.trim(),
      icon: "🌐",
      canvas: { nodes: [], edges: [] }
    };
    appData.worldviews.push(newWorld);
    activeWorldId = newWorld.id;
    saveData();
    updateWorldBadge();
    renderSidebarTree();
    renderBreadcrumbs();
  }
}

/* ==========================================================
   4. DIRECTORY TREE (類 Windows 目錄：單擊選中、雙擊展開)
   ========================================================== */
function renderSidebarTree() {
  const container = document.getElementById("worldTreeContainer");
  const search = document.getElementById("searchInput").value.trim().toLowerCase();
  container.innerHTML = "";

  const currentWorld = appData.worldviews.find(w => w.id === activeWorldId);
  if (!currentWorld) return;

  renderFolderLevel(currentWorld.id, null, container, search);
}

function renderFolderLevel(worldId, parentId, parentElement, search) {
  const folders = appData.folders.filter(f => f.worldId === worldId && f.parentId === parentId);

  folders.forEach(function(folder) {
    const isCollapsed = !!collapsedFolders[folder.id];
    const folderDiv = document.createElement("div");
    folderDiv.className = "folder-group";

    const folderRow = document.createElement("div");
    folderRow.className = "node-row " + (folder.id === activeFolderId ? "active" : "");
    folderRow.setAttribute("data-id", folder.id);

    // 單擊選中反白
    folderRow.onclick = function(e) {
      if (e.target.closest('.node-checkbox') || e.target.closest('.folder-caret') || e.target.closest('.node-icon')) return;
      activeFolderId = folder.id;
      renderSidebarTree();
    };

    // 雙擊展開/收合
    folderRow.ondblclick = function(e) {
      if (e.target.closest('.node-checkbox')) return;
      collapsedFolders[folder.id] = !collapsedFolders[folder.id];
      renderSidebarTree();
    };

    const toggleCaret = isCollapsed ? '▸' : '▾';

    folderRow.innerHTML = 
      '<div class="node-left">' +
        '<input type="checkbox" class="node-checkbox" data-type="folder" data-id="' + folder.id + '" onclick="event.stopPropagation()">' +
        '<span class="folder-caret">' + toggleCaret + '</span>' +
        '<span class="node-icon" onclick="event.stopPropagation(); openIconPicker(\'folder\', \'' + folder.id + '\')">' + (folder.icon || '📁') + '</span>' +
        '<span class="node-name">' + escapeHtml(folder.name) + '</span>' +
      '</div>';

    // 點擊箭頭展開/收合
    folderRow.querySelector('.folder-caret').onclick = function(e) {
      e.stopPropagation();
      collapsedFolders[folder.id] = !collapsedFolders[folder.id];
      renderSidebarTree();
    };

    // 拖拉歸檔
    folderRow.ondragover = function(e) { e.preventDefault(); folderRow.style.background = "#EAE2D8"; };
    folderRow.ondragleave = function() { folderRow.style.background = ""; };
    folderRow.ondrop = function(e) {
      e.preventDefault();
      folderRow.style.background = "";
      const draggedDocId = e.dataTransfer.getData("text/plain");
      const doc = appData.docs.find(d => d.id === draggedDocId);
      if (doc) {
        doc.folderId = folder.id;
        doc.worldId = worldId;
        saveData();
        renderSidebarTree();
        renderBreadcrumbs();
      }
    };

    folderDiv.appendChild(folderRow);

    const childrenDiv = document.createElement("div");
    childrenDiv.className = "folder-children";
    childrenDiv.style.display = isCollapsed ? "none" : "block";

    renderFolderLevel(worldId, folder.id, childrenDiv, search);

    const docsInFolder = appData.docs.filter(function(d) {
      const matchFolder = d.worldId === worldId && d.folderId === folder.id;
      if (!search) return matchFolder;
      return matchFolder && (d.title.toLowerCase().includes(search) || d.content.toLowerCase().includes(search));
    });

    docsInFolder.forEach(function(doc) {
      childrenDiv.appendChild(createDocRowElement(doc));
    });

    folderDiv.appendChild(childrenDiv);
    parentElement.appendChild(folderDiv);
  });

  if (parentId === null) {
    const rootDocs = appData.docs.filter(function(d) {
      const isRoot = d.worldId === worldId && !d.folderId;
      if (!search) return isRoot;
      return isRoot && (d.title.toLowerCase().includes(search) || d.content.toLowerCase().includes(search));
    });
    rootDocs.forEach(function(doc) {
      parentElement.appendChild(createDocRowElement(doc));
    });
  }
}

function createDocRowElement(doc) {
  const row = document.createElement("div");
  row.className = "node-row " + (doc.id === activeDocId ? "active" : "");
  row.draggable = true;
  row.setAttribute("data-id", doc.id);
  row.ondragstart = function(e) { e.dataTransfer.setData("text/plain", doc.id); };

  row.onclick = function(e) {
    if (e.target.closest('.node-checkbox') || e.target.closest('.node-icon')) return;
    activeWorldId = doc.worldId;
    activeFolderId = null;
    updateWorldBadge();
    loadDocToEditor(doc.id);
    if (activeView !== 'editor') switchView('editor');
    if (window.innerWidth <= 768) closeSidebarMobile();
  };

  let displayTitle = doc.title;
  if (!displayTitle) {
    const firstLine = (doc.content || "").split("\n")[0];
    displayTitle = firstLine ? firstLine.substring(0, 16) : "無標題文檔";
  }

  row.innerHTML = 
    '<div class="node-left">' +
      '<input type="checkbox" class="node-checkbox" data-type="doc" data-id="' + doc.id + '" onclick="event.stopPropagation()">' +
      '<span class="node-icon" onclick="event.stopPropagation(); openIconPicker(\'doc\', \'' + doc.id + '\')">' + (doc.icon || '📄') + '</span>' +
      '<span class="node-name">' + escapeHtml(displayTitle) + '</span>' +
    '</div>' +
    '<div class="doc-meta-mini">' + (doc.wordCount || 0) + '字</div>';

  return row;
}

/* ==========================================================
   5. BREADCRUMBS (點擊資料夾自動開啟目錄並選中)
   ========================================================== */
function navigateToFolder(folderId) {
  if (!folderId) return;

  // 1. 自動展開側邊目錄欄 (電腦端展開、手機端開抽屜)
  const sidebar = document.getElementById("appSidebar");
  if (sidebar && sidebar.classList.contains("collapsed")) {
    sidebar.classList.remove("collapsed");
  }
  if (sidebar && !sidebar.classList.contains("drawer-open") && window.innerWidth <= 768) {
    sidebar.classList.add("drawer-open");
    const overlay = document.getElementById("sidebarOverlay");
    if (overlay) overlay.classList.add("active");
  }

  // 2. 向上回溯，展開沿途所有父層資料夾
  let curId = folderId;
  while (curId) {
    collapsedFolders[curId] = false;
    const curFolder = appData.folders.find(f => f.id === curId);
    curId = curFolder ? curFolder.parentId : null;
  }

  // 3. 設定為選中狀態並重新渲染
  activeFolderId = folderId;
  renderSidebarTree();

  // 4. 平滑滾動定位到目標元素
  setTimeout(function() {
    const targetEl = document.querySelector(`.node-row[data-id="${folderId}"]`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      targetEl.classList.add('active');
    }
  }, 50);
}

function renderBreadcrumbs() {
  const container = document.getElementById("docBreadcrumbBar");
  if (!container) return;
  container.innerHTML = "";

  const doc = appData.docs.find(d => d.id === activeDocId);
  if (!doc) return;

  const crumbs = [];
  let curFolderId = doc.folderId;
  while (curFolderId) {
    const folder = appData.folders.find(f => f.id === curFolderId);
    if (folder) {
      crumbs.unshift({ type: 'folder', id: folder.id, name: folder.name });
      curFolderId = folder.parentId;
    } else {
      break;
    }
  }

  // 頂層世界觀
  const world = appData.worldviews.find(w => w.id === (doc.worldId || activeWorldId));
  const worldItem = document.createElement("span");
  worldItem.className = "crumb-item crumb-world";
  worldItem.style.cursor = "pointer";
  worldItem.textContent = (world ? (world.icon || '🌐') + " " + world.name : "🌐 主世界觀");
  worldItem.onclick = function() {
    activeFolderId = null;
    renderSidebarTree();
  };
  container.appendChild(worldItem);

  // 中間資料夾 (點擊直接跳轉選中)
  crumbs.forEach(function(crumb) {
    const sep = document.createElement("span");
    sep.className = "crumb-sep";
    sep.textContent = " › ";
    container.appendChild(sep);

    const folderItem = document.createElement("span");
    folderItem.className = "crumb-item crumb-folder";
    folderItem.style.cursor = "pointer";
    folderItem.textContent = "📁 " + crumb.name;
    folderItem.title = "點擊在目錄欄選中此資料夾";
    folderItem.onclick = function() {
      navigateToFolder(crumb.id);
    };
    container.appendChild(folderItem);
  });

  // 末端文檔
  const sepLast = document.createElement("span");
  sepLast.className = "crumb-sep";
  sepLast.textContent = " › ";
  container.appendChild(sepLast);

  const docItem = document.createElement("span");
  docItem.className = "crumb-item crumb-doc current";
  docItem.textContent = "📄 " + (doc.title || "未命名文檔");
  container.appendChild(docItem);
}

/* ==========================================================
   6. DOCUMENT OPERATIONS & EDITOR
   ========================================================== */
function promptCreateFolder(parentId = null) {
  const name = prompt("請輸入資料夾名稱：", "新分類");
  if (name && name.trim()) {
    appData.folders.push({
      id: "f_" + Date.now(),
      worldId: activeWorldId,
      parentId: parentId,
      name: name.trim(),
      icon: "📁"
    });
    saveData();
    renderSidebarTree();
  }
}

function createNewDoc(targetFolderId = null) {
  const newDoc = {
    id: "doc_" + Date.now(),
    worldId: activeWorldId,
    folderId: targetFolderId || activeFolderId,
    icon: "📄",
    title: "",
    content: "",
    tags: [],
    images: [],
    wordCount: 0,
    updatedAt: formatTime(new Date())
  };
  appData.docs.unshift(newDoc);
  saveData();
  renderSidebarTree();
  loadDocToEditor(newDoc.id);
  switchView('editor');
  if (window.innerWidth <= 768) closeSidebarMobile();
}

function loadDocToEditor(docId) {
  activeDocId = docId;
  const doc = appData.docs.find(d => d.id === docId);
  if (!doc) return;

  document.getElementById("docIconBtn").textContent = doc.icon || "📄";
  document.getElementById("docTitleInput").value = doc.title || "";
  document.getElementById("docContentInput").value = doc.content || "";
  document.getElementById("statWordCount").textContent = doc.wordCount || 0;
  document.getElementById("statUpdatedAt").textContent = doc.updatedAt || "--";

  renderTOC(doc.content || "");
  renderLiveHashtags(doc.tags || []);
  renderDocImages(doc.images || []);
  renderBreadcrumbs();
  renderSidebarTree();
}

function onTitleChange() {
  const doc = appData.docs.find(d => d.id === activeDocId);
  if (!doc) return;
  doc.title = document.getElementById("docTitleInput").value;
  doc.updatedAt = formatTime(new Date());
  document.getElementById("statUpdatedAt").textContent = doc.updatedAt;
  saveData();
  renderSidebarTree();
  renderBreadcrumbs();
}

function onContentChange() {
  const doc = appData.docs.find(d => d.id === activeDocId);
  if (!doc) return;

  const text = document.getElementById("docContentInput").value;
  doc.content = text;

  if (!document.getElementById("docTitleInput").value.trim()) {
    const firstLine = text.trim().split("\n")[0] || "";
    doc.title = firstLine.substring(0, 30);
  }

  const cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const eng = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/\b[a-zA-Z0-9_]+\b/g) || []).length;
  const wordCount = cjk + eng;
  doc.wordCount = wordCount;
  document.getElementById("statWordCount").textContent = wordCount;

  const foundTags = (doc.tags || []).slice();
  const regex = /#([^\s#]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const t = match[1].trim();
    if (!t.startsWith("第") && !foundTags.includes(t)) {
      foundTags.push(t);
    }
  }
  doc.tags = foundTags;

  foundTags.forEach(function(t) {
    if (!appData.tagSettings[t]) appData.tagSettings[t] = "c_gray";
  });

  doc.updatedAt = formatTime(new Date());
  document.getElementById("statUpdatedAt").textContent = doc.updatedAt;

  saveData();
  renderTOC(text);
  renderLiveHashtags(doc.tags);
  renderSidebarTree();
  renderBreadcrumbs();
}

function deleteCurrentDocument() {
  const doc = appData.docs.find(d => d.id === activeDocId);
  if (!doc) return;

  const title = doc.title || "無標題文檔";
  if (!confirm("確定要刪除文檔「" + title + "」嗎？")) return;

  appData.docs = appData.docs.filter(d => d.id !== activeDocId);

  appData.worldviews.forEach(function(w) {
    if (w.canvas) {
      const removedNodeIds = [];
      w.canvas.nodes = w.canvas.nodes.filter(n => {
        const keep = n.docId !== activeDocId;
        if (!keep) removedNodeIds.push(n.id);
        return keep;
      });
      w.canvas.edges = w.canvas.edges.filter(e => !removedNodeIds.includes(e.source) && !removedNodeIds.includes(e.target));
    }
  });

  saveData();
  renderSidebarTree();

  if (appData.docs.length > 0) {
    loadDocToEditor(appData.docs[0].id);
  } else {
    createNewDoc();
  }
}

/* ==========================================================
   7. TOC & HASHTAGS
   ========================================================== */
function renderTOC(content) {
  const container = document.getElementById("tocLinksContainer");
  const card = document.getElementById("tocCard");
  container.innerHTML = "";

  const lines = content.split("\n");
  const chapters = [];

  lines.forEach(function(line, idx) {
    const trimmed = line.trim();
    if (/^#\s+(.+)/.test(trimmed)) {
      chapters.push({ title: trimmed.replace(/^#\s+/, ''), lineIndex: idx, fullText: trimmed });
    } else if (/^(第[0-9一二三四五六七八九十百]+[章回卷節]|Chapter\s+[0-9]+)/i.test(trimmed)) {
      chapters.push({ title: trimmed.substring(0, 24), lineIndex: idx, fullText: trimmed });
    }
  });

  if (chapters.length === 0) {
    card.style.display = "none";
    return;
  }

  card.style.display = "block";
  chapters.forEach(function(ch) {
    const chip = document.createElement("span");
    chip.className = "toc-chip";
    chip.textContent = "📍 " + ch.title;
    chip.onclick = function() {
      const textarea = document.getElementById("docContentInput");
      const pos = textarea.value.indexOf(ch.fullText);
      if (pos !== -1) {
        textarea.focus();
        textarea.setSelectionRange(pos, pos + ch.fullText.length);
        const percent = pos / Math.max(1, textarea.value.length);
        textarea.scrollTop = (textarea.scrollHeight - textarea.clientHeight) * percent;
      }
    };
    container.appendChild(chip);
  });
}

function renderLiveHashtags(tags) {
  const bar = document.getElementById("liveTagToolbar");
  bar.innerHTML = "";

  (tags || []).forEach(function(tag) {
    const colorId = appData.tagSettings[tag] || "c_gray";
    const palette = appData.colorPalette[colorId] || DEFAULT_PALETTES.c_gray;

    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.style.backgroundColor = palette.bg;
    chip.style.color = palette.text;
    
    chip.innerHTML = 
      '<span class="tag-jump-name">#' + escapeHtml(tag) + '</span>' +
      '<span class="tag-color-arrow" style="font-size:9px; opacity:0.6;">▼</span>';

    chip.querySelector(".tag-jump-name").onclick = function(e) {
      e.stopPropagation();
      const textarea = document.getElementById("docContentInput");
      const pattern = "#" + tag;
      const pos = textarea.value.indexOf(pattern);
      if (pos !== -1) {
        textarea.focus();
        textarea.setSelectionRange(pos, pos + pattern.length);
        const percent = pos / Math.max(1, textarea.value.length);
        textarea.scrollTop = (textarea.scrollHeight - textarea.clientHeight) * percent;
      }
    };

    chip.querySelector(".tag-color-arrow").onclick = function(e) {
      e.stopPropagation();
      openColorPicker(tag, chip);
    };

    bar.appendChild(chip);
  });

  const addBtn = document.createElement("button");
  addBtn.className = "btn-add-tag";
  addBtn.textContent = "＋ 新增 Hashtag";
  addBtn.onclick = function() {
    const newTag = prompt("請輸入欲加入的 Hashtag (不用加 #)：");
    if (newTag && newTag.trim()) {
      const clean = newTag.trim().replace(/^#/, '');
      const doc = appData.docs.find(d => d.id === activeDocId);
      if (doc) {
        if (!doc.tags) doc.tags = [];
        if (!doc.tags.includes(clean)) {
          doc.tags.push(clean);
          if (!appData.tagSettings[clean]) appData.tagSettings[clean] = "c_gray";
          saveData();
          renderLiveHashtags(doc.tags);
        }
      }
    }
  };
  bar.appendChild(addBtn);
}

/* ==========================================================
   8. SEARCH & BATCH ACTIONS
   ========================================================== */
function handleSearchInput(input) {
  const clearBtn = document.getElementById("searchClearBtn");
  if (clearBtn) clearBtn.classList.toggle("show", !!input.value.trim());
  renderSidebarTree();
}

function clearSearchInput() {
  const input = document.getElementById("searchInput");
  if (input) input.value = "";
  const clearBtn = document.getElementById("searchClearBtn");
  if (clearBtn) clearBtn.classList.remove("show");
  renderSidebarTree();
}

function toggleBatchDeleteMode() {
  isBatchDeleteMode = !isBatchDeleteMode;
  const trashBtn = document.getElementById("trashToggleBtn");
  const batchBar = document.getElementById("batchActionBar");
  const sidebar = document.getElementById("appSidebar");

  trashBtn.classList.toggle("active-danger", isBatchDeleteMode);
  batchBar.classList.toggle("active", isBatchDeleteMode);
  sidebar.classList.toggle("batch-mode", isBatchDeleteMode);
}

function executeBatchDelete() {
  const checkedBoxes = document.querySelectorAll(".node-checkbox:checked");
  if (checkedBoxes.length === 0) {
    alert("請先勾選欲刪除的項目！");
    return;
  }

  if (!confirm("確定要刪除選取的 " + checkedBoxes.length + " 個項目嗎？")) return;

  const docIdsToDelete = [];
  const folderIdsToDelete = [];

  checkedBoxes.forEach(function(cb) {
    const type = cb.getAttribute("data-type");
    const id = cb.getAttribute("data-id");
    if (type === "doc") docIdsToDelete.push(id);
    else if (type === "folder") folderIdsToDelete.push(id);
  });

  folderIdsToDelete.forEach(function(fId) {
    collectDescendants(fId, folderIdsToDelete, docIdsToDelete);
  });

  appData.folders = appData.folders.filter(f => !folderIdsToDelete.includes(f.id));
  appData.docs = appData.docs.filter(d => !docIdsToDelete.includes(d.id));

  saveData();
  toggleBatchDeleteMode();
  renderSidebarTree();

  if (docIdsToDelete.includes(activeDocId)) {
    if (appData.docs.length > 0) loadDocToEditor(appData.docs[0].id);
    else createNewDoc();
  }
}

function collectDescendants(folderId, allFolderIds, allDocIds) {
  appData.docs.forEach(function(d) {
    if (d.folderId === folderId && !allDocIds.includes(d.id)) allDocIds.push(d.id);
  });
  const childFolders = appData.folders.filter(f => f.parentId === folderId);
  childFolders.forEach(function(cf) {
    if (!allFolderIds.includes(cf.id)) allFolderIds.push(cf.id);
    collectDescendants(cf.id, allFolderIds, allDocIds);
  });
}

/* ==========================================================
   9. WHITEBOARD CANVAS
   ========================================================== */
function getCurrentWorldCanvas() {
  const world = appData.worldviews.find(w => w.id === activeWorldId);
  if (!world.canvas) world.canvas = { nodes: [], edges: [] };
  return world.canvas;
}

function addCurrentDocToCanvas() {
  const currentDoc = appData.docs.find(d => d.id === activeDocId);
  if (!currentDoc) return;

  const canvas = getCurrentWorldCanvas();
  const exists = canvas.nodes.find(n => n.docId === currentDoc.id);
  if (exists) {
    alert("此文檔已存在於當前世界觀白板！");
    switchView('canvas');
    return;
  }

  canvas.nodes.push({
    id: "node_" + currentDoc.id,
    docId: currentDoc.id,
    x: Math.max(20, Math.min(window.innerWidth - 220, 50 + (canvas.nodes.length * 25) % 250)),
    y: Math.max(70, Math.min(window.innerHeight - 150, 80 + (canvas.nodes.length * 35) % 300))
  });

  saveData();
  switchView('canvas');
}

function renderCanvas() {
  const container = document.getElementById("canvasNodesContainer");
  container.innerHTML = "";
  const canvas = getCurrentWorldCanvas();

  canvas.nodes.forEach(function(node) {
    const doc = appData.docs.find(d => d.id === node.docId);
    if (!doc) return;

    const el = document.createElement("div");
    el.className = "canvas-node";
    el.id = node.id;
    el.style.left = node.x + "px";
    el.style.top = node.y + "px";

    const title = (doc.icon || '📄') + " " + (doc.title || "無標題文檔");
    const preview = (doc.content || "").replace(/\n/g, " ");

    let imgHtml = "";
    if (doc.images && doc.images.length > 0) {
      imgHtml = '<img class="node-img-thumb" src="' + doc.images[0] + '">';
    }

    el.innerHTML = 
      '<div class="node-top">' +
        '<span class="node-title-txt" title="' + escapeHtml(title) + '">' + escapeHtml(title) + '</span>' +
        '<button class="node-connect-btn" title="建立連線" onclick="startConnect(\'' + node.id + '\', event)">🔗</button>' +
      '</div>' +
      imgHtml +
      '<div class="node-snippet">' + escapeHtml(preview) + '</div>' +
      '<div style="font-size:10px; color:var(--text-muted); text-align:right;">' + (doc.wordCount || 0) + ' 字</div>';

    el.ondblclick = function() {
      loadDocToEditor(doc.id);
      switchView('editor');
    };

    enableDualDrag(el, node);
    container.appendChild(el);
  });

  renderCanvasLines();
}

function enableDualDrag(element, nodeData) {
  let startX, startY, initialLeft, initialTop;

  element.addEventListener("mousedown", function(e) {
    if (e.target.closest('.node-connect-btn')) return;
    e.preventDefault();
    startX = e.clientX; startY = e.clientY;
    initialLeft = nodeData.x; initialTop = nodeData.y;

    function onMouseMove(m) {
      nodeData.x = initialLeft + (m.clientX - startX);
      nodeData.y = initialTop + (m.clientY - startY);
      element.style.left = nodeData.x + "px";
      element.style.top = nodeData.y + "px";
      renderCanvasLines();
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      saveData();
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  });

  element.addEventListener("touchstart", function(e) {
    if (e.target.closest('.node-connect-btn')) return;
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
    initialLeft = nodeData.x; initialTop = nodeData.y;

    function onTouchMove(m) {
      m.preventDefault();
      const touch = m.touches[0];
      nodeData.x = initialLeft + (touch.clientX - startX);
      nodeData.y = initialTop + (touch.clientY - startY);
      element.style.left = nodeData.x + "px";
      element.style.top = nodeData.y + "px";
      renderCanvasLines();
    }
    function onTouchEnd() {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      saveData();
    }
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
  }, { passive: true });
}

function startConnect(nodeId, event) {
  event.stopPropagation();
  const nodeEl = document.getElementById(nodeId);
  const canvas = getCurrentWorldCanvas();

  if (!connectingSourceNodeId) {
    connectingSourceNodeId = nodeId;
    nodeEl.classList.add("connecting");
  } else if (connectingSourceNodeId === nodeId) {
    connectingSourceNodeId = null;
    nodeEl.classList.remove("connecting");
  } else {
    const relation = prompt("請輸入關係說明：", "關聯");
    if (relation !== null) {
      canvas.edges.push({
        id: "edge_" + Date.now(),
        source: connectingSourceNodeId,
        target: nodeId,
        label: relation || "關聯"
      });
      saveData();
    }
    document.getElementById(connectingSourceNodeId)?.classList.remove("connecting");
    connectingSourceNodeId = null;
    renderCanvasLines();
  }
}

function renderCanvasLines() {
  const svg = document.getElementById("canvasSvg");
  svg.innerHTML = "";
  const canvas = getCurrentWorldCanvas();

  canvas.edges.forEach(function(edge) {
    const srcNode = canvas.nodes.find(n => n.id === edge.source);
    const tgtNode = canvas.nodes.find(n => n.id === edge.target);
    if (!srcNode || !tgtNode) return;

    const x1 = srcNode.x + 97;
    const y1 = srcNode.y + 45;
    const x2 = tgtNode.x + 97;
    const y2 = tgtNode.y + 45;

    const dx = (x2 - x1) * 0.3;
    const d = "M " + x1 + " " + y1 + " C " + (x1 + dx) + " " + y1 + ", " + (x2 - dx) + " " + y2 + ", " + x2 + " " + y2;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "relation-line");
    path.onclick = function() { editEdge(edge); };

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.onclick = function() { editEdge(edge); };

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", midX);
    text.setAttribute("y", midY);
    text.setAttribute("class", "line-label-box");
    text.textContent = edge.label;

    const textWidth = Math.max(edge.label.length * 13, 36);
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", midX - textWidth / 2);
    bgRect.setAttribute("y", midY - 11);
    bgRect.setAttribute("width", textWidth);
    bgRect.setAttribute("height", 22);
    bgRect.setAttribute("class", "line-label-bg");

    g.appendChild(bgRect);
    g.appendChild(text);

    svg.appendChild(path);
    svg.appendChild(g);
  });
}

function editEdge(edge) {
  const val = prompt("修改關係說明（留空即刪除此連線）：", edge.label);
  if (val === null) return;
  const canvas = getCurrentWorldCanvas();
  if (val.trim() === "") {
    canvas.edges = canvas.edges.filter(e => e.id !== edge.id);
  } else {
    edge.label = val.trim();
  }
  saveData();
  renderCanvasLines();
}

function setupCanvasEvents() {
  document.getElementById("canvasView").onclick = function(e) {
    if (!e.target.closest('.canvas-node')) {
      if (connectingSourceNodeId) {
        document.getElementById(connectingSourceNodeId)?.classList.remove("connecting");
        connectingSourceNodeId = null;
      }
    }
  };
}

/* ==========================================================
   10. MODALS, PALETTE, ICONS
   ========================================================== */
function buildEmojiPicker() {
  const grid = document.getElementById("emojiGrid");
  grid.innerHTML = "";
  COMMON_ICONS.forEach(function(emoji) {
    const div = document.createElement("div");
    div.className = "emoji-opt";
    div.textContent = emoji;
    div.onclick = function() { document.getElementById("customIconInput").value = emoji; };
    grid.appendChild(div);
  });
}

function openIconPicker(type, id) {
  iconPickerContext = { type: type, id: id };
  let currentIcon = "📄";
  if (type === 'world') {
    const w = appData.worldviews.find(x => x.id === id);
    currentIcon = w ? w.icon : "🌐";
  } else if (type === 'folder') {
    const f = appData.folders.find(x => x.id === id);
    currentIcon = f ? f.icon : "📁";
  } else if (type === 'doc') {
    const d = appData.docs.find(x => x.id === id);
    currentIcon = d ? d.icon : "📄";
  }
  document.getElementById("customIconInput").value = currentIcon || "";
  document.getElementById("iconPickerModal").classList.add("active");
}

function closeIconPickerModal() {
  document.getElementById("iconPickerModal").classList.remove("active");
}

function applyCustomIcon() {
  const val = document.getElementById("customIconInput").value.trim() || "📄";
  const ctx = iconPickerContext;
  if (ctx.type === 'world') {
    const w = appData.worldviews.find(x => x.id === ctx.id);
    if (w) w.icon = val;
    updateWorldBadge();
  } else if (ctx.type === 'folder') {
    const f = appData.folders.find(x => x.id === ctx.id);
    if (f) f.icon = val;
  } else if (ctx.type === 'doc') {
    const d = appData.docs.find(x => x.id === ctx.id);
    if (d) {
      d.icon = val;
      if (d.id === activeDocId) document.getElementById("docIconBtn").textContent = val;
    }
  }
  saveData();
  renderSidebarTree();
  renderBreadcrumbs();
  closeIconPickerModal();
}

function openPaletteModal() {
  const container = document.getElementById("paletteConfigList");
  container.innerHTML = "";

  Object.keys(DEFAULT_PALETTES).forEach(function(key) {
    const pal = appData.colorPalette[key] || DEFAULT_PALETTES[key];
    const row = document.createElement("div");
    row.className = "color-row";
    row.innerHTML = 
      '<div class="palette-color-circle" style="background:' + pal.bg + '; border:1.5px solid ' + pal.text + ';"></div>' +
      '<input type="text" class="form-input" id="pal_name_' + key + '" value="' + escapeHtml(pal.name) + '" placeholder="定義此色盤功能...">';
    container.appendChild(row);
  });

  document.getElementById("paletteModal").classList.add("active");
}

function cancelPaletteModal() {
  document.getElementById("paletteModal").classList.remove("active");
}

function closePaletteModal() {
  Object.keys(DEFAULT_PALETTES).forEach(function(key) {
    const input = document.getElementById("pal_name_" + key);
    if (input && input.value.trim()) {
      appData.colorPalette[key].name = input.value.trim();
    }
  });
  saveData();
  document.getElementById("paletteModal").classList.remove("active");
  const currentDoc = appData.docs.find(d => d.id === activeDocId);
  if (currentDoc) renderLiveHashtags(currentDoc.tags);
}

function openColorPicker(tag, anchorElement) {
  const popover = document.getElementById("colorPickerPopover");
  popover.innerHTML = '<div style="font-size:11px; font-weight:700; color:var(--text-muted); margin-bottom:4px;">指定 #' + escapeHtml(tag) + ' 的顏色：</div>';

  Object.keys(DEFAULT_PALETTES).forEach(function(key) {
    const pal = appData.colorPalette[key] || DEFAULT_PALETTES[key];
    const opt = document.createElement("div");
    opt.className = "picker-option";
    opt.innerHTML = 
      '<span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:' + pal.bg + '; border:1px solid ' + pal.text + ';"></span>' +
      '<span style="color:' + pal.text + '; font-weight:600;">' + escapeHtml(pal.name) + '</span>';
    opt.onclick = function() {
      appData.tagSettings[tag] = key;
      saveData();
      popover.classList.remove("active");
      const currentDoc = appData.docs.find(d => d.id === activeDocId);
      if (currentDoc) renderLiveHashtags(currentDoc.tags);
    };
    popover.appendChild(opt);
  });

  const rect = anchorElement.getBoundingClientRect();
  popover.style.top = (rect.bottom + window.scrollY + 6) + "px";
  popover.style.left = Math.max(10, Math.min(window.innerWidth - 200, rect.left + window.scrollX)) + "px";
  popover.classList.add("active");
}

document.addEventListener("click", function(e) {
  const popover = document.getElementById("colorPickerPopover");
  if (popover && popover.classList.contains("active") && !popover.contains(e.target)) {
    popover.classList.remove("active");
  }
});

/* ==========================================================
   11. BATCH EXPORT & BACKUP
   ========================================================== */
function openBatchExportModal() {
  const container = document.getElementById("exportChecklistContainer");
  container.innerHTML = "";

  appData.worldviews.forEach(function(w) {
    const wTitle = document.createElement("div");
    wTitle.style.fontWeight = "700";
    wTitle.style.fontSize = "13px";
    wTitle.style.margin = "8px 0 4px 0";
    wTitle.innerHTML = "<span>" + (w.icon || '🌐') + " " + escapeHtml(w.name) + "</span>";
    container.appendChild(wTitle);
    renderExportFolderItems(w.id, null, container, 1);
  });

  document.getElementById("batchExportModal").classList.add("active");
}

function renderExportFolderItems(worldId, parentId, parentEl, level) {
  const folders = appData.folders.filter(f => f.worldId === worldId && f.parentId === parentId);

  folders.forEach(function(folder) {
    const row = document.createElement("div");
    row.className = "export-item-row";
    row.style.paddingLeft = (level * 16) + "px";
    row.innerHTML = 
      '<input type="checkbox" class="export-checkbox" data-type="folder" data-id="' + folder.id + '" onchange="onExportFolderToggle(\'' + folder.id + '\', this.checked)">' +
      '<span>' + (folder.icon || '📁') + '</span>' +
      '<strong>' + escapeHtml(folder.name) + '</strong>';
    parentEl.appendChild(row);

    renderExportFolderItems(worldId, folder.id, parentEl, level + 1);

    const docs = appData.docs.filter(d => d.worldId === worldId && d.folderId === folder.id);
    docs.forEach(function(doc) {
      const docRow = document.createElement("div");
      docRow.className = "export-item-row";
      docRow.style.paddingLeft = ((level + 1) * 16) + "px";
      docRow.innerHTML = 
        '<input type="checkbox" class="export-checkbox export-doc-item" data-type="doc" data-id="' + doc.id + '">' +
        '<span>' + (doc.icon || '📄') + '</span>' +
        '<span>' + escapeHtml(doc.title || "無標題文檔") + '</span>';
      parentEl.appendChild(docRow);
    });
  });

  if (parentId === null) {
    const rootDocs = appData.docs.filter(d => d.worldId === worldId && !d.folderId);
    rootDocs.forEach(function(doc) {
      const docRow = document.createElement("div");
      docRow.className = "export-item-row";
      docRow.style.paddingLeft = (level * 16) + "px";
      docRow.innerHTML = 
        '<input type="checkbox" class="export-checkbox export-doc-item" data-type="doc" data-id="' + doc.id + '">' +
        '<span>' + (doc.icon || '📄') + '</span>' +
        '<span>' + escapeHtml(doc.title || "無標題文檔") + '</span>';
      parentEl.appendChild(docRow);
    });
  }
}

function onExportFolderToggle(folderId, isChecked) {
  const allDocIds = [];
  const allFolderIds = [folderId];
  collectDescendants(folderId, allFolderIds, allDocIds);

  allFolderIds.forEach(function(fId) {
    const cb = document.querySelector('.export-checkbox[data-type="folder"][data-id="' + fId + '"]');
    if (cb) cb.checked = isChecked;
  });

  allDocIds.forEach(function(dId) {
    const cb = document.querySelector('.export-checkbox[data-type="doc"][data-id="' + dId + '"]');
    if (cb) cb.checked = isChecked;
  });
}

function toggleExportAll(checkAll) {
  document.querySelectorAll(".export-checkbox").forEach(cb => { cb.checked = checkAll; });
}

function closeBatchExportModal() {
  document.getElementById("batchExportModal").classList.remove("active");
}

function confirmBatchExport() {
  const checkedDocBoxes = document.querySelectorAll('.export-checkbox[data-type="doc"]:checked');
  if (checkedDocBoxes.length === 0) {
    alert("請至少選擇一個文檔！");
    return;
  }

  const selectedDocIds = Array.from(checkedDocBoxes).map(cb => cb.getAttribute("data-id"));
  const format = document.getElementById("exportFormatSelect").value;
  const exportDocs = appData.docs.filter(d => selectedDocIds.includes(d.id));

  if (format === "json") {
    downloadFile(JSON.stringify(exportDocs, null, 2), "world_docs_" + Date.now() + ".json", "application/json");
  } else {
    let textContent = exportDocs.map(d => "【" + (d.title || "無標題") + "】\n" + (d.content || "")).join("\n\n--------------------\n\n");
    downloadFile(textContent, "world_docs_" + Date.now() + ".txt", "text/plain;charset=utf-8");
  }
  closeBatchExportModal();
}

function exportFullDatabaseJSON() {
  downloadFile(JSON.stringify(appData, null, 2), "worldbuilder_backup_" + Date.now() + ".json", "application/json");
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const doc = appData.docs.find(d => d.id === activeDocId);
    if (doc) {
      if (!doc.images) doc.images = [];
      doc.images.push(evt.target.result);
      saveData();
      renderDocImages(doc.images);
    }
  };
  reader.readAsDataURL(file);
  e.target.value = "";
}

function renderDocImages(images) {
  const strip = document.getElementById("docImagesContainer");
  strip.innerHTML = "";
  (images || []).forEach(function(imgSrc, idx) {
    const box = document.createElement("div");
    box.className = "img-preview-box";
    box.innerHTML = 
      '<img src="' + imgSrc + '" alt="圖片">' +
      '<button class="img-del-btn" onclick="deleteDocImage(' + idx + ')">✕</button>';
    strip.appendChild(box);
  });
}

function deleteDocImage(idx) {
  const doc = appData.docs.find(d => d.id === activeDocId);
  if (doc && doc.images) {
    doc.images.splice(idx, 1);
    saveData();
    renderDocImages(doc.images);
  }
}

/* ==========================================================
   12. VIEW SWITCH & MOBILE HISTORY (手機原生返回支援)
   ========================================================== */
function switchView(view) {
  activeView = view;
  document.getElementById("tabEditorBtn").classList.toggle("active", view === 'editor');
  document.getElementById("tabCanvasBtn").classList.toggle("active", view === 'canvas');

  document.getElementById("editorView").style.display = (view === 'editor') ? 'flex' : 'none';
  document.getElementById("canvasView").style.display = (view === 'canvas') ? 'block' : 'none';

  if (view === 'canvas') renderCanvas();
}

(function setupMobileHistoryNavigation() {
  if (!history.state) {
    history.replaceState({ view: activeView, docId: activeDocId }, document.title);
  }

  window.addEventListener("popstate", function(e) {
    // 1. 若 Modal 彈窗開著，返回鍵為關閉彈窗
    const openModals = document.querySelectorAll(".modal-overlay.active");
    if (openModals.length > 0) {
      openModals.forEach(m => m.classList.remove("active"));
      return;
    }

    // 2. 若手機抽屜開著，返回鍵為關閉抽屜
    const sidebar = document.getElementById("appSidebar");
    if (sidebar && sidebar.classList.contains("drawer-open")) {
      closeSidebarMobile();
      return;
    }

    // 3. 若在白板，切回文檔編輯器
    if (activeView === "canvas") {
      switchView("editor");
      return;
    }

    // 4. 切回上一個瀏覽的文檔
    if (e.state && e.state.docId && e.state.docId !== activeDocId) {
      loadDocToEditor(e.state.docId);
    }
  });

  const originalLoadDoc = window.loadDocToEditor;
  window.loadDocToEditor = function(id) {
    if (id !== activeDocId) {
      history.pushState({ docId: id, view: "editor" }, document.title);
    }
    return originalLoadDoc.apply(this, arguments);
  };

  const originalSwitch = window.switchView;
  window.switchView = function(v) {
    if (v !== activeView) {
      history.pushState({ docId: activeDocId, view: v }, document.title);
    }
    return originalSwitch.apply(this, arguments);
  };
})();

/* ==========================================================
   13. UTILS
   ========================================================== */
function downloadFile(content, fileName, contentType) {
  const a = document.createElement("a");
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

function formatTime(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return y + "-" + m + "-" + day + " " + h + ":" + min;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

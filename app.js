/* ==========================================================
   1. 預設資料庫與常數
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
let batchSelectedFolders = new Set();
let batchSelectedDocs = new Set();
let iconPickerContext = { type: null, id: null };
let moveFolderTargetId = null;
let connectingSourceNodeId = null;
let collapsedFolders = {};

const saved = localStorage.getItem("novel_multi_world_data_v5");
if (saved) {
  try {
    const parsed = JSON.parse(saved);
    if (parsed && Array.isArray(parsed.docs) && parsed.docs.length > 0) {
      appData = parsed;
    }
  } catch (e) { console.error(e); }
}

/* 資料遷移：補上 manualTags 欄位。
   規則：若既有 tags 中的某個標籤實際上沒有出現在內文裡，
   代表它是透過「＋標籤」手動加入的，遷移時歸類為 manualTags 予以保留；
   其餘則視為內文偵測產生，之後會隨內文增減即時同步。 */
function computeManualTagsFor(content, tags) {
  const existingTags = Array.isArray(tags) ? tags : [];
  return existingTags.filter(function(t) {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('#' + escaped + '(?=[\\s#]|$)');
    return !re.test(content || "");
  });
}

(function migrateDocTags() {
  (appData.docs || []).forEach(function(d) {
    if (Array.isArray(d.manualTags)) return;
    d.manualTags = computeManualTagsFor(d.content, d.tags);
  });
})();

function saveData() {
  localStorage.setItem("novel_multi_world_data_v5", JSON.stringify(appData));
}

/* ==========================================================
   2. INITIALIZATION
   ========================================================== */
window.addEventListener("DOMContentLoaded", function() {
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

function setupHistoryNavigation() {
  if (!history.state) {
    history.replaceState({ view: 'editor', drawer: false }, "");
  }

  window.addEventListener("popstate", function(e) {
    const sidebar = document.getElementById("appSidebar");
    const isDrawerOpen = sidebar && sidebar.classList.contains("drawer-open");

    if (isDrawerOpen) {
      closeSidebarMobile();
      return;
    }

    if (activeView === 'canvas') {
      switchView('editor', false);
      return;
    }

    const activeModal = document.querySelector(".modal-overlay.active");
    if (activeModal) {
      activeModal.classList.remove("active");
      return;
    }
  });
}

function setupDeleteKeyShortcut() {
  document.addEventListener("keydown", function(e) {
    if (e.key !== "Delete") return;

    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
    if (isBatchDeleteMode) return;

    if (activeFolderId) {
      deleteFolderById(activeFolderId);
    } else if (activeDocId) {
      deleteCurrentDocument();
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

function openSidebarMenu() {
  const isMobile = window.innerWidth <= 768;
  const sidebar = document.getElementById("appSidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (isMobile) {
    if (!sidebar.classList.contains("drawer-open")) {
      sidebar.classList.add("drawer-open");
      overlay.classList.add("active");
      history.pushState({ drawer: true }, "");
    }
  } else {
    sidebar.classList.remove("collapsed");
  }
}

function handleBreadcrumbDblClick(e) {
  if (e.target.closest('.breadcrumb-item')) return;
  openSidebarMenu();
}

function closeSidebarMobile() {
  document.getElementById("appSidebar").classList.remove("drawer-open");
  document.getElementById("sidebarOverlay").classList.remove("active");
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

function handleSearchInput(inputEl) {
  const clearBtn = document.getElementById("searchClearBtn");
  if (inputEl.value.trim().length > 0) {
    clearBtn.style.display = "inline-flex";
  } else {
    clearBtn.style.display = "none";
  }
  renderSidebarTree();
}

function clearSearchInput() {
  const inputEl = document.getElementById("searchInput");
  const clearBtn = document.getElementById("searchClearBtn");
  inputEl.value = "";
  clearBtn.style.display = "none";
  renderSidebarTree();
  inputEl.focus();
}

/* ==========================================================
   世界觀切換：自動關閉上一世界觀文檔
   ========================================================== */
function selectWorld(worldId) {
  if (activeWorldId === worldId) return;
  activeWorldId = worldId;
  activeFolderId = null;

  const docsInWorld = appData.docs.filter(d => d.worldId === worldId);
  if (docsInWorld.length > 0) {
    loadDocToEditor(docsInWorld[0].id);
  } else {
    clearEditorWorkspace();
  }

  updateWorldBadge();
  renderSidebarTree();
  if (activeView === 'canvas') renderCanvas();
}

function clearEditorWorkspace() {
  activeDocId = null;
  document.getElementById("docIconBtn").textContent = "📄";
  document.getElementById("docTitleInput").value = "";
  document.getElementById("docContentInput").value = "";
  document.getElementById("statWordCount").textContent = "0";
  document.getElementById("statUpdatedAt").textContent = "--";
  document.getElementById("liveTagToolbar").innerHTML = "";
  document.getElementById("docImagesContainer").innerHTML = "";
  document.getElementById("tocCard").style.display = "none";
  document.getElementById("docBreadcrumbBar").innerHTML = '<span class="breadcrumb-item" style="color:var(--text-muted);">（目前世界觀尚無文件）</span>';
}

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
      selectWorld(world.id);
    };

    attachContextMenu(btn, function() { return buildWorldMenuItems(world); }, function() { return (world.icon || '🌐') + ' ' + world.name; });
    container.appendChild(btn);
  });
}

/* ==========================================================
   3. 樹狀目錄渲染
   ========================================================== */
function renderSidebarTree() {
  const container = document.getElementById("worldTreeContainer");
  const search = document.getElementById("searchInput").value.trim().toLowerCase();
  container.innerHTML = "";

  renderBreadcrumb();

  const currentWorld = appData.worldviews.find(w => w.id === activeWorldId);
  if (!currentWorld) return;

  renderFolderLevel(currentWorld.id, null, container, search);
}

function folderHasChildren(folderId) {
  return appData.folders.some(f => f.parentId === folderId) ||
         appData.docs.some(d => d.folderId === folderId);
}

function renderFolderLevel(worldId, parentId, parentElement, search) {
  const folders = appData.folders.filter(f => f.worldId === worldId && f.parentId === parentId);

  folders.forEach(function(folder) {
    const folderDiv = document.createElement("div");
    folderDiv.className = "folder-group";

    const isCollapsed = !!collapsedFolders[folder.id];
    const folderRow = document.createElement("div");
    folderRow.className = "node-row-outer";
    folderRow.draggable = true;

    folderRow.ondragstart = function(e) {
      e.stopPropagation();
      e.dataTransfer.setData("text/plain", JSON.stringify({ type: "folder", id: folder.id }));
    };

    let rowStateClass = (folder.id === activeFolderId ? " selected" : "");
    if (isBatchDeleteMode && batchSelectedFolders.has(folder.id)) {
      rowStateClass += " batch-checked";
    }

    folderRow.onclick = function(e) {
      if (e.target.closest('.folder-caret') || e.target.closest('.node-icon')) return;
      if (isBatchDeleteMode) {
        toggleBatchItemSelection('folder', folder.id);
        return;
      }
      activeFolderId = folder.id;
      renderSidebarTree();
    };

    folderRow.ondblclick = function(e) {
      if (isBatchDeleteMode) return;
      collapsedFolders[folder.id] = !collapsedFolders[folder.id];
      renderSidebarTree();
    };

    const hasChildren = folderHasChildren(folder.id);
    const caretHtml = hasChildren
      ? '<span class="folder-caret" style="cursor:pointer;">' + (isCollapsed ? '▸' : '▾') + '</span>'
      : '<span class="folder-caret" style="visibility:hidden; pointer-events:none;"></span>';

    folderRow.innerHTML = 
      caretHtml +
      '<div class="node-row' + rowStateClass + '">' +
        '<div class="node-left">' +
          '<span class="node-icon">' + (folder.icon || '📁') + '</span>' +
          '<span class="node-name">' + escapeHtml(folder.name) + '</span>' +
        '</div>' +
      '</div>';

    const iconSpan = folderRow.querySelector('.node-icon');
    if (iconSpan) {
      iconSpan.onclick = function(ev) {
        ev.stopPropagation();
        openIconPicker('folder', folder.id);
      };
    }

    if (hasChildren) {
      const caretSpan = folderRow.querySelector('.folder-caret');
      if (caretSpan) {
        caretSpan.onclick = function(e) {
          e.stopPropagation();
          collapsedFolders[folder.id] = !collapsedFolders[folder.id];
          renderSidebarTree();
        };
      }
    }

    attachContextMenu(folderRow, function() { return buildFolderMenuItems(folder); }, function() { return (folder.icon || '📁') + ' ' + folder.name; });

    folderRow.ondragover = function(e) { e.preventDefault(); folderRow.style.background = "#E0E7FF"; };
    folderRow.ondragleave = function() { folderRow.style.background = ""; };
    folderRow.ondrop = function(e) {
      e.preventDefault();
      e.stopPropagation();
      folderRow.style.background = "";
      try {
        const dragPayload = JSON.parse(e.dataTransfer.getData("text/plain"));
        if (dragPayload.type === "doc") {
          const doc = appData.docs.find(d => d.id === dragPayload.id);
          if (doc) {
            doc.folderId = folder.id;
            doc.worldId = worldId;
            saveData();
            renderSidebarTree();
            renderBreadcrumb();
          }
        } else if (dragPayload.type === "folder") {
          const movingFolderId = dragPayload.id;
          if (movingFolderId !== folder.id && !isDescendantOf(movingFolderId, folder.id)) {
            const f = appData.folders.find(x => x.id === movingFolderId);
            if (f) {
              f.parentId = folder.id;
              f.worldId = worldId;
              saveData();
              renderSidebarTree();
              renderBreadcrumb();
            }
          }
        }
      } catch(err) {}
    };

    folderDiv.appendChild(folderRow);

    const childrenDiv = document.createElement("div");
    childrenDiv.className = "folder-children";
    if (isCollapsed && !search) childrenDiv.style.display = "none";

    renderFolderLevel(worldId, folder.id, childrenDiv, search);

    const docsInFolder = appData.docs.filter(d => {
      const match = d.worldId === worldId && d.folderId === folder.id;
      if (!search) return match;
      return match && (d.title.toLowerCase().includes(search) || d.content.toLowerCase().includes(search));
    });

    docsInFolder.forEach(function(doc) {
      childrenDiv.appendChild(createDocRowElement(doc));
    });

    folderDiv.appendChild(childrenDiv);
    parentElement.appendChild(folderDiv);
  });

  if (parentId === null) {
    const rootDocs = appData.docs.filter(d => {
      const isRoot = d.worldId === worldId && !d.folderId;
      if (!search) return isRoot;
      return isRoot && (d.title.toLowerCase().includes(search) || d.content.toLowerCase().includes(search));
    });
    rootDocs.forEach(function(doc) {
      parentElement.appendChild(createDocRowElement(doc));
    });
  }
}

function isDescendantOf(parentCheckId, targetFolderId) {
  let cur = targetFolderId;
  while (cur) {
    if (cur === parentCheckId) return true;
    const f = appData.folders.find(x => x.id === cur);
    cur = f ? f.parentId : null;
  }
  return false;
}

function createDocRowElement(doc) {
  const row = document.createElement("div");
  row.className = "node-row-outer";
  let rowStateClass = (doc.id === activeDocId ? " active" : "");
  if (isBatchDeleteMode && batchSelectedDocs.has(doc.id)) {
    rowStateClass += " batch-checked";
  }
  row.draggable = true;
  row.ondragstart = function(e) {
    e.stopPropagation();
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "doc", id: doc.id }));
  };
  row.onclick = function(e) {
    if (e.target.closest('.node-icon')) return;
    if (isBatchDeleteMode) {
      toggleBatchItemSelection('doc', doc.id);
      return;
    }
    activeWorldId = doc.worldId;
    activeFolderId = null;
    updateWorldBadge();
    loadDocToEditor(doc.id);
    if (activeView !== 'editor') switchView('editor');
    if (window.innerWidth <= 768) closeSidebarMobile();
  };

  const displayTitle = doc.title || "無標題文檔";

  row.innerHTML = 
    '<span class="folder-caret" style="visibility:hidden; pointer-events:none;"></span>' +
    '<div class="node-row' + rowStateClass + '">' +
      '<div class="node-left">' +
        '<span class="node-icon">' + (doc.icon || '📄') + '</span>' +
        '<span class="node-name">' + escapeHtml(displayTitle) + '</span>' +
      '</div>' +
      '<div style="font-size:10px; color:var(--text-muted);">' + (doc.wordCount || 0) + '字</div>' +
    '</div>';

  const iconSpan = row.querySelector('.node-icon');
  if (iconSpan) {
    iconSpan.onclick = function(ev) {
      ev.stopPropagation();
      openIconPicker('doc', doc.id);
    };
  }

  attachContextMenu(row, function() { return buildDocMenuItems(doc); }, function() { return (doc.icon || '📄') + ' ' + (doc.title || '無標題文檔'); });
  return row;
}

/* ==========================================================
   4. 麵包屑導航 (支援點擊資料夾與「›」直接打開目錄並選取)
   ========================================================== */
function renderBreadcrumb() {
  const bar = document.getElementById("docBreadcrumbBar");
  bar.innerHTML = "";

  const doc = appData.docs.find(d => d.id === activeDocId);
  if (!doc) {
    bar.innerHTML = '<span class="breadcrumb-item" style="color:var(--text-muted);">（無已選文檔）</span>';
    return;
  }

  const world = appData.worldviews.find(w => w.id === doc.worldId) || { id: "w_main", name: "主世界觀", icon: "🌐" };

  bar.appendChild(createBreadcrumbDropdownItem(
    (world.icon || '🌐') + " " + world.name,
    function() {
      activeWorldId = world.id;
      activeFolderId = null;
      updateWorldBadge();
      renderSidebarTree();
    },
    getWorldChildOptions(world.id, null)
  ));

  const folderChain = [];
  let curFolderId = doc.folderId;
  while (curFolderId) {
    const f = appData.folders.find(item => item.id === curFolderId);
    if (f) {
      folderChain.unshift(f);
      curFolderId = f.parentId;
    } else break;
  }

  folderChain.forEach(function(folder) {
    const sep = document.createElement("span");
    sep.className = "breadcrumb-sep";
    sep.textContent = "›";
    sep.style.cursor = "pointer";
    sep.title = "跳轉到 " + folder.name;
    sep.onclick = function(e) {
      e.stopPropagation();
      navigateToBreadcrumbFolder(folder);
    };
    bar.appendChild(sep);

    const folderItemEl = createBreadcrumbDropdownItem(
      (folder.icon || '📁') + " " + folder.name,
      function() { navigateToBreadcrumbFolder(folder); },
      getWorldChildOptions(folder.worldId, folder.id)
    );
    folderItemEl.ondblclick = function(e) {
      e.stopPropagation();
      openSidebarMenu();
      navigateToBreadcrumbFolder(folder);
    };
    bar.appendChild(folderItemEl);
  });

  const sepDoc = document.createElement("span");
  sepDoc.className = "breadcrumb-sep";
  sepDoc.textContent = "›";
  bar.appendChild(sepDoc);

  const docItem = document.createElement("span");
  docItem.className = "breadcrumb-item";
  docItem.style.color = "var(--accent)";
  docItem.textContent = (doc.icon || '📄') + " " + (doc.title || "無標題文檔");
  bar.appendChild(docItem);
}

function navigateToBreadcrumbFolder(folder) {
  activeWorldId = folder.worldId;
  activeFolderId = folder.id;

  let cur = folder;
  while (cur) {
    delete collapsedFolders[cur.id];
    cur = appData.folders.find(f => f.id === cur.parentId);
  }

  updateWorldBadge();
  renderSidebarTree();

  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById("appSidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (!sidebar.classList.contains("drawer-open")) {
      sidebar.classList.add("drawer-open");
      overlay.classList.add("active");
      history.pushState({ drawer: true }, "");
    }
  }

  requestAnimationFrame(() => {
    const selectedRow = document.querySelector(".node-row.selected");
    if (selectedRow) selectedRow.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

function getWorldChildOptions(worldId, parentId) {
  const folders = appData.folders.filter(f => f.worldId === worldId && f.parentId === parentId);
  const docs = appData.docs.filter(d => d.worldId === worldId && d.folderId === parentId);
  return { folders, docs };
}

function createBreadcrumbDropdownItem(text, onClickMain, childrenObj) {
  const container = document.createElement("div");
  container.className = "breadcrumb-item";

  const label = document.createElement("span");
  label.textContent = text;
  label.onclick = function(e) {
    e.stopPropagation();
    onClickMain();
  };
  container.appendChild(label);

  if (childrenObj && (childrenObj.folders.length > 0 || childrenObj.docs.length > 0)) {
    const arrow = document.createElement("span");
    arrow.textContent = " ▾";
    arrow.style.fontSize = "10px";
    arrow.style.opacity = "0.7";
    arrow.onclick = function(e) {
      e.stopPropagation();
      closeAllBreadcrumbDropdowns();
      dropdown.classList.toggle("active");
    };
    container.appendChild(arrow);

    const dropdown = document.createElement("div");
    dropdown.className = "breadcrumb-dropdown";

    childrenObj.folders.forEach(function(f) {
      const opt = document.createElement("div");
      opt.className = "breadcrumb-dropdown-item";
      opt.innerHTML = `<span>${f.icon || '📁'}</span><span>${escapeHtml(f.name)}</span>`;
      opt.onclick = function(e) {
        e.stopPropagation();
        navigateToBreadcrumbFolder(f);
        dropdown.classList.remove("active");
      };
      dropdown.appendChild(opt);
    });

    childrenObj.docs.forEach(function(d) {
      const opt = document.createElement("div");
      opt.className = "breadcrumb-dropdown-item";
      opt.innerHTML = `<span>${d.icon || '📄'}</span><span>${escapeHtml(d.title || '無標題')}</span>`;
      opt.onclick = function(e) {
        e.stopPropagation();
        loadDocToEditor(d.id);
        dropdown.classList.remove("active");
      };
      dropdown.appendChild(opt);
    });

    container.appendChild(dropdown);
  }

  return container;
}

function closeAllBreadcrumbDropdowns() {
  document.querySelectorAll(".breadcrumb-dropdown.active").forEach(d => d.classList.remove("active"));
}

/* ==========================================================
   5. 文檔編輯與狀態
   ========================================================== */
function loadDocToEditor(docId) {
  activeDocId = docId;
  const doc = appData.docs.find(d => d.id === docId);
  if (!doc) return;

  document.getElementById("docIconBtn").textContent = doc.icon || "📄";
  document.getElementById("docTitleInput").value = doc.title || "";
  document.getElementById("docContentInput").value = doc.content || "";
  document.getElementById("statWordCount").textContent = doc.wordCount || 0;
  document.getElementById("statUpdatedAt").textContent = doc.updatedAt || "--";

  renderBreadcrumb();
  renderTOC(doc.content || "");
  renderLiveHashtags(doc.tags || []);
  renderDocImages(doc.images || []);
  renderSidebarTree();
  closeQuickJumpPanel();
}

function onTitleChange() {
  const doc = appData.docs.find(d => d.id === activeDocId);
  if (!doc) return;
  doc.title = document.getElementById("docTitleInput").value;
  doc.updatedAt = formatTime(new Date());
  document.getElementById("statUpdatedAt").textContent = doc.updatedAt;
  saveData();
  renderSidebarTree();
  renderBreadcrumb();
  if (document.getElementById("quickJumpPanel").classList.contains("active")) {
    document.getElementById("quickJumpDocTitle").textContent = doc.title || "未命名文檔";
    document.getElementById("quickJumpUpdatedAt").textContent = doc.updatedAt || "--";
  }
}

function onContentChange() {
  const doc = appData.docs.find(d => d.id === activeDocId);
  if (!doc) return;

  const text = document.getElementById("docContentInput").value;
  doc.content = text;

  if (!document.getElementById("docTitleInput").value.trim()) {
    const firstLine = text.trim().split("\n")[0] || "";
    doc.title = firstLine.substring(0, 24);
  }

  const cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const eng = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/\b[a-zA-Z0-9_]+\b/g) || []).length;
  const wordCount = cjk + eng;
  doc.wordCount = wordCount;
  document.getElementById("statWordCount").textContent = wordCount;

  if (!Array.isArray(doc.manualTags)) doc.manualTags = [];
  const textTags = [];
  const regex = /#([^\s#]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const t = match[1].trim();
    if (t && !t.startsWith("第") && !textTags.includes(t)) {
      textTags.push(t);
    }
  }
  // Hashtag 即時同步：內文新增或刪除 # 標籤時，標籤列表要即時跟著增加或減少，
  // 不能只增不減；透過「＋標籤」手動加入、未寫在內文中的標籤則予以保留。
  const mergedTags = textTags.slice();
  doc.manualTags.forEach(function(t) {
    if (!mergedTags.includes(t)) mergedTags.push(t);
  });
  doc.tags = mergedTags;

  doc.tags.forEach(function(t) {
    if (!appData.tagSettings[t]) appData.tagSettings[t] = "c_gray";
  });

  doc.updatedAt = formatTime(new Date());
  document.getElementById("statUpdatedAt").textContent = doc.updatedAt;

  saveData();
  renderBreadcrumb();
  renderTOC(text);
  renderLiveHashtags(doc.tags);
  renderSidebarTree();
  if (document.getElementById("quickJumpPanel").classList.contains("active")) {
    renderQuickJumpList(text);
    document.getElementById("quickJumpWordCount").textContent = wordCount;
    document.getElementById("quickJumpUpdatedAt").textContent = doc.updatedAt;
  }
}

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

/* ==========================================================
   6.5 章節 / Hashtag 快速跳轉側邊欄
   ========================================================== */
function toggleQuickJumpPanel() {
  const panel = document.getElementById("quickJumpPanel");
  if (panel.classList.contains("active")) {
    closeQuickJumpPanel();
  } else {
    openQuickJumpPanel();
  }
}

function openQuickJumpPanel() {
  const doc = appData.docs.find(d => d.id === activeDocId);
  document.getElementById("quickJumpDocTitle").textContent = (doc && doc.title) ? doc.title : "未命名文檔";
  document.getElementById("quickJumpWordCount").textContent = doc ? (doc.wordCount || 0) : 0;
  document.getElementById("quickJumpUpdatedAt").textContent = doc ? (doc.updatedAt || "--") : "--";
  renderQuickJumpList(doc ? (doc.content || "") : "");
  document.getElementById("quickJumpPanel").classList.add("active");
  document.getElementById("quickJumpOverlay").classList.add("active");
  const fab = document.getElementById("quickJumpFab");
  fab.textContent = "✕";
  fab.title = "關閉快速跳轉";
}

function closeQuickJumpPanel() {
  document.getElementById("quickJumpPanel").classList.remove("active");
  document.getElementById("quickJumpOverlay").classList.remove("active");
  const fab = document.getElementById("quickJumpFab");
  fab.textContent = "📑";
  fab.title = "章節 / Hashtag 快速跳轉";
}

function renderQuickJumpList(content) {
  const list = document.getElementById("quickJumpList");
  list.innerHTML = "";

  const lines = content.split("\n");
  const entries = [];

  lines.forEach(function(line, idx) {
    const trimmed = line.trim();
    if (/^#\s+(.+)/.test(trimmed)) {
      entries.push({ type: 'chapter', label: trimmed.replace(/^#\s+/, ''), lineIndex: idx });
    } else if (/^(第[0-9一二三四五六七八九十百]+[章回卷節]|Chapter\s+[0-9]+)/i.test(trimmed)) {
      entries.push({ type: 'chapter', label: trimmed.substring(0, 30), lineIndex: idx });
    }

    const tagRegex = /#([^\s#]+)/g;
    let m;
    while ((m = tagRegex.exec(line)) !== null) {
      const tagName = m[1].trim();
      if (!tagName || tagName.startsWith("第")) continue;
      entries.push({ type: 'tag', label: tagName, lineIndex: idx });
    }
  });

  entries.sort(function(a, b) { return a.lineIndex - b.lineIndex; });

  if (entries.length === 0) {
    list.innerHTML = '<div class="quickjump-empty">尚未偵測到章節標題或 Hashtag<br>試試輸入「# 第一章 標題」或「#標籤」</div>';
    return;
  }

  entries.forEach(function(entry) {
    const row = document.createElement("div");
    row.className = "quickjump-item" + (entry.type === 'tag' ? ' is-tag' : '');

    const lineBadge = document.createElement("span");
    lineBadge.className = "quickjump-item-line";
    lineBadge.textContent = "L" + (entry.lineIndex + 1);

    const icon = document.createElement("span");
    icon.className = "quickjump-item-icon";
    icon.textContent = entry.type === 'chapter' ? '📍' : '#';

    const label = document.createElement("span");
    label.className = "quickjump-item-label";
    label.textContent = entry.label;

    row.appendChild(lineBadge);
    row.appendChild(icon);
    row.appendChild(label);

    row.onclick = function() { jumpToLine(entry.lineIndex); };

    list.appendChild(row);
  });
}

function jumpToLine(lineIndex) {
  const textarea = document.getElementById("docContentInput");
  const lines = textarea.value.split("\n");
  let pos = 0;
  for (let i = 0; i < lineIndex && i < lines.length; i++) {
    pos += lines[i].length + 1;
  }
  const lineLength = (lines[lineIndex] || "").length;

  textarea.focus();
  textarea.setSelectionRange(pos, pos + lineLength);
  const percent = pos / Math.max(1, textarea.value.length);
  textarea.scrollTop = (textarea.scrollHeight - textarea.clientHeight) * percent;

  closeQuickJumpPanel();
}

/* ==========================================================
   6.6 Hashtag 篩選（搜尋欄旁的 🏷️ 按鈕：依顏色分類篩選，
       列出標籤本人／行數／文章標題，點擊可直接跳轉）
   ========================================================== */
let hashtagFilterActiveColor = null; // null = 顯示全部顏色

function openHashtagFilterModal() {
  hashtagFilterActiveColor = null;
  renderHashtagFilterModal();
  document.getElementById("hashtagFilterModal").classList.add("active");
}

function closeHashtagFilterModal() {
  document.getElementById("hashtagFilterModal").classList.remove("active");
}

function renderHashtagFilterModal() {
  renderHashtagFilterColorChips();
  renderHashtagFilterList();
}

function renderHashtagFilterColorChips() {
  const wrap = document.getElementById("hashtagFilterColors");
  wrap.innerHTML = "";

  const allChip = document.createElement("div");
  allChip.className = "hashtag-filter-color-chip" + (hashtagFilterActiveColor === null ? " active" : "");
  allChip.innerHTML = '<span class="hashtag-filter-color-dot" style="background:linear-gradient(135deg,#bbb,#888);"></span><span>全部</span>';
  allChip.onclick = function() {
    hashtagFilterActiveColor = null;
    renderHashtagFilterModal();
  };
  wrap.appendChild(allChip);

  Object.keys(appData.colorPalette).forEach(function(colorId) {
    const palette = appData.colorPalette[colorId] || DEFAULT_PALETTES.c_gray;
    const chip = document.createElement("div");
    chip.className = "hashtag-filter-color-chip" + (hashtagFilterActiveColor === colorId ? " active" : "");
    chip.innerHTML =
      '<span class="hashtag-filter-color-dot" style="background:' + palette.bg + '; border:1px solid ' + palette.text + '55;"></span>' +
      '<span>' + escapeHtml(palette.name || colorId) + '</span>';
    chip.onclick = function() {
      hashtagFilterActiveColor = colorId;
      renderHashtagFilterModal();
    };
    wrap.appendChild(chip);
  });
}

function collectHashtagOccurrences(colorFilter) {
  const results = [];
  const docsInWorld = appData.docs.filter(d => d.worldId === activeWorldId);

  docsInWorld.forEach(function(doc) {
    const lines = (doc.content || "").split("\n");
    const seenTags = {};

    lines.forEach(function(line, idx) {
      const tagRegex = /#([^\s#]+)/g;
      let m;
      while ((m = tagRegex.exec(line)) !== null) {
        const tagName = m[1].trim();
        if (!tagName || tagName.startsWith("第")) continue;
        const colorId = appData.tagSettings[tagName] || "c_gray";
        if (colorFilter && colorId !== colorFilter) continue;
        seenTags[tagName] = true;
        results.push({
          tag: tagName,
          colorId: colorId,
          lineIndex: idx,
          docId: doc.id,
          docTitle: doc.title || "無標題文檔"
        });
      }
    });

    // 手動加入、內文中沒有對應文字的標籤，仍列出但無行數可跳轉（跳轉至文檔開頭）
    (doc.manualTags || []).forEach(function(tagName) {
      if (seenTags[tagName]) return;
      const colorId = appData.tagSettings[tagName] || "c_gray";
      if (colorFilter && colorId !== colorFilter) return;
      results.push({
        tag: tagName,
        colorId: colorId,
        lineIndex: null,
        docId: doc.id,
        docTitle: doc.title || "無標題文檔"
      });
    });
  });

  results.sort(function(a, b) {
    if (a.docTitle !== b.docTitle) return a.docTitle.localeCompare(b.docTitle, 'zh-Hant');
    const la = a.lineIndex === null ? Infinity : a.lineIndex;
    const lb = b.lineIndex === null ? Infinity : b.lineIndex;
    return la - lb;
  });

  return results;
}

function renderHashtagFilterList() {
  const list = document.getElementById("hashtagFilterList");
  list.innerHTML = "";

  const results = collectHashtagOccurrences(hashtagFilterActiveColor);

  if (results.length === 0) {
    list.innerHTML = '<div class="hashtag-filter-empty">目前世界觀中尚未找到符合條件的 Hashtag</div>';
    return;
  }

  results.forEach(function(item) {
    const palette = appData.colorPalette[item.colorId] || DEFAULT_PALETTES.c_gray;

    const row = document.createElement("div");
    row.className = "hashtag-filter-item";

    const dot = document.createElement("span");
    dot.className = "hashtag-filter-color-dot";
    dot.style.background = palette.bg;
    dot.style.border = "1px solid " + palette.text + "55";

    const tagSpan = document.createElement("span");
    tagSpan.className = "hashtag-filter-item-tag";
    tagSpan.style.color = palette.text;
    tagSpan.textContent = "#" + item.tag;

    const lineSpan = document.createElement("span");
    lineSpan.className = "hashtag-filter-item-line";
    lineSpan.textContent = item.lineIndex === null ? "手動標籤" : ("L" + (item.lineIndex + 1));

    const titleSpan = document.createElement("span");
    titleSpan.className = "hashtag-filter-item-title";
    titleSpan.textContent = item.docTitle;

    row.appendChild(dot);
    row.appendChild(tagSpan);
    row.appendChild(lineSpan);
    row.appendChild(titleSpan);

    row.onclick = function() {
      jumpToHashtagOccurrence(item.docId, item.lineIndex);
    };

    list.appendChild(row);
  });
}

function jumpToHashtagOccurrence(docId, lineIndex) {
  closeHashtagFilterModal();
  const doc = appData.docs.find(d => d.id === docId);
  if (!doc) return;

  // 展開所在資料夾鏈，確保目錄樹能顯示該文檔
  if (doc.folderId) {
    let curId = doc.folderId;
    const guard = new Set();
    while (curId && !guard.has(curId)) {
      guard.add(curId);
      collapsedFolders[curId] = false;
      const f = appData.folders.find(x => x.id === curId);
      curId = f ? f.parentId : null;
    }
  }

  activeFolderId = doc.folderId || null;
  loadDocToEditor(docId);
  if (activeView !== 'editor') switchView('editor');
  renderSidebarTree();

  if (lineIndex !== null) {
    setTimeout(function() { jumpToLine(lineIndex); }, 0);
  }

  if (window.innerWidth <= 768) closeSidebarMobile();
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
      '<span>#' + escapeHtml(tag) + '</span>' +
      '<span style="font-size:9px; opacity:0.7;">▼</span>';

    chip.onclick = function(e) {
      e.stopPropagation();
      openColorPicker(tag, chip);
    };

    bar.appendChild(chip);
  });

  const addBtn = document.createElement("button");
  addBtn.className = "btn-add-tag";
  addBtn.textContent = "＋ 標籤";
  addBtn.onclick = function() {
    const inputStr = prompt("請輸入欲加入的 Hashtag（可用逗號「,」同時新增多個）：");
    if (inputStr && inputStr.trim()) {
      const rawTags = inputStr.split(/[,，]/);
      const doc = appData.docs.find(d => d.id === activeDocId);
      if (doc) {
        if (!doc.tags) doc.tags = [];
        if (!Array.isArray(doc.manualTags)) doc.manualTags = [];
        rawTags.forEach(function(item) {
          const clean = item.trim().replace(/^#/, '');
          if (!clean) return;
          if (!doc.tags.includes(clean)) doc.tags.push(clean);
          // 手動加入的標籤即使之後內文沒有對應文字，也要保留，不會被即時同步機制移除
          if (!doc.manualTags.includes(clean)) doc.manualTags.push(clean);
          if (!appData.tagSettings[clean]) appData.tagSettings[clean] = "c_gray";
        });
        saveData();
        renderLiveHashtags(doc.tags);
        renderSidebarTree();
      }
    }
  };
  bar.appendChild(addBtn);
}

/* ==========================================================
   6. 快捷新增與改名
   ========================================================== */
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
    selectWorld(newWorld.id);
    saveData();
  }
}

function createFolderInCurrentContext() {
  promptCreateFolder(activeFolderId || null, activeWorldId);
}
function createDocInCurrentContext() {
  createNewDoc(activeFolderId || null, activeWorldId);
}

function promptCreateFolder(parentId = null, worldId = null) {
  const name = prompt("請輸入資料夾名稱：", "新分類");
  if (name && name.trim()) {
    appData.folders.push({
      id: "f_" + Date.now(),
      worldId: worldId || activeWorldId,
      parentId: parentId,
      name: name.trim(),
      icon: "📁"
    });
    saveData();
    renderSidebarTree();
  }
}

function createNewDoc(targetFolderId = null, worldId = null) {
  const wId = worldId || activeWorldId;
  const newDoc = {
    id: "doc_" + Date.now(),
    worldId: wId,
    folderId: targetFolderId,
    icon: "📄",
    title: "",
    content: "",
    tags: [],
    manualTags: [],
    images: [],
    wordCount: 0,
    updatedAt: formatTime(new Date())
  };
  appData.docs.unshift(newDoc);
  activeWorldId = wId;
  updateWorldBadge();
  saveData();
  renderSidebarTree();
  loadDocToEditor(newDoc.id);
  switchView('editor');
  if (window.innerWidth <= 768) closeSidebarMobile();
}

function promptRenameItem(type, id, currentName) {
  const newName = prompt("請輸入新的名稱：", currentName);
  if (newName && newName.trim() && newName.trim() !== currentName) {
    const val = newName.trim();
    if (type === 'world') {
      const w = appData.worldviews.find(x => x.id === id);
      if (w) w.name = val;
    } else if (type === 'folder') {
      const f = appData.folders.find(x => x.id === id);
      if (f) f.name = val;
    } else if (type === 'doc') {
      const d = appData.docs.find(x => x.id === id);
      if (d) {
        d.title = val;
        if (d.id === activeDocId) document.getElementById("docTitleInput").value = val;
      }
    }
    saveData();
    renderSidebarTree();
    renderBreadcrumb();
    updateWorldBadge();
  }
}

/* ==========================================================
   6.5 右鍵／長按 自訂選單系統
   ========================================================== */
function showContextMenu(e, items, title) {
  if (e && e.preventDefault) e.preventDefault();
  if (e && e.stopPropagation) e.stopPropagation();

  const menu = document.getElementById("customContextMenu");
  const overlay = document.getElementById("ctxMenuOverlay");
  if (!menu || !overlay) return;
  menu.innerHTML = "";

  if (title) {
    const head = document.createElement("div");
    head.className = "ctx-menu-title";
    head.textContent = title;
    menu.appendChild(head);
  }

  items.forEach(function(item) {
    if (item.type === "divider") {
      const div = document.createElement("div");
      div.className = "ctx-menu-divider";
      menu.appendChild(div);
      return;
    }
    const el = document.createElement("div");
    el.className = "ctx-menu-item" + (item.danger ? " danger" : "");
    el.innerHTML = '<span class="ctx-menu-icon">' + (item.icon || "") + '</span><span>' + escapeHtml(item.label) + '</span>';
    el.onclick = function(ev) {
      ev.stopPropagation();
      closeContextMenu();
      item.action();
    };
    menu.appendChild(el);
  });

  overlay.classList.add("active");
  menu.classList.add("active");

  const isMobile = window.innerWidth <= 768;
  if (!isMobile) {
    const point = (e && e.touches && e.touches[0]) || (e && e.changedTouches && e.changedTouches[0]) || e || { clientX: 40, clientY: 40 };
    const x = point.clientX;
    const y = point.clientY;
    menu.style.left = "-9999px";
    menu.style.top = "-9999px";
    requestAnimationFrame(function() {
      const rect = menu.getBoundingClientRect();
      let left = x, top = y;
      if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
      if (top + rect.height > window.innerHeight - 8) top = window.innerHeight - rect.height - 8;
      menu.style.left = Math.max(8, left) + "px";
      menu.style.top = Math.max(8, top) + "px";
    });
  } else {
    menu.style.left = "";
    menu.style.top = "";
  }
}

function closeContextMenu() {
  const menu = document.getElementById("customContextMenu");
  const overlay = document.getElementById("ctxMenuOverlay");
  if (menu) menu.classList.remove("active");
  if (overlay) overlay.classList.remove("active");
}

function attachContextMenu(element, itemsFn, titleFn) {
  if (!element) return;

  element.addEventListener("contextmenu", function(e) {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e, itemsFn(), titleFn ? titleFn() : null);
  });

  let pressTimer = null;
  let longPressTriggered = false;
  let startX = 0, startY = 0;

  element.addEventListener("touchstart", function(e) {
    if (e.touches.length !== 1) return;
    e.stopPropagation();
    longPressTriggered = false;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    pressTimer = setTimeout(function() {
      longPressTriggered = true;
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) {} }
      showContextMenu(e, itemsFn(), titleFn ? titleFn() : null);
    }, 480);
  }, { passive: true });

  element.addEventListener("touchmove", function(e) {
    if (!pressTimer) return;
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dx > 10 || dy > 10) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }, { passive: true });

  element.addEventListener("touchend", function(e) {
    clearTimeout(pressTimer);
    pressTimer = null;
    if (longPressTriggered) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  element.addEventListener("touchcancel", function() {
    clearTimeout(pressTimer);
    pressTimer = null;
  });
}

function setupDirectoryContextMenu() {
  const overlay = document.getElementById("ctxMenuOverlay");
  if (overlay) overlay.onclick = closeContextMenu;

  attachContextMenu(document.getElementById("worldTreeContainer"), function() {
    return [
      { icon: "📁", label: "新增資料夾", action: function() { promptCreateFolder(null); } },
      { icon: "📄", label: "新增文檔", action: function() { createNewDoc(null); } }
    ];
  }, function() { return "📂 目錄操作"; });

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") closeContextMenu();
  });
  window.addEventListener("resize", closeContextMenu);
  document.addEventListener("scroll", closeContextMenu, true);
}

function buildWorldMenuItems(world) {
  return [
    { icon: "✏️", label: "重新命名", action: function() { promptRenameItem("world", world.id, world.name); } },
    { icon: "🎨", label: "更換圖示", action: function() { openIconPicker("world", world.id); } },
    { type: "divider" },
    { icon: "📁", label: "新增資料夾", action: function() { promptCreateFolder(null, world.id); } },
    { icon: "📄", label: "新增文檔", action: function() { createNewDoc(null, world.id); } }
  ];
}

function buildFolderMenuItems(folder) {
  return [
    { icon: "✏️", label: "重新命名", action: function() { promptRenameItem("folder", folder.id, folder.name); } },
    { icon: "🎨", label: "更換圖示", action: function() { openIconPicker("folder", folder.id); } },
    { type: "divider" },
    { icon: "📁", label: "新增子資料夾", action: function() { promptCreateFolder(folder.id, folder.worldId); } },
    { icon: "📄", label: "新增文檔於此", action: function() { createNewDoc(folder.id, folder.worldId); } },
    { type: "divider" },
    { icon: "🔀", label: "移動資料夾", action: function() { promptMoveFolder(folder.id); } },
    { icon: "🗑️", label: "刪除資料夾", danger: true, action: function() { deleteFolderById(folder.id); } }
  ];
}

function buildDocMenuItems(doc) {
  return [
    { icon: "✏️", label: "重新命名", action: function() { promptRenameItem("doc", doc.id, doc.title || ""); } },
    { icon: "🎨", label: "更換圖示", action: function() { openIconPicker("doc", doc.id); } },
    { type: "divider" },
    { icon: "🗑️", label: "刪除文檔", danger: true, action: function() { deleteDocById(doc.id); } }
  ];
}

function deleteFolderById(folderId) {
  if (!confirm("確定要刪除此資料夾嗎？（內含子資料夾與文檔也會一併刪除）")) return;

  const idsToDelete = [folderId];
  let changed = true;
  while (changed) {
    changed = false;
    appData.folders.forEach(function(f) {
      if (idsToDelete.includes(f.parentId) && !idsToDelete.includes(f.id)) {
        idsToDelete.push(f.id);
        changed = true;
      }
    });
  }

  const willDeleteActiveDoc = appData.docs.some(d => d.id === activeDocId && idsToDelete.includes(d.folderId));

  appData.docs = appData.docs.filter(d => !idsToDelete.includes(d.folderId));
  appData.folders = appData.folders.filter(f => !idsToDelete.includes(f.id));

  if (activeFolderId && idsToDelete.includes(activeFolderId)) activeFolderId = null;

  saveData();
  renderSidebarTree();

  if (willDeleteActiveDoc || !appData.docs.find(d => d.id === activeDocId)) {
    const remainingDocsInWorld = appData.docs.filter(d => d.worldId === activeWorldId);
    if (remainingDocsInWorld.length > 0) loadDocToEditor(remainingDocsInWorld[0].id);
    else clearEditorWorkspace();
  }
}

function deleteDocById(docId) {
  if (!confirm("確定要刪除此文檔嗎？")) return;
  const wasActive = docId === activeDocId;

  appData.docs = appData.docs.filter(d => d.id !== docId);
  saveData();
  renderSidebarTree();

  if (wasActive) {
    const remainingDocsInWorld = appData.docs.filter(d => d.worldId === activeWorldId);
    if (remainingDocsInWorld.length > 0) loadDocToEditor(remainingDocsInWorld[0].id);
    else clearEditorWorkspace();
  }
}

/* ==========================================================
   7. 白板與圖片 (Graphs 邏輯)
   ========================================================== */
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
  if (!images || images.length === 0) return;

  images.forEach(function(imgSrc, index) {
    const box = document.createElement("div");
    box.className = "img-preview-box";
    box.innerHTML = 
      '<img src="' + imgSrc + '" alt="圖片">' +
      '<button class="img-del-btn" title="刪除圖片" onclick="deleteDocImage(' + index + ')">✕</button>';
    strip.appendChild(box);
  });
}

function deleteDocImage(index) {
  const doc = appData.docs.find(d => d.id === activeDocId);
  if (doc && doc.images) {
    doc.images.splice(index, 1);
    saveData();
    renderDocImages(doc.images);
  }
}

function getCurrentWorldCanvas() {
  const world = appData.worldviews.find(w => w.id === activeWorldId);
  if (!world.canvas) world.canvas = { nodes: [], edges: [] };
  return world.canvas;
}

function addCurrentDocToCanvas() {
  const currentDoc = appData.docs.find(d => d.id === activeDocId);
  if (!currentDoc) {
    alert("請先選擇或開啟一個文檔！");
    return;
  }

  const canvas = getCurrentWorldCanvas();
  const exists = canvas.nodes.find(n => n.docId === currentDoc.id);
  if (exists) {
    alert("此文檔已存在於當前白板！");
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
      imgHtml = '<img style="width:100%; height:75px; object-fit:cover; border-radius:4px; margin-bottom:6px;" src="' + doc.images[0] + '">';
    }

    el.innerHTML = 
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">' +
        '<span style="font-size:12px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:130px;">' + escapeHtml(title) + '</span>' +
        '<button style="border-radius:50%; width:22px; height:22px; border:1px solid var(--border); background:#fff; cursor:pointer;" onclick="startConnect(\'' + node.id + '\', event)">🔗</button>' +
      '</div>' +
      imgHtml +
      '<div style="font-size:11px; color:var(--text-secondary); line-height:1.4; max-height:32px; overflow:hidden; margin-bottom:4px;">' + escapeHtml(preview) + '</div>' +
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
    if (e.target.tagName === 'BUTTON') return;
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
    const relation = prompt("請輸入兩者關係：", "盟友 / 敵對 / 密探");
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

    const x1 = srcNode.x + 95;
    const y1 = srcNode.y + 40;
    const x2 = tgtNode.x + 95;
    const y2 = tgtNode.y + 40;

    const dx = (x2 - x1) * 0.3;
    const d = "M " + x1 + " " + y1 + " C " + (x1 + dx) + " " + y1 + ", " + (x2 - dx) + " " + y2 + ", " + x2 + " " + y2;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "relation-line");
    path.onclick = function() {
      const val = prompt("修改關係說明（留空刪除連線）：", edge.label);
      if (val === null) return;
      if (val.trim() === "") canvas.edges = canvas.edges.filter(e => e.id !== edge.id);
      else edge.label = val.trim();
      saveData();
      renderCanvasLines();
    };

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const textWidth = Math.max(edge.label.length * 13, 36);

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", midX - textWidth / 2);
    bgRect.setAttribute("y", midY - 11);
    bgRect.setAttribute("width", textWidth);
    bgRect.setAttribute("height", 22);
    bgRect.setAttribute("class", "line-label-bg");

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", midX);
    text.setAttribute("y", midY);
    text.setAttribute("class", "line-label-box");
    text.textContent = edge.label;

    g.appendChild(bgRect);
    g.appendChild(text);
    svg.appendChild(path);
    svg.appendChild(g);
  });
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
   8. 批次刪除與刪除當前文檔
   ========================================================== */
function toggleBatchDeleteMode() {
  isBatchDeleteMode = !isBatchDeleteMode;
  if (!isBatchDeleteMode) {
    batchSelectedFolders.clear();
    batchSelectedDocs.clear();
  }
  document.getElementById("batchActionBar").classList.toggle("active", isBatchDeleteMode);
  document.getElementById("appSidebar").classList.toggle("batch-mode", isBatchDeleteMode);
  updateBatchBarCount();
  renderSidebarTree();
}

function toggleBatchItemSelection(type, id) {
  const set = type === "folder" ? batchSelectedFolders : batchSelectedDocs;
  if (set.has(id)) set.delete(id);
  else set.add(id);
  updateBatchBarCount();
  renderSidebarTree();
}

function updateBatchBarCount() {
  const el = document.getElementById("batchSelectedCountText");
  if (!el) return;
  const count = batchSelectedFolders.size + batchSelectedDocs.size;
  el.textContent = count > 0 ? ("已選取 " + count + " 項") : "批量刪除模式：點選項目以選取";
}

function executeBatchDelete() {
  const totalCount = batchSelectedFolders.size + batchSelectedDocs.size;
  if (totalCount === 0) {
    alert("請先點選欲刪除的項目！");
    return;
  }

  const names = [];
  const folderIdsToDelete = Array.from(batchSelectedFolders);
  const docIdsToDelete = Array.from(batchSelectedDocs);

  folderIdsToDelete.forEach(function(id) {
    const f = appData.folders.find(x => x.id === id);
    if (f) names.push("📁 " + f.name);
  });
  docIdsToDelete.forEach(function(id) {
    const d = appData.docs.find(x => x.id === id);
    if (d) names.push("📄 " + (d.title || "無標題文檔"));
  });

  const confirmMsg = "確定要刪除選取的 " + totalCount + " 個項目嗎？\n\n" + names.join("\n");
  if (!confirm(confirmMsg)) return;

  appData.folders = appData.folders.filter(f => !folderIdsToDelete.includes(f.id));
  appData.docs = appData.docs.filter(d => !docIdsToDelete.includes(d.id));

  saveData();
  toggleBatchDeleteMode();
  renderSidebarTree();

  if (docIdsToDelete.includes(activeDocId)) {
    const remainingDocsInWorld = appData.docs.filter(d => d.worldId === activeWorldId);
    if (remainingDocsInWorld.length > 0) loadDocToEditor(remainingDocsInWorld[0].id);
    else clearEditorWorkspace();
  }
}

function deleteCurrentDocument() {
  const doc = appData.docs.find(d => d.id === activeDocId);
  if (!doc) return;
  if (!confirm("確定要刪除此文檔嗎？")) return;

  appData.docs = appData.docs.filter(d => d.id !== activeDocId);
  saveData();
  renderSidebarTree();

  const remainingDocsInWorld = appData.docs.filter(d => d.worldId === activeWorldId);
  if (remainingDocsInWorld.length > 0) loadDocToEditor(remainingDocsInWorld[0].id);
  else clearEditorWorkspace();
}

/* ==========================================================
   9. 匯出與切換
   ========================================================== */
function switchView(view, pushHistory = true) {
  activeView = view;
  document.getElementById("tabEditorBtn").classList.toggle("active", view === 'editor');
  document.getElementById("tabCanvasBtn").classList.toggle("active", view === 'canvas');
  document.getElementById("editorView").style.display = (view === 'editor') ? 'flex' : 'none';
  document.getElementById("canvasView").style.display = (view === 'canvas') ? 'block' : 'none';
  document.getElementById("quickJumpFab").style.display = (view === 'editor') ? 'flex' : 'none';
  if (view !== 'editor') closeQuickJumpPanel();
  if (view === 'canvas') {
    renderCanvas();
    if (pushHistory) history.pushState({ view: 'canvas' }, "");
  }
}

function openBatchExportModal() {
  const container = document.getElementById("exportChecklistContainer");
  container.innerHTML = "";

  appData.worldviews.forEach(function(w) {
    const wTitle = document.createElement("div");
    wTitle.style.fontWeight = "700";
    wTitle.style.fontSize = "13px";
    wTitle.style.margin = "6px 0 2px 0";
    wTitle.innerHTML = "<span>" + (w.icon || '🌐') + " " + escapeHtml(w.name) + "</span>";
    container.appendChild(wTitle);

    const docs = appData.docs.filter(d => d.worldId === w.id);
    docs.forEach(function(d) {
      const row = document.createElement("div");
      row.style.padding = "4px 10px";
      row.innerHTML = `<input type="checkbox" class="export-checkbox" data-id="${d.id}" checked> <span>${d.icon || '📄'} ${escapeHtml(d.title || '無標題')}</span>`;
      container.appendChild(row);
    });
  });

  document.getElementById("batchExportModal").classList.add("active");
}

function toggleExportAll(status) {
  document.querySelectorAll(".export-checkbox").forEach(cb => cb.checked = status);
}
function closeBatchExportModal() { document.getElementById("batchExportModal").classList.remove("active"); }

function confirmBatchExport() {
  const checkedBoxes = document.querySelectorAll(".export-checkbox:checked");
  if (checkedBoxes.length === 0) { alert("請至少選擇一個文檔！"); return; }

  const ids = Array.from(checkedBoxes).map(cb => cb.getAttribute("data-id"));
  const format = document.getElementById("exportFormatSelect").value;
  const docs = appData.docs.filter(d => ids.includes(d.id));

  if (format === "json") {
    downloadFile(JSON.stringify(docs, null, 2), "world_export_" + Date.now() + ".json", "application/json");
  } else if (format === "html") {
    downloadFile(buildExportHTML(docs), "world_export_" + Date.now() + ".html", "text/html;charset=utf-8");
  } else {
    let txt = "";
    docs.forEach(function(d) {
      txt += `【${d.title || '無標題'}】\n標籤：${d.tags.join(' ')}\n\n${d.content}\n\n====================\n\n`;
    });
    downloadFile(txt, "world_export_" + Date.now() + ".txt", "text/plain;charset=utf-8");
  }
  closeBatchExportModal();
}

function buildExportHTML(docs) {
  const body = docs.map(function(d) {
    return `<article class="wb-doc" data-icon="${escapeHtml(d.icon || '📄')}" data-tags="${escapeHtml((d.tags || []).join(','))}">
  <h1>${escapeHtml(d.title || '無標題')}</h1>
  <div class="wb-tags">${(d.tags || []).map(t => '#' + escapeHtml(t)).join(' ')}</div>
  <pre class="wb-content">${escapeHtml(d.content || '')}</pre>
</article>`;
  }).join("\n<hr>\n");

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>世界觀匯出文檔</title>
<style>
  body { font-family: "Noto Sans TC", "Plus Jakarta Sans", sans-serif; max-width: 760px; margin: 40px auto; padding: 0 20px; line-height: 1.7; color: #2A2420; }
  h1 { font-size: 22px; border-bottom: 2px solid #ddd; padding-bottom: 8px; }
  .wb-tags { color: #8A4F1F; font-size: 13px; margin-bottom: 12px; }
  .wb-content { white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: 15px; }
  hr { border: none; border-top: 1px dashed #ccc; margin: 36px 0; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function exportFullDatabaseJSON() {
  downloadFile(JSON.stringify(appData, null, 2), "worldbuilder_full_db_" + Date.now() + ".json", "application/json");
}

function downloadFile(content, fileName, contentType) {
  const a = document.createElement("a");
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ==========================================================
   9.5 匯入功能 (支援 txt / json / html，對應批量匯出的三種格式)
   ========================================================== */
function triggerImportFile() {
  document.getElementById("importFileInput").click();
}

function handleImportFileSelected(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const reader = new FileReader();
  reader.onload = function(evt) {
    const text = evt.target.result;
    try {
      if (ext === "json") {
        importFromJSON(text);
      } else if (ext === "html" || ext === "htm") {
        importFromHTML(text);
      } else {
        importFromTXT(text);
      }
    } catch (err) {
      console.error(err);
      alert("匯入失敗：檔案格式無法辨識或已損毀。");
    }
  };
  reader.onerror = function() {
    alert("讀取檔案時發生錯誤，請重試。");
  };
  reader.readAsText(file);
}

function importFromJSON(text) {
  const data = safeParseJSON(text);
  if (data === null) { alert("匯入失敗：JSON 格式錯誤。"); return; }

  // 完整資料庫備份檔（由 💾 備份 匯出）
  if (data && !Array.isArray(data) && Array.isArray(data.worldviews) && Array.isArray(data.folders) && Array.isArray(data.docs)) {
    if (!confirm("偵測到這是「完整資料庫備份」檔案，匯入將會覆蓋目前所有資料，確定要繼續嗎？")) return;
    appData = data;
    if (!appData.colorPalette) appData.colorPalette = Object.assign({}, DEFAULT_PALETTES);
    if (!appData.tagSettings) appData.tagSettings = {};
    saveData();
    location.reload();
    return;
  }

  // 批量匯出的文檔陣列（JSON 格式）
  if (Array.isArray(data)) {
    importDocsArray(data);
    return;
  }

  alert("匯入失敗：無法辨識此 JSON 檔案的內容格式。");
}

function importFromTXT(text) {
  const blocks = text.split("====================").map(s => s.trim()).filter(Boolean);
  const docs = blocks.map(function(block) {
    const titleMatch = block.match(/^【([^】]*)】/);
    const tagsMatch = block.match(/標籤：([^\n]*)/);
    let content = block;
    if (titleMatch) content = content.replace(titleMatch[0], "");
    if (tagsMatch) content = content.replace(/標籤：[^\n]*/, "");
    content = content.replace(/^\s+/, "").trim();
    return {
      title: titleMatch ? titleMatch[1].trim() : "匯入文檔",
      tags: tagsMatch ? tagsMatch[1].trim().split(/\s+/).filter(Boolean) : [],
      content: content
    };
  });
  importDocsArray(docs);
}

function importFromHTML(text) {
  const parser = new DOMParser();
  const htmlDoc = parser.parseFromString(text, "text/html");
  const articles = htmlDoc.querySelectorAll(".wb-doc");
  const docs = [];
  articles.forEach(function(el) {
    const titleEl = el.querySelector("h1");
    const contentEl = el.querySelector(".wb-content");
    const tagsAttr = el.getAttribute("data-tags") || "";
    docs.push({
      title: titleEl ? titleEl.textContent.trim() : "匯入文檔",
      icon: el.getAttribute("data-icon") || "📄",
      tags: tagsAttr ? tagsAttr.split(",").map(s => s.trim()).filter(Boolean) : [],
      content: contentEl ? contentEl.textContent : ""
    });
  });
  if (docs.length === 0) {
    alert("匯入失敗：此 HTML 檔案不是本工具匯出的格式，找不到可匯入的文檔內容。");
    return;
  }
  importDocsArray(docs);
}

function importDocsArray(docsArray) {
  if (!docsArray || !docsArray.length) { alert("此檔案沒有可匯入的文檔。"); return; }
  if (!confirm(`即將匯入 ${docsArray.length} 篇文檔到「${getWorldName(activeWorldId)}」，確定嗎？`)) return;

  docsArray.forEach(function(d) {
    appData.docs.unshift({
      id: "doc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      worldId: activeWorldId,
      folderId: activeFolderId || null,
      icon: d.icon || "📄",
      title: d.title || "匯入文檔",
      content: d.content || "",
      tags: Array.isArray(d.tags) ? d.tags : [],
      manualTags: computeManualTagsFor(d.content, d.tags),
      images: Array.isArray(d.images) ? d.images : [],
      wordCount: (d.content || "").length,
      updatedAt: formatTime(new Date())
    });
  });
  saveData();
  renderSidebarTree();
  alert("匯入完成！");
}

function getWorldName(id) {
  const w = appData.worldviews.find(x => x.id === id);
  return w ? w.name : "目前世界觀";
}

function safeParseJSON(text) {
  try { return JSON.parse(text); } catch (e) { return null; }
}

/* ==========================================================
   10. 色盤與 EMOJI 彈窗管理
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
    if (w) { w.icon = val; updateWorldBadge(); }
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
  renderBreadcrumb();
  closeIconPickerModal();
}

function openPaletteModal() {
  const container = document.getElementById("paletteConfigList");
  container.innerHTML = "";

  Object.keys(DEFAULT_PALETTES).forEach(function(key) {
    const pal = appData.colorPalette[key] || DEFAULT_PALETTES[key];
    const row = document.createElement("div");
    row.className = "palette-row";

    const circle = document.createElement("div");
    circle.className = "palette-circle";
    circle.style.backgroundColor = pal.bg;
    circle.style.borderColor = pal.text;

    const inputWrap = document.createElement("div");
    inputWrap.className = "palette-input-wrap";
    inputWrap.innerHTML = '<input type="text" class="form-input" id="pal_name_' + key + '" value="' + escapeHtml(pal.name) + '" placeholder="請輸入標籤分類名稱...">';

    row.appendChild(circle);
    row.appendChild(inputWrap);
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
      if (!appData.colorPalette[key]) appData.colorPalette[key] = Object.assign({}, DEFAULT_PALETTES[key]);
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
  popover.innerHTML = '<div style="font-size:11px; font-weight:700; color:var(--text-muted); margin-bottom:4px;">指定分類顏色：</div>';

  Object.keys(DEFAULT_PALETTES).forEach(function(key) {
    const pal = appData.colorPalette[key] || DEFAULT_PALETTES[key];
    const opt = document.createElement("div");
    opt.className = "picker-option";
    opt.innerHTML = `<span style="width:14px; height:14px; border-radius:50%; background:${pal.bg}; border:1.5px solid ${pal.text};"></span><span style="color:${pal.text}; font-weight:600;">${escapeHtml(pal.name)}</span>`;
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
  popover.style.left = Math.max(10, rect.left + window.scrollX) + "px";
  popover.classList.add("active");
}

function setupGlobalClickDismiss() {
  document.addEventListener("click", function(e) {
    const popover = document.getElementById("colorPickerPopover");
    if (popover && popover.classList.contains("active") && !popover.contains(e.target)) {
      popover.classList.remove("active");
    }
    if (!e.target.closest('.breadcrumb-item')) {
      closeAllBreadcrumbDropdowns();
    }
  });
}

function promptMoveFolder(folderId) {
  moveFolderTargetId = folderId;
  const select = document.getElementById("moveTargetSelect");
  select.innerHTML = "";

  appData.worldviews.forEach(function(w) {
    const opt = document.createElement("option");
    opt.value = JSON.stringify({ worldId: w.id, parentId: null });
    opt.textContent = "🌐 " + w.name + " (根目錄)";
    select.appendChild(opt);
  });

  appData.folders.forEach(function(f) {
    if (f.id !== folderId && f.parentId !== folderId && !isDescendantOf(folderId, f.id)) {
      const opt = document.createElement("option");
      opt.value = JSON.stringify({ worldId: f.worldId, parentId: f.id });
      opt.textContent = "📁 " + f.name;
      select.appendChild(opt);
    }
  });

  document.getElementById("moveModal").classList.add("active");
}

function closeMoveModal() { 
  document.getElementById("moveModal").classList.remove("active"); 
}

function confirmMoveFolder() {
  const select = document.getElementById("moveTargetSelect");
  if (!select.value || !moveFolderTargetId) return;
  const target = JSON.parse(select.value);
  const folder = appData.folders.find(f => f.id === moveFolderTargetId);
  if (folder) {
    folder.worldId = target.worldId;
    folder.parentId = target.parentId;
    saveData();
    renderSidebarTree();
    renderBreadcrumb();
  }
  closeMoveModal();
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

const saved = localStorage.getItem("novel_multi_world_data_v5");
if (saved) {
  try {
    const parsed = JSON.parse(saved);
    if (parsed && Array.isArray(parsed.docs) && parsed.docs.length > 0) {
      appData = parsed;
    }
  } catch (e) { console.error(e); }
}

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

if (!appData.trash || typeof appData.trash !== "object") {
  appData.trash = { docs: [], folders: [] };
}
if (!Array.isArray(appData.trash.docs)) appData.trash.docs = [];
if (!Array.isArray(appData.trash.folders)) appData.trash.folders = [];

function saveData() {
  localStorage.setItem("novel_multi_world_data_v5", JSON.stringify(appData));
}

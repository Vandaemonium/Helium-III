/**
 * Submodule: HomePanelQueries
 * Evaluated as a child frontend JS module of HomePanelRoot (exposed as `HomePanelQueries` in bundle scope).
 * Purely read-only over user notes and retained user configuration.
 */

const DEFAULT_CONFIG = Object.freeze({
    schemaVersion: 1,
    recentLimit: 8,
    pinnedLabel: "pinned",
    pinnedLimit: 12,
    inboxLabel: "inbox",
    inboxLimit: 10,
    excludeHidden: true,
    excludeArchived: true
});

function clampLimit(value, fallback, min = 1, max = 50) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, Math.floor(num)));
}

function sanitizeLabelName(name, fallback) {
    if (typeof name !== "string") {
        return fallback;
    }
    const cleaned = name.trim().replace(/^#/, "").replace(/[^a-zA-Z0-9_:-]/g, "");
    return cleaned || fallback;
}

function normalizeConfig(raw) {
    if (!raw || typeof raw !== "object") {
        return { ...DEFAULT_CONFIG };
    }
    return {
        schemaVersion: 1,
        recentLimit: clampLimit(raw.recentLimit, DEFAULT_CONFIG.recentLimit, 1, 50),
        pinnedLabel: sanitizeLabelName(raw.pinnedLabel, DEFAULT_CONFIG.pinnedLabel),
        pinnedLimit: clampLimit(raw.pinnedLimit, DEFAULT_CONFIG.pinnedLimit, 1, 50),
        inboxLabel: sanitizeLabelName(raw.inboxLabel, DEFAULT_CONFIG.inboxLabel),
        inboxLimit: clampLimit(raw.inboxLimit, DEFAULT_CONFIG.inboxLimit, 1, 50),
        excludeHidden: raw.excludeHidden !== undefined ? Boolean(raw.excludeHidden) : DEFAULT_CONFIG.excludeHidden,
        excludeArchived: raw.excludeArchived !== undefined ? Boolean(raw.excludeArchived) : DEFAULT_CONFIG.excludeArchived
    };
}

function isSystemOrModuleCodeNote(note, config) {
    if (!note || !note.noteId) {
        return true;
    }
    if (note.noteId === "root" || note.noteId.startsWith("_")) {
        return true;
    }
    // Excluded even when unlocked, like Quick Notes: keeps titles and timestamps out of module state.
    if (note.isProtected) {
        return true;
    }
    if (config.excludeHidden && typeof note.isInHiddenSubtree === "function" && note.isInHiddenSubtree()) {
        return true;
    }
    if (config.excludeArchived && note.isArchived) {
        return true;
    }
    if (typeof note.hasOwnedLabel === "function") {
        if (note.hasOwnedLabel("heliumModuleId") || note.hasOwnedLabel("heliumModuleConfig") || note.hasOwnedLabel("heliumHomeHost")) {
            return true;
        }
    }
    return false;
}

async function loadRetainedConfig(apiInstance) {
    try {
        const configNote = await apiInstance.searchForNote('#heliumModuleConfig="empyrean.home-panel"');
        if (!configNote) {
            return { config: { ...DEFAULT_CONFIG }, configNoteId: null };
        }
        const rawJson = await configNote.getJsonContent();
        return {
            config: normalizeConfig(rawJson),
            configNoteId: configNote.noteId
        };
    } catch {
        return { config: { ...DEFAULT_CONFIG }, configNoteId: null };
    }
}

async function toNoteSummary(note) {
    let utcDateModified = "";
    let dateModified = "";
    if (typeof note.getMetadata === "function") {
        try {
            const meta = await note.getMetadata();
            utcDateModified = meta?.utcDateModified || "";
            dateModified = meta?.dateModified || "";
        } catch {
            utcDateModified = "";
        }
    }
    const icon = typeof note.getIcon === "function" ? note.getIcon() : "tn-icon bx bx-note";
    return {
        noteId: note.noteId,
        title: note.title || "(Untitled)",
        type: note.type || "text",
        icon,
        utcDateModified,
        dateModified
    };
}

async function fetchPinnedNotes(apiInstance, config) {
    const query = `#${config.pinnedLabel}`;
    const found = await apiInstance.searchForNotes(query);
    const filtered = found.filter((n) => !isSystemOrModuleCodeNote(n, config));
    const summaries = await Promise.all(filtered.slice(0, config.pinnedLimit).map(toNoteSummary));
    return summaries;
}

async function fetchInboxNotes(apiInstance, config) {
    const inboxRootQuery = `#${config.inboxLabel}`;
    const taggedNotes = await apiInstance.searchForNotes(inboxRootQuery);
    const seen = new Set();
    const collected = [];

    for (const candidate of taggedNotes) {
        if (!candidate || !candidate.noteId) continue;

        // If a folder note is marked #inbox, include its non-system children as inbox items;
        // also include direct notes tagged #inbox.
        if (typeof candidate.getChildNotes === "function" && typeof candidate.hasChildren === "function" && candidate.hasChildren()) {
            try {
                const children = await candidate.getChildNotes();
                for (const child of children) {
                    if (!seen.has(child.noteId) && !isSystemOrModuleCodeNote(child, config)) {
                        seen.add(child.noteId);
                        collected.push(child);
                    }
                }
            } catch {
                // fallback to candidate itself
            }
        }

        if (!seen.has(candidate.noteId) && !isSystemOrModuleCodeNote(candidate, config)) {
            seen.add(candidate.noteId);
            collected.push(candidate);
        }
    }

    const summaries = await Promise.all(collected.slice(0, config.inboxLimit).map(toNoteSummary));
    summaries.sort((a, b) => String(b.utcDateModified).localeCompare(String(a.utcDateModified)));
    return summaries.slice(0, config.inboxLimit);
}

async function fetchRecentNotes(apiInstance, config) {
    const query = "note.noteId != 'root' orderBy note.utcDateModified desc limit " + String(config.recentLimit * 3);
    const candidates = await apiInstance.searchForNotes(query);
    const filtered = candidates.filter((n) => !isSystemOrModuleCodeNote(n, config));
    const summaries = await Promise.all(filtered.slice(0, config.recentLimit * 2).map(toNoteSummary));
    summaries.sort((a, b) => String(b.utcDateModified).localeCompare(String(a.utcDateModified)));
    return summaries.slice(0, config.recentLimit);
}

async function loadHomePanelData(apiInstance) {
    const { config, configNoteId } = await loadRetainedConfig(apiInstance);
    const [pinned, inbox, recent] = await Promise.all([
        fetchPinnedNotes(apiInstance, config),
        fetchInboxNotes(apiInstance, config),
        fetchRecentNotes(apiInstance, config)
    ]);

    return {
        config,
        configNoteId,
        pinned,
        inbox,
        recent,
        loadedAt: new Date().toISOString()
    };
}

module.exports = {
    DEFAULT_CONFIG,
    clampLimit,
    sanitizeLabelName,
    normalizeConfig,
    isSystemOrModuleCodeNote,
    loadRetainedConfig,
    fetchPinnedNotes,
    fetchInboxNotes,
    fetchRecentNotes,
    loadHomePanelData
};

/* Target-specific authenticated frontend adapter; see verification.md for tested builds. */
function htmlToText(html) {
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    doc.querySelectorAll('script,style,iframe,object,embed,template').forEach(node => node.remove());
    doc.querySelectorAll('br').forEach(node => node.replaceWith('\n'));
    doc.querySelectorAll('p,div,li,h1,h2,h3,tr').forEach(node => node.append('\n'));
    return doc.body.textContent.trim();
}
async function frontendRequest(method, route, body) {
    const g = globalThis.glob;
    if (!g?.csrfToken || !g.baseApiUrl) throw new Error('Authenticated frontend context unavailable.');
    const base = new URL(g.baseApiUrl, location.href);
    if (base.origin !== location.origin) throw new Error('Quick Notes requires same-origin API access.');
    const response = await fetch(new URL(route, base.href.endsWith('/') ? base : `${base.href}/`), {
        method, credentials: 'same-origin', redirect: 'error',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': g.csrfToken, 'trilium-component-id': g.componentId || '' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Quick Notes request failed (${response.status}); refresh before retrying.`);
    return response.status === 204 ? null : response.json();
}
function createFrontendStore(api, config, { request = frontendRequest, toText = htmlToText } = {}) {
    if (!/^[a-zA-Z0-9_]{1,64}$/.test(config?.dataNoteId || '')) throw new Error('Invalid Quick Notes destination.');
    async function folder() {
        const note = await api.getNote(config.dataNoteId);
        if (!note || note.isProtected) throw new Error('Quick Notes destination missing or protected; capture refused.');
        return note;
    }
    async function member(id) {
        const children = await (await folder()).getChildNotes();
        const note = children.find(n => n.noteId === id);
        if (!note) throw new Error('Not a Quick Notes member.');
        if (note.isProtected) throw new Error('Protected notes are not displayed or modified by Quick Notes.');
        return note;
    }
    return {
        async create(data) {
            await folder();
            const result = await api.createNote(config.dataNoteId, { ...data, type: 'text', mime: 'text/html', activate: false, isProtected: false });
            if (!result?.note?.noteId) throw new Error('No persisted note was confirmed.');
            return result.note;
        },
        async list() {
            const children = await (await folder()).getChildNotes();
            const result = [];
            for (const note of children) {
                // Never cache decrypted protected text, even while a protected session is open.
                if (note.isProtected || note.type !== 'text') continue;
                const content = await note.getContent();
                const metadata = await note.getMetadata();
                if (note.isProtected) continue;
                result.push({ noteId: note.noteId, title: note.title, text: toText(content), modified: metadata.utcDateModified,
                    pinned: note.getOwnedLabelValue('heliumQuickPinned') === 'true',
                    archived: note.getOwnedLabelValue('heliumQuickArchived') === 'true' });
            }
            return result;
        },
        async setState(id, key, enabled) {
            const name = { pinned: 'heliumQuickPinned', archived: 'heliumQuickArchived' }[key];
            if (!name) throw new Error('Unknown Quick Notes state.');
            await member(id);
            await request('PUT', `notes/${encodeURIComponent(id)}/set-attribute`, {
                type: 'label', name, value: enabled ? 'true' : 'false', isInheritable: false
            });
            await api.reloadNotes([id]);
        },
        async open(id) { await member(id); await api.activateNote(id); }
    };
}
module.exports = { htmlToText, frontendRequest, createFrontendStore };

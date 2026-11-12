/* Shared by the Trilium note bundle and Node tests. No backend execution. */
function textCapture(draft) {
    const text = String(draft).replace(/\r\n?/g, '\n').replace(/^\n+/, '');
    if (!text.trim()) throw new Error('Enter some text before saving.');
    const title = text.split('\n').find(line => line.trim()).trim();
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return { title, content: `<p>${escaped.replace(/\n/g, '<br>')}</p>` };
}
class QuickNotesController {
    constructor(store) {
        this.store = store;
        this.draft = '';
        this.status = 'idle';
    }
    acknowledgeUncertain() {
        if (this.status === 'uncertain') this.status = 'idle';
    }
    async save() {
        if (this.status === 'pending') throw new Error('A save is pending.');
        if (this.status === 'uncertain') throw new Error('Previous save is uncertain. Check existing notes before retrying.');
        const snapshot = this.draft;
        const data = textCapture(snapshot);
        this.status = 'pending';
        try {
            const note = await this.store.create(data);
            if (!note?.noteId) throw new Error('No persisted note was confirmed.');
            if (this.draft === snapshot) this.draft = '';
            this.status = 'saved';
            return note;
        } catch (error) {
            this.status = 'uncertain';
            throw error;
        }
    }
}
function selectCards(notes, { query = '', archived = false } = {}) {
    const needle = String(query).toLocaleLowerCase();
    return notes.filter(note => !note.isProtected && Boolean(note.archived) === Boolean(archived)
        && `${note.title}\n${note.text}`.toLocaleLowerCase().includes(needle))
        .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
            || String(b.modified || '').localeCompare(String(a.modified || ''))
            || a.noteId.localeCompare(b.noteId));
}
module.exports = { textCapture, QuickNotesController, selectCards };

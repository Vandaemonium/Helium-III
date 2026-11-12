import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function adapter() {
    const url = new URL('../src/QuickNotesAdapter.js', import.meta.url);
    assert.ok(existsSync(url), 'authenticated frontend store must exist');
    return require(url.pathname);
}
function fixture() {
    const notes = new Map();
    const make = (id, opts = {}) => ({ noteId: id, title: id, type: 'text', isProtected: false,
        getOwnedLabelValue: () => null, async getContent() { return '<p>body needle</p>'; },
        async getMetadata() { return { utcDateModified: '2026-11-12' }; }, ...opts });
    notes.set('data', make('data', { async getChildNotes() { return [notes.get('a'), notes.get('locked')]; } }));
    notes.set('a', make('a'));
    notes.set('locked', make('locked', { isProtected: true, getContent() { throw new Error('protected content must not be read'); } }));
    const calls = [];
    const api = { async getNote(id) { return notes.get(id); }, async reloadNotes() {},
        async createNote(parent, data) { calls.push({ parent, data }); return { note: make('new') }; },
        async openTabWithNote(id) { calls.push({ open: id }); } };
    const request = async (...args) => { calls.push(args); };
    return { notes, calls, api, request };
}
test('frontend store creates only in dedicated folder without activation or backend code', async () => {
    const { createFrontendStore } = adapter();
    const f = fixture();
    const s = createFrontendStore(f.api, { dataNoteId: 'data' }, { request: f.request, toText: value => value.replace(/<[^>]*>/g, '') });
    assert.equal((await s.create({ title: 'title', content: '<p>body</p>' })).noteId, 'new');
    assert.equal(f.calls[0].parent, 'data');
    assert.equal(f.calls[0].data.activate, false);
    assert.equal(f.calls[0].data.isProtected, false);
    const rows = await s.list();
    assert.deepEqual(rows.map(n => n.noteId), ['a']);
    assert.equal(rows[0].text, 'body needle');
});
test('pin/archive writes are scoped and reject unrelated or protected targets', async () => {
    const { createFrontendStore } = adapter();
    const f = fixture();
    const s = createFrontendStore(f.api, { dataNoteId: 'data' }, { request: f.request, toText: x => x });
    await s.setState('a', 'pinned', true);
    assert.equal(f.calls[0][1], 'notes/a/set-attribute');
    assert.equal(f.calls[0][2].name, 'heliumQuickPinned');
    assert.equal(f.calls[0][2].value, 'true');
    await assert.rejects(s.setState('unrelated', 'archived', true), /Quick Notes/);
    await assert.rejects(s.setState('locked', 'archived', true), /protected/i);
    await assert.rejects(s.setState('a', 'share', true), /state/);
});
test('card open navigates the current native context instead of leaving a background tab', async () => {
    const { createFrontendStore } = adapter();
    const f = fixture();
    f.api.activateNote = async id => f.calls.push({ activate: id });
    const s = createFrontendStore(f.api, { dataNoteId: 'data' }, { request: f.request, toText: x => x });
    await s.open('a');
    assert.deepEqual(f.calls, [{ activate: 'a' }]);
});

test('protected destination is refused rather than silently downgrading protection', async () => {
    const { createFrontendStore } = adapter();
    const f = fixture(); f.notes.get('data').isProtected = true;
    const s = createFrontendStore(f.api, { dataNoteId: 'data' }, { request: f.request, toText: x => x });
    await assert.rejects(s.create({ title: 'private', content: 'private' }), /protected/i);
    assert.equal(f.calls.length, 0);
});

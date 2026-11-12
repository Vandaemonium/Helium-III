import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const corePath = new URL('../src/QuickNotesCore.js', import.meta.url);
function core() {
    assert.ok(existsSync(corePath), 'Quick Notes capture implementation must exist');
    return require(corePath.pathname);
}

test('capture persists escaped native text with first nonblank line as title', async () => {
    const { QuickNotesController } = core();
    const created = [];
    const controller = new QuickNotesController({ async create(data) { created.push(data); return { noteId: 'saved' }; } });
    controller.draft = '\n Hello <script>\nKeep & preserve\n';
    const result = await controller.save();
    assert.equal(result.noteId, 'saved');
    assert.equal(created.length, 1);
    assert.equal(created[0].title, 'Hello <script>');
    assert.equal(created[0].content, '<p> Hello &lt;script&gt;<br>Keep &amp; preserve<br></p>');
    assert.equal(controller.draft, '');
    assert.equal(controller.status, 'saved');
});

test('pending save blocks duplicate clicks and preserves newly typed text', async () => {
    const { QuickNotesController } = core();
    let finish;
    let calls = 0;
    const c = new QuickNotesController({ create() { calls++; return new Promise(resolve => { finish = resolve; }); } });
    c.draft = 'one';
    const saving = c.save();
    assert.equal(c.status, 'pending');
    await assert.rejects(c.save(), /pending/i);
    c.draft = 'two';
    finish({ noteId: 'one' });
    await saving;
    assert.equal(calls, 1);
    assert.equal(c.draft, 'two');
});

test('ambiguous save retains draft and blocks retries until explicitly acknowledged', async () => {
    const { QuickNotesController } = core();
    let calls = 0;
    const c = new QuickNotesController({ async create() { calls++; throw new Error('network'); } });
    c.draft = 'important';
    await assert.rejects(c.save(), /network/);
    assert.equal(c.draft, 'important');
    assert.equal(c.status, 'uncertain');
    await assert.rejects(c.save(), /uncertain/i);
    assert.equal(calls, 1);
    c.acknowledgeUncertain();
    assert.equal(c.status, 'idle');
});

test('empty capture does not issue a write', async () => {
    const { QuickNotesController } = core();
    let calls = 0;
    const c = new QuickNotesController({ async create() { calls++; } });
    c.draft = ' \n\t ';
    await assert.rejects(c.save(), /text/);
    assert.equal(calls, 0);
});

test('cards scope search and archive and order pinned before modification time', () => {
    const { selectCards } = core();
    assert.equal(typeof selectCards, 'function', 'card selector must be implemented');
    const notes = [
        { noteId: 'a', title: 'A', text: 'needle', modified: '2026-11-10', pinned: false, archived: false },
        { noteId: 'b', title: 'B', text: 'needle', modified: '2026-11-01', pinned: true, archived: false },
        { noteId: 'c', title: 'needle', text: '', modified: '2026-11-12', pinned: false, archived: true },
        { noteId: 'd', title: 'private needle', text: 'hidden', isProtected: true }
    ];
    assert.deepEqual(selectCards(notes, { query: 'NEEDLE', archived: false }).map(n => n.noteId), ['b', 'a']);
    assert.deepEqual(selectCards(notes, { query: 'needle', archived: true }).map(n => n.noteId), ['c']);
    assert.deepEqual(selectCards(notes, { query: 'missing' }), []);
});

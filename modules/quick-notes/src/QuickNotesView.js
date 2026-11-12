async function mount(root, { store, controller, selectCards }) {
    root.innerHTML = `<section class="helium-quick" aria-label="Quick Notes">
<style>
.helium-quick{box-sizing:border-box;max-width:1100px;margin:auto;padding:16px;color:inherit;font:inherit}
.helium-quick *{box-sizing:border-box}.helium-quick textarea,.helium-quick input{width:100%;font:inherit;padding:12px;border:1px solid #8888;border-radius:8px;background:transparent;color:inherit;min-width:0}
.helium-quick textarea{min-height:120px;resize:vertical}.helium-quick button{font:inherit;background:transparent;color:inherit;border:1px solid #8888;border-radius:8px;padding:10px 12px;min-height:44px;cursor:pointer;overflow-wrap:anywhere}
.helium-quick button:disabled{opacity:.5;cursor:wait}.helium-quick :focus-visible{outline:3px solid #668cff;outline-offset:2px}.helium-quick .hq-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.helium-quick .hq-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:12px}.helium-quick article{border:1px solid #8888;border-radius:12px;padding:12px;min-width:0;overflow-wrap:anywhere}
.helium-quick .hq-open{display:block;width:100%;text-align:left;border:0;padding:0;font-weight:600}.helium-quick .hq-preview{white-space:pre-wrap;overflow:hidden;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical}.helium-quick [hidden]{display:none!important}
</style>
<h2>Quick Notes</h2><label>New quick note<textarea aria-label="New quick note" placeholder="First line is the title. Capture the rest below."></textarea></label>
<div class="hq-toolbar"><button type="button" data-save>Save note</button><button type="button" data-ack hidden>I checked existing notes; allow retry</button></div>
<p role="status" aria-live="polite"></p><label>Search quick notes<input type="search" aria-label="Search quick notes"></label>
<div class="hq-toolbar"><button type="button" data-active aria-pressed="true">Active</button><button type="button" data-archived aria-pressed="false">Archived</button><button type="button" data-refresh>Refresh</button></div>
<div class="hq-grid" aria-label="Note cards"></div></section>`;
    const q = selector => root.querySelector(selector);
    const draft = q('textarea'), save = q('[data-save]'), ack = q('[data-ack]'), status = q('[role=status]');
    const grid = q('.hq-grid'), search = q('input');
    let archived = false, rows = [], loadSequence = 0, disposed = false;
    draft.value = controller.draft;
    const feedback = text => { if (!disposed) status.textContent = text; };
    function sync() {
        draft.disabled = controller.status === 'pending';
        save.disabled = controller.status === 'pending' || controller.status === 'uncertain';
        ack.hidden = controller.status !== 'uncertain';
    }
    function render() {
        if (disposed) return;
        grid.replaceChildren();
        const selected = selectCards(rows, { query: search.value, archived });
        if (!selected.length) { const empty = document.createElement('p'); empty.textContent = 'No notes in this view.'; grid.append(empty); }
        for (const note of selected) {
            const card = document.createElement('article');
            const open = document.createElement('button'); open.type = 'button'; open.className = 'hq-open';
            open.textContent = note.title; open.setAttribute('aria-label', `Open ${note.title}`);
            open.onclick = async () => { try { await store.open(note.noteId); } catch { feedback('Unable to open this note; refresh and try again.'); } };
            const preview = document.createElement('p'); preview.className = 'hq-preview'; preview.textContent = note.text;
            const controls = document.createElement('div'); controls.className = 'hq-toolbar';
            for (const [key, caption] of [['pinned', note.pinned ? 'Unpin' : 'Pin'], ['archived', note.archived ? 'Restore' : 'Archive']]) {
                const button = document.createElement('button'); button.type = 'button'; button.textContent = caption;
                button.setAttribute('aria-label', `${caption} ${note.title}`); button.setAttribute('aria-pressed', String(Boolean(note[key])));
                button.onclick = async () => {
                    button.disabled = true;
                    try { await store.setState(note.noteId, key, !note[key]); await refresh(); }
                    catch { feedback('Change was not confirmed. Refresh before retrying.'); button.disabled = false; }
                };
                controls.append(button);
            }
            card.append(open, preview, controls); grid.append(card);
        }
    }
    async function refresh() {
        const sequence = ++loadSequence;
        // Drop previews while rechecking permissions, instead of presenting stale data on error.
        rows = []; render();
        try { const next = await store.list(); if (sequence === loadSequence && !disposed) { rows = next; render(); } }
        catch { feedback('Could not refresh Quick Notes. Notes were not changed.'); }
    }
    draft.oninput = () => { controller.draft = draft.value; };
    save.onclick = async () => {
        const work = controller.save(); sync(); feedback(controller.status === 'pending' ? 'Saving…' : 'Enter some text before saving.');
        try { await work; draft.value = controller.draft; feedback('Saved.'); await refresh(); }
        catch { feedback(controller.status === 'uncertain' ? 'Save uncertain. Check Active, Archived and the native folder before allowing a retry. Draft kept.' : 'Enter some text before saving.'); }
        sync();
    };
    ack.onclick = () => { controller.acknowledgeUncertain(); sync(); feedback('Retry enabled. Saving again may duplicate a note if the earlier save succeeded.'); };
    search.oninput = render;
    for (const [selector, state] of [['[data-active]', false], ['[data-archived]', true]]) q(selector).onclick = () => {
        archived = state; q('[data-active]').setAttribute('aria-pressed', String(!state)); q('[data-archived]').setAttribute('aria-pressed', String(state)); render();
    };
    q('[data-refresh]').onclick = refresh;
    const beforeUnload = event => { if (controller.draft || controller.status === 'pending') { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    const dispose = () => { disposed = true; rows = []; window.removeEventListener('beforeunload', beforeUnload); observer.disconnect(); };
    const observer = new MutationObserver(() => { if (!root.isConnected) dispose(); });
    observer.observe(document.body, { childList: true, subtree: true });
    sync(); await refresh();
    return { refresh, dispose };
}
module.exports = { mount };

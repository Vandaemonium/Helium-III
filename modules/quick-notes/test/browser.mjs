import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '../test-tools/node_modules/playwright/index.mjs';
const dir = new URL('../src/', import.meta.url);
assert.ok(fs.existsSync(new URL('QuickNotesView.js', dir)), 'responsive Quick Notes view must exist');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.setContent('<main id="root"></main>');
    for (const name of ['QuickNotesCore', 'QuickNotesAdapter', 'QuickNotesView']) {
        await page.evaluate(({ name, source }) => {
            window.modules ||= {};
            const mod = { exports: {} };
            new Function('module', 'require', source)(mod, n => window.modules[n]);
            window.modules[name] = mod.exports;
        }, { name, source: fs.readFileSync(new URL(`${name}.js`, dir), 'utf8') });
    }
    await page.evaluate(async () => {
        const rows = [];
        window.fixture = { rows, async create(data) { const note = { noteId: String(rows.length + 1), ...data, text: data.content, modified: '2026-11-12' }; rows.push(note); return note; },
            async list() { return rows; }, async setState(id, key, val) { rows.find(n => n.noteId === id)[key] = val; }, async open(id) { window.opened = id; } };
        window.controller = new window.modules.QuickNotesCore.QuickNotesController(window.fixture);
        await window.modules.QuickNotesView.mount(document.getElementById('root'), { store: window.fixture, controller: window.controller, selectCards: window.modules.QuickNotesCore.selectCards });
    });
    await page.getByLabel('New quick note').fill('A title\nneedle body');
    await page.getByRole('button', { name: 'Save note', exact: true }).click();
    await page.getByRole('button', { name: 'Open A title', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Pin A title', exact: true }).click();
    await page.getByRole('button', { name: 'Unpin A title', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Archive A title', exact: true }).click();
    await page.getByText('No notes in this view.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Archived', exact: true }).click();
    await page.getByRole('button', { name: 'Restore A title', exact: true }).click();
    await page.getByRole('button', { name: 'Active', exact: true }).click();
    await page.getByLabel('Search quick notes').fill('missing');
    await page.getByText('No notes in this view.', { exact: true }).waitFor();
    await page.getByLabel('Search quick notes').fill('needle');
    await page.getByRole('button', { name: 'Open A title', exact: true }).click();
    assert.equal(await page.evaluate(() => window.opened), '1');
    await page.getByLabel('New quick note').fill('retain draft');
    await page.getByRole('button', { name: 'Archived', exact: true }).click();
    assert.equal(await page.getByLabel('New quick note').inputValue(), 'retain draft');
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.evaluate(() => { window.fixture.create = () => new Promise(resolve => { window.finishSave = resolve; }); });
    await page.getByRole('button', { name: 'Save note', exact: true }).click();
    assert.equal(await page.getByLabel('New quick note').isDisabled(), true, 'freeze the pending draft until the server confirms or fails');
    await page.evaluate(() => window.finishSave({ noteId: 'pending-saved' }));
    await page.waitForFunction(() => window.controller.status === 'saved');
    assert.equal(await page.getByLabel('New quick note').isDisabled(), false);
    await page.getByLabel('New quick note').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('button', { name: 'Save note', exact: true }).evaluate(el => getComputedStyle(el).outlineStyle !== 'none'), true);
    assert.equal(await page.evaluate(() => window.modules.QuickNotesAdapter.htmlToText('<p>Hello<img src=x onerror=alert(1)></p><script>evil()</script>')), 'Hello');
    console.log('PASS: Chromium desktop + 375px capture, pin, archive/restore, search, native-open callback, draft retention and safe preview');
} finally { await browser.close(); }

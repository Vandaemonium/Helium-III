/* Real packaged upstream runtime test. Fresh synthetic DB only; never points at production. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, devices } from '../test-tools/node_modules/playwright/index.mjs';
import { EtapiClient, QuickNotesLifecycle } from '../scripts/lifecycle.mjs';
const runtime = process.env.HELIUM_TEST_RUNTIME;
assert.ok(runtime && fs.existsSync(path.join(runtime, 'main.mjs')), 'Set HELIUM_TEST_RUNTIME to the extracted upstream server distribution');
const dataDir = `/home/vc/plans/notes-app/quick-notes-fixture-${Date.now()}`;
fs.mkdirSync(dataDir, { recursive: false });
const base = 'http://127.0.0.1:18174';
let ephemeral = randomBytes(24).toString('hex');
const server = spawn(path.join(runtime, 'node/bin/node'), ['main.mjs'], { cwd: runtime,
    env: { ...process.env, TRILIUM_DATA_DIR: dataDir, TRILIUM_NETWORK_HOST:'127.0.0.1', TRILIUM_NETWORK_PORT:'18174' }, stdio: 'ignore' });
let browser, page;
const errors = [];
try {
    let ready = false;
    for (let i = 0; i < 150; i++) { try { const r=await fetch(`${base}/api/setup/status`);if(r.ok){ready=true;break;} } catch {} await delay(200); }
    assert.ok(ready, 'Fresh loopback runtime must become ready');
    const setup = await (await fetch(`${base}/api/setup/status`)).json();
    assert.equal(setup.hasExistingData, false, 'Refuse to run setup against existing content');
    browser = await chromium.launch({ executablePath:'/usr/bin/chromium', headless:true });
    page = await browser.newPage({ viewport:{width:1280,height:900} });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByText('New knowledge base',{exact:true}).click();
    await page.getByText('Empty',{exact:true}).click();
    await page.locator('input[name=password1]').fill(ephemeral);
    await page.locator('input[name=password2]').fill(ephemeral);
    await page.getByRole('button',{name:'Set password',exact:true}).click();
    await page.locator('input[name=password]').fill(ephemeral);
    await page.locator('input[name=password]').press('Enter');
    await page.waitForFunction(()=>!!window.glob?.appContext && !!window.glob?.csrfToken);
    const login = await fetch(`${base}/etapi/auth/login`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:ephemeral,tokenName:'isolated Quick Notes fixture'})});
    assert.equal(login.status,201);
    const {authToken}=await login.json();
    const client = new EtapiClient(base,authToken);
    const info=await client.request('GET','app-info');
    console.log('Runtime identity:',JSON.stringify({appVersion:info.appVersion,dbVersion:info.dbVersion,syncVersion:info.syncVersion}));
    const manager = new QuickNotesLifecycle(client);
    const installed=await manager.install();
    assert.equal((await client.getNote(installed.hostNoteId)).attributes.some(a=>a.name==='renderNote'),false);
    await manager.activate(); await manager.activate();
    await page.goto(`${base}/#root/${installed.hostNoteId}`);
    const save=page.getByRole('button',{name:'Save note',exact:true});
    await save.waitFor({timeout:30000});
    await page.getByLabel('New quick note').fill('Fixture capture\nneedle body <script>not code</script>');
    await save.click();
    await page.getByRole('button',{name:'Open Fixture capture',exact:true}).waitFor();
    const folder=await client.getNote(installed.dataNoteId);assert.equal(folder.childNoteIds.length,1);
    const noteId=folder.childNoteIds[0];
    assert.match(await client.content(noteId),/&lt;script&gt;not code&lt;\/script&gt;/);
    await page.getByRole('button',{name:'Pin Fixture capture',exact:true}).click();
    await page.getByRole('button',{name:'Unpin Fixture capture',exact:true}).waitFor();
    assert.ok((await client.getNote(noteId)).attributes.some(a=>a.name==='heliumQuickPinned'&&a.value==='true'));
    await page.getByRole('button',{name:'Archive Fixture capture',exact:true}).click();
    await page.getByRole('region',{name:'Quick Notes',exact:true}).getByText('No notes in this view.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Archived',exact:true}).click();
    await page.getByRole('button',{name:'Restore Fixture capture',exact:true}).click();
    await page.getByRole('button',{name:'Active',exact:true}).click();
    await page.getByLabel('Search quick notes').fill('needle');
    await page.getByRole('button',{name:'Open Fixture capture',exact:true}).click();
    await page.waitForFunction(id=>window.glob?.appContext?.tabManager?.getActiveContext()?.noteId === id,noteId);
    // Change a native rich-text body via the real application API, then ensure previews never rewrite it.
    await client.request('PUT',`notes/${noteId}/content`,'<p><strong>Edited native body</strong> needle</p>');
    await page.goto(`${base}/#root/${installed.hostNoteId}`);
    await page.getByRole('region',{name:'Quick Notes',exact:true}).getByText('Edited native body needle',{exact:true}).waitFor();
    assert.equal(await client.content(noteId),'<p><strong>Edited native body</strong> needle</p>');
    const phoneContext=await browser.newContext({...devices['Pixel 5']});
    const phone=await phoneContext.newPage();
    await phone.goto(`${base}/?login`);
    await phone.locator('input[name=password]').fill(ephemeral);await phone.locator('input[name=password]').press('Enter');
    await phone.waitForFunction(()=>!!window.glob?.appContext && !!window.glob?.csrfToken);
    await phone.goto(`${base}/#root/${installed.hostNoteId}`);
    await phone.getByRole('button',{name:'Save note',exact:true}).waitFor();
    await phone.setViewportSize({width:375,height:812});
    assert.equal(await phone.locator('.helium-quick:visible').count(), 1);
    assert.ok(await phone.locator('.helium-quick:visible').evaluate(el=>el.scrollWidth<=el.clientWidth));
    await phone.getByRole('region',{name:'Quick Notes',exact:true}).getByLabel('New quick note').fill('Phone capture\nphone body');await phone.getByRole('button',{name:'Save note',exact:true}).click();
    await phone.getByRole('button',{name:'Open Phone capture',exact:true}).waitFor();
    await phoneContext.close();
    const configBefore=await client.content(installed.configNoteId);
    const notesBefore=(await client.getNote(installed.dataNoteId)).childNoteIds.sort();
    await manager.disable();await page.reload();await page.waitForTimeout(700);
    assert.equal(await page.getByRole('button',{name:'Save note',exact:true}).count(),0);
    const plan=await manager.planUninstall();assert.equal(plan.noteIds.length,6);
    if(process.argv.includes('--allow-test-code-removal')) {
        // VC explicitly authorized removal of these six generated code notes in fresh fixtures only.
        await manager.uninstall(plan.approvalHash, { maintenanceConfirmed: true });
        assert.equal(await client.content(installed.configNoteId),configBefore);
        assert.deepEqual((await client.getNote(installed.dataNoteId)).childNoteIds.sort(),notesBefore);
        const reinstalled=await manager.install();assert.equal(reinstalled.dataNoteId,installed.dataNoteId);assert.equal(reinstalled.hostNoteId,installed.hostNoteId);
        await manager.activate();await page.reload();await page.getByRole('button',{name:'Open Phone capture',exact:true}).waitFor();
        console.log('PASS: real ZIP import -> inert -> explicit activation -> desktop capture/edit/pin/archive/search -> mobile-UA capture at 375px -> disable/reload -> six-code-note uninstall -> retained-state reinstall.');
    } else console.log('PASS: runtime import/activation/features/disable and uninstall preview. Live code removal intentionally skipped.');
    assert.deepEqual(errors,[], 'No frontend runtime errors are expected');
    console.log('Retained synthetic fixture:',dataDir);
} catch(error) {
    console.error('Synthetic runtime frontend errors:', JSON.stringify(errors).replaceAll(ephemeral,'[REDACTED]'));
    if(page) console.error('Synthetic runtime visible state:', (await page.locator('body').innerText()).slice(-3500).replaceAll(ephemeral,'[REDACTED]'));
    const safe=String(error.stack||error).replaceAll(ephemeral,'[REDACTED]');console.error(safe);process.exitCode=1;
} finally {
    if(browser)await browser.close();server.kill('SIGTERM');await delay(250);ephemeral='';
}

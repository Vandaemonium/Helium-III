import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPackage } from '../scripts/build-package.mjs';
const lifeUrl = new URL('../scripts/lifecycle.mjs', import.meta.url);
async function lifecycle() { assert.ok(fs.existsSync(lifeUrl), 'guarded lifecycle implementation must exist'); return import(lifeUrl.href); }
class FixtureGraph {
    constructor() { this.nodes = new Map(); this.counter = 0; this.deleted = []; this.add('root'); this.add('_hidden'); }
    add(id, extra = {}) { const n = { noteId:id, title:id, type:'text', mime:'text/html', attributes:[], childNoteIds:[], parentNoteIds:[], blobId:id, ...extra, noteId:id }; this.nodes.set(id,n); return n; }
    async appInfo() { return { appVersion: '0.107.0' }; }
    async allNotes() { return structuredClone([...this.nodes.values()]); }
    async getNote(id) { assert.ok(this.nodes.has(id), `missing ${id}`); return structuredClone(this.nodes.get(id)); }
    async createNote(data) { const n=this.add(`n${++this.counter}`,data); n.parentNoteIds=[data.parentNoteId]; this.nodes.get(data.parentNoteId).childNoteIds.push(n.noteId); return structuredClone(n); }
    async content(id) { return this.nodes.get(id).content; }
    async createAttribute(data) { const a={...data,attributeId:`a${++this.counter}`,isInheritable:false};this.nodes.get(data.noteId).attributes.push(a);return a; }
    async deleteAttribute(id) { for(const n of this.nodes.values()) n.attributes=n.attributes.filter(a=>a.attributeId!==id); }
    async importPackage(parent) { const {metaFile,entries}=buildPackage(); const files=new Map(entries.map(e=>[e.name,e.content]));
        const walk=async(n,p,prefix='')=>{ const item=await this.createNote({...n,parentNoteId:p,attributes:[],childNoteIds:[],content:files.get(prefix+n.dataFileName)}); for(const a of n.attributes)await this.createAttribute({...a,noteId:item.noteId}); for(const c of n.children||[]) await walk(c,item.noteId,prefix+(n.dirFileName?n.dirFileName+'/':'')); return item; };return walk(metaFile.files[0],parent); }
    async deleteNote(id) { const n=this.nodes.get(id); assert.deepEqual(n.childNoteIds,[], 'delete must never rely on cascading'); for(const p of n.parentNoteIds)this.nodes.get(p).childNoteIds=this.nodes.get(p).childNoteIds.filter(x=>x!==id); this.nodes.delete(id);this.deleted.push(id); }
}
test('incompatible runtime is refused before importing or creating notes', async()=>{
    const {QuickNotesLifecycle}=await lifecycle();const a=new FixtureGraph();a.appInfo=async()=>({appVersion:'0.108.0'});const m=new QuickNotesLifecycle(a);
    await assert.rejects(m.install(),/compatib/i);assert.equal(a.nodes.size,2);
});

test('lifecycle installs inert, activates explicitly and preserves notes through approved code-only removal/reinstall', async()=>{
    const {QuickNotesLifecycle}=await lifecycle(); const a=new FixtureGraph(); const m=new QuickNotesLifecycle(a);
    const installed=await m.install();
    assert.deepEqual(a.nodes.get(installed.codeNoteId).parentNoteIds, ['root'], 'never import into the read-only virtual _hidden root');
    assert.equal(a.nodes.get(installed.hostNoteId).attributes.filter(x=>x.name==='renderNote').length,0);
    await m.activate(); await m.activate();
    assert.equal(a.nodes.get(installed.hostNoteId).attributes.filter(x=>x.name==='renderNote').length,1);
    await a.createNote({parentNoteId:installed.dataNoteId,title:'user data',content:'preserve'});
    const before=await a.content(installed.configNoteId);
    await assert.rejects(m.planUninstall(),/disable/i);
    await m.disable(); const plan=await m.planUninstall(); assert.equal(plan.noteIds.length,6);
    await assert.rejects(m.uninstall('not-consent'),/approval/i); assert.equal(a.deleted.length,0);
    await assert.rejects(m.uninstall(plan.approvalHash),/maintenance/i); assert.equal(a.deleted.length,0);
    await m.uninstall(plan.approvalHash, { maintenanceConfirmed: true });
    assert.equal(a.deleted.length,6); assert.equal(await a.content(installed.configNoteId),before);
    assert.equal(a.nodes.get(installed.dataNoteId).childNoteIds.length,1);
    const reinstalled=await m.install(); assert.equal(reinstalled.hostNoteId,installed.hostNoteId);assert.equal(reinstalled.dataNoteId,installed.dataNoteId);
});
test('uninstall refuses unexpected descendants, shared clones and external references without deleting anything', async()=>{
    const {QuickNotesLifecycle}=await lifecycle();
    for(const kind of ['descendant','clone','reference']) {
        const a=new FixtureGraph(); const m=new QuickNotesLifecycle(a); await m.install();
        const all=await a.allNotes();const code=all.find(n=>n.attributes.some(x=>x.name==='heliumModuleRole'&&x.value==='core'));
        if(kind==='descendant')await a.createNote({parentNoteId:code.noteId,title:'user content'});
        if(kind==='clone')a.nodes.get(code.noteId).parentNoteIds.push('root');
        if(kind==='reference')await a.createAttribute({noteId:'root',type:'relation',name:'template',value:code.noteId});
        await assert.rejects(m.planUninstall(),/unexpected|shared|reference/i);assert.equal(a.deleted.length,0);
    }
});
test('uninstall stops when code content changes after the first deletion', async()=>{
    const {QuickNotesLifecycle}=await lifecycle();const a=new FixtureGraph();const m=new QuickNotesLifecycle(a);await m.install();const plan=await m.planUninstall();
    const remove=a.deleteNote.bind(a);
    a.deleteNote=async id=>{await remove(id);if(a.deleted.length===1)a.nodes.get(plan.noteIds[1]).blobId='concurrent edit';};
    await assert.rejects(m.uninstall(plan.approvalHash, { maintenanceConfirmed: true }),/changed/i);
    assert.equal(a.deleted.length,1);
});

test('changed graph invalidates a previously approved removal plan', async()=>{
    const {QuickNotesLifecycle}=await lifecycle();const a=new FixtureGraph();const m=new QuickNotesLifecycle(a);const installed=await m.install();const plan=await m.planUninstall();
    a.nodes.get(installed.codeNoteId).blobId='modified';await assert.rejects(m.uninstall(plan.approvalHash, { maintenanceConfirmed: true }),/approval/i);assert.equal(a.deleted.length,0);
});

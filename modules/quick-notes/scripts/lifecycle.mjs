import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { buildPackage, manifest } from './build-package.mjs';
const ID = manifest.moduleId;
const own = (note, name) => note.attributes.filter(a => a.noteId === note.noteId && a.type === 'label' && a.name === name);
const label = (note, name) => own(note, name)[0]?.value;
const retainedRole = note => label(note, 'heliumQuickRetained');
const codeRole = note => label(note, 'heliumModuleId') === ID ? label(note, 'heliumModuleRole') : null;
const relations = note => note.attributes.filter(a => a.noteId === note.noteId && a.type === 'relation');

export class EtapiClient {
    constructor(baseUrl, credential) {
        const url = new URL(baseUrl);
        if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname)))) throw new Error('Use HTTPS or a loopback-only test endpoint.');
        if (!credential) throw new Error('ETAPI credential is required in the process environment.');
        this.baseUrl = url.href.replace(/\/$/, ''); this.credential = credential;
    }
    async request(method, route, body, raw = false) {
        const binary = Buffer.isBuffer(body);
        const textContent = route.endsWith('/content') && typeof body === 'string';
        const result = await fetch(`${this.baseUrl}/etapi/${route}`, { method, redirect:'error',
            headers: { Authorization:this.credential, 'Content-Type':binary?'application/zip':textContent?'text/plain':'application/json' },
            body:body===undefined?undefined:binary||textContent?body:JSON.stringify(body) });
        if (!result.ok) {
            const detail = await result.json().catch(() => ({}));
            const code = /^[A-Z_]+$/.test(detail.code || '') ? detail.code : 'UNSPECIFIED';
            throw new Error(`ETAPI ${method} failed (${result.status}, ${code}); no automatic retry was issued.`);
        }
        if (result.status === 204) return null;
        return raw ? result.text() : result.json();
    }
    async appInfo() { return this.request('GET', 'app-info'); }
    async getNote(id) { return this.request('GET',`notes/${encodeURIComponent(id)}`); }
    async content(id) { return this.request('GET',`notes/${encodeURIComponent(id)}/content`,undefined,true); }
    async createNote(data) { return (await this.request('POST','create-note',data)).note; }
    async createAttribute(data) { return this.request('POST','attributes',data); }
    async deleteAttribute(id) { return this.request('DELETE',`attributes/${encodeURIComponent(id)}`); }
    async deleteNote(id) { return this.request('DELETE',`notes/${encodeURIComponent(id)}`); }
    async importPackage(parent) { return (await this.request('POST',`notes/${encodeURIComponent(parent)}/import`,buildPackage().zipBuffer)).note; }
    async allNotes() {
        // No note content is read. Complete graph traversal avoids search limits and hidden/archived omissions.
        const todo = ['root','_hidden'], seen = new Set(), notes = [];
        while (todo.length) { const id = todo.pop(); if(seen.has(id))continue;seen.add(id);
            const note=await this.getNote(id);notes.push(note);todo.push(...note.childNoteIds); }
        return notes;
    }
}
export class QuickNotesLifecycle {
    constructor(adapter) { this.adapter = adapter; }
    async inventory() { return this.adapter.allNotes(); }
    async checkCompatibility() {
        const info = await this.adapter.appInfo();
        if (info.appVersion !== '0.107.0') throw new Error('Incompatible application version; only 0.107.0 is declared.');
    }
    unique(notes, predicate, description, optional=false) {
        const found=notes.filter(predicate);
        if(found.length===0&&optional)return null;
        if(found.length!==1)throw new Error(`Expected one ${description}; found ${found.length}. Resolve duplicates/partial installs manually.`);
        return found[0];
    }
    async install({ codeParentNoteId='root', userParentNoteId='root' }={}) {
        await this.checkCompatibility();
        let all=await this.inventory();
        if(all.some(codeRole))throw new Error('Quick Notes code is already installed; no automatic replacement or deletion is allowed.');
        if(all.some(n=>n.noteId===userParentNoteId&&n.isProtected))throw new Error('Retained parent must be unprotected.');
        const packageRoot=await this.adapter.importPackage(codeParentNoteId);
        all=await this.inventory();
        const ensure=async(role,title,type,mime,content)=>{
            let note=this.unique(all,n=>retainedRole(n)===role,`${role} retained note`,true);
            if(note && (note.type!==type || note.isProtected))throw new Error(`Retained ${role} note has incompatible type/protection.`);
            if(!note){ note=await this.adapter.createNote({ parentNoteId:userParentNoteId,title,type,mime,content });
                await this.adapter.createAttribute({noteId:note.noteId,type:'label',name:'heliumQuickRetained',value:role,isInheritable:false}); }
            return note;
        };
        const data=await ensure('data','Quick Notes — Notes','book','text/html','<p>User-owned Quick Notes. Never delete with the module code.</p>');
        const config=await ensure('config','Quick Notes — Configuration','code','application/json',JSON.stringify({schemaVersion:1,dataNoteId:data.noteId},null,2));
        const current=JSON.parse(await this.adapter.content(config.noteId));
        if(current.schemaVersion!==1||current.dataNoteId!==data.noteId)throw new Error('Retained config mismatch; resolve without overwriting user configuration.');
        const host=await ensure('host','Quick Notes','render','text/html','');
        const panel=this.unique(await this.inventory(),n=>codeRole(n)==='panel','panel code');
        await this.setHostRelation(host.noteId,'heliumQuickConfig',config.noteId);
        await this.setHostRelation(host.noteId,'disabled:renderNote',panel.noteId);
        return {codeNoteId:packageRoot.noteId,dataNoteId:data.noteId,configNoteId:config.noteId,hostNoteId:host.noteId};
    }
    async setHostRelation(hostId,name,target) {
        const host=await this.adapter.getNote(hostId);
        const found=relations(host).filter(a=>a.name===name);
        if(found.some(a=>a.value!==target))throw new Error('Unexpected host relation; refusing to overwrite it.');
        if(found.length===0)await this.adapter.createAttribute({noteId:hostId,type:'relation',name,value:target,isInheritable:false});
        for(const duplicate of found.slice(1))await this.adapter.deleteAttribute(duplicate.attributeId);
    }
    async switchEntry(enabled) {
        const all=await this.inventory();const host=this.unique(all,n=>retainedRole(n)==='host','retained host');
        const panel=this.unique(all,n=>codeRole(n)==='panel','panel code');
        for(const a of relations(host).filter(a=>['renderNote','disabled:renderNote'].includes(a.name))) {
            if(a.value!==panel.noteId)throw new Error('Unexpected host entry reference; refusing to alter it.');
            if(a.name===(enabled?'disabled:renderNote':'renderNote'))await this.adapter.deleteAttribute(a.attributeId);
        }
        await this.setHostRelation(host.noteId,enabled?'renderNote':'disabled:renderNote',panel.noteId);
        return {hostNoteId:host.noteId,active:enabled,reloadRequired:true};
    }
    async activate() { await this.checkCompatibility(); await this.planUninstall({ forActivation: true }); return this.switchEntry(true); }
    async disable() { return this.switchEntry(false); }
    async planUninstall({ forActivation = false } = {}) {
        const all=await this.inventory();const owned=all.filter(codeRole);
        if(owned.length!==manifest.ownedCodeRoles.length)throw new Error('Unexpected or incomplete owned code inventory.');
        const byId=new Map(owned.map(n=>[n.noteId,n]));
        const root=this.unique(owned,n=>codeRole(n)==='root','code root');
        const host=this.unique(all,n=>retainedRole(n)==='host','retained host');
        for(const role of manifest.ownedCodeRoles)this.unique(owned,n=>codeRole(n)===role,`${role} code`);
        for(const n of owned) {
            if(n.isProtected || n.parentNoteIds.length!==1 || (n!==root&&!byId.has(n.parentNoteIds[0])))throw new Error('Unexpected shared/cloned/protected code asset.');
            if(n.childNoteIds.some(id=>!byId.has(id)))throw new Error('Unexpected user descendant under code; nothing can be removed.');
            if(retainedRole(n))throw new Error('Unexpected retained data inside code.');
        }
        const visited=new Set(), order=[];
        const walk=id=>{if(visited.has(id))throw new Error('Unexpected cyclic/shared code graph.');visited.add(id);for(const child of byId.get(id).childNoteIds)walk(child);order.push(id);};walk(root.noteId);
        if(visited.size!==owned.length)throw new Error('Unexpected disconnected code assets.');
        const allowed=[];
        for(const n of all)for(const a of relations(n).filter(a=>byId.has(a.value))) {
            if(a.name==='renderNote') {
                if(forActivation && n.noteId===host.noteId && codeRole(byId.get(a.value))==='panel') continue;
                throw new Error('Disable and reload Quick Notes before planning removal.');
            }
            if(n.noteId===host.noteId&&a.name==='disabled:renderNote'&&codeRole(byId.get(a.value))==='panel')allowed.push(a.attributeId);
            else throw new Error('Unexpected external reference to module code; nothing can be removed.');
        }
        const snapshot=owned.map(n=>({id:n.noteId,blob:n.blobId,title:n.title,type:n.type,mime:n.mime,parents:n.parentNoteIds,children:n.childNoteIds,attributes:n.attributes})).sort((a,b)=>a.id.localeCompare(b.id));
        const approvalHash=createHash('sha256').update(JSON.stringify({snapshot,hostId:host.noteId,allowed})).digest('hex');
        const plan = {moduleId:ID,noteIds:order,hostNoteId:host.noteId,relationIds:allowed,approvalHash,retained:'All user notes, data folder, configuration and host are retained.'};
        Object.defineProperty(plan, 'expected', { value: new Map(owned.map(note => [note.noteId, note])) });
        return plan;
    }
    async uninstall(approvalHash, { maintenanceConfirmed = false } = {}) {
        const plan=await this.planUninstall();
        if(!approvalHash||approvalHash!==plan.approvalHash)throw new Error('Explicit approval of the current removal plan is required.');
        if(!maintenanceConfirmed)throw new Error('Exclusive maintenance confirmation is required; stop editing/sync peers first. ETAPI has no atomic graph lock.');
        for(const id of plan.relationIds)await this.adapter.deleteAttribute(id);
        // Recheck each leaf before deletion; this is not an atomic server-side graph lock.
        // The operator must keep editing/sync peers quiescent during this maintenance operation.
        for(const id of plan.noteIds) {
            const all=await this.inventory(), note=all.find(n=>n.noteId===id);
            const expected = plan.expected.get(id);
            if(!note||!codeRole(note)||note.childNoteIds.length||note.parentNoteIds.length!==1)throw new Error('Unexpected graph change; removal stopped.');
            for (const key of ['blobId','title','type','mime','parentNoteIds','attributes']) {
                if (JSON.stringify(note[key]) !== JSON.stringify(expected[key])) throw new Error('Code asset changed after approval; removal stopped.');
            }
            if(all.some(n=>relations(n).some(a=>a.value===id)))throw new Error('New reference detected; removal stopped.');
            await this.adapter.deleteNote(id);
        }
        return {removedNoteIds:plan.noteIds,retained:plan.retained};
    }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
    try {
        const [command,approvalHash]=process.argv.slice(2);
        if(!['install','activate','disable','preview-uninstall','uninstall'].includes(command))throw new Error('Commands: install | activate | disable | preview-uninstall | uninstall <approved-plan-sha256> --maintenance-confirmed.');
        const m=new QuickNotesLifecycle(new EtapiClient(process.env.HELIUM_URL,process.env.HELIUM_ETAPI_TOKEN));
        const result=command==='preview-uninstall'?await m.planUninstall():command==='uninstall'?await m.uninstall(approvalHash, { maintenanceConfirmed: process.argv.includes('--maintenance-confirmed') }):await m[command]();
        console.log(JSON.stringify(result,null,2));
    }catch(error){console.error(error.message);process.exitCode=1;}
}

const { createFrontendStore } = require('QuickNotesAdapter');
const { QuickNotesController, selectCards } = require('QuickNotesCore');
const { mount } = require('QuickNotesView');
const host = api.originEntity;
const configNoteId = host?.getRelationValue('heliumQuickConfig');
if (!configNoteId) throw new Error('Quick Notes host configuration is missing. Run the lifecycle install step.');
const configNote = await api.getNote(configNoteId);
if (!configNote || configNote.isProtected) throw new Error('Quick Notes config unavailable.');
const config = await configNote.getJsonContent();
if (config?.schemaVersion !== 1) throw new Error('Unsupported Quick Notes configuration schema.');
const store = createFrontendStore(api, config);
// In-memory only: preserve unsaved drafts across native navigation; no localStorage/offline cache.
const key = Symbol.for('empyrean.quick-notes.controllers');
const controllers = globalThis[key] ||= new Map();
let controller = controllers.get(configNoteId);
if (!controller) { controller = new QuickNotesController(store); controllers.set(configNoteId, controller); }
else controller.store = store;
const root = document.createElement('div');
api.$container[0].append(root);
await mount(root, { store, controller, selectCards });

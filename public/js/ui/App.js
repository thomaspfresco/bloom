// @ts-check
// Composition root: builds the session, audio, generator, scene and UI, and wires them together.

import { Generator } from '../ai/Generator.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { Session } from '../model/Session.js';
import { SessionStorage } from '../persistence/SessionStorage.js';
import { Anchors } from '../scene/core/anchors.js';
import { Handoff } from '../scene/core/handoff.js';
import { BloomScene } from '../scene/core/BloomScene.js';
import { Backdrop } from '../scene/layers/Backdrop.js';
import { DrawerLayer } from '../scene/layers/DrawerLayer.js';
import { LoopLayer } from '../scene/layers/LoopLayer.js';
import { StructLayer } from '../scene/layers/StructLayer.js';
import { PetalFlow } from '../scene/layers/PetalFlow.js';
import { Actions } from './Actions.js';
import { DragController } from './controllers/DragController.js';
import { Fades } from './controllers/Fades.js';
import { GenerateController } from './controllers/GenerateController.js';
import { Keyboard } from './controllers/Keyboard.js';
import { NoteEditing } from './controllers/NoteEditing.js';
import { PlayInput } from './controllers/PlayInput.js';
import { RecordController } from './controllers/RecordController.js';
import { MidiInput } from '../audio/MidiInput.js';
import { Blackouts } from './components/Blackouts.js';
import { Busy } from './components/Busy.js';
import { Drawers } from './components/Drawers.js';
import { HomeView } from './components/HomeView.js';
import { LoopView } from './components/LoopView.js';
import { MenuHost } from './components/MenuHost.js';
import { StructView } from './components/StructView.js';
import { Toast } from './components/Toast.js';
import { TopBar } from './components/TopBar.js';
import { UiState } from './state/UiState.js';

/** @typedef {import('./context.js').UiContext} UiContext */

export class App {
  /**
   * @param {{canvas: HTMLCanvasElement, root: HTMLElement, forceWebGL?: boolean}} opts
   */
  static async start({ canvas, root, forceWebGL = false }) {
    const session = new Session();
    const storage = new SessionStorage(session);
    const loaded = storage.load();
    storage.startAutosave();

    const scene = await BloomScene.create(canvas, { forceWebGL });
    const engine = new AudioEngine();
    const generator = new Generator();
    const ui = new UiState();
    const anchors = new Anchors();
    const handoff = new Handoff();
    const toast = new Toast(root);
    storage.onSaved = () => { // like the original's log line
      const d = new Date();
      toast.show(`Session saved at ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}.`, 3000);
    };
    const fades = new Fades();
    const actions = new Actions({ session, ui, engine, toast, storage, fades });

    /** @type {UiContext} */
    const ctx = /** @type {any} */ ({ session, ui, engine, generator, actions, anchors, handoff, toast, fades, menus: null });

    const menus = new MenuHost(ctx);
    ctx.menus = menus;
    ctx.notes = new NoteEditing(ctx);
    ctx.generate = new GenerateController(ctx);
    ctx.drag = new DragController(ctx);
    ctx.record = new RecordController(ctx);
    ctx.playInput = new PlayInput(ctx);
    new Keyboard(ctx, ctx.playInput);
    const midi = new MidiInput();
    midi.on('noteOn', ({ pitch, octave }) => ctx.playInput.noteOn(pitch, octave));
    midi.on('noteOff', ({ pitch, octave }) => ctx.playInput.noteOff(pitch, octave));
    midi.on('device', ({ connected }) => toast.show(connected ? 'MIDI device connected.' : 'MIDI device disconnected.'));
    midi.start();
    const components = [new HomeView(ctx), new LoopView(ctx), new StructView(ctx), new Drawers(ctx), new Blackouts(ctx), new TopBar(ctx), menus, new Busy(ctx)];
    for (const c of components) c.mount(root);

    // scene layers
    const petals = new PetalFlow();
    scene.add(new Backdrop());
    scene.add(petals);
    scene.add(new LoopLayer(ctx));
    scene.add(new StructLayer(ctx));
    scene.add(new DrawerLayer(ctx));
    const syncScene = () => { petals.visible = session.active === null; };
    session.on('change', syncScene);
    syncScene();

    // audio -> UI state
    engine.on('tick', (t) => ui.set({ playing: true, step: t.step, sectionIndex: t.sectionIndex, repeat: t.repeat }));
    engine.on('stop', () => ui.set({ playing: false, step: -1 }));

    // browsers require a gesture before audio can start
    const unlock = () => { actions.unlockAudio(); };
    for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, unlock, { once: true, capture: true });

    scene.run();
    if (loaded.message && loaded.status !== 'loaded' && loaded.status !== 'empty') toast.show(loaded.message, 6000);

    return new App(ctx, scene, components);
  }

  /**
   * @private use `App.start`
   * @param {UiContext} ctx @param {BloomScene} scene @param {import('./Component.js').Component[]} components
   */
  constructor(ctx, scene, components) {
    this.ctx = ctx;
    this.scene = scene;
    this.components = components;
  }
}

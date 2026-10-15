import { action, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { media } from "../media/backend.js";

// Krátký stisk = STEP %, držení = po HOLD_DELAY ms opakuje HOLD_STEP % každých HOLD_INTERVAL ms
const STEP = 10;
const HOLD_DELAY = 400;
const HOLD_STEP = 3;
const HOLD_INTERVAL = 100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clamp = (n: number) => Math.max(0, Math.min(100, n));

async function flash(ev: any, text: string, ms = 1500): Promise<void> {
    await ev.action.setTitle(text);
    setTimeout(() => ev.action.setTitle(""), ms);
}

/** Hlasitost se stiskem i držením. Stav podle tlačítka (action.id). */
class VolumeRamp {
    private held = new Map<string, boolean>();
    private clearTimers = new Map<string, NodeJS.Timeout>();

    constructor(private direction: 1 | -1) {}

    async down(ev: any): Promise<void> {
        const id: string = ev.action.id;
        if (this.held.get(id)) return;
        // nastavit hned (synchronně), aby rychlý keyUp nepřišel dřív a smyčka neutekla
        this.held.set(id, true);
        const t = this.clearTimers.get(id);
        if (t) clearTimeout(t);

        const m = await media();
        let pct = await m.getVolume();
        if (pct === null) {
            this.held.set(id, false);
            return flash(ev, "⚠️", 2000);
        }

        pct = await this.apply(ev, pct, STEP);

        const start = Date.now();
        while (this.held.get(id) && Date.now() - start < HOLD_DELAY) await sleep(20);
        while (this.held.get(id)) {
            if ((this.direction > 0 && pct >= 100) || (this.direction < 0 && pct <= 0)) break;
            pct = await this.apply(ev, pct, HOLD_STEP);
            await sleep(HOLD_INTERVAL);
        }
    }

    up(ev: any): void {
        const id: string = ev.action.id;
        this.held.set(id, false);
        this.clearTimers.set(id, setTimeout(() => ev.action.setTitle(""), 1500));
    }

    private async apply(ev: any, pct: number, step: number): Promise<number> {
        const next = clamp(pct + this.direction * step);
        const ok = await (await media()).setVolume(next);
        if (!ok) {
            await ev.action.setTitle("⚠️");
            return pct;
        }
        await ev.action.setTitle(`${next}%`);
        return next;
    }
}

// === VOLUME UP ===
@action({ UUID: "com.darkmatterdavson.spotify-free-smtc.volumeup" })
export class VolumeUpAction extends SingletonAction {
    private ramp = new VolumeRamp(1);
    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        await this.ramp.down(ev);
    }
    override onKeyUp(ev: KeyUpEvent): void {
        this.ramp.up(ev);
    }
}

// === VOLUME DOWN ===
@action({ UUID: "com.darkmatterdavson.spotify-free-smtc.volumedown" })
export class VolumeDownAction extends SingletonAction {
    private ramp = new VolumeRamp(-1);
    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        await this.ramp.down(ev);
    }
    override onKeyUp(ev: KeyUpEvent): void {
        this.ramp.up(ev);
    }
}

// === MUTE (přepínač, ikona = skutečný stav, titulek = aktuální hlasitost) ===
@action({ UUID: "com.darkmatterdavson.spotify-free-smtc.mute" })
export class MuteAction extends SingletonAction {
    private interval: NodeJS.Timeout | null = null;
    private lastTitle: string | null = null;

    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        this.lastTitle = null;
        await this.sync(ev);
        if (!this.interval) this.interval = setInterval(() => this.sync(ev), 1500);
    }

    override async onWillDisappear(_ev: WillDisappearEvent): Promise<void> {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        const ok = await (await media()).toggleMute();
        if (!ok) return flash(ev, "⚠️", 2000);
        await this.sync(ev);
    }

    private async sync(ev: any): Promise<void> {
        try {
            const m = await media();
            const [muted, pct] = await Promise.all([m.getMuted(), m.getVolume()]);
            if (muted !== null) await ev.action.setState(muted ? 1 : 0);
            const title = pct === null ? "" : `${pct}%`;
            if (title !== this.lastTitle) {
                this.lastTitle = title;
                await ev.action.setTitle(title);
            }
        } catch (err) {
            console.error("[Mute] chyba:", err);
        }
    }
}

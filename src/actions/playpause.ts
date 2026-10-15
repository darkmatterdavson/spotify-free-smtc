import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { media } from "../media/backend.js";

@action({ UUID: "com.darkmatterdavson.spotify-free-smtc.playpause" })
export class PlayPauseAction extends SingletonAction {
    private interval: NodeJS.Timeout | null = null;

    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        await this.updateState(ev);
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.updateState(ev), 1500);
    }

    override async onWillDisappear(_ev: WillDisappearEvent): Promise<void> {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    override async onKeyDown(ev: KeyDownEvent): Promise<void> {
        await (await media()).playPause();
        setTimeout(() => this.updateState(ev), 300);
    }

    private async updateState(ev: any): Promise<void> {
        try {
            const playing = await (await media()).isPlaying();
            if (playing === null) return;
            await ev.action.setState(playing ? 1 : 0);
        } catch (err) {
            console.error("[PlayPause] chyba:", err);
        }
    }
}

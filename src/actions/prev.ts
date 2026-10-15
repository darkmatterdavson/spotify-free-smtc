import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { media } from "../media/backend.js";

@action({ UUID: "com.darkmatterdavson.spotify-free-smtc.prev" })
export class PrevAction extends SingletonAction {
    override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
        await (await media()).previous();
    }
}

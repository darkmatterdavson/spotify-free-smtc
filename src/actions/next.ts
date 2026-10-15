import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { media } from "../media/backend.js";

@action({ UUID: "com.darkmatterdavson.spotify-free-smtc.next" })
export class NextAction extends SingletonAction {
    override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
        await (await media()).next();
    }
}

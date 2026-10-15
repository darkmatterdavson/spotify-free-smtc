import { execFile } from "node:child_process";
import type { MediaBackend } from "./backend.js";

/**
 * Linux: přehrávání přes MPRIS (playerctl), hlasitost přes PulseAudio/PipeWire (pactl).
 * Potřebuje: playerctl, pactl (balíček pulseaudio-utils / pipewire-pulse).
 */

const PLAYER = "spotify";

function run(cmd: string, args: string[]): Promise<{ ok: boolean; stdout: string }> {
    return new Promise((resolve) => {
        execFile(cmd, args, { timeout: 5000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
            resolve({ ok: !err, stdout: String(stdout ?? "") });
        });
    });
}

const playerctl = (...args: string[]) => run("playerctl", ["-p", PLAYER, ...args]);

export type SinkInput = { index: number; volume: number; muted: boolean };

const isSpotify = (props: Record<string, string>) =>
    /spotify/i.test(props["application.process.binary"] ?? "") ||
    /spotify/i.test(props["application.name"] ?? "");

/** pactl -f json (PipeWire / PulseAudio 16+) */
export function parseJson(stdout: string): SinkInput[] {
    const list = JSON.parse(stdout) as any[];
    return list
        .filter((s) => isSpotify(s.properties ?? {}))
        .map((s) => {
            const ch = Object.values(s.volume ?? {}) as any[];
            const pcts = ch.map((c) => parseInt(String(c.value_percent), 10)).filter(Number.isFinite);
            return {
                index: Number(s.index),
                volume: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0,
                muted: !!s.mute,
            };
        });
}

/** Fallback: textový výstup `pactl list sink-inputs` (starší PulseAudio). */
export function parseText(stdout: string): SinkInput[] {
    return stdout
        .split(/^Sink Input #/m)
        .slice(1)
        .map((block) => {
            const props: Record<string, string> = {};
            for (const m of block.matchAll(/^\s*([\w.]+) = "(.*)"$/gm)) props[m[1]] = m[2];
            const vol = block.match(/^\s*Volume:(.*)$/m)?.[1] ?? "";
            const pcts = [...vol.matchAll(/(\d+)%/g)].map((m) => parseInt(m[1], 10));
            return {
                props,
                input: {
                    index: parseInt(block, 10),
                    volume: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0,
                    muted: /^\s*Mute: yes$/m.test(block),
                },
            };
        })
        .filter((x) => isSpotify(x.props))
        .map((x) => x.input);
}

async function spotifyInputs(): Promise<SinkInput[]> {
    const json = await run("pactl", ["-f", "json", "list", "sink-inputs"]);
    if (json.ok) {
        try {
            return parseJson(json.stdout);
        } catch {
            /* fallback níže */
        }
    }
    const text = await run("pactl", ["list", "sink-inputs"]);
    return text.ok ? parseText(text.stdout) : [];
}

const linux: MediaBackend = {
    name: "linux",

    playPause: () => playerctl("play-pause").then(() => undefined),
    next: () => playerctl("next").then(() => undefined),
    previous: () => playerctl("previous").then(() => undefined),

    async isPlaying() {
        const r = await playerctl("status");
        if (!r.ok) return null;
        const s = r.stdout.trim().toLowerCase();
        if (s === "playing") return true;
        if (s === "paused" || s === "stopped") return false;
        return null;
    },

    async getVolume() {
        const inputs = await spotifyInputs();
        return inputs.length ? inputs[0].volume : null;
    },

    async setVolume(percent) {
        const inputs = await spotifyInputs();
        if (!inputs.length) return false;
        const res = await Promise.all(
            inputs.map((i) => run("pactl", ["set-sink-input-volume", String(i.index), `${percent}%`]))
        );
        return res.every((r) => r.ok);
    },

    async getMuted() {
        const inputs = await spotifyInputs();
        return inputs.length ? inputs[0].muted : null;
    },

    async toggleMute() {
        const inputs = await spotifyInputs();
        if (!inputs.length) return false;
        const target = inputs[0].muted ? "0" : "1";
        const res = await Promise.all(
            inputs.map((i) => run("pactl", ["set-sink-input-mute", String(i.index), target]))
        );
        return res.every((r) => r.ok);
    },
};

export default linux;

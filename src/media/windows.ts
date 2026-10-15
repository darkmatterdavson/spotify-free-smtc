import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { togglePlayPause, next, previous } from "win-media-control";
import { getActiveSessions } from "windows-media-sessions";
import type { MediaBackend } from "./backend.js";

/**
 * Windows: přehrávání přes SMTC, hlasitost přes NirSoft svcl.exe.
 * svcl.exe patří do: <plugin>.sdPlugin/svcl/svcl.exe
 */

const TARGET = "Spotify.exe";

function findSvcl(): string {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
        path.resolve(here, "..", "..", "svcl", "svcl.exe"), // bin/media/windows.js
        path.resolve(process.cwd(), "svcl", "svcl.exe"),
    ];
    return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

const SVCL = findSvcl();

function svcl(...args: string[]): Promise<{ ok: boolean; stdout: string }> {
    return new Promise((resolve) => {
        if (!existsSync(SVCL)) return resolve({ ok: false, stdout: "" });
        execFile(SVCL, args, { windowsHide: true, timeout: 5000 }, (err, stdout) => {
            // Get* příkazy vracejí hodnotu i v exit kódu -> nenulový kód není chyba
            const spawnFailed = !!err && typeof (err as any).code !== "number";
            resolve({ ok: !spawnFailed, stdout: String(stdout ?? "").trim() });
        });
    });
}

const windows: MediaBackend = {
    name: "windows",

    playPause: () => togglePlayPause("Spotify").then(() => undefined),
    next: () => next("Spotify").then(() => undefined),
    previous: () => previous("Spotify").then(() => undefined),

    async isPlaying() {
        const sessions = await getActiveSessions();
        const s = sessions.find((x: any) => x.sourceAppDisplayName?.toLowerCase().includes("spotify"));
        if (!s) return null;
        const status = String(s.playbackStatus).toLowerCase();
        return status === "playing" || status === "4";
    },

    async getVolume() {
        const r = await svcl("/Stdout", "/GetPercent", TARGET);
        if (!r.ok) return null;
        const n = parseFloat(r.stdout.replace(",", "."));
        return Number.isFinite(n) ? Math.round(n) : null;
    },

    async setVolume(percent) {
        return (await svcl("/SetVolume", TARGET, String(percent))).ok;
    },

    async getMuted() {
        const r = await svcl("/Stdout", "/GetMute", TARGET);
        if (!r.ok) return null;
        if (r.stdout === "1") return true;
        if (r.stdout === "0") return false;
        return null;
    },

    async toggleMute() {
        return (await svcl("/Switch", TARGET)).ok;
    },
};

export default windows;

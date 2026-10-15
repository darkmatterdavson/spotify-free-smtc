/** Společné rozhraní pro ovládání Spotify na jednotlivých OS. */
export interface MediaBackend {
    readonly name: string;
    playPause(): Promise<void>;
    next(): Promise<void>;
    previous(): Promise<void>;
    /** true = hraje, false = pauza, null = Spotify nenalezeno */
    isPlaying(): Promise<boolean | null>;
    /** 0–100, null = Spotify nemá audio stream */
    getVolume(): Promise<number | null>;
    setVolume(percent: number): Promise<boolean>;
    getMuted(): Promise<boolean | null>;
    toggleMute(): Promise<boolean>;
}

let backend: Promise<MediaBackend> | null = null;

/** Načte backend podle OS (dynamický import -> Windows balíčky se na Linuxu vůbec nenačtou). */
export function media(): Promise<MediaBackend> {
    if (!backend) {
        switch (process.platform) {
            case "win32":
                backend = import("./windows.js").then((m) => m.default);
                break;
            case "linux":
                backend = import("./linux.js").then((m) => m.default);
                break;
            default:
                backend = Promise.reject(new Error(`Unsupported platform: ${process.platform}`));
        }
    }
    return backend;
}

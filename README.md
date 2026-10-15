# Spotify Free SMTC – Stream Deck Plugin

Control the Spotify desktop app from your Elgato Stream Deck — **no Spotify Premium, no Web API, no login**.

Works on **Windows** (Elgato Stream Deck app) and, experimentally, on **Linux** ([OpenDeck](https://github.com/nekename/OpenDeck)).

> ⚠️ **Linux support is experimental.** It has been tested against simulated `playerctl`/`pactl`, but not yet with real Spotify in OpenDeck. Reports are welcome — please [open an issue](../../issues) with your distro, OpenDeck version and how Spotify is installed (deb/snap/Flatpak).

The plugin talks to the OS directly: on Windows through the media session (SMTC) and the per-app volume mixer, on Linux through MPRIS (`playerctl`) and PulseAudio/PipeWire (`pactl`). Nothing is injected into Spotify and no keystrokes are sent, so it never steals focus from your game and doesn't touch anti-cheat.

> Not affiliated with or endorsed by Spotify or Elgato. "Spotify" is a trademark of Spotify AB.

## Features

| Action | What it does |
|---|---|
| **Play / Pause** | Toggles playback. The key icon follows the real play/pause state. |
| **Next Track** | Skips to the next track. |
| **Previous Track** | Goes to the previous track. |
| **Volume Up** | Tap: +10 %. Hold: +3 % every 100 ms. Shows the current volume on the key. |
| **Volume Down** | Tap: −10 %. Hold: −3 % every 100 ms. Shows the current volume on the key. |
| **Mute** | Toggles mute for Spotify only. The icon shows the real mute state and the key shows the current volume. |

Volume is Spotify's per-app volume in the OS mixer (Windows Volume Mixer / PulseAudio sink input), not the slider inside the Spotify app.

## Requirements

**Windows**
- Windows 10 or 11 (x64)
- Stream Deck software 7.1 or newer
- Spotify desktop app (Free or Premium)

**Linux (experimental)**
- [OpenDeck](https://github.com/nekename/OpenDeck) with native Node.js installed (the Flatpak Node isn't supported)
- `playerctl`
- `pactl`: `pulseaudio-utils` on Debian/Ubuntu, `libpulse` on Arch/Fedora; works with PipeWire via `pipewire-pulse`
- Spotify desktop app (deb, snap or Flatpak)

```bash
# Debian / Ubuntu
sudo apt install playerctl pulseaudio-utils nodejs
# Arch
sudo pacman -S playerctl libpulse nodejs
# Fedora
sudo dnf install playerctl pulseaudio-utils nodejs
```

## Installation

Download the build for your OS from [Releases](../../releases):

| OS | File |
|---|---|
| Windows | `com.darkmatterdavson.spotify-free-smtc_windowsbuild.streamDeckPlugin` |
| Linux (experimental) | `com.darkmatterdavson.spotify-free-smtc_linuxbuild.streamDeckPlugin` |

- **Windows:** double-click the file. Stream Deck installs it; confirm replacing an older version if asked.
- **Linux (OpenDeck):** install the `.streamDeckPlugin` file from OpenDeck's plugin manager.

The actions are listed under the **Spotify Free SMTC** category.

## Building from source

```bash
git clone https://github.com/<your-user>/spotify-free-smtc.git
cd spotify-free-smtc
npm install
npm run build        # tsc -> ./bin
```

On Linux, `npm install` skips the Windows-only packages automatically (they're `optionalDependencies`).

The plugin runs from the TypeScript output in `bin/` and loads its dependencies from `node_modules/`. **Don't bundle it with rollup.** `win-media-control` and `windows-media-sessions` need their PowerShell scripts and backend `.exe` next to them in `node_modules/`.

### Running your build

Copy these into `%APPDATA%\Elgato\StreamDeck\Plugins\com.darkmatterdavson.spotify-free-smtc.sdPlugin\`:

- `bin/` (the build output)
- `node_modules/` (production dependencies)
- `package.json`
- everything from `com.darkmatterdavson.spotify-free-smtc.sdPlugin/`: `manifest.json`, `imgs/`, `svcl/`

Then restart Stream Deck. Logs are written to `logs/` inside the plugin folder.

### Packaging

A `.streamDeckPlugin` file is a ZIP archive with the `com.darkmatterdavson.spotify-free-smtc.sdPlugin/` folder at its root, renamed to `.streamDeckPlugin`. You can also use Elgato's CLI: `npx @elgato/cli pack`.

## Project structure

```
spotify-free-smtc/
├─ src/
│  ├─ plugin.ts              # registers actions, connects to Stream Deck
│  └─ actions/
│     ├─ playpause.ts        # SMTC play/pause + state polling
│     ├─ next.ts / prev.ts   # SMTC next / previous
│     └─ volume.ts           # volume up/down (tap + hold), mute
│  └─ media/
│     ├─ backend.ts          # common interface, picks backend per OS
│     ├─ windows.ts          # SMTC + svcl.exe
│     └─ linux.ts            # playerctl + pactl
├─ com.darkmatterdavson.spotify-free-smtc.sdPlugin/
│  ├─ manifest.json
│  ├─ manifest.linux.json    # OpenDeck override for Linux
│  ├─ imgs/                  # key and plugin icons
│  └─ svcl/svcl.exe          # NirSoft SoundVolumeCommandLine (Windows only)
├─ package.json
└─ tsconfig.json
```

## How it works

All actions talk to a small `MediaBackend` interface (`src/media/backend.ts`). The right implementation is loaded at runtime with a dynamic import, so the Windows packages are never loaded on Linux.

### Windows

- **Playback**: [`win-media-control`](https://www.npmjs.com/package/win-media-control) sends play/pause/next/previous to the Spotify session through Windows' `GlobalSystemMediaTransportControls`. [`windows-media-sessions`](https://www.npmjs.com/package/windows-media-sessions) reads the playback state for the Play/Pause icon.
- **Volume**: [svcl.exe](https://www.nirsoft.net/utils/sound_volume_command_line.html) (NirSoft) reads and sets the per-app volume and mute of `Spotify.exe`. It runs hidden, with no window flash.

### Linux (experimental)

- **Playback**: `playerctl -p spotify play-pause | next | previous | status` (MPRIS over D-Bus).
- **Volume / mute**: `pactl` finds Spotify's sink input(s) by `application.process.binary` / `application.name`, then uses `set-sink-input-volume` and `set-sink-input-mute`. It reads JSON output (`pactl -f json`) when available and falls back to parsing the text output on older PulseAudio. Other apps are never touched.

## Tuning

You can change the volume step values at the top of `src/actions/volume.ts`:

```ts
const STEP = 10;           // % per tap
const HOLD_DELAY = 400;    // ms before hold-repeat starts
const HOLD_STEP = 3;       // % per repeat while held
const HOLD_INTERVAL = 100; // ms between repeats
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Windows: volume keys show `⚠️` | Check that `svcl/svcl.exe` is in the plugin folder. |
| Key shows `⚠️` | Spotify isn't running or hasn't played anything yet, so it has no audio session. Start playback once. |
| Volume changes but Spotify's slider doesn't move | That's expected. The plugin controls the Windows mixer, not the in-app slider. |
| Play/Pause icon doesn't update | Windows: make sure Spotify shows up in the media flyout. Linux: check `playerctl -p spotify status`. |
| Linux: volume keys show `⚠️` | Check `pactl list sink-inputs` while Spotify is playing. `pactl` must be installed and Spotify must be outputting audio. |

## Roadmap

- [x] Linux build (OpenDeck, MPRIS via `playerctl`, volume via `pactl`) — *experimental*
- [ ] Linux: verified on real hardware (Ubuntu, Arch, Fedora; deb / snap / Flatpak Spotify)
- [ ] macOS build (AppleScript)
- [ ] Like / save current track (needs Premium for the Web API, or Spicetify)

## Credits

- [NirSoft SoundVolumeCommandLine (svcl)](https://www.nirsoft.net/utils/sound_volume_command_line.html) by Nir Sofer. Freeware, redistributed unmodified.
- [Elgato Stream Deck SDK](https://docs.elgato.com/streamdeck/sdk/)

## License

MIT. See [LICENSE](LICENSE). `svcl.exe` is third-party freeware under NirSoft's own license.

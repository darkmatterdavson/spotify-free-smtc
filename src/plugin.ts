import streamDeck from "@elgato/streamdeck";

import { PlayPauseAction } from "./actions/playpause.js";
import { NextAction } from "./actions/next.js";
import { PrevAction } from "./actions/prev.js";
import { VolumeUpAction, VolumeDownAction, MuteAction } from "./actions/volume.js";

streamDeck.logger.setLevel("trace");

streamDeck.actions.registerAction(new PlayPauseAction());
streamDeck.actions.registerAction(new NextAction());
streamDeck.actions.registerAction(new PrevAction());
streamDeck.actions.registerAction(new VolumeUpAction());
streamDeck.actions.registerAction(new VolumeDownAction());
streamDeck.actions.registerAction(new MuteAction());

// Připoj se
await streamDeck.connect();
---
title: How to build a realtime audio session — TypeScript client how-to
sidebar_label: How to build a realtime audio session
description: Step-by-step guide to capturing microphone audio, streaming it to a live agent with client.realtime(), and playing the agent's PCM16 reply back in the browser.
keywords:
  - agentflow typescript client
  - realtime audio
  - voice agent
  - websocket audio
  - agentflow
  - python ai agent framework
  - how to build a realtime audio session
sidebar_position: 9
---


# How to build a realtime audio session

`client.realtime()` gives you a bidirectional audio socket to a live agent. It is transport only: it moves PCM16 bytes and JSON events, and deliberately ships no microphone or speaker code, so the browser side is yours to write. This guide is that missing half — capture the mic, send it, play the reply.

For the full API surface of `RealtimeSession` (every event channel, the reconnect policy, the init fields) see [`reference/client/realtime`](../../reference/client/realtime.md).

## Prerequisites

- A graph rooted at a `LiveAgent`. A turn-based graph rejects the connection: the server sends a fatal `error` event with `code: 'not_live'` and closes with code `1008`. Check `info.is_realtime` from `client.graph()` before offering an audio UI.
- A configured `AgentFlowClient`. On Node 18 or 20, pass `webSocketImpl` (see [how-to/client/create-client](create-client.md)); browsers need nothing.
- A secure context. `getUserMedia` requires HTTPS or `localhost`.

## The audio contract

| Direction | Format |
|---|---|
| Up, via `sendAudio()` | PCM16, mono, **16 kHz** |
| Down, on the `'audio'` channel | PCM16, mono, **24 kHz** |

The two rates differ, and getting them backwards produces audio that plays at the wrong speed rather than an error. The package exports `REALTIME_INPUT_SAMPLE_RATE` (16000) and `REALTIME_OUTPUT_SAMPLE_RATE` (24000) — use them rather than literals.

---

## Step 1: Build a PCM16 player

Model audio arrives as a stream of small frames. Playing each one with a fresh `AudioBufferSourceNode` starting "now" leaves audible gaps, so schedule each frame at the end of the previous one:

```js
export const createPcmPlayer = (defaultSampleRate = 24000) => {
  let context = null;
  let nextTime = 0;

  const ensureContext = () => {
    if (!context) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      context = new Ctor();
    }
    if (context.state === 'suspended') context.resume();
    return context;
  };

  return {
    play: (pcmBytes, sampleRate = defaultSampleRate) => {
      if (!pcmBytes || pcmBytes.byteLength < 2) return;
      const c = ensureContext();
      const frames = Math.floor(pcmBytes.byteLength / 2);
      const view = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength);

      const buffer = c.createBuffer(1, frames, sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) {
        channel[i] = view.getInt16(i * 2, true) / 32768;   // little-endian
      }

      const source = c.createBufferSource();
      source.buffer = buffer;
      source.connect(c.destination);

      const startAt = Math.max(c.currentTime, nextTime);
      source.start(startAt);
      nextTime = startAt + buffer.duration;
    },

    close: () => {
      if (context) {
        try { context.close(); } catch { /* already closed */ }
        context = null;
        nextTime = 0;
      }
    },
  };
};
```

Two details matter. `getInt16(offset, true)` reads little-endian, which is what the server sends. And `nextTime` is what keeps the frames butted together; without it playback stutters.

Construct the player from a user gesture. Browsers start an `AudioContext` suspended until a click or tap, so building it inside the "Start" handler avoids silent playback.

---

## Step 2: Capture the microphone as PCM16 at 16 kHz

Ask the browser for a 16 kHz `AudioContext` and it resamples the mic for you, so you never write a resampler:

```js
export const createMicCapture = async (onFrame, sampleRate = 16000) => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });

  const Ctor = window.AudioContext || window.webkitAudioContext;
  const context = new Ctor({ sampleRate });
  if (context.state === 'suspended') await context.resume();

  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);

  // Route through a muted gain node so onaudioprocess keeps firing without
  // echoing the microphone back out of the speakers.
  const sink = context.createGain();
  sink.gain.value = 0;

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);   // Float32, -1..1
    const pcm = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      pcm[i] = s < 0 ? s * 32768 : s * 32767;
    }
    onFrame(new Uint8Array(pcm.buffer));
  };

  source.connect(processor);
  processor.connect(sink);
  sink.connect(context.destination);

  return {
    stop: () => {
      try {
        processor.disconnect();
        source.disconnect();
        sink.disconnect();
      } catch { /* already torn down */ }
      stream.getTracks().forEach((t) => t.stop());
      try { context.close(); } catch { /* already closed */ }
    },
  };
};
```

`echoCancellation: true` is doing real work here: without it the agent hears its own voice through your speakers and interrupts itself.

`createScriptProcessor` is deprecated but universally supported. An `AudioWorklet` is the modern replacement and worth the extra build step in production; the frame conversion is identical either way.

Always keep the returned handle. Failing to call `stop()` leaves the mic indicator on after the session ends.

---

## Step 3: Open the session

```ts
import { AgentFlowClient } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  authToken: token,
});

let player = createPcmPlayer();              // built inside the click handler

const session = client.realtime(
  { model: 'gemini-2.5-flash-live', modalities: 'AUDIO' },
  { reconnect: { enabled: false } },
);

session.on('open', () => setStatus('live'));
session.on('audio', (pcm, rate) => player.play(pcm, rate));
session.on('error', (e) => setError(e.message));
session.on('close', () => {
  player.close();
  setStatus('ended');
});

await session.ready;
```

`realtime()` returns immediately and connects in the background; `session.ready` resolves once the socket is open and the init frame has been sent.

`reconnect: { enabled: false }` makes `close` terminal, which is usually what a single "Start / End" UI wants. Leave reconnect on (the default) for a long-lived assistant that should survive a network blip: the session re-opens with the same `thread_id` and the conversation resumes from its checkpoint.

If your server pins the live model through its own configuration, omit `model` from the init frame rather than hardcoding one. The init `model` is a per-session override that wins over the server's setting, and live model availability is key- and region-specific, so a hardcoded value is a common cause of a session that closes immediately.

---

## Step 4: Push to talk

Manual turn-taking is the simplest thing to get right: open the mic on tap, close it on the next tap, and bracket the audio with `activityStart()` / `activityEnd()` so the agent knows the turn is over and should reply.

```ts
let mic = null;

const toggleMic = async () => {
  if (status !== 'live') return;

  if (mic) {
    mic.stop();
    mic = null;
    session.activityEnd();      // ends the turn; the agent now responds
    return;
  }

  try {
    session.activityStart();
    mic = await createMicCapture((frame) => session.sendAudio(frame));
  } catch (e) {
    // getUserMedia rejects when the user denies the permission prompt,
    // or when the page is not on HTTPS/localhost.
    setError(e?.message || 'Microphone unavailable');
    session.activityEnd();      // do not leave the turn hanging open
  }
};
```

For hands-free operation, leave server-side VAD on (the default) and skip `activityStart` / `activityEnd` entirely — just stream mic frames continuously and let the server detect turn boundaries. Set `vad: { enabled: false }` in the init frame only when you are driving turns manually as above.

---

## Step 5: Show transcripts

Both sides of the conversation stream in as text, in deltas, with a `finished` flag on the last one. Coalesce consecutive deltas from the same speaker into a single bubble:

```ts
const open = { user: null, agent: null };   // id of the in-progress bubble per role

const append = (role, text, finished) => {
  setMessages((previous) => {
    const openId = open[role];
    if (openId == null) {
      const id = nextId();
      open[role] = finished ? null : id;
      return [...previous, { id, role, text }];
    }
    const next = previous.map((m) => (m.id === openId ? { ...m, text: m.text + text } : m));
    if (finished) open[role] = null;
    return next;
  });
};

session.on('input_transcript', (e) => append('user', e.text || '', e.finished));
session.on('output_transcript', (e) => append('agent', e.text || '', e.finished));
```

---

## Step 6: Handle barge-in and teardown

When the user talks over the agent, the server sends `interrupted`. Any audio you have already scheduled will keep playing unless you drop it, which is what makes an interrupted assistant feel broken:

```ts
session.on('interrupted', () => {
  player.close();            // discard everything queued
  player = createPcmPlayer(); // fresh player for the next reply
});
```

Tear down on unmount as well as on the explicit End button — navigating away mid-session otherwise leaves the mic open and the socket connected:

```ts
useEffect(() => () => {
  mic?.stop();
  session?.close();
  player?.close();
}, []);
```

`session.close()` sends a close frame, closes the socket, and disables reconnect. It is idempotent.

---

## Step 7: Gate the UI on a live-capable graph

Do not offer an audio button against a graph that cannot accept it. Read the capability from `client.graph()` once, at connect time:

```ts
const { info } = (await client.graph()).data;
const liveCapable = Boolean((info as { is_realtime?: boolean }).is_realtime);

if (!liveCapable) {
  showNotice('This agent is not a realtime agent. Use the chat interface instead.');
}
```

This is exactly what the playground does: the Live page renders a gate rather than a session when `is_realtime` is false, so users get an explanation instead of a socket that closes on them.

---

## Reference implementation

The AgentFlow playground ships a complete working version of everything above:

| File | What it contains |
|---|---|
| `src/lib/realtime-audio.js` | `createPcmPlayer(24000)` and `createMicCapture(onFrame, 16000)`, as reproduced here. |
| `src/pages/live/components/live-session.jsx` | Session lifecycle, push-to-talk, transcript coalescing, teardown. |
| `src/pages/live/live-page.jsx` | The connect-first and not-live-capable gates. |

Run it with `agentflow play` and open the **Live** page.

---

## Common issues

| Symptom | Cause | Fix |
|---|---|---|
| Playback is too fast or too slow | Playing 24 kHz output at 16 kHz, or vice versa. | Use the `sampleRate` the `'audio'` listener hands you; do not assume. |
| No audio at all, no errors | The `AudioContext` was created outside a user gesture and stayed suspended. | Create the player inside the click handler, and call `resume()`. |
| Choppy playback with gaps between frames | Each frame started at `currentTime`. | Schedule at `max(currentTime, nextTime)` and advance `nextTime` by the buffer duration. |
| The agent interrupts itself constantly | The mic is picking up the speakers. | Enable `echoCancellation`, or use headphones. |
| `getUserMedia` rejects immediately | Permission denied, or the page is not on HTTPS/localhost. | Handle the rejection, tell the user, and call `activityEnd()` so the turn does not hang. |
| Socket closes right after connecting | The graph is not a live agent, or the init `model` is unavailable for your key/region. | Check `info.is_realtime`; omit `model` and let the server decide. |
| `No WebSocket implementation available` | Node 18 or 20 with no global `WebSocket`. | Pass `webSocketImpl` (the `ws` package) in the client config. |
| The mic indicator stays on after the session | `mic.stop()` was never called. | Stop the capture in the End handler and in the unmount cleanup. |

---

## What you learned

- Input is PCM16 mono at 16 kHz; output is PCM16 mono at 24 kHz. They are different on purpose.
- Requesting an `AudioContext` at 16 kHz makes the browser resample the microphone for you.
- Scheduling each output frame at the end of the previous one is what makes playback continuous.
- Push-to-talk means `activityStart()`, stream frames, `activityEnd()`; hands-free means leaving server VAD on.
- Handle `interrupted` by discarding queued playback, and always tear down the mic and socket on unmount.

## Next step

See [`reference/client/realtime`](../../reference/client/realtime.md) for the complete `RealtimeSession` API, including the reconnect and resume behaviour.

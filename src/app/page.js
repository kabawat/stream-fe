
"use client";

import { useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useRoomContext,
  VideoTrack,
} from "@livekit/components-react";
import { Track } from "livekit-client";

import {
  createStream,
  startStream,
  getStream,
  getLiveKitToken,
  getStreams,
  endStream,
} from "@/lib/api";

export default function HomePage() {
  const [mode, setMode] = useState("host");
  const [title, setTitle] = useState("My Live Stream");
  const [streamId, setStreamId] = useState("");
  const [streams, setStreams] = useState([]);
  const [stream, setStream] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action) {
    setBusy(true);
    setError("");

    try {
      await action();
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function startHosting() {
    await run(async () => {
      const created = await createStream(title);

      await startStream(created.id);

      const token = await getLiveKitToken(created.id, "host");

      setStream(created);
      setStreamId(created.id);
      setCredentials(token);
    });
  }


  async function joinAsViewer(id = streamId) {
    await run(async () => {
      const cleanId = id.trim();

      if (!cleanId) {
        throw new Error("Enter a stream ID");
      }

      const found = await getStream(cleanId);

      if (!["starting", "live"].includes(found.status)) {
        throw new Error(`Stream is not live. Status: ${found.status}`);
      }

      const token = await getLiveKitToken(cleanId, "viewer");

      setStream(found);
      setStreamId(cleanId);
      setCredentials(token);
    });
  }

  async function refreshStreams() {
    await run(async () => {
      setStreams(await getStreams());
    });
  }

  function leaveRoom() {
    setCredentials(null);
    setStream(null);
  }

  console.log("Secure:", window.isSecureContext);
  console.log("Media devices:", navigator.mediaDevices);
  console.log(window.isSecureContext, navigator.mediaDevices);

  return (
    <main className="page">
      <header className="header">
        <h1>Live Streaming Demo</h1>
        <p>Next.js + Go + MongoDB + LiveKit</p>
      </header>

      {error && <div className="error">{error}</div>}

      {!credentials && (
        <>
          <div className="tabs">
            <button
              className={mode === "host" ? "active" : ""}
              onClick={() => setMode("host")}
            >
              Host a stream
            </button>

            <button
              className={mode === "viewer" ? "active" : ""}
              onClick={() => setMode("viewer")}
            >
              Watch a stream
            </button>
          </div>

          {mode === "host" ? (
            <section className="panel">
              <h2>Start your camera stream</h2>

              <label htmlFor="title">Stream title</label>
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                minLength={3}
                maxLength={100}
              />

              <button
                className="primary"
                disabled={busy || title.trim().length < 3}
                onClick={startHosting}
              >
                {busy ? "Connecting..." : "Start streaming"}
              </button>
            </section>
          ) : (
            <section className="panel">
              <h2>Join a live stream</h2>

              <label htmlFor="streamId">Stream ID</label>
              <input
                id="streamId"
                value={streamId}
                onChange={(e) => setStreamId(e.target.value)}
                placeholder="Paste stream ID"
              />

              <button
                className="primary"
                disabled={busy || !streamId.trim()}
                onClick={() => joinAsViewer()}
              >
                {busy ? "Joining..." : "Watch stream"}
              </button>

              <button disabled={busy} onClick={refreshStreams}>
                Refresh stream list
              </button>

              {streams.map((item) => (
                <div className="streamRow" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      {item.status} · ID: {item.id}
                    </p>
                  </div>

                  <button
                    disabled={busy}
                    onClick={() => joinAsViewer(item.id)}
                  >
                    Watch
                  </button>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {credentials && stream && (
        <section className="panel">
          <h2>{stream.title}</h2>
          <p className="muted">
            Role: {credentials.role} · Stream ID: {stream.id}
          </p>

          <LiveKitRoom
            key={`${stream.id}-${credentials.role}`}
            serverUrl={credentials.serverUrl}
            token={credentials.token}
            connect={true}
            video={credentials.role === "host"}
            audio={credentials.role === "host"}
            onError={(err) => setError(err.message)}
          >
            <RoomAudioRenderer />
            <StreamVideo mode={credentials.role} />

            {credentials.role === "host" ? (
              <HostControls
                onLeave={async () => {
                  await endStream(stream.id);
                  leaveRoom();
                }}
              />
            ) : (
              <button className="primary" onClick={leaveRoom}>
                Leave stream
              </button>
            )}
          </LiveKitRoom>
        </section>
      )}
    </main>
  );
}

function StreamVideo({ mode }) {
  const tracks = useTracks(
    [Track.Source.Camera],
    { onlySubscribed: mode !== "host" }
  );

  return (
    <div className="videoGrid">
      {tracks.map((track) => (
        <div
          className="videoTile"
          key={`${track.participant.identity}-${track.publication?.trackSid || "camera"}`}
        >
          <VideoTrack trackRef={track} />
          <span className="videoLabel">
            {track.participant.identity}
            {track.participant.isLocal ? " (You)" : ""}
          </span>
        </div>
      ))}

      {tracks.length === 0 && (
        <div className="waiting">
          {mode === "viewer"
            ? "Waiting for host video..."
            : "Waiting for camera..."}
        </div>
      )}
    </div>
  );
}

function HostControls({ onLeave }) {
  const room = useRoomContext();
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState("");

  async function handleEnd() {
    setEnding(true);
    setEndError("");

    try {
      await room.localParticipant.setCameraEnabled(false);
      await room.localParticipant.setMicrophoneEnabled(false);
      await room.disconnect();
      await onLeave();
    } catch (err) {
      setEndError(err.message || "Unable to end stream");
    } finally {
      setEnding(false);
    }
  }

  return (
    <>
      <button
        className="danger"
        disabled={ending}
        onClick={handleEnd}
      >
        {ending ? "Ending..." : "End stream"}
      </button>

      {endError && <p className="error">{endError}</p>}
    </>
  );
}

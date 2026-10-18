import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const tokenStorageKey = "authToken";
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
let youtubeApiPromise;

function Brand({ href = "/" }) {
  return (
    <a className="brand" href={href} aria-label="Watchroom home">
      <span className="brand-mark" aria-hidden="true">▶</span>
      <span>watchroom</span>
    </a>
  );
}

function AuthPage() {
  const [mode, setMode] = useState("signin");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  useEffect(() => {
    if (sessionStorage.getItem(tokenStorageKey)) {
      window.location.replace("/watch");
    }
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const body = {
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    };
    if (isSignup) body.name = String(form.get("name")).trim();

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not sign in. Please try again.");
      }
      if (!result.token) {
        throw new Error("The server did not return an authentication token.");
      }
      sessionStorage.setItem(tokenStorageKey, result.token);
      window.location.assign("/watch");
    } catch (error) {
      setMessage(
        error.message ||
          "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setMessage("");
  }

  return (
    <main className="auth-layout">
      <section className="auth-intro" aria-label="Watchroom introduction">
        <Brand />
        <div className="intro-copy">
          <p className="eyebrow">YOUR OWN LITTLE CINEMA</p>
          <h1>Good videos.<br /><span>Better together.</span></h1>
          <p className="intro-description">
            Sign in, pick a video, and settle in. Your next watch session starts
            here.
          </p>
        </div>
        <div className="intro-note">
          <span className="live-dot" /> A little space for the things you love
          to watch
        </div>
      </section>

      <section className="auth-panel" aria-labelledby="form-title">
        <div className="auth-card">
          <p className="eyebrow" id="form-eyebrow">
            {isSignup ? "START YOUR WATCHROOM" : "WELCOME BACK"}
          </p>
          <h2 id="form-title">{isSignup ? "Create your account" : "Sign in"}</h2>
          <p className="form-subtitle">
            {isSignup
              ? "A cozy spot for your next favorite video."
              : "Pick up right where you left off."}
          </p>
          <div className="form-switch" role="tablist" aria-label="Account access">
            {["signin", "signup"].map((tabMode) => (
              <button
                className={`switch-button${mode === tabMode ? " is-active" : ""}`}
                id={`${tabMode}-tab`}
                key={tabMode}
                type="button"
                role="tab"
                aria-selected={mode === tabMode}
                onClick={() => changeMode(tabMode)}
              >
                {tabMode === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {isSignup && (
              <label className="field" htmlFor="name">
                <span>Your name</span>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  minLength="2"
                  maxLength="80"
                  placeholder="Alex Morgan"
                  required
                />
              </label>
            )}
            <label className="field" htmlFor="email">
              <span>Email address</span>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength="254"
                placeholder="you@example.com"
                required
              />
            </label>
            <label className="field" htmlFor="password">
              <span>Password</span>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                minLength="8"
                placeholder="At least 8 characters"
                required
              />
            </label>
            <p className="form-message" role="status" aria-live="polite">
              {message}
            </p>
            <button className="primary-button" type="submit" disabled={busy}>
              <span>
                {busy
                  ? isSignup
                    ? "Creating account…"
                    : "Signing in…"
                  : isSignup
                    ? "Create account"
                    : "Sign in"}
              </span>
              <span aria-hidden="true">↗</span>
            </button>
          </form>
          <p className="secure-note">
            <span aria-hidden="true">✦</span> Your account, your watchlist, your
            space.
          </p>
        </div>
        <footer className="auth-footer">
          Made for nights in <span aria-hidden="true">·</span> Watch at your own
          pace
        </footer>
      </section>
    </main>
  );
}

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => reject(new Error("Could not load the YouTube player."));
    document.head.append(script);
  });
  return youtubeApiPromise;
}

function YouTubePlayer({ videoId, playback, onPlayback, meetingActive }) {
  const targetRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const playbackRef = useRef(playback);
  const onPlaybackRef = useRef(onPlayback);
  const suppressUntilRef = useRef(0);
  const previousTimeRef = useRef(null);
  const previousTimeAtRef = useRef(0);
  const previousStateRef = useRef(null);
  const [syncNeeded, setSyncNeeded] = useState(false);

  playbackRef.current = playback;
  onPlaybackRef.current = onPlayback;

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        await loadYouTubeApi();
        if (cancelled || !targetRef.current) return;
        playerRef.current = new window.YT.Player(targetRef.current, {
          width: "100%",
          height: "100%",
          host: "https://www.youtube-nocookie.com",
          videoId,
          playerVars: {
            enablejsapi: 1,
            origin: window.location.origin,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady(event) {
              if (cancelled || event.target !== playerRef.current) return;
              readyRef.current = true;
              applyPlayback(playbackRef.current, true);
            },
            onStateChange(event) {
              if (event.target !== playerRef.current) return;
              const states = window.YT.PlayerState;
              let state;
              let currentTime;
              if (event.data === states.PLAYING) {
                setSyncNeeded(false);
                currentTime = playerRef.current.getCurrentTime();
                state = "playing";
                previousTimeRef.current = currentTime;
                previousTimeAtRef.current = Date.now();
              } else if (event.data === states.PAUSED) {
                setSyncNeeded(false);
                state = "paused";
                currentTime = playerRef.current.getCurrentTime();
              } else if (event.data === states.ENDED) {
                setSyncNeeded(false);
                state = "ended";
                currentTime = playerRef.current.getDuration();
              }
              if (state && Date.now() >= suppressUntilRef.current) {
                onPlaybackRef.current({ state, currentTime });
              }
            },
            onError() {
              window.dispatchEvent(
                new CustomEvent("watchroom:video-error", {
                  detail: "This video cannot be played in an embedded player.",
                }),
              );
            },
          },
        });
      } catch (error) {
        window.dispatchEvent(
          new CustomEvent("watchroom:video-error", { detail: error.message }),
        );
      }
    }

    initialize();
    return () => {
      cancelled = true;
      readyRef.current = false;
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId]);

  function applyPlayback(nextPlayback, forceSeek = false) {
    const player = playerRef.current;
    if (
      !player ||
      !readyRef.current ||
      !nextPlayback ||
      nextPlayback.videoId !== videoId
    ) {
      return;
    }
    const now = Date.now();
    let targetTime = nextPlayback.currentTime || 0;
    if (nextPlayback.state === "playing" && nextPlayback.updatedAt) {
      targetTime +=
        Math.max(0, now - new Date(nextPlayback.updatedAt).getTime()) / 1000;
    }
    if (forceSeek || Math.abs(player.getCurrentTime() - targetTime) > 2) {
      if (nextPlayback.state === "playing") {
        player.loadVideoById({ videoId, startSeconds: targetTime });
      } else if (player.getVideoData().video_id !== videoId) {
        player.cueVideoById({ videoId, startSeconds: targetTime });
      } else {
        player.seekTo(targetTime, true);
      }
    }
    suppressUntilRef.current = now + 2000;
    if (nextPlayback.state === "playing") {
      setSyncNeeded(
        player.getPlayerState() !== window.YT.PlayerState.PLAYING,
      );
      player.playVideo();
    } else {
      setSyncNeeded(false);
      if (nextPlayback.state === "ended") player.seekTo(targetTime, true);
      player.pauseVideo();
    }
  }

  useEffect(() => {
    applyPlayback(playback);
  }, [playback, videoId]);

  useEffect(() => {
    if (!meetingActive) return undefined;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || !readyRef.current) return;
      const states = window.YT.PlayerState;
      const state = player.getPlayerState();
      if (state !== states.PLAYING && state !== states.PAUSED) {
        previousTimeRef.current = null;
        previousStateRef.current = state;
        return;
      }
      const now = Date.now();
      const currentTime = player.getCurrentTime();
      if (previousTimeRef.current !== null) {
        const elapsed = (now - previousTimeAtRef.current) / 1000;
        const expected = previousStateRef.current === states.PLAYING && state === states.PLAYING ? elapsed : 0;
        if (
          now >= suppressUntilRef.current &&
          Math.abs(currentTime - previousTimeRef.current - expected) > 2
        ) {
          onPlaybackRef.current({
            state: state === states.PLAYING ? "playing" : "paused",
            currentTime,
          });
        }
      }
      previousTimeRef.current = currentTime;
      previousTimeAtRef.current = now;
      previousStateRef.current = state;
    }, 1000);
    return () => window.clearInterval(timer);
  }, [meetingActive]);

  return (
    <>
      <div ref={targetRef} />
      {syncNeeded && (
        <button
          className="sync-playback-button"
          type="button"
          onClick={() => applyPlayback(playbackRef.current, true)}
        >
          Click to sync playback
        </button>
      )}
    </>
  );
}

function extractVideoId(value) {
  const input = value.trim();
  if (videoIdPattern.test(input)) return input;
  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] || null;
  }
  if (
    hostname !== "youtube.com" &&
    hostname !== "m.youtube.com" &&
    hostname !== "youtube-nocookie.com"
  ) {
    return null;
  }
  if (url.pathname === "/watch") return url.searchParams.get("v");
  const match = url.pathname.match(
    /^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/,
  );
  return match?.[1] || null;
}

function WatchPage() {
  const token = sessionStorage.getItem(tokenStorageKey);
  const socketRef = useRef(null);
  const meetingIdRef = useRef(null);
  const joinedMeetingIdRef = useRef(null);
  const chatListRef = useRef(null);
  const [accountName, setAccountName] = useState("Loading…");
  const [meeting, setMeeting] = useState(null);
  const [meetingIdInput, setMeetingIdInput] = useState("");
  const [videoInput, setVideoInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [meetingMessage, setMeetingMessage] = useState("");
  const [videoMessage, setVideoMessage] = useState("");
  const [videoSuccess, setVideoSuccess] = useState(false);
  const [chatStatus, setChatStatus] = useState("Connecting to chat…");
  const [chatConnected, setChatConnected] = useState(false);
  const [chatError, setChatError] = useState("");
  const [playback, setPlayback] = useState(null);
  const [videoLoadError, setVideoLoadError] = useState("");
  const [copied, setCopied] = useState(false);

  meetingIdRef.current = meeting?.meetingId || null;

  useEffect(() => {
    if (!token) {
      window.location.replace("/");
      return undefined;
    }
    let active = true;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) {
          sessionStorage.removeItem(tokenStorageKey);
          window.location.replace("/");
          return;
        }
        if (!response.ok) throw new Error(result.error || "Could not load your account.");
        if (active) setAccountName(result.user.name);
      })
      .catch((error) => {
        if (active) {
          setAccountName("Unable to load account");
          setVideoMessage(error.message || "Could not connect to the server.");
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    const socket = io({
      autoConnect: false,
      auth: { token },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setChatConnected(true);
      setChatStatus("Connected to room chat");
      const meetingId = meetingIdRef.current;
      if (!meetingId || joinedMeetingIdRef.current === meetingId) return;
      setChatStatus("Joining room chat…");
      socket.timeout(10000).emit("meeting:join", meetingId, (error, result) => {
        if (error || result?.error) {
          setChatStatus("Could not reconnect to room chat.");
          setChatError(error ? "The meeting server did not respond. Please refresh." : result.error);
          return;
        }
        joinedMeetingIdRef.current = result.meeting.meetingId;
        setChatStatus("Connected to room chat");
        setMessages(result.messages || []);
        if (result.meeting.videoId) {
          setMeeting((current) => ({ ...current, ...result.meeting }));
          setPlayback(result.meeting.playback);
        }
      });
    });
    socket.on("disconnect", () => {
      joinedMeetingIdRef.current = null;
      setChatConnected(false);
      setChatStatus("Reconnecting to chat…");
    });
    socket.on("connect_error", (error) => {
      setChatConnected(false);
      if (error.message === "Authentication required.") {
        sessionStorage.removeItem(tokenStorageKey);
        window.location.replace("/");
      } else {
        setChatStatus("Could not connect to room chat.");
      }
    });
    socket.on("chat:message", (message) => {
      setMessages((current) =>
        message.id && current.some((item) => item.id === message.id)
          ? current
          : [...current, message],
      );
    });
    socket.on("chat:error", setChatError);
    socket.on("meeting:video", (update) => {
      setMeeting((current) => current ? { ...current, videoId: update.videoId } : current);
      setPlayback(update);
      setVideoMessage(
        update.updatedBy
          ? `${update.updatedBy} changed the video for everyone in this meeting.`
          : "The meeting video was updated.",
      );
      setVideoSuccess(true);
      window.setTimeout(() => {
        setVideoMessage("");
        setVideoSuccess(false);
      }, 3500);
    });
    socket.on("playback:update", setPlayback);

    const initialMeetingId = new URLSearchParams(window.location.search).get("meeting");
    const initialJoinTimer = initialMeetingId
      ? window.setTimeout(() => joinMeeting(initialMeetingId), 0)
      : null;
    return () => {
      if (initialJoinTimer) window.clearTimeout(initialJoinTimer);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    if (!meeting?.meetingId || !chatConnected || !joinedMeetingIdRef.current) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      const socket = socketRef.current;
      if (!socket?.connected) return;
      socket.timeout(5000).emit("playback:get", (error, result) => {
        if (!error && !result?.error && result?.videoId) setPlayback(result);
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [meeting?.meetingId, chatConnected]);

  useEffect(() => {
    const list = chatListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  useEffect(() => {
    function handleVideoError(event) {
      setVideoLoadError(event.detail);
    }
    window.addEventListener("watchroom:video-error", handleVideoError);
    return () => window.removeEventListener("watchroom:video-error", handleVideoError);
  }, []);

  function requestSocket(eventName, ...args) {
    const socket = socketRef.current;
    if (!socket) return Promise.reject(new Error("Meeting connection is unavailable."));
    return new Promise((resolve, reject) => {
      let connectionTimer;
      function cleanup() {
        window.clearTimeout(connectionTimer);
        socket.off("connect", sendRequest);
        socket.off("connect_error", handleConnectionError);
      }
      function sendRequest() {
        cleanup();
        socket.timeout(10000).emit(eventName, ...args, (error, result) => {
          if (error) reject(new Error("The server did not respond. Please try again."));
          else resolve(result);
        });
      }
      function handleConnectionError(error) {
        cleanup();
        if (error.message === "Authentication required.") {
          sessionStorage.removeItem(tokenStorageKey);
          window.location.replace("/");
          reject(new Error("Please sign in again."));
        } else {
          reject(new Error("Could not connect to the server. Try again."));
        }
      }
      if (socket.connected) {
        sendRequest();
        return;
      }
      socket.once("connect", sendRequest);
      socket.once("connect_error", handleConnectionError);
      connectionTimer = window.setTimeout(() => {
        cleanup();
        reject(new Error("Could not connect to the server. Try again."));
      }, 10000);
      if (!socket.active) {
        setChatStatus("Connecting to chat…");
        socket.connect();
      }
    });
  }

  async function joinMeeting(value) {
    const normalizedId = value.trim().toUpperCase();
    if (!/^[A-F0-9]{10}$/.test(normalizedId)) {
      setMeetingMessage("Enter a valid 10-character meeting ID.");
      return;
    }
    setMeetingMessage("");
    setBusy(true);
    try {
      const result = await requestSocket("meeting:join", normalizedId);
      if (result.error) throw new Error(result.error);
      showMeeting(result);
    } catch (error) {
      setMeetingMessage(error.message || "Could not join the meeting.");
    } finally {
      setBusy(false);
    }
  }

  function showMeeting(result) {
    const room = result.meeting || result;
    meetingIdRef.current = room.meetingId;
    joinedMeetingIdRef.current = room.meetingId;
    setMeeting(room);
    setMeetingMessage("");
    setMessages(result.messages || room.messages || []);
    setPlayback(room.playback || null);
    setChatError("");
    setChatStatus("Connected to room chat");
    history.replaceState(null, "", `/watch?meeting=${encodeURIComponent(room.meetingId)}`);
  }

  async function handleCreateMeeting() {
    setMeetingMessage("");
    setBusy(true);
    try {
      const result = await requestSocket("meeting:create");
      if (result.error) throw new Error(result.error);
      showMeeting(result);
    } catch (error) {
      setMeetingMessage(error.message || "Could not start a meeting.");
    } finally {
      setBusy(false);
    }
  }

  function leaveMeeting() {
    socketRef.current?.emit("meeting:leave");
    joinedMeetingIdRef.current = null;
    meetingIdRef.current = null;
    setMeeting(null);
    setPlayback(null);
    setMessages([]);
    setChatStatus("Join a meeting to chat.");
    setChatError("");
    setVideoMessage("");
    setVideoInput("");
    history.replaceState(null, "", "/watch");
  }

  async function handleVideoSubmit(event) {
    event.preventDefault();
    setVideoMessage("");
    setVideoSuccess(false);
    const videoId = extractVideoId(videoInput);
    if (!videoId || !videoIdPattern.test(videoId)) {
      setVideoMessage("Enter a valid YouTube video URL or 11-character video ID.");
      return;
    }
    setVideoBusy(true);
    try {
      const result = await requestSocket("meeting:video:set", videoId);
      if (result.error) throw new Error(result.error);
    } catch (error) {
      setVideoMessage(error.message || "Could not update the meeting video.");
    } finally {
      setVideoBusy(false);
    }
  }

  function sendPlayback(update) {
    const socket = socketRef.current;
    if (socket?.connected && joinedMeetingIdRef.current) {
      socket.emit("playback:set", update);
    }
  }

  function sendChat(event) {
    event.preventDefault();
    const message = chatInput.trim();
    const socket = socketRef.current;
    if (!message || !socket?.connected || !joinedMeetingIdRef.current) return;
    setChatError("");
    socket.emit("chat:send", message);
    setChatInput("");
  }

  async function copyMeetingId() {
    try {
      await navigator.clipboard.writeText(meeting.meetingId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMeetingMessage("Could not copy the ID. Select and copy it manually.");
    }
  }

  function signOut() {
    sessionStorage.removeItem(tokenStorageKey);
    window.location.replace("/");
  }

  if (!token) return null;

  return (
    <div className="watch-page">
      <header className="topbar">
        <Brand href="/watch" />
        <div className="account-area">
          <span className="welcome-label">Watching as</span>
          <span className="account-name">{accountName}</span>
          <button className="signout-button" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="watch-main">
        <section className="watch-heading">
          <p className="eyebrow"><span className="live-dot" /> YOUR WATCHROOM</p>
          <h1>Watch together, <span>wherever.</span></h1>
          <p>Start a new meeting or join friends with their meeting ID.</p>
        </section>

        {!meeting ? (
          <section className="meeting-card" aria-label="Start or join a meeting">
            <div className="meeting-option">
              <span className="option-icon" aria-hidden="true">＋</span>
              <div className="option-copy">
                <h2>Start a new meeting</h2>
                <p>Create a room and share its ID with your friends.</p>
              </div>
              <button className="primary-button meeting-action" type="button" disabled={busy} onClick={handleCreateMeeting}>
                <span>Start meeting</span><span aria-hidden="true">↗</span>
              </button>
            </div>
            <div className="meeting-divider"><span>OR JOIN A FRIEND</span></div>
            <form className="join-form" onSubmit={(event) => { event.preventDefault(); joinMeeting(meetingIdInput); }}>
              <label className="field join-field" htmlFor="meeting-id">
                <span>Meeting ID</span>
                <input id="meeting-id" type="text" maxLength="10" autoComplete="off" placeholder="Enter the 10-character ID" required value={meetingIdInput} onChange={(event) => setMeetingIdInput(event.target.value)} />
              </label>
              <button className="secondary-button meeting-action" type="submit" disabled={busy}>
                <span>Join meeting</span><span aria-hidden="true">→</span>
              </button>
            </form>
            <p className="form-message meeting-message" role="status" aria-live="polite">{meetingMessage}</p>
          </section>
        ) : (
          <section className="player-card" aria-label="Meeting room, YouTube player, and chat">
            <div className="room-toolbar">
              <div>
                <p className="eyebrow room-eyebrow"><span className="live-dot" /> YOU’RE IN A MEETING</p>
                <h2 className="room-title">Your watchroom</h2>
              </div>
              <div className="meeting-id-box">
                <span>MEETING ID</span>
                <strong>{meeting.meetingId}</strong>
                <button className="copy-button" type="button" onClick={copyMeetingId}>{copied ? "Copied!" : "Copy ID"}</button>
              </div>
            </div>
            <form className="video-form" onSubmit={handleVideoSubmit}>
              <label className="field video-field" htmlFor="video-url">
                <span>Paste a YouTube link or video ID</span>
                <input id="video-url" type="text" autoComplete="url" placeholder="https://www.youtube.com/watch?v=…" required value={videoInput} onChange={(event) => setVideoInput(event.target.value)} />
              </label>
              <button className="primary-button play-button" type="submit" disabled={videoBusy}>
                <span>{videoBusy ? "Updating…" : "Play video"}</span><span aria-hidden="true">▶</span>
              </button>
            </form>
            <p className={`form-message video-message${videoSuccess ? " is-success" : ""}`} role="status" aria-live="polite">{videoMessage || videoLoadError}</p>
            <div className="room-content">
              <div className="video-column">
                <div className="player-frame">
                  {meeting.videoId ? (
                    <div className="youtube-player-container">
                      <YouTubePlayer
                        key={meeting.videoId}
                        videoId={meeting.videoId}
                        playback={playback}
                        onPlayback={sendPlayback}
                        meetingActive={Boolean(meeting)}
                      />
                    </div>
                  ) : (
                    <div className="player-empty">
                      <span className="empty-play" aria-hidden="true">▶</span>
                      <p>Your next video goes here</p>
                      <span>Paste a YouTube link above to get started.</span>
                    </div>
                  )}
                </div>
                <p className="player-footnote"><span aria-hidden="true">ⓘ</span> Videos play from YouTube. Some videos may not allow embedding.</p>
              </div>
              <aside className="chat-panel" aria-label="Meeting chat">
                <div className="chat-header">
                  <div><h2>Room chat</h2><p>{chatStatus}</p></div>
                  <span className={`chat-live-dot${chatConnected ? " is-connected" : ""}`} />
                </div>
                <ol className="chat-messages" ref={chatListRef} aria-live="polite" aria-label="Chat messages">
                  {messages.length === 0 ? (
                    <li className="chat-empty">Say hello to everyone in the room.</li>
                  ) : messages.map((message, index) => {
                    const sentAt = new Date(message.sentAt);
                    return (
                      <li className="chat-message" key={message.id || `${message.sentAt}-${index}`}>
                        <div className="chat-message-header">
                          <span className="chat-message-name">{message.name}</span>
                          <time className="chat-message-time" dateTime={sentAt.toISOString()}>
                            {sentAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </time>
                        </div>
                        <span className="chat-message-text">{message.text}</span>
                      </li>
                    );
                  })}
                </ol>
                <p className="chat-error" role="status" aria-live="polite">{chatError}</p>
                <form className="chat-form" onSubmit={sendChat}>
                  <label className="is-hidden" htmlFor="chat-input">Message</label>
                  <input id="chat-input" name="message" type="text" maxLength="500" autoComplete="off" placeholder="Write a message…" required disabled={!chatConnected} value={chatInput} onChange={(event) => setChatInput(event.target.value)} />
                  <button className="chat-send-button" type="submit" aria-label="Send message" disabled={!chatConnected}>↑</button>
                </form>
              </aside>
            </div>
            <button className="back-button" type="button" onClick={leaveMeeting}>← Back to meetings</button>
          </section>
        )}
      </main>
    </div>
  );
}

export default function App() {
  const isWatchPage =
    window.location.pathname === "/watch" ||
    window.location.pathname === "/watch.html";
  useEffect(() => {
    document.body.classList.toggle("watch-page", isWatchPage);
    return () => document.body.classList.remove("watch-page");
  }, [isWatchPage]);
  return isWatchPage ? <WatchPage /> : <AuthPage />;
}

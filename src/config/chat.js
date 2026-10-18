import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { Server } from "socket.io";
import Meeting from "../models/Meeting.js";
import User from "../models/User.js";

const MAX_MESSAGE_LENGTH = 500;
const MAX_STORED_MESSAGES = 100;

function getPlaybackState(meeting) {
  const updatedAt = new Date();
  let currentTime = meeting.playbackTime || 0;

  if (meeting.playbackState === "playing" && meeting.playbackUpdatedAt) {
    currentTime +=
      (updatedAt.getTime() - meeting.playbackUpdatedAt.getTime()) / 1000;
  }

  return {
    videoId: meeting.videoId,
    state: meeting.playbackState || "paused",
    currentTime: Math.max(0, currentTime),
    updatedAt,
  };
}

function initializeChat(httpServer) {
  const io = new Server(httpServer);

  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (typeof token !== "string" || !token) {
      return next(new Error("Authentication required."));
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
      });
      if (typeof payload !== "object" || typeof payload.sub !== "string") {
        return next(new Error("Authentication required."));
      }

      socket.data.userId = payload.sub;
      return next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return next(new Error("Authentication required."));
      }

      return next(error);
    }
  });

  io.on("connection", (socket) => {
    async function joinMeeting(meetingId) {
      const normalizedId =
        typeof meetingId === "string" ? meetingId.trim().toUpperCase() : "";
      if (!/^[A-F0-9]{10}$/.test(normalizedId)) {
        throw new Error("Enter a valid 10-character meeting ID.");
      }

      const [meeting, user] = await Promise.all([
        Meeting.findOne({ meetingId: normalizedId }),
        User.findById(socket.data.userId).select("name"),
      ]);

      if (!meeting) {
        throw new Error("Meeting not found. Check the ID and try again.");
      }
      if (!user) {
        throw new Error(
          "Your account could not be found. Please sign in again.",
        );
      }

      for (const room of socket.rooms) {
        if (room.startsWith("meeting:")) {
          await socket.leave(room);
        }
      }

      await socket.join(`meeting:${normalizedId}`);
      socket.data.meetingId = normalizedId;
      socket.data.userName = user.name;

      return {
        meeting: {
          meetingId: normalizedId,
          hostId: meeting.hostId.toString(),
          videoId: meeting.videoId,
          createdAt: meeting.createdAt,
          playback: getPlaybackState(meeting),
        },
        messages: meeting.messages
          .slice(-MAX_STORED_MESSAGES)
          .map((message) => ({
            id: message.messageId,
            name: message.name,
            text: message.text,
            sentAt: message.sentAt,
          })),
      };
    }

    socket.on("meeting:create", async (acknowledge) => {
      try {
        const user = await User.findById(socket.data.userId).select("name");
        if (!user) {
          throw new Error(
            "Your account could not be found. Please sign in again.",
          );
        }

        let meeting;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          meeting = new Meeting({
            meetingId: crypto.randomBytes(5).toString("hex").toUpperCase(),
            hostId: socket.data.userId,
          });

          try {
            await meeting.save();
            break;
          } catch (error) {
            if (error.code !== 11000 || attempt === 2) {
              throw error;
            }
            meeting = null;
          }
        }

        const joined = await joinMeeting(meeting.meetingId);
        if (typeof acknowledge === "function") {
          acknowledge(joined);
        }
      } catch (error) {
        console.error("Failed to create meeting over Socket.IO.", error);
        if (typeof acknowledge === "function") {
          acknowledge({
            error:
              error.message || "Could not create a meeting. Please try again.",
          });
        }
      }
    });

    socket.on("meeting:leave", async () => {
      const meetingId = socket.data.meetingId;
      if (meetingId) {
        await socket.leave(`meeting:${meetingId}`);
        delete socket.data.meetingId;
        delete socket.data.userName;
      }
    });

    socket.on("meeting:join", async (meetingId, acknowledge) => {
      try {
        const joined = await joinMeeting(meetingId);
        if (typeof acknowledge === "function") {
          acknowledge(joined);
        }
      } catch (error) {
        console.error("Failed to join meeting over Socket.IO.", error);
        if (typeof acknowledge === "function") {
          acknowledge({
            error:
              error.message || "Could not join the meeting. Please try again.",
          });
        }
      }
    });

    socket.on("meeting:video:set", async (videoId, acknowledge) => {
      const meetingId = socket.data.meetingId;
      if (!meetingId) {
        if (typeof acknowledge === "function") {
          acknowledge({ error: "Join a meeting before selecting a video." });
        }
        return;
      }
      if (typeof videoId !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        if (typeof acknowledge === "function") {
          acknowledge({ error: "Enter a valid YouTube video ID." });
        }
        return;
      }

      try {
        const playbackUpdatedAt = new Date();
        const meeting = await Meeting.findOneAndUpdate(
          { meetingId },
          {
            videoId,
            playbackTime: 0,
            playbackState: "playing",
            playbackUpdatedAt,
          },
          { new: true, runValidators: true },
        );
        if (!meeting) {
          if (typeof acknowledge === "function") {
            acknowledge({ error: "This meeting is no longer available." });
          }
          return;
        }

        const update = {
          videoId: meeting.videoId,
          state: "playing",
          currentTime: 0,
          updatedAt: playbackUpdatedAt,
          updatedBy: socket.data.userName,
        };
        io.to(`meeting:${meetingId}`).emit("meeting:video", update);
        if (typeof acknowledge === "function") {
          acknowledge(update);
        }
      } catch (error) {
        console.error("Failed to update meeting video over Socket.IO.", error);
        if (typeof acknowledge === "function") {
          acknowledge({
            error: "Could not update the meeting video. Please try again.",
          });
        }
      }
    });

    socket.on("playback:set", async (update, acknowledge) => {
      const meetingId = socket.data.meetingId;
      const { state, currentTime } = update || {};

      if (!meetingId) {
        if (typeof acknowledge === "function") {
          acknowledge({ error: "Join a meeting before syncing playback." });
        }
        return;
      }

      if (
        !["playing", "paused", "ended"].includes(state) ||
        typeof currentTime !== "number" ||
        !Number.isFinite(currentTime) ||
        currentTime < 0 ||
        currentTime > 86400
      ) {
        if (typeof acknowledge === "function") {
          acknowledge({ error: "Invalid playback update." });
        }
        return;
      }

      try {
        const playbackTime = currentTime;
        const playbackUpdatedAt = new Date();
        const meeting = await Meeting.findOneAndUpdate(
          { meetingId },
          { playbackTime, playbackState: state, playbackUpdatedAt },
          { new: true, runValidators: true },
        );

        if (!meeting) {
          if (typeof acknowledge === "function") {
            acknowledge({ error: "This meeting is no longer available." });
          }
          return;
        }

        const playback = getPlaybackState(meeting);
        socket.to(`meeting:${meetingId}`).emit("playback:update", playback);
        if (typeof acknowledge === "function") {
          acknowledge(playback);
        }
      } catch (error) {
        console.error("Failed to sync meeting playback.", error);
        if (typeof acknowledge === "function") {
          acknowledge({ error: "Could not sync playback. Please try again." });
        }
      }
    });

    socket.on("playback:get", async (acknowledge) => {
      const meetingId = socket.data.meetingId;
      if (!meetingId) {
        if (typeof acknowledge === "function") {
          acknowledge({ error: "Join a meeting before syncing playback." });
        }
        return;
      }

      try {
        const meeting = await Meeting.findOne({ meetingId });
        if (!meeting) {
          if (typeof acknowledge === "function") {
            acknowledge({ error: "This meeting is no longer available." });
          }
          return;
        }

        if (typeof acknowledge === "function") {
          acknowledge(getPlaybackState(meeting));
        }
      } catch (error) {
        console.error("Failed to read meeting playback state.", error);
        if (typeof acknowledge === "function") {
          acknowledge({ error: "Could not sync playback. Please try again." });
        }
      }
    });

    socket.on("chat:send", async (text) => {
      const meetingId = socket.data.meetingId;
      const messageText = typeof text === "string" ? text.trim() : "";

      if (!meetingId || !socket.data.userName) {
        return socket.emit(
          "chat:error",
          "Join a meeting before sending messages.",
        );
      }
      if (!messageText || messageText.length > MAX_MESSAGE_LENGTH) {
        return socket.emit(
          "chat:error",
          `Messages must be between 1 and ${MAX_MESSAGE_LENGTH} characters.`,
        );
      }

      const sentAt = new Date();
      const messageId = crypto.randomUUID();
      try {
        const meeting = await Meeting.findOneAndUpdate(
          { meetingId },
          {
            $push: {
              messages: {
                $each: [
                  {
                    messageId,
                    userId: socket.data.userId,
                    name: socket.data.userName,
                    text: messageText,
                    sentAt,
                  },
                ],
                $slice: -MAX_STORED_MESSAGES,
              },
            },
          },
          { new: true },
        );

        if (!meeting) {
          return socket.emit(
            "chat:error",
            "This meeting is no longer available.",
          );
        }

        io.to(`meeting:${meetingId}`).emit("chat:message", {
          id: messageId,
          name: socket.data.userName,
          text: messageText,
          sentAt,
        });
      } catch (error) {
        console.error("Failed to save chat message.", error);
        socket.emit(
          "chat:error",
          "Message could not be sent. Please try again.",
        );
      }
    });
  });

  return io;
}

export default initializeChat;

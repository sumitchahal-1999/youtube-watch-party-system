import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      maxlength: 80,
    },
    text: {
      type: String,
      required: true,
      maxlength: 500,
    },
    sentAt: {
      type: Date,
      required: true,
    },
  },
  { _id: false },
);

const meetingSchema = new mongoose.Schema(
  {
    meetingId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      minlength: 10,
      maxlength: 10,
      match: /^[A-F0-9]{10}$/,
    },
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    videoId: {
      type: String,
      default: null,
      match: /^[A-Za-z0-9_-]{11}$/,
    },
    playbackTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    playbackState: {
      type: String,
      enum: ["paused", "playing", "ended"],
      default: "paused",
    },
    playbackUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    messages: {
      type: [chatMessageSchema],
      default: [],
    },
  },
  { timestamps: true },
);

export default mongoose.model("Meeting", meetingSchema);

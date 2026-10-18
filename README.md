# YouTube Watch Party

A React watch-party frontend backed by a Node.js ES module API, Express, and MongoDB/Mongoose.

- `client/` — React frontend built with Vite
- `src/models/` — Mongoose data models
- `src/controllers/` — request handling and application logic
- `src/routes/` — REST endpoint definitions
- `src/middleware/` — authentication and error handling
- `src/config/` — database connection
- `src/views/css/` — application styles

## Setup

1. Install Node.js 18.11 or later and run `npm install`.
2. Copy `.env.example` to `.env` in the project root. The server can also load an existing `src/.env` file if the root `.env` is absent.
3. Set `MONGODB_URI` to your MongoDB connection string and replace `JWT_SECRET` with a long random value. `JWT_EXPIRES_IN` controls token lifetime and defaults to `24h`.
4. Start MongoDB, then run `npm run dev`.

Open `http://localhost:5173`. The single development command starts the React/Vite frontend and the API together. The API listens on port `3000` by default; override it with `PORT`.

For a production build, run `npm run build` followed by `npm start`, then open `http://localhost:3000`. The API serves the built React app. After login, Socket.IO creates a meeting or joins one by ID. Meeting chat, selected-video updates, and video play, pause, and seek positions are shared over the authenticated socket connection. The latest 100 messages, selected video, and current playback position are saved with the meeting, so they remain available to participants who join later. If a browser blocks autoplay, click **Click to sync playback** in the player. The JWT is kept in the browser tab's session storage and is cleared when you sign out or close the tab.

## Authentication endpoints

Authentication uses signed JWT bearer tokens. Signup and signin return a token in the JSON response; send it in the `Authorization: Bearer <token>` header for authenticated requests. Tokens are stateless, so signing out requires the client to discard its token.

| Method | Path                | Purpose                       |
| ------ | ------------------- | ----------------------------- |
| `POST` | `/api/auth/signup`  | Create an account and sign in |
| `POST` | `/api/auth/signin`  | Sign in                       |
| `POST` | `/api/auth/signout` | End the current session       |
| `GET`  | `/api/auth/me`      | Get the signed-in user        |
| `GET`  | `/api/health`       | Health check                  |

Send JSON bodies to signup/signin. Successful responses contain the user and the bearer token:

```json
{
  "name": "Alex",
  "email": "alex@example.com",
  "password": "at-least-8-characters"
}
```

When a browser-based frontend runs on a different origin, configure a trusted CORS origin before deployment.

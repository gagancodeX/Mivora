# Mivora ✦

Mivora is a calm collection of tiny browser games for quiet moments.

## Features
- Responsive desktop + mobile UI
- Four standalone mini-games
- Google sign-in through the Mivora backend
- Guest play without an account
- Server-side sessions
- User accounts and game scores stored in PostgreSQL

## Structure
- `index.html` — homepage
- `games/` — separate page for every game
- `assets/css/style.css` — shared visual system
- `assets/css/auth.css` — authentication UI
- `assets/js/main.js` — theme/session logic
- `assets/js/auth.js` — frontend authentication client
- `assets/js/*-*.js` — individual game logic
- `server.js` — Express backend + Google OAuth + API
- `package.json` — backend dependencies

## Stack
HTML · CSS · JavaScript · Node.js · Express · PostgreSQL · Google OAuth

## Environment variables
Set these on the server:

`DATABASE_URL`
`SESSION_SECRET`
`GOOGLE_CLIENT_ID`
`GOOGLE_CLIENT_SECRET`
`GOOGLE_CALLBACK_URL`

For local development, the callback is typically:
`http://localhost:3000/auth/google/callback`

For Render, use your public service URL:
`https://YOUR-SERVICE.onrender.com/auth/google/callback`

## Run
```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Auth behavior
- Visitors can play every game without signing in.
- “Sign in with Google” starts the real Google OAuth flow.
- The backend creates/updates the user record after Google authentication.
- The backend stores scores only for signed-in users.

## License
MIT

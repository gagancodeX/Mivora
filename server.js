const path = require("path");
const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const app = express();
const PORT = Number(process.env.PORT || 3000);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false });

app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  store: new pgSession({ pool, tableName: "user_sessions", createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || "dev-only-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 30
  }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query("SELECT id, google_id, name, email, avatar_url, created_at FROM users WHERE id = $1", [id]);
    done(null, rows[0] || false);
  } catch (error) {
    done(error);
  }
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const name = profile.displayName || "Mivora Player";
      const email = profile.emails?.[0]?.value || null;
      const avatarUrl = profile.photos?.[0]?.value || null;

      const { rows } = await pool.query(
        `INSERT INTO users (google_id, name, email, avatar_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (google_id)
         DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url
         RETURNING id, google_id, name, email, avatar_url, created_at`,
        [googleId, name, email, avatarUrl]
      );
      done(null, rows[0]);
    } catch (error) {
      done(error);
    }
  }));
}

async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set. API/database features will not work until it is configured.");
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS game_scores (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS game_scores_user_game_idx ON game_scores(user_id, game);
  `);
}

app.get("/auth/google", (req, res, next) => {
  if (!passport._strategy("google")) {
    return res.status(503).send("Google sign-in is not configured yet.");
  }
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/?auth=failed" }),
  (_req, res) => res.redirect("/?auth=success")
);

app.post("/auth/logout", (req, res, next) => {
  req.logout(error => {
    if (error) return next(error);
    req.session.destroy(error => {
      if (error) return next(error);
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });
});

app.get("/api/me", (req, res) => {
  res.json({
    authenticated: Boolean(req.user),
    user: req.user ? {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      avatarUrl: req.user.avatar_url
    } : null
  });
});

app.get("/api/scores", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in required." });
  try {
    const { rows } = await pool.query(
      "SELECT game, score, created_at FROM game_scores WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
      [req.user.id]
    );
    res.json({ scores: rows });
  } catch (error) {
    res.status(500).json({ error: "Could not load scores." });
  }
});

app.post("/api/scores", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in required." });
  const game = String(req.body.game || "").trim();
  const score = Number(req.body.score);
  const allowedGames = new Set(["bubble-drift", "soft-match", "color-flow", "slow-breath"]);

  if (!allowedGames.has(game) || !Number.isInteger(score) || score < 0 || score > 1000000) {
    return res.status(400).json({ error: "Invalid score payload." });
  }

  try {
    const { rows } = await pool.query(
      "INSERT INTO game_scores (user_id, game, score) VALUES ($1, $2, $3) RETURNING id, game, score, created_at",
      [req.user.id, game, score]
    );
    res.status(201).json({ score: rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Could not save score." });
  }
});

app.get("/api/health", async (_req, res) => {
  try {
    if (!process.env.DATABASE_URL) return res.json({ ok: true, database: "not-configured" });
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch {
    res.status(503).json({ ok: false, database: "error" });
  }
});

app.use(express.static(path.join(__dirname)));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error." });
});

initDb()
  .then(() => app.listen(PORT, "0.0.0.0", () => console.log(`Mivora server running on port ${PORT}`)))
  .catch(error => {
    console.error("Database initialization failed:", error);
    app.listen(PORT, "0.0.0.0", () => console.log(`Mivora server running on port ${PORT} without database`));
  });

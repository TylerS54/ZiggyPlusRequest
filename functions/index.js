const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const dns = require("node:dns/promises");

const TMDB_API_KEY = defineSecret("TMDB_API_KEY");
const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = defineSecret("TELEGRAM_CHAT_ID");
const PLEX_TOKEN = defineSecret("PLEX_TOKEN");

const PLEX_DOMAIN = "ziggyplus.org";
const PLEX_DIRECT_HASH = "4730d278dc5048d9affc7bebed62465b";
const PLEX_MOVIE_SECTION = 3;
const PLEX_TV_SECTION = 2;

let basePlexURL = null;
async function getBasePlexURL() {
  if (basePlexURL) return basePlexURL;
  const addresses = await dns.resolve4(PLEX_DOMAIN);
  const ipDashed = addresses[0].replace(/\./g, "-");
  basePlexURL = `https://${ipDashed}.${PLEX_DIRECT_HASH}.plex.direct:32400`;
  return basePlexURL;
}

async function plexFetch(path, params = {}) {
  const base = await getBasePlexURL();
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("X-Plex-Token", PLEX_TOKEN.value());
  const response = await fetch(url);
  return response.text();
}

function containerSize(xml) {
  const match = xml.match(/<MediaContainer[^>]*\bsize="(\d+)"/);
  return match ? parseInt(match[1], 10) : 0;
}

async function movieExists(title, studio, year) {
  const xml = await plexFetch(`/library/sections/${PLEX_MOVIE_SECTION}/all`, {
    title,
    studio: studio || "",
    year: year || "",
  });
  return containerSize(xml) > 0;
}

async function tvShowRatingKey(title) {
  const xml = await plexFetch(`/library/sections/${PLEX_TV_SECTION}/all`, { title });
  if (containerSize(xml) === 0) return null;
  const match = xml.match(/<Directory[^>]*\bratingKey="(\d+)"/);
  return match ? match[1] : null;
}

async function missingSeasons(ratingKey, seasons) {
  const xml = await plexFetch(`/library/metadata/${ratingKey}/children`);
  const existing = [...xml.matchAll(/<Directory[^>]*\bindex="(\d+)"/g)].map((m) =>
    parseInt(m[1], 10)
  );
  return seasons.filter((season) => !existing.includes(parseInt(season, 10)));
}

async function sendTelegramMessage(text) {
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN.value()}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID.value(), text }),
    }
  );
  return response.json();
}

async function handleTmdbProxy(req, res) {
  // req.path is like /tmdb/search/movie — forward the remainder to TMDB with the key injected
  const tmdbPath = req.path.replace(/^\/api/, "").replace(/^\/tmdb/, "");
  if (!/^\/(search\/(movie|tv)|movie\/\d+|tv\/\d+)$/.test(tmdbPath)) {
    res.status(404).json({ error: "Unsupported TMDB path" });
    return;
  }
  const url = new URL(`https://api.themoviedb.org/3${tmdbPath}`);
  for (const [key, value] of Object.entries(req.query)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("api_key", TMDB_API_KEY.value());
  const response = await fetch(url);
  res.status(response.status).json(await response.json());
}

async function handleRequest(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const {
    title,
    year,
    type,
    studio,
    overview,
    poster,
    seasons,
    selectedSeasons = [],
    requestorName,
  } = req.body || {};

  if (!title || !type) {
    res.status(400).json({ error: "title and type are required" });
    return;
  }

  let missing = null;
  if (type === "movie") {
    if (await movieExists(title, studio, year)) {
      res.json({ status: "exists" });
      return;
    }
  } else if (type === "TV Show") {
    const ratingKey = await tvShowRatingKey(title);
    if (ratingKey) {
      missing = await missingSeasons(ratingKey, selectedSeasons);
      if (missing.length === 0) {
        res.json({ status: "exists" });
        return;
      }
    } else {
      missing = "All";
    }
  }

  const message = `
Name: ${requestorName || "Anonymous"}
Title: ${title}
Year: ${year}
Type: ${type}
${
  type === "TV Show"
    ? `Seasons: ${seasons}\nSelected Seasons: ${selectedSeasons.join(", ")}\nMissing Seasons: ${
        Array.isArray(missing) ? missing.join(", ") : missing
      }\n`
    : ""
}Overview: ${overview}
Poster: ${poster}
`;

  const result = await sendTelegramMessage(message);
  if (result.ok) {
    res.json({ status: "sent" });
  } else {
    console.error("Telegram API error:", result);
    res.status(502).json({ status: "error" });
  }
}

exports.api = onRequest(
  { secrets: [TMDB_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, PLEX_TOKEN] },
  async (req, res) => {
    try {
      // Hosting rewrites forward the original URL, so strip the /api prefix
      const path = req.path.replace(/^\/api/, "");
      if (path.startsWith("/tmdb/")) {
        await handleTmdbProxy(req, res);
      } else if (path === "/request") {
        await handleRequest(req, res);
      } else {
        res.status(404).json({ error: "Not found" });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

# ==================================================
# 1. IMPORTS
# ==================================================

import json
import random
import re
import io
import os
import zipfile
import time
import sqlite3
import asyncio
import secrets
import logging
import unicodedata
from datetime import datetime, timedelta, timezone, time as dtime

import requests
from telegram import (
    BotCommand,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Update,
    WebAppInfo,
)
from telegram.error import Forbidden
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    TypeHandler,
)

# ==================================================
# 2. CONFIGURATION
# ==================================================

TOKEN = os.getenv("BOT_TOKEN", "")

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(message)s",
    level=logging.INFO,
    handlers=[logging.StreamHandler()],
    force=True,
)
log = logging.getLogger("animealert")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

CHAINE_ID = "@AnimeAlertBuea"
ADMIN_ID = int(os.getenv("ADMIN_ID", "6802374194"))
ANILIST_URL = "https://graphql.anilist.co"
FUSEAU = timezone(timedelta(hours=1))

JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]

# ==================================================
# 3. CONSTANTES (GENRES, AIDE)
# ==================================================

GENRES = {
    "action": "Action",
    "aventure": "Adventure",
    "adventure": "Adventure",
    "comedie": "Comedy",
    "comedy": "Comedy",
    "humour": "Comedy",
    "drame": "Drama",
    "drama": "Drama",
    "fantasy": "Fantasy",
    "fantastique": "Fantasy",
    "horreur": "Horror",
    "horror": "Horror",
    "mecha": "Mecha",
    "musique": "Music",
    "music": "Music",
    "mystere": "Mystery",
    "mystery": "Mystery",
    "psychologique": "Psychological",
    "psychological": "Psychological",
    "romance": "Romance",
    "scifi": "Sci-Fi",
    "sci-fi": "Sci-Fi",
    "tranche de vie": "Slice of Life",
    "slice of life": "Slice of Life",
    "sport": "Sports",
    "sports": "Sports",
    "surnaturel": "Supernatural",
    "supernatural": "Supernatural",
    "thriller": "Thriller",
    "magical girl": "Mahou Shoujo",
}

AIDE = (
    "AnimeAlert Buea - Guide\n\n"
    "MES ANIMES\n"
    "/suivre <nom>       Chercher un anime\n"
    "/ajouter <nom>      Ajouter aux favoris\n"
    "/favoris            Mes favoris\n"
    "/planning           Planning de mes episodes\n"
    "/episodes <nom>     Liens et videos des episodes\n"
    "/rappel <1|3|24>    Delai des rappels\n\n"
    "DECOUVRIR\n"
    "/top                Animes populaires\n"
    "/genre <genre>      Par genre\n"
    "/saison <annee>     Par saison\n"
    "/sorties            Prochaines sorties\n"
    "/semaine            Calendrier 7 jours\n"
    "/recommande         Recommandations perso\n\n"
    "COMMUNAUTE\n"
    "/noter <anime> <1-10>  Noter un anime\n"
    "/classement         Top des avis\n"
    "/canaux             Canaux partenaires\n\n"
    "INFOS\n"
    "/premium            Offre gratuite et premium\n"
    "/chaine             Rejoindre la chaine\n"
    "/aide               Ce message"
)

# ---------- Base de donnees ----------

# ==================================================
# 4. BASE DE DONNEES
# ==================================================

conn = sqlite3.connect("animealert.db", check_same_thread=False, timeout=30)
conn.execute("PRAGMA journal_mode=WAL")
conn.execute("PRAGMA busy_timeout=5000")
conn.execute("PRAGMA synchronous=NORMAL")
conn.execute("PRAGMA temp_store=MEMORY")
conn.execute("PRAGMA synchronous=NORMAL")
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS favoris (
    user_id INTEGER,
    anime_titre TEXT,
    anime_id INTEGER
)
""")

try:
    cursor.execute("ALTER TABLE favoris ADD COLUMN anime_id INTEGER")
except sqlite3.OperationalError:
    pass

cursor.execute("""
CREATE TABLE IF NOT EXISTS utilisateurs (
    user_id INTEGER PRIMARY KEY
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS reglages (
    user_id INTEGER PRIMARY KEY,
    delai INTEGER
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS rappels_envoyes (
    user_id INTEGER,
    cle TEXT,
    episode INTEGER,
    type TEXT
)
""")
conn.commit()

cursor.execute("""
CREATE TABLE IF NOT EXISTS videos_episodes (
    anime_id INTEGER, titre TEXT, episode INTEGER,
    file_id TEXT, type TEXT, PRIMARY KEY (anime_id, episode)
)
""")
conn.commit()

cursor.execute("""
CREATE TABLE IF NOT EXISTS episodes_publies (
    anime_id INTEGER, episode INTEGER, publie_le INTEGER,
    PRIMARY KEY (anime_id, episode)
)
""")
conn.commit()

BOT_USERNAME = None

# ---------- AniList ----------

CHAMPS = """
      id
      title {
        romaji
        english
      }
      coverImage {
        large
      }
      siteUrl
      nextAiringEpisode {
        episode
        airingAt
        timeUntilAiring
      }
      externalLinks {
        site
        type
        url
      }
"""

QUERY_RECHERCHE = """
query ($search: String) {
  Page(page: 1, perPage: 3) {
    media(search: $search, type: ANIME, isAdult: false, sort: SEARCH_MATCH) {
""" + CHAMPS + """
    }
  }
}
"""

QUERY_ID = """
query ($id: Int) {
  Media(id: $id, type: ANIME) {
""" + CHAMPS + """
  }
}
"""

QUERY_SORTIES = """
query ($debut: Int, $fin: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo {
      hasNextPage
    }
    airingSchedules(
      airingAt_greater: $debut
      airingAt_lesser: $fin
      sort: TIME
    ) {
      episode
      airingAt
      media {
        title {
          romaji
          english
        }
        popularity
        isAdult
        siteUrl
      }
    }
  }
}
"""

QUERY_PROCHAINES = """
query {
  Page(page: 1, perPage: 5) {
    airingSchedules(notYetAired: true, sort: TIME) {
      episode
      timeUntilAiring
      media {
        title {
          romaji
          english
        }
        siteUrl
      }
    }
  }
}
"""

QUERY_TOP = """
query {
  Page(page: 1, perPage: 10) {
    media(type: ANIME, status: RELEASING, isAdult: false, sort: POPULARITY_DESC) {
      title {
        romaji
        english
      }
      averageScore
      siteUrl
    }
  }
}
"""

QUERY_GENRE = """
query ($genre: String) {
  Page(page: 1, perPage: 8) {
    media(type: ANIME, genre: $genre, status: RELEASING, isAdult: false, sort: POPULARITY_DESC) {
      title {
        romaji
        english
      }
      averageScore
      siteUrl
    }
  }
}
"""


_cache_anilist = {}
CACHE_TTL = 180
CACHE_MAX_ENTRIES = 200


# ==================================================
# 5. ANILIST API
# ==================================================

def appel_anilist(query, variables=None):
    """Appel AniList avec cache 5 min et retry x3."""
    import hashlib
    cle = hashlib.md5(
        (query + json.dumps(variables or {}, sort_keys=True)).encode()
    ).hexdigest()
    maintenant = time.time()

    if cle in _cache_anilist:
        data_cache, ts = _cache_anilist[cle]
        if maintenant - ts < CACHE_TTL:
            return data_cache

    data = None
    for tentative in range(3):
        try:
            response = requests.post(
                ANILIST_URL,
                json={"query": query, "variables": variables or {}},
                timeout=15,
            )
            data = response.json()
            break
        except Exception as e:
            if tentative == 2:
                log.error(f"Erreur AniList: {e}")
                return None
            time.sleep(2 ** tentative)

    if not data or "errors" in data or not data.get("data"):
        log.error(f"Erreur AniList: {data.get('errors') if data else 'pas de reponse'}")
        return None

    _cache_anilist[cle] = (data["data"], maintenant)
    # Cache borne : max 500 entrees
    if len(_cache_anilist) > CACHE_MAX_ENTRIES:
        # Supprimer les 100 plus anciennes
        entrees = sorted(_cache_anilist.items(), key=lambda x: x[1][1])
        for k, _ in entrees[:100]:
            _cache_anilist.pop(k, None)
    return data["data"]


def normaliser_titre_recherche(titre):
    """Nettoie un titre : retire @canal, underscores, brackets parasites."""
    if not titre:
        return ""
    import re as _re
    t = _re.sub(r"@[\w_]+", "", titre)
    t = t.replace("_", " ").replace("—", " ").replace("–", " ")
    t = _re.sub(r"[\[\]\(\)\{\}]+", " ", t)
    t = _re.sub(r"\s+", " ", t).strip()
    t = t.strip(" -_.,:;")
    return t


def chercher_anime_offline(titre, seuil=80):
    """Recherche fuzzy (ratio strict) dans la base locale. Zero quota."""
    if not titre or len(titre) < 3:
        return []
    try:
        from rapidfuzz import fuzz, process
    except ImportError:
        log.warning("[offline] rapidfuzz non installe")
        return []
    try:
        cursor.execute("SELECT anilist_id, search_text FROM anime_search")
        tous = cursor.fetchall()
    except Exception as e:
        log.warning(f"[offline] DB non initialisee : {e}")
        return []
    if not tous:
        return []
    titres = [t[1] for t in tous]
    ids = [t[0] for t in tous]
    requete = titre.lower().strip()
    try:
        matches = process.extract(
            requete, titres, scorer=fuzz.ratio, limit=3, score_cutoff=seuil
        )
    except Exception as e:
        log.warning(f"[offline] fuzzy : {e}")
        return []
    if not matches:
        return []
    vus = set()
    resultats = []
    for _titre, score, idx in matches:
        aid = ids[idx]
        if aid in vus:
            continue
        vus.add(aid)
        log.info(f"[offline] '{titre}' -> id={aid} (score={score:.0f})")
        resultats.append({
            "id": aid,
            "title": {"romaji": _titre.title(), "english": None},
            "_score": score,
        })
    return resultats


async def chercher_anime_ia(nom, user_id=0, contexte="auto"):
    """Recherche AniList avec fallback IA si rien trouve."""
    nom = normaliser_titre_recherche(nom)
    if not nom or len(nom) < 2:
        return []
    resultats = chercher_anime(nom)
    if resultats:
        return resultats

    # Fallback base locale (fuzzy ratio, zero quota)
    log.info(f"[{contexte}] AniList vide pour '{nom}', tentative offline...")
    offline = chercher_anime_offline(nom, seuil=80)
    if offline:
        aid = offline[0]["id"]
        anime = recuperer_anime(anime_id=aid)
        if anime:
            log.info(f"[{contexte}] Offline -> {titre_de(anime)}")
            return [anime]
        else:
            log.info(f"[{contexte}] Offline -> id={aid} (fiche incomplete)")
            return offline

    # Fallback IA (dernier recours)
    log.info(f"[{contexte}] Offline vide, fallback IA...")
    try:
        from gemini_ia import corriger_titre_anime
        titre_corrige = await corriger_titre_anime(nom, user_id or ADMIN_ID)
        if titre_corrige and titre_corrige.lower() != nom.lower():
            log.info(f"[{contexte}] IA propose : '{titre_corrige}'")
            resultats = chercher_anime(titre_corrige)
            if resultats:
                log.info(f"[{contexte}] IA a trouve via AniList")
                return resultats
    except Exception as e:
        log.warning(f"[{contexte}] IA fallback: {e}")

    return []


def chercher_anime(nom):
    data = appel_anilist(QUERY_RECHERCHE, {"search": nom})
    if not data:
        return []
    return data["Page"]["media"]


def recuperer_anime(anime_id=None, titre=None):
    if anime_id:
        data = appel_anilist(QUERY_ID, {"id": anime_id})
        return data["Media"] if data else None

    if titre:
        resultats = chercher_anime(titre)
        return resultats[0] if resultats else None

    return None


def recuperer_sorties(debut, fin, pages_max):
    items = []

    for page in range(1, pages_max + 1):
        data = appel_anilist(
            QUERY_SORTIES, {"debut": debut, "fin": fin, "page": page}
        )
        if not data:
            break

        bloc = data["Page"]
        items += bloc["airingSchedules"]

        if not bloc["pageInfo"]["hasNextPage"]:
            break

    return [i for i in items if not i["media"]["isAdult"]]


# ---------- Outils ----------

# ==================================================
# 6. UTILITAIRES
# ==================================================

def titre_de(anime):
    return anime["title"]["english"] or anime["title"]["romaji"]


def sans_accents(texte):
    return "".join(
        c for c in unicodedata.normalize("NFD", texte)
        if unicodedata.category(c) != "Mn"
    )


def formater_duree(total):
    jours = total // 86400
    heures = (total % 86400) // 3600
    minutes = (total % 3600) // 60

    parties = []
    if jours:
        parties.append(f"{jours} jour(s)")
    if heures:
        parties.append(f"{heures} heure(s)")
    parties.append(f"{minutes} minute(s)")

    return ", ".join(parties)


def calculer_compte_a_rebours(airing_at):
    total = int(airing_at - time.time())

    if total <= 0:
        return "L'episode est deja sorti."

    return formater_duree(total)


def liens_streaming(anime):
    liens = []
    deja = set()

    for lien in anime.get("externalLinks") or []:
        site = lien.get("site")
        url = lien.get("url")

        if lien.get("type") == "STREAMING" and site and url and site not in deja:
            deja.add(site)
            liens.append((site, url))

    return liens


def construire_boutons(anime, liens):
    rangees = [
        [
            InlineKeyboardButton(
                "Ajouter aux favoris",
                callback_data=f"fav:{anime['id']}",
            )
        ]
    ]

    streaming = [InlineKeyboardButton(site, url=url) for site, url in liens[:3]]
    if streaming:
        rangees.append(streaming)

    rangees.append([InlineKeyboardButton("Voir sur AniList", url=anime["siteUrl"])])

    return InlineKeyboardMarkup(rangees)


async def formater_anime(anime):
    titre = titre_de(anime)
    lignes = [f"Anime: {titre}"]

    prochain = anime.get("nextAiringEpisode")

    if prochain and prochain.get("airingAt"):
        date = datetime.fromtimestamp(prochain["airingAt"], FUSEAU)
        compte = calculer_compte_a_rebours(prochain["airingAt"])

        lignes.append(f"Prochain episode: {prochain['episode']}")
        lignes.append(f"Date: {date.strftime('%d/%m/%Y %H:%M')}")
        lignes.append(f"Compte a rebours: {compte}")
    else:
        lignes.append("Aucun prochain episode annonce.")

    liens = liens_streaming(anime)
    if liens:
        lignes.append("Disponible sur: " + ", ".join(site for site, _ in liens))

    synopsis = await get_synopsis_fr(anime, 0)
    if synopsis:
        lignes.append("")
        lignes.append(synopsis)

    return "\n".join(lignes), construire_boutons(anime, liens)


async def envoyer_anime(message, anime):
    texte, boutons = await formater_anime(anime)
    image = (anime.get("coverImage") or {}).get("large")

    if image:
        try:
            await message.reply_photo(
                photo=image, caption=texte, reply_markup=boutons
            )
            return
        except Exception as e:
            log.error(f"Erreur envoi image: {e}")

    await message.reply_text(texte, reply_markup=boutons)


async def envoyer_blocs(message, entete, blocs):
    texte = entete

    for bloc in blocs:
        if len(texte) + len(bloc) + 2 > 3800:
            await message.reply_text(texte)
            texte = ""
        texte += ("\n\n" if texte else "") + bloc

    if texte:
        await message.reply_text(texte)


# ==================================================
# 7. GESTION FAVORIS
# ==================================================

def db_write(sql, params=None):
    """Ecriture SQLite avec BEGIN IMMEDIATE pour eviter les locks.
    A utiliser pour toute operation d'ecriture (INSERT/UPDATE/DELETE)."""
    try:
        cursor.execute("BEGIN IMMEDIATE")
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        conn.commit()
        return True
    except sqlite3.OperationalError as e:
        conn.rollback()
        if "locked" in str(e).lower() or "busy" in str(e).lower():
            log.warning(f"SQLite busy (retry possible): {e}")
        else:
            log.error(f"Erreur SQLite: {e}")
        return False
    except Exception as e:
        conn.rollback()
        log.error(f"Erreur DB: {e}")
        return False


def db_write_many(sql, liste_params):
    """Ecriture multiple en une seule transaction IMMEDIATE."""
    try:
        cursor.execute("BEGIN IMMEDIATE")
        cursor.executemany(sql, liste_params)
        conn.commit()
        return True
    except sqlite3.OperationalError as e:
        conn.rollback()
        if "locked" in str(e).lower() or "busy" in str(e).lower():
            log.warning(f"SQLite busy (batch): {e}")
        else:
            log.error(f"Erreur SQLite batch: {e}")
        return False
    except Exception as e:
        conn.rollback()
        log.error(f"Erreur DB batch: {e}")
        return False


cursor.execute("""
CREATE TABLE IF NOT EXISTS ia_cache (
    cle TEXT PRIMARY KEY, valeur TEXT, cree_le INTEGER
)
""")
conn.commit()


async def ia_avec_cache(cle, ttl, func):
    maintenant = int(time.time())
    cursor.execute("SELECT valeur, cree_le FROM ia_cache WHERE cle = ?", (cle,))
    row = cursor.fetchone()
    if row and (maintenant - row[1]) < ttl:
        return row[0]
    try:
        resultat = func()
        if asyncio.iscoroutine(resultat):
            resultat = await resultat
        if resultat and len(resultat) > 5:
            cursor.execute(
                "INSERT OR REPLACE INTO ia_cache (cle, valeur, cree_le) VALUES (?, ?, ?)",
                (cle, resultat[:2000], maintenant)
            )
            conn.commit()
            return resultat
    except Exception as e:
        log.warning(f"ia_avec_cache: {e}")
    return None


cursor.execute("""
CREATE TABLE IF NOT EXISTS synopsis_fr (
    anime_id INTEGER PRIMARY KEY, texte TEXT, cree_le INTEGER
)
""")
conn.commit()


async def get_synopsis_fr(anime, user_id):
    anime_id = anime.get("id")
    if not anime_id: return None
    cursor.execute("SELECT texte FROM synopsis_fr WHERE anime_id = ?", (anime_id,))
    row = cursor.fetchone()
    if row: return row[0]
    import re as _re
    s = _re.sub(r"<[^>]+>", " ", anime.get("description") or "")
    s = _re.sub(r"\s+", " ", s).strip()
    if not s: return None
    try:
        texte_fr = await generer_synopsis_fr(
            titre_de(anime), s[:600],
            ", ".join((anime.get("genres") or [])[:4]), user_id
        )
        if texte_fr and "indisponible" not in texte_fr.lower():
            cursor.execute("INSERT OR REPLACE INTO synopsis_fr VALUES (?, ?, ?)",
                (anime_id, texte_fr[:2000], int(time.time())))
            conn.commit()
            return texte_fr
    except Exception as e:
        log.warning(f"synopsis_fr: {e}")
    return None


cursor.execute("""
CREATE TABLE IF NOT EXISTS config (
    cle TEXT PRIMARY KEY, valeur TEXT
)
""")
conn.commit()


def _get_config(cle, defaut=None):
    cursor.execute("SELECT valeur FROM config WHERE cle = ?", (cle,))
    row = cursor.fetchone()
    return row[0] if row else defaut


def _set_config(cle, valeur):
    cursor.execute("INSERT OR REPLACE INTO config (cle, valeur) VALUES (?, ?)", (cle, str(valeur)))
    conn.commit()



try:
    cursor.execute("ALTER TABLE videos_episodes ADD COLUMN archive_file_id TEXT")
except sqlite3.OperationalError:
    pass
try:
    cursor.execute("ALTER TABLE videos_episodes ADD COLUMN archive_type TEXT")
except sqlite3.OperationalError:
    pass
conn.commit()

cursor.execute("""
CREATE TABLE IF NOT EXISTS rappels_admin (
    cle TEXT PRIMARY KEY, valeur TEXT
)
""")
conn.commit()

def _get_rappel(cle, defaut="0"):
    cursor.execute("SELECT valeur FROM rappels_admin WHERE cle = ?", (cle,))
    row = cursor.fetchone()
    return row[0] if row else defaut

def _set_rappel(cle, valeur):
    cursor.execute("INSERT OR REPLACE INTO rappels_admin (cle, valeur) VALUES (?, ?)", (cle, str(valeur)))
    conn.commit()

cursor.execute("INSERT OR IGNORE INTO rappels_admin (cle, valeur) VALUES (?, ?)", ("dernier_rappel_renew", str(int(time.time()))))
conn.commit()

def ajouter_favori(user_id, anime):
    titre = titre_de(anime)

    cursor.execute(
        "SELECT 1 FROM favoris "
        "WHERE user_id = ? AND (anime_id = ? OR anime_titre = ?)",
        (user_id, anime["id"], titre),
    )

    if cursor.fetchone():
        return False

    return db_write(
        "INSERT INTO favoris (user_id, anime_titre, anime_id) VALUES (?, ?, ?)",
        (user_id, titre, anime["id"]),
    )

# ---------- Commandes ----------

async def enregistrer_utilisateur(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user

    if user and not user.is_bot:
        cursor.execute(
            "INSERT OR IGNORE INTO utilisateurs (user_id) VALUES (?)",
            (user.id,),
        )
        conn.commit()


# ==================================================
# 8. COMMANDES UTILISATEUR
# ==================================================

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Bienvenue sur AnimeAlert Buea!\n\n"
        + AIDE
        + "\n\nTu seras prevenu avant la sortie de tes favoris "
        "et quand l'episode sort."
    )


async def aide(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "AnimeAlert Buea t'aide a suivre les sorties d'animes.\n\n" + AIDE
    )


async def chaine(update: Update, context: ContextTypes.DEFAULT_TYPE):
    boutons = [
        [
            InlineKeyboardButton(
                "Rejoindre la chaine",
                url=f"https://t.me/{CHAINE_ID.replace('@', '')}",
            )
        ]
    ]

    await update.message.reply_text(
        "Rejoins la chaine AnimeAlert Buea pour recevoir les nouveautes.",
        reply_markup=InlineKeyboardMarkup(boutons),
    )


async def sorties(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = appel_anilist(QUERY_PROCHAINES)

    if not data:
        await update.message.reply_text(
            "Impossible de recuperer les sorties pour le moment."
        )
        return

    schedules = data["Page"]["airingSchedules"]

    if not schedules:
        await update.message.reply_text("Aucune sortie trouvee.")
        return

    blocs = []

    for item in schedules:
        anime = item["media"]
        duree = formater_duree(item["timeUntilAiring"])

        blocs.append(
            f"{titre_de(anime)}\n"
            f"Episode {item['episode']}\n"
            f"Sortie dans: {duree}\n"
            f"Lien: {anime['siteUrl']}"
        )

    await envoyer_blocs(update.message, "Prochaines sorties d'animes:", blocs)


async def semaine(update: Update, context: ContextTypes.DEFAULT_TYPE):
    debut = int(time.time())
    items = recuperer_sorties(debut, debut + 7 * 86400, 6)

    if not items:
        await update.message.reply_text("Aucune sortie trouvee cette semaine.")
        return

    jours = {}

    for item in items:
        date = datetime.fromtimestamp(item["airingAt"], FUSEAU)
        jours.setdefault(date.date(), []).append(item)

    blocs = []

    for jour in sorted(jours):
        liste = sorted(
            jours[jour],
            key=lambda i: i["media"]["popularity"] or 0,
            reverse=True,
        )[:6]
        liste.sort(key=lambda i: i["airingAt"])

        lignes = [f"{JOURS[jour.weekday()]} {jour.strftime('%d/%m')}"]

        for item in liste:
            heure = datetime.fromtimestamp(item["airingAt"], FUSEAU)
            lignes.append(
                f"{heure.strftime('%H:%M')} - {titre_de(item['media'])} "
                f"(ep. {item['episode']})"
            )

        blocs.append("\n".join(lignes))

    await envoyer_blocs(
        update.message,
        "Sorties de la semaine (heure du Cameroun):",
        blocs,
    )


def lister_animes(entete, medias):
    lignes = [entete, ""]

    for i, anime in enumerate(medias, start=1):
        score = anime.get("averageScore")
        note = f" - note {score}/100" if score else ""
        lignes.append(f"{i}. {titre_de(anime)}{note}")
        lignes.append(anime["siteUrl"])
        lignes.append("")

    return "\n".join(lignes)


async def top(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = appel_anilist(QUERY_TOP)

    if not data or not data["Page"]["media"]:
        await update.message.reply_text("Impossible de recuperer le classement.")
        return

    await update.message.reply_text(
        lister_animes(
            "Les animes en cours les plus populaires:",
            data["Page"]["media"],
        )
    )


async def genre(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text(
            "Exemple: /genre action\n\n"
            "Genres: action, aventure, comedie, drame, fantasy, horreur, "
            "mecha, musique, mystere, psychologique, romance, scifi, "
            "tranche de vie, sport, surnaturel, thriller"
        )
        return

    saisie = sans_accents(" ".join(context.args).lower())
    nom_genre = GENRES.get(saisie)

    if not nom_genre:
        await update.message.reply_text(
            "Genre inconnu. Tape /genre pour voir la liste."
        )
        return

    data = appel_anilist(QUERY_GENRE, {"genre": nom_genre})

    if not data or not data["Page"]["media"]:
        await update.message.reply_text("Aucun anime trouve pour ce genre.")
        return

    await update.message.reply_text(
        lister_animes(
            f"Animes en cours - genre {saisie}:",
            data["Page"]["media"],
        )
    )


async def suivre(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text(
            "Ecris le nom de l'anime.\n"
            "Exemple: /suivre One Piece"
        )
        return

    nom = " ".join(context.args)
    resultats = chercher_anime(nom)

    if not resultats:
        await update.message.reply_text(
            "Aucun anime trouve.\n"
            "Essaie un autre nom."
        )
        return

    for anime in resultats[:3]:
        await envoyer_anime(update.message, anime)


# async def ajouter(update: Update, context: ContextTypes.DEFAULT_TYPE):
#     if not context.args:
#         await update.message.reply_text(
#             "Ecris le nom de l'anime.\n"
#             "Exemple: /ajouter One Piece"
#         )
#         return

#     nom = " ".join(context.args)
#     resultats = chercher_anime(nom)

#     if not resultats:
#         await update.message.reply_text(
#             "Aucun anime trouve.\n"
#             "Essaie un autre nom."
#         )
#         return

#     anime = resultats[0]
#     titre = titre_de(anime)

#     if ajouter_favori(update.effective_user.id, anime):
#         await update.message.reply_text(f"{titre} ajoute a tes favoris.")
#     else:
#         await update.message.reply_text(f"{titre} est deja dans tes favoris.")


async def favoris(update: Update, context: ContextTypes.DEFAULT_TYPE):
    cursor.execute(
        "SELECT anime_titre FROM favoris WHERE user_id = ?",
        (update.effective_user.id,),
    )

    resultats = cursor.fetchall()

    if not resultats:
        await update.message.reply_text(
            "Tu ne suis aucun anime pour le moment.\n"
            "Utilise /ajouter One Piece"
        )
        return

    message = "Tes animes suivis:\n\n"

    for i, (titre,) in enumerate(resultats, start=1):
        message += f"{i}. {titre}\n"

    await update.message.reply_text(message)


async def retirer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text(
            "Ecris le nom de l'anime.\n"
            "Exemple: /retirer One Piece"
        )
        return

    nom = " ".join(context.args)

    cursor.execute(
        "DELETE FROM favoris WHERE user_id = ? AND anime_titre LIKE ?",
        (update.effective_user.id, f"%{nom}%"),
    )
    conn.commit()

    await update.message.reply_text(f"{nom} retire de tes favoris.")


# async def rappel(update: Update, context: ContextTypes.DEFAULT_TYPE):
#     user_id = update.effective_user.id

#     if not context.args:
#         cursor.execute("SELECT delai FROM reglages WHERE user_id = ?", (user_id,))
#         ligne = cursor.fetchone()
#         actuel = ligne[0] if ligne else 24

#         await update.message.reply_text(
#             f"Tu es prevenu {actuel}h avant la sortie, "
#             "et aussi quand l'episode sort.\n\n"
#             "Pour changer: /rappel 1, /rappel 3 ou /rappel 24"
#         )
#         return

#     chiffres = "".join(c for c in context.args[0] if c.isdigit())

#     if chiffres not in ("1", "3", "24"):
#         await update.message.reply_text("Choisis 1, 3 ou 24. Exemple: /rappel 3")
#         return

#     cursor.execute(
#         "INSERT OR REPLACE INTO reglages (user_id, delai) VALUES (?, ?)",
#         (user_id, int(chiffres)),
#     )
#     conn.commit()

#     await update.message.reply_text(
#         f"C'est note: tu seras prevenu {chiffres}h avant la sortie."
#     )


# async def bouton(update: Update, context: ContextTypes.DEFAULT_TYPE):
#     q = update.callback_query

#     try:
#         anime_id = int(q.data.split(":")[1])
#     except (IndexError, ValueError):
#         await q.answer()
#         return

#     anime = recuperer_anime(anime_id=anime_id)

#     if not anime:
#         await q.answer("Impossible de recuperer cet anime.", show_alert=True)
#         return

#     titre = titre_de(anime)

#     if ajouter_favori(q.from_user.id, anime):
#         await q.answer(f"{titre} ajoute a tes favoris.", show_alert=True)
#     else:
#         await q.answer("Deja dans tes favoris.", show_alert=True)


# ==================================================
# 9. COMMANDES ADMIN
# ==================================================

async def monid(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(f"Ton identifiant Telegram: {update.effective_user.id}")


async def annonce(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Commande reservee a l'admin.")
        return

    texte = update.message.text.partition(" ")[2].strip()

    if not texte:
        await update.message.reply_text("Exemple: /annonce Bonjour a tous!")
        return

    cursor.execute("SELECT user_id FROM utilisateurs")
    ids = [ligne[0] for ligne in cursor.fetchall()]

    envoyes = 0

    for user_id in ids:
        try:
            await context.bot.send_message(chat_id=user_id, text=texte)
            envoyes += 1
        except Exception:
            pass

    await update.message.reply_text(f"Annonce envoyee a {envoyes}/{len(ids)} utilisateurs.")


async def cmd_stats_db(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin : affiche les stats de la bibliotheque (liens + videos)."""
    if update.effective_user.id != ADMIN_ID:
        return

    cursor.execute("SELECT COUNT(*) FROM liens_episodes")
    nb_liens = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM videos_episodes")
    nb_videos = cursor.fetchone()[0]

    cursor.execute("""
        SELECT anime_id, titre,
            (SELECT COUNT(*) FROM liens_episodes WHERE anime_id = v.anime_id) AS nl,
            (SELECT COUNT(*) FROM videos_episodes WHERE anime_id = v.anime_id) AS nv
        FROM (
            SELECT anime_id, titre FROM liens_episodes
            UNION
            SELECT anime_id, titre FROM videos_episodes
        ) v
        GROUP BY anime_id
        ORDER BY (nl + nv) DESC
    """)
    lignes = cursor.fetchall()

    if not lignes:
        await update.message.reply_text("Bibliotheque vide.")
        return

    message = (
        f"Bibliotheque AnimeAlert\n\n"
        f"Liens (URL)   : {nb_liens}\n"
        f"Videos (.mkv) : {nb_videos}\n"
        f"TOTAL         : {nb_liens + nb_videos}\n"
        f"Animes        : {len(lignes)}\n\n"
        f"Top 10 par nombre d'episodes :\n"
    )

    for i, (aid, t, nl, nv) in enumerate(lignes[:10], start=1):
        message += f"{i}. {t[:35]} : {nl}L + {nv}V = {nl + nv}\n"

    if len(lignes) > 10:
        message += f"\n... et {len(lignes) - 10} autre(s)"

    await update.message.reply_text(message)


async def stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Commande reservee a l'admin.")
        return

    cursor.execute("SELECT COUNT(*) FROM utilisateurs")
    nb_users = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM favoris")
    nb_favoris = cursor.fetchone()[0]

    cursor.execute(
        "SELECT anime_titre, COUNT(*) AS c FROM favoris "
        "GROUP BY anime_titre ORDER BY c DESC LIMIT 5"
    )
    populaires = cursor.fetchall()

    message = (
        f"Utilisateurs: {nb_users}\n"
        f"Favoris au total: {nb_favoris}\n\n"
        "Animes les plus suivis:\n"
    )

    for titre, nombre in populaires:
        message += f"- {titre} ({nombre})\n"

    await update.message.reply_text(message)


# ---------- Taches automatiques ----------

# ==================================================
# 10. JOBS AUTOMATIQUES
# ==================================================

async def envoyer_une_fois(context, user_id, cle, episode, type_, texte):
    cursor.execute(
        "SELECT 1 FROM rappels_envoyes "
        "WHERE user_id = ? AND cle = ? AND episode = ? AND type = ?",
        (user_id, cle, episode, type_),
    )

    if cursor.fetchone():
        return

    try:
        await asyncio.sleep(0.05)  # rate limit : max ~20 msg/sec
        await context.bot.send_message(chat_id=user_id, text=texte)
    except Forbidden:
        pass
    except Exception as e:
        log.error(f"Erreur envoi a {user_id}: {e}")
        return

    cursor.execute(
        "INSERT INTO rappels_envoyes (user_id, cle, episode, type) "
        "VALUES (?, ?, ?, ?)",
        (user_id, cle, episode, type_),
    )
    conn.commit()


async def verifier_sorties(context: ContextTypes.DEFAULT_TYPE):
    cursor.execute(
        "SELECT f.user_id, f.anime_id, f.anime_titre, COALESCE(r.delai, 24) "
        "FROM favoris f LEFT JOIN reglages r ON r.user_id = f.user_id"
    )
    lignes = cursor.fetchall()

    cache = {}
    compteur = 0
    BATCH_SIZE = 30
    BATCH_DELAY = 0.5

    for user_id, anime_id, titre, delai in lignes:
        compteur += 1
        if compteur % BATCH_SIZE == 0:
            await asyncio.sleep(BATCH_DELAY)
        cle = anime_id if anime_id else titre

        if cle not in cache:
            cache[cle] = recuperer_anime(anime_id, titre)

        anime = cache[cle]

        if not anime:
            continue

        prochain = anime.get("nextAiringEpisode")

        if not prochain:
            continue

        reste = prochain["timeUntilAiring"]
        episode = prochain["episode"]
        nom = titre_de(anime)

        liens = liens_streaming(anime)
        dispo = ""
        if liens:
            dispo = "\nDisponible sur: " + ", ".join(site for site, _ in liens)

        if reste <= 1200:
            texte = (
                f"{nom}\n"
                f"L'episode {episode} sort maintenant ou dans quelques minutes!"
                f"{dispo}\n"
                f"Lien: {anime['siteUrl']}"
            )
            await envoyer_une_fois(context, user_id, str(cle), episode, "sortie", texte)

        elif reste <= delai * 3600:
            texte = (
                f"Rappel: {nom}\n"
                f"L'episode {episode} sort dans {formater_duree(reste)}."
                f"{dispo}\n"
                f"Lien: {anime['siteUrl']}"
            )
            await envoyer_une_fois(context, user_id, str(cle), episode, "rappel", texte)


async def publier_sorties_chaine(context: ContextTypes.DEFAULT_TYPE):
    maintenant = int(time.time())
    items = recuperer_sorties(maintenant, maintenant + 86400, 3)

    items.sort(key=lambda i: i["media"]["popularity"] or 0, reverse=True)
    items = items[:10]

    if not items:
        return

    items.sort(key=lambda i: i["airingAt"])

    message = "Sorties des prochaines 24h (heure du Cameroun):\n\n"

    for item in items:
        heure = datetime.fromtimestamp(item["airingAt"], FUSEAU)

        message += (
            f"{titre_de(item['media'])}\n"
            f"Episode {item['episode']} a {heure.strftime('%H:%M')}\n"
            f"Lien: {item['media']['siteUrl']}\n\n"
        )

    try:
        infos = await context.bot.get_me()
        boutons = InlineKeyboardMarkup(
            [
                [
                    InlineKeyboardButton(
                        "Suivre mes animes",
                        url=f"https://t.me/{infos.username}",
                    )
                ]
            ]
        )
        await context.bot.send_message(
            chat_id=CHAINE_ID,
            text=message,
            reply_markup=boutons,
        )
    except Exception as e:
        log.error(f"Erreur envoi a la chaine: {e}")


# ---------- Sondages et annonces ----------

DUREE_SONDAGE = 12 * 3600
NB_GAGNANTS = 3
VALIDITE_VEDETTES = 10 * 86400

cursor.execute("""
CREATE TABLE IF NOT EXISTS sondages (
    chat_id TEXT,
    message_id INTEGER,
    options TEXT,
    cree_le INTEGER,
    clos INTEGER DEFAULT 0
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS vedettes (
    anime_id INTEGER PRIMARY KEY,
    titre TEXT,
    votes INTEGER,
    ajoute_le INTEGER
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS annonces_envoyees (
    anime_id INTEGER,
    episode INTEGER
)
""")
conn.commit()

QUERY_POPULAIRES = """
query {
  Page(page: 1, perPage: 25) {
    media(type: ANIME, status: RELEASING, isAdult: false, sort: POPULARITY_DESC) {
""" + CHAMPS + """
    }
  }
}
"""


def destinations():
    liste = [CHAINE_ID, globals().get("GROUPE_ID", 0)]
    return [d for d in liste if d]


async def envoyer_media(bot, chat_id, image, texte, boutons):
    if image:
        try:
            await bot.send_photo(
                chat_id=chat_id,
                photo=image,
                caption=texte,
                reply_markup=boutons,
            )
            return
        except Exception as e:
            log.error(f"Erreur envoi image: {e}")

    await bot.send_message(chat_id=chat_id, text=texte, reply_markup=boutons)


async def envoyer_fiche(bot, chat_id, anime):
    texte, boutons = await formater_anime(anime)
    image = (anime.get("coverImage") or {}).get("large")
    await envoyer_media(bot, chat_id, image, texte, boutons)


async def publier_sondage(context: ContextTypes.DEFAULT_TYPE):
    data = appel_anilist(QUERY_POPULAIRES)

    if not data:
        log.warning("Sondage: AniList indisponible")
        return

    options = []

    for anime in data["Page"]["media"]:
        prochain = anime.get("nextAiringEpisode")

        if not prochain or prochain["timeUntilAiring"] > 7 * 86400:
            continue

        options.append({"id": anime["id"], "titre": titre_de(anime)[:95]})

        if len(options) == 8:
            break

    if len(options) < 2:
        log.warning("Sondage: pas assez d'animes")
        return

    maintenant = int(time.time())

    for destination in destinations():
        try:
            message = await context.bot.send_poll(
                chat_id=destination,
                question=(
                    "Quels animes veux-tu voir annonces a chaque sortie "
                    "cette semaine? (plusieurs choix possibles, "
                    "resultats dans 12h)"
                ),
                options=[o["titre"] for o in options],
                allows_multiple_answers=True,
            )
        except Exception as e:
            log.error(f"Erreur sondage a {destination}: {e}")
            continue

        cursor.execute(
            "INSERT INTO sondages (chat_id, message_id, options, cree_le) "
            "VALUES (?, ?, ?, ?)",
            (str(destination), message.message_id, json.dumps(options), maintenant),
        )
        conn.commit()


async def cloturer_sondages(context: ContextTypes.DEFAULT_TYPE):
    maintenant = int(time.time())

    cursor.execute(
        "SELECT chat_id, message_id, options, cree_le FROM sondages "
        "WHERE clos = 0 AND cree_le <= ?",
        (maintenant - DUREE_SONDAGE,),
    )

    for chat_id, message_id, options_json, cree_le in cursor.fetchall():
        options = json.loads(options_json)

        try:
            poll = await context.bot.stop_poll(
                chat_id=chat_id, message_id=message_id
            )
        except Exception as e:
            log.error(f"Erreur cloture sondage {chat_id}/{message_id}: {e}")

            if maintenant - cree_le > 2 * 86400:
                cursor.execute(
                    "UPDATE sondages SET clos = 1 "
                    "WHERE chat_id = ? AND message_id = ?",
                    (chat_id, message_id),
                )
                conn.commit()

            continue

        cursor.execute(
            "UPDATE sondages SET clos = 1 WHERE chat_id = ? AND message_id = ?",
            (chat_id, message_id),
        )
        conn.commit()

        resultats = [
            (choix.voter_count, option)
            for option, choix in zip(options, poll.options)
        ]
        resultats.sort(key=lambda r: r[0], reverse=True)

        gagnants = [r for r in resultats if r[0] > 0][:NB_GAGNANTS]

        if not gagnants:
            await context.bot.send_message(
                chat_id=chat_id,
                text="Sondage termine: aucun vote, pas d'annonce cette semaine.",
            )
            continue

        lignes = ["Resultats du sondage:", ""]

        for i, (votes, option) in enumerate(gagnants, start=1):
            lignes.append(f"{i}. {option['titre']} - {votes} vote(s)")

        lignes.append("")
        lignes.append("Ces animes seront annonces a chaque nouvel episode.")

        await context.bot.send_message(chat_id=chat_id, text="\n".join(lignes))

        for votes, option in gagnants:
            cursor.execute(
                "INSERT OR REPLACE INTO vedettes "
                "(anime_id, titre, votes, ajoute_le) VALUES (?, ?, ?, ?)",
                (option["id"], option["titre"], votes, maintenant),
            )
            conn.commit()

            anime = recuperer_anime(anime_id=option["id"])

            if anime:
                try:
                    await envoyer_fiche(context.bot, chat_id, anime)
                except Exception as e:
                    log.error(f"Erreur fiche: {e}")


async def annoncer_nouvelles_sorties(context: ContextTypes.DEFAULT_TYPE):
    limite = int(time.time()) - VALIDITE_VEDETTES
    cursor.execute("DELETE FROM vedettes WHERE ajoute_le < ?", (limite,))
    conn.commit()

    cursor.execute("SELECT anime_id FROM vedettes")
    ids = [ligne[0] for ligne in cursor.fetchall()]

    for anime_id in ids:
        anime = recuperer_anime(anime_id=anime_id)

        if not anime:
            continue

        prochain = anime.get("nextAiringEpisode")

        if not prochain or prochain["timeUntilAiring"] > 900:
            continue

        episode = prochain["episode"]

        cursor.execute(
            "SELECT 1 FROM annonces_envoyees WHERE anime_id = ? AND episode = ?",
            (anime_id, episode),
        )

        if cursor.fetchone():
            continue

        liens = liens_streaming(anime)
        reste = max(prochain["timeUntilAiring"], 0)

        lignes = [
            "Nouvel episode!",
            f"{titre_de(anime)} - episode {episode}",
            f"Sort dans {formater_duree(reste)}.",
        ]

        if liens:
            lignes.append("Disponible sur: " + ", ".join(site for site, _ in liens))

        texte = "\n".join(lignes)
        boutons = construire_boutons(anime, liens)
        image = (anime.get("coverImage") or {}).get("large")

        envoye = False

        for destination in destinations():
            try:
                await envoyer_media(context.bot, destination, image, texte, boutons)
                envoye = True
            except Exception as e:
                log.error(f"Erreur annonce a {destination}: {e}")

        if envoye:
            cursor.execute(
                "INSERT INTO annonces_envoyees (anime_id, episode) VALUES (?, ?)",
                (anime_id, episode),
            )
            conn.commit()


async def cmd_sondage(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Commande reservee a l'admin.")
        return

    await publier_sondage(context)
    await update.message.reply_text(
        "Sondage publie. Utilise /cloturer pour le fermer tout de suite."
    )


async def cmd_cloturer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Commande reservee a l'admin.")
        return

    cursor.execute("UPDATE sondages SET cree_le = 0 WHERE clos = 0")
    conn.commit()

    await cloturer_sondages(context)
    await update.message.reply_text("Sondages fermes, resultats publies.")


# ---------- Resumes et annonces populaires ----------

HEURES_RESUME = (9, 19)
NB_POPULAIRES = 15

cursor.execute("""
CREATE TABLE IF NOT EXISTS resumes_publies (
    anime_id INTEGER PRIMARY KEY
)
""")
conn.commit()

QUERY_RESUME = """
query ($page: Int) {
  Page(page: $page, perPage: 25) {
    media(type: ANIME, isAdult: false, sort: POPULARITY_DESC) {
""" + CHAMPS + """
      description(asHtml: false)
      genres
      averageScore
      episodes
      seasonYear
    }
  }
}
"""


def nettoyer_resume(texte, limite=350):
    texte = re.sub(r"<[^>]+>", " ", texte or "")
    texte = re.sub(r"\s+", " ", texte).strip()

    if len(texte) <= limite:
        return texte

    coupe = texte[:limite]
    fin = max(coupe.rfind(". "), coupe.rfind("! "), coupe.rfind("? "))

    if fin > 150:
        return coupe[: fin + 1]

    return coupe.rsplit(" ", 1)[0] + "..."


async def publier_resume(context: ContextTypes.DEFAULT_TYPE):
    anime = None

    for _ in range(3):
        data = appel_anilist(QUERY_RESUME, {"page": random.randint(1, 8)})

        if not data:
            continue

        cursor.execute("SELECT anime_id FROM resumes_publies")
        deja = {ligne[0] for ligne in cursor.fetchall()}

        if len(deja) >= 150:
            cursor.execute("DELETE FROM resumes_publies")
            conn.commit()
            deja = set()

        candidats = [
            a for a in data["Page"]["media"]
            if a["id"] not in deja and a.get("description")
        ]

        if candidats:
            anime = random.choice(candidats)
            break

    if not anime:
        log.warning("Resume: aucun anime disponible")
        return

    liens = liens_streaming(anime)

    lignes = [f"A decouvrir: {titre_de(anime)}"]

    infos = []
    if anime.get("seasonYear"):
        infos.append(str(anime["seasonYear"]))
    if anime.get("episodes"):
        infos.append(f"{anime['episodes']} episodes")
    if anime.get("averageScore"):
        infos.append(f"note {anime['averageScore']}/100")
    if infos:
        lignes.append(" - ".join(infos))

    genres = anime.get("genres") or []
    if genres:
        lignes.append("Genres: " + ", ".join(genres[:4]))

    lignes.append("")
    lignes.append(nettoyer_resume(anime["description"]))

    if liens:
        lignes.append("")
        lignes.append("Disponible sur: " + ", ".join(site for site, _ in liens))

    texte = "\n".join(lignes)
    boutons = construire_boutons(anime, liens)
    image = (anime.get("coverImage") or {}).get("large")

    envoye = False

    for destination in destinations():
        try:
            await envoyer_media(context.bot, destination, image, texte, boutons)
            envoye = True
        except Exception as e:
            log.error(f"Erreur resume a {destination}: {e}")

    if envoye:
        cursor.execute(
            "INSERT OR IGNORE INTO resumes_publies (anime_id) VALUES (?)",
            (anime["id"],),
        )
        conn.commit()


async def annoncer_episode(bot, anime, fenetre=360):
    prochain = anime.get("nextAiringEpisode")
    if not prochain or prochain["timeUntilAiring"] > fenetre:
        return

    episode = prochain["episode"]

    cursor.execute(
        "SELECT 1 FROM annonces_envoyees WHERE anime_id = ? AND episode = ?",
        (anime["id"], episode),
    )
    if cursor.fetchone():
        return

    titre = titre_de(anime)
    liens = liens_streaming(anime)
    reste = max(prochain["timeUntilAiring"], 0)
    quand = "Sort maintenant!" if reste < 90 else f"Sort dans {formater_duree(reste)}."

    # Accroche IA (cache 7 jours par anime)
    accroche = await ia_avec_cache(
        f"accroche:{anime['id']}", 7 * 86400,
        lambda: generer_accroche_episode(
            titre,
            anime.get("description") or "",
            anime.get("averageScore") or "?",
            ", ".join((anime.get("genres") or [])[:3]),
            ", ".join((anime.get("studios", {}).get("nodes") or [{}])[0].get("name", "") for _ in [0]) or "?",
            0
        )
    )

    lignes = ["Nouvel episode!", f"{titre} - episode {episode}"]
    if accroche and "indisponible" not in accroche.lower():
        lignes.append("")
        lignes.append(accroche[:250])
    lignes.append("")
    note = anime.get("averageScore")
    if note:
        lignes.append(f"Note : {note}/100")
    genres = ", ".join((anime.get("genres") or [])[:3])
    if genres:
        lignes.append(f"Genres : {genres}")
    lignes.append(quand)
    if liens:
        lignes.append("Disponible sur: " + ", ".join(site for site, _ in liens))

    texte = "\n".join(lignes)
    boutons = construire_boutons(anime, liens)
    image = (anime.get("coverImage") or {}).get("large")

    envoye = False
    for destination in destinations():
        try:
            await envoyer_media(bot, destination, image, texte, boutons)
            envoye = True
        except Exception as e:
            log.error(f"Erreur annonce a {destination}: {e}")

    if envoye:
        cursor.execute(
            "INSERT INTO annonces_envoyees (anime_id, episode) VALUES (?, ?)",
            (anime["id"], episode),
        )
        conn.commit()


async def annoncer_populaires(context: ContextTypes.DEFAULT_TYPE):
    data = appel_anilist(QUERY_POPULAIRES)

    if not data:
        return

    for anime in data["Page"]["media"][:NB_POPULAIRES]:
        await annoncer_episode(context.bot, anime)


async def cmd_resume(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Commande reservee a l'admin.")
        return

    await publier_resume(context)
    await update.message.reply_text("Resume publie.")


# ---------- Sondages personnalises ----------

cursor.execute("""
CREATE TABLE IF NOT EXISTS sondages_perso (
    chat_id TEXT,
    message_id INTEGER,
    options TEXT,
    cree_le INTEGER,
    clos INTEGER DEFAULT 0
)
""")
conn.commit()


async def cmd_sondage_perso(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Commande reservee a l'admin.")
        return

    texte = update.message.text.partition(" ")[2]
    parties = [p.strip() for p in texte.split("|") if p.strip()]

    if len(parties) < 3 or len(parties) > 11:
        await update.message.reply_text(
            "Ecris la question puis 2 a 10 choix, separes par |\n\n"
            "Exemple:\n"
            "/sondage_perso Quel anime regarder ce soir? | One Piece | Naruto | Bleach"
        )
        return

    question = parties[0][:290]
    options = [p[:95] for p in parties[1:]]
    maintenant = int(time.time())
    envoyes = 0

    for destination in destinations():
        try:
            message = await context.bot.send_poll(
                chat_id=destination,
                question=question,
                options=options,
            )
        except Exception as e:
            log.error(f"Erreur sondage perso a {destination}: {e}")
            continue

        cursor.execute(
            "INSERT INTO sondages_perso (chat_id, message_id, options, cree_le) "
            "VALUES (?, ?, ?, ?)",
            (
                str(destination),
                message.message_id,
                json.dumps({"question": question, "options": options}),
                maintenant,
            ),
        )
        conn.commit()
        envoyes += 1

    await update.message.reply_text(
        f"Sondage publie ({envoyes} destination(s)). "
        "Resultats dans 12h, ou /cloturer_perso pour le fermer tout de suite."
    )


async def cloturer_sondages_perso(context: ContextTypes.DEFAULT_TYPE):
    maintenant = int(time.time())

    cursor.execute(
        "SELECT chat_id, message_id, options, cree_le FROM sondages_perso "
        "WHERE clos = 0 AND cree_le <= ?",
        (maintenant - DUREE_SONDAGE,),
    )

    for chat_id, message_id, options_json, cree_le in cursor.fetchall():
        infos = json.loads(options_json)

        try:
            poll = await context.bot.stop_poll(
                chat_id=chat_id, message_id=message_id
            )
        except Exception as e:
            log.error(f"Erreur cloture sondage perso {chat_id}/{message_id}: {e}")

            if maintenant - cree_le > 2 * 86400:
                cursor.execute(
                    "UPDATE sondages_perso SET clos = 1 "
                    "WHERE chat_id = ? AND message_id = ?",
                    (chat_id, message_id),
                )
                conn.commit()

            continue

        cursor.execute(
            "UPDATE sondages_perso SET clos = 1 "
            "WHERE chat_id = ? AND message_id = ?",
            (chat_id, message_id),
        )
        conn.commit()

        resultats = [
            (choix.voter_count, titre)
            for titre, choix in zip(infos["options"], poll.options)
        ]
        resultats.sort(key=lambda r: r[0], reverse=True)

        if not any(votes for votes, _ in resultats):
            texte = f"Sondage termine: {infos['question']}\nAucun vote."
        else:
            lignes = [f"Resultats: {infos['question']}", ""]

            for i, (votes, titre) in enumerate(resultats, start=1):
                lignes.append(f"{i}. {titre} - {votes} vote(s)")

            texte = "\n".join(lignes)

        try:
            await context.bot.send_message(chat_id=chat_id, text=texte)
        except Exception as e:
            log.error(f"Erreur resultats sondage perso: {e}")


async def cmd_cloturer_perso(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Commande reservee a l'admin.")
        return

    cursor.execute("UPDATE sondages_perso SET cree_le = 0 WHERE clos = 0")
    conn.commit()

    await cloturer_sondages_perso(context)
    await update.message.reply_text("Sondages fermes, resultats publies.")


from gemini_ia import cmd_ia, repondre_otaku, generer_paragraphe_reco, generer_synopsis_fr, generer_accroche_episode, demander_openrouter_async

# ---------- Quiz, duels, mentions et recommandations ----------

from telegram.ext import MessageHandler, filters

HEURES_QUIZ = (12, 18)
HEURE_DUEL = 21

GENRES_FR = {
    "Action": "Action",
    "Comedy": "Comedie",
    "Drama": "Drame",
    "Fantasy": "Fantasy",
    "Horror": "Horreur",
    "Mystery": "Mystere",
    "Romance": "Romance",
    "Sci-Fi": "Science-fiction",
    "Slice of Life": "Tranche de vie",
    "Sports": "Sport",
    "Supernatural": "Surnaturel",
    "Thriller": "Thriller",
}

cursor.execute("""
CREATE TABLE IF NOT EXISTS mentions (
    titre TEXT,
    anime_id INTEGER,
    ts INTEGER
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS avis (
    user_id INTEGER,
    anime_id INTEGER,
    titre TEXT,
    note INTEGER,
    PRIMARY KEY (user_id, anime_id)
)
""")
conn.commit()

QUERY_QUIZ = """
query ($page: Int) {
  Page(page: $page, perPage: 25) {
    media(type: ANIME, isAdult: false, sort: POPULARITY_DESC) {
      id
      title { romaji english }
      coverImage { large }
      seasonYear
      episodes
      format
      genres
    }
  }
}
"""

QUERY_RECOS = """
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    recommendations(sort: RATING_DESC, perPage: 8) {
      nodes {
        rating
        mediaRecommendation {
          id
          title { romaji english }
          averageScore
          siteUrl
          isAdult
        }
      }
    }
  }
}
"""

TITRES_CONNUS = {"maj": 0, "dict": {}}


def normaliser(texte):
    return sans_accents((texte or "").lower())


# ----- Quiz -----

def construire_quiz(type_quiz, cible, medias):
    titre = titre_de(cible)

    if type_quiz == "affiche":
        image = (cible.get("coverImage") or {}).get("large")
        autres = [titre_de(m) for m in medias if m["id"] != cible["id"]]

        if not image or len(autres) < 3:
            return None

        options = [o[:95] for o in random.sample(autres, 3) + [titre]]

        if len(set(options)) < 4:
            return None

        random.shuffle(options)

        return {
            "image": image,
            "question": "Quiz anime: quel est cet anime?",
            "options": options,
            "bonne": options.index(titre[:95]),
            "explication": f"C'etait {titre}!",
        }

    if type_quiz == "annee":
        annee = cible.get("seasonYear")

        if not annee:
            return None

        actuelle = datetime.now().year
        candidats = [annee + d for d in (-3, -2, -1, 1, 2, 3) if annee + d <= actuelle]

        if len(candidats) < 3:
            return None

        options = [str(a) for a in random.sample(candidats, 3) + [annee]]
        random.shuffle(options)

        return {
            "image": None,
            "question": f"Quiz anime: en quelle annee est sorti {titre}?",
            "options": options,
            "bonne": options.index(str(annee)),
            "explication": f"{titre} est sorti en {annee}.",
        }

    if type_quiz == "episodes":
        ep = cible.get("episodes")

        if not ep or ep < 6 or cible.get("format") not in ("TV", "TV_SHORT"):
            return None

        candidats = {ep + d for d in (-12, -6, -4, -2, 2, 4, 6, 12, 24) if ep + d > 0}
        candidats.discard(ep)

        if len(candidats) < 3:
            return None

        options = [str(n) for n in random.sample(sorted(candidats), 3) + [ep]]
        random.shuffle(options)

        return {
            "image": None,
            "question": f"Quiz anime: combien d'episodes compte {titre}?",
            "options": options,
            "bonne": options.index(str(ep)),
            "explication": f"{titre} compte {ep} episodes.",
        }

    if type_quiz == "genre":
        genres = cible.get("genres") or []
        connus = [g for g in genres if g in GENRES_FR]
        autres = [g for g in GENRES_FR if g not in genres]

        if not connus or len(autres) < 3:
            return None

        bon = GENRES_FR[random.choice(connus)]
        options = [GENRES_FR[g] for g in random.sample(autres, 3)] + [bon]
        random.shuffle(options)

        return {
            "image": None,
            "question": f"Quiz anime: quel genre correspond a {titre}?",
            "options": options,
            "bonne": options.index(bon),
            "explication": f"{titre}: " + ", ".join(genres[:4]),
        }

    return None


def preparer_quiz():
    for _ in range(4):
        data = appel_anilist(QUERY_QUIZ, {"page": random.randint(1, 6)})

        if not data:
            continue

        medias = data["Page"]["media"]

        if len(medias) < 8:
            continue

        cible = random.choice(medias)
        type_quiz = random.choice(["affiche", "annee", "episodes", "genre"])
        quiz = construire_quiz(type_quiz, cible, medias)

        if quiz:
            return quiz

    return None


async def publier_quiz(context: ContextTypes.DEFAULT_TYPE):
    quiz = preparer_quiz()

    if not quiz:
        log.warning("Quiz: impossible d'en preparer un")
        return

    for destination in destinations():
        try:
            if quiz["image"]:
                await context.bot.send_photo(
                    chat_id=destination,
                    photo=quiz["image"],
                    caption="Quiz anime: regarde bien l'affiche.",
                )

            await context.bot.send_poll(
                chat_id=destination,
                question=quiz["question"][:290],
                options=quiz["options"],
                type="quiz",
                correct_option_id=quiz["bonne"],
                explanation=quiz["explication"][:190],
            )
        except Exception as e:
            log.error(f"Erreur quiz a {destination}: {e}")


async def publier_duel(context: ContextTypes.DEFAULT_TYPE):
    data = appel_anilist(QUERY_QUIZ, {"page": random.randint(1, 3)})

    if not data or len(data["Page"]["media"]) < 2:
        log.warning("Duel: impossible")
        return

    a, b = random.sample(data["Page"]["media"], 2)

    options = [titre_de(a)[:95], titre_de(b)[:95], "Les deux!"]

    for destination in destinations():
        try:
            await context.bot.send_poll(
                chat_id=destination,
                question="Duel du jour: lequel est le meilleur?",
                options=options,
            )
        except Exception as e:
            log.error(f"Erreur duel a {destination}: {e}")


# ----- Animes dont on parle -----

async def rafraichir_titres(context: ContextTypes.DEFAULT_TYPE):
    titres = {}

    data = appel_anilist(QUERY_POPULAIRES)

    if data:
        for anime in data["Page"]["media"]:
            for nom in (anime["title"].get("english"), anime["title"].get("romaji")):
                if nom and len(nom) >= 5:
                    titres[normaliser(nom)] = (anime["id"], titre_de(anime))

    cursor.execute("SELECT anime_id, titre FROM vedettes")
    for anime_id, titre in cursor.fetchall():
        if titre and len(titre) >= 5:
            titres[normaliser(titre)] = (anime_id, titre)

    cursor.execute(
        "SELECT DISTINCT anime_id, anime_titre FROM favoris WHERE anime_id IS NOT NULL"
    )
    for anime_id, titre in cursor.fetchall():
        if titre and len(titre) >= 5:
            titres[normaliser(titre)] = (anime_id, titre)

    if titres:
        TITRES_CONNUS["maj"] = time.time()
        TITRES_CONNUS["dict"] = titres


async def compter_mentions(update: Update, context: ContextTypes.DEFAULT_TYPE):
    message = update.effective_message

    if not message or not message.text or not TITRES_CONNUS["dict"]:
        return

    texte = normaliser(message.text)
    trouves = {}

    for cle, (anime_id, titre) in TITRES_CONNUS["dict"].items():
        if re.search(r"(?<![a-z0-9])" + re.escape(cle) + r"(?![a-z0-9])", texte):
            trouves[anime_id] = titre

    if not trouves:
        return

    maintenant = int(time.time())

    for anime_id, titre in trouves.items():
        cursor.execute(
            "INSERT INTO mentions (titre, anime_id, ts) VALUES (?, ?, ?)",
            (titre, anime_id, maintenant),
        )

    conn.commit()


def top_mentions(jours=7, limite=5):
    depuis = int(time.time()) - jours * 86400

    cursor.execute(
        "SELECT anime_id, titre, COUNT(*) AS nb FROM mentions "
        "WHERE ts >= ? GROUP BY anime_id ORDER BY nb DESC LIMIT ?",
        (depuis, limite),
    )

    return cursor.fetchall()


async def promouvoir_mentions(context: ContextTypes.DEFAULT_TYPE):
    cursor.execute(
        "DELETE FROM mentions WHERE ts < ?", (int(time.time()) - 14 * 86400,)
    )
    conn.commit()

    gagnants = [m for m in top_mentions(7, 3) if m[2] >= 3]

    if not gagnants:
        return

    maintenant = int(time.time())
    lignes = ["Les animes dont on a le plus parle cette semaine:", ""]

    for i, (anime_id, titre, nb) in enumerate(gagnants, start=1):
        cursor.execute(
            "INSERT OR REPLACE INTO vedettes (anime_id, titre, votes, ajoute_le) "
            "VALUES (?, ?, ?, ?)",
            (anime_id, titre, nb, maintenant),
        )
        lignes.append(f"{i}. {titre} - {nb} mention(s)")

    conn.commit()

    lignes.append("")
    lignes.append("Ils seront annonces a chaque nouvel episode.")

    for destination in destinations():
        try:
            await context.bot.send_message(chat_id=destination, text="\n".join(lignes))
        except Exception as e:
            log.error(f"Erreur mentions a {destination}: {e}")


# ----- Avis et recommandations -----

async def noter(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args

    if len(args) < 2 or not args[-1].isdigit() or not 1 <= int(args[-1]) <= 10:
        await update.message.reply_text(
            "Donne une note de 1 a 10.\n"
            "Exemple: /noter One Piece 9"
        )
        return

    note = int(args[-1])
    nom = " ".join(args[:-1])

    resultats = chercher_anime(nom)

    if not resultats:
        await update.message.reply_text("Aucun anime trouve. Essaie un autre nom.")
        return

    anime = resultats[0]
    titre = titre_de(anime)

    cursor.execute(
        "INSERT OR REPLACE INTO avis (user_id, anime_id, titre, note) "
        "VALUES (?, ?, ?, ?)",
        (update.effective_user.id, anime["id"], titre, note),
    )
    conn.commit()

    await update.message.reply_text(f"Note enregistree: {titre} {note}/10.")


async def classement(update: Update, context: ContextTypes.DEFAULT_TYPE):
    cursor.execute(
        "SELECT titre, AVG(note) AS moy, COUNT(*) AS nb FROM avis "
        "GROUP BY anime_id ORDER BY moy DESC, nb DESC LIMIT 10"
    )

    lignes = cursor.fetchall()

    if not lignes:
        await update.message.reply_text(
            "Aucun avis pour le moment.\n"
            "Utilise /noter One Piece 9"
        )
        return

    message = "Les mieux notes par la communaute:\n\n"

    for i, (titre, moy, nb) in enumerate(lignes, start=1):
        message += f"{i}. {titre} - {moy:.1f}/10 ({nb} avis)\n"

    await update.message.reply_text(message)


async def recommande(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id

    cursor.execute(
        "SELECT anime_id, anime_titre FROM favoris WHERE user_id = ?", (user_id,)
    )
    favoris_user = cursor.fetchall()

    cursor.execute(
        "SELECT anime_id, titre FROM avis WHERE user_id = ? AND note >= 7", (user_id,)
    )
    aimes = cursor.fetchall()

    cursor.execute("SELECT anime_id FROM avis WHERE user_id = ?", (user_id,))
    exclus = {ligne[0] for ligne in cursor.fetchall()}
    exclus |= {a for a, _ in favoris_user if a}
    titres_exclus = {normaliser(t) for _, t in favoris_user}

    graines = list({(a, t) for a, t in aimes} | {(a, t) for a, t in favoris_user})

    if not graines:
        await update.message.reply_text(
            "Ajoute des favoris avec /ajouter ou note des animes avec /noter, "
            "puis relance /recommande.\n"
            "En attendant, essaie /top ou /classement."
        )
        return

    random.shuffle(graines)
    candidats = {}
    bases = []

    for anime_id, titre in graines[:3]:
        if not anime_id:
            anime = recuperer_anime(titre=titre)
            anime_id = anime["id"] if anime else None

        if not anime_id:
            continue

        exclus.add(anime_id)
        bases.append(titre)

        data = appel_anilist(QUERY_RECOS, {"id": anime_id})

        if not data or not data.get("Media"):
            continue

        for noeud in data["Media"]["recommendations"]["nodes"]:
            rec = noeud.get("mediaRecommendation")

            if not rec or rec["isAdult"] or (noeud.get("rating") or 0) < 1:
                continue

            candidats[rec["id"]] = rec

    choix = [
        r for r in candidats.values()
        if r["id"] not in exclus and normaliser(titre_de(r)) not in titres_exclus
    ]
    choix.sort(key=lambda r: r.get("averageScore") or 0, reverse=True)
    choix = choix[:5]

    lignes = []

    if choix:
        lignes.append("Pour toi, d'apres " + ", ".join(bases) + ":")
        lignes.append("")

        for i, rec in enumerate(choix, start=1):
            score = rec.get("averageScore")
            note = f" - note {score / 10:.1f}/10" if score else ""
            lignes.append(f"{i}. {titre_de(rec)}{note}")
            lignes.append(rec["siteUrl"])

    if choix:
        try:
            titres_rec = [titre_de(r) for r in choix[:5]]
            cl = "reco:" + "|".join(sorted(bases))[:100] + ":" + "|".join(titres_rec)[:80]
            texte_ia = await ia_avec_cache(
                cl, 86400,
                lambda: generer_paragraphe_reco(bases[:3], titres_rec, 0)
            )
            if texte_ia and "indisponible" not in texte_ia.lower():
                lignes.append("")
                lignes.append("Pourquoi ces choix ?")
                lignes.append(texte_ia[:800])
        except Exception as e:
            log.warning(f"IA reco: {e}")

    cursor.execute(
        "SELECT anime_id, titre, AVG(note) AS moy, COUNT(*) AS nb FROM avis "
        "GROUP BY anime_id HAVING AVG(note) >= 8 ORDER BY moy DESC LIMIT 6"
    )
    communaute = [c for c in cursor.fetchall() if c[0] not in exclus][:3]

    if communaute:
        if lignes:
            lignes.append("")

        lignes.append("Aimes par la communaute:")

        for anime_id, titre, moy, nb in communaute:
            lignes.append(f"- {titre} ({moy:.1f}/10, {nb} avis)")

    if not lignes:
        lignes = ["Je n'ai rien de nouveau a te proposer pour le moment. Essaie /top."]

    await update.message.reply_text("\n".join(lignes))


# ----- Commandes admin -----

# ==================================================
# 13. QUIZ / DUEL / MENTIONS
# ==================================================

async def cmd_quiz(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Commande reservee a l'admin.")
        return

    await publier_quiz(context)
    await update.message.reply_text("Quiz publie.")


async def cmd_duel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Commande reservee a l'admin.")
        return

    await publier_duel(context)
    await update.message.reply_text("Duel publie.")


async def cmd_mentions(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Commande reservee a l'admin.")
        return

    lignes = top_mentions(7, 10)

    if not lignes:
        await update.message.reply_text(
            "Aucune mention cette semaine.\n"
            "Verifie que la confidentialite du bot est desactivee dans BotFather."
        )
        return

    message = "Animes les plus cites cette semaine:\n\n"

    for i, (anime_id, titre, nb) in enumerate(lignes, start=1):
        message += f"{i}. {titre} - {nb}\n"

    await update.message.reply_text(message)


# ---------- Canaux partenaires ----------

HEURE_CANAUX = 13

CANAUX_PARTENAIRES = [
    ("My Anime", "https://t.me/myanime67"),
    ("Anime Galaxy", "https://t.me/Anime_GalaxyOfficial"),
    ("Mangas Japanimation", "https://t.me/Mangas_Japanimations"),
    ("Anime Home Japan", "https://t.me/OTAKU_HOME17"),
    ("Hebdo Zone", "https://t.me/HebdoZone5"),
    ("Mangas Otaku VF", "https://t.me/Btooomvf"),
]

TEXTE_CANAUX = (
    "Canaux partenaires de la communaute AnimeAlert.\n"
    "Appuie sur un bouton pour rejoindre."
)


def clavier_canaux():
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton(nom, url=lien)] for nom, lien in CANAUX_PARTENAIRES]
    )


# ==================================================
# 15. CANAUX PARTENAIRES
# ==================================================

async def canaux(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(TEXTE_CANAUX, reply_markup=clavier_canaux())


async def publier_canaux(context: ContextTypes.DEFAULT_TYPE):
    for destination in destinations():
        try:
            await context.bot.send_message(
                chat_id=destination,
                text=TEXTE_CANAUX,
                reply_markup=clavier_canaux(),
            )
        except Exception as e:
            log.error(f"Erreur canaux a {destination}: {e}")


# ---------- Recherche par annee et saison ----------

ANNEE_DEBUT = 2010

SAISONS = {
    "hiver": "WINTER", "winter": "WINTER",
    "printemps": "SPRING", "spring": "SPRING",
    "ete": "SUMMER", "summer": "SUMMER",
    "automne": "FALL", "fall": "FALL", "autumn": "FALL",
}

NOMS_SAISONS = {
    "WINTER": "de l'hiver",
    "SPRING": "du printemps",
    "SUMMER": "de l'ete",
    "FALL": "de l'automne",
}

QUERY_SAISON = """
query ($season: MediaSeason, $year: Int, $debut: FuzzyDateInt, $fin: FuzzyDateInt) {
  Page(page: 1, perPage: 10) {
    media(
      type: ANIME
      isAdult: false
      season: $season
      seasonYear: $year
      startDate_greater: $debut
      startDate_lesser: $fin
      sort: POPULARITY_DESC
    ) {
      title { romaji english }
      averageScore
      siteUrl
    }
  }
}
"""


def annee_max():
    maintenant = datetime.now()
    return maintenant.year + (1 if maintenant.month >= 10 else 0)


def lire_periode(args):
    code = None
    annees = []

    for mot in args:
        m = sans_accents(mot.lower())

        if m in SAISONS:
            code = SAISONS[m]

        annees += [int(a) for a in re.findall(r"\d{4}", m)]

    annees = [a for a in annees if 1970 <= a <= annee_max()]

    if annees:
        return code, min(annees), max(annees)

    return code, None, None


def clavier_saisons():
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("Hiver", callback_data="sai:WINTER"),
                InlineKeyboardButton("Printemps", callback_data="sai:SPRING"),
            ],
            [
                InlineKeyboardButton("Ete", callback_data="sai:SUMMER"),
                InlineKeyboardButton("Automne", callback_data="sai:FALL"),
            ],
            [InlineKeyboardButton("Toute l'annee", callback_data="sai:ALL")],
        ]
    )


def clavier_annees(code):
    annees = list(range(annee_max(), ANNEE_DEBUT - 1, -1))
    lignes = []

    for i in range(0, len(annees), 4):
        lignes.append(
            [
                InlineKeyboardButton(str(a), callback_data=f"sy:{code}:{a}")
                for a in annees[i:i + 4]
            ]
        )

    return InlineKeyboardMarkup(lignes)


async def envoyer_periode(message, code, a1, a2):
    variables = {}

    if code and code != "ALL":
        variables["season"] = code

    if a1 is not None:
        if a1 == a2:
            variables["year"] = a1
        else:
            variables["debut"] = (a1 - 1) * 10000 + 1231
            variables["fin"] = (a2 + 1) * 10000 + 101

    data = appel_anilist(QUERY_SAISON, variables)

    if not data or not data["Page"]["media"]:
        await message.reply_text("Aucun anime trouve pour cette periode.")
        return

    quand = NOMS_SAISONS[code] if code in NOMS_SAISONS else ""

    if a1 is None:
        periode = ""
    elif a1 == a2:
        periode = str(a1)
    else:
        periode = f"{a1} a {a2}"

    if quand and periode:
        titre = f"Les animes {quand} {periode}"
    elif quand:
        titre = f"Les animes {quand}"
    else:
        titre = f"Les animes de {periode}"

    await message.reply_text(
        lister_animes(f"{titre} (les plus populaires):", data["Page"]["media"])
    )


# ==================================================
# 14. SAISON / ANNEE
# ==================================================

async def cmd_saison(update: Update, context: ContextTypes.DEFAULT_TYPE):
    code, a1, a2 = lire_periode(context.args)

    if code is None and a1 is None:
        await update.message.reply_text(
            "Choisis une saison.\n\n"
            "Ou ecris par exemple:\n"
            "/saison 2024 ete\n"
            "/annee 2015\n"
            "/annee 2010-2026",
            reply_markup=clavier_saisons(),
        )
        return

    if code and a1 is None:
        await update.message.reply_text(
            "Choisis l'annee:", reply_markup=clavier_annees(code)
        )
        return

    await envoyer_periode(update.message, code, a1, a2)


async def saison_bouton(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()

    parties = (q.data or "").split(":")

    try:
        if parties[0] == "sai" and len(parties) == 2:
            await q.edit_message_text(
                "Choisis l'annee:", reply_markup=clavier_annees(parties[1])
            )
        elif parties[0] == "sy" and len(parties) == 3:
            annee = int(parties[2])
            await envoyer_periode(q.message, parties[1], annee, annee)
    except Exception as e:
        log.error(f"Erreur bouton saison: {e}")


# ---------- Abonnement obligatoire a la chaine ----------

from telegram.ext import ApplicationHandlerStop

STATUTS_MEMBRES = ("member", "administrator", "creator")
ABONNES = {}


async def est_abonne(bot, user_id):
    if time.time() - ABONNES.get(user_id, 0) < 600:
        return True

    try:
        membre = await bot.get_chat_member(chat_id=CHAINE_ID, user_id=user_id)
    except Exception as e:
        log.error(f"Erreur verification abonnement (le bot est-il admin de la chaine?): {e}")
        return True

    if membre.status in STATUTS_MEMBRES or (
        membre.status == "restricted" and getattr(membre, "is_member", False)
    ):
        ABONNES[user_id] = time.time()
        return True

    return False


# ==================================================
# 16. GATE ABONNEMENT CHAINE
# ==================================================

async def verifier_abonnement(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    chat = update.effective_chat

    if not user or user.is_bot or not chat or chat.type != "private":
        return

    if user.id == ADMIN_ID:
        return

    q = update.callback_query

    if q and q.data == "verif_abo":
        return

    if await est_abonne(context.bot, user.id):
        return

    boutons = InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "Rejoindre la chaine",
                    url=f"https://t.me/{CHAINE_ID.replace('@', '')}",
                )
            ],
            [InlineKeyboardButton("J'ai rejoint", callback_data="verif_abo")],
        ]
    )

    if q:
        await q.answer("Rejoins d'abord la chaine.", show_alert=True)
    elif update.effective_message:
        await update.effective_message.reply_text(
            "Pour utiliser le bot, rejoins d'abord la chaine AnimeAlert Buea, "
            "puis appuie sur \"J'ai rejoint\".",
            reply_markup=boutons,
        )

    raise ApplicationHandlerStop


async def verifier_bouton(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query

    if await est_abonne(context.bot, q.from_user.id):
        await q.answer("Merci! Tu peux utiliser le bot.", show_alert=True)

        try:
            await q.message.reply_text("Bienvenue! Tape /aide pour voir les commandes.")
        except Exception:
            pass
    else:
        await q.answer("Tu n'as pas encore rejoint la chaine.", show_alert=True)


# ---------- Premium et liens d'episodes ----------

try:
    from telegram import LinkPreviewOptions
    SANS_APERCU = {"link_preview_options": LinkPreviewOptions(is_disabled=True)}
except ImportError:
    SANS_APERCU = {}

PREMIUM_ACTIF = False
LIMITE_GRATUITE = 5

LIEN_TG = re.compile(r"^https://t\.me/(c/\d+|[A-Za-z0-9_]{4,})/\d+$")

cursor.execute("""
CREATE TABLE IF NOT EXISTS premium (
    user_id INTEGER PRIMARY KEY,
    expire_le INTEGER
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS liens_episodes (
    anime_id INTEGER,
    titre TEXT,
    episode INTEGER,
    lien TEXT,
    PRIMARY KEY (anime_id, episode)
)
""")
conn.commit()


def date_fr(ts):
    return datetime.fromtimestamp(ts, FUSEAU).strftime("%d/%m/%Y")


def lire_expiration(user_id):
    cursor.execute("SELECT expire_le FROM premium WHERE user_id = ?", (user_id,))
    ligne = cursor.fetchone()
    return ligne[0] if ligne else 0


def est_premium(user_id):
    return user_id == ADMIN_ID or lire_expiration(user_id) > time.time()


def nb_favoris(user_id):
    cursor.execute("SELECT COUNT(*) FROM favoris WHERE user_id = ?", (user_id,))
    return cursor.fetchone()[0]


def peut_ajouter(user_id):
    if not PREMIUM_ACTIF or est_premium(user_id):
        return True

    return nb_favoris(user_id) < LIMITE_GRATUITE


def message_limite():
    return (
        f"Tu suis deja {LIMITE_GRATUITE} animes, la limite de l'offre gratuite. "
        "Tape /premium pour en suivre sans limite."
    )


def deja_favori(user_id, anime):
    cursor.execute(
        "SELECT 1 FROM favoris WHERE user_id = ? AND (anime_id = ? OR anime_titre = ?)",
        (user_id, anime["id"], titre_de(anime)),
    )
    return cursor.fetchone() is not None


# ----- Commandes modifiees pour tenir compte de la limite -----

async def ajouter(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text(
            "Ecris le nom de l'anime.\n"
            "Exemple: /ajouter One Piece"
        )
        return

    nom = " ".join(context.args)
    resultats = chercher_anime(nom)

    if not resultats:
        await update.message.reply_text(
            "Aucun anime trouve.\n"
            "Essaie un autre nom."
        )
        return

    anime = resultats[0]
    titre = titre_de(anime)
    user_id = update.effective_user.id

    if not deja_favori(user_id, anime) and not peut_ajouter(user_id):
        await update.message.reply_text(message_limite())
        return

    if ajouter_favori(user_id, anime):
        await update.message.reply_text(f"{titre} ajoute a tes favoris.")
    else:
        await update.message.reply_text(f"{titre} est deja dans tes favoris.")


async def bouton(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query

    try:
        anime_id = int(q.data.split(":")[1])
    except (IndexError, ValueError):
        await q.answer()
        return

    anime = recuperer_anime(anime_id=anime_id)

    if not anime:
        await q.answer("Impossible de recuperer cet anime.", show_alert=True)
        return

    titre = titre_de(anime)
    user_id = q.from_user.id

    if not deja_favori(user_id, anime) and not peut_ajouter(user_id):
        await q.answer(message_limite(), show_alert=True)
        return

    if ajouter_favori(user_id, anime):
        await q.answer(f"{titre} ajoute a tes favoris.", show_alert=True)
    else:
        await q.answer("Deja dans tes favoris.", show_alert=True)


async def rappel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id

    if not context.args:
        cursor.execute("SELECT delai FROM reglages WHERE user_id = ?", (user_id,))
        ligne = cursor.fetchone()
        actuel = ligne[0] if ligne else 24

        await update.message.reply_text(
            f"Tu es prevenu {actuel}h avant la sortie, "
            "et aussi quand l'episode sort.\n\n"
            "Pour changer: /rappel 1, /rappel 3 ou /rappel 24"
        )
        return

    chiffres = "".join(c for c in context.args[0] if c.isdigit())

    if chiffres not in ("1", "3", "24"):
        await update.message.reply_text("Choisis 1, 3 ou 24. Exemple: /rappel 3")
        return

    if chiffres in ("1", "3") and PREMIUM_ACTIF and not est_premium(user_id):
        await update.message.reply_text(
            "Les rappels 1h et 3h avant sont reserves au premium. "
            "Tape /premium pour en savoir plus. "
            "Le rappel 24h reste gratuit."
        )
        return

    cursor.execute(
        "INSERT OR REPLACE INTO reglages (user_id, delai) VALUES (?, ?)",
        (user_id, int(chiffres)),
    )
    conn.commit()

    await update.message.reply_text(
        f"C'est note: tu seras prevenu {chiffres}h avant la sortie."
    )


# ----- Premium -----

# ==================================================
# 12. PREMIUM
# ==================================================

async def cmd_premium(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id

    if not PREMIUM_ACTIF:
        await update.message.reply_text(
            "Tout est gratuit pour le moment. "
            "Une offre premium arrivera plus tard."
        )
        return

    lignes = [
        "Offre gratuite:",
        f"- jusqu'a {LIMITE_GRATUITE} animes suivis",
        "- rappel 24h avant et a la sortie",
        "",
        "Premium:",
        "- animes suivis sans limite",
        "- rappels 1h et 3h avant",
        "",
    ]

    expire = lire_expiration(user_id)

    if user_id == ADMIN_ID:
        lignes.append("Tu es admin: tout est debloque.")
    elif expire > time.time():
        lignes.append(f"Ton premium est actif jusqu'au {date_fr(expire)}.")
    else:
        lignes.append("Tu es sur l'offre gratuite.")

    await update.message.reply_text("\n".join(lignes))


async def cmd_premium_ajouter(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Commande reservee a l'admin.")
        return

    args = context.args

    if len(args) != 2 or not args[0].isdigit() or not args[1].isdigit():
        await update.message.reply_text(
            "Exemple: /premium_ajouter 123456789 30\n"
            "(identifiant Telegram, nombre de jours)"
        )
        return

    user_id = int(args[0])
    jours = int(args[1])

    base = max(time.time(), lire_expiration(user_id))
    expire = int(base + jours * 86400)

    cursor.execute(
        "INSERT OR REPLACE INTO premium (user_id, expire_le) VALUES (?, ?)",
        (user_id, expire),
    )
    conn.commit()

    await update.message.reply_text(
        f"Premium accorde a {user_id} jusqu'au {date_fr(expire)}."
    )


async def cmd_premium_retirer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Commande reservee a l'admin.")
        return

    if len(context.args) != 1 or not context.args[0].isdigit():
        await update.message.reply_text("Exemple: /premium_retirer 123456789")
        return

    cursor.execute("DELETE FROM premium WHERE user_id = ?", (int(context.args[0]),))
    conn.commit()

    await update.message.reply_text("Premium retire.")


# ----- Liens d'episodes -----

async def cmd_lien(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Commande reservee a l'admin.")
        return

    texte = update.message.text.partition(" ")[2]
    parties = [p.strip() for p in texte.split("|")]

    if len(parties) != 3 or not parties[1].isdigit() or not LIEN_TG.match(parties[2]):
        await update.message.reply_text(
            "Format:\n"
            "/lien One Piece | 1090 | https://t.me/nom_du_canal/123\n\n"
            "Le lien doit pointer vers un message precis du canal."
        )
        return

    resultats = await chercher_anime_ia(parties[0], ADMIN_ID, "lien")

    if not resultats:
        await update.message.reply_text("Aucun anime trouve pour ce titre.")
        return

    anime = resultats[0]
    episode = int(parties[1])

    cursor.execute(
        "INSERT OR REPLACE INTO liens_episodes (anime_id, titre, episode, lien) "
        "VALUES (?, ?, ?, ?)",
        (anime["id"], titre_de(anime), episode, parties[2]),
    )
    conn.commit()

    await update.message.reply_text(
        f"Lien enregistre: {titre_de(anime)}, episode {episode}."
    )


async def cmd_retirer_lien(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Commande reservee a l'admin.")
        return

    texte = update.message.text.partition(" ")[2]
    parties = [p.strip() for p in texte.split("|")]

    if len(parties) != 2 or not parties[1].isdigit():
        await update.message.reply_text("Exemple: /retirer_lien One Piece | 1090")
        return

    resultats = chercher_anime(parties[0])

    if not resultats:
        await update.message.reply_text("Aucun anime trouve pour ce titre.")
        return

    cursor.execute(
        "DELETE FROM liens_episodes WHERE anime_id = ? AND episode = ?",
        (resultats[0]["id"], int(parties[1])),
    )
    conn.commit()

    await update.message.reply_text("Lien retire.")


EPISODES_PAR_PAGE = 20


def _formater_page_episodes(titre, episodes, page, total_pages, videos_set=None):
    debut = page * EPISODES_PAR_PAGE
    bloc = episodes[debut:debut + EPISODES_PAR_PAGE]
    lignes = [f"{titre} - episodes sur Telegram"]
    lignes.append(f"Page {page + 1}/{total_pages} ({len(episodes)} episode(s))")
    lignes.append("")
    for ep, lien in bloc:
        a_video = videos_set and ep in videos_set
        if lien and a_video:
            lignes.append(f"Episode {ep}: {lien}  [video ci-dessous]")
        elif lien:
            lignes.append(f"Episode {ep}: {lien}")
        elif a_video:
            lignes.append(f"Episode {ep}: [video ci-dessous]")
        else:
            lignes.append(f"Episode {ep}: (pas de lien)")
    return "\n".join(lignes)


def _clavier_pagination(anime_id, page, total_pages, bloc=None, videos_set=None):
    boutons = []
    if videos_set and bloc:
        ligne_video = []
        for ep, _ in bloc:
            if ep in videos_set:
                ligne_video.append(InlineKeyboardButton(f"📥 Ep. {ep}", callback_data=f"dlv:{anime_id}:{ep}"))
                if len(ligne_video) == 2:
                    boutons.append(ligne_video); ligne_video = []
        if ligne_video: boutons.append(ligne_video)
    ligne_nav = []
    if page > 0:
        ligne_nav.append(InlineKeyboardButton("◀ Precedent", callback_data=f"ep:{anime_id}:{page - 1}"))
    ligne_nav.append(InlineKeyboardButton(f"{page + 1}/{total_pages}", callback_data="ep:none:0"))
    if page < total_pages - 1:
        ligne_nav.append(InlineKeyboardButton("Suivant ▶", callback_data=f"ep:{anime_id}:{page + 1}"))
    if len(ligne_nav) > 1: boutons.append(ligne_nav)
    boutons.append([InlineKeyboardButton("📥 Tout en fichier .txt", callback_data=f"ep:{anime_id}:all")])
    return InlineKeyboardMarkup(boutons)


async def cmd_episodes(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text(
            "Ecris le nom de l'anime.\n\n"
            "/episodes One Piece          (liste paginee)\n"
            "/episodes One Piece 500      (episode precis)\n"
            "/episodes One Piece 500-550  (plage)\n"
            "/episodes One Piece all      (fichier .txt)"
        )
        return
    args = list(context.args)
    mode = "page"; num = None
    if args and args[-1].lower() == "all":
        mode = "all"; args.pop()
    elif args and "-" in args[-1] and args[-1].replace("-", "").isdigit():
        p = args[-1].split("-")
        if len(p) == 2 and p[0].isdigit() and p[1].isdigit():
            mode = "plage"; num = (int(p[0]), int(p[1])); args.pop()
    elif args and args[-1].isdigit():
        mode = "unique"; num = int(args[-1]); args.pop()
    if not args:
        await update.message.reply_text("Precise le nom de l'anime."); return
    resultats = chercher_anime(" ".join(args))
    if not resultats:
        await update.message.reply_text("Aucun anime trouve."); return
    anime = resultats[0]; titre = titre_de(anime); anime_id = anime["id"]

    cursor.execute("SELECT episode, lien FROM liens_episodes WHERE anime_id = ?", (anime_id,))
    liens_map = dict(cursor.fetchall())
    cursor.execute("SELECT episode FROM videos_episodes WHERE anime_id = ?", (anime_id,))
    videos_set = {row[0] for row in cursor.fetchall()}
    episodes_map = dict(liens_map)
    for ep in videos_set:
        if ep not in episodes_map: episodes_map[ep] = None
    tous = sorted(episodes_map.items(), key=lambda x: -x[0])
    if not tous:
        await update.message.reply_text(f"Aucun episode pour {titre}."); return

    if mode == "unique":
        if num in videos_set:
            cursor.execute(
                "SELECT file_id, type, archive_file_id, archive_type "
                "FROM videos_episodes WHERE anime_id=? AND episode=?",
                (anime_id, num)
            )
            fid, typ, arch_fid, arch_type = cursor.fetchone()

            # Essai 1 : original
            try:
                if typ == "video":
                    await update.message.reply_video(video=fid, caption=f"{titre} - Ep. {num}")
                else:
                    await update.message.reply_document(document=fid, caption=f"{titre} - Ep. {num}")
                return
            except Exception as e:
                log.warning(f"Ep unique original echoue: {e}")

            # Essai 2 : archive
            if arch_fid:
                try:
                    if arch_type == "video":
                        await update.message.reply_video(video=arch_fid, caption=f"{titre} - Ep. {num} [archive]")
                    else:
                        await update.message.reply_document(document=arch_fid, caption=f"{titre} - Ep. {num} [archive]")
                    return
                except Exception as e:
                    log.error(f"Ep unique archive echoue: {e}")

            await update.message.reply_text(f"⚠️ {titre} Ep. {num} inaccessible (original + archive)")
            return
        cible = [(ep, l) for ep, l in tous if ep == num]
        if not cible:
            await update.message.reply_text(f"Episode {num} non trouve."); return
        await update.message.reply_text(f"{titre} - episode {num}\n\n{cible[0][1]}", **SANS_APERCU)
        return

    if mode == "plage":
        d, f = num
        plage = [(ep, l) for ep, l in tous if d <= ep <= f]
        if not plage:
            await update.message.reply_text(f"Aucun episode entre {d} et {f}."); return
        if len(plage) > 100:
            await update.message.reply_text("Plage trop grande (max 100)."); return
        lignes = [f"{titre} - episodes {d} a {f}", ""]
        for ep, l in plage:
            v = "  [video]" if ep in videos_set else ""
            lignes.append(f"Episode {ep}: {l or '(video)'}{v}")
        await update.message.reply_text("\n".join(lignes), **SANS_APERCU)
        return

    if mode == "all":
        lignes = [f"# {titre} - tous les episodes", ""]
        for ep, l in tous:
            v = "  [video]" if ep in videos_set else ""
            lignes.append(f"Episode {ep}: {l or '(video)'}{v}")
        tampon = io.BytesIO("\n".join(lignes).encode("utf-8"))
        nom = "".join(c for c in titre if c.isalnum() or c in "_- ").strip().replace(" ", "_") or "episodes"
        tampon.name = f"{nom}_episodes.txt"
        await update.message.reply_document(document=tampon, filename=tampon.name, caption=f"{titre} : {len(tous)} episode(s).")
        return

    total_pages = (len(tous) + EPISODES_PAR_PAGE - 1) // EPISODES_PAR_PAGE
    bloc = tous[:EPISODES_PAR_PAGE]
    texte = _formater_page_episodes(titre, tous, 0, total_pages, videos_set)
    clavier = _clavier_pagination(anime_id, 0, total_pages, bloc, videos_set)
    await update.message.reply_text(texte, reply_markup=clavier, **SANS_APERCU)


async def callback_episodes_page(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    try:
        p = q.data.split(":"); anime_id = p[1]; page_data = p[2]
    except (IndexError, ValueError):
        await q.answer(); return
    if anime_id == "none":
        await q.answer(); return
    anime_id = int(anime_id)

    cursor.execute("SELECT titre FROM liens_episodes WHERE anime_id=? LIMIT 1", (anime_id,))
    row = cursor.fetchone()
    if not row:
        cursor.execute("SELECT titre FROM videos_episodes WHERE anime_id=? LIMIT 1", (anime_id,))
        row = cursor.fetchone()
    if not row:
        await q.answer("Introuvable.", show_alert=True); return
    titre = row[0]

    cursor.execute("SELECT episode, lien FROM liens_episodes WHERE anime_id=?", (anime_id,))
    liens_map = dict(cursor.fetchall())
    cursor.execute("SELECT episode FROM videos_episodes WHERE anime_id=?", (anime_id,))
    videos_set = {r[0] for r in cursor.fetchall()}
    episodes_map = dict(liens_map)
    for ep in videos_set:
        if ep not in episodes_map: episodes_map[ep] = None
    tous = sorted(episodes_map.items(), key=lambda x: -x[0])

    if page_data == "all":
        await q.answer("Envoi du fichier...")
        lignes = [f"# {titre} - tous les episodes", ""]
        for ep, l in tous:
            v = "  [video]" if ep in videos_set else ""
            lignes.append(f"Episode {ep}: {l or '(video)'}{v}")
        tampon = io.BytesIO("\n".join(lignes).encode("utf-8"))
        nom = "".join(c for c in titre if c.isalnum() or c in "_- ").strip().replace(" ", "_") or "episodes"
        tampon.name = f"{nom}_episodes.txt"
        try:
            await context.bot.send_document(chat_id=q.from_user.id, document=tampon, filename=tampon.name, caption=f"{titre} : {len(tous)} episode(s).")
        except Exception as e: log.error(f"Erreur: {e}")
        return

    try: page = int(page_data)
    except ValueError: await q.answer(); return
    total_pages = (len(tous) + EPISODES_PAR_PAGE - 1) // EPISODES_PAR_PAGE
    if page < 0 or page >= total_pages:
        await q.answer("Page invalide.", show_alert=True); return
    bloc = tous[page * EPISODES_PAR_PAGE:(page + 1) * EPISODES_PAR_PAGE]
    texte = _formater_page_episodes(titre, tous, page, total_pages, videos_set)
    clavier = _clavier_pagination(anime_id, page, total_pages, bloc, videos_set)
    try:
        await q.edit_message_text(texte, reply_markup=clavier, **SANS_APERCU)
    except Exception as e:
        if "not modified" in str(e).lower(): await q.answer()
        else: await q.answer("Erreur.", show_alert=True)


async def cmd_exporter_liens(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Commande reservee a l'admin.")
        return

    cursor.execute(
        "SELECT anime_id, titre, episode, lien FROM liens_episodes "
        "ORDER BY anime_id, episode"
    )

    animes = {}

    for anime_id, titre, episode, lien in cursor.fetchall():
        bloc = animes.setdefault(str(anime_id), {"titre": titre, "episodes": []})
        bloc["episodes"].append({"ep": episode, "lien": lien})

    if not animes:
        await update.message.reply_text("Aucun lien enregistre.")
        return

    contenu = json.dumps({"animes": animes}, ensure_ascii=False, indent=2)
    fichier = io.BytesIO(contenu.encode("utf-8"))
    fichier.name = "liens.json"

    await update.message.reply_document(
        document=fichier,
        filename="liens.json",
        caption="Fichier a placer a cote de ton site pour la Mini App.",
    )


# ---------- Export zip ----------

async def cmd_zip(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Commande reservee a l'admin.")
        return

    dossier = os.path.dirname(os.path.abspath(__file__))
    complet = bool(context.args) and context.args[0].lower() in ("complet", "token")

    tampon = io.BytesIO()
    ajoutes = []

    with zipfile.ZipFile(tampon, "w", zipfile.ZIP_DEFLATED) as archive:
        for nom in ("bot.py", "start.sh", "miniapp.html", "index.html", "liens.json"):
            chemin = os.path.join(dossier, nom)

            if not os.path.isfile(chemin):
                continue

            with open(chemin, "rb") as f:
                contenu = f.read()

            if nom == "bot.py" and not complet:
                texte = contenu.decode("utf-8")
                texte = re.sub(r'(?m)^TOKEN = .*$', 'TOKEN = "COLLE_TON_TOKEN_ICI"', texte)
                contenu = texte.encode("utf-8")

            archive.writestr(nom, contenu)
            ajoutes.append(nom)

        base = None

        try:
            base = conn.serialize()
        except Exception:
            chemin_db = os.path.join(dossier, "animealert.db")

            if os.path.isfile(chemin_db):
                with open(chemin_db, "rb") as f:
                    base = f.read()

        if base:
            archive.writestr("animealert.db", base)
            ajoutes.append("animealert.db")

    tampon.seek(0)

    nom_zip = f"animealert_{datetime.now(FUSEAU).strftime('%Y%m%d_%H%M')}.zip"
    tampon.name = nom_zip

    if complet:
        note = "Contient ton token: ne transfere ce fichier a personne."
    else:
        note = "Le token est remplace par COLLE_TON_TOKEN_ICI dans bot.py."

    await update.message.reply_document(
        document=tampon,
        filename=nom_zip,
        caption="Sauvegarde AnimeAlert.\nFichiers: " + ", ".join(ajoutes) + "\n" + note,
    )


# ---------- Demarrage ----------

async def purger_tables(context: ContextTypes.DEFAULT_TYPE):
    """Purge quotidienne pour eviter que la DB grossisse a l'infini."""
    try:
        # rappels_envoyes : garder les 5000 plus recents
        db_write(
            "DELETE FROM rappels_envoyes WHERE rowid NOT IN "
            "(SELECT rowid FROM rappels_envoyes ORDER BY rowid DESC LIMIT 5000)"
        )
        nb_r = 0

        # annonces_envoyees : garder les 2000 plus recents
        cursor.execute(
            "DELETE FROM annonces_envoyees WHERE rowid NOT IN "
            "(SELECT rowid FROM annonces_envoyees ORDER BY rowid DESC LIMIT 2000)"
        )
        nb_a = cursor.rowcount

        # mentions : purge > 30 jours
        limite_ts = int(time.time()) - 30 * 86400
        cursor.execute("DELETE FROM mentions WHERE ts < ?", (limite_ts,))
        nb_m = cursor.rowcount

        # sondages clos > 30 jours
        cursor.execute(
            "DELETE FROM sondages WHERE clos = 1 AND cree_le < ?",
            (limite_ts,),
        )
        cursor.execute(
            "DELETE FROM sondages_perso WHERE clos = 1 AND cree_le < ?",
            (limite_ts,),
        )

        # sondages sans resultat (orphelins)
        conn.commit()

        # VACUUM de temps en temps (1 fois sur 7)
        if random.randint(1, 7) == 1:
            cursor.execute("VACUUM")
            conn.commit()

        log.info(f"[purge] rappels={nb_r} annonces={nb_a} mentions={nb_m}")
    except Exception as e:
        log.error(f"[purge] erreur: {e}")


async def planning(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Planning personnalise des prochains episodes de tes favoris."""
    user_id = update.effective_user.id

    cursor.execute(
        "SELECT anime_id, anime_titre FROM favoris WHERE user_id = ?",
        (user_id,)
    )
    favoris_user = cursor.fetchall()

    if not favoris_user:
        await update.message.reply_text(
            "Tu ne suis aucun anime pour le moment.\n"
            "Utilise /ajouter One Piece pour en ajouter."
        )
        return

    entrees = []
    for anime_id, titre in favoris_user:
        anime = recuperer_anime(anime_id, titre)
        if not anime:
            continue
        prochain = anime.get("nextAiringEpisode")
        if not prochain:
            continue
        entrees.append({
            "anime": anime,
            "episode": prochain["episode"],
            "airing_at": prochain["airingAt"],
            "reste": prochain["timeUntilAiring"],
        })

    if not entrees:
        await update.message.reply_text(
            "Aucun de tes animes n'a d'episode programme pour le moment."
        )
        return

    entrees.sort(key=lambda e: e["airing_at"])

    jours = {}
    for e in entrees:
        date = datetime.fromtimestamp(e["airing_at"], FUSEAU).date()
        jours.setdefault(date, []).append(e)

    blocs = []
    for jour in sorted(jours):
        lignes = [f"{JOURS[jour.weekday()]} {jour.strftime('%d/%m')}"]
        for e in jours[jour]:
            heure = datetime.fromtimestamp(e["airing_at"], FUSEAU)
            compte = formater_duree(max(e["reste"], 0))
            lignes.append(
                f"  {heure.strftime('%H:%M')} - {titre_de(e['anime'])} "
                f"(ep. {e['episode']}) - dans {compte}"
            )
        blocs.append("\n".join(lignes))

    entete = (
        f"Ton planning - {len(entrees)} episode(s) a venir\n"
        f"(heure du Cameroun)"
    )
    await envoyer_blocs(update.message, entete, blocs)


FORWARDS_EN_ATTENTE = {}
FORWARD_EXPIRATION = 86400


PENDING_TTL = 3600
PENDING_VIDEOS = {}


def _nettoyer_pending_videos():
    limite = time.time() - PENDING_TTL
    for k in list(PENDING_VIDEOS.keys()):
        if PENDING_VIDEOS[k].get("ts", 0) < limite:
            PENDING_VIDEOS.pop(k, None)





def _purger_pending_video():
    """Purge les pending_video et forwards expires (10 min)."""
    import time as _t
    limite = _t.time() - PENDING_TTL
    for k in list(FORWARDS_EN_ATTENTE.keys()):
        if FORWARDS_EN_ATTENTE[k].get("ts", 0) < limite:
            FORWARDS_EN_ATTENTE.pop(k, None)


def _purger_forwards_expires():
    limite = time.time() - FORWARD_EXPIRATION
    for k in list(FORWARDS_EN_ATTENTE.keys()):
        if FORWARDS_EN_ATTENTE[k].get("ts", 0) < limite:
            del FORWARDS_EN_ATTENTE[k]


def extraire_nom_video(nom):
    if not nom: return None
    nom = re.sub(r"\.(mkv|mp4|avi|mov|webm|flv|wmv|ts|m4v|m2ts)$", "", nom, flags=re.IGNORECASE)
    nom = re.sub(r"^[\[\(][^\]\)]+[\]\)]\s*", "", nom)
    m = re.search(r"[Ss](\d{1,2})[\s\.\-_]*[Ee][Pp]?\s*\.?\s*(\d{1,4})", nom)
    if not m:
        m = re.search(r"(?:episode|ep)\s*\.?\s*(\d{1,4})", nom, re.IGNORECASE)
    if not m:
        m = re.search(r"[\s\-_](\d{1,4})(?:\s|$|\[|VOSTFR|VF|1080|720|480)", nom, re.IGNORECASE)

    if not m:
        m2 = re.match(r"^(\d{1,4})[\s\-\.\(\[]", nom)
        if m2:
            ep = int(m2.group(1))
            reste = nom[m2.end() - 1:]
            reste = re.sub(r"^[\(\[](?:[^\)\]]+)[\)\]]\s*", "", reste)
            reste = reste.replace("_", " ").replace(".", " ")
            reste = re.sub(r"\s+", " ", reste).strip()
            reste = re.sub(
                r"\s+(VOSTFR|VOSTF|VF|MULTI|HD|SD|LD|BluRay|WEB[- ]?DL|BD|1080p?|720p?|480p?)\b.*$",
                "", reste, flags=re.IGNORECASE,
            ).strip()
            reste = re.sub(r"\s*\(\d+x\d+\)\s*", " ", reste).strip()
            reste = reste.lstrip(" -._").strip()
            if reste and len(reste) >= 2:
                return (reste, ep, None)

    if not m: return None
    ep = int(m.group(m.lastindex))
    titre = re.sub(r"[\s\-_:]+$", "", nom[:m.start()]).strip()
    titre = re.sub(r"\s+(VOSTFR|VOSTF|VF|MULTI|HD|SD|1080p|720p|480p)$", "", titre, flags=re.IGNORECASE).strip()
    if not titre or len(titre) < 2: return None
    return (titre, ep, None)


def extraire_titre_video(nom):
    if not nom: return None
    nom = re.sub(r"\.(mkv|mp4|avi|mov|webm|flv|wmv|ts|m4v|m2ts)$", "", nom, flags=re.IGNORECASE)
    nom = re.sub(r"^[\[\(][^\]\)]+[\]\)]\s*", "", nom)
    nom = nom.replace("_", " ").replace(".", " ")
    nom = re.sub(r"\s+", " ", nom).strip()
    nom = re.sub(r"\s+(VOSTFR|VOSTF|VF|MULTI|HD|SD|1080p|720p|480p|BluRay|WEB)$", "", nom, flags=re.IGNORECASE).strip()
    if not nom or len(nom) < 2: return None
    return nom


def extraire_forward(texte):
    if not texte:
        return None
    m_lien = re.search(r"https://t\.me/[\w/\-]+/\d+", texte)
    if not m_lien:
        return None
    lien = m_lien.group(0)
    m_ep = re.search(
        r"(?:^|[\s\-–—:(;,])(?:épisode|episode|ep|ép)\.?\s*(\d+)",
        texte, re.IGNORECASE,
    )
    if not m_ep:
        return None
    episode = int(m_ep.group(1))
    avant = texte[:m_ep.start()]
    avant = re.sub(r"\s+", " ", avant).strip()
    avant = re.sub(r"^[^\wÀ-ÿ]+", "", avant)
    avant = re.sub(r"[\s\-–—:;|,\.]+$", "", avant)
    titre = avant.strip()
    if not titre or len(titre) < 2 or len(titre) > 150:
        return None
    return (titre, episode, lien)


async def cmd_forward(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    await update.message.reply_text(
        "Import par forward\n\n"
        "1. Va sur le message qui contient l'episode\n"
        "   (canal, groupe, bot partenaire, Saved Messages)\n"
        "2. Appui long puis Transferer\n"
        "3. Choisis ce bot\n"
        "4. Envoie\n\n"
        "Le message doit contenir :\n"
        "  - le TITRE (ex: One Piece)\n"
        "  - le NUMERO d'episode (ex: episode 1090)\n"
        "  - le LIEN Telegram (ex: https://t.me/canal/123)\n\n"
        "Je te proposerai les animes correspondants et tu choisiras le bon."
    )


async def traiter_forward(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = update.effective_message
    if not msg or not update.effective_user:
        return
    if update.effective_user.id != ADMIN_ID:
        return

    _purger_forwards_expires()

    video_file_id = None; video_type = None; video_name = ""
    if msg.video:
        video_file_id = msg.video.file_id; video_type = "video"; video_name = msg.video.file_name or ""
    elif msg.document:
        mime = msg.document.mime_type or ""
        fn = (msg.document.file_name or "").lower()
        if mime.startswith("video/") or fn.endswith((".mkv", ".mp4", ".avi", ".mov", ".webm")):
            video_file_id = msg.document.file_id; video_type = "document"; video_name = msg.document.file_name or ""

    if video_file_id:
        extrait = extraire_nom_video(video_name)
        if extrait:
            titre_brut, episode, _ = extrait
            resultats = await chercher_anime_ia(titre_brut, update.effective_user.id, "forward-video")
            if not resultats:
                await msg.reply_text(f"Aucun anime trouve pour : {titre_brut}")
                return
            resultats = resultats[:5]
            fwd_id = secrets.token_hex(4)
            FORWARDS_EN_ATTENTE[fwd_id] = {
                "episode": episode, "lien": None,
                "file_id": video_file_id, "type": video_type,
                "titre_brut": titre_brut,
                "resultats": [{"id": r["id"], "titre": titre_de(r)} for r in resultats],
                "ts": time.time(),
            }
            boutons = [[InlineKeyboardButton(f"OK {titre_de(r)[:60]}", callback_data=f"fwd:{fwd_id}:{r['id']}")] for r in resultats]
            boutons.append([InlineKeyboardButton("Annuler", callback_data=f"fwd:{fwd_id}:0")])
            await msg.reply_text(
                f"Video analysee\n\nTitre : {titre_brut}\nEpisode : {episode}\nFichier : {(video_name or '')[:80]}\n\nQuel anime ?",
                reply_markup=InlineKeyboardMarkup(boutons),
            )
            return
        titre_propose = extraire_titre_video(video_name) or ""
        _nettoyer_pending_videos()
        sent = await msg.reply_text(
            f"Video recue mais je n'ai pas trouve le numero d'episode.\n\n"
            f"Nom : {video_name}\n"
            + (f"Titre propose : {titre_propose}\n\n" if titre_propose else "\n")
            + "Reponds avec : Titre Episode\n"
            "Exemple : Magic Repo Man 1\n\n"
            "Astuce : reponds en glissant sur CE message si tu as plusieurs videos en attente."
        )
        PENDING_VIDEOS[sent.message_id] = {
            "user_id": update.effective_user.id,
            "file_id": video_file_id,
            "type": video_type,
            "titre_propose": titre_propose,
            "ts": time.time(),
        }
        return


    texte = msg.text or msg.caption
    if not texte:
        await msg.reply_text("Forward sans texte. Envoie un message avec titre + episode + lien.")
        return

    extrait = extraire_forward(texte)
    if not extrait:
        await msg.reply_text(
            "Je n'ai pas reussi a extraire titre + episode + lien.\n\n"
            "Le message doit contenir :\n"
            "  - le titre (ex: One Piece)\n"
            "  - episode <numero> (ex: episode 1090)\n"
            "  - https://t.me/... (lien Telegram)\n\n"
            "Sinon utilise /lien One Piece | 1090 | https://t.me/xxx/123"
        )
        return

    titre_brut, episode, lien = extrait
    resultats = await chercher_anime_ia(titre_brut, update.effective_user.id, "forward-texte")

    if not resultats:
        await msg.reply_text(
            f"Aucun anime trouve sur AniList pour : {titre_brut}\n"
            "Essaie avec un titre plus simple, ou utilise /lien."
        )
        return

    resultats = resultats[:5]
    fwd_id = secrets.token_hex(4)

    FORWARDS_EN_ATTENTE[fwd_id] = {
        "episode": episode,
        "lien": lien,
        "titre_brut": titre_brut,
        "resultats": [{"id": r["id"], "titre": titre_de(r)} for r in resultats],
        "ts": time.time(),
    }

    boutons = []
    for r in resultats:
        label = titre_de(r)[:60]
        boutons.append([InlineKeyboardButton(f"✅ {label}", callback_data=f"fwd:{fwd_id}:{r['id']}")])
    boutons.append([InlineKeyboardButton("❌ Annuler", callback_data=f"fwd:{fwd_id}:0")])

    try:
        await msg.reply_text(
            f"Forward analyse\n\n"
            f"Titre detecte : {titre_brut}\n"
            f"Episode : {episode}\n"
            f"Lien : {lien}\n\n"
            f"Quel anime correspond exactement ?",
            reply_markup=InlineKeyboardMarkup(boutons),
            disable_web_page_preview=True,
        )
    except Exception as e:
        log.error(f"Erreur envoi forward: {e}")


async def callback_forward(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    if q.from_user.id != ADMIN_ID:
        await q.answer("Reserve a l'admin.", show_alert=True)
        return

    try:
        parties = q.data.split(":")
        fwd_id = parties[1]
        anime_id = int(parties[2])
    except (IndexError, ValueError):
        await q.answer()
        return

    info = FORWARDS_EN_ATTENTE.get(fwd_id)
    if not info:
        await q.answer("Ce forward a expire. Re-forward la video.", show_alert=True)
        try:
            await q.edit_message_text("Forward expire. Re-forward la video.")
        except Exception:
            pass
        return
    # Rafraichir le timestamp pour permettre plusieurs clics dans les 10 min
    info["ts"] = time.time()

    if anime_id == 0:
        await q.answer("Annule.")
        try:
            await q.edit_message_text("Forward annule.")
        except Exception:
            pass
        return

    titre = None
    for r in info["resultats"]:
        if r["id"] == anime_id:
            titre = r["titre"]
            break

    if not titre:
        await q.answer("Anime introuvable.", show_alert=True)
        return

    if info.get("file_id"):
        cursor.execute(
            "INSERT OR REPLACE INTO videos_episodes (anime_id, titre, episode, file_id, type) VALUES (?, ?, ?, ?, ?)",
            (anime_id, titre, info["episode"], info["file_id"], info["type"]),
        )
        conn.commit()
        await q.answer("Video enregistree.")
        try:
            await q.edit_message_text(f"Video enregistree :\n\n{titre} - Ep. {info['episode']}\n\nVisible dans /episodes {titre}")
        except Exception: pass
        return

    cursor.execute(
        "INSERT OR REPLACE INTO liens_episodes (anime_id, titre, episode, lien) VALUES (?, ?, ?, ?)",
        (anime_id, titre, info["episode"], info["lien"]),
    )
    conn.commit()

    await q.answer("Enregistre.")
    try:
        await q.edit_message_text(
            f"Enregistre :\n\n{titre} - Episode {info['episode']}\n"
            f"{info['lien']}\n\nVisible dans /episodes {titre}"
        )
    except Exception:
        pass


async def cmd_send_video(update: Update, context: ContextTypes.DEFAULT_TYPE):
    FALLBACK_ARCHIVE = True
    q = update.callback_query
    try:
        p = q.data.split(":"); anime_id = int(p[1]); ep = int(p[2])
    except (IndexError, ValueError):
        await q.answer(); return

    cursor.execute(
        "SELECT titre, file_id, type, archive_file_id, archive_type "
        "FROM videos_episodes WHERE anime_id=? AND episode=?",
        (anime_id, ep)
    )
    row = cursor.fetchone()
    if not row:
        await q.answer("Introuvable.", show_alert=True); return

    titre, fid, typ, arch_fid, arch_type = row
    await q.answer("Envoi...")

    # Essai 1 : file_id original
    try:
        if typ == "video":
            await context.bot.send_video(chat_id=q.from_user.id, video=fid, caption=f"{titre} - Ep. {ep}")
        else:
            await context.bot.send_document(chat_id=q.from_user.id, document=fid, caption=f"{titre} - Ep. {ep}")
        return
    except Exception as e:
        log.warning(f"Envoi original echoue, essai archive: {e}")

    # Essai 2 : archive si disponible
    if arch_fid:
        try:
            if arch_type == "video":
                await context.bot.send_video(chat_id=q.from_user.id, video=arch_fid, caption=f"{titre} - Ep. {ep} [archive]")
            else:
                await context.bot.send_document(chat_id=q.from_user.id, document=arch_fid, caption=f"{titre} - Ep. {ep} [archive]")
            return
        except Exception as e:
            log.error(f"Archive echouee aussi: {e}")

    # Les 2 ont echoue
    try:
        await q.message.reply_text(
            f"⚠️ Impossible d'envoyer {titre} Ep. {ep}.\n"
            f"Ni l'original ni l'archive ne sont accessibles."
        )
    except Exception:
        pass


async def traiter_reponse_video(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not user or user.id != ADMIN_ID:
        return
    _nettoyer_pending_videos()
    pending = None
    pending_key = None

    # Priorite 1 : reply a un message bot
    ref = update.message.reply_to_message
    if ref and ref.message_id in PENDING_VIDEOS:
        if PENDING_VIDEOS[ref.message_id].get("user_id") == user.id:
            pending = PENDING_VIDEOS[ref.message_id]
            pending_key = ref.message_id

    # Priorite 2 : le plus recent du user
    if not pending:
        candidats = [
            (mid, p) for mid, p in PENDING_VIDEOS.items()
            if p.get("user_id") == user.id
        ]
        if candidats:
            candidats.sort(key=lambda x: x[1].get("ts", 0), reverse=True)
            pending_key, pending = candidats[0]

    if not pending:
        return

    if time.time() - pending.get("ts", 0) > PENDING_TTL:
        PENDING_VIDEOS.pop(pending_key, None)
        await update.message.reply_text(
            "Le delai pour repondre est expire.\n"
            "Re-forward la video pour recommencer."
        )
        return

    texte = (update.message.text or "").strip()
    titre_brut = None
    episode = None

    m = re.search(r"(.+?)\s+(\d{1,4})\s*$", texte)
    if m:
        titre_brut = m.group(1).strip()
        episode = int(m.group(2))
    else:
        m2 = re.match(r"^\s*(\d{1,4})\s*$", texte)
        if m2 and pending.get("titre_propose"):
            titre_brut = pending["titre_propose"]
            episode = int(m2.group(1))

    if not titre_brut or episode is None:
        await update.message.reply_text("Format invalide. Reponds : Titre Episode (ex: Magic Repo Man 1)")
        return

    resultats = await chercher_anime_ia(titre_brut, user.id, "reponse-video")
    if not resultats:
        await update.message.reply_text(f"Aucun anime trouve pour {titre_brut}.")
        return

    resultats = resultats[:5]
    fwd_id = secrets.token_hex(4)
    FORWARDS_EN_ATTENTE[fwd_id] = {
        "episode": episode,
        "lien": None,
        "file_id": pending["file_id"],
        "type": pending["type"],
        "titre_brut": titre_brut,
        "resultats": [{"id": r["id"], "titre": titre_de(r)} for r in resultats],
        "ts": time.time(),
    }
    # Garder le pending_video avec un timestamp frais pour permettre les corrections
    pending["ts"] = time.time()
    PENDING_VIDEOS[pending_key] = pending

    boutons = [[InlineKeyboardButton(f"OK {titre_de(r)[:60]}", callback_data=f"fwd:{fwd_id}:{r['id']}")] for r in resultats]
    boutons.append([InlineKeyboardButton("Annuler", callback_data=f"fwd:{fwd_id}:0")])
    await update.message.reply_text(
        f"Video liee a : {titre_brut} ep. {episode}\nQuel anime ?",
        reply_markup=InlineKeyboardMarkup(boutons),
    )


# ==================================================
# 17. DEMARRAGE
# ==================================================

def _bot_url():
    if BOT_USERNAME:
        return f"https://t.me/{BOT_USERNAME}"
    return f"https://t.me/{CHAINE_ID.replace('@', '')}"


def _formater_episodes_canal(titre, anime_id, episodes_bloc):
    """Retourne le texte d'un message pour le canal."""
    lignes = [f"📺 {titre}", ""]
    for ep, lien, a_video in episodes_bloc:
        if lien:
            lignes.append(f"Ep. {ep} : {lien}")
        elif a_video:
            lignes.append(f"Ep. {ep} : video via le bot")
        else:
            lignes.append(f"Ep. {ep}")
    lignes.append("")
    lignes.append(f"📥 Voir tout : /episodes {titre[:30]}")
    return "\n".join(lignes)


def _clavier_canal():
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("📥 Ouvrir le bot", url=_bot_url())
    ]])


async def _publier_episodes_canal(bot, titre, anime_id, episodes_liste):
    """Publie les episodes par blocs de 50 max. Retourne nb publies."""
    if not episodes_liste:
        return 0

    publies = 0
    for i in range(0, len(episodes_liste), 50):
        bloc = episodes_liste[i:i+50]
        texte = _formater_episodes_canal(titre, anime_id, bloc)
        try:
            await bot.send_message(
                chat_id=CHAINE_ID,
                text=texte,
                reply_markup=_clavier_canal(),
                disable_web_page_preview=True,
            )
            publies += len(bloc)
        except Exception as e:
            log.error(f"Erreur publication canal: {e}")
            break
        await asyncio.sleep(2)
    return publies


async def publier_nouveaux_episodes(context: ContextTypes.DEFAULT_TYPE):
    """Job quotidien : publie les episodes ajoutes dans les dernieres 24h."""
    limite_ts = int(time.time()) - 24 * 3600

    # Episodes non publies, groupes par anime
    cursor.execute(
        "SELECT anime_id, titre, episode, lien FROM liens_episodes "
        "WHERE anime_id NOT IN (SELECT anime_id FROM episodes_publies WHERE publie_le > ?) "
        "GROUP BY anime_id, episode",
        (limite_ts,)
    )
    nouveaux_liens = cursor.fetchall()

    # Videos non publiees
    cursor.execute(
        "SELECT anime_id, titre, episode, NULL as lien FROM videos_episodes "
        "WHERE NOT EXISTS (SELECT 1 FROM episodes_publies "
        "WHERE episodes_publies.anime_id = videos_episodes.anime_id "
        "AND episodes_publies.episode = videos_episodes.episode)"
    )
    nouveaux_videos = cursor.fetchall()

    # Fusion par anime
    par_anime = {}
    for anime_id, titre, ep, lien in nouveaux_liens:
        par_anime.setdefault((anime_id, titre), []).append((ep, lien, False))
    for anime_id, titre, ep, _ in nouveaux_videos:
        par_anime.setdefault((anime_id, titre), []).append((ep, None, True))

    if not par_anime:
        log.info("[publication] aucun nouvel episode")
        return

    total = 0
    for (anime_id, titre), eps in par_anime.items():
        eps.sort(key=lambda x: -x[0])
        publies = await _publier_episodes_canal(context.bot, titre, anime_id, eps)
        if publies > 0:
            maintenant = int(time.time())
            for ep, _, _ in eps[:publies]:
                cursor.execute(
                    "INSERT OR REPLACE INTO episodes_publies "
                    "(anime_id, episode, publie_le) VALUES (?, ?, ?)",
                    (anime_id, ep, maintenant)
                )
            conn.commit()
            total += publies

    log.info(f"[publication] {total} episode(s) publie(s)")


async def cmd_publier(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin : /publier <anime> [force]"""
    if update.effective_user.id != ADMIN_ID:
        return

    if not context.args:
        await update.message.reply_text(
            "Usage : /publier <anime> [force]\n\n"
            "Publie tous les episodes non publies de l'anime dans le canal.\n"
            "Ajoute 'force' pour republier meme les deja publies.\n\n"
            "Exemples :\n"
            "/publier One Piece\n"
            "/publier One Piece force"
        )
        return

    args = list(context.args)
    force = False
    if args and args[-1].lower() == "force":
        force = True
        args.pop()

    if not args:
        await update.message.reply_text("Precise le nom de l'anime.")
        return

    resultats = chercher_anime(" ".join(args))
    if not resultats:
        await update.message.reply_text("Aucun anime trouve.")
        return

    anime = resultats[0]
    titre = titre_de(anime)
    anime_id = anime["id"]

    # Liens
    cursor.execute(
        "SELECT episode, lien FROM liens_episodes WHERE anime_id = ? ORDER BY episode DESC",
        (anime_id,)
    )
    liens = {ep: l for ep, l in cursor.fetchall()}

    # Videos
    cursor.execute(
        "SELECT episode FROM videos_episodes WHERE anime_id = ? ORDER BY episode DESC",
        (anime_id,)
    )
    videos = {ep for (ep,) in cursor.fetchall()}

    tous_eps = sorted(set(liens.keys()) | videos, reverse=True)

    if not tous_eps:
        await update.message.reply_text(f"Aucun episode enregistre pour {titre}.")
        return

    # Filtrer les deja publies (sauf si force)
    if not force:
        cursor.execute(
            "SELECT episode FROM episodes_publies WHERE anime_id = ?",
            (anime_id,)
        )
        deja_publies = {ep for (ep,) in cursor.fetchall()}
        tous_eps = [ep for ep in tous_eps if ep not in deja_publies]

    if not tous_eps:
        await update.message.reply_text(
            f"Tous les episodes de {titre} sont deja publies.\n"
            f"Utilise /publier {titre} force pour republier."
        )
        return

    await update.message.reply_text(
        f"Publication de {len(tous_eps)} episode(s) de {titre} dans le canal...\n"
        f"(environ {len(tous_eps) // 50 + 1} message(s))"
    )

    liste = [(ep, liens.get(ep), ep in videos) for ep in tous_eps]
    publies = await _publier_episodes_canal(context.bot, titre, anime_id, liste)

    # Marquer comme publies
    maintenant = int(time.time())
    for ep, _, _ in liste[:publies]:
        cursor.execute(
            "INSERT OR REPLACE INTO episodes_publies "
            "(anime_id, episode, publie_le) VALUES (?, ?, ?)",
            (anime_id, ep, maintenant)
        )
    conn.commit()

    await update.message.reply_text(f"OK : {publies} episode(s) publie(s).")


async def cmd_publier_maintenant(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin : force le recap du jour."""
    if update.effective_user.id != ADMIN_ID:
        return

    await update.message.reply_text("Lancement du recap quotidien...")
    await publier_nouveaux_episodes(context)
    await update.message.reply_text("Recap termine.")


CHANNEL_PENDING = {}
CHANNEL_COOLDOWN = {}
COOLDOWN_SEC = 00


cursor.execute("""
CREATE TABLE IF NOT EXISTS chats_autorises (
    chat_id INTEGER PRIMARY KEY,
    titre TEXT,
    type TEXT,
    ajoute_le INTEGER
)
""")
conn.commit()

# ===== WHITELIST PERMANENTE (restaurée à chaque démarrage) =====
CHATS_PAR_DEFAUT = [
    # (chat_id, titre, type)
    (-1004259274391, "AnimeAlert Buea", "channel"),
    (-1003085746136, "MY ANIME", "channel"),
    (-1001929606074, "Anime d'abord", "supergroup"),
]

for _chat_id, _titre, _typ in CHATS_PAR_DEFAUT:
    cursor.execute(
        "INSERT OR IGNORE INTO chats_autorises VALUES (?, ?, ?, ?)",
        (_chat_id, _titre, _typ, int(time.time()))
    )
conn.commit()



def _chat_autorise(chat_id):
    cursor.execute("SELECT 1 FROM chats_autorises WHERE chat_id = ?", (chat_id,))
    return cursor.fetchone() is not None


async def cmd_allowchat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    chat_id, titre, typ = None, "?", "?"
    if context.args:
        try:
            chat = await context.bot.get_chat(context.args[0])
            chat_id = chat.id
            titre = chat.title or chat.username or str(chat_id)
            typ = chat.type
        except Exception as e:
            await update.message.reply_text(f"Erreur : {e}")
            return
    elif update.effective_chat.type != "private":
        chat_id = update.effective_chat.id
        titre = update.effective_chat.title or str(chat_id)
        typ = update.effective_chat.type
    else:
        await update.message.reply_text(
            "Utilise /allowchat @username ou tape /allowchat DANS le groupe."
        )
        return
    cursor.execute(
        "INSERT OR REPLACE INTO chats_autorises VALUES (?, ?, ?, ?)",
        (chat_id, titre, typ, int(time.time()))
    )
    conn.commit()
    await update.message.reply_text(f"Chat autorise : {titre} ({chat_id})")


async def cmd_denychat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    if not context.args:
        await update.message.reply_text("Exemple : /denychat -1001234567890")
        return
    try:
        cid = int(context.args[0])
    except ValueError:
        return
    cursor.execute("DELETE FROM chats_autorises WHERE chat_id = ?", (cid,))
    conn.commit()
    # Retirer aussi de la liste par defaut pour eviter la restauration
    global CHATS_PAR_DEFAUT
    CHATS_PAR_DEFAUT = [(i, t, ty) for i, t, ty in CHATS_PAR_DEFAUT if i != cid]
    await update.message.reply_text(f"Chat {cid} retire (definitivement).")


async def cmd_listchats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    rows = cursor.execute(
        "SELECT chat_id, titre, type FROM chats_autorises ORDER BY ajoute_le DESC"
    ).fetchall()
    if not rows:
        await update.message.reply_text("Aucun chat autorise.")
        return
    lignes = [f"Chats autorises ({len(rows)}) :", ""]
    for cid, t, typ in rows:
        lignes.append(f"- {t} ({typ}) : {cid}")
    await update.message.reply_text("\n".join(lignes))


ACCEPTER_FORWARDS_CHANNEL = True


import asyncio as _asyncio_channel
CHANNEL_PROCESSING_LOCK = _asyncio_channel.Lock()


async def traiter_channel_post(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Traite les videos de canal en SERIE (evite AniList rate limit)."""
    async with CHANNEL_PROCESSING_LOCK:
        await _traiter_channel_post_internal(update, context)
        await _asyncio_channel.sleep(2)  # throttle entre chaque video


async def _traiter_channel_post_internal(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = update.channel_post or update.effective_message
    if not msg:
        return
    chat = msg.chat
    if not chat:
        return

    log.info(f"[channel] msg dans {chat.title or chat.id} (video={bool(msg.video)}, doc={bool(msg.document)})")

    if not _chat_autorise(chat.id):
        log.info(f"[channel] chat {chat.id} non autorise")
        return

    source = getattr(msg, "forward_from_chat", None)
    if source and _chat_autorise(source.id):
        log.info(f"[channel] forward de {source.title}, ignore")
        return
    maintenant = time.time()
    if maintenant - CHANNEL_COOLDOWN.get(chat.id, 0) < COOLDOWN_SEC:
        return
    if msg.from_user and msg.from_user.is_bot:
        return

    video_file_id = None
    video_type = None
    video_name = ""
    texte = msg.caption or msg.text or ""

    if msg.video:
        if msg.video.file_size and msg.video.file_size < 50_000:
            return
        video_file_id = msg.video.file_id
        video_type = "video"
        video_name = msg.video.file_name or ""
    elif msg.document:
        mime = msg.document.mime_type or ""
        fn = (msg.document.file_name or "").lower()
        if mime.startswith("video/") or fn.endswith((".mkv", ".mp4", ".avi", ".mov", ".webm")):
            if msg.document.file_size and msg.document.file_size < 50_000:
                return
            video_file_id = msg.document.file_id
            video_type = "document"
            video_name = msg.document.file_name or ""

    if not video_file_id:
        log.info(f"[channel] video_file_id None - mime={msg.document.mime_type if msg.document else 'N/A'}, nom={video_name}")
        return

    CHANNEL_COOLDOWN[chat.id] = maintenant

    extrait = extraire_nom_video(video_name) if video_name else None
    if not extrait and texte:
        extrait = extraire_forward(texte)

    if not extrait:
        try:
            await context.bot.send_message(
                chat_id=ADMIN_ID,
                text=f"Video dans \"{chat.title or chat.id}\" non reconnue :\n"
                     f"Nom : {video_name or '(inconnu)'}",
            )
        except Exception:
            pass
        return

    titre_brut, episode, _ = extrait
    resultats = await chercher_anime_ia(titre_brut, ADMIN_ID, "channel")
    if not resultats:
        log.info(f"[channel] AniList rien pour '{titre_brut}'")
        try:
            await context.bot.send_message(
                chat_id=ADMIN_ID,
                text=f"Aucun anime trouve pour : {titre_brut}\n(fichier: {video_name})",
            )
        except Exception:
            pass
        return

    resultats = resultats[:3]
    fwd_id = secrets.token_hex(4)
    CHANNEL_PENDING[fwd_id] = {
        "episode": episode,
        "file_id": video_file_id,
        "type": video_type,
        "titre_brut": titre_brut,
        "resultats": [{"id": r["id"], "titre": titre_de(r)} for r in resultats],
        "ts": time.time(),
    }

    boutons = [
        [InlineKeyboardButton(
            f"OK {titre_de(r)[:55]}",
            callback_data=f"chv:{fwd_id}:{r['id']}"
        )] for r in resultats
    ]
    boutons.append([InlineKeyboardButton("Ignorer", callback_data=f"chv:{fwd_id}:0")])

    try:
        await context.bot.send_message(
            chat_id=ADMIN_ID,
            text=f"Video dans \"{chat.title or chat.id}\"\n"
                 f"Titre : {titre_brut}\n"
                 f"Episode : {episode}\n"
                 f"Fichier : {video_name[:80]}\n"
                 f"Quel anime ?",
            reply_markup=InlineKeyboardMarkup(boutons),
        )
    except Exception as e:
        log.error(f"MP admin: {e}")


async def callback_channel_video(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    if q.from_user.id != ADMIN_ID:
        await q.answer("Reserve admin.", show_alert=True)
        return
    try:
        p = q.data.split(":")
        fwd_id = p[1]
        anime_id = int(p[2])
    except (IndexError, ValueError):
        await q.answer()
        return
    info = CHANNEL_PENDING.pop(fwd_id, None)
    if not info:
        await q.answer("Expire.", show_alert=True)
        return
    if anime_id == 0:
        await q.answer("Ignore.")
        try:
            await q.edit_message_text("Video ignoree.")
        except Exception:
            pass
        return
    titre = None
    for r in info["resultats"]:
        if r["id"] == anime_id:
            titre = r["titre"]
            break
    if not titre:
        await q.answer("Introuvable.", show_alert=True)
        return
    cursor.execute(
        "INSERT OR REPLACE INTO videos_episodes "
        "(anime_id, titre, episode, file_id, type) VALUES (?, ?, ?, ?, ?)",
        (anime_id, titre, info["episode"], info["file_id"], info["type"]),
    )
    conn.commit()
    await q.answer("Enregistre.")
    try:
        await q.edit_message_text(
            f"Enregistre : {titre} - Ep. {info['episode']}"
        )
    except Exception:
        pass


OTAKU_COOLDOWN = {}
OTAKU_COOLDOWN_SEC = 30
OTAKU_QUOTA_JOUR = {"count": 0, "date": ""}
OTAKU_MAX_JOUR = 30


def _reset_quota_otaku():
    today = time.strftime("%Y-%m-%d")
    if OTAKU_QUOTA_JOUR["date"] != today:
        OTAKU_QUOTA_JOUR["count"] = 0
        OTAKU_QUOTA_JOUR["date"] = today


async def repondre_otaku_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Repond en mode otaku UNIQUEMENT en chat prive."""
    msg = update.effective_message
    if not msg or not msg.text:
        return
    if msg.text.startswith("/"):
        return
    if update.effective_user and update.effective_user.is_bot:
        return

    chat = msg.chat
    if not chat:
        return

    # 🔒 PRIVE UNIQUEMENT
    if chat.type != "private":
        return

    user_id = update.effective_user.id if update.effective_user else 0

    _reset_quota_otaku()
    if OTAKU_QUOTA_JOUR["count"] >= OTAKU_MAX_JOUR:
        return

    maintenant = time.time()
    if maintenant - OTAKU_COOLDOWN.get(chat.id, 0) < OTAKU_COOLDOWN_SEC:
        return

    OTAKU_COOLDOWN[chat.id] = maintenant
    OTAKU_QUOTA_JOUR["count"] += 1

    try:
        await context.bot.send_chat_action(chat_id=chat.id, action="typing")
        reponse = await repondre_otaku(msg.text, user_id)

        if not reponse:
            return
        if "indisponible" in reponse.lower() or "manquante" in reponse.lower():
            return

        await msg.reply_text(reponse[:4000])

    except Exception as e:
        log.warning(f"repondre_otaku_handler: {e}")


AIDE_ADMIN = {
    "communication": {
        "titre": "📢 Communication",
        "commandes": [
            ("/annonce <texte>", "Envoyer un message à tous les utilisateurs"),
            ("/stats", "Voir les statistiques globales du bot"),
        ],
    },
    "sondages": {
        "titre": "📊 Sondages",
        "commandes": [
            ("/sondage", "Lancer le sondage hebdo (8 animes populaires)"),
            ("/cloturer", "Clôturer les sondages et publier les résultats"),
            ("/sondage_perso <q>|<o1>|<o2>", "Sondage libre (2-10 options)"),
            ("/cloturer_perso", "Clôturer les sondages perso"),
        ],
    },
    "contenu": {
        "titre": "🎬 Contenu chaîne",
        "commandes": [
            ("/resume", "Publier un résumé d'anime dans la chaîne"),
            ("/quiz", "Publier un quiz anime"),
            ("/duel", "Publier un duel entre 2 animes"),
            ("/mentions", "Top des animes les plus mentionnés"),
            ("/publier <anime>", "Publier les épisodes non publiés"),
            ("/publier <anime> force", "Republier tous les épisodes"),
            ("/publier_maintenant", "Forcer le récap quotidien"),
        ],
    },
    "premium": {
        "titre": "💎 Premium",
        "commandes": [
            ("/premium_ajouter <id> <jours>", "Accorder du premium à un utilisateur"),
            ("/premium_retirer <id>", "Retirer le premium à un utilisateur"),
        ],
    },
    "import": {
        "titre": "📥 Import d'épisodes",
        "commandes": [
            ("/lien <anime>|<ep>|<url>", "Ajouter un lien manuellement"),
            ("/retirer_lien <anime>|<ep>", "Retirer un lien d'épisode"),
            ("/exporter_liens", "Exporter tous les liens en JSON"),
            ("/forward", "Guide pour importer par forward"),
            ("/debug_forward <texte>", "Tester le parser de forward sans forwarder"),
        ],
    },
    "chats": {
        "titre": "🛡️ Gestion des chats",
        "commandes": [
            ("/allowchat [chat]", "Autoriser un canal/groupe (sans arg = chat actuel)"),
            ("/denychat <id>", "Retirer un chat de la whitelist"),
            ("/listchats", "Voir tous les chats autorisés"),
        ],
    },
    "db": {
        "titre": "💾 Base de données",
        "commandes": [
            ("/stats_db", "Statistiques de la bibliothèque (liens + vidéos)"),
            ("/catalogue", "Statistiques du catalogue d'animes"),
            ("/zip", "Créer et envoyer une sauvegarde complète"),
            ("/monid", "Afficher ton ID Telegram"),
        ],
    },
    "ia": {
        "titre": "🤖 IA",
        "commandes": [
            ("/ia <question>", "Discuter avec le bot en mode otaku"),
            ("/rediger <sujet>", "Générer un brouillon de post Telegram"),
        ],
    },
    "archives": {
        "titre": "🗄️ Archives",
        "commandes": [
            ("/canal_archives <id>", "Configurer le canal d'archives"),
            ("/stats_archives", "Voir l'état des archives"),
            ("/archiver_tout", "Archiver toutes les vidéos non archivées"),
        ],
    },
}


def _menu_admin_principal():
    texte = "Commandes administrateur\n\nChoisis une categorie :"
    boutons = []
    cats = list(AIDE_ADMIN.keys())
    for i in range(0, len(cats), 2):
        ligne = []
        for c in cats[i:i+2]:
            ligne.append(InlineKeyboardButton(
                AIDE_ADMIN[c]["titre"],
                callback_data=f"adm:{c}"
            ))
        boutons.append(ligne)
    return texte, InlineKeyboardMarkup(boutons)


async def cmd_admin_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    texte, clavier = _menu_admin_principal()
    await update.message.reply_text(texte, reply_markup=clavier)


async def callback_admin_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    if q.from_user.id != ADMIN_ID:
        await q.answer("Reserve admin.", show_alert=True)
        return

    try:
        cat = q.data.split(":")[1]
    except (IndexError, ValueError):
        await q.answer()
        return

    if cat == "menu":
        texte, clavier = _menu_admin_principal()
        try:
            await q.edit_message_text(texte, reply_markup=clavier)
        except Exception:
            pass
        return

    if cat not in AIDE_ADMIN:
        await q.answer()
        return

    info = AIDE_ADMIN[cat]
    lignes = [info["titre"], ""]
    for cmd, desc in info["commandes"]:
        lignes.append(f"`{cmd}`")
        lignes.append(f"  → {desc}")
        lignes.append("")

    clavier = InlineKeyboardMarkup([
        [InlineKeyboardButton("« Retour", callback_data="adm:menu")]
    ])

    try:
        await q.edit_message_text(
            "\n".join(lignes),
            reply_markup=clavier,
            parse_mode="Markdown",
        )
    except Exception:
        try:
            await q.edit_message_text("\n".join(lignes), reply_markup=clavier)
        except Exception:
            pass


async def _archiver_video(bot, file_id, type_video, anime_id, titre, episode):
    """Envoie une video dans le canal d'archives et met a jour la DB."""
    canal = _get_config("canal_archives")
    if not canal:
        return False
    try:
        if type_video == "video":
            msg = await bot.send_video(chat_id=int(canal), video=file_id, caption=f"Archive : {titre} - Ep. {episode}")
            new_file_id = msg.video.file_id
            new_type = "video"
        else:
            msg = await bot.send_document(chat_id=int(canal), document=file_id, caption=f"Archive : {titre} - Ep. {episode}")
            new_file_id = msg.document.file_id
            new_type = "document"
        cursor.execute(
            "UPDATE videos_episodes SET archive_file_id = ?, archive_type = ? WHERE anime_id = ? AND episode = ?",
            (new_file_id, new_type, anime_id, episode)
        )
        conn.commit()
        return True
    except Exception as e:
        log.warning(f"_archiver_video: {e}")
        return False


async def cmd_canal_archives(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    if not context.args:
        actuel = _get_config("canal_archives", "non configure")
        await update.message.reply_text(
            f"Canal d'archives actuel : {actuel}\n\n"
            f"Pour configurer : /canal_archives -1001234567890"
        )
        return
    arg = context.args[0].strip()
    try:
        chat = await context.bot.get_chat(arg)
        if chat.type != "channel":
            await update.message.reply_text(f"Ce chat n'est pas un canal : {chat.type}")
            return
        me = await context.bot.get_me()
        try:
            membre = await context.bot.get_chat_member(chat.id, me.id)
            if membre.status not in ("administrator", "creator"):
                await update.message.reply_text(f"Le bot n'est PAS admin de {chat.title}. Ajoute-le admin.")
                return
        except Exception as e:
            await update.message.reply_text(f"Erreur verification : {e}")
            return
        _set_config("canal_archives", str(chat.id))
        await update.message.reply_text(
            f"✅ Canal d'archives configure :\nID : {chat.id}\nTitre : {chat.title}"
        )
    except Exception as e:
        await update.message.reply_text(f"Erreur : {e}")


async def cmd_stats_archives(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    canal = _get_config("canal_archives", "non configure")
    cursor.execute("SELECT COUNT(*) FROM videos_episodes")
    total = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM videos_episodes WHERE archive_file_id IS NOT NULL")
    archivees = cursor.fetchone()[0]
    await update.message.reply_text(
        f"Archives AnimeAlert\n\n"
        f"Canal : {canal}\n"
        f"Videos totales : {total}\n"
        f"Videos archivees : {archivees}\n"
        f"Non archivees : {total - archivees}"
    )


async def cmd_archiver_tout(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    if not _get_config("canal_archives"):
        await update.message.reply_text("Configure d'abord : /canal_archives -100...")
        return
    cursor.execute(
        "SELECT anime_id, titre, episode, file_id, type FROM videos_episodes "
        "WHERE archive_file_id IS NULL"
    )
    videos = cursor.fetchall()
    if not videos:
        await update.message.reply_text("Tout est deja archive.")
        return
    await update.message.reply_text(
        f"Archivage de {len(videos)} videos...\nTemps estime : ~{len(videos) * 3} secondes"
    )
    ok = 0
    echecs = 0
    for i, (anime_id, titre, ep, fid, typ) in enumerate(videos, 1):
        success = await _archiver_video(context.bot, fid, typ, anime_id, titre, ep)
        if success:
            ok += 1
        else:
            echecs += 1
        if i % 20 == 0:
            try:
                await update.message.reply_text(f"Progression : {i}/{len(videos)} ({ok} OK, {echecs} echecs)")
            except Exception:
                pass
        await asyncio.sleep(3)
    await update.message.reply_text(
        f"Archivage termine :\n- {ok} videos archivees\n- {echecs} echecs"
    )


AUTO_ARCHIVE = True


async def rappel_renouvellement(context: ContextTypes.DEFAULT_TYPE):
    try:
        dernier = int(_get_rappel("dernier_rappel_renew", "0"))
    except (ValueError, TypeError):
        dernier = 0
    maintenant = int(time.time())
    if dernier > 0 and (maintenant - dernier) < 3 * 86400:
        return
    try:
        await context.bot.send_message(
            chat_id=ADMIN_ID,
            text="RAPPEL : Renouvelle ton serveur Bot-Hosting.net (expiration tous les 4 jours).",
        )
        _set_rappel("dernier_rappel_renew", str(maintenant))
        log.info("[rappel_renew] Rappel envoye")
    except Exception as e:
        log.warning(f"rappel_renouvellement: {e}")

MINIAPP_API_URL = ""
_CLOUDFLARED_PROC = None


async def _start_cloudflared(port):
    """Telecharge et lance cloudflared, attend l'enregistrement reel du tunnel."""
    import platform
    import urllib.request
    import re

    bin_path = "/tmp/cloudflared_bin"
    if not os.path.exists(bin_path):
        arch = platform.machine().lower()
        if arch in ("aarch64", "arm64"):
            bin_name = "cloudflared-linux-arm64"
        else:
            bin_name = "cloudflared-linux-amd64"
        url = f"https://github.com/cloudflare/cloudflared/releases/latest/download/{bin_name}"
        log.info(f"[cloudflared] telechargement {bin_name}...")
        urllib.request.urlretrieve(url, bin_path)
        os.chmod(bin_path, 0o755)

    async def _lancer_et_attendre(extra_args):
        proc = await asyncio.create_subprocess_exec(
            bin_path, "tunnel", "--url", f"http://localhost:{port}",
            "--no-autoupdate", *extra_args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        url_public = None
        enregistre = False

        try:
            while True:
                line = await asyncio.wait_for(proc.stdout.readline(), timeout=60)
                if not line:
                    break
                text = line.decode(errors="ignore")
                log.info(f"[cloudflared] {text.strip()[:160]}")

                m = re.search(r"(https://[a-z0-9-]+\.trycloudflare\.com)", text)
                if m and not url_public:
                    url_public = m.group(1)

                if "Registered tunnel connection" in text:
                    enregistre = True
                    break
        except asyncio.TimeoutError:
            log.error("[cloudflared] timeout en attente enregistrement")

        return proc, url_public, enregistre

    proc, url_public, ok = await _lancer_et_attendre(["--protocol", "http2"])

    if not ok and url_public:
        log.warning("[cloudflared] QUIC bloque, retry avec --protocol http2")
        try:
            proc.kill()
        except Exception:
            pass
        proc, url_public, ok = await _lancer_et_attendre(["--protocol", "http2"])

    if not ok:
        log.error("[cloudflared] tunnel non enregistre, URL inutilisable")
        return None

    global _CLOUDFLARED_PROC
    _CLOUDFLARED_PROC = proc

    async def _drain_stdout():
        try:
            while True:
                line = await proc.stdout.readline()
                if not line:
                    break
        except Exception:
            pass

    asyncio.create_task(_drain_stdout())
    log.info(f"[cloudflared] tunnel pret: {url_public}")
    return url_public


async def apres_demarrage(app):
    global BOT_USERNAME, MINIAPP_API_URL
    try:
        me = await app.bot.get_me()
        BOT_USERNAME = me.username
    except Exception as e:
        log.error(f"Impossible de recuperer le username: {e}")
    # === Mini App API ===
    try:
        from api_server import set_context, start_server
        set_context(cursor, conn, chercher_anime, chercher_anime_ia, titre_de, liens_streaming)
        api_port = int(os.getenv("API_PORT", "8081"))
        await start_server(api_port)
        # Cloudflared SUPPRIME : port 7844 bloque par Bot-Hosting.
        # MINIAPP_API_URL = await _start_cloudflared(api_port) or ""
        # if MINIAPP_API_URL:
        #     log.info(f"[api] public URL: {MINIAPP_API_URL}")
        log.info(f"[api] local http://127.0.0.1:{api_port} (pas de tunnel)")
    except Exception as e:
        log.error(f"[api] startup: {e}")
    # === Fin Mini App API ===

    await app.bot.set_my_commands(
        [
            BotCommand("planning", "Planning de mes favoris"),
            BotCommand("favoris", "Mes favoris"),
            BotCommand("episodes", "Liens/videos des episodes"),
            BotCommand("rappel", "Delai des rappels"),
            BotCommand("suivre", "Chercher un anime"),
            BotCommand("ajouter", "Ajouter aux favoris"),
            BotCommand("top", "Animes populaires"),
            BotCommand("genre", "Animes par genre"),
            BotCommand("saison", "Animes par saison"),
            BotCommand("sorties", "Prochaines sorties"),
            BotCommand("semaine", "Calendrier de la semaine"),
            BotCommand("recommande", "Recommandations"),
            BotCommand("noter", "Noter un anime"),
            BotCommand("classement", "Top des avis"),
            BotCommand("canaux", "Canaux partenaires"),
            BotCommand("premium", "Offre gratuite/premium"),
            BotCommand("chaine", "Rejoindre la chaine"),
            BotCommand("miniapp", "Ouvrir la Mini App"),
            BotCommand("publier_jour", "Publier les sorties du jour (admin)"),
            BotCommand("aide", "Aide"),
        ]
    )


async def cmd_miniapp(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    base = os.getenv("MINIAPP_URL", "").rstrip("/")
    if not base:
        await update.message.reply_text("Mini App non configuree (MINIAPP_URL absent).")
        return

    cursor.execute(
        "SELECT anime_id FROM favoris WHERE user_id = ? AND anime_id IS NOT NULL",
        (user_id,),
    )
    ids = [str(r[0]) for r in cursor.fetchall()][:60]

    params = []
    if ids:
        params.append(f"fav={','.join(ids)}")
    if MINIAPP_API_URL:
        params.append(f"api={MINIAPP_API_URL}")

    lien = base + ("?" + "&".join(params) if params else "")
    texte = f"Mini App AnimeAlert\n{len(ids)} anime(s) precharges" if ids else "Mini App AnimeAlert"

    await update.message.reply_text(
        texte,
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("Ouvrir la Mini App", web_app=WebAppInfo(url=lien))
        ]]),
    )




# ==================================================
# SORTIES DU JOUR (favoris) - publication quotidienne
# ==================================================

async def _collecter_sorties_jour_favoris():
    """Retourne la liste des sorties du jour pour les animés en favoris."""
    from datetime import datetime

    maintenant = datetime.now(FUSEAU)
    debut_jour = int(maintenant.replace(hour=0, minute=0, second=0, microsecond=0).timestamp())
    fin_jour = int(maintenant.replace(hour=23, minute=59, second=59, microsecond=0).timestamp())

    cursor.execute("SELECT DISTINCT anime_id FROM favoris WHERE anime_id IS NOT NULL")
    ids_favoris = {row[0] for row in cursor.fetchall()}

    if not ids_favoris:
        return []

    query = """
    query ($debut: Int, $fin: Int, $page: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo { hasNextPage }
        airingSchedules(
          airingAt_greater: $debut
          airingAt_lesser: $fin
          sort: TIME
        ) {
          episode
          airingAt
          media {
            id
            title { romaji english }
            coverImage { large }
            genres
            averageScore
          }
        }
      }
    }
    """

    resultats = []
    page = 1
    while page <= 5:
        data = appel_anilist(query, {"debut": debut_jour, "fin": fin_jour, "page": page})
        if not data or not data.get("Page"):
            break
        for s in data["Page"]["airingSchedules"]:
            media = s.get("media")
            if not media:
                continue
            if media["id"] in ids_favoris:
                resultats.append({
                    "id": media["id"],
                    "titre": titre_de(media),
                    "cover": (media.get("coverImage") or {}).get("large", ""),
                    "episode": s["episode"],
                    "airingAt": s["airingAt"],
                    "genres": media.get("genres") or [],
                })
        if not data["Page"]["pageInfo"]["hasNextPage"]:
            break
        page += 1

    resultats.sort(key=lambda x: x["airingAt"])
    return resultats


async def publier_sorties_jour_favoris(context: ContextTypes.DEFAULT_TYPE):
    """Job quotidien : publie les sorties du jour dans le canal."""
    try:
        sorties = await _collecter_sorties_jour_favoris()

        if not sorties:
            log.info("[sorties_jour] aucune sortie aujourd'hui pour les favoris")
            return

        from datetime import datetime
        date_str = datetime.now(FUSEAU).strftime("%A %d %B %Y").capitalize()
        lignes = [
            f"Sorties du jour - {date_str}",
            "",
        ]

        for s in sorties:
            heure = datetime.fromtimestamp(s["airingAt"], FUSEAU).strftime("%H:%M")
            lignes.append(f"{heure} - {s['titre']}")
            lignes.append(f"   Episode {s['episode']}")
            lignes.append("")

        lignes.append("@animealert_buea_bot")
        texte = "\n".join(lignes)

        infos = await context.bot.get_me()
        boutons = InlineKeyboardMarkup([
            [InlineKeyboardButton("Ouvrir le bot", url=f"https://t.me/{infos.username}")]
        ])

        envoye = False
        for destination in destinations():
            try:
                await context.bot.send_message(
                    chat_id=destination,
                    text=texte[:4000],
                    reply_markup=boutons,
                    disable_web_page_preview=True,
                )
                envoye = True
            except Exception as e:
                log.error(f"[sorties_jour] erreur envoi {destination}: {e}")

        if envoye:
            log.info(f"[sorties_jour] {len(sorties)} sortie(s) publiee(s)")

    except Exception as e:
        log.error(f"[sorties_jour] erreur globale : {e}")


async def cmd_publier_jour(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin : force la publication manuelle des sorties du jour."""
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("Commande reservee a l'admin.")
        return
    await update.message.reply_text("Publication des sorties du jour...")
    await publier_sorties_jour_favoris(context)
    await update.message.reply_text("Termine (verifie le canal).")


def main():
    app = Application.builder().token(TOKEN).post_init(apres_demarrage).build()

    app.add_handler(TypeHandler(Update, enregistrer_utilisateur), group=-1)

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("aide", aide))
    app.add_handler(CommandHandler("chaine", chaine))
    app.add_handler(CommandHandler("sorties", sorties))
    app.add_handler(CommandHandler("semaine", semaine))
    app.add_handler(CommandHandler("top", top))
    app.add_handler(CommandHandler("genre", genre))
    app.add_handler(CommandHandler("suivre", suivre))
    app.add_handler(CommandHandler("ajouter", ajouter))
    app.add_handler(CommandHandler("favoris", favoris))
    app.add_handler(CommandHandler("retirer", retirer))
    app.add_handler(CommandHandler("rappel", rappel))
    app.add_handler(CommandHandler("monid", monid))
    app.add_handler(CommandHandler("annonce", annonce))
    app.add_handler(CommandHandler("stats", stats))
    app.add_handler(CommandHandler("stats_db", cmd_stats_db))
    app.add_handler(CommandHandler("canal_archives", cmd_canal_archives))
    app.add_handler(CommandHandler("stats_archives", cmd_stats_archives))
    app.add_handler(CommandHandler("archiver_tout", cmd_archiver_tout))
    app.add_handler(CommandHandler("admin", cmd_admin_menu))
    app.add_handler(CallbackQueryHandler(callback_admin_menu, pattern="^adm:"))
    app.add_handler(CallbackQueryHandler(bouton, pattern="^fav:"))

    job_queue = app.job_queue

    job_queue.run_repeating(verifier_sorties, interval=900, first=20)

    job_queue.run_daily(
        rappel_renouvellement,
        time=dtime(hour=9, minute=0, tzinfo=FUSEAU),
    )

# DESACTIVE_PUBLICATION_AUTO : ne publie plus les episodes en base
#     job_queue.run_daily(
#         publier_nouveaux_episodes,
#         time=dtime(hour=20, minute=0, tzinfo=FUSEAU),
#     )

    job_queue.run_daily(
        publier_sorties_chaine,
        time=dtime(hour=7, minute=0, tzinfo=FUSEAU),
    )

    job_queue.run_daily(
        publier_sorties_jour_favoris,
        time=dtime(hour=8, minute=0, tzinfo=FUSEAU),
    )

    app.add_handler(CommandHandler("sondage", cmd_sondage))
    app.add_handler(CommandHandler("cloturer", cmd_cloturer))

    job_queue.run_daily(
        publier_sondage,
        time=dtime(hour=18, minute=0, tzinfo=FUSEAU),
        days=(0,),
    )
    job_queue.run_repeating(cloturer_sondages, interval=900, first=60)
    job_queue.run_repeating(annoncer_nouvelles_sorties, interval=600, first=90)

    app.add_handler(CommandHandler("resume", cmd_resume))

    for heure in HEURES_RESUME:
        job_queue.run_daily(
            publier_resume,
            time=dtime(hour=heure, minute=0, tzinfo=FUSEAU),
        )

    job_queue.run_repeating(annoncer_populaires, interval=1800, first=120)

    app.add_handler(CommandHandler("sondage_perso", cmd_sondage_perso))
    app.add_handler(CommandHandler("cloturer_perso", cmd_cloturer_perso))

    job_queue.run_repeating(cloturer_sondages_perso, interval=900, first=75)

    app.add_handler(CommandHandler("ia", cmd_ia))
    app.add_handler(CommandHandler("allowchat", cmd_allowchat))
    app.add_handler(CommandHandler("denychat", cmd_denychat))
    app.add_handler(CommandHandler("listchats", cmd_listchats))
    app.add_handler(MessageHandler((filters.ChatType.CHANNEL | filters.ChatType.GROUPS) & (filters.VIDEO | filters.Document.VIDEO) , traiter_channel_post))
# OTAKU_DESACTIVE : conversation IA desactivee
#     app.add_handler(MessageHandler(filters.ChatType.PRIVATE & filters.TEXT & ~filters.COMMAND, repondre_otaku_handler), group=10)
    app.add_handler(CallbackQueryHandler(callback_channel_video, pattern="^chv:"))

    app.add_handler(CommandHandler("noter", noter))
    app.add_handler(CommandHandler("classement", classement))
    app.add_handler(CommandHandler("recommande", recommande))
    app.add_handler(CommandHandler("quiz", cmd_quiz))
    app.add_handler(CommandHandler("duel", cmd_duel))
    app.add_handler(CommandHandler("mentions", cmd_mentions))
    app.add_handler(
        MessageHandler(
            filters.ChatType.GROUPS & filters.TEXT & ~filters.COMMAND,
            compter_mentions,
        ),
        group=1,
    )

    for heure in HEURES_QUIZ:
        job_queue.run_daily(
            publier_quiz,
            time=dtime(hour=heure, minute=0, tzinfo=FUSEAU),
        )

    job_queue.run_daily(
        publier_duel,
        time=dtime(hour=HEURE_DUEL, minute=0, tzinfo=FUSEAU),
    )
    job_queue.run_daily(
        promouvoir_mentions,
        time=dtime(hour=8, minute=30, tzinfo=FUSEAU),
        days=(1,),
    )
    job_queue.run_repeating(rafraichir_titres, interval=3600, first=30)

    app.add_handler(CommandHandler("canaux", canaux))

    job_queue.run_daily(
        publier_canaux,
        time=dtime(hour=HEURE_CANAUX, minute=0, tzinfo=FUSEAU),
    )

    app.add_handler(CommandHandler("saison", cmd_saison))
    app.add_handler(CommandHandler("annee", cmd_saison))
    app.add_handler(CallbackQueryHandler(saison_bouton, pattern="^(sai|sy):"))

    app.add_handler(TypeHandler(Update, verifier_abonnement), group=-2)
    app.add_handler(CallbackQueryHandler(verifier_bouton, pattern="^verif_abo$"))

    app.add_handler(CommandHandler("premium", cmd_premium))
    app.add_handler(CommandHandler("premium_ajouter", cmd_premium_ajouter))
    app.add_handler(CommandHandler("premium_retirer", cmd_premium_retirer))
    app.add_handler(CommandHandler("lien", cmd_lien))
    app.add_handler(CommandHandler("retirer_lien", cmd_retirer_lien))
    app.add_handler(CommandHandler("episodes", cmd_episodes))
    app.add_handler(CommandHandler("exporter_liens", cmd_exporter_liens))

    app.add_handler(CommandHandler("zip", cmd_zip))
    app.add_handler(CommandHandler("miniapp", cmd_miniapp))
    app.add_handler(CommandHandler("publier", cmd_publier))
    app.add_handler(CommandHandler("publier_maintenant", cmd_publier_maintenant))
    app.add_handler(CommandHandler("publier_jour", cmd_publier_jour))
    app.add_handler(MessageHandler(filters.ChatType.PRIVATE & filters.TEXT & ~filters.COMMAND & ~filters.FORWARDED, traiter_reponse_video))
    app.add_handler(CallbackQueryHandler(cmd_send_video, pattern="^dlv:"))

    job_queue.run_daily(
        purger_tables,
        time=dtime(hour=4, minute=0, tzinfo=FUSEAU),
    )

    app.add_handler(CommandHandler("planning", planning))

    app.add_handler(CallbackQueryHandler(callback_episodes_page, pattern="^ep:"))

    app.add_handler(CommandHandler("forward", cmd_forward))
    app.add_handler(MessageHandler(filters.ChatType.PRIVATE & filters.FORWARDED, traiter_forward))
    app.add_handler(CallbackQueryHandler(callback_forward, pattern="^fwd:"))

    log.info("AnimeAlert Buea demarre...")

    app.run_polling()


if __name__ == "__main__":
    main()



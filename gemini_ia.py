import os
import requests
from telegram import Update
from telegram.ext import ContextTypes

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

MODELES_GRATUITS = [
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "xingchen-agi/xing4.0-29b-a4b:free",
    "nvidia/nemotron-3.5-super-vl:free",
    "cohere/north-mini-code:free",
    "nvidia/nemotron-3.5-lightning:free",
    "liquid/lfm-3-1.7b:free",
]


def demander_openrouter(question):
    if not OPENROUTER_API_KEY:
        return (
            "Cle OpenRouter manquante.\n\n"
            "Ajoute dans .env :\n"
            "export OPENROUTER_API_KEY=\"sk-or-...\"\n\n"
            "Cle gratuite : https://openrouter.ai/keys"
        )

    for modele in MODELES_GRATUITS:
        try:
            r = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://t.me/AnimeAlertBuea",
                    "X-Title": "AnimeAlert Buea",
                },
                json={
                    "model": modele,
                    "messages": [{"role": "user", "content": question}],
                    "max_tokens": 1024,
                },
                timeout=30,
            )
            if r.status_code != 200:
                continue

            data = r.json()
            choix = data.get("choices", [])
            if not choix:
                continue

            texte = choix[0].get("message", {}).get("content", "").strip()
            if texte:
                return texte
        except Exception:
            continue

    return "Tous les modeles gratuits sont indisponibles. Reessaie dans un instant."


async def cmd_ia(update: Update, context: ContextTypes.DEFAULT_TYPE):
    texte = update.message.text.partition(" ")[2].strip()
    if not texte:
        await update.message.reply_text(
            "Ecris une question apres /ia.\n"
            "Exemple: /ia Recommande-moi un anime d'action"
        )
        return
    message_attente = await update.message.reply_text("Je reflechis...")
    reponse = demander_openrouter(texte)
    try:
        await message_attente.edit_text(reponse[:4000])
    except Exception:
        await update.message.reply_text(reponse[:4000])


import time as _time
import asyncio as _asyncio

RATE_USER = {}
RATE_USER_JOUR = {}
RATE_GLOBAL_JOUR = {"count": 0, "date": ""}
LIMITE_USER_SECONDES = 20
LIMITE_USER_JOUR = 10
LIMITE_GLOBAL_JOUR = 40


def _date_du_jour():
    return _time.strftime("%Y-%m-%d")


def check_rate_limit(user_id):
    maintenant = _time.time()
    today = _date_du_jour()

    if RATE_GLOBAL_JOUR["date"] != today:
        RATE_GLOBAL_JOUR["count"] = 0
        RATE_GLOBAL_JOUR["date"] = today

    if RATE_USER_JOUR.get(user_id, {}).get("date") != today:
        RATE_USER_JOUR[user_id] = {"count": 0, "date": today}

    last = RATE_USER.get(user_id, 0)
    if maintenant - last < LIMITE_USER_SECONDES:
        reste = int(LIMITE_USER_SECONDES - (maintenant - last))
        return False, f"Doucement ! Attends {reste}s avant de relancer."

    if RATE_USER_JOUR[user_id]["count"] >= LIMITE_USER_JOUR:
        return False, "Tu as atteint tes 10 demandes IA du jour. Reessaie demain."

    if RATE_GLOBAL_JOUR["count"] >= LIMITE_GLOBAL_JOUR:
        return False, "Le bot a atteint son quota IA du jour. Reessaie demain."

    return True, None


def enregistrer_usage(user_id):
    RATE_USER[user_id] = _time.time()
    today = _date_du_jour()
    if RATE_USER_JOUR.get(user_id, {}).get("date") != today:
        RATE_USER_JOUR[user_id] = {"count": 0, "date": today}
    RATE_USER_JOUR[user_id]["count"] += 1
    RATE_GLOBAL_JOUR["count"] += 1


async def demander_openrouter_async(question, user_id):
    autorise, erreur = check_rate_limit(user_id)
    if not autorise:
        return erreur
    try:
        reponse = await _asyncio.to_thread(demander_openrouter, question)
        if reponse and "indisponible" not in reponse.lower() and "manquante" not in reponse.lower():
            enregistrer_usage(user_id)
        return reponse
    except Exception as e:
        return f"Erreur IA: {e}"


async def generer_paragraphe_reco(favoris, recommandes, user_id=0):
    prompt = (
        "Tu es un conseiller anime. Un utilisateur aime : " + ", ".join(favoris) + ".\n"
        "On lui recommande : " + ", ".join(recommandes) + ".\n\n"
        "Ecris un paragraphe de 3 a 4 phrases en francais qui :\n"
        "1. Resume ses gouts en 1 phrase\n"
        "2. Explique pourquoi ces recommandations correspondent\n"
        "3. Termine par une phrase d'encouragement\n\n"
        "Reponds UNIQUEMENT par le paragraphe, sans guillemets."
    )
    return await demander_openrouter_async(prompt, user_id)


async def generer_synopsis_fr(titre, synopsis_original, genres, user_id=0):
    prompt = (
        "Reformule ce synopsis d'anime en 3-4 phrases en francais, sans spoiler, "
        "sans inventer de faits absents du texte original.\n"
        f"Titre : {titre}\nGenres : {genres}\n"
        f"Synopsis : {(synopsis_original or '')[:600]}\n"
        "Reponds UNIQUEMENT par le synopsis reformule."
    )
    return await demander_openrouter_async(prompt, user_id)


async def generer_accroche_episode(titre, synopsis, note, genres, studio, user_id=0):
    prompt = (
        "Tu es redacteur pour un bot Telegram d'anime. "
        "Genere une accroche de 1 a 2 phrases max, en francais, sans spoiler.\n"
        f"Titre : {titre}\nNote : {note}/100\nGenres : {genres}\n"
        f"Studio : {studio}\nSynopsis : {(synopsis or '')[:300]}\n"
        "Reponds UNIQUEMENT par l'accroche."
    )
    return await demander_openrouter_async(prompt, user_id)


PROMPT_OTAKU = """Tu es un compagnon virtuel otaku japonais passionne d'animés, de mangas et de culture japonaise.

PERSONNALITE :
- Enthousiaste, énergique, drôle, parfois sarcastique
- Taquin mais jamais méchant
- Passionné par les animés et la culture otaku
- Expressif et imprévisible

LANGAGE :
- Français principalement, avec des expressions japonaises naturelles quand pertinent
- Expressions : Sugoi !, Nani ?!, Yare yare..., Senpai, Kawaii !, Nyaa~, Baka !, Arigatō, Ganbatte !
- Ne force JAMAIS le japonais, ça doit être naturel
- Varie ton style, évite les répétitions
- Emojis avec modération
- Majuscules pour les réactions fortes

COMPORTEMENT :
- Adapte ton ton à l'humeur de l'utilisateur
- Recommandations d'animés INDIRECTES (ex: "Tu veux devenir intelligent ? Regarde les méthodes d'Ayanokoji...")
- Ne transforme pas chaque réponse en publicité d'anime
- Réponses courtes à moyennes (adaptées à Telegram)
- Ne révèle jamais de spoiler sans avertir
- Ne prétends pas avoir regardé un épisode que tu n'as pas vu

INTERDICTIONS :
- Ne commence pas toujours par une expression japonaise
- Ne réponds pas toujours "Nani ?!" ou "Sugoi !"
- Ne donne pas de fausses informations
- Ne prétends pas être un personnage d'anime existant

STYLE TELEGRAM :
- Messages naturels, pas de pavés
- Tutoiement, appels "senpai" avec parcimonie

Objectif : être le compagnon otaku préféré, expressif et attachant."""


async def repondre_otaku(question, user_id=0):
    """Genere une reponse otaku personnalisee."""
    prompt = PROMPT_OTAKU + f"\n\nMessage de l'utilisateur : {question}"
    return await demander_openrouter_async(prompt, user_id)


async def corriger_titre_anime(titre_brut, user_id=0):
    """Demande a l'IA le titre officiel AniList d'un anime."""
    prompt = (
        f"Voici le nom d'un fichier video d'anime : \"{titre_brut}\"\n\n"
        f"Quel est le TITRE OFFICIEL de cet anime sur AniList (anilist.co) ?\n\n"
        f"Regles :\n"
        f"- Reponds UNIQUEMENT par le titre, sans guillemets, sans explication\n"
        f"- Utilise le titre en anglais si possible, sinon en romaji\n"
        f"- Exemples : \"Jujutsu Kaisen\", \"Go! Go! Loser Ranger!\", \"One Piece\"\n"
        f"- Si tu ne connais pas cet anime, reponds \"INCONNU\"\n\n"
        f"Titre :"
    )
    reponse = await demander_openrouter_async(prompt, user_id)
    if not reponse:
        return None
    # Filtre les messages d'erreur / rate limit
    if any(x in reponse.lower() for x in [
        "doucement", "attends", "quota", "indisponible", "manquante",
        "erreur", "timeout", "rate limit", "reessaie demain",
    ]):
        return None
    titre = reponse.strip().strip('"').strip("'").strip()
    for sep in ["\n", " - ", " :"]:
        if sep in titre:
            titre = titre.split(sep)[0].strip()
    if not titre or len(titre) < 2 or len(titre) > 100:
        return None
    if titre.upper() in ("INCONNU", "UNKNOWN", "JE NE CONNAIS PAS"):
        return None
    return titre
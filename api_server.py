"""Mini App API server - tourne dans le meme process que le bot."""
import os
import logging
from aiohttp import web

log = logging.getLogger("animealert.api")
_ctx = {}


def set_context(cursor, conn, chercher_anime, chercher_anime_ia, titre_de, liens_streaming):
    _ctx["cursor"] = cursor
    _ctx["conn"] = conn
    _ctx["chercher_anime"] = chercher_anime
    _ctx["chercher_anime_ia"] = chercher_anime_ia
    _ctx["titre_de"] = titre_de
    _ctx["liens_streaming"] = liens_streaming


async def get_liens(request):
    """Retourne liens.json frais depuis la DB."""
    cursor = _ctx["cursor"]
    try:
        animes = {}
        cursor.execute(
            "SELECT anime_id, titre, episode, lien FROM liens_episodes "
            "ORDER BY anime_id, episode"
        )
        for anime_id, titre, episode, lien in cursor.fetchall():
            bloc = animes.setdefault(str(anime_id), {"titre": titre, "episodes": []})
            bloc["episodes"].append({"ep": episode, "lien": lien})

        cursor.execute("SELECT anime_id, titre, episode FROM videos_episodes")
        for anime_id, titre, episode in cursor.fetchall():
            bloc = animes.setdefault(str(anime_id), {"titre": titre, "episodes": []})
            if not any(e["ep"] == episode for e in bloc["episodes"]):
                bloc["episodes"].append({"ep": episode, "lien": None})

        return web.json_response({"animes": animes})
    except Exception as e:
        log.error(f"/api/liens: {e}")
        return web.json_response({"error": str(e)}, status=500)


async def get_search(request):
    """Recherche avec cascade AniList -> rapidfuzz -> IA."""
    q = request.query.get("q", "").strip()
    if not q or len(q) < 2:
        return web.json_response({"error": "query too short"}, status=400)

    try:
        resultats = await _ctx["chercher_anime_ia"](q, 0, "miniapp")
        sortie = [{
            "id": r["id"],
            "titre": _ctx["titre_de"](r),
            "cover": (r.get("coverImage") or {}).get("medium")
                     or (r.get("coverImage") or {}).get("large") or "",
            "episodes": r.get("episodes"),
            "year": r.get("seasonYear"),
            "score": r.get("averageScore"),
        } for r in resultats[:5]]
        return web.json_response({"results": sortie})
    except Exception as e:
        log.error(f"/api/search: {e}")
        return web.json_response({"error": str(e)}, status=500)


async def health(request):
    return web.Response(text="ok")


@web.middleware
async def cors(request, handler):
    if request.method == "OPTIONS":
        response = web.Response()
    else:
        response = await handler(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


def create_app():
    app = web.Application(middlewares=[cors])
    app.router.add_get("/api/liens", get_liens)
    app.router.add_get("/api/search", get_search)
    app.router.add_get("/health", health)
    return app


async def start_server(port):
    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    log.info(f"[api] listening on 0.0.0.0:{port}")
    return runner
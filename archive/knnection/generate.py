"""K-nnection puzzle generator.

Each daily board = 3 generated categories + 1 hand-written purple.
  yellow = songs by one artist, OR groups under one label   (the "obvious" kinds)
  green  = groups that debuted in one year, OR a word hidden in song titles
  blue   = songs released in one year (across artists), OR debut songs
  purple = a hand-written category from data.PURPLE (rotated in order)

Two rules make a board good:
1. Ambiguity check: every tile belongs to exactly ONE of the day's categories.
2. Decoy score: tiles that LOOK like they fit another category score points
   (a group tile next to its own songs, a 2022 song next to "debuted in 2022",
   "Red Flavor" next to food titles...). The generator builds many valid boards
   per day and keeps the one with the most decoys.

Usage: python generate.py [days] [seed] > puzzles.json
"""
import json, random, re, sys
from collections import defaultdict
from data import GROUPS, IDOLS, SONGS, WORDS, WORD_CAT_NAMES, PURPLE, DEBUT_SONGS, NEAR_MISS

CANDIDATES_PER_DAY = 60
tokens = lambda s: set(re.findall(r"[\w]+", s.lower()))

# ---------- Item index: tile name -> facts used by the decoy score ----------
INFO = {}
for gid, (name, label, debut) in GROUPS.items():
    INFO[name] = {"type": "group", "gid": gid, "label": label, "debut": debut}
for iid, (name, gid) in IDOLS.items():
    INFO[name] = {"type": "idol", "gid": gid, "label": GROUPS[gid][1]}
for title, artist, year in SONGS:
    INFO[title] = {"type": "song", "gid": artist, "year": year,
                   "label": GROUPS[artist][1] if artist else None,
                   "artist_debut": GROUPS[artist][2] if artist else None}

def build_categories():
    gname = {gid: g[0] for gid, g in GROUPS.items()}
    by_artist, by_label, by_debut, by_word, by_year = (defaultdict(set) for _ in range(5))
    year_artists = defaultdict(set)
    for title, artist, year in SONGS:
        if artist:
            by_artist[artist].add(title)
        by_year[year].add(title)
        year_artists[year].add(artist)
        for cat, words in WORDS.items():
            if tokens(title) & words:
                by_word[cat].add(title)
    for gid, (name, label, debut) in GROUPS.items():
        if label:
            by_label[label].add(name)
        by_debut[debut].add(name)

    C = {"yellow": [], "green": [], "blue": []}
    for a, s in by_artist.items():
        if len(s) >= 5:
            C["yellow"].append({"key": f"artist:{a}", "kind": "artist", "arg": a, "name": f"{gname[a]} songs", "set": s})
    for l, s in by_label.items():
        if len(s) >= 5:
            C["yellow"].append({"key": f"label:{l}", "kind": "label", "arg": l,
                                "name": f"{'HYBE-family' if l == 'HYBE' else l} groups", "set": s})
    for y, s in by_debut.items():
        if len(s) >= 4:
            C["green"].append({"key": f"debut:{y}", "kind": "debut", "arg": y, "name": f"Groups that debuted in {y}", "set": s})
    for w, s in by_word.items():
        if len(s) >= 4:
            C["green"].append({"key": f"word:{w}", "kind": "word", "arg": w, "name": WORD_CAT_NAMES[w], "set": s})
    for y, s in by_year.items():
        if len(s) >= 6 and len(year_artists[y]) >= 4:   # must cut across artists
            C["blue"].append({"key": f"year:{y}", "kind": "year", "arg": y, "name": f"Songs released in {y}", "set": s})
    C["blue"].append({"key": "debutsong", "kind": "debutsong", "arg": None, "name": "Debut songs", "set": set(DEBUT_SONGS)})
    purple = [{"key": f"purple:{i}", "kind": "purple", "arg": None, "name": p["name"], "set": set(p["items"]),
               "unverified": p.get("unverified", False)} for i, p in enumerate(PURPLE)]
    return C, purple

def near_miss(tile, cat):
    """True if `tile` plausibly looks like it belongs to `cat` (but doesn't)."""
    i, k, a = INFO.get(tile), cat["kind"], cat["arg"]
    if i is None:
        return False
    t = i["type"]
    if k == "artist":
        return (t in ("group", "idol") and i["gid"] == a) or \
               (t == "song" and i["gid"] != a and i["label"] and i["label"] == GROUPS[a][1])
    if k == "label":
        return t in ("song", "idol") and i["label"] == a
    if k == "debut":
        return (t == "song" and i["year"] == a) or (t == "group" and abs(i["debut"] - a) == 1)
    if k == "year":
        return (t == "song" and abs(i["year"] - a) == 1) or (t == "group" and i["debut"] == a)
    if k == "word":
        return bool(tokens(tile) & NEAR_MISS.get(a, set()))
    if k == "debutsong":
        # a non-debut song from the artist's debut year, or a group tile
        return (t == "song" and i["artist_debut"] == i["year"]) or t == "group"
    return False

def try_board(rng, chosen):
    board = []
    for i, c in enumerate(chosen):
        others = set().union(*(o["set"] for j, o in enumerate(chosen) if j != i))
        pool = sorted(c["set"] - others)
        if len(pool) < 4:
            return None
        board.append(rng.sample(pool, 4))
    tiles = [t for g in board for t in g]
    if len(set(tiles)) != 16 or any(sum(t in c["set"] for c in chosen) != 1 for t in tiles):
        return None
    return board

def decoy_score(chosen, board):
    score = 0
    for i, grp in enumerate(board):
        for t in grp:
            score += sum(bool(near_miss(t, c)) for j, c in enumerate(chosen) if j != i)
    return score

def make_puzzle(rng, C, purple_cat, usage):
    best = None
    for _ in range(4000):
        chosen = [rng.choice(C["yellow"]), rng.choice(C["green"]), rng.choice(C["blue"]), purple_cat]
        board = try_board(rng, chosen)
        if not board:
            continue
        # Decoys first; small penalty for categories used recently, for variety.
        s = decoy_score(chosen, board) - 1.5 * sum(usage[c["key"]] for c in chosen[:3])
        if best is None or s > best[0]:
            best = (s, chosen, board, decoy_score(chosen, board))
    if best is None:
        raise RuntimeError(f"Couldn't build a clean board around '{purple_cat['name']}'")
    _, chosen, board, decoys = best
    for c in chosen[:3]:
        usage[c["key"]] += 1
    colors = ["yellow", "green", "blue", "purple"]
    return {"decoys": decoys, "cats": [
        {"color": colors[i], "name": c["name"], "items": board[i], **({"unverified": True} if c.get("unverified") else {})}
        for i, c in enumerate(chosen)]}

def main():
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else 2027
    rng = random.Random(seed)
    C, purple = build_categories()
    usage = defaultdict(int)
    out = [make_puzzle(rng, C, purple[d % len(purple)], usage) for d in range(days)]
    print(f"avg decoys per board: {sum(p['decoys'] for p in out) / len(out):.1f}", file=sys.stderr)
    json.dump([p["cats"] for p in out], sys.stdout, ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main()

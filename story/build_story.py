#!/usr/bin/env python3
"""data/counts.json + words.txt -> site/story/story.json: in the game, pick the name.

    python3 build_story.py        # BUILD_OUT=... writes elsewhere (publish.sh compares)

Input: the counts the game ships (publish.sh proves site/counts.js holds data/counts.json)
and the categories in words.txt. The pairs are the game's own: dailyPairs from
site/leak-logic.js, re-done here for every day of a year from 2026-11-14 (the day the
second batch of words joined), with the GENERIC set and the DEBUT dates read out of that
file. test/story.test.mjs re-draws them with the real JS and requires the same list.

The headline: when exactly one of a pair is a person's name (words.txt's "# nombres"), the
name is the one that leaked more about four times in five. The control that could kill it:
the game only pairs words whose counts are 1.25x to 10x apart, and any group of words might
win "most" of such pairs by accident. So give the name label to 1,000 random sets of words
of the same size, from the same words in play, and ask again.

The RNG is mulberry32, written out (the game's own), so neither the pairs nor the shuffles
depend on Python's random.
"""
import json, os, re
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
COUNTS = os.path.join(HERE, "data", "counts.json")
WORDS = os.path.join(HERE, "words.txt")
LOGIC = os.path.join(HERE, "site", "leak-logic.js")
OUT = os.environ.get("BUILD_OUT", os.path.join(HERE, "site", "story", "story.json"))
START, DAYS, PER_DAY = "2026-11-14", 365, 10
N_SH = 1000
SEED = 20261116
NAMES = "nombres"


def mulberry32(a):
    def nxt():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return nxt


def logic():
    """GENERIC, DEBUT, MIN_RATIO, MAX_RATIO as leak-logic.js states them"""
    s = open(LOGIC, encoding="utf-8").read()
    gen = set(re.findall(r'"([^"]+)"', re.search(r"GENERIC = new Set\(\[(.*?)\]\)", s, re.S).group(1)))
    debut = {}
    for d, ws in re.findall(r'"(\d{4}-\d\d-\d\d)": "([^"]+)"', re.search(r"DEBUT = \{(.*?)\};", s, re.S).group(1)):
        for w in ws.split():
            debut[w] = d
    lo, hi = map(float, re.search(r"MIN_RATIO = ([\d.]+), MAX_RATIO = ([\d.]+);", s).groups())
    return gen, debut, lo, hi


def daily_pairs(c, iso, gen, debut, lo, hi, n=PER_DAY):
    words = sorted(w for w in c if w not in gen and not debut.get(w, "") > iso)
    r = mulberry32(int(iso.replace("-", "")))
    used, out = set(), []
    for _ in range(5000):
        if len(out) >= n:
            break
        a = words[int(r() * len(words))]
        b = words[int(r() * len(words))]
        x, y = c[a], c[b]
        if a == b or a in used or b in used or not (x > 0 and y > 0) or x == y:
            continue
        if not lo <= max(x, y) / min(x, y) <= hi:
            continue
        used |= {a, b}
        out.append([a, b] if r() < 0.5 else [b, a])
    return out


def categories():
    cat, cur = {}, None
    for line in open(WORDS, encoding="utf-8"):
        line = line.strip()
        if line.startswith("# desde"):
            continue                       # the second batch re-opens the same categories
        if line.startswith("#"):
            cur = line[1:].strip()
        elif line:
            cat[line] = cur
    return cat


def mixed(pairs, group, c):
    """pairs with exactly one word in group -> (won, n)"""
    won = n = 0
    for a, b in pairs:
        if (a in group) == (b in group):
            continue
        x, y = (a, b) if a in group else (b, a)
        n += 1
        won += c[x] > c[y]
    return won, n


def main():
    c = json.load(open(COUNTS, encoding="utf-8"))
    cat = categories()
    assert set(cat) == set(c), f"words.txt and counts.json differ: {sorted(set(cat) ^ set(c))}"
    gen, debut, lo, hi = logic()
    d0 = date.fromisoformat(START)
    days = [(d0 + timedelta(i)).isoformat() for i in range(DAYS)]
    pairs = [p for iso in days for p in daily_pairs(c, iso, gen, debut, lo, hi)]
    play = sorted({w for p in pairs for w in p})
    names = {w for w in play if cat[w] == NAMES}
    won, n = mixed(pairs, names, c)

    rnd = mulberry32(SEED)
    sh = []
    for _ in range(N_SH):
        s = play[:]
        for i in range(len(s) - 1, 0, -1):         # Fisher-Yates; the first k are the "names"
            j = int(rnd() * (i + 1))
            s[i], s[j] = s[j], s[i]
        w, m = mixed(pairs, set(s[:len(names)]), c)
        sh.append(round(w / m, 6))

    idx = {w: i for i, w in enumerate(play)}
    per = {}
    for a, b in pairs:
        if (a in names) == (b in names):
            continue
        x, y = (a, b) if a in names else (b, a)
        r = per.setdefault(x, [0, 0])
        r[0] += c[x] > c[y]
        r[1] += 1
    check = {
        "n_pairs": len(pairs), "n_mixed": n, "won": won, "rate": round(won / n, 6),
        "n_names": len(names), "n_play": len(play),
        "sh_max": max(sh), "sh_med": sorted(sh)[len(sh) // 2], "as_high": sum(x >= won / n for x in sh),
        "worst": min(r[0] / r[1] for r in per.values()),
    }
    D = {
        "source": "Have I Been Pwned, Pwned Passwords (api.pwnedpasswords.com/range), counts fetched November 2026",
        "start": START, "days": DAYS, "seed": SEED,
        "words": [{"w": w, "n": c[w], "cat": cat[w]} for w in play],
        "pairs": [[idx[a], idx[b]] for a, b in pairs],
        "names": NAMES, "shuffles": sh,
        "check": check,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(D, f, separators=(",", ":"), ensure_ascii=False)
    print(json.dumps(check, indent=1))
    for w, (a, m) in sorted(per.items(), key=lambda kv: kv[1][0] / kv[1][1]):
        print(f"  {w:12} {c[w]:>9} won {a}/{m}")


if __name__ == "__main__":
    main()

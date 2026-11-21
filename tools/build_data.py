#!/usr/bin/env python3
"""
Build app/data.js for NikkeCharacterMatome.
Sources:
  - Game8 (https://game8.jp/nikke/491929, 491930, 491931): master roster, Japanese names, stats, CV, skills
  - NIKKE Wiki Fandom (https://nikke-goddess-of-victory-international.fandom.com): English names, full-body & costume image URLs
"""

import argparse
import datetime
import hashlib
import json
import os
import re
import time
import urllib.parse
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / "tools" / "cache"
GAME8_CACHE = CACHE_DIR / "game8"
FANDOM_CACHE = CACHE_DIR / "fandom"
OUT_DATA_JS = ROOT / "app" / "data.js"
OUT_REPORT = ROOT / "tools" / "roster_report.json"

GAME8_LISTS = [
    ("SSR", "https://game8.jp/nikke/491929"),
    ("SR", "https://game8.jp/nikke/491930"),
    ("R", "https://game8.jp/nikke/491931"),
]

FANDOM_API = "https://nikke-goddess-of-victory-international.fandom.com/api.php"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NikkeMatomeBot/1.0"}

VALID_RARITIES = {"SSR", "SR", "R"}
VALID_MANUFACTURERS = {"エリシオン", "ミシリス", "テトラ", "ピルグリム", "アブノーマル"}
VALID_WEAPONS = {"AR", "SMG", "SG", "SR", "RL", "MG"}
VALID_BURSTS = {"I", "II", "III"}
VALID_ROLES = {"火力", "防御", "支援"}
VALID_ELEMENTS = {"灼熱", "水冷", "風圧", "電撃", "鉄甲"}

# Explicit Game8 list name -> Fandom page title for shorthand/variant names
MANUAL_G8_TO_FANDOM = {
    "マリアン": "Marian: Queen",
    "ラプンツェル(4周年)": "Rapunzel: Sanctuary",
    "紅蓮(神殺)": "Scarlet: Goddeath",
    "ベロータ(ハロウィン)": "Belorta: Pumpkin Witch",
    "シン(バニー)": "Sin: Swift Bunny",
    "ギルティ(バニー)": "Guilty: Mighty Bunny",
    "ドレイク(新衣装)": "Drake: Great Villain",
    "クイーン": "Queen (Makoto Niijima)",
    "雪子": "Yukiko Amagi",
    "マクスウェル(新衣装)": "Maxwell: Ordinary Mechanic",
    "ラプラス(新衣装)": "Laplace: Ultimate Hero",
    "シンデレラ(水着)": "Cinderella: Crystal Wave",
    "マルチャーナ(水着)": "Marciana: Marine Study",
    "ブラック": "Ark Ranger Black",
    "ネオン(オバスペ)": "Neon: Vision Eye",
    "アニス(オバスペ)": "Anis: Star",
    "アルカナ(制服)": "Arcana: Fortune Mate",
    "EH": "E.H.",
    "たきな": "Takina Inoue",
    "千束": "Chisato Nishikigi",
    "スノーホワイト(新衣装)": "Snow White: Heavy Arms",
    "ブリッド(クリスマス)": "Brid: Silent Track",
    "ディーゼル(クリスマス)": "Diesel: Winter Sweets",
    "ソリン(新衣装)": "Soline: Frost Ticket",
    "デルタ(忍者)": "Delta: Ninja Thief",
    "エイダ": "Ada Wong",
    "ジル": "Jill Valentine",
    "ミルク(バニー)": "Milk: Blooming Bunny",
    "エード(バニー)": "Ade: Agent Bunny",
    "ベスティー(新衣装)": "Vesti: Tactical Upgrade",
    "ウンファ(新衣装)": "Eunhwa: Tactical Upgrade",
    "エマ(新衣装)": "Emma: Tactical Upgrade",
    "ドロシー(水着)": "Dorothy: Serendipity",
    "エレグ(水着)": "Elegg: Boom and Shock",
    "ミハラ(オーバースペック)": "Mihara: Bonding Chain",
    "レイ(仮称)": "Rei Ayanami (Tentative Name)",
    "アスカ(WILLE)": "Asuka Shikinami Langley: WILLE",
    "アンカー(メイド)": "Anchor: Innocent Maid",
    "マスト(メイド)": "Mast: Romantic Maid",
    "ラピ(レッドフード)": "Rapi: Red Hood",
    "ギロチン(勇者)": "Guillotine: Winter Slayer",
    "メイデン(僧侶)": "Maiden: Ice Rose",
    "ラプンツェル(周年)": "Rapunzel: Pure Grace",
    "クエンシー(怪盗)": "Quency: Escape Queen",
    "マリ": "Mari Makinami Illustrious",
    "レイ": "Rei Ayanami",
    "アスカ": "Asuka Shikinami Langley",
    "サクラ(水着)": "Sakura: Bloom in Summer",
    "ロザンナ(水着)": "Rosanna: Chic Ocean",
    "アリス(バニー)": "Alice: Wonderland Bunny",
    "ソーダ(バニー)": "Soda: Twinkling Bunny",
    "キロ": "Kilo",
    "プリバティ(メイド)": "Privaty: Unkind Maid",
    "紅蓮(黒)": "Scarlet: Black Shadow",
    "ミカ(温泉)": "Mica: Snow Buddy",
    "ルドミラ(温泉)": "Ludmilla: Winter Owner",
    "スノーホワイト(周年)": "Snow White: Innocent Days",
    "ヘルム(水着)": "Helm: Aquamarine",
    "アニス(水着)": "Anis: Sparkling Summer",
    "ネオン(水着)": "Neon: Blue Ocean",
    "メアリー(水着)": "Mary: Bay Goddess",
    "エヌ(クリスマス)": "Anne: Miracle Fairy",
    "ルピー(クリスマス)": "Rupee: Winter Shopper",
    "紅蓮": "Scarlet",
    "クレア": "Claire Redfield",
    "ミサト": "Misato Katsuragi",
    "オーシャン": "IDoll Ocean",
    "サン": "IDoll Sun",
    "ソルジャーEG": "Soldier EG",
    "ソルジャーFA": "Soldier FA",
    "ソルジャーOW": "Soldier OW",
    "フラワー": "IDoll Flower",
}


def fetch_cached(url: str, cache_path: Path, refresh: bool = False, delay: float = 0.12) -> str:
    if cache_path.exists() and not refresh:
        return cache_path.read_text(encoding="utf-8")
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    r = requests.get(url, headers=HEADERS, timeout=25)
    r.raise_for_status()
    cache_path.write_text(r.text, encoding="utf-8")
    if delay > 0:
        time.sleep(delay)
    return r.text


def fetch_fandom_json(params: dict, cache_key: str, refresh: bool = False) -> dict:
    cache_path = FANDOM_CACHE / f"{cache_key}.json"
    if cache_path.exists() and not refresh:
        return json.loads(cache_path.read_text(encoding="utf-8"))
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    r = requests.get(FANDOM_API, params=params, headers=HEADERS, timeout=30)
    r.raise_for_status()
    data = r.json()
    cache_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    time.sleep(0.1)
    return data


def norm_jp(s: str) -> str:
    return (
        s.replace("：", ":")
        .replace("・", "")
        .replace(" ", "")
        .replace("　", "")
        .replace("（", "(")
        .replace("）", ")")
        .strip()
    )


def norm_burst(raw: str) -> str:
    s = raw.strip().upper()
    s = s.replace("バースト", "").replace("Ⅰ", "I").replace("Ⅱ", "II").replace("Ⅲ", "III")
    if "III" in s or "3" in s or "Λ" in s or "ALL" in s:
        return "III"
    if "II" in s or "2" in s:
        return "II"
    if "I" in s or "1" in s:
        return "I"
    return ""


def parse_game8_list(rarity: str, url: str, refresh: bool = False) -> List[dict]:
    slug = url.rstrip("/").split("/")[-1]
    html = fetch_cached(url, GAME8_CACHE / f"list_{rarity}_{slug}.html", refresh=refresh)
    soup = BeautifulSoup(html, "html.parser")
    table = None
    for t in soup.find_all("table"):
        rows = t.find_all("tr")
        if len(rows) > 8:
            hdr = [c.get_text(strip=True) for c in rows[0].find_all(["th", "td"])]
            if hdr and "キャラ" in hdr[0]:
                table = t
                break
    if not table:
        raise RuntimeError(f"Could not find character table on {url}")

    items = []
    for tr in table.find_all("tr")[1:]:
        tds = tr.find_all(["th", "td"])
        if len(tds) < 8:
            continue
        a = tds[0].find("a", href=True)
        name = a.get_text(strip=True) if a else tds[0].get_text(strip=True)
        href = a["href"] if a else ""
        if href.startswith("/"):
            href = "https://game8.jp" + href
        burst_txt = tds[2].get_text(strip=True)
        if not burst_txt:
            img = tds[2].find("img", alt=True)
            if img:
                burst_txt = img["alt"]
        squad = tds[7].get_text(strip=True)
        if squad in ("-", "ー", "不明", "なし"):
            squad = ""
        items.append({
            "rarity": rarity,
            "list_name": name,
            "url": href,
            "burst": norm_burst(burst_txt),
            "element": tds[3].get_text(strip=True),
            "manufacturer": tds[4].get_text(strip=True),
            "weapon": tds[5].get_text(strip=True).upper(),
            "role": tds[6].get_text(strip=True),
            "squad": squad,
        })
    return items


def parse_game8_detail(item: dict, refresh: bool = False) -> dict:
    url = item["url"]
    if not url:
        return {"name": item["list_name"], "cv": "", "skills": []}
    slug = url.rstrip("/").split("/")[-1]
    html = fetch_cached(url, GAME8_CACHE / f"char_{slug}.html", refresh=refresh)
    soup = BeautifulSoup(html, "html.parser")

    official_name = item["list_name"]
    cv = ""
    burst_detail = item["burst"]

    # Find top status table containing CV: or バースト
    for t in soup.find_all("table")[:6]:
        txt = t.get_text(" ", strip=True)
        if "CV:" in txt or "CV：" in txt or ("バースト" in txt and "属性" in txt):
            first_cell = t.find(["th", "td"])
            if first_cell:
                fc_txt = first_cell.get_text(" ", strip=True)
                m_cv = re.search(r"CV[:：]\s*(.*)$", fc_txt)
                if m_cv:
                    cv = m_cv.group(1).strip()
                    if cv in ("-", "ー", "不明", "なし"):
                        cv = ""
                    name_part = fc_txt[:m_cv.start()].strip()
                    if name_part:
                        official_name = name_part
                else:
                    # Sometimes name is in first_cell without CV
                    if fc_txt and len(fc_txt) < 40 and "関連記事" not in fc_txt and "評価" not in fc_txt:
                        official_name = fc_txt
            # Check burst in this table if missing from list
            if not burst_detail:
                for td in t.find_all(["th", "td"]):
                    td_t = td.get_text(strip=True)
                    if td_t.startswith("バースト") and len(td_t) <= 8:
                        b = norm_burst(td_t)
                        if b:
                            burst_detail = b
            break

    # Extract skills from スキル一覧 section
    skills = []
    skill_heading = None
    for h in soup.find_all(["h2", "h3"]):
        ht = h.get_text(strip=True)
        if "スキル一覧" in ht:
            skill_heading = h
            break
    if not skill_heading:
        for h in soup.find_all(["h2", "h3"]):
            ht = h.get_text(strip=True)
            if ht.endswith("のスキル"):
                skill_heading = h
                break

    if skill_heading:
        sib = skill_heading.find_next_sibling()
        skill_idx = 0
        while sib:
            if sib.name == "h2":
                break
            if sib.name == "table":
                rows = sib.find_all("tr")
                if len(rows) >= 2:
                    hdr_txt = rows[0].get_text(" ", strip=True)
                    body_txt = rows[1].get_text("\n", strip=True)
                    if hdr_txt.startswith("スキル（") or hdr_txt.startswith("スキル(") or hdr_txt.startswith("バーストスキル（") or hdr_txt.startswith("バーストスキル("):
                        is_burst = hdr_txt.startswith("バースト")
                        m_name = re.search(r"[（(](.+?)[）)]", hdr_txt)
                        sk_name = m_name.group(1).strip() if m_name else hdr_txt
                        if is_burst:
                            sk_type = "バーストスキル"
                        else:
                            skill_idx += 1
                            sk_type = f"スキル{skill_idx}"

                        # Extract cooldown info if present
                        m_cd = re.search(r"【\s*クールタイム\s*】\s*\n?\s*([^\n【]+)", body_txt)
                        if m_cd:
                            cd_val = m_cd.group(1).strip().lstrip("・").strip()
                            if cd_val and cd_val not in ("無し", "なし", "-"):
                                sk_type = f"{sk_type} (CT: {cd_val})"
                            else:
                                sk_type = f"{sk_type} (パッシブ)"

                        # Extract effect text
                        m_eff = re.search(r"【\s*効果\s*】\s*\n?(.+)$", body_txt, re.DOTALL)
                        sk_desc = m_eff.group(1).strip() if m_eff else body_txt.strip()
                        sk_desc = re.sub(r"\n{2,}", "\n", sk_desc)
                        skills.append({
                            "name": sk_name,
                            "type": sk_type,
                            "desc": sk_desc,
                        })
            sib = sib.find_next_sibling()

    # Extract 立ち絵 from Game8 if available
    tachie_url = ""
    for img in soup.find_all("img"):
        alt = img.get("alt", "")
        if "立ち絵" in alt:
            u = img.get("data-src") or img.get("src") or ""
            if u.startswith("http"):
                tachie_url = u
                break

    return {
        "name": official_name,
        "cv": cv,
        "burst": burst_detail,
        "skills": skills,
        "tachie_url": tachie_url,
    }


def fetch_fandom_roster(refresh: bool = False) -> Dict[str, dict]:
    cat_data = fetch_fandom_json({
        "action": "query",
        "list": "categorymembers",
        "cmtitle": "Category:Playable_characters",
        "cmlimit": 500,
        "format": "json",
    }, "category_playable", refresh=refresh)
    titles = [m["title"] for m in cat_data["query"]["categorymembers"]]

    fandom_data = {}
    for i in range(0, len(titles), 50):
        batch = titles[i:i+50]
        res = fetch_fandom_json({
            "action": "query",
            "titles": "|".join(batch),
            "prop": "revisions",
            "rvprop": "content",
            "rvslots": "main",
            "format": "json",
        }, f"wikitext_batch_{i}", refresh=refresh)
        pages = res.get("query", {}).get("pages", {})
        for pid, p in pages.items():
            title = p.get("title", "")
            wt = p.get("revisions", [{}])[0].get("slots", {}).get("main", {}).get("*", "")
            def get_field(k: str) -> str:
                m = re.search(rf"^\s*\|\s*{k}\s*=\s*(.*)$", wt, re.MULTILINE)
                if not m:
                    return ""
                val = re.sub(r"<ref[^>]*>.*?</ref>", "", m.group(1))
                val = re.sub(r"<ref[^>]*/>", "", val)
                val = re.sub(r"<[^>]+>", " ", val)
                return val.strip()
            fandom_data[title] = {
                "title": title,
                "name_jp": get_field("name_jp"),
                "name_en": get_field("name_en") or title,
                "rarity": get_field("rarity").upper(),
            }
    return fandom_data


def fetch_fandom_page_images(title: str, refresh: bool = False) -> List[str]:
    h = hashlib.md5(title.encode("utf-8")).hexdigest()[:12]
    res = fetch_fandom_json({
        "action": "parse",
        "page": title,
        "prop": "images",
        "format": "json",
    }, f"parse_imgs_{h}", refresh=refresh)
    return res.get("parse", {}).get("images", [])


def resolve_image_urls(file_titles: List[str], refresh: bool = False) -> Dict[str, str]:
    url_map = {}
    unique = sorted(set(file_titles))
    for i in range(0, len(unique), 50):
        batch = unique[i:i+50]
        res = fetch_fandom_json({
            "action": "query",
            "titles": "|".join(f"File:{fn}" for fn in batch),
            "prop": "imageinfo",
            "iiprop": "url",
            "format": "json",
        }, f"imageinfo_batch_{i}_{hashlib.md5('|'.join(batch).encode()).hexdigest()[:8]}", refresh=refresh)
        pages = res.get("query", {}).get("pages", {})
        for pid, p in pages.items():
            t = p.get("title", "")
            if t.startswith("File:"):
                fname = t[5:].replace(" ", "_")
                info = p.get("imageinfo", [])
                if info and info[0].get("url"):
                    url_map[fname] = info[0]["url"]
    return url_map


def select_character_pose_and_costume_files(title: str, all_imgs: List[str]) -> List[Tuple[str, str]]:
    """
    Return list of (label, filename) for:
      - 立ち絵 (*_FB.*)
      - 射撃待機 (*_cover_idle.*)
      - 射撃中 (*_aim_idle_combat.*)
      - コスチューム：<name> (*_(<name>)_FB.*)
    Excludes SD/chibi/MI/icon files.
    """
    base = title.replace(" ", "_").replace(":", "")
    base_colon = title.replace(" ", "_")
    prefix_candidates = {
        base.lower(),
        base_colon.lower(),
        title.split(":")[0].replace(" ", "_").lower(),
        title.split("(")[0].strip().replace(" ", "_").lower(),
    }

    def is_own_file(fn: str) -> bool:
        fn_low = fn.lower()
        return any(fn_low.startswith(p + "_") or fn_low.startswith(p + "(") or fn_low.startswith(p + "%") for p in prefix_candidates if p)

    def is_excluded(fn: str) -> bool:
        low = fn.lower()
        return low.endswith(".svg") or "_sd" in low or "chibi" in low or "_mi." in low or "icon" in low

    fb_default = ""
    cover_default = ""
    aim_default = ""
    costumes = []

    candidates = [fn for fn in all_imgs if not is_excluded(fn)]
    own_candidates = [fn for fn in candidates if is_own_file(fn)]
    pool = own_candidates if own_candidates else candidates

    for fn in pool:
        m_costume = re.search(r"_\(([^)]+)\)_FB\.(png|jpg|jpeg|webp)$", fn, re.IGNORECASE)
        if m_costume:
            cname = m_costume.group(1).replace("_", " ").strip()
            costumes.append((f"コスチューム：{cname}", fn))
            continue
        if re.search(r"_FB\.(png|jpg|jpeg|webp)$", fn, re.IGNORECASE) and not fb_default:
            fb_default = fn
        elif re.search(r"_cover_idle\.(png|jpg|jpeg|webp)$", fn, re.IGNORECASE) and not re.search(r"_\([^)]+\)_cover_idle", fn) and not cover_default:
            cover_default = fn
        elif re.search(r"_aim_idle_combat\.(png|jpg|jpeg|webp)$", fn, re.IGNORECASE) and not re.search(r"_\([^)]+\)_aim_idle_combat", fn) and not aim_default:
            aim_default = fn

    # Fallbacks if non-costume pattern didn't match
    if not fb_default:
        for fn in pool:
            if "_fb" in fn.lower() and not re.search(r"_\([^)]+\)_fb", fn.lower()):
                fb_default = fn
                break
    if not cover_default:
        for fn in pool:
            if "cover_idle" in fn.lower() and not re.search(r"_\([^)]+\)_cover_idle", fn.lower()):
                cover_default = fn
                break
    if not aim_default:
        for fn in pool:
            if "aim_idle_combat" in fn.lower() and not re.search(r"_\([^)]+\)_aim_idle_combat", fn.lower()):
                aim_default = fn
                break

    results = []
    if fb_default:
        results.append(("立ち絵", fb_default))
    if cover_default:
        results.append(("射撃待機", cover_default))
    if aim_default:
        results.append(("射撃中", aim_default))
    results.extend(sorted(set(costumes), key=lambda x: x[0]))
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true", help="Re-fetch cached pages")
    args = parser.parse_args()

    today_str = datetime.date.today().isoformat()

    print("1. Fetching Game8 character lists (SSR/SR/R)...")
    g8_all = []
    for rarity, url in GAME8_LISTS:
        items = parse_game8_list(rarity, url, refresh=args.refresh)
        print(f"   Game8 {rarity}: {len(items)}")
        g8_all.extend(items)
    print(f"   Game8 total: {len(g8_all)}")

    print("2. Fetching Fandom Category:Playable_characters...")
    fandom_data = fetch_fandom_roster(refresh=args.refresh)
    print(f"   Fandom total: {len(fandom_data)}")

    f_by_norm = {}
    for t, d in fandom_data.items():
        if d["name_jp"]:
            f_by_norm[norm_jp(d["name_jp"])] = t

    # Match Game8 -> Fandom
    matched = []
    matched_fandom_titles = set()
    for item in g8_all:
        ln = item["list_name"]
        ftitle = MANUAL_G8_TO_FANDOM.get(ln)
        if not ftitle or ftitle not in fandom_data:
            ftitle = f_by_norm.get(norm_jp(ln))
        if not ftitle or ftitle not in fandom_data:
            raise RuntimeError(f"Unmatched Game8 character: {ln} ({item['url']})")
        matched.append((item, fandom_data[ftitle]))
        matched_fandom_titles.add(ftitle)

    excluded_fandom = [t for t in sorted(fandom_data) if t not in matched_fandom_titles]
    print(f"   Matched: {len(matched)} / {len(g8_all)}")
    print(f"   Excluded from Fandom ({len(excluded_fandom)}): {excluded_fandom}")

    print("3. Fetching Game8 character detail pages & Fandom image lists...")
    char_files_map = {}
    all_needed_files = []
    detail_map = {}
    for idx, (item, fchar) in enumerate(matched, 1):
        if idx % 30 == 0 or idx == len(matched):
            print(f"   Progress: {idx}/{len(matched)}")
        detail = parse_game8_detail(item, refresh=args.refresh)
        detail_map[item["url"]] = detail

        raw_imgs = fetch_fandom_page_images(fchar["title"], refresh=args.refresh)
        selected = select_character_pose_and_costume_files(fchar["title"], raw_imgs)
        char_files_map[fchar["title"]] = selected
        for _, fn in selected:
            all_needed_files.append(fn)

    print(f"4. Resolving {len(set(all_needed_files))} Fandom image URLs...")
    url_map = resolve_image_urls(all_needed_files, refresh=args.refresh)

    # Build final records
    rarity_counters = {"SSR": 0, "SR": 0, "R": 0}
    records = []
    missing_images_chars = []
    empty_stats = {"cv": 0, "squad": 0, "skills": 0}

    for item, fchar in matched:
        rarity = item["rarity"]
        rarity_counters[rarity] += 1
        rec_id = f"NK-{rarity}{rarity_counters[rarity]:03d}"

        detail = detail_map[item["url"]]
        name_jp = detail["name"] or item["list_name"]
        burst = detail["burst"] or item["burst"]
        cv = detail["cv"]
        skills = detail["skills"]

        if not cv:
            empty_stats["cv"] += 1
        if not item["squad"]:
            empty_stats["squad"] += 1
        if not skills:
            empty_stats["skills"] += 1

        images = []
        selected_map = dict(char_files_map[fchar["title"]])

        # 1. 立ち絵 (Game8 primary if available, else Fandom FB)
        if detail.get("tachie_url"):
            images.append({
                "label": "立ち絵",
                "url": detail["tachie_url"],
                "source": "Game8",
                "credit": "SHIFT UP",
            })
        elif "立ち絵" in selected_map:
            fn = selected_map["立ち絵"]
            u = url_map.get(fn) or url_map.get(fn.replace(" ", "_"))
            if u:
                images.append({
                    "label": "立ち絵",
                    "url": u,
                    "source": "NIKKE Wiki (Fandom)",
                    "credit": "SHIFT UP",
                })

        # 2. 射撃待機 & 3. 射撃中 & Costumes (Fandom)
        for label, fn in char_files_map[fchar["title"]]:
            if label == "立ち絵":
                continue
            u = url_map.get(fn) or url_map.get(fn.replace(" ", "_"))
            if u:
                images.append({
                    "label": label,
                    "url": u,
                    "source": "NIKKE Wiki (Fandom)",
                    "credit": "SHIFT UP",
                })

        labels_present = {im["label"] for im in images}
        missing_poses = [p for p in ("立ち絵", "射撃待機", "射撃中") if p not in labels_present]
        if missing_poses:
            missing_images_chars.append({
                "id": rec_id,
                "name": name_jp,
                "fandom": fchar["title"],
                "missing": missing_poses,
            })

        fandom_page_url = "https://nikke-goddess-of-victory-international.fandom.com/wiki/" + urllib.parse.quote(fchar["title"].replace(" ", "_"))
        records.append({
            "id": rec_id,
            "name": name_jp,
            "nameEn": fchar["name_en"],
            "rarity": rarity,
            "manufacturer": item["manufacturer"],
            "weapon": item["weapon"],
            "burst": burst,
            "role": item["role"],
            "element": item["element"],
            "squad": item["squad"],
            "cv": cv,
            "skills": skills,
            "images": images,
            "sourceInfo": {
                "url": item["url"],
                "fandomUrl": fandom_page_url,
                "date": today_str,
            },
        })

    OUT_DATA_JS.parent.mkdir(parents=True, exist_ok=True)
    header = (
        f"// Auto-generated by tools/build_data.py on {today_str}\n"
        f"// Total characters: {len(records)} "
        f"(SSR: {rarity_counters['SSR']}, SR: {rarity_counters['SR']}, R: {rarity_counters['R']})\n"
        f"const NIKKE_DATA = "
    )
    OUT_DATA_JS.write_text(
        header + json.dumps(records, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )

    report = {
        "date": today_str,
        "total": len(records),
        "byRarity": rarity_counters,
        "totalImages": sum(len(r["images"]) for r in records),
        "missingImagesChars": missing_images_chars,
        "excludedFromFandom": excluded_fandom,
        "emptyFields": empty_stats,
    }
    OUT_REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n=== Build Summary ===")
    print(f"Total records: {report['total']} {rarity_counters}")
    print(f"Total images: {report['totalImages']}")
    print(f"Missing images: {len(missing_images_chars)} {missing_images_chars}")
    print(f"Empty fields: {empty_stats}")
    print(f"Written: {OUT_DATA_JS}")


if __name__ == "__main__":
    main()

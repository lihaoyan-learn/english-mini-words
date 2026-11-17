#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 scenes.json 中的美式音标批量替换为英式 IPA (RP)，并切换发音声音为英式。"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "public", "data", "scenes.json")

# 逐词英式音标映射（针对本场景出现的词）
IPA_MAP = {
    "Excuse me": "/ɪkˈskjuːz miː/",
    "help": "/help/",
    "Where": "/weə(r)/",
    "milk": "/mɪlk/",
    "aisle": "/aɪl/",
    "right": "/raɪt/",
    "Got it": "/ɡɒt ɪt/",
    "this": "/ðɪs/",
    "whole": "/həʊl/",
    "low-fat": "/ˌləʊ ˈfæt/",
    "want": "/wɒnt/",
    "How much": "/haʊ mʌtʃ/",
    "fifty": "/ˈfɪfti/",
    "take": "/teɪk/",
    "bag": "/bæɡ/",
    "Here you go": "/hɪə(r) juː ɡəʊ/",
    "Thank you": "/ˈθæŋk juː/",
    "apples": "/ˈæplz/",
    "are": "/ɑː(r)/",
    "back": "/bæk/",
    "left": "/left/",
    "These": "/ðiːz/",
    "fresh": "/freʃ/",
    "two": "/tuː/",
    "they": "/ðeɪ/",
    "dollars": "/ˈdɒləz/",
    "Good": "/ɡʊd/",
    "checkout": "/ˈtʃekaʊt/",
    "over there": "/ˈəʊvə(r) ðeə(r)/",
    "altogether": "/ˌɔːltəˈɡeðə(r)/",
    "twenty": "/ˈtwenti/",
    "Here you are": "/hɪə(r) juː ɑː(r)/",
    "cash": "/kæʃ/",
    "card": "/kɑːd/",
    "receipt": "/rɪˈsiːt/",
    "sign": "/saɪn/",
    "Have a nice day": "/hæv ə naɪs deɪ/",
}

with open(DATA, "r", encoding="utf-8") as f:
    data = json.load(f)

# 切换为英式声音
data.setdefault("meta", {}).setdefault("voices", {})
data["meta"]["voices"]["A"] = "en-GB-SoniaNeural"   # 学习者（英式女声）
data["meta"]["voices"]["B"] = "en-GB-RyanNeural"    # 对方（英式男声）
data["meta"]["accent"] = "British (RP)"

changed = 0
for scene in data["scenes"]:
    for turn in scene["dialogue"]:
        for w in turn.get("words", []):
            if w["word"] in IPA_MAP:
                w["ipa"] = IPA_MAP[w["word"]]
                changed += 1

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"已更新 {changed} 个音标为英式 IPA，声音切换为 en-GB。")

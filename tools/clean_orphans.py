#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""清理 assets 目录中不再被数据引用的孤儿音频文件（只处理本 App 生成的 mp3）。"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "public")
DATA_DIR = os.path.join(ROOT, "data")

referenced = set()
for name in ["scenes.json", "highfreq.json", "scene-vocab.json"]:
    path = os.path.join(DATA_DIR, name)
    if not os.path.exists(path):
        continue
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if name == "scenes.json":
        for sc in data.get("scenes", []):
            for t in sc.get("dialogue", []):
                for key in ("audio", "audioSlow"):
                    if t.get(key):
                        referenced.add(os.path.basename(t[key]))
    elif name == "highfreq.json":
        for g in data.get("groups", []):
            for w in g.get("words", []):
                if w.get("audio"): referenced.add(os.path.basename(w["audio"]))
    elif name == "scene-vocab.json":
        for scene_id, groups in data.get("scenes", {}).items():
            for g in groups:
                for w in g.get("words", []):
                    if w.get("audio"): referenced.add(os.path.basename(w["audio"]))

removed = 0
for sub in ["audio", "words", "vocab"]:
    d = os.path.join(ROOT, "assets", sub)
    if not os.path.isdir(d):
        continue
    for fn in os.listdir(d):
        if fn.endswith(".mp3") and fn not in referenced:
            os.remove(os.path.join(d, fn))
            removed += 1

print(f"已清理 {removed} 个孤儿音频文件。引用音频共 {len(referenced)} 个。")

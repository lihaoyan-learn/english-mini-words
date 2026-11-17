#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 content/gen/*.json 的 10 个场景合并进主数据文件 scenes.json 和 scene-vocab.json。"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
GEN = os.path.join(ROOT, "content", "gen")
SCENES = os.path.join(ROOT, "public", "data", "scenes.json")
VOCAB = os.path.join(ROOT, "public", "data", "scene-vocab.json")

# 期望的场景顺序（超市已在主文件，这里追加 10 个）
NEW_IDS = [
    "shopping", "travel", "rental", "restaurant", "tickets",
    "transport", "bargaining", "smalltalk", "hotel", "computer",
]

def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)

def dump(p, d):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)

scenes_data = load(SCENES)
vocab_data = load(VOCAB)

existing_ids = {s["id"] for s in scenes_data["scenes"]}
added = []
for sid in NEW_IDS:
    gen = load(os.path.join(GEN, f"{sid}.json"))
    scene = gen["scene"]
    vocab = gen["vocab"]
    if sid in existing_ids:
        # 已存在则替换
        scenes_data["scenes"] = [s for s in scenes_data["scenes"] if s["id"] != sid]
    scenes_data["scenes"].append(scene)
    vocab_data["scenes"][sid] = vocab
    added.append(sid)

dump(SCENES, scenes_data)
dump(VOCAB, vocab_data)

# 同步到 src/data 源文件
src_scenes = os.path.join(ROOT, "src", "data", "scenes.json")
if os.path.isdir(os.path.dirname(src_scenes)):
    dump(src_scenes, scenes_data)

print("合并完成，新增场景:", ", ".join(added))
print("总场景数:", len(scenes_data["scenes"]))
print("总对话轮数:", sum(len(s["dialogue"]) for s in scenes_data["scenes"]))
print("总场景词数:", sum(sum(len(g["words"]) for g in v) for v in vocab_data["scenes"].values()))
print("场景顺序:", [s["id"] for s in scenes_data["scenes"]])

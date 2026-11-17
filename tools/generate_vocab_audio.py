#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为场景专属词汇生成英式发音音频，并回写 audio 字段。"""
import asyncio, json, os, re
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "public", "data", "scene-vocab.json")
AUDIO_DIR = os.path.join(HERE, "..", "public", "assets", "vocab")
VOICE = "en-GB-SoniaNeural"

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-') or 'w'

async def main():
    os.makedirs(AUDIO_DIR, exist_ok=True)
    with open(DATA, "r", encoding="utf-8") as f:
        data = json.load(f)
    tasks = []
    for scene_id, groups in data["scenes"].items():
        for g in groups:
            for i, w in enumerate(g["words"]):
                fname = f"{scene_id}_{g['id']}_{i:02d}_{slug(w['w'])}.mp3"
                w["audio"] = f"assets/vocab/{fname}"
                out = os.path.join(AUDIO_DIR, fname)
                tasks.append((w["w"], out))
    print(f"待生成场景词发音 {len(tasks)} 个 ...")
    for i, (text, out) in enumerate(tasks, 1):
        for attempt in range(3):
            try:
                c = edge_tts.Communicate(text, VOICE, rate="-10%")
                await c.save(out)
                break
            except Exception as e:
                if attempt == 2: print(f"[失败] {text}: {e}")
                else: await asyncio.sleep(1)
        if i % 25 == 0 or i == len(tasks):
            print(f"进度 {i}/{len(tasks)}")
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("完成，已回写 audio 字段。")

if __name__ == "__main__":
    asyncio.run(main())

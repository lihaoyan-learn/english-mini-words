#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量生成对话音频。
读取 ../src/data/scenes.json，为每个 turn 按 speaker 选择声音，
生成正常速与慢速两版 MP3 到 ../src/assets/audio/。

用法：
    python generate_audio.py            # 生成全部场景
    python generate_audio.py supermarket # 只生成指定场景
"""
import asyncio
import json
import os
import sys
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(HERE, "..", "public", "data", "scenes.json")
AUDIO_DIR = os.path.join(HERE, "..", "public", "assets", "audio")

# 声音映射，可用 python -m edge_tts --list-voices 查看全部
VOICE_A = "en-US-JennyNeural"   # 学习者（顾客）
VOICE_B = "en-US-GuyNeural"     # 店员 / 对方

RATE_NORMAL = "+0%"
RATE_SLOW = "-35%"


async def synth(text, voice, rate, out_path):
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(out_path)


async def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    voices = data.get("meta", {}).get("voices", {})
    voice_a = voices.get("A", VOICE_A)
    voice_b = voices.get("B", VOICE_B)

    os.makedirs(AUDIO_DIR, exist_ok=True)

    tasks = []
    for scene in data["scenes"]:
        if only and scene["id"] != only:
            continue
        for turn in scene["dialogue"]:
            voice = voice_a if turn["speaker"] == "A" else voice_b
            for field, rate in (("audio", RATE_NORMAL), ("audioSlow", RATE_SLOW)):
                rel = turn[field]
                out = os.path.join(AUDIO_DIR, os.path.basename(rel))
                tasks.append((turn["text"], voice, rate, out))

    print(f"待生成音频 {len(tasks)} 段 ...")
    for i, (text, voice, rate, out) in enumerate(tasks, 1):
        for attempt in range(3):
            try:
                await synth(text, voice, rate, out)
                break
            except Exception as e:
                if attempt == 2:
                    print(f"[失败] {out}: {e}")
                else:
                    await asyncio.sleep(1)
        if i % 10 == 0 or i == len(tasks):
            print(f"进度 {i}/{len(tasks)}")
    print("完成。")


if __name__ == "__main__":
    asyncio.run(main())

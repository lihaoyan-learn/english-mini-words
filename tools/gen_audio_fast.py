#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
高性能音频生成器：并发生成对话 / 场景词 / 高频词三类音频，跳过已存在文件。
用法：
    python tools/gen_audio_fast.py dialogue   # 对话音频（660段）
    python tools/gen_audio_fast.py vocab      # 场景词发音（1338个）
    python tools/gen_audio_fast.py words      # 高频词发音（108个）
    python tools/gen_audio_fast.py all        # 全部
"""
import asyncio
import json
import os
import re
import sys
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
PUBLIC = os.path.join(ROOT, "public")
SCENES = os.path.join(PUBLIC, "data", "scenes.json")
VOCAB = os.path.join(PUBLIC, "data", "scene-vocab.json")
WORDS = os.path.join(PUBLIC, "data", "highfreq.json")

AUDIO_DIR = os.path.join(PUBLIC, "assets", "audio")
VOCAB_DIR = os.path.join(PUBLIC, "assets", "vocab")
WORDS_DIR = os.path.join(PUBLIC, "assets", "words")

VOICE_A = "en-GB-SoniaNeural"
VOICE_B = "en-GB-RyanNeural"
VOICE_WORD = "en-GB-SoniaNeural"
CONCURRENCY = 12  # 并发数


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "w"


def build_tasks(kind):
    """返回 [(text, voice, rate, out_path), ...]"""
    tasks = []
    if kind == "dialogue":
        data = load(SCENES)
        voices = data.get("meta", {}).get("voices", {})
        va = voices.get("A", VOICE_A)
        vb = voices.get("B", VOICE_B)
        for sc in data["scenes"]:
            for turn in sc["dialogue"]:
                voice = va if turn["speaker"] == "A" else vb
                tasks.append((turn["text"], voice, "+0%", os.path.join(AUDIO_DIR, os.path.basename(turn["audio"]))))
                tasks.append((turn["text"], voice, "-35%", os.path.join(AUDIO_DIR, os.path.basename(turn["audioSlow"]))))
    elif kind == "vocab":
        data = load(VOCAB)
        vocab_data = data
        for scene_id, groups in vocab_data["scenes"].items():
            for g in groups:
                for i, w in enumerate(g["words"]):
                    fname = f"{scene_id}_{g['id']}_{i:02d}_{slug(w['w'])}.mp3"
                    w["audio"] = f"assets/vocab/{fname}"
                    tasks.append((w["w"], VOICE_WORD, "-10%", os.path.join(VOCAB_DIR, fname)))
        # 回写 audio 字段
        with open(VOCAB, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    elif kind == "words":
        data = load(WORDS)
        for gi, g in enumerate(data["groups"]):
            for i, w in enumerate(g["words"]):
                fname = f"word_{gi:02d}_{i:02d}_{slug(w['w'])}.mp3"
                w["audio"] = f"assets/words/{fname}"
                tasks.append((w["w"], VOICE_WORD, "-10%", os.path.join(WORDS_DIR, fname)))
        with open(WORDS, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    return tasks


async def synth_one(text, voice, rate, out, sem, stats):
    async with sem:
        if os.path.exists(out) and os.path.getsize(out) > 500:
            stats["skip"] += 1
            return
        for attempt in range(4):
            try:
                c = edge_tts.Communicate(text, voice, rate=rate)
                await c.save(out)
                stats["ok"] += 1
                return
            except Exception as e:
                if attempt == 3:
                    stats["fail"] += 1
                    print(f"[失败] {os.path.basename(out)}: {e}")
                else:
                    await asyncio.sleep(0.8 * (attempt + 1))
        # 清理可能的不完整文件
        if os.path.exists(out) and os.path.getsize(out) < 500:
            try:
                os.remove(out)
            except Exception:
                pass


async def run(kind):
    os.makedirs(AUDIO_DIR, exist_ok=True)
    os.makedirs(VOCAB_DIR, exist_ok=True)
    os.makedirs(WORDS_DIR, exist_ok=True)
    tasks = build_tasks(kind)
    total = len(tasks)
    pending = [t for t in tasks if not (os.path.exists(t[3]) and os.path.getsize(t[3]) > 500)]
    print(f"[{kind}] 总计 {total} 段，跳过已存在 {total - len(pending)}，待生成 {len(pending)}")
    sem = asyncio.Semaphore(CONCURRENCY)
    stats = {"ok": 0, "skip": total - len(pending), "fail": 0}
    workers = [synth_one(t[0], t[1], t[2], t[3], sem, stats) for t in pending]
    # 分批推进，打印进度
    done = 0
    batch = CONCURRENCY * 8
    for i in range(0, len(workers), batch):
        await asyncio.gather(*workers[i:i + batch])
        done = min(i + batch, len(workers))
        print(f"[{kind}] 进度 {done}/{len(workers)} | 成功 {stats['ok']} 失败 {stats['fail']}")
    print(f"[{kind}] 完成: 成功 {stats['ok']} 跳过 {stats['skip']} 失败 {stats['fail']}")
    return stats


if __name__ == "__main__":
    kinds = sys.argv[1:] or ["all"]
    if "all" in kinds:
        kinds = ["dialogue", "vocab", "words"]
    for k in kinds:
        asyncio.run(run(k))

#!/usr/bin/env python3
"""Independent code review by GPT via the custom.openai connector.

Sends the design doc and all game source to a GPT model acting as an
independent reviewer (it did not write the code), prints its review.
"""
import json
import sys
import urllib.request

sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response

MODEL = sys.argv[1] if len(sys.argv) > 1 else "gpt-6.2-sol"

FILES = [
    "docs/GAME_DESIGN.md",
    "docs/UPDATE_V2.md",
    "package.json",
    "vite.config.js",
    "index.html",
    "src/main.js",
    "src/input.js",
    "src/models.js",
    "src/runner.js",
    "src/ui.js",
    "src/world.js",
    "src/audio.js",
    "src/effects.js",
    "src/missions.js",
]

parts = []
import os
os.chdir(os.path.expanduser("~/workspace/meteor-runner"))
for f in FILES:
    with open(f, encoding="utf-8") as fh:
        parts.append(f"===== {f} =====\n{fh.read()}")
bundle = "\n\n".join(parts)

SYSTEM = (
    "You are an independent code reviewer. You did not write this code. "
    "Review it strictly against the design doc (GAME_DESIGN.md) included in the bundle. "
    "Report in Japanese. Structure: "
    "1) 仕様との不一致 (each with file name and evidence), "
    "2) バグ・不公平な生成・境界条件の問題, "
    "3) パフォーマンスとメモリの問題, "
    "4) 良い点 (brief). "
    "Only report issues you can point to in the code. No generic advice. "
    "If a spec item is correctly implemented, do not list it. "
    "APPROVED OVERRIDES (do not flag these): the near-miss lateral threshold was "
    "deliberately changed from 1.2m to 2.6m after playtesting, so adjacent-lane "
    "passes count as near misses. Everything else in the design doc stands. "
    "BUNDLE SCOPE: the 11 GLB model files exist in public/models/ but are binary "
    "and cannot be included here; package.json IS included this time. Review the "
    "v2 changes against docs/UPDATE_V2.md acceptance criteria first, then the base design."
)

req = urllib.request.Request(
    "https://api.openai.com/v1/chat/completions",
    data=json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": bundle},
        ],
    }).encode(),
    method="POST",
)
req.add_header("Content-Type", "application/json")
add_surrogate_to_request(req, "custom.openai", allowed_hosts=["api.openai.com"])


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise RuntimeError("redirect refused")


with urllib.request.build_opener(NoRedirect()).open(req, timeout=600) as resp:
    out = read_json_response(resp)

print(out["choices"][0]["message"]["content"])
usage = out.get("usage", {})
print(f"\n--- usage: {json.dumps(usage)}", file=sys.stderr)

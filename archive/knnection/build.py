"""Inject generated puzzles into the page: python build.py -> index.html"""
import json
p = json.load(open("puzzles.json"))
html = open("template.html").read().replace("/*PUZZLES*/[]", json.dumps(p, ensure_ascii=False, separators=(",", ":")))
open("index.html", "w").write(html)

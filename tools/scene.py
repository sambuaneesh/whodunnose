#!/usr/bin/env python3
"""Run a scripted scene: python3 tools/scene.py out_dir 'size' step step ...
   A step is JS to eval, 'shot:name', 'sleep:ms' or 'print:JS'. Helpers from tools/checks/helpers.js are loaded."""
import json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZES = {'desk': [1440, 810, 1, False], 'phone': [844, 390, 2, True], 'tall': [900, 1000, 1, False], 'small': [1280, 720, 1, False]}
out, size, *rest = sys.argv[1:]
os.makedirs(out, exist_ok=True)
steps = [{'device': SIZES[size]}, {'nav': f'file://{ROOT}/index.html?playtest=off', 'wait': 1600}, {'evalFile': f'{ROOT}/tools/checks/helpers.js'}]
for r in rest:
    if r.startswith('shot:'): steps.append({'shot': f'{out}/{r[5:]}.png'})
    elif r.startswith('sleep:'): steps.append({'sleep': int(r[6:])})
    elif r.startswith('print:'): steps.append({'eval': r[6:], 'print': True})
    else: steps.append({'eval': r + ';1'})
json.dump(steps, open(f'{out}/steps.json', 'w'))
subprocess.run(['node', f'{ROOT}/tools/shoot.mjs', f'{out}/steps.json'])

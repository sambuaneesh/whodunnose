#!/usr/bin/env python3
"""Screenshot sweep: every case at a few moments and screen sizes.
   python3 tools/sweep.py OUTDIR [--sizes desk,phone] [--cases c1,c4,free-plane] [--times 3,20,60] [--pt]"""
import json, os, subprocess, sys, argparse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZES = {'desk': [1440, 810, 1, False], 'hd': [1920, 1080, 1, False], 'small': [1280, 720, 1, False],
         'tall': [900, 1000, 1, False], 'phone': [844, 390, 2, True]}
HELP = open(os.path.join(ROOT, 'tools/checks/helpers.js')).read()
ap = argparse.ArgumentParser(); ap.add_argument('out'); ap.add_argument('--sizes', default='desk')
ap.add_argument('--cases', default='c1,c2,c3,c4,c5,c6,c7,c8,free-elevator,free-wedding,free-plane')
ap.add_argument('--times', default='3,14,45,90'); ap.add_argument('--pt', action='store_true'); ap.add_argument('--extra', default='')
a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
steps = []
for sz in a.sizes.split(','):
    steps += [{'device': SIZES[sz]}, {'nav': f"file://{ROOT}/index.html?playtest={'pullmyfinger' if a.pt else 'off'}", 'wait': 1600}, {'eval': HELP}]
    for c in a.cases.split(','):
        steps.append({'eval': f"T.start('{c}')"})
        for t in a.times.split(','):
            steps += [{'eval': f"T.to({t})"}, {'eval': a.extra or '1'}, {'sleep': 700}, {'shot': f"{a.out}/{sz}-{c}-t{t}.png"}]
json.dump(steps, open(f"{a.out}/steps.json", 'w'))
subprocess.run(['node', f"{ROOT}/tools/shoot.mjs", f"{a.out}/steps.json"])

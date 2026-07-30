"""
Generates src/data/loops.json — every feedback loop in the map up to MAX_LENGTH
factors, found by graph search over the 296 directed connections.

The loops are DERIVED, not transcribed. obesity_system_map_feedback_loops.xlsx is
used only as a check: the script asserts that what it finds is exactly what the
workbook contains, loop for loop and type for type, and reuses the workbook's
loop ids so the tool and the printed facilitator key refer to the same L-numbers.
Deriving rather than importing means the loop list cannot drift from the map.

A note on MAX_LENGTH: this is a real limit on what is knowable, not a display
choice. Loop counts roughly double per extra factor (193 at 6, 431 at 7, 901 at
8, 8,511 at 11), and unlike reachability there is no way to summarise the set
without enumerating it. So anything built on this data must say "up to N", never
"every loop".
"""

import collections
import json
import sys
from pathlib import Path

MAX_LENGTH = 6

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "obesity_system_data.json"
WORKBOOK = ROOT / "obesity_system_map_feedback_loops.xlsx"
OUT = ROOT / "obesity-system-map" / "src" / "data" / "loops.json"

failures: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'}  {label}{'' if ok else ' — ' + detail}")
    if not ok:
        failures.append(label)


raw = json.loads(DATA.read_text(encoding="utf-8"))
nodes = {n["id"]: n for n in raw["nodes"]}
adjacency: dict[int, list[int]] = collections.defaultdict(list)
sign: dict[tuple[int, int], int] = {}
for c in raw["connections"]:
    adjacency[c["sourceId"]].append(c["targetId"])
    sign[(c["sourceId"], c["targetId"])] = c["sign"]

engine = {n["id"] for n in raw["nodes"] if n["atlasCluster"] == "Engine"}
print(f"{len(nodes)} factors, {len(raw['connections'])} connections, "
      f"{len(engine)} engine factors")


def canonical(cycle: tuple[int, ...]) -> tuple[int, ...]:
    """Rotate so the smallest id leads, making rotations of one loop equal."""
    i = cycle.index(min(cycle))
    return cycle[i:] + cycle[:i]


def find_cycles(max_length: int) -> list[tuple[int, ...]]:
    """
    Simple cycles up to `max_length` factors. Only paths whose every member is
    greater than the start are extended, so each cycle is found exactly once at
    its smallest member rather than once per rotation.
    """
    found = []
    for start in sorted(nodes):
        stack = [(start, (start,), {start})]
        while stack:
            node, path, seen = stack.pop()
            for nxt in adjacency[node]:
                if nxt == start and len(path) >= 2:
                    found.append(path)
                elif nxt not in seen and nxt > start and len(path) < max_length:
                    stack.append((nxt, path + (nxt,), seen | {nxt}))
    return found


def negatives(cycle: tuple[int, ...]) -> int:
    return sum(
        1
        for i in range(len(cycle))
        if sign[(cycle[i], cycle[(i + 1) % len(cycle)])] == -1
    )


cycles = [canonical(c) for c in find_cycles(MAX_LENGTH)]
check("no duplicate loops", len(cycles) == len(set(cycles)))
cycles = sorted(set(cycles), key=lambda c: (len(c), c))

# An odd number of negative links flips the sign on the way round, so the loop
# damps itself: balancing. Even or none and it compounds: reinforcing.
kinds = {c: ("balancing" if negatives(c) % 2 else "reinforcing") for c in cycles}
reinforcing = [c for c in cycles if kinds[c] == "reinforcing"]

print(f"\n{len(cycles)} loops up to {MAX_LENGTH} factors")
by_length = collections.Counter(len(c) for c in cycles)
for n in sorted(by_length):
    print(f"   {n} factors: {by_length[n]:4}")
print(f"   reinforcing {len(reinforcing)}, balancing {len(cycles) - len(reinforcing)}")

print("\nchecks")
check("every loop edge is a real connection",
      all((c[i], c[(i + 1) % len(c)]) in sign for c in cycles for i in range(len(c))))
check("every loop factor exists", all(n in nodes for c in cycles for n in c))
check("no loop repeats a factor", all(len(set(c)) == len(c) for c in cycles))
check("loops are at least 2 factors", all(len(c) >= 2 for c in cycles))

# Cross-check against the human-reviewed workbook.
loop_ids: dict[tuple[int, ...], str] = {}
try:
    import openpyxl

    book = openpyxl.load_workbook(WORKBOOK, data_only=True)
    theirs: dict[tuple[int, ...], str] = {}
    for row in book["All Loops"].iter_rows(min_row=2, values_only=True):
        if not row[0]:
            continue
        ids = tuple(int(x.strip()) for x in row[8].split("->"))
        if ids[0] != ids[-1]:
            failures.append(f"workbook loop {row[0]} does not close")
            continue
        key = canonical(ids[:-1])
        theirs[key] = row[2]
        loop_ids[key] = row[0]

    check("loop set matches the workbook exactly", set(theirs) == set(cycles),
          f"{len(set(cycles) - set(theirs))} only ours, "
          f"{len(set(theirs) - set(cycles))} only theirs")
    mismatched = [
        loop_ids[c] for c in cycles
        if c in theirs and not theirs[c].lower().startswith(kinds[c])
    ]
    check("reinforcing/balancing labels match the workbook", not mismatched,
          str(mismatched[:5]))
except ImportError:
    print("  skip  workbook cross-check (openpyxl not installed)")

# Per-factor reach, which is what the panel will show.
per_factor = collections.Counter()
for c in reinforcing:
    for n in c:
        per_factor[n] += 1
with_loop = sorted(n for n in nodes if per_factor[n])
counts = [per_factor[n] for n in with_loop]
print(f"\n{len(with_loop)} of {len(nodes)} factors sit in a reinforcing loop "
      f"({len(nodes) - len(with_loop)} sit in none)")
print(f"   loops per factor: min {min(counts)}, "
      f"median {sorted(counts)[len(counts) // 2]}, max {max(counts)}")

OUT.write_text(
    json.dumps(
        {
            "_meta": {
                "source": "Derived from obesity_system_data.json by scripts/build_loops.py",
                "description": (
                    f"Every feedback loop up to {MAX_LENGTH} factors long. "
                    "nodeIds lists the loop in causal order without repeating "
                    "the opening factor; the loop closes from the last back to "
                    "the first. Loop counts explode with length, so this is a "
                    "hard cap on what is known, not a display limit."
                ),
                "maxLength": MAX_LENGTH,
                "totalLoops": len(cycles),
                "reinforcing": len(reinforcing),
                "balancing": len(cycles) - len(reinforcing),
                "verifiedAgainst": WORKBOOK.name if loop_ids else None,
                "factorsInReinforcingLoop": len(with_loop),
            },
            "loops": [
                {
                    "id": loop_ids.get(c, f"X{i + 1:03}"),
                    "nodeIds": list(c),
                    "type": kinds[c],
                    "negativeLinks": negatives(c),
                    "touchesEngine": any(n in engine for n in c),
                }
                for i, c in enumerate(cycles)
            ],
        },
        indent=1,
    ),
    encoding="utf-8",
)
print(f"\nwrote {OUT}")
print("ALL CHECKS PASSED" if not failures else "FAILURES: " + ", ".join(failures))
sys.exit(1 if failures else 0)

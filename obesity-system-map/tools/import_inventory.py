"""
Turns the tagged HPB programme inventory into src/data/intervention/programmes.json.

Run it again whenever the spreadsheet changes:

    python tools/import_inventory.py ../hpb-programme-inventory-tagged-C.xlsx

Everything the app reads is generated here, so the spreadsheet stays the source
of truth and nobody hand-edits the JSON. Three columns do the work:

  Behaviours (tagged)   semicolon-separated behaviour names, mapped to the ids
                        in behaviours.json by TAG_TO_BEHAVIOUR below.
  Gate (who it's for)   a sentence. Translated by GATE_RULES into a machine gate,
                        with the original kept in `gateSource` so the translation
                        can be audited rather than trusted.
  Node trim (Option C)  per-behaviour node overrides, "activity->71,49 · ...".
                        A behaviour not named keeps its whole node set, which is
                        what the workbook's own notes specify.

The script refuses to write anything it cannot fully account for: an unknown
behaviour tag, an untranslatable gate, or a trim naming a node outside the
behaviour it trims all abort the run. Silently dropping any of those would leave
the overlay quietly wrong, which is worse than not regenerating it.
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

import openpyxl

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "src" / "data" / "intervention"

# Spreadsheet tag -> behaviours.json id.
TAG_TO_BEHAVIOUR = {
    "physical activity": "physical-activity",
    "healthy eating": "healthy-eating",
    "sugar reduction": "sugar-reduction",
    "sodium reduction": "sodium-reduction",
    "healthy environment/access": "healthy-environment",
    "sedentary/screen": "sedentary-screen",
    "social connection": "social-connection",
    "mental wellbeing": "mental-wellbeing",
    "health literacy": "health-literacy",
    "smoking/vaping": "smoking-vaping",
    "sleep": "sleep",
    "health screening": "health-screening",
    "vision/hearing/oral": "sensory-oral-health",
    "immunisation": "immunisation",
}

# Short key used in the trim column -> behaviours.json id.
TRIM_TO_BEHAVIOUR = {
    "activity": "physical-activity",
    "eating": "healthy-eating",
    "literacy": "health-literacy",
    "environment": "healthy-environment",
    "social": "social-connection",
}

SCHOOL_AGE = {"life_stage": ["school-child", "youth"]}
WORKING = {"life_stage": "working-adult"}
PARENT = {"is_parent": True}

# Matched in order, first hit wins, so the specific cases precede the general
# ones. A gate listing several unrelated audiences becomes a list of clauses;
# anything a persona can satisfy on any one of them is in.
GATE_RULES = [
    (r"^everyone", "everyone"),
    (r"^students.*high-risk", [{**SCHOOL_AGE, "conditions": ["overweight-high-risk"]}]),
    (
        r"^students.*myopic",
        [{**SCHOOL_AGE, "conditions": ["myopic"], "ses": "lower-income"}],
    ),
    # "students, staff & parents" is three groups, not one person who is all
    # three. Same for the preschool framework, which names parents and staff.
    (r"^students,\s*staff", [SCHOOL_AGE, WORKING, PARENT]),
    (r"^preschool children\s*\(\+", [{"life_stage": "young-child"}, WORKING, PARENT]),
    (r"^preschool children", [{"life_stage": "young-child"}]),
    (r"^students", [SCHOOL_AGE]),
    (r"^working adults", [WORKING]),
    (r"^seniors 50\+", [{"age_band": ["50-59", "60-plus"]}]),
    (r"^seniors 60\+", [{"age_band": ["60-plus"]}]),
    (
        r"^seniors\s*\(frailty",
        [{"life_stage": "senior", "conditions": ["frailty-or-falls-risk"]}],
    ),
    (r"^senior men", [{"life_stage": "senior", "sex": "male"}]),
    (r"^seniors", [{"life_stage": "senior"}]),
    (r"^(smokers|vapers)", [{"smoker_or_vaper": True}]),
    (
        r"^lower-income families\s*\(children",
        [{"ses": "lower-income", "life_stage": ["young-child", "school-child"]}],
    ),
    (r"^lower-income families", [{"ses": "lower-income"}]),
    (r"^haj pilgrims", [{"conditions": ["haj-pilgrim"]}]),
    (r"^adults not yet screened", [{"conditions": ["not-yet-screened"]}]),
    (
        r"^children, seniors",
        [{"life_stage": ["young-child", "school-child", "youth", "senior"]}],
    ),
    (r"^parents", [PARENT]),
]


def slug(name):
    """A stable id from the programme name — the sheet has no id column."""
    plain = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    # Drop parenthesised asides first: they carry abbreviations and edition
    # names that churn between exports, and an id that churns breaks nothing
    # loudly — it just silently stops matching anything saved against it.
    plain = re.sub(r"\([^)]*\)", " ", plain)
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", plain.lower())).strip("-")


def parse_gate(text):
    for pattern, gate in GATE_RULES:
        if re.search(pattern, text.strip(), re.I):
            return gate
    raise SystemExit(f"Untranslatable gate: {text!r}\nAdd a rule to GATE_RULES.")


def parse_trim(text, addresses, behaviour_nodes, programme):
    """'activity->71,49 · literacy->(none: ...)' -> {behaviour id: [nodes]}."""
    text = (text or "").strip()
    if not text or text.lower() in {"(full bundle)", "none"}:
        return {}

    trim = {}
    for part in re.split(r"[·|]", text):
        if "→" not in part:
            continue
        key, values = (s.strip() for s in part.split("→", 1))
        behaviour = TRIM_TO_BEHAVIOUR.get(key.lower())
        if behaviour is None:
            raise SystemExit(f"{programme}: unknown trim key {key!r}")
        if behaviour not in addresses:
            raise SystemExit(
                f"{programme}: trims {behaviour!r}, which it does not address"
            )
        nodes = [int(n) for n in re.findall(r"\d+", values)]
        # A trim narrows a behaviour; it never adds. Anything outside the
        # behaviour's own set is a tagging error or belongs in extraNodes, and
        # either way guessing which would bake the mistake in.
        outside = sorted(set(nodes) - set(behaviour_nodes[behaviour]))
        if outside:
            raise SystemExit(
                f"{programme}: trim {behaviour!r} names {outside}, "
                f"outside the behaviour's nodes {behaviour_nodes[behaviour]}"
            )
        trim[behaviour] = nodes
    return trim


def main():
    source = Path(sys.argv[1] if len(sys.argv) > 1 else HERE.parent.parent / "hpb-programme-inventory-tagged-C.xlsx")
    behaviours = json.loads((DATA / "behaviours.json").read_text("utf-8"))
    behaviour_nodes = {b["id"]: b["nodes"] for b in behaviours}

    rows = list(
        openpyxl.load_workbook(source, data_only=True)["Programme Capture"].iter_rows(
            values_only=True
        )
    )[1:]

    out, seen = [], set()
    for row in rows:
        name = (row[0] or "").strip()
        if not name:
            continue

        addresses = []
        for tag in str(row[7] or "").split(";"):
            tag = tag.strip().lower()
            if not tag:
                continue
            if tag not in TAG_TO_BEHAVIOUR:
                raise SystemExit(f"{name}: unknown behaviour tag {tag!r}")
            addresses.append(TAG_TO_BEHAVIOUR[tag])

        identifier = slug(name)
        if identifier in seen:
            raise SystemExit(f"Duplicate id {identifier!r} from {name!r}")
        seen.add(identifier)

        gate_source = str(row[8] or "").strip()
        programme = {
            "id": identifier,
            "name": name,
            "source": str(row[3] or "").strip(),
            "status": str(row[5] or "").strip().lower() or "verify",
            "gate": parse_gate(gate_source),
            "gateSource": gate_source,
            "addresses": addresses,
        }
        trim = parse_trim(row[9], addresses, behaviour_nodes, name)
        if trim:
            programme["trim"] = trim
        out.append(programme)

    (DATA / "programmes.json").write_text(
        json.dumps(out, indent=2, ensure_ascii=False) + "\n", "utf-8"
    )

    reached = set()
    for programme in out:
        if programme["status"] == "ended":
            continue
        for behaviour in programme["addresses"]:
            reached.update(
                programme.get("trim", {}).get(behaviour, behaviour_nodes[behaviour])
            )
    print(f"{len(out)} programmes -> {DATA / 'programmes.json'}")
    print(f"{len(reached)} nodes reached with gates ignored")


if __name__ == "__main__":
    main()

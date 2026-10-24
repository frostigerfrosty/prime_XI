"""Classify evidence in retrieved season rows; this does not approve historical releases."""
import argparse
import json
import hashlib
from functools import lru_cache
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parent.parent
COUNTRIES = {
    "ARG": "Argentina", "ARM": "Armenia", "AUS": "Australia", "AUT": "Austria Austrian", "BEL": "Belgium Belgian",
    "BFA": "Burkina Faso", "BGR": "Bulgaria BUL", "BIH": "Bosnia and Herzegovina", "BLR": "Belarus",
    "BRA": "Brazil Brazilian", "CAN": "Canada", "CHE": "Switzerland Swiss SUI", "CHL": "Chile CHI",
    "CIV": "Ivory Coast", "CMR": "Cameroon", "COL": "Colombia", "CRI": "Costa Rica CRC",
    "CZE": "Czech Republic Czechia", "DEU": "Germany German GER", "DNK": "Denmark Danish DEN",
    "DZA": "Algeria ALG", "ECU": "Ecuador", "EGY": "Egypt", "ENG": "England English",
    "ESP": "Spain Spanish", "EST": "Estonia", "FIN": "Finland Finnish", "FRA": "France French",
    "GAB": "Gabon", "GEO": "Georgia", "GHA": "Ghana", "GIN": "Guinea", "GRC": "Greece GRE",
    "HRV": "Croatia Croatian CRO", "IRL": "Republic of Ireland Irish", "IRN": "Iran", "ISL": "Iceland",
    "ISR": "Israel", "ITA": "Italy Italian", "KOR": "South Korea", "MAR": "Morocco", "MEX": "Mexico",
    "MKD": "North Macedonia Macedonia", "MLI": "Mali", "MNE": "Montenegro", "NGA": "Nigeria NGR",
    "NIR": "Northern Ireland", "NLD": "Netherlands Dutch NED", "NOR": "Norway Norwegian",
    "PER": "Peru", "POL": "Poland Polish", "PRT": "Portugal Portuguese POR", "ROU": "Romania ROM",
    "RUS": "Russia", "SCO": "Scotland Scottish", "SEN": "Senegal", "SRB": "Serbia Serbian",
    "SVK": "Slovakia", "SVN": "Slovenia SLO", "SWE": "Sweden Swedish", "TUR": "Turkey Türkiye",
    "UKR": "Ukraine", "URY": "Uruguay URU", "USA": "United States", "WAL": "Wales Welsh", "XKX": "Kosovo KOS",
}
# Multiword labels must remain intact; further source-specific variants are explicit.
EXTRA_COUNTRIES = {"Burkina Faso": "BFA", "Bosnia and Herzegovina": "BIH", "Ivory Coast": "CIV", "Costa Rica": "CRI", "Czech Republic": "CZE", "Republic of Ireland": "IRL", "South Korea": "KOR", "North Macedonia": "MKD", "Northern Ireland": "NIR", "United States": "USA"}


@lru_cache(maxsize=100000)
def norm(value):
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in unicodedata.normalize("NFKD", value.lower()) if not unicodedata.combining(c))).strip()


COUNTRY_LABELS = {norm(code): code for code in COUNTRIES}
for code, labels in COUNTRIES.items():
    if not any(word in labels for word in ["Republic", "Coast", "South ", "North ", "United ", "Bosnia", "Costa", "Burkina"]):
        COUNTRY_LABELS.update({norm(label): code for label in labels.split()})
COUNTRY_LABELS.update({norm(label): code for label, code in EXTRA_COUNTRIES.items()})
# Country labels with multiple words still have independent FIFA codes.
COUNTRY_LABELS.update({"czechia": "CZE", "macedonia": "MKD", "northern ireland": "NIR", "ireland": "IRL", "irish": "IRL", "crc": "CRI"})
COUNTRY_PREFIXES = sorted(COUNTRY_LABELS, key=len, reverse=True)


@lru_cache(maxsize=100000)
def clean(value):
    return re.sub(r"\b(?:HG\d*|CT)\b", "", re.sub(r"\[[^]]*\]|\([^)]*\)", "", value))


def country_tokens(value):
    value = norm(clean(value))
    found = set()
    for _ in range(3):
        label = next((label for label in COUNTRY_PREFIXES if value == label or value.startswith(label + " ")), None)
        if label is None:
            break
        found.add(COUNTRY_LABELS[label])
        value = value[len(label):].strip()
    return (found if not value else set()), value


@lru_cache(maxsize=100000)
def name_variants(cell):
    value = norm(clean(cell))
    # Strip only known country prefixes, so the alias Ronaldo cannot match Cristiano Ronaldo.
    variants = {value}
    for _ in range(3):
        label = next((label for label in COUNTRY_PREFIXES if value.startswith(label + " ")), None)
        if label is None:
            break
        value = value[len(label):].strip()
        variants.add(value)
    return frozenset(variants)


def name_matches(cell, names):
    return bool(name_variants(cell).intersection(names))


def listed_positions(cell):
    value = re.sub(r"\([^)]*\)|\[[^]]*\]", "", cell).strip().upper()
    if not re.fullmatch(r"[A-Z /,–-]+", value):
        return set()
    tokens = set(re.findall(r"\b[A-Z]{2,3}\b", value))
    allowed = {"GK", "DF", "MF", "FW", "CB", "LB", "RB", "DM", "CDM", "CM", "AM", "CAM", "ST", "CF", "SS", "LW", "RW", "LM", "RM", "LWB", "RWB", "FB"}
    if not tokens or not tokens.issubset(allowed):
        return set()
    return { {"DM": "CDM", "AM": "CAM", "CF": "ST"}.get(token, token) for token in tokens }


def evidence_rows(reference):
    result = []
    for table_index, table in enumerate(reference.get("squadTables", [])):
        header = " ".join(" ".join(row) for row in table["rows"][:2]).lower()
        # Squad tables also contain transfer-fee columns; those are not transfer lists.
        transfer_heading = table["rows"] and len(table["rows"][0]) == 1 and table["rows"][0][0].strip().lower() in ("in", "out", "loans in", "loans out")
        transfer_columns = re.search(r"\b(from|to|moving|moved)\b", header) and re.search(r"\b(date|type|window)\b", header)
        if transfer_heading or transfer_columns:
            continue
        for row_index, cells in enumerate(table["rows"]):
            result.append((table_index, row_index, cells))
    return result


def audit(report, teams, people, aliases):
    references = {source["sourceId"]: source for source in report["references"]}
    result = []
    for team in teams:
        source_id = team["sourceIds"][0]
        reference = references[source_id]
        rows = evidence_rows(reference)
        for player in team["players"]:
            person_id = player["personId"]
            names = {norm(name) for name in [people[person_id]["name"], *aliases.get(person_id, [])]}
            matches = [(table, index, row) for table, index, row in rows if any(name_matches(cell, names) for cell in row)]
            countries, positions = set(), set()
            for _, _, row in matches:
                for cell in row:
                    countries.update(country_tokens(cell)[0])
                    positions.update(listed_positions(cell))
                    for label, code in COUNTRY_LABELS.items():
                        if norm(clean(cell)).startswith(label + " ") and name_matches(cell, names):
                            countries.add(code)
            result.append({
                "teamId": team["id"], "personId": person_id, "sourceId": source_id,
                "seasonRowFound": bool(matches),
                "nationalitySupported": player["nationality"] in countries,
                "observedCountries": sorted(countries), "observedPositions": sorted(positions),
                "primaryRoleListed": player["position"] in positions,
                "secondaryRolesListed": all(position in positions for position in player["secondaryPositions"]),
                "rowReferences": [{"table": table, "row": index} for table, index, _ in matches[:3]],
            })
    return {"sourceCheckedAt": report["checkedAt"], "note": "Candidate field evidence, not historical approval. General DF/MF/FW labels cannot verify precise game positions. Row references point into the preserved source-review report.", "summary": {"cards": len(result), "seasonRowsFound": sum(row["seasonRowFound"] for row in result), "nationalitiesSupported": sum(row["nationalitySupported"] for row in result), "primaryRolesListed": sum(row["primaryRoleListed"] for row in result), "allRoleLabelsListed": sum(row["primaryRoleListed"] and row["secondaryRolesListed"] for row in result), "automaticallyApproved": 0}, "cards": result}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    people = {person["id"]: person for person in json.loads((ROOT / "data/editorial/people.json").read_text())}
    teams = json.loads((ROOT / "data/editorial/teams.json").read_text())
    aliases = json.loads((ROOT / "data/research/name-aliases.json").read_text())["aliases"]
    result = audit(json.loads(args.report.read_text()), teams, people, aliases)
    result["sourceReportSha256"] = hashlib.sha256(args.report.read_bytes()).hexdigest()
    result["datasetVersion"] = json.loads((ROOT / "data/editorial/selection-policy.json").read_text())["datasetVersion"]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(result["summary"]))


if __name__ == "__main__":
    main()

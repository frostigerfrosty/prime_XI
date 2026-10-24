"""Read public season references and preserve reviewable excerpts; never approve claims."""
import argparse
import concurrent.futures
import datetime
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
MAX_BYTES = 10 * 1024 * 1024


class SeasonPage(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.tables = []
        self.title = []
        self.in_title = False
        self.ignored = 0
        self.paragraph = None
        self.captain_notes = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag in ("script", "style"):
            self.ignored += 1
        if tag == "title":
            self.in_title = True
        if tag == "p":
            self.paragraph = []
        if tag == "table":
            self.stack.append({"class": attributes.get("class", ""), "rows": [], "row": None, "cell": None})
        if self.stack:
            table = self.stack[-1]
            if tag == "tr":
                table["row"] = []
            if tag in ("th", "td"):
                table["cell"] = []
            if tag == "img" and table["cell"] is not None and attributes.get("alt"):
                table["cell"].append(" " + attributes["alt"] + " ")
            if tag == "br" and table["cell"] is not None:
                table["cell"].append(" | ")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.ignored = max(0, self.ignored - 1)
        if tag == "title":
            self.in_title = False
        if tag == "p" and self.paragraph is not None:
            paragraph = " ".join("".join(self.paragraph).split())
            if re.search(r"\bcaptain\b", paragraph, re.I):
                self.captain_notes.append(paragraph)
            self.paragraph = None
        if not self.stack:
            return
        table = self.stack[-1]
        if tag in ("th", "td") and table["cell"] is not None:
            if table["row"] is not None:
                table["row"].append(" ".join("".join(table["cell"]).split()))
            table["cell"] = None
        if tag == "tr" and table["row"] is not None:
            if any(table["row"]):
                table["rows"].append(table["row"])
            table["row"] = None
        if tag == "table":
            self.tables.append(self.stack.pop())

    def handle_data(self, text):
        if self.ignored:
            return
        if self.in_title:
            self.title.append(text)
        if self.paragraph is not None:
            self.paragraph.append(text)
        if self.stack and self.stack[-1]["cell"] is not None:
            self.stack[-1]["cell"].append(text)

    def excerpts(self):
        squads, staff = [], []
        for table in self.tables:
            headers = " ".join(" ".join(row) for row in table["rows"][:5])
            if re.search(r"\b(player|name)\b", headers, re.I) and re.search(r"\b(pos\.?|position|nat\.?|nationality)\b", headers, re.I):
                squads.append({"rows": table["rows"][:70], "rowsTotal": len(table["rows"]), "truncated": len(table["rows"]) > 70})
            if "infobox" in table["class"]:
                staff.extend(row for row in table["rows"] if re.search(r"\b(manager|head coach|captain)\b", " ".join(row), re.I))
        return {"title": "".join(self.title).strip(), "squadTables": squads, "staffRows": staff, "captainNotes": self.captain_notes[:15]}


def inspect_html(raw):
    page = SeasonPage()
    page.feed(raw.decode("utf-8"))
    page.close()
    result = page.excerpts()
    match = re.search(rb'"wgRevisionId"\s*:\s*(\d+)', raw)
    result["wikipediaRevision"] = int(match[1]) if match else None
    return result


def retrieve(source):
    result = {"sourceId": source["id"], "url": source["url"], "claimsVerified": False}
    try:
        request = urllib.request.Request(source["url"], headers={"User-Agent": "PRIME-XI-SourceReview/1.0 (https://github.com/frostigerfrosty/prime_XI)"})
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read(MAX_BYTES + 1)
            if response.status != 200 or len(raw) > MAX_BYTES:
                raise ValueError("Reference is unsuccessful or exceeds 10 MiB")
            extracted = inspect_html(raw)
            result.update({"httpStatus": response.status, "finalUrl": response.url, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(), **extracted})
            result["retrieved"] = True
            result["hasSquadEvidence"] = bool(extracted["squadTables"])
    except urllib.error.HTTPError as error:
        result.update({"retrieved": False, "httpStatus": error.code, "error": str(error)})
    except Exception as error:
        result.update({"retrieved": False, "error": str(error)})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    sources = json.loads((ROOT / "data/editorial/sources.json").read_text())
    selected = [source for source in sources if source["kind"] == "season_reference"]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(retrieve, selected))
    report = {
        "checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "purpose": "Source retrieval and excerpts for manual historical review. No team, player, captain or role is automatically verified.",
        "attribution": "Season reference excerpts: Wikipedia contributors; linked source pages and their revision histories, CC BY-SA. Excerpts are research evidence, not application ratings.",
        "summary": {"references": len(results), "retrieved": sum(item["retrieved"] for item in results), "withSquadTables": sum(item.get("hasSquadEvidence", False) for item in results), "claimsAutomaticallyApproved": 0},
        "references": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(report["summary"]))


if __name__ == "__main__":
    main()

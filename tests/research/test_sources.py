import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import urllib.error

SPEC = importlib.util.spec_from_file_location("source_review", Path(__file__).resolve().parents[2] / "scripts/review-historical-sources.py")
REVIEW = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REVIEW)


class SourceReviewTests(unittest.TestCase):
    def test_readable_squad_staff_and_captain_evidence(self):
        raw = b'''<html><title>Example season - Wikipedia</title>
          <script>{"wgRevisionId":12345}</script>
          <table class="infobox"><tr><th>Manager</th><td>Coach Name</td></tr></table>
          <table><tr><th>Pos.</th><th>Nat.</th><th>Player</th></tr>
          <tr><td>GK</td><td><img alt="Italy"></td><td>Player &amp; Name</td></tr></table>
          <p>Example is the captain.</p></html>'''
        result = REVIEW.inspect_html(raw)
        self.assertEqual(result["wikipediaRevision"], 12345)
        self.assertEqual(result["staffRows"], [["Manager", "Coach Name"]])
        self.assertEqual(result["squadTables"][0]["rows"][1], ["GK", "Italy", "Player & Name"])
        self.assertEqual(result["captainNotes"], ["Example is the captain."])

    def test_fixtures_or_challenge_html_are_not_squad_evidence(self):
        result = REVIEW.inspect_html(b'<title>Just a moment</title><table><tr><td>Date</td><td>Opponent</td></tr></table>')
        self.assertEqual(result["squadTables"], [])
        self.assertIsNone(result["wikipediaRevision"])

    def test_unread_http_reference_is_not_recorded_as_retrieved(self):
        error = urllib.error.HTTPError("https://example.test", 403, "Forbidden", {}, None)
        with patch.object(REVIEW.urllib.request, "urlopen", side_effect=error):
            result = REVIEW.retrieve({"id": "example", "url": "https://example.test"})
        self.assertFalse(result["retrieved"])
        self.assertFalse(result["claimsVerified"])
        self.assertEqual(result["httpStatus"], 403)
        self.assertNotIn("sha256", result)

    def test_truncated_excerpts_are_explicit(self):
        raw = ('<table><tr><td>Player</td><td>Position</td></tr>' + '<tr><td>A</td><td>GK</td></tr>' * 80 + '</table>').encode()
        table = REVIEW.inspect_html(raw)["squadTables"][0]
        self.assertEqual(table["rowsTotal"], 81)
        self.assertTrue(table["truncated"])
        self.assertEqual(len(table["rows"]), 70)

    def test_squad_tables_without_position_headers_are_kept_for_manual_review(self):
        raw = b'<table><tr><th>Number</th><th>Nation</th><th>Squad member</th></tr><tr><td>1</td><td>Germany</td><td>Player One</td></tr><tr><td>2</td><td>Germany</td><td>Player Two</td></tr></table>'
        result = REVIEW.inspect_html(raw, ["Player One", "Player Two"])
        self.assertEqual(len(result["squadTables"]), 1)


if __name__ == "__main__":
    unittest.main()

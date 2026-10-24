import importlib.util
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location("card_audit", Path(__file__).resolve().parents[2] / "scripts/audit-season-cards.py")
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


class CardAuditTests(unittest.TestCase):
    def test_aliases_do_not_match_other_players_with_longer_names(self):
        self.assertTrue(AUDIT.name_matches("Spain Xavi (captain)", {"xavi"}))
        self.assertFalse(AUDIT.name_matches("Xavi Torres", {"xavi"}))
        self.assertFalse(AUDIT.name_matches("Portugal Cristiano Ronaldo", {"ronaldo"}))
        self.assertTrue(AUDIT.name_matches("Brazil Ronaldo", {"ronaldo"}))

    def test_country_variants_are_explicit_and_slovenia_is_not_slovakia(self):
        self.assertEqual(AUDIT.country_tokens("Germany GER")[0], {"DEU"})
        self.assertEqual(AUDIT.country_tokens("SLO")[0], {"SVN"})
        self.assertEqual(AUDIT.country_tokens("SVK")[0], {"SVK"})
        self.assertEqual(AUDIT.country_tokens("Italy Juventus")[0], set())

    def test_transfer_rows_are_excluded_but_squad_transfer_fee_columns_remain(self):
        reference = {"squadTables": [
            {"rows": [["Date", "Pos.", "Name", "To", "Fee"], ["1 July", "MF", "Player", "Other Club", "Free"]]},
            {"rows": [["No.", "Pos.", "Nation", "Player", "Age", "Transfer fee"], ["6", "MF", "ESP", "Player", "25", "Free"]]},
        ]}
        rows = AUDIT.evidence_rows(reference)
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(table == 1 for table, _, _ in rows))

    def test_general_role_labels_are_not_promoted_to_precise_positions(self):
        report = {"checkedAt": "2026-10-24", "references": [{"sourceId": "source", "squadTables": [{"rows": [["No.", "Pos.", "Nation", "Player"], ["6", "MF", "ESP", "Xavi"], ["45", "MF", "ESP", "Xavi Torres"]]}]}]}
        teams = [{"id": "team", "sourceIds": ["source"], "players": [{"personId": "xavi", "position": "CM", "secondaryPositions": [], "nationality": "ESP"}]}]
        result = AUDIT.audit(report, teams, {"xavi": {"name": "Xavi Hernández"}}, {"xavi": ["Xavi"]})
        record = result["cards"][0]
        self.assertTrue(record["seasonRowFound"])
        self.assertTrue(record["nationalitySupported"])
        self.assertFalse(record["primaryRoleListed"])
        self.assertEqual(record["rowReferences"], [{"table": 0, "row": 1}])
        self.assertEqual(result["summary"]["automaticallyApproved"], 0)

    def test_an_unread_reference_cannot_produce_season_evidence(self):
        report = {"checkedAt": "2026-10-24", "references": [{"sourceId": "source", "retrieved": False, "error": "HTTP 403"}]}
        teams = [{"id": "team", "sourceIds": ["source"], "players": [{"personId": "xavi", "position": "CM", "secondaryPositions": [], "nationality": "ESP"}]}]
        result = AUDIT.audit(report, teams, {"xavi": {"name": "Xavi Hernández"}}, {})
        self.assertEqual(result["summary"]["seasonRowsFound"], 0)
        self.assertFalse(result["cards"][0]["primaryRoleListed"])


if __name__ == "__main__":
    unittest.main()

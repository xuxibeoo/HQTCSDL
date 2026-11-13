"""Run: python -m unittest discover -s docs/qa-student -p test_demo_schedule.py"""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
import demo_schedule as demo


class DemoScheduleTests(unittest.TestCase):
    def connection(self):
        con, cur = MagicMock(), MagicMock()
        context = MagicMock()
        context.__enter__.return_value = con
        con.cursor.return_value.__enter__.return_value = cur
        return context, con, cur

    def test_non_demo_never_opens_database(self):
        with patch.object(demo.db, "DEMO", False), patch.object(demo.db, "connection") as connection:
            result = demo.prepare_demo_schedule()
        self.assertEqual(result["created"], 0)
        connection.assert_not_called()

    def test_windows_cover_scan_and_both_refund_sides(self):
        self.assertLessEqual(demo.SCENARIOS["quet_qr"][2], 15)
        self.assertLess(demo.SCENARIOS["tu_choi_hoan"][2], 120)
        self.assertGreater(demo.SCENARIOS["duoc_hoan"][1], 120)

    def test_existing_scenarios_are_idempotent_without_insert(self):
        context, con, cur = self.connection()
        now = datetime(2026, 11, 11, 10)
        with patch.object(demo.db, "DEMO", True), patch.object(demo.db, "connection", return_value=context), \
             patch.object(demo.db, "rows", side_effect=[[{"ma_rap": 1}], [], []]), \
             patch.object(demo.db, "one", return_value={"bay_gio": now}), \
             patch.object(demo, "find_scenario", return_value={"ma_suat": 123}):
            result = demo.prepare_demo_schedule()
        self.assertTrue(result["ok"])
        self.assertEqual(result["created"], 0)
        cur.execute.assert_not_called()
        con.commit.assert_called_once()

    def test_missing_scenarios_insert_only_showtimes(self):
        context, con, cur = self.connection()
        now = datetime(2026, 11, 11, 10)
        def one(_cur, sql, **params):
            return {"bay_gio": now} if "bay_gio" in sql else {"total": 0}
        with patch.object(demo.db, "DEMO", True), patch.object(demo.db, "connection", return_value=context), \
             patch.object(demo.db, "rows", side_effect=[[{"ma_rap": 1}], [{"ma_phim": 1, "thoi_luong_phut": 95}], [{"ma_phong": 1, "loai_phong": "2D"}]]), \
             patch.object(demo.db, "one", side_effect=one), \
             patch.object(demo, "find_scenario", side_effect=[None, {"ma_suat": 1}, None, {"ma_suat": 2}, None, {"ma_suat": 3}]):
            result = demo.prepare_demo_schedule()
        self.assertEqual(result["created"], 3)
        self.assertEqual(cur.execute.call_count, 3)
        for call, key in zip(cur.execute.call_args_list, demo.SCENARIOS):
            sql = call.args[0].lower()
            self.assertIn("insert into suat_chieu", sql)
            self.assertNotIn("delete", sql)
            self.assertNotIn("update", sql)
            minutes = (call.kwargs["starts"] - now).total_seconds() / 60
            self.assertGreaterEqual(minutes, demo.SCENARIOS[key][1])
            self.assertLessEqual(minutes, demo.SCENARIOS[key][2])

    def test_busy_rooms_report_missing_without_inventory_changes(self):
        context, con, cur = self.connection()
        now = datetime(2026, 11, 11, 10)
        def one(_cur, sql, **params):
            return {"bay_gio": now} if "bay_gio" in sql else {"total": 1}
        with patch.object(demo.db, "DEMO", True), patch.object(demo.db, "connection", return_value=context), \
             patch.object(demo.db, "rows", side_effect=[[{"ma_rap": 1}], [{"ma_phim": 1, "thoi_luong_phut": 95}], [{"ma_phong": 1, "loai_phong": "2D"}]]), \
             patch.object(demo.db, "one", side_effect=one), patch.object(demo, "find_scenario", return_value=None):
            result = demo.prepare_demo_schedule()
        self.assertFalse(result["ok"])
        self.assertEqual(result["created"], 0)
        self.assertEqual(set(result["missing"]), set(demo.SCENARIOS))
        cur.execute.assert_not_called()
        self.assertIn("không dời lịch", result["message"])

    def test_get_is_read_only(self):
        context, con, cur = self.connection()
        with patch.object(demo.db, "connection", return_value=context), \
             patch.object(demo.db, "one", return_value={"bay_gio": datetime(2026, 11, 11)}), \
             patch.object(demo, "find_scenario", return_value={"ma_suat": 123}):
            self.assertTrue(demo.read_demo_scenarios()["ok"])
        cur.execute.assert_not_called()
        con.commit.assert_not_called()


if __name__ == "__main__":
    unittest.main()

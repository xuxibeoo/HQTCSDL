"""Read-only count snapshot inside the isolated clean-download web container."""
import json
import os
import oracledb

with oracledb.connect(user="cinema", password=os.environ["CINEMA_DB_PASSWORD"],
                     dsn=os.environ["DB_DSN"]) as con, con.cursor() as cur:
    tables = ("rap", "phong_chieu", "ghe", "phim", "khach_hang", "suat_chieu",
              "don_dat_ve", "ve", "thanh_toan")
    result = {"oracle": con.version, "counts": {}}
    cur.execute("select count(*) from user_tables")
    result["tables"] = cur.fetchone()[0]
    for table in tables:
        cur.execute("select count(*) from " + table)
        result["counts"][table] = cur.fetchone()[0]
    assert result["tables"] == 16
    assert result["counts"]["rap"] == 3
    assert result["counts"]["phong_chieu"] == 15
    assert result["counts"]["ghe"] == 1500
    assert result["counts"]["khach_hang"] == 20
    assert result["counts"]["ve"] < 10000, "Fresh startup must not implicitly load performance data."
    result["passed"] = True
    print(json.dumps(result, indent=2))

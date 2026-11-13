"""Verify live demo preparation inside `docker compose exec -T web python -`."""
import json
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import db


def http(path, token=None, method="GET"):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = Request("http://127.0.0.1:8080/api" + path,
                      data=b"{}" if method == "POST" else None, headers=headers, method=method)
    try:
        with urlopen(request, timeout=60) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        return error.code, json.load(error)


def counts():
    with db.connection("student-demo-verification") as con, con.cursor() as cur:
        return db.one(cur, """select
            (select count(*) from user_tables) tables,
            (select count(*) from phong_chieu) rooms,
            (select count(*) from ghe) seats,
            (select count(*) from don_dat_ve) orders,
            (select count(*) from ve) tickets from dual""")


db.init()
try:
    before = counts()
    status, session = http("/auth/demo/IT_ADMIN", method="POST")
    assert status == 200
    token = session["token"]
    first_status, first = http("/admin/prepare-demo", token, "POST")
    second_status, second = http("/admin/prepare-demo", token, "POST")
    read_status, current = http("/demo/scenarios")
    anonymous_status, _ = http("/admin/prepare-demo", method="POST")
    customer_status, customer = http("/auth/demo/CUSTOMER_1", method="POST")
    assert customer_status == 200
    forbidden_status, _ = http("/admin/prepare-demo", customer["token"], "POST")
    after = counts()
    assert first_status == second_status == read_status == 200
    assert anonymous_status == 401 and forbidden_status == 403
    assert second["created"] == 0
    assert before == after, "Preparing schedules must not alter tables, rooms, seats, orders or tickets."
    assert after["tables"] == 16 and after["seats"] == 1500
    print(json.dumps({
        "passed": True, "before": before, "after": after,
        "statuses": {"first_it_post": first_status, "second_it_post": second_status,
                     "public_read": read_status, "anonymous_post": anonymous_status,
                     "customer_post": forbidden_status},
        "first_created": first["created"], "second_created": second["created"],
        "current": current,
        "note": "Missing scenarios remain explicit when all existing rooms conflict; no schedule or inventory was reset.",
    }, ensure_ascii=False, default=str, indent=2))
finally:
    db.pool.close(force=True)

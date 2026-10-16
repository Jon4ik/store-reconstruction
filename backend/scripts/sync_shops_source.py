#!/usr/bin/env python3
"""Read source shop directory from SQL Server and emit JSON to stdout."""
import json
import os
import re
import sys


def main():
    try:
        import pyodbc
    except ImportError as exc:
        raise RuntimeError("pyodbc is not installed") from exc

    server = os.environ.get("UKM_SQL_SERVER", "").strip()
    database = os.environ.get("UKM_SQL_DATABASE", "").strip()
    username = os.environ.get("UKM_SQL_USER", "").strip()
    password = os.environ.get("UKM_SQL_PASSWORD", "")
    port = os.environ.get("UKM_SQL_PORT", "1433").strip()
    view = os.environ.get("UKM_SQL_VIEW", "[Ukm_Data].[dbo].[v_1C_Shops_Info]").strip()

    if not all((server, database, username, password)):
        raise RuntimeError("UKM_SQL_SERVER, UKM_SQL_DATABASE, UKM_SQL_USER and UKM_SQL_PASSWORD are required")
    if not port.isdigit() or not 1 <= int(port) <= 65535:
        raise RuntimeError("UKM_SQL_PORT must be a valid TCP port")
    if not re.fullmatch(r"\[?[A-Za-z0-9_]+\]?(?:\.\[?[A-Za-z0-9_]+\]?){0,3}", view):
        raise RuntimeError("UKM_SQL_VIEW contains unsupported characters")

    drivers = [d for d in pyodbc.drivers() if "SQL Server" in d]
    if not drivers:
        raise RuntimeError("No Microsoft SQL Server ODBC driver is installed")

    connection = None
    last_error = None
    for driver in reversed(drivers):
        try:
            connection_string = (
                f"DRIVER={{{driver}}};SERVER={server},{int(port)};DATABASE={database};"
                f"UID={username};PWD={password};TrustServerCertificate=yes"
            )
            connection = pyodbc.connect(connection_string, timeout=30)
            break
        except Exception as exc:
            last_error = exc
    if connection is None:
        raise RuntimeError(f"Unable to connect to SQL Server: {last_error}")

    query = f"""
        SELECT [НомерМагазина], [Город], [АдресМагазина], [ВремяРаботыМагазина],
               [УМ], [УМНомерТелефона], [ТУ], [Дирекция]
        FROM {view}
        ORDER BY [НомерМагазина]
    """
    try:
        cursor = connection.cursor()
        cursor.execute(query)
        columns = [column[0] for column in cursor.description]
        rows = []
        for record in cursor.fetchall():
            item = dict(zip(columns, record))
            number = str(item.get("НомерМагазина") or "").strip()
            if number.endswith(".0") and number[:-2].isdigit():
                number = number[:-2]
            if not number:
                continue
            rows.append({
                "shopNumber": number.zfill(3),
                "city": str(item.get("Город") or "").strip(),
                "address": str(item.get("АдресМагазина") or "").strip(),
                "workHours": str(item.get("ВремяРаботыМагазина") or "").strip(),
                "areaManager": str(item.get("УМ") or "").strip(),
                "areaManagerPhone": str(item.get("УМНомерТелефона") or "").strip(),
                "tu": str(item.get("ТУ") or "").strip(),
                "directorate": str(item.get("Дирекция") or "").strip(),
            })
        print(json.dumps(rows, ensure_ascii=False))
    finally:
        connection.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)

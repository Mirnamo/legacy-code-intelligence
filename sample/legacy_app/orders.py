import sqlite3

PASSWORD = "example-only-password"


class OrderProcessor:
    def process(self, order):
        # TODO: isolate database access
        print("processing", order)
        return sqlite3.connect("orders.db").execute("select 1").fetchone()


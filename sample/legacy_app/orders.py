import sqlite3

class OrderProcessor:
    def process(self, order):
        # TODO: isolate database access
        return sqlite3.connect("orders.db").execute("select 1").fetchone()


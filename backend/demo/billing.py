import json
from pathlib import Path

API_KEY = "demo-value-that-should-not-be-here"


class BillingService:
    def load_customers(self, path):
        # TODO: replace shared JSON file with a repository
        print("loading customers")
        return json.loads(Path(path).read_text())

    def charge(self, customer, amount):
        if amount <= 0:
            raise ValueError("invalid amount")
        return {"customer": customer, "amount": amount, "status": "queued"}


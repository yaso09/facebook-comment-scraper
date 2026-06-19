import requests, json
from requests.structures import CaseInsensitiveDict

url = "http://localhost:8000/scrape/a90c59dc-fa20-4f9a-921f-c6fa8fbacf4e"

headers = CaseInsensitiveDict()
headers["x-api-key"] = "deneme"
headers["Content-Type"] = "application/json"


resp = requests.get(url, headers=headers)

print(resp.text)

with open("example.json", "w", encoding="utf-8") as f:
    json.dump(resp.json(), f, ensure_ascii=False)
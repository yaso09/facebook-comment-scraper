import requests
from requests.structures import CaseInsensitiveDict

url = "http://localhost:8000/scrape"

headers = CaseInsensitiveDict()
headers["x-api-key"] = "deneme"
headers["Content-Type"] = "application/json"

data = """
{
	"url": "https://www.facebook.com/TRTSpor/posts/pfbid0yatjQBhpoVGpodnzsxKt34qupJL7kixyzpWS8H2Hc38kHTbwRdhVUNowcpLfGvt6l?rdid=H6VEZoOiAgU3sJn6#"
}
"""


resp = requests.post(url, headers=headers, data=data)

print(resp.text)


import requests
from requests.structures import CaseInsensitiveDict

url = "https://fbapi-gamma.vercel.app/search?q=Bursa+diş+kliniği&type=profile"

headers = CaseInsensitiveDict()
headers["x-api-key"] = "sk_live_IFbzvIAVMLYCUzFUVcYjKQWhkSvaexb90JBPcnuWTV37Ing4Ec4VVlIqf7GGLg0DY9hFfw49zYAgBiJEDtYXAsTBPnBe95Ax3jG7pr6XTx0MrCQb17WhOUWN1IicpkHE91plUBkxEXRLqrYBXbsj4pn0D4Yjpf955fYymFICN0egbgXKkXwBAuZ0mjZI8GtE4BJolcwQxYL1bWfe1AqzabU98tqzijkAA2bG8vYcY4iDW0UMQtd0SjQlw8KY2JLy"
headers["Content-Type"] = "application/json"

print(requests.get(url=url, headers=headers).text)
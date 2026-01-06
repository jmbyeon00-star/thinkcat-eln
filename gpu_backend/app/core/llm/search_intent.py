# gpu_backend/app/core/llm/search_intent.py

import re
import json
from app.core.llm.generate import generate_intent

# SYSTEM_PROMPT = """너는 특허 검색 질의를 분석하는 AI다.
# 사용자의 자연어 검색 문장을 분석하여,
# 아래 JSON 스키마에 맞게 검색 의도를 구조화하라.

# 규칙:
# - 절대 설명하지 말고 JSON만 출력하라
# - 없는 조건은 null 또는 빈 배열로 둬라
# - 날짜 표현은 ISO-8601 (YYYY-MM-DD)
# - 날짜가 상대 표현이면 오늘 날짜 기준으로 계산하라
# - CPC는 섹션(A~H) 단위까지만 추론하라
# - 확실하지 않으면 빈 배열로 둬라
# """

SYSTEM_PROMPT = """너는 "검색 의도 파서"다.
너의 임무는 사용자의 문장을 아래 JSON 스키마로 변환하는 것이다.

⚠️ 매우 중요:
- 너는 절대 설명, 조언, 의견을 출력하지 않는다
- 반드시 JSON 하나만 출력한다
- JSON 외 텍스트가 있으면 시스템이 즉시 실패한다
- 사용자의 질문에 답하려 하지 마라
- 불가능하다고 말하지 마라
- 모르면 null 또는 빈 배열로 둬라

출력 형식 (반드시 이 스키마 그대로):

{
  "search_type": "exact | text | semantic | hybrid",

  "exact_match": {
    "application_number": null,
    "publication_number": null,
    "family_application_number": null
  },

  "filters": {
    "filing_year": null,

    "filing_date": {
      "from": null,
      "to": null
    },

    "grant_date": {
      "from": null,
      "to": null
    },

    "inventor_country_code": null,
    "inventor_name": null,
    "applicant_code": null,

    "end_status": null,
    "claim_count": {
      "gte": null,
      "lte": null
    }
  },

  "classification": {
    "ipc_code": [],
    "cpc_code": []
  },

  "citation": {
    "cites": null,
    "cited_by": null
  },

  "text_query": {
    "keywords": [],
    "fields": ["title", "abstract", "claim"]
  },

  "use_vector": false,
  "confidence": 0.0
}
"""
def extract_json(text: str):
    match = re.search(r'\{.*\}', text, re.S)
    if not match:
        raise ValueError("JSON 객체 없음")
    return json.loads(match.group())

async def analyze_search_intent(user_query: str) -> dict:
    text = await generate_intent(
        user_prompt=user_query,
        system_prompt=SYSTEM_PROMPT,
    )
    print(">>>", text, "<<<")

    intent = extract_json(text)
    return intent

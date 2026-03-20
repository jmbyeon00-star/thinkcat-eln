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
- 사용자의 질문에서 "출원인"이나 "발명자"로 지목된 고유 명사는 절대 영어로 번역하거나 다른 단어로 바꾸지 마라. (예: "에스제이" -> "SJ" 변환 금지, 있는 그대로 유지)
- 단어의 철자를 임의로 수정하거나 유사한 발음으로 치환하지 마라. (예: "미세먼지" -> "세미나지" 변환 금지)
- 검색 키워드(keywords)를 추출할 때 원문의 형태소를 최대한 보존하라.
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
    "applicant_name": null,
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

  "use_vector": true,
  "confidence": 0.0
}
"""
# def extract_json(text: str):
#     match = re.search(r'\{.*\}', text, re.S)
#     if not match:
#         raise ValueError("JSON 객체 없음")
#     return json.loads(match.group())
def extract_json(text: str):
    try:
        # 1. 코드 블록(```json ... ```) 제거 시도
        cleaned = re.sub(r'```(?:json)?', '', text).strip()
        cleaned = cleaned.replace('```', '')
        
        # 2. 가장 바깥쪽의 { } 추출
        start = cleaned.find('{')
        end = cleaned.rfind('}') + 1
        if start == -1 or end == 0:
            raise ValueError("JSON 형식을 찾을 수 없습니다.")
            
        json_str = cleaned[start:end]
        return json.loads(json_str)
    except Exception as e:
        print(f"❌ JSON Parsing Error: {e}\nRaw Text: {text}")
        # 실패 시 기본 구조 반환 (시스템 중단 방지)
        return {"search_type": "text", "filters": {}, "confidence": 0}

async def analyze_search_intent(user_query: str) -> dict:
    text = await generate_intent(
        user_prompt=user_query,
        system_prompt=SYSTEM_PROMPT,
    )

    intent = extract_json(text)
    return intent

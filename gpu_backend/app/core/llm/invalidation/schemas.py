"""무효화 분석 LLM 스키마
- Ollama structured output 스키마 (SCHEMA_BASE, SCHEMA_PRIOR)
- Claude tool-use 스키마 (INTERPRETATION_TOOL)
- Ollama interpretation JSON 지시문 (INTERP_JSON_SUFFIX)
"""

# ─────────────────────────────────────────────────────────────
# Ollama structured output 스키마
# ─────────────────────────────────────────────────────────────

_ELEMENT_FIELDS_BASE = {
    "type": "object",
    "properties": {
        "id":                {"type": "string"},
        "name":              {"type": "string"},
        "function":          {"type": "string"},
        "embedding_text":    {"type": "string"},
        "modifier":          {"type": ["string", "null"]},
        "criticality":       {"type": "integer"},
        "criticality_reason":{"type": "string"},
        "source_claim":      {"type": "string"},
        "raw_text":          {"type": "string"},
    },
    "required": ["id", "name", "function", "embedding_text", "source_claim", "raw_text"],
}

_ELEMENT_FIELDS_PRIOR = {
    **_ELEMENT_FIELDS_BASE,
    "properties": {
        **_ELEMENT_FIELDS_BASE["properties"],
        "base_element_id": {"type": "string"},
        "correspondence":  {"type": "string"},
    },
    "required": [*_ELEMENT_FIELDS_BASE["required"], "base_element_id"],
}

SCHEMA_BASE  = {"type": "object", "properties": {"elements": {"type": "array", "items": _ELEMENT_FIELDS_BASE}},  "required": ["elements"]}
SCHEMA_PRIOR = {"type": "object", "properties": {"elements": {"type": "array", "items": _ELEMENT_FIELDS_PRIOR}}, "required": ["elements"]}


# ─────────────────────────────────────────────────────────────
# Claude tool-use 스키마 (generate_interpretation)
# ─────────────────────────────────────────────────────────────

INTERPRETATION_TOOL = {
    "name": "save_interpretation",
    "description": "특허 무효화 분석 결과를 저장합니다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "element_risk_analysis": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "element_name":              {"type": "string"},
                        "criticality":               {"type": "string"},
                        "risk_level":                {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW"]},
                        "highest_similarity_patent": {"type": "string"},
                        "highest_similarity_score":  {"type": "number"},
                        "per_patent_analysis": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "patent_id":           {"type": "string"},
                                    "patent_name":         {"type": "string"},
                                    "similarity_score":    {"type": "number"},
                                    "matching_claim_no":   {"type": "string"},
                                    "matching_claim_text": {"type": "string"},
                                    "similarity_reason":   {"type": "string"},
                                    "difference":          {"type": "string"},
                                },
                                "required": ["patent_id", "similarity_score", "matching_claim_no", "similarity_reason", "difference"],
                            },
                        },
                    },
                    "required": ["element_name", "risk_level", "per_patent_analysis"],
                },
            },
            "combo_analysis": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "patent_id":          {"type": "string"},
                        "patent_name":        {"type": "string"},
                        "contribution_score": {"type": "number"},
                        "covered_elements":   {"type": "array", "items": {"type": "string"}},
                        "overall_assessment": {"type": "string"},
                    },
                    "required": ["patent_id", "covered_elements", "overall_assessment"],
                },
            },
            "combination_risk": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "patents":                {"type": "array", "items": {"type": "string"}},
                        "patent_names":           {"type": "array", "items": {"type": "string"}},
                        "covered_elements":       {"type": "array", "items": {"type": "string"}},
                        "combination_reason":     {"type": "string"},
                        "invalidity_probability": {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW"]},
                        "invalidity_reason":      {"type": "string"},
                    },
                    "required": ["patents", "invalidity_probability", "invalidity_reason"],
                },
            },
            "legal_opinion": {
                "type": "object",
                "properties": {
                    "overall_invalidity_probability": {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW"]},
                    "primary_ground":      {"type": "string"},
                    "strongest_prior_art": {"type": "string"},
                    "key_vulnerability":   {"type": "string"},
                    "defense_points":      {"type": "string"},
                    "recommended_action":  {"type": "string"},
                },
                "required": ["overall_invalidity_probability", "primary_ground", "key_vulnerability", "defense_points", "recommended_action"],
            },
        },
        "required": ["summary", "element_risk_analysis", "combo_analysis", "legal_opinion"],
    },
}


# ─────────────────────────────────────────────────────────────
# Ollama용 interpretation JSON 지시문
# ─────────────────────────────────────────────────────────────

INTERP_JSON_SUFFIX = """

위 데이터를 바탕으로 아래 JSON 형식으로만 출력하세요. 설명 없이 JSON만.
{
  "summary": "...",
  "element_risk_analysis": [
    {
      "element_name": "...", "criticality": "...", "risk_level": "HIGH|MEDIUM|LOW",
      "highest_similarity_patent": "...", "highest_similarity_score": 0.0,
      "per_patent_analysis": [
        {"patent_id": "...", "patent_name": "...", "similarity_score": 0.0,
         "matching_claim_no": "...", "matching_claim_text": "...",
         "similarity_reason": "...", "difference": "..."}
      ]
    }
  ],
  "combo_analysis": [
    {"patent_id": "...", "patent_name": "...", "contribution_score": 0.0,
     "covered_elements": ["..."], "overall_assessment": "..."}
  ],
  "combination_risk": [
    {"patents": ["..."], "patent_names": ["..."], "covered_elements": ["..."],
     "combination_reason": "...", "invalidity_probability": "HIGH|MEDIUM|LOW",
     "invalidity_reason": "..."}
  ],
  "legal_opinion": {
    "overall_invalidity_probability": "HIGH|MEDIUM|LOW",
    "primary_ground": "...", "strongest_prior_art": "...",
    "key_vulnerability": "...", "defense_points": "...", "recommended_action": "..."
  }
}
"""

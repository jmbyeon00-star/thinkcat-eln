from pydantic import BaseModel, Field
from typing import Optional


class PerPatentAnalysis(BaseModel):
    patent_id:           str   = ""
    patent_name:         str   = ""
    similarity_score:    float = 0.0
    matching_claim_no:   str   = ""
    matching_claim_text: str   = ""
    similarity_reason:   str   = ""
    difference:          str   = ""


class ElementRiskAnalysis(BaseModel):
    element_name:              str                     = ""
    criticality:               str                     = ""
    risk_level:                str                     = "LOW"
    highest_similarity_patent: str                     = ""
    highest_similarity_score:  float                   = 0.0
    per_patent_analysis:       list[PerPatentAnalysis] = Field(default_factory=list)


class ComboAnalysis(BaseModel):
    patent_id:          str       = ""
    patent_name:        str       = ""
    contribution_score: float     = 0.0
    covered_elements:   list[str] = Field(default_factory=list)
    overall_assessment: str       = ""


class CombinationRisk(BaseModel):
    patents:                list[str] = Field(default_factory=list)
    patent_names:           list[str] = Field(default_factory=list)
    covered_elements:       list[str] = Field(default_factory=list)
    combination_reason:     str       = ""
    invalidity_probability: str       = "LOW"
    invalidity_reason:      str       = ""


class LegalOpinion(BaseModel):
    overall_invalidity_probability: str = "LOW"
    primary_ground:                 str = ""
    strongest_prior_art:            str = ""
    key_vulnerability:              str = ""
    defense_points:                 str = ""
    recommended_action:             str = ""


class InterpretationResult(BaseModel):
    summary:               str                       = ""
    element_risk_analysis: list[ElementRiskAnalysis] = Field(default_factory=list)
    combo_analysis:        list[ComboAnalysis]        = Field(default_factory=list)
    combination_risk:      list[CombinationRisk]      = Field(default_factory=list)
    legal_opinion:         Optional[LegalOpinion]     = None


# ── Tool Use 스키마 ──────────────────────────────────────────────────────────

INTERPRETATION_TOOL = {
    "name": "save_interpretation",
    "description": "특허 무효화 분석 결과를 저장합니다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "summary": {
                "type": "string",
                "description": "기준특허 전체 무효화 가능성 종합 평가 (2~4문장)"
            },
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
                            "description": "포함 규칙: (1) 유사도 최고 선행발명 1개 항상 포함, (2) 유사도 0.75 이상인 선행발명 전부 포함. similarity_score 내림차순 정렬.",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "patent_id":           {"type": "string"},
                                    "patent_name":         {"type": "string"},
                                    "similarity_score":    {"type": "number"},
                                    "matching_claim_no":   {"type": "string"},
                                    "matching_claim_text": {"type": "string"},
                                    "similarity_reason":   {"type": "string", "description": "기술적 유사 근거 1~2문장"},
                                    "difference":          {"type": "string", "description": "기술적 차이점 1~2문장"}
                                },
                                "required": ["patent_id", "similarity_score", "matching_claim_no", "similarity_reason", "difference"]
                            }
                        }
                    },
                    "required": ["element_name", "risk_level", "per_patent_analysis"]
                }
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
                        "overall_assessment": {"type": "string", "description": "이 선행발명의 무효화 기여도 및 단독/결합 위험성 평가 2~3문장"}
                    },
                    "required": ["patent_id", "covered_elements", "overall_assessment"]
                }
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
                        "invalidity_reason":      {"type": "string"}
                    },
                    "required": ["patents", "invalidity_probability", "invalidity_reason"]
                }
            },
            "legal_opinion": {
                "type": "object",
                "properties": {
                    "overall_invalidity_probability": {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW"]},
                    "primary_ground":     {"type": "string"},
                    "strongest_prior_art":{"type": "string"},
                    "key_vulnerability":  {"type": "string"},
                    "defense_points":     {"type": "string", "description": "구성요소별 방어 전략 포함한 전체 방어 포인트"},
                    "recommended_action": {"type": "string"}
                },
                "required": ["overall_invalidity_probability", "primary_ground", "key_vulnerability", "defense_points", "recommended_action"]
            }
        },
        "required": ["summary", "element_risk_analysis", "combo_analysis", "legal_opinion"]
    }
}

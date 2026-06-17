"""Greedy 무효화 조합 분석"""
import numpy as np
from app.services.invalidation.models import Patent
from app.services.invalidation.vectorizer import embed_normalized


def build_similarity_matrix(
    base_patent:   Patent,
    prior_patents: list[Patent],
) -> np.ndarray:
    """
    기준특허 구성요소 vs 선행발명별 구성요소
    각 기준 구성요소마다 선행발명 내 최대 유사도 추출

    Returns:
        shape: (기준특허 구성요소 수, 선행발명 수)
    """
    base_texts = base_patent.get_embedding_texts()
    base_vecs  = embed_normalized(base_texts)

    matrix = []
    for prior in prior_patents:
        prior_texts = prior.get_embedding_texts()
        prior_vecs  = embed_normalized(prior_texts)

        sim_matrix = base_vecs @ prior_vecs.T
        max_scores = sim_matrix.max(axis=1)
        matrix.append(max_scores)

    return np.array(matrix).T   # (n_base, n_prior)


def analyze_greedy_combination(
    base_patent:   Patent,
    prior_patents: list[Patent],
    t1:        float = 0.75,
    t2:        float = 0.85,
    max_combo: int   = 3,
) -> dict:
    """
    Greedy 무효화 조합 분석

    유사도 임계값:
      >= t2: criticality × 1.5  (강력한 증거)
      >= t1: criticality × 1.0  (일반 증거)
      < t1:  0                  (미달)
    """
    ref_names       = [e.name for e in base_patent.elements]
    ref_importances = np.array([e.criticality for e in base_patent.elements], dtype=float)
    cand_names      = [p.title for p in prior_patents]

    print("🔢 유사도 행렬 계산 중...")
    matrix = build_similarity_matrix(base_patent, prior_patents)

    greedy_score_matrix = np.zeros_like(matrix)
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            sim = matrix[i, j]
            imp = ref_importances[i]
            if sim >= t2:
                greedy_score_matrix[i, j] = imp * 1.5
            elif sim >= t1:
                greedy_score_matrix[i, j] = imp * 1.0
            else:
                greedy_score_matrix[i, j] = 0

    remaining_components  = set(range(len(ref_names)))
    selected_patents_info = []
    covered_mask          = np.zeros(len(ref_names), dtype=bool)
    temp_greedy_matrix    = greedy_score_matrix.copy()

    while len(remaining_components) > 0 and len(selected_patents_info) < max_combo:
        patent_total_scores = temp_greedy_matrix.sum(axis=0)

        if patent_total_scores.max() <= 0:
            break

        best_cand_idx = np.argmax(patent_total_scores)

        newly_covered = []
        for i in list(remaining_components):
            if temp_greedy_matrix[i, best_cand_idx] > 0:
                newly_covered.append(ref_names[i])
                covered_mask[i] = True
                remaining_components.remove(i)
                temp_greedy_matrix[i, :] = 0

        if not newly_covered:
            break

        selected_patents_info.append({
            "patent_id":          prior_patents[best_cand_idx].application_number,
            "name":               cand_names[best_cand_idx],
            "covered_elements":   newly_covered,
            "contribution_score": float(patent_total_scores[best_cand_idx]),
        })

    total = ref_importances.sum()
    weighted_coverage = (
        np.dot(covered_mask.astype(float), ref_importances) / total
        if total > 0 else 0.0
    )
    uncovered_elements = [
        ref_names[i] for i in range(len(ref_names)) if not covered_mask[i]
    ]

    return {
        "matrix":               matrix,
        "selected_combination": selected_patents_info,
        "weighted_coverage":    weighted_coverage,
        "is_covered":           covered_mask,
        "uncovered_elements":   uncovered_elements,
        "ref_names":            ref_names,
        "cand_names":           cand_names,
        "ref_importances":      ref_importances,
    }

from pydantic import BaseModel
from typing import Optional

class PatentPriceRequest(BaseModel):
    app_number: str

class PatentPriceResponse(BaseModel):
    application_number: int
    tech: float
    legal: float
    market: float
    economy: float
    strategy: float
    predicted_price: int
    real_price: str

# ==============================================================
# 📘 StanineTechdna Schema
# ==============================================================
class StanineTechdnaSchema(BaseModel):
    uid: int
    publication_number: str
    application_number: str
    applicant_code: Optional[str] = None
    main_ipc: Optional[str] = None
    ipc_cnt: Optional[int] = 0
    reject_trial_cnt: Optional[int] = 0
    reject_dismissal_cnt: Optional[int] = 0
    rightholder_ch_cnt: Optional[int] = 0
    pledge_cnt: Optional[int] = 0
    image_cnt: Optional[int] = 0
    indep_claim_len: Optional[int] = 0
    indep_claim_cnt: Optional[int] = 0
    invalidation_trial_cnt: Optional[int] = 0
    invalidation_dismissal_cnt: Optional[int] = 0
    description_len: Optional[int] = 0
    inventor_cnt: Optional[int] = 0
    prior_cnt: Optional[int] = 0
    division_app: Optional[int] = 0
    non_citation_cnt: Optional[int] = 0
    passive_trial_cnt: Optional[int] = 0
    license_cnt: Optional[int] = 0
    after_regi_year: Optional[int] = 0
    acc_exam: Optional[int] = 0
    refusal_count: Optional[int] = 0
    active_trial_cnt: Optional[int] = 0
    submit_info: Optional[int] = 0
    corrective_trial: Optional[int] = 0
    early_disclosure: Optional[int] = 0
    extension_cnt: Optional[int] = 0
    dep_claim_cnt: Optional[int] = 0
    dep_avg_depth: Optional[int] = 0
    claim_series: Optional[int] = 0
    f_cit_cnt: Optional[int] = 0
    f_date_diff: Optional[int] = 0
    family_country_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ==============================================================
# 📗 StanineBscore Schema
# ==============================================================
class StanineBscoreSchema(BaseModel):
    uid: int
    official_number: Optional[str] = None
    bzno: Optional[str] = None
    standard_number: Optional[str] = None
    age: Optional[int] = 0
    em_cnt: Optional[int] = 0
    cr_grd: Optional[int] = 0
    _2022out: Optional[int] = 0
    _2021out: Optional[int] = 0
    _2020out: Optional[int] = 0
    _2022profit: Optional[int] = 0
    _2021profit: Optional[int] = 0
    _2020s: Optional[int] = 0
    _2021s: Optional[int] = 0
    _2022s: Optional[int] = 0
    _2022g: Optional[int] = 0
    business_gross: Optional[int] = 0
    _2022bsize: Optional[int] = 0
    _2021bsize: Optional[int] = 0
    _2020bsize: Optional[int] = 0
    _2022occupied: Optional[int] = 0
    _2021occupied: Optional[int] = 0
    _2020occupied: Optional[int] = 0
    corp_number: Optional[str] = None
    applicant_code: Optional[str] = None
    land_price: Optional[int] = 0
    average_salary: Optional[float] = 0.0
    land_price_stanine: Optional[int] = 0
    average_salary_stanine: Optional[int] = 0

    class Config:
        from_attributes = True

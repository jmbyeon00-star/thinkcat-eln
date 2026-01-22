from app.models.project_model import ProjectInfo
from app.models.collection_model import CollectionInfo

from datetime import datetime
import uuid
import secrets
import random, string

def short_token_with_uuid(n: int = 6) -> str:
    return uuid.uuid4().hex[:n]

def short_token_with_secrets(n: int = 6) -> str:
    return secrets.token_hex(n)[:n]

def short_token_with_random_and_string(n: int = 6) -> str:
    alphabet = string.ascii_lowercase + string.digits
    return ''.join(random.choices(alphabet, k=n))
    
def short_token(n: int = 6) -> str:
    """소문자 + 숫자 랜덤 6자리 토큰 생성"""
    alphabet = string.ascii_lowercase + string.digits
    return ''.join(random.choices(alphabet, k=n))

def generate_project_code() -> str:
    """프로젝트 코드 생성: proj_날짜_랜덤"""
    date_str = datetime.now().strftime("%Y%m%d")
    return f"proj_{date_str}_{short_token(6)}"

def generate_collection_code() -> str:
    """컬렉션 코드 생성: col_날짜_랜덤"""
    date_str = datetime.now().strftime("%Y%m%d")
    return f"col_{date_str}_{short_token(6)}"

def generate_data_group_code() -> str:
    """컬렉션 코드 생성: col_날짜_랜덤"""
    date_str = datetime.now().strftime("%Y%m%d")
    return f"data_pjt_{date_str}_{short_token(6)}"


# def generate_model_code(prefix: str = "model") -> str:
#     """모델 코드 생성 (prefix는 task_type에 따라 변경 가능)"""
#     date_str = datetime.now().strftime("%Y%m%d")
#     return f"{prefix}_{date_str}_{short_token(6)}"

def generate_model_code(session, user_id: int, data_scope: str, task_type: str, project_id: int=None, collection_id: int=None) -> str:
    """프로젝트/컬렉션 단위별 모델 코드 생성"""
    if data_scope == "project":
        project = session.query(ProjectInfo).filter_by(id=project_id, user_id=user_id).first()
        if not project:
            raise ValueError("project not found")
        return f"cls_{project.project_code}", project.project_code, project.source_type

    elif data_scope == "collection":
        collection = session.query(CollectionInfo).filter_by(id=collection_id, user_id=user_id).first()
        if not collection:
            raise ValueError("collection not found")
        prefix = "cls" if task_type == "classification" else "rec"
        return f"{prefix}_{collection.collection_code}", collection.collection_code, collection.source_type.value

    else:
        project = session.query(ProjectInfo).filter_by(id=project_id, user_id=user_id).first()
        if not project:
            raise ValueError("project not found")
        return f"model_{project.project_code}", project.project_code, project.source_type
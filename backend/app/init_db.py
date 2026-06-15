from app.core.db import Base, engine
from app.models import user
from app.models import invalidation  # 선행기술조사 테이블(INVAL_*) 등록

def init():
    print("테이블 생성 중...")
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    init()

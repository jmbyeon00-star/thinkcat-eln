from app.core.db import Base, engine
from app.models import user

def init():
    print("테이블 생성 중...")
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    init()

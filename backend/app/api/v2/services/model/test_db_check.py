# test_db_check.py
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.models.patent_model import PatentResult

# 실제 DATABASE_URL로 변경
DATABASE_URL = "your_database_url_here"
engine = create_engine(DATABASE_URL)
SyncSessionLocal = sessionmaker(bind=engine)
session = SyncSessionLocal()

print("=" * 50)
print("DB 연결 확인 중...")
print("=" * 50)

# 1. 테이블 존재 확인
try:
    total = session.query(PatentResult).count()
    print(f"✅ PATENT_RESULT_TB 테이블 존재")
    print(f"   총 레코드 수: {total:,}개")
except Exception as e:
    print(f"❌ 테이블 접근 실패: {e}")
    session.close()
    exit()

# 2. 샘플 데이터 조회
print("\n" + "=" * 50)
print("샘플 데이터 (최신 5건)")
print("=" * 50)
samples = session.query(PatentResult).limit(5).all()
for s in samples:
    print(f"출원번호: {s.application_number}")
    print(f"제목: {s.title[:50] if s.title else 'None'}...")
    print(f"Claim 존재: {'Yes' if s.claim else 'No'}")
    print("-" * 50)

# 3. 특정 출원번호 검색
print("\n" + "=" * 50)
print("특정 출원번호 검색")
print("=" * 50)
app_num = "1020160020878"
print(f"검색할 출원번호: {app_num}")

# ORM 방식
result_orm = session.query(PatentResult).filter(
    PatentResult.application_number == app_num
).first()

# SQL 직접 실행
result_sql = session.execute(
    text("SELECT * FROM PATENT_RESULT_TB WHERE APPLICATION_NUMBER = :app_num"),
    {"app_num": app_num}
).first()

if result_orm:
    print(f"✅ ORM으로 찾음!")
    print(f"   ID: {result_orm.id}")
    print(f"   제목: {result_orm.title}")
    print(f"   출원일: {result_orm.filing_date}")
else:
    print(f"❌ ORM으로 못 찾음")

if result_sql:
    print(f"✅ SQL로 찾음!")
else:
    print(f"❌ SQL로 못 찾음")

# 4. 비슷한 출원번호 검색
print("\n" + "=" * 50)
print("비슷한 출원번호 검색")
print("=" * 50)
similar = session.query(PatentResult).filter(
    PatentResult.application_number.like("%20160020878%")
).limit(10).all()

if similar:
    print(f"발견된 비슷한 출원번호: {len(similar)}건")
    for s in similar:
        print(f"  - {s.application_number}: {s.title[:30] if s.title else 'None'}...")
else:
    print("비슷한 출원번호도 없음")

# 5. 출원번호 형식 확인
print("\n" + "=" * 50)
print("출원번호 형식 확인 (샘플 10건)")
print("=" * 50)
sample_nums = session.query(PatentResult.application_number).limit(10).all()
for num in sample_nums:
    if num[0]:
        print(f"  '{num[0]}' (길이: {len(num[0])}, 타입: {type(num[0])})")

session.close()
print("\n" + "=" * 50)
print("테스트 완료")
print("=" * 50)
import sys
sys.path.insert(0, '../backend')

from app.services.crawlers.sba_crawler import SBACrawler
from app.core.db import SyncSessionLocal
from app.models.announcement_model import Announcement

# ── 1. 크롤링 ──────────────────────────────────────────
print("=== 1. SBA 크롤링 ===")
df = SBACrawler().crawl_recruiting()
print(f"수집: {len(df)}건")
if df.empty:
    print("수집 결과 없음 — 종료")
    sys.exit()

print(df[['title', 'status', 'start_date', 'end_date']].to_string())

# ── 2. DB 기존 SBA URL 조회 ────────────────────────────
print("\n=== 2. DB 기존 서울진흥원 데이터 ===")
db = SyncSessionLocal()
try:
    existing = db.query(Announcement).filter(Announcement.organization == '서울진흥원').all()
    existing_urls = set(a.URL for a in existing)
    print(f"DB에 서울진흥원 공고: {len(existing)}건")
    for a in existing:
        print(f"  - [{a.status}] {a.title[:40]}")
finally:
    db.close()

# ── 3. 신규 항목 확인 ──────────────────────────────────
print("\n=== 3. 신규 항목 (DB에 없는 것) ===")
new_rows = [row for _, row in df.iterrows() if row['URL'] not in existing_urls]
print(f"신규: {len(new_rows)}건 / 중복 스킵: {len(df) - len(new_rows)}건")
for row in new_rows:
    print(f"  + {row['title'][:50]}")

# ── 4. DB INSERT ───────────────────────────────────────
if not new_rows:
    print("\n신규 항목 없음 — INSERT 스킵")
    sys.exit()

answer = input(f"\n신규 {len(new_rows)}건을 DB에 INSERT 할까요? (y/n): ").strip().lower()
if answer != 'y':
    print("취소")
    sys.exit()

db = SyncSessionLocal()
try:
    for row in new_rows:
        db.add(Announcement(
            organization=row.get('organization') or '',
            title=row.get('title') or '',
            URL=row['URL'],
            announcement_date=row.get('announcement_date') or None,
            start_date=row.get('start_date') or None,
            end_date=row.get('end_date') or None,
            status=row.get('status') or '정보없음',
            budget=row.get('budget') or None,
        ))
    db.commit()
    print(f"✅ INSERT 완료: {len(new_rows)}건")
except Exception as e:
    db.rollback()
    print(f"❌ INSERT 실패: {e}")
finally:
    db.close()

# ── 5. 결과 확인 ───────────────────────────────────────
print("\n=== 5. DB 최종 확인 ===")
db = SyncSessionLocal()
try:
    after = db.query(Announcement).filter(Announcement.organization == '서울진흥원').all()
    print(f"서울진흥원 공고 총 {len(after)}건")
    for a in after:
        print(f"  [{a.id}] [{a.status}] {a.title[:40]} ({a.start_date} ~ {a.end_date})")
finally:
    db.close()

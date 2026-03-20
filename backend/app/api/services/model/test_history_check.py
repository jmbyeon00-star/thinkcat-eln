
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "mysql+pymysql://root:doslvkdlqm!@localhost:3306/ipforce?charset=utf8mb4"
engine = create_engine(DATABASE_URL)
SyncSessionLocal = sessionmaker(bind=engine)
session = SyncSessionLocal()

print("=" * 50)
print("Search History Table Check")
print("=" * 50)

# 1. Check if table exists and count
try:
    result = session.execute(text("SELECT COUNT(*) FROM SEARCH_HISTORY_TB")).scalar()
    print(f"✅ SEARCH_HISTORY_TB exists. Total records: {result}")
except Exception as e:
    print(f"❌ SEARCH_HISTORY_TB not found or error: {e}")
    session.close()
    exit()

# 2. Check recent data
print("\nRecent 10 records:")
try:
    result = session.execute(text("SELECT * FROM SEARCH_HISTORY_TB ORDER BY timestamp DESC LIMIT 10"))
    rows = result.fetchall()
    if rows:
        for row in rows:
            print(row)
    else:
        print("No records found.")
except Exception as e:
    print(f"❌ Error fetching records: {e}")

session.close()

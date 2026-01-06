# crud/chat_crud.py (추가 구현)

import uuid
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any
from app.models.chat_model import ChatData, ChatInfo

async def get_user_chat_list(db: AsyncSession, user_id: int) -> List[Dict[str, Any]]:
    """
    특정 사용자의 모든 채팅방 목록을 최신 순으로 DB에서 조회합니다.
    (READ 기능)
    """
    
    # 1. SQLAlchemy SELECT 쿼리 작성: user_id로 필터링하고 updated_at으로 정렬
    stmt = (
        select(ChatInfo.chat_id, ChatInfo.title, ChatInfo.updated_at)
        .where(ChatInfo.user_id == user_id)
        .order_by(ChatInfo.updated_at.desc())
    )
    
    # 2. 쿼리 실행 (비동기)
    result = await db.execute(stmt)
    
    # 3. 결과 Row를 Dictionary 형태로 변환 (mappings().all() 사용)
    chat_list_rows = result.mappings().all() 
    
    # 4. 프론트엔드 형식에 맞게 키를 'chat_id'에서 'id'로 변경하여 반환
    final_list = []
    for row in chat_list_rows:
        final_list.append({
            "id": row['chat_id'],  # 프론트엔드에서 chat.id로 사용될 키
            "title": row['title'],
            # datetime 객체를 직렬화 가능한 문자열로 변환 (프론트엔드 안전성 확보)
            "updated_at": row['updated_at'].isoformat() if row['updated_at'] else None, 
        })
        
    return final_list

async def create_new_chat(db: AsyncSession, user_id: int, title: str) -> ChatInfo:
    """
    새로운 채팅방 정보를 CHAT_INFO_TB에 저장하고 객체를 반환합니다. (CREATE)
    """
    new_chat = ChatInfo(
        user_id=user_id,
        title=title,
        # chat_id는 ORM 모델 정의에서 uuid4()로 자동 생성됩니다.
    )
    db.add(new_chat)
    await db.commit()
    await db.refresh(new_chat)
    return new_chat

async def load_messages(db: AsyncSession, chat_id: str) -> List[Dict[str, str]]:
    """
    특정 채팅방의 모든 메시지 기록을 순서대로 로드합니다. (READ)
    """
    stmt = (
        select(ChatData.role, ChatData.content)
        .where(ChatData.chat_id == chat_id)
        .order_by(ChatData.sequence_num.asc())
    )
    result = await db.execute(stmt)
    # 쿼리 결과를 {"role": "...", "content": "..."} 형태로 변환
    messages = [{"role": row.role, "content": row.content} for row in result.all()]
    return messages

async def save_message(db: AsyncSession, chat_id: str, role: str, content: str, sequence_num: int | None = None):
    """
    새 메시지 (사용자 또는 AI)를 CHAT_DATA_TB에 저장합니다. (CREATE)
    """
    if not sequence_num:
        # 1. 해당 chat_id의 현재 최대 sequence_num을 조회합니다.
        max_seq_num = await db.scalar(
            select(func.max(ChatData.sequence_num)).where(ChatData.chat_id == chat_id)
        )
        # 2. 다음 sequence_num을 설정합니다. (None이면 1, 아니면 max + 1)
        sequence_num = (max_seq_num or 0) + 1
    
    new_message = ChatData(
        chat_id=chat_id,
        role=role,
        content=content,
        sequence_num=sequence_num # 계산된 값 사용
    )
    
    db.add(new_message)
    await db.commit()
    # await db.refresh(new_message) # 반환할 필요가 없으므로 refresh 생략
    return new_message.sequence_num # 새 시퀀스 번호를 반환하여 확인 가능

    
"""
crud_credit.py 리팩토링 전 백업
- start_trial / start_subscription 구현 시 참고용
"""

# ── assign_free_trial (→ start_trial로 재구현 예정) ──────────────────────────
# async def assign_free_trial(db: AsyncSession, user_id: int) -> bool:
#     """무료 체험 시작. 이미 시작했으면 False 반환."""
#     result = await db.execute(select(User).where(User.id == user_id))
#     user = result.scalars().first()
#     if not user or user.trial_started:
#         return False
#
#     plan_result = await db.execute(select(PlanDB).where(PlanDB.name == "trial"))
#     plan = plan_result.scalars().first()
#     if not plan:
#         return False
#
#     now = _now()
#     db.add(UserCreditDB(
#         user_id           = user_id,
#         credits_remaining = plan.monthly_credits,
#         credits_total     = plan.monthly_credits,
#         credit_expire_at  = now + timedelta(days=14),
#         updated_at        = now,
#     ))
#     user.trial_started = True
#     await db.commit()
#     return True


# ── start_subscription (재구현 예정) ─────────────────────────────────────────
# async def start_subscription(
#     db: AsyncSession,
#     org_name: str,
#     plan_id: int,
#     owner_user_id: int,
#     member_user_ids: list[int],
# ) -> OrganizationDB:
#     """구독 플랜 가입. ORGANIZATION_TB 생성 + owner USER_CREDIT_TB 지급."""
#     now = _now()
#     all_user_ids = list({owner_user_id} | set(member_user_ids))
#
#     plan_result = await db.execute(select(PlanDB).where(PlanDB.id == plan_id))
#     plan = plan_result.scalars().first()
#     if not plan:
#         raise ValueError(f"존재하지 않는 plan_id: {plan_id}")
#
#     credit_expire_at = now + relativedelta(months=1)
#     period_end       = now + relativedelta(months=plan.period_months)
#
#     org = OrganizationDB(
#         name             = org_name,
#         plan_id          = plan_id,
#         owner_user_id    = owner_user_id,
#         credit_expire_at = credit_expire_at,
#         period_end       = period_end,
#         created_at       = now,
#     )
#     db.add(org)
#     await db.flush()
#
#     # USER_CREDIT_TB는 owner만 생성
#     existing = await db.execute(select(UserCreditDB).where(UserCreditDB.user_id == owner_user_id))
#     credit = existing.scalars().first()
#     if credit:
#         credit.credits_remaining = plan.monthly_credits
#         credit.credits_total     = plan.monthly_credits
#         credit.credit_expire_at  = credit_expire_at
#         credit.updated_at        = now
#     else:
#         db.add(UserCreditDB(
#             user_id           = owner_user_id,
#             credits_remaining = plan.monthly_credits,
#             credits_total     = plan.monthly_credits,
#             credit_expire_at  = credit_expire_at,
#             updated_at        = now,
#         ))
#
#     for uid in all_user_ids:
#         u_result = await db.execute(select(User).where(User.id == uid))
#         u = u_result.scalars().first()
#         if u:
#             u.organization_id = org.id
#             u.org_role = 'owner' if uid == owner_user_id else 'member'
#
#     await db.commit()
#     return org


# ── credit_scheduler.py 구버전 ────────────────────────────────────────────────
# _daily_job 참고용 (USER_CREDIT_TB 기반, 리팩토링 전)
#
# orgs = db.query(OrganizationDB).filter(
#     OrganizationDB.plan_id.isnot(None),
#     func.date(OrganizationDB.credit_expire_at) == today,
# ).all()
#
# for org in orgs:
#     expire_date     = org.credit_expire_at.date()
#     period_end_date = org.period_end.date() if org.period_end else None
#     plan            = db.query(PlanDB).filter(PlanDB.id == org.plan_id).first()
#     member_ids      = db.query(User.id).filter(User.organization_id == org.id).subquery()
#
#     if expire_date == period_end_date:
#         db.query(UserCreditDB).filter(UserCreditDB.user_id.in_(member_ids)).update(
#             {"credits_remaining": 0, "credits_total": 0, "updated_at": now},
#             synchronize_session=False,
#         )
#     else:
#         per_credit  = plan.monthly_credits if plan else 0
#         next_expire = _add_one_month(expire_date)
#         org.credit_expire_at = datetime(next_expire.year, next_expire.month, next_expire.day)
#         db.query(UserCreditDB).filter(UserCreditDB.user_id.in_(member_ids)).update(
#             {"credits_remaining": per_credit, "credits_total": per_credit,
#              "credit_expire_at": org.credit_expire_at, "updated_at": now},
#             synchronize_session=False,
#         )
#
# # Trial 만료 (구버전 - organization_id=null 기반)
# trial_plan = db.query(PlanDB).filter(PlanDB.name == "trial").first()
# if trial_plan:
#     db.query(UserCreditDB).join(User, User.id == UserCreditDB.user_id).filter(
#         User.organization_id.is_(None),
#         func.date(UserCreditDB.credit_expire_at) == today,
#         UserCreditDB.credits_total == trial_plan.monthly_credits,
#     ).update(
#         {"credits_remaining": 0, "credits_total": 0, "updated_at": now},
#         synchronize_session=False,
#     )

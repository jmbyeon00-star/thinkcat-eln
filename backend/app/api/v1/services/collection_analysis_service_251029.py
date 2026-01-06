from sqlalchemy.orm import Session
from sqlalchemy import or_, func, distinct
from app.models.collection_model import CollectionInfo, CollectionData
from app.models.project_model import ProjectData, ProjectInfo
from app.models.patent_model import PatentLiti, PatentData

import pandas as pd
import numpy as np
from typing import List, Dict, Union, Optional
from pymilvus import connections, Collection
from umap.umap_ import UMAP

# Milvus 연결 (v2.5.4)
connections.connect(alias="default", host="175.125.94.218", port="19530")

def get_db_data(db: Session, collection_code: Union[str, List[str]]):
    """
    DB에서 컬렉션 데이터 가져오기
    ProjectData와 PatentData를 application_number로 JOIN
    """
    # collection_code를 항상 리스트로 처리
    if not isinstance(collection_code, list):
        collection_code = [collection_code]

    collection_code = [str(code) for code in collection_code]  
    project_query = db.query(ProjectData).filter(
        ProjectData.collection_code.in_(collection_code)
    )
    project_count = project_query.count()
    
    if project_count == 0:
        print(f"Warning: No data found for collection_code: {collection_code}")
        return pd.DataFrame()
    
    base_query = db.query(
        ProjectData.collection_code,
        ProjectData.collection_name,
        ProjectData.application_number,
        PatentData.applicant_code,
        func.left(PatentData.cpc_code, 1).label('cpc_code'),
        func.left(PatentData.ipc_code, 4).label('ipc_code'),
        PatentData.filing_year
    ).join(
        PatentData,
        ProjectData.application_number == PatentData.application_number
    )
    
    if len(collection_code) > 1:
        query = base_query.filter(ProjectData.collection_code.in_(collection_code))

    else:
        query = base_query.filter(ProjectData.collection_code == collection_code)
    
    data = query.all()
    
    if len(data) == 0:
        print("Warning: JOIN returned no results.")
    

    df = pd.DataFrame(data, columns=[
        'collection_code', 'collection_name', 'application_number',
        'applicant_code', 'cpc_code', 'ipc_code', 'filing_year'
    ])
    print("db 조회 완료!")
    return df 

def get_date_company(db: Session, collection_code: str):
    """
    출원날짜, 출원회사 확인 + applicant_code별 name 조회
    """
    df = get_db_data(db, collection_code)
    
    # 출원 날짜별 통계
    date_result = dict(df['filing_year'].value_counts().items())
    
    # 출원인별 통계 (상위 10개)
    df = df.assign(applicant_code=df['applicant_code'].fillna('').str.split('/'))
    expand_df = df.explode('applicant_code').reset_index(drop=True)
    business_counts = expand_df['applicant_code'].value_counts()[:10]

    # applicant_code 목록
    applicant_codes = business_counts.index.tolist()

    # PatentLiti 테이블에서 이름 조회
    name_query = (
        db.query(PatentLiti.applicant_code, PatentLiti.name)
        .filter(PatentLiti.applicant_code.in_(applicant_codes))
    )
    name_map = dict(name_query.all())

    # 결과 구성 (code + name + count 모두 표시)
    business_result = [
        {
            "applicant_code": code,
            "name": name_map.get(int(code)) if code and code.isdigit() else name_map.get(code),
            "count": int(business_counts[code])
        }
        for code in applicant_codes
    ]

    return {
        "date_result": date_result,
        "business_result": business_result
    }

def get_vector(df: pd.DataFrame):
    """
    Milvus에서 벡터 데이터 가져오기
    """
    if df.empty:
        return None, df
    
    # CPC 코드로 컬렉션 이름 결정
    index = df['cpc_code'].iloc[0].lower()
    index_name = f"{index}_collection"
    appNumber_list = list(map(str, df['application_number'].tolist()))
    
    total_search = []
    
    try:
        # Milvus 컬렉션 로드
        collection = Collection(name=index_name)
        collection.load()
        
        # 배치 처리
        batch_size = 1000
        
        for i in range(0, len(appNumber_list), batch_size):
            batch_apps = appNumber_list[i:i + batch_size]
            
            # Milvus 필터 표현식 생성 (IN 연산자 사용)
            if batch_apps[0].isdigit():
                app_list_str = ", ".join(batch_apps)
                filter_expression = f"address in [{app_list_str}]"
            else:
                app_list_str = ", ".join([f'"{app}"' for app in batch_apps])
                filter_expression = f"address in [{app_list_str}]"
            
            # Milvus 쿼리 실행
            results = collection.query(
                expr=filter_expression,
                output_fields=["address", "vector"]
            )
            
            # 결과를 리스트에 추가
            for result in results:
                total_search.append({
                    'application_number': str(result.get('address')),
                    'vector': result.get('vector')
                })
        
        
    except Exception as e:
        print(f"Error querying Milvus: {e}")
        return None, df
    
    # DataFrame 병합
    if total_search:
        total_search_df = pd.DataFrame(total_search).drop_duplicates(subset=['application_number'])
        df['application_number'] = df['application_number'].apply(lambda x : str(x).split('.')[0])
        total_search_df['application_number'] = total_search_df['application_number'].apply(lambda x : str(x).split('.')[0])
        df = pd.merge(df, total_search_df, on='application_number', how='inner')
        
        # 평균 벡터 계산
        if len(df) > 0 and 'vector' in df.columns:
            vectors = np.array(df['vector'].tolist())
            mean_vector = np.mean(vectors, axis=0)
            return mean_vector, df
        else:
            return None, df
    else:
        return None, df


def make_labels_simple(df: pd.DataFrame, column: str):
    """
    UMAP 라벨 생성 - label을 카테고리 문자열로 직접 사용
    """
    vc = df[column].value_counts()
    tc_dict = {title: int(vc[vc.index == title]) for title in list(df[column].unique())}
    # label을 카테고리 값으로 직접 사용
    labels = df[column].values
    category_label_mapping = None  # 불필요
    return tc_dict, labels, category_label_mapping


def make_umap_simple(embedding, labels=None, category_label_mapping=None, df=None):
    """
    UMAP 차원 축소 수행 - label이 이미 카테고리 문자열
    """
    um = UMAP(random_state=42)
    X_fit = um.fit(embedding)
    umap_result = pd.DataFrame(X_fit.embedding_, columns=['UMAP1', 'UMAP2'])
    
    if labels is not None:
        umap_result['label'] = labels
        umap_result['category'] = labels  # label과 category 동일
    
    if df is not None:
        # 기본 정보 추가
        umap_result['application_number'] = df['application_number'].values
        umap_result['collection_name'] = df['collection_name'].values
        if 'ipc_code' in df.columns:
            umap_result['ipc_code'] = df['ipc_code'].values

    
    # 각 label별 평균 위치 계산
    mean_positions = umap_result.groupby('label').agg({
        'UMAP1': 'mean',
        'UMAP2': 'mean',
        'collection_name': 'first',
        'category': 'first'
    }).reset_index()
    
    return mean_positions, umap_result.to_dict(orient='records')



def get_umap(db: Session, collection_code: Union[str, List[str]]):
    """
    UMAP vector 분포 생성
    """
    try:
        df = get_db_data(db, collection_code)
        
        if isinstance(collection_code, list):
            # 다중 컬렉션 비교 분석
            total_vector = pd.DataFrame()
            for code in collection_code:
                length = df[df['collection_code'] == code].shape[0]
                current_df = df[df['collection_code'] == code].sample(
                    frac=1, random_state=42
                ).sample(
                    n=500 if length >= 500 else length, 
                    random_state=42
                )
                
                if not current_df.empty:
                    mean_vector, getvector_df = get_vector(current_df)
                    total_vector = pd.concat([total_vector, getvector_df], ignore_index=True)
            
            vector_array = total_vector['vector'].tolist()
            
            # ✅ 수정: cpc_code 대신 collection_name으로 라벨링
            tc_dict, test1_labels, category_label_mapping = make_labels_simple(
                total_vector, 'collection_name'  # ← 컬렉션 이름으로 변경!
            )
            
            mean_positions, result = make_umap_simple(
                vector_array, 
                labels=test1_labels, 
                category_label_mapping=category_label_mapping, 
                df=total_vector
            )
        else:
            # 단일 컬렉션 분석
            individual_df = df.sample(frac=1, random_state=42).sample(
                n=1000 if df.shape[0] >= 1000 else df.shape[0], 
                random_state=42
            )
            mean_vector, total_vector = get_vector(individual_df)
            vector_array = total_vector['vector'].tolist()
            
            # ✅ 단일 컬렉션은 cpc_code로 라벨링 (기술 분야별 분포)
            tc_dict, test1_labels, category_label_mapping = make_labels_simple(
                total_vector, 'cpc_code'  # ← 단일은 그대로 유지
            )
            
            mean_positions, result = make_umap_simple(
                vector_array, 
                labels=test1_labels, 
                category_label_mapping=category_label_mapping, 
                df=total_vector
            )
        
        return mean_positions.to_dict(orient="records"), result
        
    except Exception as e:
        print(f"Error in get_umap: {e}")
        raise e


def get_collection_list(db: Session):
    """
    콜렉션 리스트 확인
    """
    query = db.query(
        distinct(CollectionInfo.collection_code),
        CollectionInfo.collection_name
    ).all()
    
    result = [
        {
            "index": idx + 1,
            "collection_code": row[0],
            "collection_name": row[1]
        }
        for idx, row in enumerate(query)
    ]
    return result
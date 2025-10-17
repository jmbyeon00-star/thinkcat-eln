from app.utils.db_connecter import db_connect
from app.utils.common import *

import json
import pandas as pd

from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from dotenv import load_dotenv

load_dotenv()
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")

class CustomDataset(Dataset):
    def __init__(self, df):
        self.df = df

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        try:
            text = self.df.iloc[idx, 0]
            label = self.df.iloc[idx, 1]
            return text, label  # Ensure text and label are paired correctly
        except Exception as e:
            print(f"Error in CustomDataset.__getitem__: {str(e)}")
            print(f"Error occurred on line {traceback.extract_tb(e.__traceback__)[-1].lineno}")
            return "", 0

def fetch_data(user_id, project_id, data_info):

    data_scope = data_info['data_scope']
    collection_names = data_info.get("collection_names", [])

    connection, cursor = db_connect()
    result = []

    try:
        if data_scope == "project":
            if not project_id:
                raise ValueError("project_id must be provided when data_scope='project'")

            where = " AND project_id=%s"
            params = (user_id, project_id)

        elif data_scope == "collection":
            if not collection_names:
                raise ValueError("collection_names must be provided when data_scope='collection'")

            placeholders = ",".join(["%s"] * len(collection_names))  # IN 절 동적 생성
            where = f" AND collection_name IN ({placeholders})"
            params = (user_id, *collection_names)
        else:
            raise ValueError("Unknown data_scope type")

        query = "SELECT title, abstract, collection_name, used FROM PROJECT_DATA_TB WHERE user_id=%s" + where
        cursor.execute(query, params)
        
        # rows = cursor.fetchall()
        # columns = [desc[0] for desc in cursor.description]
        # result = [dict(zip(columns, row)) for row in rows]

        result = cursor.fetchall()

    except Exception as e:
        print(f"DB Error: {str(e)}")
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()
    return result

def safe_encode_decode(self, x):
        try:
            return x.encode('utf-8').decode('utf-8') if isinstance(x, str) else str(x)
        except Exception as e:
            print(f"Error in safe_encode_decode: {str(e)}")
            return str(x)

# ----- 학습 데이터 가져오기 -----
def get_train_data(user_id, project_id, data_info):
    try:
        data = fetch_train_data(user_id, project_id, data_info)
        if data_info['task_type'] == 'classification':
            result = set_classification_data(data, data_info['data_scope'], data_info['source_type'])
        elif data_info['task_type'] == 'recommendation':
            result = set_recommendation_data(data, data_info)
        else:
            raise ValueError("Unknown source type")
        
        result = result[['source', 'target']]
        # result[['source', 'target']] = result[['source', 'target']].applymap(safe_encode_decode) # pandas 2.2 이전 버전
        
        result[['source', 'target']] = result[['source', 'target']].apply(lambda col: col.map(safe_encode_decode))
        # for col in ['source', 'target']:
            # result[col] = result[col].map(safe_encode_decode)

        result = result.drop_duplicates(subset=['source'], keep='first', ignore_index=True)
        result = result.dropna(subset=['source', 'target']).query("source != '' and target != ''")
        
        num_classes = result['target'].nunique()
        min_test_size = num_classes / len(result)
        df_train, df_valid = train_test_split(result, test_size=max(0.1, min_test_size), random_state=42, stratify=result['target'])
        
        encoder = LabelEncoder()
        df_train['target'] = encoder.fit_transform(df_train['target'])
        df_valid['target'] = encoder.transform(df_valid['target'])
        
        n_unique = len(encoder.classes_)
        mapping = dict(enumerate(encoder.classes_))
        with open(data_info['model_path']+"/mapping.json", 'w') as f:
            json.dump(mapping, f)
        
        datasets = {name: CustomDataset(df) for name, df in zip(['train', 'valid'], [df_train, df_valid])}
        dataloaders = {name: DataLoader(dataset, batch_size=data_info['batch_size'], shuffle=data_info['shuffle'])
                    for name, dataset in datasets.items()}
        
        lengths = {name: len(df) for name, df in zip(['train', 'valid'], [df_train, df_valid])}

    except Exception as e:
        print_error(os, sys)
        return {'error': str(e)}, 400
    
    return dataloaders, lengths

# ----- 학습 데이터 세팅 (분류) -----
def set_classification_data(data, data_scope, source_type):
    if not data:
        return None
    try:
        df = pd.DataFrame(data)
        df['source'] = df['title'] + "\n" + df['abstract']
        df.loc[
            df['collection_name'].notnull() & (df['collection_name'] != ''), 
            'target'
        ] = df['collection_name']

        if data_scope.lower() == "project" and source_type.lower()  == 'search':
            df.loc[df['used'] == 0, 'target'] = "COUNTER"
    except:
        print_error(os, sys)
    return df

# ----- 학습 데이터 세팅 (추천) -----
def set_recommendation_data(data, source_type):
    try:
        df = pd.DataFrame(data)
        df['source'] = df['title'] + "\n" + df['abstract']
        df.loc[
            df['collection_name'].notnull() & (df['collection_name'] != ''), 
            'target'
        ] = df['collection_name']

        if source_type.lower() == 'search':
            df.loc[df['used'] == 0, 'target'] = "COUNTER"
            # counter_rows = df[df['target'] == "COUNTER"]
            # sampled_counter_rows = counter_rows.sample(frac=0.1, random_state=42)
            # df = df[df['target'] != "COUNTER"]
            # df = pd.concat([df, sampled_counter_rows], ignore_index=True)
            return df


        # ----- 20251002 확인 및 수정 필요 -----
        elif source_type.lower() == 'file':
            '''
                해당 프로젝트 데이터를 모두 불러오고 해당 컬렉션을 제외한 데이터를 COUNTER로 사용(비율은 1/N)
            '''
            # df.loc[df['collection_code'] != self.data[0]['collection_code'], 'target'] = "COUNTER"
            non_target_rows = df[df['collection_name'] != self.config['collection_name']]
            non_target_rows.loc[non_target_rows['collection_name'].notnull(), 'target'] = non_target_rows['collection_name']

            target_count = len(df[df['collection_name'] == self.config['collection_name']])
            collection_names = list(non_target_rows['collection_name'].value_counts().keys())

            sampled_counter_rows = []
            for collection_name in collection_names:
                if target_count//len(collection_names) > 0:
                    sampled_collection_rows = non_target_rows[non_target_rows['collection_name'] == collection_name].sample(n=target_count//len(collection_names), random_state=42)
                else:
                    sampled_collection_rows = non_target_rows[non_target_rows['collection_name'] == collection_name].sample(n=1, random_state=42)
                sampled_collection_rows['collection_name'] = 'COUNTER'
                sampled_collection_rows['target'] = 'COUNTER'
                sampled_counter_rows.append(sampled_collection_rows)
            df_counter = pd.concat(sampled_counter_rows, ignore_index=True)

            df_final = pd.concat([df[df['collection_name'] == self.config['collection_name']], df_counter], ignore_index=True)

            return df_final
    except Exception as e:
        print("Error:", e)
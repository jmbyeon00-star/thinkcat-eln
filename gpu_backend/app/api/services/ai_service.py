from fastapi import HTTPException
import os
import json
from dotenv import load_dotenv

load_dotenv()

DEFAULT_PATH = os.getenv("DEFAULT_PATH", "/app")

def get_classification_history(config):
    default_path  = f"{DEFAULT_PATH}/app/storage/users/{config['user_id']}/models/{config['task_type']}/{config['model_id']}/inference/{config['file_id']}"
    result_path = os.path.join(default_path, f"result_{config['task_type']}.json")
    mapping_path  = f"{DEFAULT_PATH}/app/storage/users/{config['user_id']}/models/{config['task_type']}/{config['model_id']}/mapping.json"
    
    if not os.path.exists(result_path):
        return None
    
    print(f"🔍 결과 파일 경로: {result_path}")
    print(f"🔍 매핑 파일 경로: {mapping_path}")
    
    # 결과 파일 읽기
    if not os.path.exists(result_path):
        print(f"❌ 결과 파일이 존재하지 않습니다: {result_path}")
        return {"error": "결과 파일을 찾을 수 없습니다"}
    
    try:
        with open(result_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        print(f"✅ 결과 파일 로드 성공")
        print(f"   - 데이터 타입: {type(data)}")
        
        # 데이터 구조 확인 및 정규화
        if isinstance(data, dict):
            # 새로운 구조: {"results": [...], "evaluation": {...}, "mapper": {...}}
            results = data.get("results", [])
            evaluation = data.get("evaluation")
            mapper = data.get("mapper", {})
            
            print(f"   - dict 구조: results={len(results)}개")
            if results:
                print(f"   - results[0] 샘플: {results[0]}")
            
        elif isinstance(data, list):
            # 이전 구조: results_list만 있는 경우
            results = data
            evaluation = None
            mapper = {}
            
            print(f"   - list 구조: {len(results)}개")
            if results:
                print(f"   - results[0] 샘플: {results[0]}")
        else:
            print(f"❌ 예상치 못한 데이터 타입: {type(data)}")
            return {"error": f"예상치 못한 데이터 타입: {type(data)}"}
        
        # mapper가 없으면 mapping.json에서 로드
        if not mapper and os.path.exists(mapping_path):
            with open(mapping_path, "r", encoding="utf-8") as f:
                mapper = json.load(f)
            print(f"   - mapping.json에서 mapper 로드: {len(mapper)}개 클래스")
        
        # 최종 반환 데이터 구성
        response = {
            "results": results,
            "evaluation": evaluation,
            "mapper": mapper
        }
        
        print(f"✅ 응답 데이터 구성 완료")
        print(f"   - results: {len(results)}개")
        print(f"   - evaluation: {evaluation is not None}")
        print(f"   - mapper: {len(mapper)}개 클래스")
        
        return response
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON 파싱 오류: {e}")
        return {"error": f"JSON 파싱 오류: {e}"}
    except Exception as e:
        import traceback
        print(f"❌ 예외 발생:")
        print(traceback.format_exc())
        return {"error": f"내부 오류: {e}"}
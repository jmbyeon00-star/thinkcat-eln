import React, { useState, useCallback, useEffect } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Check, Package, Layers, Loader2, Info, X } from 'lucide-react';

interface GroupSummary {
    group_code: string;
    count: number;
    data: any[];
    group_name?: string;
}

interface GroupDataViewerProps {
    projectId: string | string[];
    token: string | undefined;
    onGroupsSelected: (groups: GroupSummary[]) => void;
    onCancel: () => void;
}

const GroupDataViewer: React.FC<GroupDataViewerProps> = ({ projectId, token, onGroupsSelected, onCancel }) => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

    const [groups, setGroups] = useState<GroupSummary[]>([]);
    const [totalGroups, setTotalGroups] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [limit] = useState(5); // 페이지당 5개 그룹 표시
    const [loading, setLoading] = useState(false);
    const [selectedGroupCode, setSelectedGroupCode] = useState<string | null>(null);
    const [selectedGroupData, setSelectedGroupData] = useState<any[]>([]); // 상세 데이터 상태

    // **새로운 상태:** 선택된 그룹 코드를 저장하는 Set
    const [selectedGroupCodes, setSelectedGroupCodes] = useState<Set<string>>(new Set());
    // 체크박스 핸들러
    const handleGroupToggle = (groupCode: string) => {
        const newSet = new Set(selectedGroupCodes);
        if (newSet.has(groupCode)) {
            newSet.delete(groupCode);
        } else {
            newSet.add(groupCode);
        }
        setSelectedGroupCodes(newSet);
    };

    // 확인 / 선택 완료 버튼
    const handleSelectionComplete = () => {
        const selectedGroups = groups.filter(g => selectedGroupCodes.has(g.group_code));
        onGroupsSelected(selectedGroups);
    };

    const totalPages = Math.ceil(totalGroups / limit);

    // **********************************
    // 1. API 호출: 페이지네이션된 그룹 정보 가져오기
    // **********************************
    const fetchGroups = useCallback(async (page: number) => {
        if (!projectId || !token) return;
        setLoading(true);

        try {
            // 백엔드의 get_project_data_groups 함수를 호출한다고 가정
            const response = await fetch(`${API_BASE}/api/project/${projectId}/data/groups?page=${page}&limit=${limit}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                // q 파라미터 등을 body나 URL에 추가할 수 있음
                // body: JSON.stringify({ q: '' }) 
            });

            if (!response.ok) throw new Error('그룹 데이터 로드 실패');

            const data = await response.json();

            const fetchedGroups: GroupSummary[] = Object.keys(data.project_data_groups).map(groupCode => {
                const groupInfo = data.project_data_groups[groupCode];
                // 백엔드에서 group_code와 count만 가져온다고 가정
                // 프론트에서 group_name을 group_code로 임시 설정 (백엔드에서 group_name을 따로 제공해야 함)
                return {
                    group_code: groupCode,
                    count: groupInfo.count,
                    group_name: groupCode,
                    data: groupInfo.data // 개별 레코드도 같이 받아옴
                };
            });

            // 페이지네이션된 그룹 리스트와 총 개수 업데이트
            setGroups(fetchedGroups);
            setTotalGroups(data.total_count); // total_count는 총 고유 그룹의 개수
            setCurrentPage(page);

        } catch (error) {
            console.error("그룹 목록 로드 실패:", error);
        } finally {
            setLoading(false);
        }
    }, [projectId, token, limit, API_BASE]);


    // **********************************
    // 2. 상세 데이터 조회 (모달)
    // **********************************
    const fetchGroupDetails = useCallback(async (groupCode: string) => {
        // 이미 groups 상태에 data가 있다면 (백엔드에서 한 번에 가져왔다면)
        const group = groups.find(g => g.group_code === groupCode);
        if (group && group.data) {
            setSelectedGroupCode(groupCode);
            setSelectedGroupData(group.data);
            return;
        }

        // 만약 group.data가 없다면 (백엔드에서 개수만 가져왔다면) 별도의 API 호출 필요
        // (현재는 그룹 데이터가 groups 상태에 이미 들어있다고 가정하고 처리)
    }, [groups]);


    // **********************************
    // 3. Effect 및 핸들러
    // **********************************
    useEffect(() => {
        fetchGroups(1); // 컴포넌트 마운트 시 1페이지 로드
    }, [fetchGroups]);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            fetchGroups(newPage);
        }
    };

    // 모달 닫기
    const closeDetailModal = () => {
        setSelectedGroupCode(null);
        setSelectedGroupData([]);
    };


    if (loading && groups.length === 0) {
        return (
            <div className="flex items-center justify-center p-10 bg-zinc-50 rounded-xl">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
                <span className="text-zinc-600">그룹 목록 불러오는 중...</span>
            </div>
        );
    }

    if (totalGroups === 0) {
        return (
            <div className="p-4 border border-red-200 bg-red-50 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <Info className="w-4 h-4" />
                기존 데이터 그룹이 없습니다. 새로운 데이터를 추가해주세요.
            </div>
        )
    }


    // **********************************
    // 4. 렌더링
    // **********************************
    return (
        <div className="space-y-4">
            <h4 className="text-lg font-bold text-zinc-800 flex items-center gap-2 border-b pb-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                데이터 그룹 목록 ({totalGroups}개 그룹)
            </h4>

            <div className="space-y-3">
                {groups.map((group, index) => {
                    const isSelected = selectedGroupCodes.has(group.group_code);
                    return (
                        <div key={group.group_code}
                            className={`p-4 border-2 rounded-lg flex justify-between items-center bg-white transition-all cursor-pointer ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-200 hover:border-zinc-400'}`}
                            onClick={() => handleGroupToggle(group.group_code)} // 영역 클릭 시 선택 토글
                        >
                            <div className="flex items-center flex-1">
                                {/* 체크박스 UI */}
                                <div className={`w-5 h-5 mr-3 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-400'}`}>
                                    {isSelected && <Check className="w-4 h-4 text-white" />}
                                </div>

                                <div className="flex-1">
                                    <p className="font-semibold text-zinc-900 text-base">{group.group_name || group.group_code}</p>
                                    <div className="flex items-center gap-4 text-sm mt-1 text-zinc-600">
                                        {/* ... (기존 count 표시 로직 유지) ... */}
                                        <span className="flex items-center gap-1">
                                            <Package className="w-4 h-4 text-emerald-500" />
                                            {group.count.toLocaleString()} 개 레코드
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); fetchGroupDetails(group.group_code); }} // 상세 버튼은 클릭 전파 방지
                                    className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full hover:bg-blue-200 transition"
                                >
                                    상세 데이터
                                </button>
                                {/* '이 그룹 사용' 버튼은 제거하고 체크박스 선택으로 대체 */}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 페이지네이션 컨트롤 */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 pt-4">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1 || loading}
                        className="p-2 border rounded-full disabled:opacity-50 hover:bg-zinc-100 transition"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-medium text-zinc-700">
                        페이지 {currentPage} / {totalPages}
                    </span>
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages || loading}
                        className="p-2 border rounded-full disabled:opacity-50 hover:bg-zinc-100 transition"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-zinc-200">
                <button
                    onClick={onCancel} // GroupDataViewer 닫기
                    className="px-4 py-2 bg-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-300 transition"
                >
                    취소 / 닫기
                </button>
                <button
                    onClick={handleSelectionComplete}
                    disabled={selectedGroupCodes.size === 0}
                    className="px-6 py-3 bg-emerald-500 text-white font-semibold rounded-xl shadow-md hover:bg-emerald-600 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                    선택 완료 ({selectedGroupCodes.size}개)
                    <ArrowRight size={18} />
                </button>
            </div>

            {/* 상세 데이터 모달 */}
            {/* {selectedGroupCode && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-11/12 max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b pb-3 mb-4">
                            <h3 className="text-xl font-bold">그룹 상세 데이터: {selectedGroupCode}</h3>
                            <button onClick={closeDetailModal} className="text-zinc-500 hover:text-zinc-800">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <p className='text-sm text-zinc-600 mb-3'>총 {selectedGroupData.length}개 레코드 미리보기</p>
                        <div className="space-y-2 text-sm max-h-96 overflow-y-auto border p-3 rounded-lg bg-zinc-50">
                            {selectedGroupData.slice(0, 10).map((data, index) => (
                                <div key={index} className="border-b pb-1">
                                    <pre className='text-xs whitespace-pre-wrap break-words'>
                                        {JSON.stringify(data, null, 2).substring(0, 300)}...
                                    </pre>
                                </div>
                            ))}
                            {selectedGroupData.length > 10 && (
                                <p className='text-xs text-center text-zinc-500'>... {selectedGroupData.length - 10}개 레코드 더 있음</p>
                            )}
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button onClick={closeDetailModal} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">닫기</button>
                        </div>
                    </div>
                </div>
            )} */}
            {selectedGroupCode && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-11/12 max-w-4xl max-h-[90vh] overflow-y-auto"> {/* max-w-4xl로 확장 */}
                        <div className="flex justify-between items-center border-b pb-3 mb-4">
                            <h3 className="text-xl font-bold">그룹 상세 데이터: {selectedGroupCode}</h3>
                            <button onClick={closeDetailModal} className="text-zinc-500 hover:text-zinc-800">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <p className='text-sm text-zinc-600 mb-3'>
                            총 {selectedGroupData.length.toLocaleString()}개 레코드 미리보기 (최대 10개 표시)
                        </p>

                        {/* 테이블로 데이터 표시 */}
                        <div className="max-h-[60vh] overflow-y-auto border border-zinc-200 rounded-lg shadow-inner bg-zinc-50">

                            {/* 1. 데이터가 있을 경우에만 표 렌더링 */}
                            {selectedGroupData.length > 0 && (
                                <div className="overflow-x-auto"> {/* 테이블이 길 경우 가로 스크롤 가능하게 처리 */}
                                    <table className="min-w-full divide-y divide-zinc-200 text-sm">
                                        <thead className="bg-zinc-100 sticky top-0 z-10">
                                            <tr>
                                                {/* 첫 번째 데이터 객체의 키를 컬럼 헤더로 사용 */}
                                                {Object.keys(selectedGroupData[0]).map((key) => (
                                                    <th
                                                        key={key}
                                                        scope="col"
                                                        className="px-6 py-3 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider whitespace-nowrap"
                                                    >
                                                        {key}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-zinc-100">
                                            {/* 데이터는 최대 10개만 미리보기 */}
                                            {selectedGroupData.slice(0, 10).map((item, rowIndex) => (
                                                <tr key={rowIndex} className="hover:bg-blue-50/50 transition">
                                                    {Object.keys(item).map((key) => (
                                                        <td
                                                            key={key}
                                                            className="px-6 py-4 whitespace-nowrap text-zinc-800 max-w-xs overflow-hidden text-ellipsis"
                                                            title={String(item[key])} // 마우스를 올리면 전체 텍스트 표시
                                                        >
                                                            {/* 객체나 배열일 경우 [Object] 또는 [Array]로 표시 */}
                                                            {typeof item[key] === 'object' && item[key] !== null
                                                                ? (Array.isArray(item[key]) ? '[배열]' : '[객체]')
                                                                : String(item[key]).substring(0, 50) // 문자열은 50자까지만 표시
                                                            }
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* 데이터가 10개를 초과할 경우 안내 메시지 */}
                            {selectedGroupData.length > 10 && (
                                <p className='text-sm text-center text-zinc-500 py-3 bg-zinc-100 border-t border-zinc-200'>
                                    ... {selectedGroupData.length - 10}개 레코드 더 있음. 전체 데이터는 다운로드 또는 학습을 통해 확인하세요.
                                </p>
                            )}
                        </div>

                        <div className="mt-4 flex justify-end">
                            <button onClick={closeDetailModal} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">닫기</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupDataViewer;
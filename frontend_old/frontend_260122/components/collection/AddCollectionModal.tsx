// components/AddCollectionModal.tsx (수정)
import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react'; // Loader2 import 필요

interface AddCollectionModalProps {
    project_id: string;
    onSave: (collectionName: string) => Promise<void>;
    onClose: () => void;
}

const AddCollectionModal: React.FC<AddCollectionModalProps> = ({ onClose, onSave }) => {
    const [collectionName, setCollectionName] = useState('');
    // const [category, setCategory]
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!collectionName.trim()) {
            alert('컬렉션 이름을 입력해주세요.');
            return;
        }

        setIsSaving(true);
        // onSave 호출 시 collectionName만 전달
        await onSave(collectionName.trim());
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h3 className="text-xl font-bold text-zinc-800">새 컬렉션 추가</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-800">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-6"> {/* mb-4에서 mb-6으로 변경하여 공간 확보 */}
                        <label htmlFor="name" className="block text-sm font-medium text-zinc-700 mb-1">
                            컬렉션 이름 *
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={collectionName}
                            onChange={(e) => setCollectionName(e.target.value)}
                            className="w-full p-2 border border-zinc-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            placeholder="예: V1_New_Data"
                            required
                        />
                    </div>

                    {/* 카테고리 입력 필드 제거 */}
                    {/* <div className="mb-6"> ... </div> */}

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-zinc-300 rounded-lg text-zinc-700 hover:bg-zinc-50 transition"
                            disabled={isSaving}
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-blue-400 flex items-center gap-2"
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" /> 저장 중...
                                </>
                            ) : (
                                '컬렉션 생성'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddCollectionModal;
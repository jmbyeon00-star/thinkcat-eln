// /home/yckim/development/ipforce_next/frontend/components/Chat/Sidebar.tsx
import React, { useEffect, useState } from 'react';
import { useSession } from "next-auth/react";
import { Session } from "next-auth";

import { Plus, User } from 'lucide-react';
import { SidebarProps, Message, ChatInfo } from '@/types/chat';

const Sidebar: React.FC<SidebarProps> = ({ startNewChat, loadChat, currentChatId }) => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
    const { data: session, status } = useSession() as {
        data: (Session & { access_token?: string }) | null;
        status: "loading" | "authenticated" | "unauthenticated";
    };
    const token = session?.access_token;
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [chatList, setChatList] = useState<ChatInfo[]>([]);
    // const [chatData, setChatData] = useState<Message[]>([]);

    // 타입에 맞는 mock data 사용
    const mockChatList: ChatInfo[] = [
        { chat_id: 'chat-1', title: 'Elasticsearch 재고 검색' },
        { chat_id: 'chat-2', title: '최신 스마트폰 동향 문의' },
    ];

    useEffect(() => {
        if (!token) return;

        async function handleLoadChats() {
            try {
                const res = await fetch(`${API_BASE}/api/chat/list`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data: ChatInfo[] = await res.json();
                setChatList(data);
                if (!res.ok) throw new Error("Layout 데이터 불러오기 실패");
            } catch (e) {
                console.error("Layout Fetch Error:", e);
            } finally {
                setIsLoading(false);
            }
        }
        handleLoadChats();

    }, [token]);

    // const handleLoadChat = (chatId: string): void => {
    async function loadChatHistory(chatId: string) {
        try {
            const res = await fetch(`${API_BASE}/api/chat/${chatId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Layout 데이터 불러오기 실패");
            const history: Message[] = await res.json();
            // console.log("history:", typeof history, history)
            loadChat(chatId, history);
        } catch (e) {
            console.error("Layout Fetch Error:", e);
        } finally {
            setIsLoading(false);
        }

        //         const mockHistory: Message[] = [
        //             { role: 'user', content: '과거 질문입니다.' },
        //             { role: 'assistant', content: '과거 답변입니다.' },

        //             // 1. 유저 채팅
        //             {
        //                 role: "user",
        //                 content: "MarkDown 테이블과 코드를 보여줘.",
        //             },

        //             // 2. AI 응답 (MarkDown 테이블 및 코드 블록 포함)
        //             {
        //                 role: "assistant",
        //                 content: `## 주요 데이터 요약
        // | 분류 | 값 | 단위 |
        // |---|---|---|
        // | 항목 A | 1024 | 건 |
        // | 항목 B | 42 | 개 |

        // ### 코드 예시
        // 파이썬으로 데이터 처리하는 코드입니다:
        // \`\`\`python
        // def process_data(data):
        //     return data * 2
        // \`\`\`
        // `,
        //             },

        //             {
        //                 role: "user",
        //                 content: "(json-stable-stringify 사용) AI Tool Call (JSON 객체) 테스트"
        //             },
        //             // 3. AI Tool Call (JSON 객체)
        //             {
        //                 role: "assistant",
        //                 // content가 string이 아닌 'object' ChatArea.tsx의 <pre> 태그로 렌더링
        //                 content: {
        //                     tool: "patents_search",
        //                     status: "SUCCESS",
        //                     result: "Tool executed successfully with 5 results.",
        //                 },
        //             },


        //         ];
        //         loadChat(chatId, mockHistory);

    };

    return (
        // ... (JSX 코드는 동일)
        <div className="w-64 bg-white border-r flex flex-col p-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-blue-600">IPForce Chat</h1>
                <User size={20} className="text-gray-500" />
            </div>

            {/* 새 채팅 시작 버튼 */}
            <button
                onClick={startNewChat}
                className={`flex items-center justify-center p-3 mb-4 text-sm font-semibold rounded-lg transition duration-150 shadow-md ${currentChatId === null ? 'bg-blue-700 text-white' : 'bg-gray-100 text-blue-600 hover:bg-gray-200'
                    }`}
            >
                <Plus size={16} className="mr-2" />
                새 채팅 시작
            </button>

            {/* 채팅 목록 */}
            <div className="flex-grow overflow-y-auto">
                <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2">최근 대화</h2>
                {chatList.map(chat => (
                    <div
                        key={chat.chat_id}
                        onClick={() => loadChatHistory(chat.chat_id)}
                        className={`p-3 text-sm rounded-lg cursor-pointer truncate ${chat.chat_id === currentChatId ? 'bg-blue-100 text-blue-800 font-medium' : 'hover:bg-gray-100'}`}
                        title={chat.title}
                    >
                        {chat.title}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Sidebar;
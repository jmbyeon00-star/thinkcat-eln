// /home/yckim/development/ipforce_next/frontend/pages/chat/index.tsx
import React, { useState } from 'react';
import { useSession } from "next-auth/react";
import { Session } from "next-auth";

import Sidebar from '@/components/chat/Sidebar';
import ChatArea from '@/components/chat/ChatArea';
import { Message } from '@/types/chat';

import { withMessages } from '@/lib/i18n/withMessages';
export const getServerSideProps = withMessages();

// 가상 사용자 ID
const MOCK_USER_ID: string = "user-abc-123";

const ChatPage = () => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
    const { data: session, status } = useSession() as {
        data: (Session & { access_token?: string }) | null;
        status: "loading" | "authenticated" | "unauthenticated";
    };
    const token = session?.access_token;

    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]); // 타입 지정
    // const [chatList, setChatList] = useState<ChatInfo[]>([]); // 타입 지정
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const sendMessage = async (query: string): Promise<void> => {
        if (!query.trim() || isLoading) return;

        let chatIdToUse = currentChatId;
        // if (!chatIdToUse) {
        //     chatIdToUse = 'temp-' + Date.now().toString(); // 임시 ID는 string으로
        // }

        const newUserMessage: Message = { role: 'user', content: query };
        setMessages(prev => [...prev, newUserMessage]);
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE}/api/chat/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    user_id: MOCK_USER_ID,
                    chat_id: chatIdToUse,
                    query: query
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            // const data = await response.json() as { chat_id: string, response: string, summary: string, mcp_response: [] }; // 백엔드 응답 타입 단언
            const data = await response.json()
            console.log("chat now:", data)

            // const assistantMessage: Message = { role: 'assistant', content: data.response || "응답 오류." };
            const assistantMessage: Message = data.response || "응답 오류"
            setMessages(prev => [...prev, assistantMessage]);

            // 백엔드에서 확정된 새로운 chat_id 업데이트
            if (data.chat_id) {
                setCurrentChatId(data.chat_id);
            }

        } catch (error: any) {
            console.error("전송 오류:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: `[오류] 전송 실패: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const startNewChat = (): void => {
        setCurrentChatId(null);
        setMessages([]);
    };

    const loadChat = (chatId: string, history: Message[]): void => {
        setCurrentChatId(chatId);
        setMessages(history);
    };

    return (
        <div className="flex h-screen bg-gray-50 text-gray-800">
            <Sidebar
                // chatList={chatList}
                startNewChat={startNewChat}
                loadChat={loadChat}
                currentChatId={currentChatId}
            />
            <ChatArea
                messages={messages}
                sendMessage={sendMessage}
                isLoading={isLoading}
                currentChatId={currentChatId}
            />
        </div>
    );
};

export default ChatPage;
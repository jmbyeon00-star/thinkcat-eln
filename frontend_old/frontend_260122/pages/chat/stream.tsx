// /home/yckim/development/ipforce_next/frontend/pages/chat/index.tsx
import React, { useState, useRef } from 'react';
import { useSession } from "next-auth/react";
import { Session } from "next-auth";

import Sidebar from '@/components/chat/Sidebar';
import ChatArea from '@/components/chat/ChatArea';
import { Message } from '@/types/chat';

import { withMessages } from '@/lib/i18n/withMessages';
export const getServerSideProps = withMessages();

const ChatStreamPage = () => {
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

    const abortControllerRef = useRef<AbortController | null>(null);
    const sendMessage = async (query: string): Promise<void> => {
        if (!query.trim() || isLoading) return;

        // 🔥 기존 스트림 중단
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);

        const userMessage: Message = { role: "user", content: query };
        setMessages(prev => [...prev, userMessage]);

        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

        try {
            const response = await fetch(
                `${API_BASE}/api/chat/stream?chat_id=${currentChatId ?? ""}&query=${encodeURIComponent(query)}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.body) throw new Error("스트림 응답이 없습니다.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");

            let buffer = "";
            let assistantText = "";
            let assistantIndex: number | null = null;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                // buffer += decoder.decode(value, { stream: true })

                // const events = buffer.split("\n\n");
                // buffer = events.pop() ?? "";

                // for (const event of events) {
                //     const lines = event.split("\n");

                //     let eventType = "message";
                //     let dataLines: string[] = [];

                //     for (const line of lines) {
                //         if (line.startsWith("event:")) {
                //             eventType = line.replace("event:", "").trim();
                //         }
                //         if (line.startsWith("data:")) {
                //             dataLines.push(line.replace("data:", "").trim());
                //         }
                //     }

                //     const data = dataLines.join("");

                //     if (!data) continue;

                //     if (eventType === "done" || data === "[DONE]") {
                //         setIsLoading(false);
                //         return;
                //     }

                //     // 일반 메시지
                //     assistantText += data;

                //     setMessages(prev => {
                //         const updated = [...prev];
                //         if (assistantIndex === null) {
                //             assistantIndex = updated.length;
                //             updated.push({ role: "assistant", content: assistantText });
                //         } else {
                //             updated[assistantIndex] = {
                //                 role: "assistant",
                //                 content: assistantText,
                //             };
                //         }
                //         return updated;
                //     });
                // }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n");

                for (const line of lines) {
                    if (!line.startsWith("data:")) continue;

                    const data = line.replace("data:", "").trim();
                    if (!data || data === "[DONE]") continue;

                    assistantText += data;

                    setMessages(prev => {
                        const updated = [...prev];

                        if (assistantIndex === null) {
                            assistantIndex = updated.length;
                            updated.push({ role: "assistant", content: assistantText });
                        } else {
                            updated[assistantIndex] = {
                                role: "assistant",
                                content: assistantText,
                            };
                        }

                        return updated;
                    });
                }
            }
        } catch (err: any) {
            if (err.name === "AbortError") {
                console.log("🔕 Stream aborted");
            } else {
                console.error("Stream error:", err);
            }
        } finally {
            // 🔥 반드시 정리
            if (reader) {
                try { await reader.cancel(); } catch { }
            }
            abortControllerRef.current = null;
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

export default ChatStreamPage;
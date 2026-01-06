// /home/yckim/development/ipforce_next/frontend/components/Chat/ChatArea.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader } from 'lucide-react';
import { ChatAreaProps, Message } from '@/types/chat';

// MarkDown 렌더러 import
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
// 타입스크립트용 JSON (순서 안정성)
import json from 'json-stable-stringify'; // JSON.stringify 대신 사용 가능

const ChatArea: React.FC<ChatAreaProps> = ({ messages, sendMessage, isLoading, currentChatId }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const [input, setInput] = useState<string>(''); // 타입 지정
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const handleSubmit = (e: React.FormEvent) => { // 이벤트 타입 지정
        e.preventDefault();
        if (input.trim() && !isLoading) {
            sendMessage(input);
            setInput('');

            setTimeout(() => {
                inputRef.current?.focus();
            }, 0);
        }
    };
    useEffect(() => {
        if (currentChatId && !isLoading) {
            inputRef.current?.focus();
        }
    }, [currentChatId, isLoading]);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const renderMessage = (msg: Message, index: number) => { // 메시지 타입 지정
        const isUser = msg.role === 'user';

        const MessageContent = () => {
            // 1. content가 딕셔너리 객체일 경우 (Tool Call 원본 결과 등)
            if (typeof msg.content === 'object' && msg.content !== null) {
                return (
                    // 안전하게 JSON.stringify를 사용하여 코드 블록으로 표시
                    <pre className="mt-2 p-2 bg-gray-50 border rounded-lg text-sm overflow-x-auto">
                        {/* {JSON.stringify(msg.content, null, 2)} */}
                        {/* 더 안정적인 JSON 처리를 위해 json-stable-stringify 사용 가능 */}
                        {json(msg.content, { space: 2 })}

                        {/* ⭐️ 수정: JSON.stringify를 사용하여 오류 없이 처리 ⭐️ */}
                        {/* {JSON.stringify(msg.content, null, 2)} */}
                    </pre>
                );
            }

            // 2. AI 답변 MarkDown 렌더링
            if (!isUser) {
                return (
                    <div className="prose max-w-none prose-sm">
                        <ReactMarkdown
                            rehypePlugins={[rehypeRaw]} // rehypeRaw가 꼭 있어야 표가 렌더링됩니다.
                            remarkPlugins={[remarkGfm]}
                        >
                            {msg.content as string}
                        </ReactMarkdown>
                    </div>
                );
            }

            // 사용자 메시지는 <p> 태그와 whitespace-pre-wrap을 사용하여 줄바꿈을 유지합니다.
            if (isUser) {
                return <p className="whitespace-pre-wrap">{msg.content}</p>;
            }

            // 4. 나머지 (AI MarkDown 렌더링이 실패했을 경우)
            return <>{msg.content}</>;
        };

        return (
            <div
                key={index}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
            >
                <div
                    className={`max-w-3xl p-3 rounded-xl shadow-sm ${isUser
                        ? 'bg-blue-500 text-white rounded-br-none'
                        : 'bg-white border text-gray-800 rounded-tl-none'
                        }`}
                >
                    <strong className="text-xs opacity-70 mb-1 block">
                        {isUser ? 'You' : 'IPForce AI'}
                    </strong>
                    {/* content가 문자열이 아닐 경우 JSON.stringify를 사용하여 안전하게 표시 */}
                    {/* {typeof msg.content === 'object' ? JSON.stringify(msg.content, null, 2) : msg.content} */}
                    <MessageContent />
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col flex-1">
            <header className="p-4 border-b bg-white shadow-sm flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-700">
                    {currentChatId ? `세션 ID: ${currentChatId.substring(0, 8)}...` : '새로운 대화 시작'}
                </h2>
            </header>

            {/* 메시지 표시 영역 */}
            <main className="flex-1 overflow-y-auto p-6 bg-gray-100">
                <div className="max-w-4xl mx-auto">
                    {messages.map(renderMessage)}
                    {/* 로딩 인디케이터 */}
                    {isLoading && (
                        <div className="flex justify-start mb-4">
                            <div className="p-3 rounded-xl bg-white border text-gray-600 rounded-tl-none">
                                <Loader size={18} className="animate-spin mr-2 inline-block" />
                                {/* AI가 답변을 생성하고 있습니다... */}
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </main>

            {/* 입력 영역 */}
            <footer className="p-4 border-t bg-white">
                <div className="max-w-4xl mx-auto">
                    <form onSubmit={handleSubmit} className="flex space-x-3">
                        <input
                            type="text"
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="여기에 메시지를 입력하세요..."
                            disabled={isLoading}
                            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150 disabled:bg-gray-400"
                        >
                            <Send size={20} />
                        </button>
                    </form>
                </div>
            </footer>
        </div>
    );
};

export default ChatArea;
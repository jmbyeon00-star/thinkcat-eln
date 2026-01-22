// types/chat.ts (또는 각 컴포넌트 파일 상단에 정의)

// 백엔드(FastAPI)와 통신하는 메시지 역할
type MessageRole = 'user' | 'assistant' | 'tool' | 'system';

export interface Message {
    role: MessageRole;
    content: string; // Tool 응답 등 복잡한 content는 JSON.stringify된 문자열로 간주
}

export interface ChatInfo {
    chat_id: string;
    title: string;
}

export interface ChatAreaProps {
    messages: Message[];
    sendMessage: (query: string) => Promise<void>;
    isLoading: boolean;
    currentChatId: string | null;
}

export interface SidebarProps {
    // chatList: ChatInfo[];
    startNewChat: () => void;
    loadChat: (chatId: string, history: Message[]) => void;
    currentChatId: string | null;
}
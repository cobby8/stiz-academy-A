/**
 * ChatMessage — 개별 메시지 말풍선 컴포넌트
 *
 * 사용자 메시지는 오른쪽(파란색), 봇 메시지는 왼쪽(회색)에 표시된다.
 * 레고 블록 1개처럼, ChatPanel에서 여러 개를 쌓아서 대화를 만든다.
 */
"use client";

interface ChatMessageProps {
  role: "user" | "model"; // user: 학부모, model: 챗봇
  content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
  // 사용자 메시지: 오른쪽 정렬, 파란 배경
  // 봇 메시지: 왼쪽 정렬, 회색 배경
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`
          max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${
            isUser
              ? "bg-blue-500 text-white rounded-br-md" // 사용자: 파란색, 우하단 모서리 각짐
              : "bg-gray-100 text-gray-800 rounded-bl-md" // 봇: 회색, 좌하단 모서리 각짐
          }
        `}
      >
        {/* 줄바꿈을 유지하기 위해 whitespace-pre-wrap 적용 */}
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

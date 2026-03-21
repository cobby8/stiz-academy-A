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
  actions?: Array<{ label: string; url: string }>; // 체험수업/수강신청 이동 버튼
}

export default function ChatMessage({ role, content, actions }: ChatMessageProps) {
  // 사용자 메시지: 오른쪽 정렬, 파란 배경
  // 봇 메시지: 왼쪽 정렬, 회색 배경
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div className="max-w-[80%]">
        <div
          className={`
            rounded-2xl px-4 py-3 text-sm leading-relaxed
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

        {/* 액션 버튼 영역: 봇 메시지이고 actions가 있을 때만 표시 */}
        {!isUser && actions && actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {actions.map((action, i) => (
              <a
                key={i}
                href={action.url}
                className="inline-block px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-full hover:bg-orange-600 transition-colors"
              >
                {action.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

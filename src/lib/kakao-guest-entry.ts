/** 공개 안내만 반환한다. 학생 조회·접수·인증 레코드 생성은 하지 않는다. */
export function kakaoGuestEntry(utterance: string, origin: string) {
  const text = utterance.replace(/\s+/g, " ").trim();
  if (/^(기존 수강생 인증|학부모 인증하기|인증|계정 연결)$/.test(text)) return null;
  const base = origin.replace(/\/+$/, "");
  const isTrial = /체험/.test(text);
  const isEnroll = /신규|입학|수강\s*신청|등록\s*문의/.test(text);
  const isConsultation = /상담|문의/.test(text);
  const buttons = isTrial
    ? [{ action:"webLink", label:"체험수업 신청", webLinkUrl:`${base}/apply/trial` }]
    : isEnroll
      ? [{ action:"webLink", label:"수강 신청", webLinkUrl:`${base}/apply/enroll` }]
      : isConsultation
        ? [{ action:"webLink", label:"상담·신청 안내", webLinkUrl:`${base}/apply` }]
        : [
          { action:"webLink", label:"체험수업 신청", webLinkUrl:`${base}/apply/trial` },
          { action:"webLink", label:"수강 신청", webLinkUrl:`${base}/apply/enroll` },
          { action:"webLink", label:"상담·신청 안내", webLinkUrl:`${base}/apply` },
        ];
  return {
    version:"2.0",
    template:{
      outputs:[{ basicCard:{
        description:"안녕하세요~ 스티즈농구교실 다산2호점입니다. 처음 방문하셨다면 인증 없이 체험·수강 신청과 상담 안내를 확인하실 수 있어요.\n\n상담 안내 페이지의 전화 문의를 이용해 주세요. 이 메뉴만으로 상담이 접수되지는 않습니다.\n\n이미 다니는 자녀의 결석·셔틀·청구 요청은 ‘기존 수강생 인증’을 먼저 눌러주세요.",
        buttons,
      } }],
      quickReplies:["체험 문의","수강 신청","상담 안내","기존 수강생 인증"].map(label => ({ action:"message", label, messageText:label })),
    },
  };
}

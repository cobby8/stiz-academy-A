# POS 결제 알림용 비밀값 3개를 Vercel(운영)에 안전하게 넣는다.
#
# 왜 이 스크립트가 필요한가 (2026-09-30 실제 사고)
#   "값을 복사 → 명령어를 복사해 붙여넣기" 순서로 하면, 명령어를 복사하는 순간 클립보드의
#   값이 명령어 글자로 덮어써진다. 그래서 세 값 모두 토큰 대신 명령어 글자가 저장됐고,
#   슬랙 발송은 invalid_auth, 토스 결제 알림은 서명 불일치로 전부 거부될 상태였다.
#   또 PowerShell 의 `값 | 명령` 은 끝에 줄바꿈(\r\n)을 붙여 저장한다.
#
# 그래서 이 스크립트는
#   1) 먼저 실행해 두고, 그 다음에 값을 복사해 붙여넣는다(클립보드 덮어쓰기 불가).
#   2) 값의 형식을 확인해서 틀리면 그 자리에서 다시 받는다.
#   3) 입력은 **** 로 가려지고, 화면·로그 어디에도 값을 출력하지 않는다.
#   4) 줄바꿈 없이 정확히 그 값만 저장한다.
#
# 사용법: 저장소 폴더에서  powershell -ExecutionPolicy Bypass -File scripts/set-pos-secrets.ps1

$ErrorActionPreference = "Stop"

function Read-Secret {
    param([string]$Label, [string]$Where, [scriptblock]$IsValid, [string]$Hint)
    Write-Host ""
    Write-Host "▶ $Label" -ForegroundColor Cyan
    Write-Host "  어디서: $Where"
    while ($true) {
        $secure = Read-Host "  붙여넣기(화면에는 **** 로 보입니다)" -AsSecureString
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
        $plain = $plain.Trim()
        if ($plain -match 'Get-Clipboard|vercel env|npx ') {
            Write-Host "  ✗ 명령어 글자가 들어왔습니다. 값을 다시 복사해서 붙여넣어 주세요." -ForegroundColor Yellow
            continue
        }
        if (& $IsValid $plain) { Write-Host "  ✓ 형식 확인" -ForegroundColor Green; return $plain }
        Write-Host "  ✗ 형식이 맞지 않습니다. $Hint" -ForegroundColor Yellow
    }
}

function Set-VercelSecret {
    param([string]$Name, [string]$Value)
    # 이전(잘못된) 값을 지우고 새로 넣는다. 없으면 지우기 단계는 조용히 넘어간다.
    & npx vercel env rm $Name production -y 2>$null | Out-Null
    # 줄바꿈 없이 파일에 쓰고 그 파일을 입력으로 넘긴다 — 파이프(|)는 끝에 \r\n 을 붙인다.
    $tmp = [IO.Path]::GetTempFileName()
    try {
        [IO.File]::WriteAllText($tmp, $Value)
        cmd /c "npx vercel env add $Name production < `"$tmp`"" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "$Name 저장에 실패했습니다." }
        Write-Host "  → Vercel 에 저장했습니다: $Name" -ForegroundColor Green
    } finally {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "POS 결제 알림 비밀값 3개를 넣습니다. 값은 화면에 표시되지 않습니다." -ForegroundColor White

$bot = Read-Secret -Label "① 슬랙 봇 토큰 (Bot User OAuth Token)" `
    -Where "크롬 슬랙 탭 → 왼쪽 'OAuth & Permissions' → Bot User OAuth Token 의 [Copy]" `
    -IsValid { param($v) $v -match '^xoxb-[0-9A-Za-z-]{20,}$' } `
    -Hint "슬랙 봇 토큰은 'xoxb-' 로 시작합니다."

$sign = Read-Secret -Label "② 슬랙 서명 비밀키 (Signing Secret)" `
    -Where "크롬 슬랙 탭 → 왼쪽 'Basic Information' → Signing Secret 의 [Show] 후 복사" `
    -IsValid { param($v) $v -match '^[0-9a-f]{32}$' } `
    -Hint "서명 비밀키는 영문 소문자·숫자 32자리입니다."

$toss = Read-Secret -Label "③ 토스 웹훅 서명 비밀키" `
    -Where "크롬 토스 개발자센터 탭 → 방금 만든 웹훅 창의 [복사]" `
    -IsValid { param($v) ($v -notmatch '\s') -and $v.Length -ge 16 } `
    -Hint "공백 없는 16자 이상의 값이어야 합니다."

Write-Host ""
Write-Host "Vercel 에 저장하는 중..." -ForegroundColor White
Set-VercelSecret -Name "SLACK_BOT_TOKEN" -Value $bot
Set-VercelSecret -Name "SLACK_SIGNING_SECRET" -Value $sign
Set-VercelSecret -Name "TOSS_PLACE_WEBHOOK_SECRET" -Value $toss

$bot = $null; $sign = $null; $toss = $null
Write-Host ""
Write-Host "완료했습니다. Claude 에게 '넣었어' 라고 알려주세요." -ForegroundColor Green

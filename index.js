const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

// 1. 환경변수 로드 및 확인 (디버깅용 로그 포함)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const resendKey = process.env.RESEND_KEY;

console.log("--- [시스템 시작] 환경변수 체크 ---");
console.log("SUPABASE_URL 존재 여부:", !!supabaseUrl);
console.log("SUPABASE_KEY 존재 여부:", !!supabaseKey);
console.log("RESEND_KEY 존재 여부:", !!resendKey);

if (!supabaseUrl || !supabaseKey || !resendKey) {
  console.error("❌ 필수 환경변수(URL, KEY, RESEND) 중 누락된 값이 있습니다. 설정을 확인하세요.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const resend = new Resend(resendKey);

// 2. 이메일 그룹 설정
const groupList = {
  "관리": ["1924518@hyundaigreenfood.com", "2245770@hyundaigreenfood.com", "wowns508@hyundaigreenfood.com", "2511718@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "세무": ["jay556@hyundaigreenfood.com", "shindongwon@hyundaigreenfood.com", "raebin0511@hyundaigreenfood.com", "wldb7007@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "결산": ["1101603@hyundaigreenfood.com", "1519732@hyundaigreenfood.com", "yousc91@hyundaigreenfood.com", "tjddnd97@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"]
};
const retoolLink = "https://tjddnd97.retool.com/embedded/public/2ffe3b2d-4793-4cdb-8690-b174710c993f";

// 3. 메일 발송 로직
async function runBot() {
  console.log("⏰ 알림 작업을 시작합니다.");

  const getSeoulDateStr = (offsetDays = 0) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + offsetDays);
    return dt.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  };

  const todayStr = getSeoulDateStr(0);
  const d1Str = getSeoulDateStr(1);
  const d5Str = getSeoulDateStr(5);

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .in('due_date', [todayStr, d1Str, d5Str])
    .eq('is_sent', false);

  if (error) throw error;
  if (!tasks || tasks.length === 0) {
    console.log("⚠️ 오늘 발송할 일정이 없습니다.");
    return;
  }

  for (const task of tasks) {
    if (task.task_name === '로봇 생존신고') continue;

    let targetEmails = [];
    const managerInfo = task.manager_email ? task.manager_email.trim() : "";
    
    if (groupList[managerInfo]) {
      targetEmails = groupList[managerInfo];
    } else if (managerInfo.includes('@')) {
      targetEmails = managerInfo.split(',').map(e => e.trim());
    } else {
      console.log(`알 수 없는 담당자: ${managerInfo}`);
      continue;
    }

    const dDayText = task.due_date === todayStr ? "D-Day" : (task.due_date === d1Str ? "D-1" : "D-5");
    
    await resend.emails.send({
      from: '재무알림봇 <noreply@hgfnoreply.com>',
      to: targetEmails,
      subject: `[업무 알림 - ${dDayText}] ${task.task_name}`,
      html: `<div style="font-family: sans-serif;">
              <p>업무명: ${task.task_name}</p>
              <p>마감일: ${task.due_date}</p>
              <p><a href="${retoolLink}">캘린더 확인하기</a></p>
             </div>`
    });

    if (task.due_date === todayStr) {
      await supabase.from('tasks').update({ is_sent: true }).eq('id', task.id);
    }
  }
  console.log("✅ 모든 작업 완료");
}

runBot().catch(err => { console.error("❌ 치명적 에러:", err); process.exit(1); });

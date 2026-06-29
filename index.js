const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

// 환경변수 확인
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY || !process.env.RESEND_KEY) {
  console.error("❌ 필수 환경변수가 누락되었습니다.");
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resend = new Resend(process.env.RESEND_KEY);

const groupList = {
  "관리": ["1924518@hyundaigreenfood.com", "2245770@hyundaigreenfood.com", "wowns508@hyundaigreenfood.com", "2511718@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "세무": ["jay556@hyundaigreenfood.com", "shindongwon@hyundaigreenfood.com", "raebin0511@hyundaigreenfood.com", "wldb7007@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "결산": ["1101603@hyundaigreenfood.com", "1519732@hyundaigreenfood.com", "yousc91@hyundaigreenfood.com", "tjddnd97@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"]
};

const retoolLink = "https://tjddnd97.retool.com/embedded/public/2ffe3b2d-4793-4cdb-8690-b174710c993f";

async function runBot() {
  console.log("🚀 알림 봇 실행 시작");

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
    const managerInfo = task.manager_email.trim();
    if (groupList[managerInfo]) targetEmails = groupList[managerInfo];
    else if (managerInfo.includes('@')) targetEmails = managerInfo.split(',').map(e => e.trim());
    else continue;

    const dDayText = task.due_date === todayStr ? "D-Day" : (task.due_date === d1Str ? "D-1" : "D-5");
    const highlightText = task.due_date === todayStr ? "오늘 마감!!!" : (task.due_date === d1Str ? "내일 마감" : "5일 후 마감");

    await resend.emails.send({
      from: '재무알림봇 <noreply@hgfnoreply.com>',
      to: targetEmails,
      subject: `[업무 알림 - ${dDayText}] ${task.task_name}`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.6;">
          <p>📌 <b>[업무 상세 내용]</b></p>
          <ul>
            <li><b>업무명:</b> ${task.task_name}</li>
            <li><b>마감일:</b> ${task.due_date} <span style="color: red;">(${highlightText})</span></li>
            <li><b>담당부서:</b> ${managerInfo}</li>
          </ul>
          <p>🔗 <a href="${retoolLink}">캘린더 확인하기</a></p>
        </div>`
    });

    if (task.due_date === todayStr) {
      await supabase.from('tasks').update({ is_sent: true }).eq('id', task.id);
    }
  }
  console.log("✅ 작업 완료");
}

runBot().catch(err => { console.error(err); process.exit(1); });

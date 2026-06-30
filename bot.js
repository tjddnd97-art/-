const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resend = new Resend(process.env.RESEND_KEY);

const groupList = {
  "관리": ["1924518@hyundaigreenfood.com", "2245770@hyundaigreenfood.com", "wowns508@hyundaigreenfood.com", "2511718@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "세무": ["jay556@hyundaigreenfood.com", "shindongwon@hyundaigreenfood.com", "raebin0511@hyundaigreenfood.com", "wldb7007@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "결산": ["1101603@hyundaigreenfood.com", "1519732@hyundaigreenfood.com", "yousc91@hyundaigreenfood.com", "tjddnd97@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"]
};

async function runBot() {
  // 한국 시간 기준 날짜 계산
  const getSeoulDateStr = (offsetDays = 0) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + offsetDays);
    return dt.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  };

  const todayStr = getSeoulDateStr(0);  // D-Day (당일)
  const d1Str = getSeoulDateStr(1);     // D-1 (내일이 마감인 업무)
  const d5Str = getSeoulDateStr(5);     // D-5 (5일 뒤가 마감인 업무)

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .in('due_date', [todayStr, d1Str, d5Str]) // 이 3가지 날짜에 해당하는 업무만 가져옴
    .eq('is_sent', false);

  if (error) throw error;
  if (!tasks || tasks.length === 0) return console.log("오늘 발송할 알림이 없습니다.");

  for (const task of tasks) {
    let targetEmails = groupList[task.manager_email?.trim()] || task.manager_email?.split(',').map(e => e.trim());
    if (!targetEmails) continue;

    // 제목에 D-Day 표시하기
    let dDayText = "";
    if (task.due_date === todayStr) dDayText = "D-Day (오늘 마감)";
    else if (task.due_date === d1Str) dDayText = "D-1 (내일 마감)";
    else if (task.due_date === d5Str) dDayText = "D-5 (마감 5일 전)";

    await resend.emails.send({
      from: '재무알림시스템 <onboarding@resend.dev>',
      to: targetEmails,
      subject: `[업무 알림] ${dDayText} - ${task.task_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; border: 1px solid #ccc; padding: 20px;">
          <h3>${task.task_name} 업무 마감 안내</h3>
          <p>본 메일은 재무회계팀 업무 자동 알림 시스템에서 발송되었습니다.</p>
          <p>현재 <b>${task.due_date}</b> 마감 예정인 업무입니다.</p>
          <p><a href="https://tjddnd97.retool.com/embedded/public/2ffe3b2d-4793-4cdb-8690-b174710c993f" style="color: #0066cc; text-decoration: none;"><b>👉 캘린더에서 상세 확인하기</b></a></p>
          <hr style="margin-top: 20px;">
          <p style="font-size: 12px; color: #777;">※ 이 메일은 자동 발송된 메시지이므로 회신하지 마십시오.</p>
        </div>
      `
    });

    // 당일(D-Day)에 메일을 보낸 경우에만 is_sent를 true로 바꿔서 이후에 다시 안 보내게 함
    if (task.due_date === todayStr) {
      await supabase.from('tasks').update({ is_sent: true }).eq('id', task.id);
    }
  }
}

runBot().catch(err => { console.error(err); process.exit(1); });

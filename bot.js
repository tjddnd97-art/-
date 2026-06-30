const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resend = new Resend(process.env.RESEND_KEY);

const groupList = {
  "관리": ["1924518@hyundaigreenfood.com", "2245770@hyundaigreenfood.com", "wowns508@hyundaigreenfood.com", "2511718@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "세무": ["jay556@hyundaigreenfood.com", "shindongwon@hyundaigreenfood.com", "raebin0511@hyundaigreenfood.com", "wldb7007@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "결산": ["1101603@hyundaigreenfood.com", "1519732@hyundaigreenfood.com", "yousc91@hyundaigreenfood.com", "tjddnd97@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"]
};

// 연도와 월(0부터 시작)을 인자로 받아 달력을 생성하는 함수
function generateCalendarHTML(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  let html = `<table style="width:100%; border-collapse:collapse; font-size:12px; text-align:center; margin-top:15px;">`;
  html += `<tr><th colspan="7" style="padding-bottom:10px; font-size:16px;">${year}년 ${month + 1}월</th></tr>`;
  html += `<tr style="background:#f2f2f2;"><th>일</th><th>월</th><th>화</th><th>수</th><th>목</th><th>금</th><th>토</th></tr><tr>`;
  
  for(let i=0; i<firstDay; i++) html += `<td></td>`;
  for(let day=1; day<=daysInMonth; day++) {
    if((day + firstDay - 1) % 7 === 0) html += `</tr><tr>`;
    html += `<td style="border:1px solid #ddd; padding:8px;">${day}</td>`;
  }
  html += `</tr></table>`;
  return html;
}

async function runBot() {
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
  if (!tasks || tasks.length === 0) return console.log("발송할 알림이 없습니다.");

  for (const task of tasks) {
    let targetEmails = groupList[task.manager_email?.trim()] || task.manager_email?.split(',').map(e => e.trim());
    if (!targetEmails) continue;

    // 마감일에서 연, 월 추출 (due_date가 YYYY-MM-DD 형식이라고 가정)
    const [y, m, d] = task.due_date.split('-').map(Number);
    // 달력 생성 (m-1 하는 이유는 Date 객체에서 월이 0부터 시작하기 때문)
    const calendarHTML = generateCalendarHTML(y, m - 1);

    let dDayText = task.due_date === todayStr ? "오늘 마감" : task.due_date === d1Str ? "내일 마감" : "마감 5일 전";

    await resend.emails.send({
      from: '재무알림시스템 <noreply@hgffinance.bond>',
      to: targetEmails,
      subject: `[업무 알림] ${dDayText} - ${task.task_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #ccc;">
          <h2 style="margin-top:0;">📅 마감 예정 업무</h2>
          <p><b>${task.task_name}</b> 업무가 <b>${task.due_date}</b>에 마감됩니다.</p>
          ${calendarHTML}
          <p style="font-size: 12px; color: #666; margin-top: 20px;">※ 자동 발송된 메시지입니다.</p>
        </div>
      `
    });

    if (task.due_date === todayStr) {
      await supabase.from('tasks').update({ is_sent: true }).eq('id', task.id);
    }
  }
}

runBot().catch(err => { console.error(err); process.exit(1); });

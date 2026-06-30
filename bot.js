const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resend = new Resend(process.env.RESEND_KEY);

const groupList = {
  "관리": ["1924518@hyundaigreenfood.com", "2245770@hyundaigreenfood.com", "wowns508@hyundaigreenfood.com", "2511718@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "세무": ["jay556@hyundaigreenfood.com", "shindongwon@hyundaigreenfood.com", "raebin0511@hyundaigreenfood.com", "wldb7007@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "결산": ["1101603@hyundaigreenfood.com", "1519732@hyundaigreenfood.com", "yousc91@hyundaigreenfood.com", "tjddnd97@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"]
};

// [수정됨] 캘린더 생성 함수 (날짜 비교를 더 유연하게)
function generateCalendarHTML(year, month, allTasks) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  let html = `<table style="width:100%; border-collapse:collapse; font-size:11px; text-align:left; margin-top:15px; border:1px solid #ccc;">`;
  html += `<tr><th colspan="7" style="padding:10px; font-size:16px; text-align:center; background:#eee;">${year}년 ${month + 1}월</th></tr>`;
  html += `<tr style="background:#f9f9f9;">${['일','월','화','수','목','금','토'].map(d => `<th style="padding:5px; border:1px solid #ddd; text-align:center;">${d}</th>`).join('')}</tr><tr>`;
  
  for(let i=0; i<firstDay; i++) html += `<td style="border:1px solid #ddd; height:80px;"></td>`;
  
  for(let day=1; day<=daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // [강력한 매칭] 수파베이스 날짜(T00:00:00 포함될 수 있음)와 우리의 날짜 비교
    const tasksForDay = allTasks.filter(t => t.due_date && t.due_date.substring(0, 10) === dateStr);
    
    if((day + firstDay - 1) % 7 === 0) html += `</tr><tr>`;
    
    html += `<td style="border:1px solid #ddd; padding:5px; vertical-align:top; height:80px; width:14%;">
               <div style="font-weight:bold; margin-bottom:5px;">${day}</div>
               ${tasksForDay.map(t => `<div style="background:#e3f2fd; padding:2px; margin-bottom:2px; border-radius:3px; color:#1565c0; font-size:10px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">• ${t.task_name}</div>`).join('')}
             </td>`;
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

  // 1. 발송 대상 업무
  const { data: targetTasks, error } = await supabase
    .from('tasks')
    .select('*')
    .in('due_date', [todayStr, d1Str, d5Str])
    .eq('is_sent', false);

  if (error) throw error;
  if (!targetTasks || targetTasks.length === 0) return console.log("발송할 알림이 없습니다.");

  // 2. [변경] 달력에 전체 일정 다 보여주기 위해 넉넉하게 가져오기
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  const { data: allMonthTasks } = await supabase
    .from('tasks')
    .select('*')
    .gte('due_date', `${year}-${month}-01`)
    .lte('due_date', `${year}-${month}-31`);

  for (const task of targetTasks) {
    let targetEmails = groupList[task.manager_email?.trim()] || task.manager_email?.split(',').map(e => e.trim());
    if (!targetEmails) continue;

    const [y, m] = task.due_date.split('-').map(Number);
    const calendarHTML = generateCalendarHTML(y, m - 1, allMonthTasks || []);

    let dDayText = task.due_date === todayStr ? "오늘 마감" : task.due_date === d1Str ? "내일 마감" : "마감 5일 전";

    await resend.emails.send({
      from: '재무알림시스템 <noreply@hgffinance.bond>',
      to: targetEmails,
      subject: `[업무 알림] ${dDayText} - ${task.task_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #ccc;">
          <h2 style="margin-top:0;">📅 마감 임박 업무 안내</h2>
          <p><b>${task.task_name}</b> 업무가 <b>${task.due_date}</b>에 마감됩니다.</p>
          ${calendarHTML}
          <p style="font-size: 12px; color: #666; margin-top: 20px;">※ 본 메일은 시스템에 의해 자동 발송된 업무 알림입니다.</p>
        </div>
      `
    });

    if (task.due_date === todayStr) {
      await supabase.from('tasks').update({ is_sent: true }).eq('id', task.id);
    }
  }
}

runBot().catch(err => { console.error(err); process.exit(1); });

// 기존 코드 바로 밑에 추가해보세요
  console.log("가져온 전체 업무 수:", allMonthTasks ? allMonthTasks.length : 0);
  if (allMonthTasks && allMonthTasks.length > 0) {
    console.log("첫 번째 업무 데이터:", allMonthTasks[0]);
  }

const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resend = new Resend(process.env.RESEND_KEY);

const groupList = {
  "관리": ["1924518@hyundaigreenfood.com", "2245770@hyundaigreenfood.com", "wowns508@hyundaigreenfood.com", "2511718@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "세무": ["jay556@hyundaigreenfood.com", "shindongwon@hyundaigreenfood.com", "raebin0511@hyundaigreenfood.com", "wldb7007@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "결산": ["1101603@hyundaigreenfood.com", "1519732@hyundaigreenfood.com", "yousc91@hyundaigreenfood.com", "tjddnd97@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"]
};

// 캘린더 생성 함수 (색상 자동 분류 및 텍스트 줄바꿈 적용)
function generateCalendarHTML(year, monthIndex, allTasks) {
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  
  let html = `<table style="width:100%; border-collapse:collapse; font-size:11px; text-align:left; margin-top:15px; border:1px solid #ccc; table-layout:fixed;">`;
  html += `<tr><th colspan="7" style="padding:10px; font-size:16px; text-align:center; background:#eee;">${year}년 ${monthIndex + 1}월</th></tr>`;
  html += `<tr style="background:#f9f9f9;">${['일','월','화','수','목','금','토'].map(d => `<th style="padding:5px; border:1px solid #ddd; text-align:center; width:14%;">${d}</th>`).join('')}</tr><tr>`;
  
  // 첫째 주 빈칸 그리기
  for(let i = 0; i < firstDay; i++) {
    html += `<td style="border:1px solid #ddd; height:80px; background:#fafafa;"></td>`;
  }
  
  // 날짜 및 업무 그리기
  for(let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const tasksForDay = allTasks.filter(t => t.due_date && t.due_date.substring(0, 10) === dateStr);
    
    if((day + firstDay - 1) % 7 === 0 && day !== 1) html += `</tr><tr>`;
    
    html += `<td style="border:1px solid #ddd; padding:4px; vertical-align:top; height:80px;">
               <div style="font-weight:bold; margin-bottom:5px; color:#333;">${day}</div>`;
               
    tasksForDay.forEach(t => {
      // 1. 담당 파트 감지
      const groupName = t.manager_email ? t.manager_email.trim() : "";
      
      // 2. 파트별 색상 지정 (기본값: 회색)
      let bgColor = "#607d8b"; 
      let textColor = "#ffffff";

      if (groupName === "관리") {
        bgColor = "#1976D2"; // 파란색
      } else if (groupName === "결산") {
        bgColor = "#212121"; // 검정색
      } else if (groupName === "세무") {
        bgColor = "#2E7D32"; // 초록색
      }

      // 3. 텍스트 줄바꿈(white-space: normal) 처리하여 잘림 방지
      html += `<div style="background:${bgColor}; color:${textColor}; padding:4px; margin-bottom:4px; border-radius:3px; font-size:11px; line-height:1.3; white-space:normal; word-break:keep-all;">${t.task_name}</div>`;
    });
    
    html += `</td>`;
  }
  
  // 마지막 주 남은 빈칸 그리기
  const totalCells = firstDay + daysInMonth;
  const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for(let i = 0; i < remainingCells; i++) {
    html += `<td style="border:1px solid #ddd; height:80px; background:#fafafa;"></td>`;
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

  const { data: targetTasks, error } = await supabase
    .from('tasks')
    .select('*')
    .in('due_date', [todayStr, d1Str, d5Str])
    .eq('is_sent', false);

  if (error) throw error;
  if (!targetTasks || targetTasks.length === 0) return console.log("오늘 발송할 알림이 없습니다.");

  for (const task of targetTasks) {
    let targetEmails = groupList[task.manager_email?.trim()] || task.manager_email?.split(',').map(e => e.trim());
    if (!targetEmails) continue;

    const [year, month] = task.due_date.split('-').map(Number);
    
    const firstDayStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    const { data: monthTasks } = await supabase
      .from('tasks')
      .select('*')
      .gte('due_date', firstDayStr)
      .lte('due_date', lastDayStr);
      
    const calendarHTML = generateCalendarHTML(year, month - 1, monthTasks || []);

    let dDayText = task.due_date === todayStr ? "오늘 마감" : task.due_date === d1Str ? "내일 마감" : "마감 5일 전";

    await resend.emails.send({
      from: '재무알림시스템 <noreply@hgffinance.bond>',
      to: targetEmails,
      subject: `[업무 알림] ${dDayText} - ${task.task_name}`,
      html: `
        <div style="font-family: 'Malgun Gothic', sans-serif; max-width: 800px; padding: 20px; border: 1px solid #ddd; background:#fff;">
          <h2 style="margin-top:0; color:#333;">📅 마감 임박 업무 안내</h2>
          <p style="font-size:14px; color:#555;"><b>[${task.task_name}]</b> 업무가 <b>${task.due_date}</b>에 마감됩니다.</p>
          ${calendarHTML}
          <p style="font-size: 12px; color: #888; margin-top: 20px;">※ 본 메일은 시스템에 의해 자동 발송된 업무 알림입니다.</p>
        </div>
      `
    });

    if (task.due_date === todayStr) {
      await supabase.from('tasks').update({ is_sent: true }).eq('id', task.id);
    }
  }
  console.log("모든 알림 발송 완료!");
}

runBot().catch(err => { console.error("에러 발생:", err); process.exit(1); });

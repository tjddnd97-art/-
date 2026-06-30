const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resend = new Resend(process.env.RESEND_KEY);

const groupList = {
  "관리": ["1924518@hyundaigreenfood.com", "2245770@hyundaigreenfood.com", "wowns508@hyundaigreenfood.com", "2511718@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "세무": ["jay556@hyundaigreenfood.com", "shindongwon@hyundaigreenfood.com", "raebin0511@hyundaigreenfood.com", "wldb7007@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "결산": ["1101603@hyundaigreenfood.com", "1519732@hyundaigreenfood.com", "yousc91@hyundaigreenfood.com", "tjddnd97@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"]
};

// 캘린더 생성 함수 (기존과 동일)
function generateCalendarHTML(year, monthIndex, allTasks) {
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  
  let html = `<table style="width:100%; border-collapse:collapse; font-size:11px; text-align:left; margin-top:15px; border:1px solid #ccc; table-layout:fixed;">`;
  html += `<tr><th colspan="7" style="padding:10px; font-size:16px; text-align:center; background:#eee;">${year}년 ${monthIndex + 1}월</th></tr>`;
  html += `<tr style="background:#f9f9f9;">${['일','월','화','수','목','금','토'].map(d => `<th style="padding:5px; border:1px solid #ddd; text-align:center; width:14%;">${d}</th>`).join('')}</tr><tr>`;
  
  for(let i = 0; i < firstDay; i++) {
    html += `<td style="border:1px solid #ddd; height:80px; background:#fafafa;"></td>`;
  }
  
  for(let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const tasksForDay = allTasks.filter(t => t.due_date && t.due_date.substring(0, 10) === dateStr);
    
    if((day + firstDay - 1) % 7 === 0 && day !== 1) html += `</tr><tr>`;
    
    html += `<td style="border:1px solid #ddd; padding:4px; vertical-align:top; height:80px;">
               <div style="font-weight:bold; margin-bottom:5px; color:#333;">${day}</div>`;
               
    tasksForDay.forEach(t => {
      const groupName = t.manager_email ? t.manager_email.trim() : "";
      let bgColor = "#607d8b"; 
      let textColor = "#ffffff";

      if (groupName === "관리") bgColor = "#1976D2";
      else if (groupName === "결산") bgColor = "#212121";
      else if (groupName === "세무") bgColor = "#2E7D32";

      html += `<div style="background:${bgColor}; color:${textColor}; padding:4px; margin-bottom:4px; border-radius:3px; font-size:11px; line-height:1.3; white-space:normal; word-break:keep-all;">${t.task_name}</div>`;
    });
    
    html += `</td>`;
  }
  
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
    const groupName = task.manager_email ? task.manager_email.trim() : "미지정";
    let targetEmails = groupList[groupName] || task.manager_email?.split(',').map(e => e.trim());
    if (!targetEmails) continue;

    const [year, month] = task.due_date.split('-').map(Number);
    
    // 💡 다음 달 연도 및 월 계산 (12월에서 1월로 넘어갈 때 연도 +1)
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    
    // 이번 달 1일부터 다음 달 마지막 날까지 2개월치 데이터를 한 번에 가져오기
    const firstDayStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayOfNextMonth = new Date(nextYear, nextMonth, 0).getDate();
    const lastDayStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(lastDayOfNextMonth).padStart(2, '0')}`;

    const { data: twoMonthsTasks } = await supabase
      .from('tasks')
      .select('*')
      .gte('due_date', firstDayStr)
      .lte('due_date', lastDayStr);
      
    // 캘린더 두 개(이번 달, 다음 달) 생성
    const currentMonthHTML = generateCalendarHTML(year, month - 1, twoMonthsTasks || []);
    const nextMonthHTML = generateCalendarHTML(nextYear, nextMonth - 1, twoMonthsTasks || []);

    let dDayText = "";
    let subjectDDay = "";
    let dDayStyle = "";

    if (task.due_date === todayStr) {
      dDayText = "오늘 마감!!!";
      subjectDDay = "D-Day";
      dDayStyle = "color: #e53935; font-weight: bold;";
    } else if (task.due_date === d1Str) {
      dDayText = "내일 마감!";
      subjectDDay = "D-1";
      dDayStyle = "color: #fb8c00; font-weight: bold;";
    } else {
      dDayText = "마감 5일 전";
      subjectDDay = "D-5";
      dDayStyle = "color: #1e88e5; font-weight: bold;";
    }

    // 메일 발송
    await resend.emails.send({
      from: '재무알림시스템 <noreply@hgffinance.bond>',
      to: targetEmails,
      subject: `[업무 알림 - ${subjectDDay}] [${groupName}] ${task.task_name}`,
      html: `
        <div style="font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; max-width: 800px; padding: 20px; border: 1px solid #ddd; background:#fff;">
          
          <p style="font-size:14px; color:#333; line-height:1.6; margin-top:0;">
            안녕하세요, 재무회계파트 업무일정 자동 알림입니다.<br>
            다가오는 주요 업무 일정을 안내해 드립니다.<br>
            기한 내에 처리가 완료될 수 있도록 확인 부탁드립니다.
          </p>

          <hr style="border: 0; border-top: 1px dashed #ccc; margin: 25px 0;">

          <h3 style="color:#333; margin-top:0; font-size:16px;">📌 [업무 상세 내용]</h3>
          <ul style="font-size:14px; color:#333; line-height:1.8; margin-bottom: 30px;">
            <li><b>업무명:</b> [${groupName}] ${task.task_name}</li>
            <li><b>마감일:</b> ${task.due_date} <span style="${dDayStyle}">(${dDayText})</span></li>
            <li><b>담당부서:</b> ${groupName}</li>
          </ul>

          ${currentMonthHTML}

          <div style="margin-top: 40px;">
            <h3 style="color:#555; margin-bottom: 5px; font-size: 15px;">👉 다음 달 업무 미리보기</h3>
            ${nextMonthHTML}
          </div>

          <p style="font-size: 12px; color: #888; margin-top: 30px;">※ 본 메일은 시스템에 의해 자동 발송된 업무 알림입니다.</p>
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

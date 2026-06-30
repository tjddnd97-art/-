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
    .in('due_date', [todayStr, d1Str, d5Str]) 
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

    // 이메일 발송
    await resend.emails.send({
      from: '재무알림시스템 <noreply@hgffinance.bond>',
      to: targetEmails,
      subject: `[업무 알림] ${dDayText} - ${task.task_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #333;">📊 업무 마감 현황 안내</h2>
          <p>안녕하세요. 재무알림시스템입니다.</p>
          <p>현재 아래 업무의 마감 기한이 임박하여 안내드립니다.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <tbody>
              <tr>
                <td style="border: 1px solid #ddd; padding: 12px; background-color: #f9f9f9; width: 30%; font-weight: bold;">업무명</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${task.task_name}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 12px; background-color: #f9f9f9; font-weight: bold;">마감일</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${task.due_date}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 12px; background-color: #f9f9f9; font-weight: bold;">구분</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${dDayText}</td>
              </tr>
            </tbody>
          </table>
          
          <p style="font-size: 13px; color: #777; margin-top: 30px;">
            ※ 본 메일은 시스템에 의해 자동 발송되었습니다. 회신하지 마십시오.
          </p>
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

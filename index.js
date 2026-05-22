const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const cron = require('node-cron');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resend = new Resend(process.env.RESEND_KEY);

// 🎯 [실전 세팅] 실제 메일을 받을 팀원들의 주소
const groupList = {
  "관리": ["1924518@hyundaigreenfood.com", "2245770@hyundaigreenfood.com","wowns508@hyundaigreenfood.com","2511718@hyundaigreenfood.com","jhjang@hyundaigreenfood.com"],
  "세무": ["jay556@hyundaigreenfood.com","shindongwon@hyundaigreenfood.com", "raebin0511@hyundaigreenfood.com","wldb7007@hyundaigreenfood.com","jhjang@hyundaigreenfood.com"],
  "결산": ["1101603@hyundaigreenfood.com", "1519732@hyundaigreenfood.com","yousc91@hyundaigreenfood.com","tjddnd97@hyundaigreenfood.com","jhjang@hyundaigreenfood.com"]
};

// 🔗 여기에 Retool 퍼블릭 링크를 넣어주세요!
const retoolLink = "https://tjddnd97.retool.com/embedded/public/2ffe3b2d-4793-4cdb-8690-b174710c993f";

console.log("🚀 로봇이 정상 가동되었습니다. (D-5, D-1, 당일 3회 알림 모드)");

// ⏰ 매일 아침 9시 정각 실행
cron.schedule('20 11 * * *', async () => {
  console.log("⏰ 정각 알림 로봇이 발송 작업을 시작합니다.");
  
  // 한국 시간 기준으로 오늘(D-Day), 내일(D-1), 5일 뒤(D-5) 날짜 구하기
  const getSeoulDateStr = (offsetDays = 0) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + offsetDays);
    return dt.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  };

  const todayStr = getSeoulDateStr(0); // 마감 당일
  const d1Str = getSeoulDateStr(1);    // 마감 1일 전 (내일)
  const d5Str = getSeoulDateStr(5);    // 마감 5일 전

  console.log(`[안내] 기준 날짜 - 당일:${todayStr} / D-1:${d1Str} / D-5:${d5Str}`);

  // Supabase에서 마감일이 오늘, 내일, 5일 뒤인 일정 중 아직 발송완료(is_sent)가 안 된 것들만 가져옵니다.
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .in('due_date', [todayStr, d1Str, d5Str])
    .eq('is_sent', false);

  if (error) {
    console.log("❌ Supabase 에러:", error);
    return;
  }

  if (!tasks || tasks.length === 0) {
    console.log(`⚠️ 오늘 발송할 알림 일정이 없습니다.`);
    return;
  }

  for (const task of tasks) {
    try {
      let targetEmails = [];
      const managerInfo = task.manager_email.trim();

      if (groupList[managerInfo]) {
        targetEmails = groupList[managerInfo];
      } else if (managerInfo.includes('@')) {
        targetEmails = managerInfo.split(',').map(email => email.trim());
      } else {
        console.log(`알 수 없는 담당자/그룹: ${managerInfo}`);
        continue;
      }

      // 며칠 남았는지 텍스트(D-Day, D-1, D-5) 판별
      let dDayText = "";
      let highlightText = "";
      if (task.due_date === d5Str) {
          dDayText = "D-5";
          highlightText = "5일 후 마감";
      } else if (task.due_date === d1Str) {
          dDayText = "D-1";
          highlightText = "내일 마감";
      } else if (task.due_date === todayStr) {
          dDayText = "D-Day";
          highlightText = "오늘 마감!!!";
      }

      // 📧 메일 본문 템플릿
      const htmlBody = `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
          <p>안녕하세요, 재무회계팀 업무일정 자동 알림입니다.</p>
          <p>다가오는 주요 세무/결산 업무 일정을 안내해 드립니다.<br>
          기한 내에 처리가 완료될 수 있도록 확인 부탁드립니다.</p>
          
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          
          <p>📌 <b>[업무 상세 내용]</b></p>
          <ul>
            <li><b>업무명:</b> ${task.task_name}</li>
            <li><b>마감일:</b> ${task.due_date} <span style="color: red; font-weight: bold;">(${highlightText})</span></li>
            <li><b>담당부서:</b> ${managerInfo}</li>
          </ul>
          
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          
          <p>👇 전체 일정 및 월간 캘린더는 아래 링크에서 로그인 없이 언제든 확인 가능합니다.</p>
          <p>🔗 <b>실시간 재무회계 업무 캘린더 바로가기:</b><br>
          <a href="${retoolLink}" target="_blank" style="color: #0066cc;">${retoolLink}</a></p>
          
          <p>감사합니다.</p>
        </div>
      `;

      // 메일 발송!
      await resend.emails.send({
        from: '재무알림봇 <noreply@hgfnoreply.com>', 
        to: targetEmails,
        subject: `[업무 알림 - ${dDayText}] ${task.task_name}`,
        html: htmlBody
      });

      // 🚨 아주 중요한 부분: 마감일 당일(today)인 경우에만 is_sent를 true로 잠급니다!
      if (task.due_date === todayStr) {
        await supabase.from('tasks').update({ is_sent: true }).eq('id', task.id);
        console.log(`✅ [${task.task_name}] 당일(D-Day) 발송 및 is_sent 잠금 완료!`);
      } else {
        console.log(`✅ [${task.task_name}] ${dDayText} 사전 알림 발송 완료!`);
      }
      
    } catch (error) {
      console.log("❌ 발송 중 에러 발생:", error);
    }
  }
}, {
  scheduled: true,
  timezone: "Asia/Seoul"
});

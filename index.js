const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const cron = require('node-cron');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resend = new Resend(process.env.RESEND_KEY);

// 🎯 [실전 세팅] 실제 메일을 받을 팀원들의 주소로 최종 수정해 주세요!
const groupList = {
  "관리": ["1924518@hyundaigreenfood.com", "2245770@hyundaigreenfood.com","wowns508@hyundaigreenfood.com","2511718@hyundaigreenfood.com","jhjang@hyundaigreenfood.com"],
  "세무": ["jay556@hyundaigreenfood.com","shindongwon@hyundaigreenfood.com", "raebin0511@hyundaigreenfood.com","wldb7007@hyundaigreenfood.com","jhjang@hyundaigreenfood.com"],
  "결산": ["1101603@hyundaigreenfood.com", "1519732@hyundaigreenfood.com","yousc91@hyundaigreenfood.com","tjddnd97@hyundaigreenfood.com"]
};

console.log("🚀 로봇이 정상 가동되었습니다. (hgfnoreply.com 도메인 발송 대기 중)");

// ⏰ 매일 아침 9시 정각에 실행되도록 세팅되어 있습니다.
// (만약 지금 당장 발송 테스트를 하고 싶다면 '0 9 * * *' 부분을 현재 시간의 2~3분 뒤로 수정하세요! 예: '45 13 * * *')
cron.schedule('0 9 * * *', async () => {
  console.log("⏰ 정각 알림 로봇이 발송 작업을 시작합니다.");
  
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  console.log(`[안내] 오늘 날짜: ${today}`);

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('due_date', today)
    .eq('is_sent', false);

  if (error) {
    console.log("❌ Supabase 에러:", error);
    return;
  }

  if (!tasks || tasks.length === 0) {
    console.log(`⚠️ 오늘(${today}) 보낼 일정이 없습니다.`);
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

      await resend.emails.send({
        // 🎯 다시 회원님의 멋진 도메인으로 복구 완료!
        from: '재무알림봇 <noreply@hgfnoreply.com>', 
        to: targetEmails,
        subject: `[업무 알림] 오늘 할 일: ${task.task_name}`,
        html: `<p>안녕하세요!</p><p>오늘은 <b>${task.task_name}</b> 업무를 처리하는 날입니다.</p>`
      });

      await supabase.from('tasks').update({ is_sent: true }).eq('id', task.id);
      console.log(`✅ [${task.task_name}] 발송 성공!`);
      
    } catch (error) {
      console.log("❌ 발송 중 에러 발생:", error);
    }
  }
}, {
  scheduled: true,
  timezone: "Asia/Seoul"
});

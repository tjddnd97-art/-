const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const cron = require('node-cron');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resend = new Resend(process.env.RESEND_KEY);

const groupList = {
  "관리": ["1924518@hyundaigreenfood.com", "2245770@hyundaigreenfood.com","wowns508@hyundaigreenfood.com","2511718@hyundaigreenfood.com"],
  "세무": ["jay556@hyundaigreenfood.com", "shindongwon@hyundaigreenfood.com", "raebin0511@hyundaigreenfood.com","wldb7007@hyundaigreenfood.com"],
  "결산": ["1101603@hyundaigreenfood.com", "1519732@hyundaigreenfood.com","yousc91@hyundaigreenfood.com","tjddnd97@hyundaigreenfood.com"]
};

console.log("로봇이 한국 시간 모드로 정상 가동되었습니다.");

// 🎯 테스트를 위해 한국 시간 오후 12시 55분 실행!
cron.schedule('6 13 * * *', async () => {
  console.log("⏰ 정각 알림 로봇이 발송 작업을 시작합니다.");
  
  // 한국 기준 오늘 날짜(YYYY-MM-DD) 구하기
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  console.log(`[안내] 로봇이 인식한 오늘 날짜는 [ ${today} ] 입니다.`);

  // Supabase 조회
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('due_date', today)
    .eq('is_sent', false);

  // 🚨 만약 에러가 있다면 로그에 확실하게 찍어줍니다.
  if (error) {
    console.log("❌ Supabase 연결/조회 실패 원인:", error);
    return;
  }

  if (!tasks || tasks.length === 0) {
    console.log(`⚠️ ${today} 날짜에 일치하는 데이터가 데이터베이스에 존재하지 않습니다.`);
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
        from: '재무알림봇 <noreply@hgfnoreply.com>', 
        to: targetEmails,
        subject: `[업무 알림] 오늘 할 일: ${task.task_name}`,
        html: `<p>안녕하세요!</p><p>오늘은 <b>${task.task_name}</b> 업무를 처리하는 날입니다.</p>`
      });

      await supabase.from('tasks').update({ is_sent: true }).eq('id', task.id);
      console.log(`✅ [${task.task_name}] 메일 발송 완료 및 발송 처리 완료!`);
      
    } catch (error) {
      console.log("❌ 이메일 발송 중 에러 발생:", error);
    }
  }
}, {
  scheduled: true,
  timezone: "Asia/Seoul"
});

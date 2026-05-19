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

console.log("로봇이 한국 시간 모드로 켜졌습니다!");

// 🎯 테스트를 위해 한국 시간 오전 11시 35분 실행으로 설정!
cron.schedule('35 11 * * *', async () => {
  console.log("정각 알림 로봇이 작동을 시작합니다.");
  
  // 한국 시간 기준으로 오늘 날짜 구하기
  const now = new Date();
  const krOffset = 9 * 60 * 60 * 1000;
  const krDate = new Date(now.getTime() + krOffset);
  const today = krDate.toISOString().split('T')[0];

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('due_date', today)
    .eq('is_sent', false);

  if (!tasks || tasks.length === 0) {
    console.log(`${today} 날짜에 보낼 일정이 없습니다.`);
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
      console.log(`${task.task_name} 메일 발송 완료!`);
      
    } catch (error) {
      console.log("에러 발생:", error);
    }
  }
}, {
  scheduled: true,
  timezone: "Asia/Seoul" // 🎯 한국 시간 동기화 완료!
});

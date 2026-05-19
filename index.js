const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const cron = require('node-cron');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resend = new Resend(process.env.RESEND_KEY);

// 🎯 [이곳에 원하는 그룹명과 이메일 명단을 자유롭게 적어주세요!]
const groupList = {
  "관리": ["1924518@hyundaigreenfood.com", "2245770@hyundaigreenfood.com","wowns508@hyundaigreenfood.com","2511718@hyundaigreenfood.com"],
  "세무": ["jay556@hyundaigreenfood.com", "shindongwon@hyundaigreenfood.com", "raebin0511@hyundaigreenfood.com",wldb7007@hyundaigreenfood.com],
  "결산": ["1101603@hyundaigreenfood.com", "1519732@hyundaigreenfood.com","yousc91@hyundaigreenfood.com","tjddnd97@hyundaigreenfood.com"]
};

console.log("로봇이 켜졌습니다! 그룹 발송 기능이 추가되었습니다.");

// 매일 아침 9시 실행
cron.schedule('0 9 * * *', async () => {
  const today = new Date().toISOString().split('T')[0];

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('due_date', today)
    .eq('is_sent', false);

  if (!tasks || tasks.length === 0) return;

  for (const task of tasks) {
    try {
      let targetEmails = [];
      const managerInfo = task.manager_email.trim();

      // 1. 만약 적어둔 글자가 '그룹명(예: 재무팀)' 이라면 명단에서 이메일들을 쏙 빼옵니다.
      if (groupList[managerInfo]) {
        targetEmails = groupList[managerInfo];
      } 
      // 2. 만약 그냥 이메일을 적었거나, 쉼표(,)로 여러 개 적었다면 그걸 그대로 씁니다.
      else if (managerInfo.includes('@')) {
        targetEmails = managerInfo.split(',').map(email => email.trim());
      } 
      // 3. 둘 다 아니면 발송을 건너뜁니다.
      else {
        console.log(`알 수 없는 담당자/그룹입니다: ${managerInfo}`);
        continue;
      }

      // 4. 추출된 여러 명에게 한 번에 이메일 발송!
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: targetEmails,
        subject: `[업무 알림] 오늘 할 일: ${task.task_name}`,
        html: `<p>안녕하세요!</p><p>오늘은 <b>${task.task_name}</b> 업무를 처리하는 날입니다.</p>`
      });

      // 발송 완료 처리
      await supabase.from('tasks').update({ is_sent: true }).eq('id', task.id);
      console.log(`${task.task_name} 메일 발송 완료! (수신: ${targetEmails.join(', ')})`);
      
    } catch (error) {
      console.log("에러 발생:", error);
    }
  }
});

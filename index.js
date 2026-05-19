const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const cron = require('node-cron');

// 메모장에 적어둔 키들이 이곳으로 들어옵니다.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resend = new Resend(process.env.RESEND_KEY);

console.log("로봇이 켜졌습니다! 매일 아침 9시에 일정을 확인합니다.");

// 매일 아침 9시마다 아래 내용이 실행됩니다. (시간을 바꾸고 싶다면 '0 9 * * *' 부분 수정)
cron.schedule('0 9 * * *', async () => {
  // 1. 오늘 날짜 구하기 (예: 2026-05-19)
  const today = new Date().toISOString().split('T')[0];

  // 2. Supabase에서 오늘 날짜이면서, 아직 메일을 안 보낸 일정 가져오기
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('due_date', today)
    .eq('is_sent', false);

  if (!tasks || tasks.length === 0) return; // 일정이 없으면 종료

  // 3. 담당자들에게 이메일 보내기
  for (const task of tasks) {
    try {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: task.manager_email,
        subject: `[업무 알림] 오늘 할 일: ${task.task_name}`,
        html: `<p>안녕하세요!</p><p>오늘은 <b>${task.task_name}</b> 업무를 처리하는 날입니다.</p>`
      });

      // 4. 메일 발송 완료로 체크하기 (중복 발송 방지)
      await supabase.from('tasks').update({ is_sent: true }).eq('id', task.id);
      
    } catch (error) {
      console.log("에러 발생:", error);
    }
  }
});

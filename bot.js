const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

// 환경변수 확인 로그
console.log("환경변수 확인:", { 
    hasUrl: !!process.env.SUPABASE_URL, 
    hasKey: !!process.env.SUPABASE_KEY, 
    hasResend: !!process.env.RESEND_KEY 
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resend = new Resend(process.env.RESEND_KEY);

const groupList = {
  "관리": ["1924518@hyundaigreenfood.com", "2245770@hyundaigreenfood.com", "wowns508@hyundaigreenfood.com", "2511718@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "세무": ["jay556@hyundaigreenfood.com", "shindongwon@hyundaigreenfood.com", "raebin0511@hyundaigreenfood.com", "wldb7007@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "결산": ["1101603@hyundaigreenfood.com", "1519732@hyundaigreenfood.com", "yousc91@hyundaigreenfood.com", "tjddnd97@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"]
};

async function runBot() {
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_sent', false);

  if (error) throw error;
  if (!tasks || tasks.length === 0) return console.log("알림 없음");

  for (const task of tasks) {
    const targetEmails = groupList[task.manager_email?.trim()] || task.manager_email?.split(',').map(e => e.trim());
    if (!targetEmails) continue;

    await resend.emails.send({
      from: '재무알림봇 <noreply@hgfnoreply.com>',
      to: targetEmails,
      subject: `[업무 알림] ${task.task_name}`,
      html: `<p>마감일: ${task.due_date}</p><a href="https://tjddnd97.retool.com/embedded/public/2ffe3b2d-4793-4cdb-8690-b174710c993f">캘린더 확인</a>`
    });

    await supabase.from('tasks').update({ is_sent: true }).eq('id', task.id);
  }
}

runBot().catch(err => { console.error(err); process.exit(1); });

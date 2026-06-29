const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

// 💡 깃허브 환경변수가 계속 안 읽힌다면 여기에 직접 값을 넣으세요 (가장 확실함)
const supabaseUrl = process.env.SUPABASE_URL || 'https://cmsrcjomjvwqybjxvesm.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_secret_LJN_yv4obqstYBhKPKvD3Q_O6Z1-z-D;
const resendKey = process.env.RESEND_KEY || 're_UFFxTFyu_FxR87HEc7YU2ZBbbeas1ovqb';

const supabase = createClient(supabaseUrl, supabaseKey);
const resend = new Resend(resendKey);

const groupList = {
  "관리": ["1924518@hyundaigreenfood.com", "2245770@hyundaigreenfood.com", "wowns508@hyundaigreenfood.com", "2511718@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "세무": ["jay556@hyundaigreenfood.com", "shindongwon@hyundaigreenfood.com", "raebin0511@hyundaigreenfood.com", "wldb7007@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"],
  "결산": ["1101603@hyundaigreenfood.com", "1519732@hyundaigreenfood.com", "yousc91@hyundaigreenfood.com", "tjddnd97@hyundaigreenfood.com", "jhjang@hyundaigreenfood.com"]
};
const retoolLink = "https://tjddnd97.retool.com/embedded/public/2ffe3b2d-4793-4cdb-8690-b174710c993f";

async function runBot() {
  const getSeoulDateStr = (offsetDays = 0) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + offsetDays);
    return dt.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  };

  const todayStr = getSeoulDateStr(0);
  const d1Str = getSeoulDateStr(1);
  const d5Str = getSeoulDateStr(5);

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .in('due_date', [todayStr, d1Str, d5Str])
    .eq('is_sent', false);

  if (error) throw error;
  if (!tasks || tasks.length === 0) return;

  for (const task of tasks) {
    if (task.task_name === '로봇 생존신고') continue;
    let targetEmails = groupList[task.manager_email?.trim()] || task.manager_email?.split(',').map(e => e.trim());
    if (!targetEmails) continue;

    await resend.emails.send({
      from: '재무알림봇 <noreply@hgfnoreply.com>',
      to: targetEmails,
      subject: `[업무 알림] ${task.task_name}`,
      html: `<p>마감일: ${task.due_date}</p><p><a href="${retoolLink}">캘린더 확인</a></p>`
    });

    if (task.due_date === todayStr) {
      await supabase.from('tasks').update({ is_sent: true }).eq('id', task.id);
    }
  }
}
runBot();

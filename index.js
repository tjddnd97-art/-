const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

// 1. 환경변수 로드 및 확인 (디버깅용 로그 포함)
const supabaseUrl = 'https://cmsrcjomjvwqybjxvesm.supabase.co';
const supabaseKey = 'sb_secret_LJN_yv4obqstYBhKPKvD3Q_O6Z1-z-D';
const resendKey = 're_UFFxTFyu_FxR87HEc7YU2ZBbbeas1ovqb'; // 실제 키

console.log("강제 코드 실행 중...");
const supabase = createClient(supabaseUrl, supabaseKey);
const resend = new Resend(resendKey);

console.log("성공! 환경변수 직접 삽입 완료.");

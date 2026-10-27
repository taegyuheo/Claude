/* data/example.js — tools/example/example.c 전용 데이터 (형식: tools/작성방침.md)
 * 새 파일을 분석할 때는 이 파일을 복사해서 시작한다. */

const META = { subtitle:'CPU 온도 기록기 · Linux 표준 C (외부 라이브러리 없음)' };

/* 전체 개요: 제목, 요약, (선택) 루프 시뮬레이션 — 시뮬레이션이 없으면 sim:null */
const OVERVIEW = {
  heading:'CPU 온도를 1초마다 읽어 기록하기',
  summary:'<code>/sys/class/thermal/thermal_zone0/temp</code> 에서 CPU 온도를 1초마다 읽어 화면에 보여 주고 <code>temp_log.csv</code> 에 덧붙인다. ' +
          '70 °C 이상이면 경고를 붙이고, Ctrl+C 나 최대 횟수에 도달하면 최고 온도를 출력한 뒤 파일을 닫고 끝난다.',
  sim: {
    title:'메인 루프 시뮬레이션', intro:'재생하면 한 번의 반복에서 하는 일을 보여 줍니다',
    from:61, to:68, ms:1000,
    on: 'read_temp() → <b class="text-rose-600">45.2 °C</b> → printf · fprintf(csv)',
    off:'sleep_ms(1000) → 1초 대기',
    stop:'정지 → L71 결과 출력 → L75 fclose(csv)',
  },
};

/* 줄 범위별 역할 (원본 줄 번호). title 이 빈 칸이면 색 띠만 */
const SECTIONS = [
  { from:12, to:15, role:'global',   title:'매크로 정의', desc:'파일 경로, 주기, 경고 온도' },
  { from:17, to:18, role:'global',   title:'종료 깃발과 신호 핸들러', desc:'<code>g_stop</code>, <code>on_sigint</code>' },
  { from:20, to:36, role:'loop',     title:'read_temp()', desc:'온도 파일 열기 → 한 줄 읽기 → 숫자로 바꾸기' },
  { from:38, to:43, role:'delay',    title:'sleep_ms()', desc:'ms 를 초·나노초로 나눠 nanosleep' },
  { from:47, to:48, role:'init',     title:'인자 읽기', desc:'최대 횟수, 종료 코드 기본값' },
  { from:50, to:54, role:'signal',   title:'Ctrl+C 준비', desc:'SIGINT → on_sigint 연결' },
  { from:56, to:57, role:'init',     title:'CSV 파일 열기', desc:'실패하면 바로 종료' },
  { from:59, to:67, role:'loop',     title:'메인 루프', desc:'읽기 → 최고값 갱신 → 화면·파일 출력' },
  { from:68, to:68, role:'delay',    title:'지연 (1초)', desc:'sleep_ms(PERIOD_MS)' },
  { from:69, to:69, role:'loop',     title:'', desc:'' },
  { from:71, to:72, role:'shutdown', title:'결과 출력', desc:'측정 횟수, 최고 온도' },
  { from:74, to:76, role:'cleanup',  title:'정리', desc:'CSV 파일 닫기 → 종료 코드 반환' },
];

/* 레지스터를 다루지 않는 코드이므로 비워 둔다 */
const REGS = {};

const SYM = {
  /* ---------- 매크로 ---------- */
  TEMP_PATH: { kind:'macro', role:'global', sig:'#define TEMP_PATH "/sys/class/thermal/thermal_zone0/temp"',
    summary:'CPU 온도를 알려 주는 <b>커널 가상 파일</b> 경로.',
    sections:[
      ['의미', `<p>리눅스 커널이 온도 센서 값을 파일처럼 보여 준다. 읽으면 <code>45277</code> 처럼 <b>밀리도(m°C)</b> 정수 한 줄이 나온다 (= 45.277 °C).</p>`],
      ['⚠ 주의', `<ul class="list-disc pl-5"><li>VM, WSL, 컨테이너에는 이 파일이 없을 수 있다 → <span class="link" data-go="read_temp">read_temp</span> 가 -1</li><li>센서가 여러 개면 <code>thermal_zone1</code>, <code>2</code> … 도 있다. <code>cat /sys/class/thermal/thermal_zone*/type</code> 으로 확인</li></ul>`],
    ], related:['read_temp','fopen'] },

  LOG_PATH: { kind:'macro', role:'global', sig:'#define LOG_PATH "temp_log.csv"',
    summary:'측정 기록을 덧붙일 CSV 파일 이름.',
    sections:[['의미', `<p>경로가 없는 이름이라 <b>실행한 폴더</b>에 만들어진다. 한 줄 형식: <code>유닉스시간,밀리도</code> (예: <code>1761530000,45277</code>)</p>`]],
    related:['csv','fopen','perror'] },

  PERIOD_MS: { kind:'macro', role:'global', sig:'#define PERIOD_MS 1000',
    summary:'측정 주기 (ms). 1000 = 1초.',
    sections:[['쓰임', `<p>L68 <code>sleep_ms(PERIOD_MS)</code>. 실제 주기는 "1초 + 읽기·출력 시간" 이라 조금씩 늘어난다.</p>`]],
    related:['sleep_ms'] },

  WARN_MC: { kind:'macro', role:'global', sig:'#define WARN_MC 70000',
    summary:'경고 기준 온도 = 70,000 m°C = <b>70 °C</b>.',
    sections:[['쓰임', `<p>L66 <code>mc &gt;= WARN_MC ? "  ⚠ 높음" : ""</code> — 기준 이상이면 출력 줄 끝에 경고를 붙인다. 단위를 센서 값과 같은 밀리도로 맞춰서 나눗셈 없이 비교한다.</p>`]],
    related:['mc','op_ternary'] },

  /* ---------- 전역 / 신호 ---------- */
  g_stop: { kind:'var', role:'global', sig:'static volatile sig_atomic_t g_stop = 0;',
    summary:'<b>종료 깃발.</b> 0 이면 계속, 1 이면 메인 루프를 끝낸다.',
    sections:[
      ['누가 쓰고 누가 읽나', `<p><b>쓰기:</b> <span class="link" data-go="on_sigint">on_sigint</span> (Ctrl+C) · <b>읽기:</b> L60 <code>while (!g_stop &amp;&amp; …)</code></p>`],
      ['한정자', `<table><tr><th>키워드</th><th>이유</th></tr>
        <tr><td><code>static</code></td><td>이 파일 안에서만 보이는 전역</td></tr>
        <tr><td><span class="link" data-go="volatile">volatile</span></td><td>매번 메모리에서 다시 읽게 한다. 없으면 최적화 때문에 Ctrl+C 가 안 먹힐 수 있다</td></tr>
        <tr><td><code>sig_atomic_t</code></td><td>신호가 끼어들어도 한 번에 읽고 쓰는 정수형</td></tr></table>`],
    ], related:['on_sigint','sigaction','volatile'] },

  volatile: { kind:'kw', role:'global', sig:'volatile',
    summary:'"이 변수는 컴파일러가 모르는 곳에서 바뀔 수 있다" 는 표시.',
    sections:[['효과', '<p>읽기·쓰기를 생략하거나 합치지 않는다. 신호 핸들러와 함께 쓰는 플래그, 하드웨어 레지스터에 붙인다.</p>']],
    related:['g_stop'] },

  SIGINT: { kind:'const', role:'signal', sig:'SIGINT (= 2)',
    summary:'터미널에서 <b>Ctrl+C</b> 를 누르면 보내지는 신호.',
    sections:[['기본 동작', '<p>핸들러가 없으면 프로세스가 바로 죽는다. 그러면 CSV 버퍼에 남은 줄이 파일에 써지지 않고 사라질 수 있다.</p>']],
    related:['sigaction','on_sigint'] },

  /* ---------- 지역 변수 ---------- */
  fp: { kind:'var', role:'loop', sig:'FILE *fp = fopen(path, "r");   // read_temp() 안',
    summary:'온도 파일을 읽기용으로 연 <b>파일 핸들</b>.',
    sections:[['수명', '<p>L23 열기 → L28 한 줄 읽기 → L34 닫기. 함수가 불릴 때마다(1초마다) 새로 열고 닫는다. 가상 파일이라 매번 열어야 최신 값이 나온다.</p>']],
    related:['fopen','fgets','fclose','FILE'] },

  buf: { kind:'var', role:'loop', sig:'char buf[32];',
    summary:'파일에서 읽은 <b>한 줄 문자열</b>을 담는 배열.',
    sections:[['크기', '<p>32바이트. 온도 값은 <code>"45277\\n"</code> 처럼 10자 안팎이라 충분하다. <code>fgets</code> 에 <code>sizeof buf</code> 를 넘겨 넘치지 않게 한다.</p>']],
    related:['fgets','strtol'] },

  mc: { kind:'var', role:'loop', sig:'long mc   // read_temp() 안 L27, main() 안 L61 — 이름이 같은 다른 변수',
    summary:'온도 값 (<b>밀리도</b>, m°C). 45277 = 45.277 °C. <b>-1 은 실패</b>를 뜻한다.',
    sections:[
      ['두 개의 mc', `<table><tr><th>위치</th><th>역할</th></tr>
        <tr><td><span class="link" data-line="27">L27</span> read_temp 안</td><td>-1 로 시작 → 읽기·변환에 성공하면 온도 → 반환값</td></tr>
        <tr><td><span class="link" data-line="61">L61</span> main 루프 안</td><td>read_temp 의 반환값을 받아 검사·출력·기록</td></tr></table>`],
      ['⚠ 주의', '<p>-1 을 실패 표시로 쓰므로 <b>실제 온도가 0 °C 미만</b>(음수)이면 실패로 오인해 프로그램이 끝난다. 실외 장비라면 반환값과 성공 여부를 따로 돌려줘야 한다.</p>'],
    ], related:['read_temp','max_mc','WARN_MC'] },

  end: { kind:'var', role:'loop', sig:'char *end;',
    summary:'<code>strtol</code> 이 <b>숫자를 어디까지 읽었는지</b> 알려 주는 포인터.',
    sections:[['쓰임', '<p><code>end == buf</code> 이면 숫자를 하나도 못 읽은 것이다 (빈 줄, 글자). L32 에서 이것으로 실패를 판단한다.</p>']],
    related:['strtol','buf'] },

  ts: { kind:'var', role:'delay', sig:'struct timespec ts = { ms / 1000, (ms % 1000) * 1000000L };',
    summary:'nanosleep 에 넘길 대기 시간. ms 를 <b>초 + 나노초</b>로 나눈 것.',
    sections:[['예', '<p><code>ms = 1000</code> → { 1초, 0 ns } / <code>ms = 1500</code> → { 1초, 500,000,000 ns }</p>']],
    related:['sleep_ms','nanosleep'] },

  limit: { kind:'var', role:'init', sig:'long limit = (argc > 1) ? atol(argv[1]) : 0;',
    summary:'최대 측정 횟수. <b>0 이면 무한</b> (Ctrl+C 로만 종료).',
    sections:[
      ['결정', '<p>인자가 있으면 <code>atol(argv[1])</code>, 없으면 0. 루프 조건 <code>limit == 0 || count &lt; limit</code> 에서 쓴다.</p>'],
      ['⚠ 주의', '<p><code>./example abc</code> → 0 → 무한 반복. <code>./example -3</code> → 루프가 한 번도 안 돈다. <span class="link" data-go="atol">atol</span> 카드 참고.</p>'],
    ], related:['atol','count'] },

  ret: { kind:'var', role:'init', sig:'int ret = EXIT_FAILURE;',
    summary:'main 이 돌려줄 <b>종료 코드</b>. 처음엔 실패로 둔다.',
    sections:[['패턴', '<p>성공 경로 끝(L72)에서만 <code>EXIT_SUCCESS</code> 로 바꾼다. 온도 읽기에 실패해 <code>goto cleanup</code> 하면 실패 값 그대로 반환된다.</p>']],
    related:['EXIT_FAILURE','cleanup'] },

  csv: { kind:'var', role:'init', sig:'FILE *csv = fopen(LOG_PATH, "a");',
    summary:'기록용 CSV 파일 핸들 (<b>덧붙이기 모드</b>).',
    sections:[
      ['수명', '<p>L56 열기 → 루프에서 <code>fprintf</code> → L75 <code>fclose</code>. 프로그램 내내 열려 있다.</p>'],
      ['버퍼', '<p>파일 출력은 버퍼에 모였다가 한꺼번에 써진다. 정상 종료(L75)하면 남은 내용이 써지지만, <code>kill -9</code> 로 죽이면 마지막 몇 줄이 사라질 수 있다.</p>'],
    ], related:['fopen','fprintf','fclose','LOG_PATH'] },

  count: { kind:'var', role:'loop', sig:'long count = 0;',
    summary:'성공한 측정 횟수.',
    sections:[['쓰임', '<p>L64 에서 1 증가 → 출력 줄 번호 <code>[count]</code>, 루프 조건 <code>count &lt; limit</code>, 마지막 요약에 쓴다.</p>']],
    related:['limit','max_mc'] },

  max_mc: { kind:'var', role:'loop', sig:'long max_mc = 0;',
    summary:'지금까지의 <b>최고 온도</b> (m°C).',
    sections:[['갱신', '<p>L65 <code>if (mc &gt; max_mc) max_mc = mc;</code> → L71 에서 °C 로 바꿔 출력.</p>']],
    related:['mc','count'] },

  errno: { kind:'var', role:'loop', sig:'int errno;   // <errno.h>',
    summary:'시스템·라이브러리 함수가 실패 이유를 남기는 <b>전역 오류 번호</b>.',
    sections:[['L30 에서 0 으로 만드는 이유', '<p><code>strtol</code> 은 성공하면 errno 를 건드리지 않는다. 미리 0 으로 해 두어야 호출 뒤 0 이 아니면 "이번 호출이 실패(ERANGE)" 라고 판단할 수 있다.</p>']],
    related:['strtol','perror'] },

  FILE: { kind:'type', role:'global', sig:'typedef struct _IO_FILE FILE;   // <stdio.h>',
    summary:'열린 파일을 나타내는 표준 C 타입. 항상 <b>포인터</b>(<code>FILE *</code>)로 쓴다.',
    sections:[['이 코드에서', '<p><span class="link" data-go="fp">fp</span> (온도 파일, 읽기) · <span class="link" data-go="csv">csv</span> (기록 파일, 덧붙이기)</p>']],
    related:['fopen','fclose'] },

  EXIT_FAILURE: { kind:'const', role:'cleanup', title:'EXIT_SUCCESS / EXIT_FAILURE', sig:'EXIT_SUCCESS = 0, EXIT_FAILURE = 1',
    summary:'<code>&lt;stdlib.h&gt;</code> 의 표준 종료 코드.',
    sections:[['쓰임', '<p>L48 기본값 실패 · L57 파일 열기 실패 시 바로 반환 · L72 성공으로 변경</p>']],
    related:['ret'] },

  /* ---------- 연산자 / 키워드 ---------- */
  op_not: { kind:'op', role:'loop', title:'!', sig:'!x  (논리 NOT)',
    summary:'0 이면 1, 0 이 아니면 0.',
    sections:[['쓰임', `<table><tr><th>줄</th><th>코드</th><th>의미</th></tr>
      <tr><td><span class="link" data-line="24">L24</span></td><td><code>if (!fp)</code></td><td>열기 실패(NULL)?</td></tr>
      <tr><td><span class="link" data-line="57">L57</span></td><td><code>if (!csv)</code></td><td>열기 실패(NULL)?</td></tr>
      <tr><td><span class="link" data-line="60">L60</span></td><td><code>while (!g_stop …)</code></td><td>깃발이 아직 0 인 동안</td></tr></table>`]],
    related:['g_stop','fopen'] },

  op_ternary: { kind:'op', role:'loop', title:'? :', sig:'조건 ? A : B',
    summary:'조건이 참이면 A, 거짓이면 B.',
    sections:[['쓰임', `<p><span class="link" data-line="47">L47</span> 인자가 있으면 <code>atol(argv[1])</code>, 없으면 <code>0</code><br>
      <span class="link" data-line="66">L66</span> 경고 기준 이상이면 <code>"  ⚠ 높음"</code>, 아니면 빈 문자열</p>`]],
    related:['limit','WARN_MC'] },

  op_addr: { kind:'op', role:'init', title:'&', sig:'&x  (주소 연산자)',
    summary:'변수의 <b>메모리 주소</b>를 얻는다.',
    sections:[['쓰임', `<table><tr><th>코드</th><th>이유</th></tr>
      <tr><td><code>strtol(buf, &amp;end, 10)</code></td><td>함수가 end 를 <b>바꿔 주도록</b> 주소를 넘긴다</td></tr>
      <tr><td><code>memset(&amp;sa, …)</code>, <code>sigaction(…, &amp;sa, …)</code></td><td>구조체를 복사하지 않고 주소로 넘긴다</td></tr>
      <tr><td><code>nanosleep(&amp;ts, NULL)</code></td><td>대기 시간을 주소로 넘긴다</td></tr></table>`]],
    related:['end','sigaction','ts'] },

  cleanup: { kind:'kw', role:'cleanup', title:'goto cleanup', sig:'goto cleanup;   …   cleanup:',
    summary:'오류가 나도 정상이어도 <b>같은 정리 코드</b>를 지나가게 하는 하나뿐인 출구.',
    sections:[['두 갈래 경로', `<pre><code>루프 정상 종료 → 결과 출력 → ret = SUCCESS ─┐
온도 읽기 실패 (L62) ── goto cleanup ──────┤
                                          ▼
                       cleanup: fclose(csv) → return ret</code></pre>
      <p>L57 의 열기 실패는 닫을 파일이 없으므로 cleanup 을 거치지 않고 바로 반환한다.</p>`]],
    related:['ret','fclose'] },
};

/* ------------------------------------------------------------
 * 함수 카드 (고정 틀: 파라미터 → 리턴값 → 동작 → 실패 원인 → 관련 변수/함수)
 *   params : [이름, 타입, 이 코드에서 넘긴 값, 설명]
 *   ret    : [값, 의미, 이 코드의 처리]
 *   fails  : [원인, 증상 / errno, 이 코드에서 일어나는 일, 대처]
 *   vars   : [심볼 키 또는 이름, 관계]      funcs : [심볼 키, 관계]
 * ------------------------------------------------------------ */
Object.assign(SYM, {
  main: { kind:'func', role:'init', sig:'int main(int argc, char **argv)',
    summary:'프로그램 전체. 인자 읽기 → Ctrl+C 준비 → CSV 열기 → 측정 루프(+지연) → 결과 출력 → 정리.',
    params:[
      ['argc', 'int', '인자가 없으면 1, <code>./example 10</code> 이면 2', '명령줄 인자 개수 (프로그램 이름 포함)'],
      ['argv', 'char **', '<code>argv[1]</code> = <code>"10"</code>', '인자 문자열 배열. <code>argv[1]</code> 을 최대 횟수로 쓴다'],
    ],
    ret:[
      ['<code>EXIT_SUCCESS</code> (0)', '정상 종료: Ctrl+C 또는 최대 횟수 도달', 'L72 에서 <code>ret</code> 에 넣고 L76 반환'],
      ['<code>EXIT_FAILURE</code> (1)', 'CSV 열기 실패 또는 온도 읽기 실패', 'L57 바로 반환 / L62 → cleanup → L76 반환'],
    ],
    retNote:'셸에서 <code>./example 3; echo $?</code> 로 확인할 수 있다.',
    how:`<div class="space-y-1.5">${SECTIONS.filter(s => s.title && s.from >= 47).map(s =>
        `<div class="flex gap-2 items-start"><span class="w-2 h-2 mt-2 rounded-full ${ROLES[s.role].color}"></span>
         <span class="link mono text-xs mt-0.5" data-line="${s.from}">L${s.from}${s.to!==s.from?'–'+s.to:''}</span>
         <span><b>${s.title}</b> <span class="text-slate-500 text-sm">${s.desc}</span></span></div>`).join('')}</div>`,
    fails:[
      ['CSV 파일을 만들 수 없음', '<code>temp_log.csv: Permission denied</code>', 'L57 에서 바로 1 반환', '쓰기 권한이 있는 폴더에서 실행'],
      ['온도 파일이 없음 (VM·WSL)', '<code>온도 읽기 실패: /sys/…/temp</code>', 'L62 → cleanup → 1 반환 (결과 요약은 안 나옴)', '<code>ls /sys/class/thermal/</code> 로 확인, 경로 수정'],
      ['인자가 숫자가 아님 / 음수', '오류 없음', '0 → 무한 반복 / 음수 → 측정 0회', '<span class="link" data-go="atol">atol</span> 대신 strtol 로 검사'],
      ['<code>kill -9</code> 로 종료', '오류 없음', '정리를 건너뜀 → CSV 마지막 몇 줄이 사라질 수 있음', 'Ctrl+C 나 최대 횟수로 끝내기'],
    ],
    vars:[['limit','최대 횟수'],['ret','종료 코드'],['csv','기록 파일'],['count','측정 횟수'],['max_mc','최고 온도'],['mc','이번 온도'],['g_stop','루프 종료 조건']],
    funcs:[['sigaction','Ctrl+C 준비'],['fopen','CSV 열기'],['read_temp','온도 읽기'],['printf','화면 출력'],['fprintf','파일 기록'],['sleep_ms','지연'],['fclose','정리']] },

  on_sigint: { kind:'func', role:'global', sig:'static void on_sigint(int sig)',
    summary:'Ctrl+C(SIGINT)가 오면 커널이 불러 주는 신호 핸들러. 종료 깃발만 세운다.',
    params:[['sig','int','커널이 넣어 줌: <code>SIGINT</code> (= 2)','어떤 신호로 불렸는지. 쓰지 않아서 <code>(void)sig;</code> 로 경고를 끈다']],
    ret:[['없음 (<code>void</code>)', '원래 실행하던 곳으로 복귀', '자고 있던 <code>nanosleep</code> 은 바로 깨어난다']],
    how:'<p><code>g_stop = 1;</code> 한 줄. main 이 다음에 루프 조건을 확인할 때 빠져나와 결과를 출력하고 파일을 닫는다.</p>',
    fails:[
      ['핸들러 안에서 <code>printf</code>·<code>fclose</code> 호출', '가끔 멈춤, 출력 깨짐 — 재현이 어렵다', '이 코드는 하지 않음 (안전)', '깃발만 세우고 나머지는 main 에서'],
      ['핸들러 등록 실패', 'Ctrl+C 에 그냥 죽음 → CSV 버퍼 유실 가능', '<code>sigaction</code> 리턴값을 확인하지 않는다', '리턴값 확인'],
    ],
    vars:[['g_stop','1 로 바꾼다']],
    funcs:[['sigaction','이 함수를 등록'],['nanosleep','신호가 오면 일찍 깨어남']] },

  read_temp: { kind:'func', role:'loop', sig:'static long read_temp(const char *path)',
    summary:'온도 파일을 열어 한 줄 읽고 <b>정수(m°C)로 바꿔</b> 돌려준다. 실패하면 -1.',
    params:[['path','const char *','<code>TEMP_PATH</code> = <code>"/sys/class/thermal/thermal_zone0/temp"</code>','읽을 파일 경로. <code>const</code> — 함수가 문자열을 바꾸지 않는다']],
    ret:[
      ['0 이상의 정수', '온도 (m°C). 예: 45277 = 45.277 °C', 'main 의 <code>mc</code> 에 저장 → 출력·기록'],
      ['-1', '실패: 파일 열기 실패 / 빈 파일 / 숫자가 아님 / 범위 초과', 'L62 에서 메시지 출력 후 <code>goto cleanup</code>'],
    ],
    how:`<pre><code>fopen(path, "r")      → 실패하면 바로 -1
fgets(buf, 32, fp)    → 한 줄 읽기 ("45277\\n")
errno = 0
strtol(buf, &amp;end, 10) → 45277
  errno ≠ 0 또는 end == buf 이면 -1
fclose(fp)            → 값 반환</code></pre>`,
    fails:[
      ['파일이 없음', 'fopen 이 NULL (ENOENT)', '-1 → main 에서 "온도 읽기 실패" 후 종료', '경로 확인'],
      ['권한 없음', 'fopen 이 NULL (EACCES)', '위와 같음', '보통 누구나 읽을 수 있음. 컨테이너면 마운트 확인'],
      ['빈 파일 / 읽기 오류', 'fgets 가 NULL', 'mc 가 -1 그대로 → 실패', '—'],
      ['숫자가 아닌 내용', '<code>end == buf</code>', '-1', '—'],
      ['<b>실제 온도가 0 °C 미만</b>', '음수 반환 → 실패와 구분 불가', 'main 이 실패로 오인해 종료', '성공 여부를 따로 돌려주기 (예: <code>int read_temp(path, long *out)</code>)'],
    ],
    failNote:'실패 원인이 무엇이든 -1 하나로 돌려주므로, main 의 메시지에는 <b>이유가 나오지 않는다</b>. 디버깅할 때는 <code>strerror(errno)</code> 를 함께 출력한다.',
    vars:[['fp','온도 파일 핸들'],['buf','읽은 한 줄'],['mc','변환 결과 / 반환값'],['end','숫자 끝 위치'],['errno','변환 오류 확인'],['TEMP_PATH','파라미터로 받는 경로']],
    funcs:[['fopen','파일 열기'],['fgets','한 줄 읽기'],['strtol','문자열 → 정수'],['fclose','파일 닫기'],['main','L61 에서 호출']] },

  sleep_ms: { kind:'func', role:'delay', sig:'static void sleep_ms(long ms)',
    summary:'ms 동안 잠든다. <code>nanosleep</code> 을 ms 단위로 쓰기 쉽게 감싼 함수.',
    params:[['ms','long','<code>PERIOD_MS</code> = 1000','잘 시간 (ms). 0 이상이어야 함']],
    ret:[['없음 (<code>void</code>)', '다 잤거나 신호로 일찍 깨어남 — 둘을 구분하지 않는다', '—']],
    how:'<p><code>ms / 1000</code> → 초, <code>(ms % 1000) × 1,000,000</code> → 나노초로 나눠 <code>ts</code> 에 넣고 <code>nanosleep</code> 을 부른다.</p>',
    fails:[
      ['음수 ms', 'nanosleep 이 EINVAL → <b>전혀 자지 않음</b>', '해당 없음 (상수 1000)', '0 미만이면 무시'],
      ['신호로 일찍 깨어남', '남은 시간 버림', '의도된 동작 (Ctrl+C 즉시 종료)', '정확히 다 자야 하면 rem 으로 다시 호출'],
    ],
    vars:[['ts','초·나노초로 바꾼 시간'],['PERIOD_MS','넘겨받는 값']],
    funcs:[['nanosleep','실제로 잠드는 함수'],['main','L68 에서 호출']] },

  sigaction: { kind:'func', role:'signal', title:'sigaction (sa)', sig:'int sigaction(int signum, const struct sigaction *act, struct sigaction *oldact);',
    summary:'신호가 왔을 때 할 일을 등록한다. 코드의 <code>struct sigaction sa</code> 는 그 설정을 담는 구조체.',
    params:[
      ['signum', 'int', '<code>SIGINT</code>', '처리 방법을 바꿀 신호'],
      ['act', 'const struct sigaction *', '<code>&amp;sa</code>', '새 설정: <code>sa_handler = on_sigint</code>, <code>sa_flags = 0</code> (SA_RESTART 없음)'],
      ['oldact', 'struct sigaction *', '<code>NULL</code>', '이전 설정을 받을 곳. 필요 없음'],
    ],
    ret:[['0', '성공', '—'],['-1', '실패 (errno)', '<b>확인하지 않는다</b>']],
    how:'<p>SA_RESTART 를 넣지 않았으므로, 신호를 받으면 잠들어 있던 <code>nanosleep</code> 이 바로 돌아와 루프가 즉시 끝난다.</p>',
    fails:[
      ['잘못된 신호, SIGKILL/SIGSTOP', 'EINVAL', '해당 없음', '—'],
      ['<code>memset</code> 을 빠뜨림', '실패는 아니지만 <code>sa_flags</code> 에 쓰레기 값', 'memset 으로 방지', '구조체는 항상 0 으로 초기화'],
      ['SIGTERM 미등록', '<code>kill</code> 로 끝내면 정리 생략', '이 예제의 한계', '<code>sigaction(SIGTERM, &amp;sa, NULL)</code> 추가'],
    ],
    vars:[['sa','설정 구조체'],['g_stop','핸들러가 바꾸는 깃발'],['SIGINT','등록할 신호']],
    funcs:[['memset','sa 초기화'],['on_sigint','등록되는 핸들러']] },

  memset: { kind:'func', role:'signal', sig:'void *memset(void *s, int c, size_t n);',
    summary:'메모리를 한 바이트 값으로 채운다. <code>sa</code> 를 0 으로 만든다.',
    params:[
      ['s', 'void *', '<code>&amp;sa</code>', '채울 메모리 시작 주소'],
      ['c', 'int', '<code>0</code>', '채울 값'],
      ['n', 'size_t', '<code>sizeof sa</code>', '바이트 수 = 구조체 크기'],
    ],
    ret:[['<code>s</code> 그대로', '편의용', '쓰지 않는다']],
    how:'<p>지역 변수 <code>sa</code> 의 쓰레기 값을 지워 의도한 설정만 남긴다.</p>',
    fails:[['<code>n</code> 을 잘못 줌 (<code>sizeof &amp;sa</code>)', '실패 표시 없이 일부만 초기화', '<code>sizeof sa</code> 로 올바름', '변수 이름으로 sizeof']],
    vars:[['sa','0 으로 채울 대상']],
    funcs:[['sigaction','초기화한 sa 를 받음']] },

  fopen: { kind:'func', role:'init', sig:'FILE *fopen(const char *pathname, const char *mode);',
    summary:'파일을 열어 <code>FILE *</code> 핸들을 돌려준다.',
    params:[
      ['pathname', 'const char *', 'L23 <code>path</code> (온도 파일)<br>L56 <code>LOG_PATH</code>', '열 파일 경로'],
      ['mode', 'const char *', 'L23 <code>"r"</code><br>L56 <code>"a"</code>', '<code>"r"</code> 읽기 (없으면 실패) / <code>"a"</code> 덧붙이기 (없으면 새로 만듦, 항상 끝에 씀)'],
    ],
    ret:[
      ['<code>FILE *</code>', '성공', 'L23 → <code>fp</code> / L56 → <code>csv</code>'],
      ['<code>NULL</code>', '실패 (errno)', 'L24 → -1 반환 / L57 → perror 후 종료'],
    ],
    how:'<p>운영체제에 파일을 열어 달라고 하고, 읽기·쓰기 버퍼를 붙인 핸들을 만든다. 다 쓰면 반드시 <code>fclose</code>.</p>',
    fails:[
      ['파일이 없음 (<code>"r"</code>)', '<code>No such file or directory</code> (ENOENT)', 'L23: read_temp 가 -1', '경로 확인'],
      ['권한 없음', '<code>Permission denied</code> (EACCES)', 'L56: perror 후 1 반환', '쓰기 가능한 폴더에서 실행'],
      ['읽기 전용 파일 시스템', '<code>Read-only file system</code> (EROFS)', 'L56: 종료', '다른 위치에 기록'],
      ['같은 이름의 폴더가 있음', '<code>Is a directory</code> (EISDIR)', 'L56: 종료', '이름 변경'],
      ['열린 파일이 너무 많음', 'EMFILE', '해당 없음 (매번 닫음)', 'fclose 짝 맞추기'],
    ],
    vars:[['fp','L23 결과'],['csv','L56 결과'],['TEMP_PATH','경로'],['LOG_PATH','경로']],
    funcs:[['fclose','짝: 닫기'],['fgets','fp 로 읽기'],['fprintf','csv 로 쓰기'],['perror','실패 이유 출력']] },

  fgets: { kind:'func', role:'loop', sig:'char *fgets(char *s, int size, FILE *stream);',
    summary:'파일에서 <b>한 줄</b>(최대 size-1 글자)을 읽어 문자열로 저장한다.',
    params:[
      ['s', 'char *', '<code>buf</code>', '저장할 배열'],
      ['size', 'int', '<code>sizeof buf</code> = 32', '배열 크기. 끝의 <code>\\0</code> 자리 때문에 최대 31자를 읽는다'],
      ['stream', 'FILE *', '<code>fp</code>', '읽을 파일'],
    ],
    ret:[['<code>s</code> (= buf)', '성공', 'if 안으로 들어가 변환'],['<code>NULL</code>', '파일 끝 또는 읽기 오류', 'mc 가 -1 그대로 → 실패']],
    how:'<p>줄바꿈 문자까지 읽고 멈춘다. 줄바꿈도 buf 에 들어간다 (<code>"45277\\n"</code>). strtol 이 뒤의 줄바꿈을 알아서 무시한다.</p>',
    fails:[
      ['빈 파일', 'NULL', '-1 반환', '—'],
      ['줄이 31자보다 김', '실패는 아님. 앞부분만 읽힘', '해당 없음', '버퍼 크기 늘리기'],
      ['size 를 실제보다 크게 줌', '<b>버퍼 넘침</b> → 메모리 손상', '<code>sizeof buf</code> 로 안전', '항상 sizeof'],
    ],
    vars:[['buf','읽은 줄 저장'],['fp','읽을 파일']],
    funcs:[['fopen','fp 를 만듦'],['strtol','읽은 줄을 숫자로']] },

  strtol: { kind:'func', role:'loop', sig:'long strtol(const char *nptr, char **endptr, int base);',
    summary:'문자열을 <b>long 정수로 바꾼다</b>. 어디까지 읽었는지도 알려 준다.',
    params:[
      ['nptr', 'const char *', '<code>buf</code> (<code>"45277\\n"</code>)', '바꿀 문자열. 앞의 공백은 건너뜀'],
      ['endptr', 'char **', '<code>&amp;end</code>', '숫자가 끝난 위치를 받을 곳'],
      ['base', 'int', '<code>10</code>', '진법. 0 이면 <code>0x</code> 등 접두어로 자동 판단'],
    ],
    ret:[
      ['변환한 값', '성공', '<code>mc</code> 에 저장'],
      ['0 + <code>end == buf</code>', '숫자가 하나도 없음', 'L32 에서 -1 로 바꿈'],
      ['LONG_MAX / LONG_MIN + <code>errno = ERANGE</code>', '범위 초과', 'L32 에서 -1 로 바꿈'],
    ],
    how:'<p>실패해도 특별한 값을 돌려주지 않으므로, <b>errno 와 end 로 판단</b>해야 한다. 그래서 호출 전에 <code>errno = 0</code> 을 한다.</p>',
    fails:[
      ['숫자가 아님 (<code>"abc"</code>)', '0 반환, end == buf', '-1 처리 (올바름)', '—'],
      ['너무 큰 수', 'ERANGE', '-1 처리 (올바름)', '—'],
      ['<code>errno = 0</code> 을 빠뜨림', '이전 오류가 남아 성공도 실패로 판단', 'L30 에서 방지', '호출 직전에 0'],
      ['<code>atoi</code>/<code>atol</code> 을 대신 씀', '오류를 알 수 없음', '—', 'strtol 사용 (이 코드처럼)'],
    ],
    vars:[['buf','바꿀 문자열'],['end','끝 위치'],['errno','범위 초과 확인'],['mc','결과']],
    funcs:[['fgets','문자열을 읽어 옴'],['atol','오류 검사가 없는 간단한 버전']] },

  fclose: { kind:'func', role:'cleanup', sig:'int fclose(FILE *stream);',
    summary:'버퍼에 남은 내용을 쓰고 파일을 닫는다.',
    params:[['stream','FILE *','L34 <code>fp</code><br>L75 <code>csv</code>','닫을 파일. 이후 사용 금지']],
    ret:[['0', '성공', '—'],['<code>EOF</code>', '실패 (쓰기 중 오류 등)', '<b>확인하지 않는다</b>']],
    how:'<p>쓰기용 파일(<code>csv</code>)은 이때 남은 버퍼가 디스크로 나간다. 그래서 <b>디스크가 꽉 찬 오류가 여기서 처음 드러날 수 있다</b>.</p>',
    fails:[
      ['디스크 가득 참', 'EOF (ENOSPC)', '리턴값 무시 → <b>기록이 조용히 잘림</b>', '<code>if (fclose(csv) != 0) perror(...)</code>'],
      ['두 번 닫기', '비정상 종료', '해당 없음', '닫은 뒤 포인터를 NULL'],
      ['NULL 을 닫기', 'Segmentation fault', 'L57 에서 NULL 이면 미리 반환 → 안전', '—'],
    ],
    vars:[['fp','L34 에서 닫음'],['csv','L75 에서 닫음']],
    funcs:[['fopen','짝: 열기'],['fprintf','버퍼에 쌓인 내용을 여기서 씀']] },

  nanosleep: { kind:'func', role:'delay', sig:'int nanosleep(const struct timespec *req, struct timespec *rem);',
    summary:'지정한 시간 동안 프로세스를 잠재운다 (CPU 를 쓰지 않음).',
    params:[
      ['req', 'const struct timespec *', '<code>&amp;ts</code> = { 1초, 0 ns }', '잘 시간. tv_nsec 은 0 ~ 999,999,999'],
      ['rem', 'struct timespec *', '<code>NULL</code>', '일찍 깨어났을 때 남은 시간. 버림'],
    ],
    ret:[['0', '다 잠', '—'],['-1 + EINTR', '신호로 깨어남', '의도된 종료 경로 (리턴값은 안 봄)'],['-1 + EINVAL', '잘못된 시간', '확인하지 않음']],
    how:'<p>바쁜 대기(<code>for</code> 루프)와 달리 CPU 를 쉬게 한다. SA_RESTART 가 없어서 Ctrl+C 에 즉시 깨어난다.</p>',
    fails:[
      ['tv_nsec 범위 밖', 'EINVAL — 전혀 안 잠', '해당 없음 (sleep_ms 가 올바르게 나눔)', '1초 이상은 tv_sec 에'],
      ['신호로 깨어남', 'EINTR', '의도된 동작', '—'],
    ],
    vars:[['ts','잘 시간']],
    funcs:[['sleep_ms','이 함수를 감싼 함수'],['sigaction','신호에 깨어나도록 설정']] },

  perror: { kind:'func', role:'init', sig:'void perror(const char *s);',
    summary:'방금 실패한 이유(errno)를 문장으로 stderr 에 출력한다.',
    params:[['s','const char *','<code>LOG_PATH</code>','앞에 붙일 이름 → <code>temp_log.csv: Permission denied</code>']],
    ret:[['없음 (<code>void</code>)', '—', '—']],
    how:'<p>실패한 함수 <b>바로 다음</b>에 불러야 정확한 이유가 나온다.</p>',
    fails:[['나중에 호출', '다른 함수가 errno 를 바꿔 엉뚱한 이유 출력', 'L57 은 실패 직후 → 올바름', '실패 바로 다음 줄에서']],
    vars:[['errno','출력할 오류 번호'],['LOG_PATH','앞에 붙는 이름']],
    funcs:[['fopen','실패 시 호출'],['fprintf','L62 는 perror 대신 직접 출력 (이유 없음)']] },

  fprintf: { kind:'func', role:'loop', sig:'int fprintf(FILE *stream, const char *format, ...);',
    summary:'지정한 파일(또는 stderr)에 형식대로 출력한다.',
    params:[
      ['stream', 'FILE *', 'L62 <code>stderr</code><br>L67 <code>csv</code>', '출력할 곳. stderr 는 화면(오류용), csv 는 기록 파일'],
      ['format', 'const char *', 'L67 <code>"%ld,%ld\\n"</code>', '<code>%ld</code> = long 정수'],
      ['...', '가변 인자', 'L67 <code>(long)time(NULL)</code>, <code>mc</code>', '형식 자리에 들어갈 값'],
    ],
    ret:[['출력한 바이트 수', '성공', '쓰지 않는다'],['음수', '실패', '<b>확인하지 않는다</b>']],
    how:'<p>파일 출력은 버퍼에 모였다가 한꺼번에 써진다. 그래서 실행 중에 CSV 를 열어 보면 최근 줄이 아직 없을 수 있다. 바로 보이게 하려면 <code>fflush(csv)</code>.</p>',
    fails:[
      ['형식과 인자 타입 불일치 (<code>%d</code> 에 long)', '엉뚱한 값', '<code>%ld</code> + <code>(long)</code> 캐스트로 올바름', '<code>-Wall</code> 경고 확인'],
      ['디스크 가득 참', '음수 또는 fclose 에서 드러남', '무시됨', '<span class="link" data-go="fclose">fclose</span> 리턴값 확인'],
    ],
    vars:[['csv','기록 파일'],['mc','기록할 온도'],['TEMP_PATH','오류 메시지에 포함']],
    funcs:[['time','기록 시각'],['printf','화면용 (stdout)'],['fclose','남은 버퍼를 씀']] },

  printf: { kind:'func', role:'loop', sig:'int printf(const char *format, ...);',
    summary:'화면(표준 출력)에 형식대로 출력한다.',
    params:[
      ['format', 'const char *', 'L66 <code>"[%ld] %.1f °C%s\\n"</code><br>L71 <code>"\\n%ld 회 측정 · 최고 %.1f °C\\n"</code>', '<code>%.1f</code> = 소수 한 자리 실수, <code>%s</code> = 문자열'],
      ['...', '가변 인자', 'L66 <code>count</code>, <code>mc / 1000.0</code>, 경고 문자열', '<code>1000.0</code> 으로 나눠 실수 °C 로 바꾼다 (<code>1000</code> 이면 정수 나눗셈)'],
    ],
    ret:[['출력한 바이트 수', '성공', '쓰지 않는다'],['음수', '실패', '확인하지 않는다']],
    how:'<p>L71 맨 앞의 <code>\\n</code> 은 Ctrl+C 를 누르면 찍히는 <code>^C</code> 다음 줄에 출력하려는 것이다.</p>',
    fails:[
      ['<code>mc / 1000</code> (정수로 나눔)', '45.277 → 45.0 으로 잘림', '<code>1000.0</code> 으로 올바름', '실수로 나누기'],
      ['출력을 파일로 돌렸는데 안 보임', '버퍼에 머묾', '—', '<code>fflush(stdout)</code>'],
    ],
    vars:[['count','측정 번호'],['mc','온도'],['max_mc','최고 온도'],['WARN_MC','경고 기준']],
    funcs:[['fprintf','파일용']] },

  atol: { kind:'func', role:'init', sig:'long atol(const char *nptr);',
    summary:'문자열을 long 으로 바꾸는 <b>간단한</b> 함수. 오류를 알려 주지 않는다.',
    params:[['nptr','const char *','<code>argv[1]</code>','바꿀 문자열 (명령줄 첫 인자)']],
    ret:[['변환한 값', '성공', '<code>limit</code> 에 저장'],['0', '숫자가 아니어도 0 — <b>실패와 구분 불가</b>', '무한 반복으로 해석됨']],
    how:'<p><code>strtol(nptr, NULL, 10)</code> 과 같지만 오류를 확인할 방법이 없다.</p>',
    fails:[
      ['<code>./example abc</code>', '0', 'limit = 0 → <b>무한 반복</b>', 'strtol + end 검사'],
      ['<code>./example -3</code>', '-3', '<code>count &lt; -3</code> 거짓 → 측정 0회, "0 회 측정" 출력', '음수 거부'],
      ['아주 큰 수', '결과가 정의되지 않음', '—', 'strtol 의 ERANGE 확인'],
    ],
    vars:[['limit','결과 저장']],
    funcs:[['strtol','오류 검사가 되는 버전'],['main','L47 에서 호출']] },

  time: { kind:'func', role:'loop', sig:'time_t time(time_t *tloc);',
    summary:'현재 시각을 <b>유닉스 시간</b>(1970-01-01 부터의 초)으로 돌려준다.',
    params:[['tloc','time_t *','<code>NULL</code>','결과를 함께 저장할 곳. 필요 없어서 NULL']],
    ret:[['초 단위 시각', '성공 (예: 1761530000)', '<code>(long)</code> 로 바꿔 CSV 첫 칸에 기록'],['<code>(time_t)-1</code>', '실패 (거의 없음)', '확인하지 않는다']],
    how:'<p>사람이 읽기 좋은 날짜가 필요하면 <code>localtime</code> + <code>strftime</code> 을 쓴다.</p>',
    fails:[
      ['32비트 long 환경', '2038년 이후 값이 넘침', '<code>(long)</code> 캐스트가 원인', '<code>%lld</code> + <code>(long long)</code>'],
      ['시스템 시계가 틀림', '실패는 아님. 엉뚱한 기록 시각', '—', 'NTP 동기화 확인'],
    ],
    vars:[['csv','기록할 파일']],
    funcs:[['fprintf','결과를 CSV 에 기록']] },
});

/* 코드 속 이름 → 심볼 키 */
const ALIAS = {
  sig_atomic_t:'g_stop', timespec:'ts', sa:'sigaction', sa_handler:'sigaction',
  goto:'cleanup', EXIT_SUCCESS:'EXIT_FAILURE',
};

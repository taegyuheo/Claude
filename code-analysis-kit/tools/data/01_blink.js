/* data/01_blink.js — upload/01_blink.c 전용 데이터 (형식: tools/작성방침.md) */

const META = { subtitle:'LED 깜빡이기 · libgpiod v2 · Raspberry Pi GPIO17' };

/* 전체 개요: 제목, 요약, (선택) 루프 시뮬레이션 — 시뮬레이션이 없으면 sim:null */
const OVERVIEW = {
  heading:'GPIO17 에 연결한 LED 를 0.5초마다 켜고 끄기',
  summary:'libgpiod v2 의 객체를 <b>칩 열기 → 라인 설정 → 라인 설정 묶기 → 요청 설정 → 라인 요청</b> 순서로 한 단계씩 만든다. ' +
          '요청에 성공하면 0.5초마다 LED 를 켜고 끄기를 바꾼다. Ctrl+C 를 누르면 LED 를 끄고 라인을 반납한 뒤, 만든 객체를 거꾸로 해제하고 끝난다. ' +
          '배선은 <code>GPIO17 → 220Ω → LED → GND</code> 이다. 보드에서 실행해 보지 않았으므로, 하드웨어 동작에 대한 설명은 libgpiod 문서와 소스를 보고 추정한 것이다.',
  sim: {
    title:'메인 루프 시뮬레이션', intro:'재생하면 한 번의 반복에서 하는 일을 보여 줍니다',
    from:52, to:57, ms:500,
    on: 'on = 1 → set_value(<b class="text-rose-600">ACTIVE</b>) → GPIO17 High → LED 켜짐 → nanosleep 0.5초',
    off:'on = 0 → set_value(INACTIVE) → GPIO17 Low → LED 꺼짐 → nanosleep 0.5초',
    stop:'Ctrl+C → L60 LED 끄기 → L61 라인 반납 → L66~69 객체 해제',
  },
};

/* 줄 범위별 역할 (원본 줄 번호). title 이 빈 칸이면 색 띠만 */
const SECTIONS = [
  { from:12, to:13, role:'global',   title:'매크로 정의', desc:'칩 장치 파일, LED 라인 번호' },
  { from:15, to:16, role:'global',   title:'종료 깃발과 신호 핸들러', desc:'<code>g_stop</code>, <code>on_sigint</code>' },
  { from:18, to:21, role:'init',     title:'main 시작', desc:'라인 번호, 종료 코드 기본값' },
  { from:23, to:27, role:'signal',   title:'Ctrl+C 준비', desc:'SIGINT → on_sigint 연결' },
  { from:29, to:31, role:'init',     title:'① 칩 열기', desc:'<code>/dev/gpiochip0</code>, 실패하면 바로 종료' },
  { from:33, to:36, role:'init',     title:'② 라인 설정', desc:'출력, 처음 값 0' },
  { from:38, to:40, role:'init',     title:'③ 라인 설정 묶기', desc:'라인 17 ← ② 의 설정' },
  { from:42, to:44, role:'init',     title:'④ 요청 설정', desc:'consumer 이름 <code>"blink"</code>' },
  { from:46, to:48, role:'init',     title:'⑤ 라인 요청', desc:'커널에 요청, 실패하면 cleanup 으로' },
  { from:50, to:55, role:'loop',     title:'메인 루프', desc:'시작 알림 → on 뒤집기 → 라인 값 쓰기' },
  { from:56, to:57, role:'delay',    title:'지연 (0.5초)', desc:'nanosleep' },
  { from:58, to:58, role:'loop',     title:'', desc:'' },
  { from:60, to:63, role:'shutdown', title:'끄고 반납', desc:'LED 끄기 → ⑥ 라인 반납 → 성공 코드' },
  { from:65, to:71, role:'cleanup',  title:'정리', desc:'요청 설정 → 라인 설정 묶음 → 라인 설정 → 칩 순서로 해제' },
];

/* 레지스터를 다루지 않는 코드이므로 비워 둔다 */
const REGS = {};

const SYM = {
  /* ---------- 매크로 ---------- */
  CHIP_PATH: { kind:'macro', role:'global', sig:'#define CHIP_PATH "/dev/gpiochip0"',
    summary:'GPIO 컨트롤러(칩)를 나타내는 <b>문자 장치 파일</b> 경로.',
    sections:[
      ['의미', `<p>리눅스 커널은 GPIO 컨트롤러 하나를 <code>/dev/gpiochipN</code> 파일 하나로 보여 준다. libgpiod 는 이 파일을 열어 커널과 이야기한다. Raspberry Pi 4 이하에서는 40핀 헤더의 GPIO 가 <code>gpiochip0</code> 에 있다.</p>`],
      ['⚠ 주의', `<ul class="list-disc pl-5"><li>Raspberry Pi 5 는 커널 버전에 따라 헤더 GPIO 가 <code>gpiochip4</code> 에 있을 수 있다. 그러면 오류 없이 <b>다른 칩의 17번 라인</b>을 건드려 LED 가 안 켜진다 (추정). <code>gpiodetect</code>, <code>gpioinfo</code> 로 확인한다</li><li>PC·VM 에는 이 파일이 없다 → <span class="link" data-go="gpiod_chip_open">gpiod_chip_open</span> 실패</li></ul>`],
    ], related:['gpiod_chip_open','chip'] },

  LED_LINE: { kind:'macro', role:'global', sig:'#define LED_LINE  17',
    summary:'LED 를 연결한 라인 번호(offset) = <b>GPIO17</b> (헤더 11번 핀).',
    sections:[
      ['쓰임', `<p><span class="link" data-line="20">L20</span> <code>offset</code> 의 처음 값 · <span class="link" data-line="50">L50</span> 시작 메시지의 <code>GPIO%d</code></p>`],
      ['번호 체계', `<p>17 은 칩 안의 <b>라인 번호</b>(BCM 번호)다. 헤더의 물리 핀 번호(11번)와 다르다. 핀 번호로 착각해 17번 핀에 연결하면 그 핀은 3.3V 전원이라 LED 가 계속 켜져 있다.</p>`],
    ], related:['offset','gpiod_line_config_add_line_settings'] },

  /* ---------- 전역 / 신호 ---------- */
  g_stop: { kind:'var', role:'global', sig:'static volatile sig_atomic_t g_stop = 0;',
    summary:'<b>종료 깃발.</b> 0 이면 계속 깜빡이고, 1 이면 메인 루프를 끝낸다.',
    sections:[
      ['누가 쓰고 누가 읽나', `<p><b>쓰기:</b> <span class="link" data-go="on_sigint">on_sigint</span> (Ctrl+C) · <b>읽기:</b> <span class="link" data-line="52">L52</span> <code>while (!g_stop)</code></p>`],
      ['한정자', `<table><tr><th>키워드</th><th>이유</th></tr>
        <tr><td><code>static</code></td><td>이 파일 안에서만 보이는 전역</td></tr>
        <tr><td><span class="link" data-go="volatile">volatile</span></td><td>매번 메모리에서 다시 읽게 한다. 없으면 최적화(<code>-O2</code>) 때문에 Ctrl+C 가 안 먹힐 수 있다</td></tr>
        <tr><td><code>sig_atomic_t</code></td><td>신호가 끼어들어도 한 번에 읽고 쓰는 정수형</td></tr></table>`],
    ], related:['on_sigint','sigaction','volatile'] },

  volatile: { kind:'kw', role:'global', sig:'volatile',
    summary:'"이 변수는 컴파일러가 모르는 곳에서 바뀔 수 있다" 는 표시.',
    sections:[['효과', '<p>읽기·쓰기를 생략하거나 합치지 않는다. 이 코드에서는 신호 핸들러가 바꾸는 <code>g_stop</code> 에 붙였다.</p>']],
    related:['g_stop'] },

  SIGINT: { kind:'const', role:'signal', sig:'SIGINT (= 2)',
    summary:'터미널에서 <b>Ctrl+C</b> 를 누르면 보내지는 신호.',
    sections:[['핸들러가 없다면', '<p>프로세스가 바로 죽는다. 커널이 라인을 자동으로 회수하지만, L60 의 "끄고 나가기" 를 건너뛰므로 <b>LED 가 켜진 채로 남을 수 있다</b> (추정: 반납 뒤 핀 상태는 드라이버마다 다르다).</p>']],
    related:['sigaction','on_sigint'] },

  /* ---------- main 의 지역 변수 ---------- */
  offset: { kind:'var', role:'init', sig:'unsigned int offset = LED_LINE;',
    summary:'요청할 라인 번호 (= 17). 함수에 <b>주소로</b> 넘기기 위해 변수에 담았다.',
    sections:[
      ['왜 변수인가', `<p><span class="link" data-go="gpiod_line_config_add_line_settings">gpiod_line_config_add_line_settings</span> 는 라인 번호 <b>배열</b>(<code>const unsigned int *</code>)을 받는다. 매크로 <code>17</code> 은 주소가 없으므로 변수에 담아 <code>&amp;offset</code> 으로 "길이 1 짜리 배열" 처럼 넘긴다.</p>`],
      ['쓰임', `<table><tr><th>줄</th><th>용도</th></tr>
        <tr><td><span class="link" data-line="40">L40</span></td><td><code>&amp;offset, 1</code> — 이 라인에 설정 적용</td></tr>
        <tr><td><span class="link" data-line="54">L54</span>, <span class="link" data-line="60">L60</span></td><td>값을 쓸 라인 지정 (요청에 들어 있는 라인이어야 함)</td></tr></table>`],
    ], related:['LED_LINE','op_addr','gpiod_line_request_set_value'] },

  ret: { kind:'var', role:'init', sig:'int ret = EXIT_FAILURE;',
    summary:'main 이 돌려줄 <b>종료 코드</b>. 처음엔 실패로 둔다.',
    sections:[['패턴', '<p>정상 경로 끝(<span class="link" data-line="63">L63</span>)에서만 <code>EXIT_SUCCESS</code> 로 바꾼다. 라인 요청에 실패해 L48 에서 <code>goto cleanup</code> 하면 실패 값 그대로 반환된다.</p>']],
    related:['EXIT_FAILURE','cleanup'] },

  chip: { kind:'var', role:'init', sig:'struct gpiod_chip *chip = gpiod_chip_open(CHIP_PATH);',
    summary:'열린 GPIO 칩 객체. 라인을 요청할 때 필요하다.',
    sections:[
      ['수명', '<p><span class="link" data-line="30">L30</span> 열기 → <span class="link" data-line="47">L47</span> 요청에 사용 → <span class="link" data-line="69">L69</span> 닫기. 칩을 닫아도 이미 받은 요청(<code>req</code>)은 유지된다.</p>'],
      ['NULL 일 때', '<p>L31 에서 바로 종료한다. 이 시점에는 만든 객체가 없어서 cleanup 을 거치지 않아도 된다.</p>'],
    ], related:['gpiod_chip_open','gpiod_chip_close','CHIP_PATH'] },

  settings: { kind:'var', role:'init', sig:'struct gpiod_line_settings *settings = gpiod_line_settings_new();',
    summary:'라인 <b>하나</b>에 적용할 설정(방향, 출력 값 등)을 담는 객체.',
    sections:[
      ['담는 내용', '<p>L35 방향 = 출력, L36 처음 출력 값 = 0 (INACTIVE). 나머지(풀업, 엣지 감지 등)는 기본값.</p>'],
      ['수명', '<p>L34 생성 → L40 에서 <code>line_cfg</code> 에 <b>복사</b>됨 → L68 해제. 복사되므로 L40 뒤에는 바로 해제해도 된다.</p>'],
      ['⚠ 주의', '<p>생성 결과를 확인하지 않는다. NULL 이면 L35 에서 <b>Segmentation fault</b>.</p>'],
    ], related:['gpiod_line_settings_new','gpiod_line_settings_set_direction','gpiod_line_settings_set_output_value','gpiod_line_settings_free'] },

  line_cfg: { kind:'var', role:'init', sig:'struct gpiod_line_config *line_cfg = gpiod_line_config_new();',
    summary:'"어느 라인에 어떤 설정을 쓸지" 를 묶어 두는 객체.',
    sections:[
      ['담는 내용', '<p>L40: 라인 17 ← <code>settings</code>. 여러 라인을 서로 다른 설정으로 한꺼번에 담을 수도 있다.</p>'],
      ['수명', '<p>L39 생성 → L47 요청에 사용 → L67 해제.</p>'],
    ], related:['gpiod_line_config_new','gpiod_line_config_add_line_settings','gpiod_line_config_free','settings'] },

  req_cfg: { kind:'var', role:'init', sig:'struct gpiod_request_config *req_cfg = gpiod_request_config_new();',
    summary:'요청 <b>전체</b>에 대한 설정. 여기서는 consumer 이름만 넣는다.',
    sections:[
      ['담는 내용', '<p>L44: consumer = <code>"blink"</code>. 실행 중 <code>gpioinfo</code> 를 보면 라인 17 옆에 <code>"blink"</code> 가 보인다.</p>'],
      ['수명', '<p>L43 생성 → L47 요청에 사용 → L66 해제.</p>'],
    ], related:['gpiod_request_config_new','gpiod_request_config_set_consumer','gpiod_request_config_free'] },

  req: { kind:'var', role:'loop', sig:'struct gpiod_line_request *req = gpiod_chip_request_lines(chip, req_cfg, line_cfg);',
    summary:'커널에서 받은 <b>라인 사용권</b>. 이것으로 라인 값을 쓴다.',
    sections:[
      ['수명', `<table><tr><th>줄</th><th>일</th></tr>
        <tr><td><span class="link" data-line="47">L47</span></td><td>요청 → 이 프로세스가 라인 17 의 소유자</td></tr>
        <tr><td><span class="link" data-line="54">L54</span>, <span class="link" data-line="60">L60</span></td><td>값 쓰기</td></tr>
        <tr><td><span class="link" data-line="61">L61</span></td><td>반납 → 이후 사용 금지</td></tr></table>`],
      ['NULL 일 때', '<p>L48 에서 perror 후 cleanup 으로 간다. 반납할 것이 없으므로 L61 을 건너뛰는 것이 맞다.</p>'],
    ], related:['gpiod_chip_request_lines','gpiod_line_request_set_value','gpiod_line_request_release'] },

  on: { kind:'var', role:'loop', sig:'int on = 0;',
    summary:'지금 LED 를 켤 차례인지 (1) 끌 차례인지 (0).',
    sections:[['변화', '<p>L53 <code>on = !on</code> 으로 반복마다 0 ↔ 1 을 바꾼다. 첫 반복에서 1 이 되므로 <b>켜기부터</b> 시작한다. L55 에서 ACTIVE / INACTIVE 로 바뀐다.</p>']],
    related:['op_not','op_ternary','GPIOD_LINE_VALUE_ACTIVE'] },

  ts: { kind:'var', role:'delay', sig:'struct timespec ts = { 0, 500 * 1000000L };',
    summary:'nanosleep 에 넘길 대기 시간 = <b>0초 + 500,000,000 ns = 0.5초</b>.',
    sections:[['구조', '<p><code>tv_sec</code> = 0 (초), <code>tv_nsec</code> = 500,000,000 (나노초). <code>tv_nsec</code> 은 0 ~ 999,999,999 여야 하므로, 1초 이상은 <code>tv_sec</code> 에 넣어야 한다. <code>L</code> 은 계산을 long 으로 하라는 접미사다.</p>']],
    related:['nanosleep'] },

  EXIT_FAILURE: { kind:'const', role:'cleanup', title:'EXIT_SUCCESS / EXIT_FAILURE', sig:'EXIT_SUCCESS = 0, EXIT_FAILURE = 1',
    summary:'<code>&lt;stdlib.h&gt;</code> 의 표준 종료 코드.',
    sections:[['쓰임', '<p>L21 기본값 실패 · L31 칩 열기 실패 시 바로 반환 · L63 성공으로 변경</p>']],
    related:['ret'] },

  /* ---------- libgpiod 상수 ---------- */
  GPIOD_LINE_DIRECTION_OUTPUT: { kind:'const', role:'init', sig:'GPIOD_LINE_DIRECTION_OUTPUT   // enum gpiod_line_direction',
    summary:'라인 방향 = <b>출력</b>. 프로그램이 핀 전압을 정한다.',
    sections:[['같은 무리', `<table><tr><th>값</th><th>의미</th></tr>
      <tr><td><code>GPIOD_LINE_DIRECTION_AS_IS</code></td><td>지금 방향 그대로 (기본값)</td></tr>
      <tr><td><code>GPIOD_LINE_DIRECTION_INPUT</code></td><td>입력 (버튼 읽기)</td></tr>
      <tr><td><code>GPIOD_LINE_DIRECTION_OUTPUT</code></td><td>출력 (LED 켜기) — L35 에서 사용</td></tr></table>`]],
    related:['gpiod_line_settings_set_direction','settings'] },

  GPIOD_LINE_VALUE_ACTIVE: { kind:'const', role:'loop', title:'GPIOD_LINE_VALUE_ACTIVE / INACTIVE', sig:'GPIOD_LINE_VALUE_INACTIVE = 0, GPIOD_LINE_VALUE_ACTIVE = 1',
    summary:'라인의 <b>논리 값</b>. 이 코드에서는 ACTIVE = High(3.3V) = LED 켜짐.',
    sections:[
      ['쓰임', `<table><tr><th>줄</th><th>값</th><th>의미</th></tr>
        <tr><td><span class="link" data-line="36">L36</span></td><td>INACTIVE</td><td>요청하는 순간의 처음 출력 값 (꺼진 상태로 시작)</td></tr>
        <tr><td><span class="link" data-line="55">L55</span></td><td>둘 중 하나</td><td><code>on</code> 에 따라 켜기 / 끄기</td></tr>
        <tr><td><span class="link" data-line="60">L60</span></td><td>INACTIVE</td><td>끝내기 전에 끄기</td></tr></table>`],
      ['논리 값 ≠ 전압', '<p>active-low 설정을 하면 ACTIVE 가 Low 가 된다. 이 코드는 설정하지 않았으므로 ACTIVE = High 다.</p>'],
    ], related:['gpiod_line_request_set_value','gpiod_line_settings_set_output_value','on'] },

  /* ---------- 연산자 / 키워드 ---------- */
  op_not: { kind:'op', role:'loop', title:'!', sig:'!x  (논리 NOT)',
    summary:'0 이면 1, 0 이 아니면 0.',
    sections:[['쓰임', `<table><tr><th>줄</th><th>코드</th><th>의미</th></tr>
      <tr><td><span class="link" data-line="31">L31</span></td><td><code>if (!chip)</code></td><td>칩 열기 실패(NULL)?</td></tr>
      <tr><td><span class="link" data-line="48">L48</span></td><td><code>if (!req)</code></td><td>라인 요청 실패(NULL)?</td></tr>
      <tr><td><span class="link" data-line="52">L52</span></td><td><code>while (!g_stop)</code></td><td>깃발이 아직 0 인 동안</td></tr>
      <tr><td><span class="link" data-line="53">L53</span></td><td><code>on = !on</code></td><td>0 ↔ 1 뒤집기</td></tr></table>`]],
    related:['chip','req','g_stop','on'] },

  op_ternary: { kind:'op', role:'loop', title:'? :', sig:'조건 ? A : B',
    summary:'조건이 참이면 A, 거짓이면 B.',
    sections:[['쓰임', `<p><span class="link" data-line="55">L55</span> <code>on</code> 이 1 이면 <code>GPIOD_LINE_VALUE_ACTIVE</code>, 0 이면 <code>GPIOD_LINE_VALUE_INACTIVE</code></p>`]],
    related:['on','GPIOD_LINE_VALUE_ACTIVE'] },

  op_addr: { kind:'op', role:'init', title:'&', sig:'&x  (주소 연산자)',
    summary:'변수의 <b>메모리 주소</b>를 얻는다.',
    sections:[['쓰임', `<table><tr><th>코드</th><th>이유</th></tr>
      <tr><td><code>memset(&amp;sa, …)</code>, <code>sigaction(…, &amp;sa, …)</code></td><td>구조체를 복사하지 않고 주소로 넘긴다</td></tr>
      <tr><td><code>add_line_settings(line_cfg, &amp;offset, 1, …)</code></td><td>라인 번호 <b>배열</b>을 받는 자리에 변수 하나를 길이 1 배열로 넘긴다</td></tr>
      <tr><td><code>nanosleep(&amp;ts, NULL)</code></td><td>대기 시간을 주소로 넘긴다</td></tr></table>`]],
    related:['sigaction','offset','ts'] },

  cleanup: { kind:'kw', role:'cleanup', title:'goto cleanup', sig:'goto cleanup;   …   cleanup:',
    summary:'오류가 나도 정상이어도 <b>같은 해제 코드</b>를 지나가게 하는 하나뿐인 출구.',
    sections:[['경로', `<pre><code>정상: 루프 끝 → LED 끄기 → 반납 → ret = SUCCESS ─┐
라인 요청 실패 (L48) ── goto cleanup ─────────────┤
                                                 ▼
  cleanup: req_cfg → line_cfg → settings → chip 해제 → return ret</code></pre>
      <p>만든 순서의 <b>거꾸로</b> 해제한다. L31 의 칩 열기 실패는 해제할 것이 없으므로 cleanup 을 거치지 않고 바로 반환한다.</p>`]],
    related:['ret','gpiod_chip_close'] },
};

/* ------------------------------------------------------------
 * 함수 카드 (고정 틀: 파라미터 → 리턴값 → 동작 → 실패 원인 → 관련 변수/함수)
 *   params : [이름, 타입, 이 코드에서 넘긴 값, 설명]
 *   ret    : [값, 의미, 이 코드의 처리]
 *   fails  : [원인, 증상 / errno, 이 코드에서 일어나는 일, 대처]
 *   vars   : [심볼 키 또는 이름, 관계]      funcs : [심볼 키, 관계]
 * ------------------------------------------------------------ */
Object.assign(SYM, {
  main: { kind:'func', role:'init', sig:'int main(void)',
    summary:'프로그램 전체. Ctrl+C 준비 → libgpiod 객체 ①~⑤ 만들기 → 깜빡임 루프 → LED 끄고 반납 → 객체 해제.',
    params:[],
    paramNote:'명령줄 인자를 받지 않는다. 칩과 라인 번호는 매크로로 고정되어 있다.',
    ret:[
      ['<code>EXIT_SUCCESS</code> (0)', '정상 종료: Ctrl+C 로 루프를 끝내고 라인을 반납함', 'L63 에서 <code>ret</code> 에 넣고 L70 반환'],
      ['<code>EXIT_FAILURE</code> (1)', '칩 열기 실패 또는 라인 요청 실패', 'L31 바로 반환 / L48 → cleanup → L70 반환'],
    ],
    retNote:'셸에서 <code>./01_blink; echo $?</code> 로 확인할 수 있다.',
    how:`<div class="space-y-1.5">${SECTIONS.filter(s => s.title && s.from >= 18).map(s =>
        `<div class="flex gap-2 items-start"><span class="w-2 h-2 mt-2 rounded-full ${ROLES[s.role].color}"></span>
         <span class="link mono text-xs mt-0.5" data-line="${s.from}">L${s.from}${s.to!==s.from?'–'+s.to:''}</span>
         <span><b>${s.title}</b> <span class="text-slate-500 text-sm">${s.desc}</span></span></div>`).join('')}</div>`,
    fails:[
      ['libgpiod v1 만 설치됨', '빌드 오류: <code>implicit declaration of function \'gpiod_line_settings_new\'</code>', '실행 파일이 만들어지지 않음', '<code>pkg-config --modversion libgpiod</code> 로 2.x 인지 확인. Raspberry Pi OS Bookworm 의 기본 패키지는 1.6 이다'],
      ['칩 장치가 없음 / 권한 없음', '<code>gpiod_chip_open: No such file or directory</code> / <code>Permission denied</code>', 'L31 에서 1 반환', '<span class="link" data-go="gpiod_chip_open">gpiod_chip_open</span> 카드 참고'],
      ['다른 프로그램이 GPIO17 사용 중', '<code>gpiod_chip_request_lines: Device or resource busy</code>', 'L48 → cleanup → 1 반환', '<code>gpioinfo</code> 로 사용자 확인 후 그 프로그램 종료'],
      ['<code>kill</code> (SIGTERM) 로 종료', '오류 없음', 'L60 을 건너뜀 → <b>LED 가 켜진 채로 남을 수 있음</b> (추정)', 'Ctrl+C 로 끝내거나 SIGTERM 도 등록'],
      ['L34·L39·L43 의 생성 실패 (메모리 부족)', '<code>Segmentation fault</code>', '리턴값을 확인하지 않아 NULL 로 계속 진행', '각 생성 직후 NULL 검사 → cleanup'],
    ],
    vars:[['offset','라인 번호 17'],['ret','종료 코드'],['chip','① 칩'],['settings','② 라인 설정'],['line_cfg','③ 라인 설정 묶음'],['req_cfg','④ 요청 설정'],['req','⑤ 라인 사용권'],['on','켜기/끄기 차례'],['g_stop','루프 종료 조건']],
    funcs:[['sigaction','Ctrl+C 준비'],['gpiod_chip_open','① 칩 열기'],['gpiod_line_settings_new','② 라인 설정'],['gpiod_line_config_new','③ 묶음'],['gpiod_request_config_new','④ 요청 설정'],['gpiod_chip_request_lines','⑤ 요청'],['gpiod_line_request_set_value','LED 켜고 끄기'],['nanosleep','지연'],['gpiod_line_request_release','⑥ 반납']] },

  on_sigint: { kind:'func', role:'global', sig:'static void on_sigint(int sig)',
    summary:'Ctrl+C(SIGINT)가 오면 커널이 불러 주는 신호 핸들러. 종료 깃발만 세운다.',
    params:[['sig','int','커널이 넣어 줌: <code>SIGINT</code> (= 2)','어떤 신호로 불렸는지. 쓰지 않아서 <code>(void)sig;</code> 로 경고를 끈다']],
    ret:[['없음 (<code>void</code>)', '원래 실행하던 곳으로 복귀', '자고 있던 <code>nanosleep</code> 은 바로 깨어난다']],
    how:'<p><code>g_stop = 1;</code> 한 줄. main 이 L52 에서 루프 조건을 확인할 때 빠져나와 LED 를 끄고 라인을 반납한다.</p>',
    fails:[
      ['핸들러 안에서 <code>printf</code>·libgpiod 함수 호출', '가끔 멈춤, 출력 깨짐 — 재현이 어렵다', '이 코드는 하지 않음 (안전)', '깃발만 세우고 나머지는 main 에서'],
      ['핸들러 등록 실패', 'Ctrl+C 에 그냥 죽음 → LED 가 켜진 채 남을 수 있음', '<code>sigaction</code> 리턴값을 확인하지 않는다', '리턴값 확인'],
    ],
    vars:[['g_stop','1 로 바꾼다']],
    funcs:[['sigaction','이 함수를 등록'],['nanosleep','신호가 오면 일찍 깨어남']] },

  sigaction: { kind:'func', role:'signal', title:'sigaction (sa)', sig:'int sigaction(int signum, const struct sigaction *act, struct sigaction *oldact);',
    summary:'신호가 왔을 때 할 일을 등록한다. 코드의 <code>struct sigaction sa</code> 는 그 설정을 담는 구조체.',
    params:[
      ['signum', 'int', '<code>SIGINT</code>', '처리 방법을 바꿀 신호'],
      ['act', 'const struct sigaction *', '<code>&amp;sa</code>', '새 설정: <code>sa_handler = on_sigint</code>, <code>sa_flags = 0</code> (SA_RESTART 없음)'],
      ['oldact', 'struct sigaction *', '<code>NULL</code>', '이전 설정을 받을 곳. 필요 없음'],
    ],
    ret:[['0', '성공', '—'],['-1', '실패 (errno)', '<b>확인하지 않는다</b>']],
    how:'<p>SA_RESTART 를 넣지 않았으므로, 신호를 받으면 잠들어 있던 <code>nanosleep</code> 이 바로 돌아와 루프가 즉시 끝난다. 최대 0.5초를 기다리지 않는다.</p>',
    fails:[
      ['잘못된 신호, SIGKILL/SIGSTOP', 'EINVAL', '해당 없음', '—'],
      ['<code>memset</code> 을 빠뜨림', '실패는 아니지만 <code>sa_flags</code>·<code>sa_mask</code> 에 쓰레기 값', 'L25 memset 으로 방지', '구조체는 항상 0 으로 초기화'],
      ['SIGTERM 미등록', '<code>kill</code> 로 끝내면 LED 끄기·반납을 건너뜀', '이 예제의 한계', '<code>sigaction(SIGTERM, &amp;sa, NULL)</code> 추가 (gpio_common.h 처럼)'],
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
    how:'<p>지역 변수 <code>sa</code> 의 쓰레기 값을 지워 <code>sa_handler</code> 외의 칸(플래그, 마스크)이 모두 0 이 되게 한다.</p>',
    fails:[['<code>n</code> 을 잘못 줌 (<code>sizeof &amp;sa</code>)', '실패 표시 없이 일부만 초기화', '<code>sizeof sa</code> 로 올바름', '변수 이름으로 sizeof']],
    vars:[['sa','0 으로 채울 대상']],
    funcs:[['sigaction','초기화한 sa 를 받음']] },

  gpiod_chip_open: { kind:'func', role:'init', sig:'struct gpiod_chip *gpiod_chip_open(const char *path);',
    summary:'① GPIO 칩 장치 파일을 열어 칩 객체를 만든다.',
    params:[['path', 'const char *', '<code>CHIP_PATH</code> = <code>"/dev/gpiochip0"</code>', '열 장치 파일 경로. GPIO 문자 장치가 아니면 실패']],
    ret:[
      ['<code>struct gpiod_chip *</code>', '성공', '<code>chip</code> 에 저장'],
      ['<code>NULL</code>', '실패, errno 에 이유', 'L31 perror 출력 후 <code>return EXIT_FAILURE</code>'],
    ],
    how:'<p>장치 파일을 <code>open()</code> 하고, 그것이 정말 GPIO 칩인지 커널에 물어 확인한 뒤 객체를 만든다. 이 단계에서는 아직 어떤 라인도 차지하지 않는다.</p>',
    fails:[
      ['장치 파일이 없음 (PC, VM, 다른 보드)', '<code>gpiod_chip_open: No such file or directory</code> (ENOENT)', 'L31 에서 종료, 코드 1', '<code>ls /dev/gpiochip*</code> 로 확인, <code>CHIP_PATH</code> 수정'],
      ['권한 없음', '<code>gpiod_chip_open: Permission denied</code> (EACCES)', 'L31 에서 종료, 코드 1', '<code>sudo usermod -aG gpio $USER</code> 후 다시 로그인'],
      ['GPIO 장치가 아닌 파일', '<code>No such device</code> / <code>Inappropriate ioctl for device</code> (추정)', 'L31 에서 종료, 코드 1', '<code>gpiodetect</code> 가 보여 주는 칩 이름 사용'],
      ['칩 번호가 틀림 (Raspberry Pi 5 등)', '오류 없음', '열리지만 다른 칩이라 LED 가 안 켜짐 (추정)', '<code>gpioinfo</code> 에서 <code>GPIO17</code> 이름이 있는 칩 확인'],
    ],
    vars:[['chip','리턴값을 저장'],['CHIP_PATH','파라미터로 넘김']],
    funcs:[['gpiod_chip_close','짝: 칩 닫기'],['gpiod_chip_request_lines','다음 단계: chip 으로 라인 요청'],['perror','실패 이유 출력']] },

  perror: { kind:'func', role:'init', sig:'void perror(const char *s);',
    summary:'방금 실패한 이유(errno)를 문장으로 stderr 에 출력한다.',
    params:[['s','const char *','L31 <code>"gpiod_chip_open"</code><br>L48 <code>"gpiod_chip_request_lines"</code>','앞에 붙일 이름 → <code>gpiod_chip_open: Permission denied</code>']],
    ret:[['없음 (<code>void</code>)', '—', '—']],
    how:'<p>libgpiod 함수도 실패하면 errno 를 남긴다. 두 호출 모두 실패 <b>바로 다음</b>이라 정확한 이유가 나온다.</p>',
    fails:[['나중에 호출', '다른 함수가 errno 를 바꿔 엉뚱한 이유 출력', 'L31·L48 은 실패 직후 → 올바름', '실패 바로 다음 줄에서']],
    vars:[['chip','NULL 일 때 호출'],['req','NULL 일 때 호출']],
    funcs:[['gpiod_chip_open','L31 실패 시'],['gpiod_chip_request_lines','L48 실패 시']] },

  gpiod_line_settings_new: { kind:'func', role:'init', sig:'struct gpiod_line_settings *gpiod_line_settings_new(void);',
    summary:'② 기본값이 들어 있는 빈 라인 설정 객체를 만든다.',
    params:[],
    ret:[
      ['<code>struct gpiod_line_settings *</code>', '성공', '<code>settings</code> 에 저장'],
      ['<code>NULL</code>', '메모리 부족 (ENOMEM)', '<b>확인하지 않는다</b>'],
    ],
    how:'<p>메모리를 할당하고 방향 AS_IS, 출력 값 INACTIVE 등 기본값을 채운다. 커널과는 아직 아무 이야기도 하지 않는다.</p>',
    fails:[['메모리 부족', 'NULL (ENOMEM)', 'L35 에서 NULL 을 넘겨 <b>Segmentation fault</b>', '<code>if (!settings) goto cleanup;</code>']],
    failNote:'실제로 일어날 일은 거의 없지만, 다른 생성 함수(L39, L43)도 같은 방식으로 확인하지 않는다.',
    vars:[['settings','리턴값을 저장']],
    funcs:[['gpiod_line_settings_free','짝: 해제'],['gpiod_line_settings_set_direction','다음: 방향 설정'],['gpiod_line_settings_set_output_value','다음: 처음 값 설정']] },

  gpiod_line_settings_set_direction: { kind:'func', role:'init', sig:'int gpiod_line_settings_set_direction(struct gpiod_line_settings *settings, enum gpiod_line_direction direction);',
    summary:'라인 설정에 방향(입력/출력)을 적는다.',
    params:[
      ['settings', 'struct gpiod_line_settings *', '<code>settings</code>', '적을 대상. NULL 이면 안 됨'],
      ['direction', 'enum gpiod_line_direction', '<code>GPIOD_LINE_DIRECTION_OUTPUT</code>', 'AS_IS / INPUT / OUTPUT 중 하나'],
    ],
    ret:[['0', '성공', '—'],['-1', '잘못된 방향 값 (EINVAL)', '<b>확인하지 않는다</b>']],
    how:'<p>객체 안의 값만 바꾼다. 핀은 아직 그대로다. 실제 핀이 출력으로 바뀌는 것은 L47 요청이 성공하는 순간이다.</p>',
    fails:[
      ['잘못된 방향 값', '-1 (EINVAL), 설정은 바뀌지 않음', '해당 없음 (올바른 상수)', '—'],
      ['settings 가 NULL', '<code>Segmentation fault</code>', 'L34 를 확인하지 않아 가능', 'L34 뒤에 NULL 검사'],
      ['방향 설정을 빠뜨림', '오류 없음. AS_IS 라 입력 상태면 set_value 가 실패', '해당 없음', '출력이면 반드시 OUTPUT'],
    ],
    vars:[['settings','적을 대상'],['GPIOD_LINE_DIRECTION_OUTPUT','적을 값']],
    funcs:[['gpiod_line_settings_new','settings 를 만듦'],['gpiod_line_settings_set_output_value','같은 객체에 처음 값 적기']] },

  gpiod_line_settings_set_output_value: { kind:'func', role:'init', sig:'int gpiod_line_settings_set_output_value(struct gpiod_line_settings *settings, enum gpiod_line_value value);',
    summary:'출력 라인이 <b>요청되는 순간</b>의 처음 값을 적는다.',
    params:[
      ['settings', 'struct gpiod_line_settings *', '<code>settings</code>', '적을 대상'],
      ['value', 'enum gpiod_line_value', '<code>GPIOD_LINE_VALUE_INACTIVE</code> (0)', 'ACTIVE / INACTIVE'],
    ],
    ret:[['0', '성공', '—'],['-1', '잘못된 값 (EINVAL)', '<b>확인하지 않는다</b>']],
    how:'<p>요청과 동시에 핀이 Low 로 시작하게 한다. 이것이 없으면 요청 직후 잠깐 이전 값이 나올 수 있다. 첫 반복에서 L54 가 바로 켜므로, 사람 눈에는 시작하자마자 켜진다.</p>',
    fails:[
      ['잘못된 값', '-1 (EINVAL)', '해당 없음 (올바른 상수)', '—'],
      ['settings 가 NULL', '<code>Segmentation fault</code>', 'L34 를 확인하지 않아 가능', 'L34 뒤에 NULL 검사'],
    ],
    vars:[['settings','적을 대상'],['GPIOD_LINE_VALUE_ACTIVE','INACTIVE 를 적음']],
    funcs:[['gpiod_line_settings_set_direction','같은 객체에 방향 적기'],['gpiod_line_request_set_value','요청 뒤에 값을 바꾸는 함수']] },

  gpiod_line_config_new: { kind:'func', role:'init', sig:'struct gpiod_line_config *gpiod_line_config_new(void);',
    summary:'③ 빈 라인 설정 묶음 객체를 만든다.',
    params:[],
    ret:[
      ['<code>struct gpiod_line_config *</code>', '성공', '<code>line_cfg</code> 에 저장'],
      ['<code>NULL</code>', '메모리 부족 (ENOMEM)', '<b>확인하지 않는다</b>'],
    ],
    how:'<p>아직 어떤 라인도 들어 있지 않은 묶음을 만든다. 다음 줄에서 라인 17 을 넣는다.</p>',
    fails:[['메모리 부족', 'NULL (ENOMEM)', 'L40 에 NULL 을 넘김 → Segmentation fault (추정)', '<code>if (!line_cfg) goto cleanup;</code>']],
    vars:[['line_cfg','리턴값을 저장']],
    funcs:[['gpiod_line_config_free','짝: 해제'],['gpiod_line_config_add_line_settings','다음: 라인과 설정 넣기']] },

  gpiod_line_config_add_line_settings: { kind:'func', role:'init', sig:'int gpiod_line_config_add_line_settings(struct gpiod_line_config *config, const unsigned int *offsets, size_t num_offsets, struct gpiod_line_settings *settings);',
    summary:'라인 번호 목록에 설정을 붙여 묶음에 넣는다.',
    params:[
      ['config', 'struct gpiod_line_config *', '<code>line_cfg</code>', '넣을 묶음'],
      ['offsets', 'const unsigned int *', '<code>&amp;offset</code> → { 17 }', '라인 번호 배열'],
      ['num_offsets', 'size_t', '<code>1</code>', '배열 길이'],
      ['settings', 'struct gpiod_line_settings *', '<code>settings</code>', '적용할 설정. 묶음 안으로 <b>복사</b>된다'],
    ],
    ret:[['0', '성공', '—'],['-1', '실패 (errno)', '<b>확인하지 않는다</b>']],
    how:'<p>"라인 17 = 출력, 처음 값 0" 이라는 항목을 묶음에 추가한다. 라인 번호가 칩에 실제로 있는지는 여기서 검사하지 않고, L47 요청 때 커널이 검사한다.</p>',
    fails:[
      ['라인이 너무 많음 (64개 초과)', '-1 (E2BIG)', '해당 없음 (1개)', '—'],
      ['실패를 무시', '묶음이 비어 있음', 'L47 요청이 실패해 원인을 헷갈리게 함 (추정)', '리턴값 확인'],
      ['칩에 없는 라인 번호', '여기서는 성공', 'L47 에서 <code>Invalid argument</code> (EINVAL)', '<code>gpioinfo</code> 로 라인 수 확인'],
    ],
    vars:[['line_cfg','넣을 묶음'],['offset','라인 번호'],['settings','붙일 설정'],['LED_LINE','offset 의 값']],
    funcs:[['gpiod_line_config_new','묶음을 만듦'],['gpiod_chip_request_lines','다음 단계: 묶음으로 요청']] },

  gpiod_request_config_new: { kind:'func', role:'init', sig:'struct gpiod_request_config *gpiod_request_config_new(void);',
    summary:'④ 요청 전체 설정 객체를 만든다.',
    params:[],
    ret:[
      ['<code>struct gpiod_request_config *</code>', '성공', '<code>req_cfg</code> 에 저장'],
      ['<code>NULL</code>', '메모리 부족 (ENOMEM)', '<b>확인하지 않는다</b>'],
    ],
    how:'<p>consumer 이름과 이벤트 버퍼 크기를 담는 객체다. 이 코드는 consumer 이름만 쓴다.</p>',
    fails:[['메모리 부족', 'NULL (ENOMEM)', 'L44 에 NULL 을 넘겨 Segmentation fault (추정)', '<code>if (!req_cfg) goto cleanup;</code>']],
    vars:[['req_cfg','리턴값을 저장']],
    funcs:[['gpiod_request_config_free','짝: 해제'],['gpiod_request_config_set_consumer','다음: 이름 적기']] },

  gpiod_request_config_set_consumer: { kind:'func', role:'init', sig:'void gpiod_request_config_set_consumer(struct gpiod_request_config *config, const char *consumer);',
    summary:'요청한 쪽의 이름(consumer)을 적는다. <code>gpioinfo</code> 에 보인다.',
    params:[
      ['config', 'struct gpiod_request_config *', '<code>req_cfg</code>', '적을 대상'],
      ['consumer', 'const char *', '<code>"blink"</code>', '이름. 길면 31자에서 잘린다'],
    ],
    ret:[['없음 (<code>void</code>)', '—', '—']],
    how:'<p>실행 중 다른 터미널에서 <code>gpioinfo</code> 를 보면 라인 17 이 <code>output consumer="blink"</code> 처럼 나온다 (출력 모양은 libgpiod 버전마다 다름). 누가 라인을 쓰는지 찾을 때 쓴다.</p>',
    fails:[
      ['config 가 NULL', '<code>Segmentation fault</code>', 'L43 을 확인하지 않아 가능', 'L43 뒤에 NULL 검사'],
      ['이름을 안 줌', '오류 없음. gpioinfo 에 이름이 비어 보임', '해당 없음', '알아보기 쉬운 이름 지정'],
    ],
    vars:[['req_cfg','적을 대상']],
    funcs:[['gpiod_request_config_new','req_cfg 를 만듦'],['gpiod_chip_request_lines','이 설정을 받아 요청']] },

  gpiod_chip_request_lines: { kind:'func', role:'init', sig:'struct gpiod_line_request *gpiod_chip_request_lines(struct gpiod_chip *chip, struct gpiod_request_config *req_cfg, struct gpiod_line_config *line_cfg);',
    summary:'⑤ 커널에 라인을 요청한다. 성공하면 이 프로세스가 라인의 <b>소유자</b>가 된다.',
    params:[
      ['chip', 'struct gpiod_chip *', '<code>chip</code> (<code>/dev/gpiochip0</code>)', '라인이 있는 칩'],
      ['req_cfg', 'struct gpiod_request_config *', '<code>req_cfg</code> (consumer = "blink")', '요청 전체 설정. NULL 이면 기본값'],
      ['line_cfg', 'struct gpiod_line_config *', '<code>line_cfg</code> (라인 17 = 출력, 0)', '라인별 설정'],
    ],
    ret:[
      ['<code>struct gpiod_line_request *</code>', '성공. 핀이 출력 Low 로 바뀜', '<code>req</code> 에 저장 → 루프로'],
      ['<code>NULL</code>', '실패, errno 에 이유', 'L48 perror → <code>goto cleanup</code> → 코드 1'],
    ],
    how:'<p>앞에서 만든 설정을 커널에 한 번에 보낸다. 커널은 라인 번호를 검사하고, 다른 사용자가 없으면 라인을 내주고 방향·처음 값을 실제 핀에 적용한다. 이 순간부터 GPIO17 이 출력 Low 가 된다.</p>',
    fails:[
      ['다른 프로세스가 사용 중', '<code>gpiod_chip_request_lines: Device or resource busy</code> (EBUSY)', 'L48 → cleanup → 1 반환', '<code>gpioinfo</code> 로 consumer 확인 후 그 프로그램 종료. 01_blink 를 두 번 실행해도 이렇게 된다'],
      ['커널 드라이버가 사용 중 (오버레이)', '<code>Device or resource busy</code> (EBUSY)', '위와 같음', '<code>/boot/firmware/config.txt</code> 에서 GPIO17 을 쓰는 오버레이 확인'],
      ['칩에 없는 라인 번호', '<code>Invalid argument</code> (EINVAL)', '위와 같음', '<code>gpioinfo</code> 로 라인 수 확인, <code>LED_LINE</code> 수정'],
      ['권한 없음', '<code>Permission denied</code> (EACCES)', '보통 L31 에서 먼저 막힘', 'gpio 그룹 추가'],
    ],
    failNote:'요청 실패는 <b>종료 코드 1</b> 로 끝나고, cleanup 에서 ②~④ 객체와 칩을 모두 해제하므로 메모리 누수는 없다.',
    vars:[['req','리턴값을 저장'],['chip','파라미터'],['req_cfg','파라미터'],['line_cfg','파라미터']],
    funcs:[['gpiod_line_request_release','짝: 반납'],['gpiod_line_request_set_value','다음: 값 쓰기'],['gpiod_chip_open','chip 을 만듦'],['perror','실패 이유 출력']] },

  printf: { kind:'func', role:'loop', sig:'int printf(const char *format, ...);',
    summary:'화면(표준 출력)에 형식대로 출력한다.',
    params:[
      ['format', 'const char *', 'L50 <code>"GPIO%d 깜빡임 시작 (Ctrl+C 로 종료)\\n"</code><br>L62 <code>"\\n라인 반납 완료\\n"</code>', '<code>%d</code> = int 정수'],
      ['...', '가변 인자', 'L50 <code>LED_LINE</code> = 17', '형식 자리에 들어갈 값'],
    ],
    ret:[['출력한 바이트 수', '성공', '쓰지 않는다'],['음수', '실패', '확인하지 않는다']],
    how:'<p>L62 맨 앞의 <code>\\n</code> 은 Ctrl+C 를 누르면 찍히는 <code>^C</code> 다음 줄에 출력하려는 것이다.</p>',
    fails:[
      ['형식과 인자 타입 불일치', '엉뚱한 값', '<code>17</code> 은 int 라 <code>%d</code> 로 올바름', '<code>-Wall</code> 경고 확인'],
      ['출력을 파일로 돌렸는데 안 보임', '버퍼에 머묾', '정상 종료하면 L70 return 때 출력됨', '<code>fflush(stdout)</code>'],
    ],
    vars:[['LED_LINE','출력할 라인 번호']],
    funcs:[['gpiod_line_request_release','L62 는 반납 직후 출력']] },

  gpiod_line_request_set_value: { kind:'func', role:'loop', sig:'int gpiod_line_request_set_value(struct gpiod_line_request *request, unsigned int offset, enum gpiod_line_value value);',
    summary:'요청한 라인 하나에 값을 쓴다. 이 코드에서는 <b>LED 를 켜고 끈다</b>.',
    params:[
      ['request', 'struct gpiod_line_request *', '<code>req</code>', '값을 쓸 요청. 반납한 뒤에는 쓰면 안 됨'],
      ['offset', 'unsigned int', '<code>offset</code> = 17', '요청에 들어 있는 라인이어야 함'],
      ['value', 'enum gpiod_line_value', 'L55 <code>on ? ACTIVE : INACTIVE</code><br>L60 <code>INACTIVE</code>', 'ACTIVE(1) = High, INACTIVE(0) = Low'],
    ],
    ret:[['0', '성공', '—'],['-1', '실패 (errno)', '<b>확인하지 않는다</b> — 실패해도 루프는 계속 돈다']],
    how:`<table><tr><th>줄</th><th>상황</th><th>쓰는 값</th></tr>
      <tr><td><span class="link" data-line="54">L54</span></td><td>루프 안, 0.5초마다</td><td>ACTIVE ↔ INACTIVE 번갈아</td></tr>
      <tr><td><span class="link" data-line="60">L60</span></td><td>루프를 빠져나온 뒤</td><td>INACTIVE — LED 를 끄고 반납</td></tr></table>
      <p>호출마다 커널에 값을 보내 핀 전압이 바로 바뀐다.</p>`,
    fails:[
      ['요청에 없는 라인 번호', '-1 (EINVAL)', '해당 없음 (같은 offset)', '요청한 offset 과 같은지 확인'],
      ['반납한 뒤 호출', '정의되지 않은 동작 / Segmentation fault', '해당 없음 (L61 이 마지막)', '반납 뒤 <code>req = NULL</code>'],
      ['LED 가 안 켜짐 (배선)', '오류 없음 (0 반환)', '코드는 정상인데 아무 변화 없음', 'LED 방향(긴 다리 = +), 핀 번호(헤더 11번), 저항 확인'],
    ],
    failNote:'GPIO 는 결과를 다시 읽어 확인하지 않는다. 함수가 0 을 돌려줘도 LED 가 실제로 켜졌는지는 <b>배선에 달려 있다</b>.',
    vars:[['req','값을 쓸 요청'],['offset','라인 17'],['on','켜기/끄기 결정'],['GPIOD_LINE_VALUE_ACTIVE','쓰는 값']],
    funcs:[['gpiod_chip_request_lines','req 를 만듦'],['gpiod_line_request_release','다음: 반납'],['nanosleep','값을 쓴 뒤 0.5초 대기']] },

  nanosleep: { kind:'func', role:'delay', sig:'int nanosleep(const struct timespec *req, struct timespec *rem);',
    summary:'지정한 시간 동안 프로세스를 잠재운다 (CPU 를 쓰지 않음).',
    params:[
      ['req', 'const struct timespec *', '<code>&amp;ts</code> = { 0초, 500,000,000 ns }', '잘 시간. tv_nsec 은 0 ~ 999,999,999'],
      ['rem', 'struct timespec *', '<code>NULL</code>', '일찍 깨어났을 때 남은 시간. 버림'],
    ],
    ret:[['0', '다 잠', '—'],['-1 + EINTR', 'Ctrl+C 로 깨어남', '의도된 종료 경로 (리턴값은 안 봄)'],['-1 + EINVAL', '잘못된 시간', '확인하지 않음']],
    how:'<p>LED 상태를 0.5초 유지한다. 켜짐 0.5초 + 꺼짐 0.5초 = 1초에 한 번 깜빡인다. SA_RESTART 가 없어서 Ctrl+C 에 즉시 깨어난다.</p>',
    fails:[
      ['tv_nsec 범위 밖 (예: <code>1000 * 1000000L</code>)', 'EINVAL — <b>전혀 안 잠</b> → LED 가 너무 빨라 켜진 듯 보임', '해당 없음 (0.5초)', '1초 이상은 tv_sec 에'],
      ['신호로 깨어남', 'EINTR', '의도된 동작', '—'],
    ],
    vars:[['ts','잘 시간']],
    funcs:[['gpiod_line_request_set_value','잠들기 전에 값을 씀'],['sigaction','신호에 깨어나도록 설정']] },

  gpiod_line_request_release: { kind:'func', role:'shutdown', sig:'void gpiod_line_request_release(struct gpiod_line_request *request);',
    summary:'⑥ 라인을 커널에 돌려주고 요청 객체를 해제한다.',
    params:[['request', 'struct gpiod_line_request *', '<code>req</code>', '반납할 요청. 이후 사용 금지']],
    ret:[['없음 (<code>void</code>)', '—', '이어서 L62 메시지 출력']],
    how:'<p>요청의 파일 디스크립터를 닫아 다른 프로그램이 GPIO17 을 쓸 수 있게 한다. 반납 뒤 핀 전압이 유지되는지는 드라이버에 따라 다르므로 (추정), 바로 앞 L60 에서 먼저 LED 를 끈다.</p>',
    fails:[
      ['반납을 빠뜨림', '프로세스가 끝나면 커널이 자동 회수', '해당 없음 (L61 에서 반납)', '오래 도는 프로그램이면 반드시 반납'],
      ['두 번 반납', '정의되지 않은 동작', '해당 없음', '반납 뒤 <code>req = NULL</code>'],
      ['라인 요청 실패 경로', 'req 가 NULL', 'L48 에서 cleanup 으로 건너뛰어 호출 안 함 (올바름)', '—'],
    ],
    vars:[['req','반납 대상']],
    funcs:[['gpiod_chip_request_lines','짝: 요청'],['gpiod_line_request_set_value','반납 전에 LED 끄기']] },

  gpiod_request_config_free: { kind:'func', role:'cleanup', sig:'void gpiod_request_config_free(struct gpiod_request_config *config);',
    summary:'④ 요청 설정 객체를 해제한다.',
    params:[['config', 'struct gpiod_request_config *', '<code>req_cfg</code>', '해제할 객체. NULL 이면 아무것도 안 함']],
    ret:[['없음 (<code>void</code>)', '—', '—']],
    how:'<p>메모리만 돌려준다. 요청(<code>req</code>)은 이미 만들어졌으므로 설정을 해제해도 영향이 없다.</p>',
    fails:[['두 번 해제', 'double free → 비정상 종료', '해당 없음 (한 번)', '해제 뒤 NULL']],
    vars:[['req_cfg','해제 대상']],
    funcs:[['gpiod_request_config_new','짝: 생성']] },

  gpiod_line_config_free: { kind:'func', role:'cleanup', sig:'void gpiod_line_config_free(struct gpiod_line_config *config);',
    summary:'③ 라인 설정 묶음을 해제한다. 안에 복사된 설정도 함께 해제된다.',
    params:[['config', 'struct gpiod_line_config *', '<code>line_cfg</code>', '해제할 묶음. NULL 이면 아무것도 안 함']],
    ret:[['없음 (<code>void</code>)', '—', '—']],
    how:'<p>L40 에서 묶음 안으로 복사된 설정까지 함께 정리한다. 원본 <code>settings</code> 는 따로 해제해야 한다 (L68).</p>',
    fails:[['두 번 해제', 'double free → 비정상 종료', '해당 없음 (한 번)', '해제 뒤 NULL']],
    vars:[['line_cfg','해제 대상']],
    funcs:[['gpiod_line_config_new','짝: 생성'],['gpiod_line_settings_free','원본 설정은 따로 해제']] },

  gpiod_line_settings_free: { kind:'func', role:'cleanup', sig:'void gpiod_line_settings_free(struct gpiod_line_settings *settings);',
    summary:'② 라인 설정 객체를 해제한다.',
    params:[['settings', 'struct gpiod_line_settings *', '<code>settings</code>', '해제할 객체. NULL 이면 아무것도 안 함']],
    ret:[['없음 (<code>void</code>)', '—', '—']],
    how:'<p><code>line_cfg</code> 에는 복사본이 들어갔으므로, 이것을 해제해도 다른 객체에 영향이 없다.</p>',
    fails:[['해제를 빠뜨림', '메모리 누수 (프로그램이 끝나면 회수)', '해당 없음 (L68 에서 해제)', '생성과 해제를 짝으로']],
    vars:[['settings','해제 대상']],
    funcs:[['gpiod_line_settings_new','짝: 생성'],['gpiod_line_config_free','묶음 안의 복사본은 이쪽이 해제']] },

  gpiod_chip_close: { kind:'func', role:'cleanup', sig:'void gpiod_chip_close(struct gpiod_chip *chip);',
    summary:'① 칩 장치 파일을 닫고 칩 객체를 해제한다.',
    params:[['chip', 'struct gpiod_chip *', '<code>chip</code>', '닫을 칩. 여기에 오는 경로에서는 항상 NULL 이 아니다']],
    ret:[['없음 (<code>void</code>)', '—', '이어서 L70 <code>return ret</code>']],
    how:'<p>가장 먼저 연 객체라 <b>가장 나중에</b> 닫는다. 칩을 닫아도 이미 받은 요청은 유지되므로, 순서가 바뀌어도 동작하지만 거꾸로 해제하는 습관을 따른다.</p>',
    fails:[
      ['NULL 을 닫기', '아무것도 안 함 (추정)', '해당 없음 — L31 에서 NULL 이면 미리 반환', '—'],
      ['두 번 닫기', '정의되지 않은 동작', '해당 없음', '닫은 뒤 NULL'],
    ],
    vars:[['chip','닫을 대상'],['ret','이어서 반환']],
    funcs:[['gpiod_chip_open','짝: 열기']] },
});

/* 코드 속 이름 → 심볼 키 */
const ALIAS = {
  sig_atomic_t:'g_stop', timespec:'ts', sa:'sigaction', sa_handler:'sigaction',
  gpiod_chip:'chip', gpiod_line_settings:'settings', gpiod_line_config:'line_cfg',
  gpiod_request_config:'req_cfg', gpiod_line_request:'req',
  GPIOD_LINE_VALUE_INACTIVE:'GPIOD_LINE_VALUE_ACTIVE',
  goto:'cleanup', EXIT_SUCCESS:'EXIT_FAILURE',
};

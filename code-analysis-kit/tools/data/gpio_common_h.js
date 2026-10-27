/* data/gpio_common_h.js — upload/gpio_common.h 전용 데이터 (형식: tools/작성방침.md) */

const META = { subtitle:'공통 도우미 헤더 · libgpiod v2 · Ctrl+C 처리, 시간, 라인 요청' };

/* 전체 개요: 제목, 요약, (선택) 루프 시뮬레이션 — 시뮬레이션이 없으면 sim:null */
const OVERVIEW = {
  heading:'여러 예제가 함께 쓰는 GPIO 도우미 함수 모음',
  summary:'main 이 없는 <b>헤더 파일</b>이다. <code>#include "gpio_common.h"</code> 한 소스 파일 안에 그대로 붙여 넣어진다. ' +
          'Ctrl+C 를 받으면 <code>g_stop</code> 을 세우는 신호 처리, 단조 시계로 나노초 재기, Ctrl+C 로 깨어나는 대기, ' +
          '그리고 01_blink.c 에서 다섯 단계로 하던 라인 요청을 <b>한 줄로</b> 줄인 함수 세 개가 들어 있다. ' +
          '모든 함수가 <code>static</code> 이라 이 헤더를 포함한 소스 파일마다 따로 복사본을 갖는다. 보드에서 실행해 보지 않았으므로 하드웨어 동작에 대한 설명은 libgpiod 문서와 소스를 보고 추정한 것이다.',
  sim: null,
};

/* 줄 범위별 역할 (원본 줄 번호). title 이 빈 칸이면 색 띠만 */
const SECTIONS = [
  { from:10, to:11, role:'global',   title:'중복 포함 방지', desc:'<code>#ifndef GPIO_COMMON_H</code> … <code>#endif</code>' },
  { from:20, to:20, role:'global',   title:'칩 경로 매크로', desc:'<code>GPIO_CHIP</code> = <code>"/dev/gpiochip0"</code>' },
  { from:22, to:24, role:'global',   title:'종료 깃발과 신호 핸들러', desc:'<code>g_stop</code>, <code>on_sigint</code>' },
  { from:26, to:35, role:'signal',   title:'gpio_install_sigint()', desc:'SIGINT · SIGTERM → on_sigint, SA_RESTART 없음' },
  { from:37, to:42, role:'loop',     title:'now_ns()', desc:'CLOCK_MONOTONIC 을 나노초 하나로' },
  { from:44, to:48, role:'delay',    title:'sleep_ms()', desc:'ms 를 초·나노초로 나눠 nanosleep' },
  { from:50, to:73, role:'init',     title:'gpio_request()', desc:'칩 열기 → 라인 설정 묶기 → 요청 설정 → 라인 요청' },
  { from:74, to:79, role:'cleanup',  title:'gpio_request() 정리', desc:'요청 설정 → 묶음 → 칩 해제, 요청만 돌려줌' },
  { from:81, to:92, role:'init',     title:'gpio_request_output()', desc:'출력, 처음 값 0 으로 요청' },
  { from:94, to:109, role:'init',    title:'gpio_request_input()', desc:'입력, 풀업, 엣지 감지, 디바운스로 요청' },
  { from:111, to:111, role:'global', title:'', desc:'' },
];

/* 레지스터를 다루지 않는 코드이므로 비워 둔다 */
const REGS = {};

const SYM = {
  /* ---------- 매크로 / 키워드 ---------- */
  GPIO_COMMON_H: { kind:'macro', role:'global', sig:'#ifndef GPIO_COMMON_H\n#define GPIO_COMMON_H\n…\n#endif',
    summary:'<b>헤더 가드.</b> 같은 소스 파일에서 이 헤더가 두 번 포함돼도 내용은 한 번만 들어가게 한다.',
    sections:[
      ['동작', '<p>처음 포함될 때는 <code>GPIO_COMMON_H</code> 가 없으므로 L11 에서 정의하고 내용을 넣는다. 두 번째부터는 L10 조건이 거짓이라 L111 <code>#endif</code> 까지 건너뛴다.</p>'],
      ['없다면', '<p>두 번 포함하는 순간 <code>redefinition of \'g_stop\'</code>, <code>redefinition of \'on_sigint\'</code> 같은 빌드 오류가 난다.</p>'],
      ['⚠ 막지 못하는 것', '<p>가드는 <b>한 소스 파일 안</b>에서만 효과가 있다. 01_blink.c 처럼 <code>g_stop</code>·<code>on_sigint</code> 를 직접 정의한 파일이 이 헤더를 포함하면 여전히 재정의 오류가 난다.</p>'],
    ], related:['static','g_stop'] },

  GPIO_CHIP: { kind:'macro', role:'global', sig:'#define GPIO_CHIP "/dev/gpiochip0"',
    summary:'라인을 요청할 GPIO 칩의 <b>장치 파일</b> 경로. 01_blink.c 의 <code>CHIP_PATH</code> 와 같은 값이다.',
    sections:[
      ['쓰임', '<p><span class="link" data-line="60">L60</span> <code>gpiod_chip_open(GPIO_CHIP)</code> 한 곳. 세 요청 함수가 모두 이 칩만 쓴다.</p>'],
      ['⚠ 주의', '<ul class="list-disc pl-5"><li>헤더에 고정돼 있어서 다른 칩을 쓰려면 헤더를 고쳐야 한다. 함수 파라미터로 받지 않는다</li><li>Raspberry Pi 5 는 커널 버전에 따라 헤더 GPIO 가 <code>gpiochip4</code> 에 있을 수 있다. 그러면 다른 칩의 라인을 요청하게 된다 (추정). <code>gpioinfo</code> 로 확인한다</li></ul>'],
    ], related:['gpiod_chip_open','gpio_request'] },

  static: { kind:'kw', role:'global', sig:'static',
    summary:'"이 이름은 <b>이 소스 파일 안에서만</b> 보인다" 는 표시. 이 헤더의 모든 변수·함수에 붙어 있다.',
    sections:[
      ['헤더에서 static 을 쓰는 이유', '<p>헤더는 포함한 파일마다 복사된다. <code>static</code> 이 없으면 두 .c 파일이 같은 헤더를 포함해 함께 링크할 때 <code>multiple definition of \'g_stop\'</code> 링크 오류가 난다. <code>static</code> 이면 파일마다 자기 복사본을 가져 충돌하지 않는다.</p>'],
      ['⚠ 함정', '<p>복사본이 따로라는 것은 <b><code>g_stop</code> 도 파일마다 따로</b>라는 뜻이다. 프로그램을 두 .c 파일로 나눠 한쪽에서 <code>gpio_install_sigint()</code> 를 부르면, Ctrl+C 때 그 파일의 <code>g_stop</code> 만 1 이 된다. 다른 파일의 루프는 끝나지 않는다. 지금 예제들처럼 .c 파일 하나짜리 프로그램에서는 문제가 없다.</p>'],
    ], related:['inline','g_stop','GPIO_COMMON_H'] },

  inline: { kind:'kw', role:'global', sig:'static inline',
    summary:'"호출하는 자리에 함수 본문을 펼쳐 넣어도 된다" 는 힌트.',
    sections:[
      ['이 헤더에서', '<p>여섯 함수 모두 <code>static inline</code> 이다. 실제 이점은 속도보다, 포함한 파일이 함수를 쓰지 않아도 <code>-Wall</code> 의 <code>defined but not used</code> 경고가 나지 않는다는 것이다.</p>'],
      ['예외', '<p><code>on_sigint</code> 는 <code>inline</code> 이 아니다. 주소를 넘겨 커널이 부르는 함수라 펼쳐 넣을 수 없고, <code>gpio_install_sigint</code> 에서 쓰이므로 경고도 나지 않는다.</p>'],
    ], related:['static','on_sigint'] },

  /* ---------- 전역 / 신호 ---------- */
  g_stop: { kind:'var', role:'global', sig:'static volatile sig_atomic_t g_stop = 0;',
    summary:'<b>종료 깃발.</b> Ctrl+C 나 <code>kill</code> 을 받으면 1 이 된다. 포함한 쪽의 메인 루프가 읽는다.',
    sections:[
      ['누가 쓰고 누가 읽나', '<p><b>쓰기:</b> <span class="link" data-go="on_sigint">on_sigint</span> · <b>읽기:</b> 이 헤더 안에는 없다. 포함한 .c 파일의 루프가 <code>while (!g_stop)</code> 처럼 읽는다.</p>'],
      ['한정자', `<table><tr><th>키워드</th><th>이유</th></tr>
        <tr><td><span class="link" data-go="static">static</span></td><td>포함한 파일마다 따로 갖는다</td></tr>
        <tr><td><span class="link" data-go="volatile">volatile</span></td><td>매번 메모리에서 다시 읽게 한다. 없으면 <code>-O2</code> 최적화 때문에 Ctrl+C 가 안 먹힐 수 있다</td></tr>
        <tr><td><code>sig_atomic_t</code></td><td>신호가 끼어들어도 한 번에 읽고 쓰는 정수형</td></tr></table>`],
    ], related:['on_sigint','gpio_install_sigint','static'] },

  volatile: { kind:'kw', role:'global', sig:'volatile',
    summary:'"이 변수는 컴파일러가 모르는 곳에서 바뀔 수 있다" 는 표시.',
    sections:[['효과', '<p>읽기·쓰기를 생략하거나 합치지 않는다. 이 헤더에서는 신호 핸들러가 바꾸는 <code>g_stop</code> 에 붙였다.</p>']],
    related:['g_stop'] },

  SIGINT: { kind:'const', role:'signal', title:'SIGINT / SIGTERM', sig:'SIGINT (= 2), SIGTERM (= 15)',
    summary:'<b>SIGINT</b> = 터미널의 Ctrl+C, <b>SIGTERM</b> = <code>kill</code> 명령의 기본 신호.',
    sections:[
      ['둘 다 등록하는 이유', '<p>01_blink.c 는 SIGINT 만 등록해서 <code>kill</code> 로 끝내면 정리를 건너뛰었다. 이 헤더는 <span class="link" data-line="34">L34</span> 에서 SIGTERM 도 같은 핸들러에 연결해, <code>kill &lt;PID&gt;</code> 나 <code>systemctl stop</code> 으로 끝내도 라인을 정리할 기회가 생긴다.</p>'],
      ['잡을 수 없는 신호', '<p><code>kill -9</code> (SIGKILL) 은 등록할 수 없다. 이때는 정리 없이 바로 끝나고, 커널이 라인만 회수한다.</p>'],
    ], related:['gpio_install_sigint','sigaction','on_sigint'] },

  CLOCK_MONOTONIC: { kind:'const', role:'loop', sig:'CLOCK_MONOTONIC   // <time.h>',
    summary:'<b>거꾸로 가지 않는 시계.</b> 부팅 뒤 흐른 시간을 센다.',
    sections:[
      ['왜 이 시계인가', '<p><code>CLOCK_REALTIME</code>(벽시계)은 NTP 동기화나 <code>date</code> 명령으로 갑자기 앞뒤로 바뀔 수 있다. 간격을 재는 데 쓰면 음수 시간이 나올 수 있다. 단조 시계는 그런 일이 없다.</p>'],
      ['libgpiod 와의 관계', '<p>헤더 머리 주석대로, libgpiod 의 엣지 이벤트 타임스탬프도 기본으로 이 시계를 쓴다. 그래서 <code>now_ns()</code> 와 이벤트 시각을 바로 빼서 비교할 수 있다.</p>'],
    ], related:['now_ns','clock_gettime'] },

  ts: { kind:'var', role:'delay', sig:'struct timespec ts;   // now_ns() L39, sleep_ms() L46 — 이름이 같은 다른 변수',
    summary:'초(<code>tv_sec</code>)와 나노초(<code>tv_nsec</code>)로 시간을 담는 구조체.',
    sections:[['두 개의 ts', `<table><tr><th>위치</th><th>역할</th></tr>
      <tr><td><span class="link" data-line="39">L39</span> now_ns 안</td><td>clock_gettime 이 지금 시각을 채운다 → 나노초 하나로 합친다</td></tr>
      <tr><td><span class="link" data-line="46">L46</span> sleep_ms 안</td><td>ms 를 나눠 채운다. <code>ms = 1500</code> → { 1초, 500,000,000 ns }</td></tr></table>`]],
    related:['now_ns','sleep_ms','nanosleep','clock_gettime'] },

  ms: { kind:'var', role:'delay', sig:'long ms   // sleep_ms() 의 파라미터',
    summary:'잘 시간 (밀리초). 호출하는 쪽이 정한다.',
    sections:[['⚠ 음수', '<p>C 에서 <code>-1500 % 1000</code> 은 <code>-500</code> 이다. 음수를 넘기면 <code>tv_nsec</code> 이 음수가 되어 nanosleep 이 EINVAL 로 실패하고 <b>전혀 자지 않는다</b>. 이 헤더는 검사하지 않는다.</p>']],
    related:['sleep_ms','ts'] },

  /* ---------- gpio_request() 의 파라미터와 지역 변수 ---------- */
  consumer: { kind:'var', role:'init', sig:'const char *consumer   // 세 요청 함수의 첫 파라미터',
    summary:'라인을 요청하는 쪽의 이름. <code>gpioinfo</code> 와 실패 메시지에 나온다.',
    sections:[['쓰임', '<p>L69 요청 설정에 적고, L73 실패 메시지 앞에 붙인다 (<code>blink: 라인 요청 실패: Device or resource busy</code>). 바깥 함수 두 개는 받은 값을 그대로 <code>gpio_request</code> 에 넘긴다.</p>']],
    related:['gpiod_request_config_set_consumer','fprintf'] },

  offsets: { kind:'var', role:'init', sig:'const unsigned int *offsets   // 세 요청 함수의 파라미터',
    summary:'요청할 <b>라인 번호 배열</b>. 길이는 <code>n</code>.',
    sections:[['예', '<p>한 개: <code>unsigned int led = 17; gpio_request_output("blink", &amp;led, 1);</code><br>여러 개: <code>unsigned int leds[] = {17, 27, 22}; gpio_request_output("traffic", leds, 3);</code></p><p>모든 라인에 <b>같은 설정</b>이 적용된다. 라인마다 설정을 다르게 하려면 01_blink.c 처럼 직접 묶어야 한다.</p>']],
    related:['n','gpiod_line_config_add_line_settings'] },

  n: { kind:'var', role:'init', sig:'size_t n   // offsets 배열의 길이',
    summary:'<code>offsets</code> 에 들어 있는 라인 개수.',
    sections:[['⚠ 주의', '<p>배열 실제 길이보다 크게 주면 배열 밖 메모리를 라인 번호로 읽는다. 0 이면 L64 의 묶기가 실패해 <code>line_config: Invalid argument</code> 가 나올 것으로 추정한다. 배열이면 <code>sizeof leds / sizeof leds[0]</code> 로 넘기는 것이 안전하다.</p>']],
    related:['offsets','gpiod_line_config_add_line_settings'] },

  settings: { kind:'var', role:'init', sig:'struct gpiod_line_settings *settings   // gpio_request() 의 파라미터',
    summary:'모든 라인에 적용할 라인 설정. 바깥 함수가 만든 <code>s</code> 가 들어온다.',
    sections:[['소유권', '<p><code>gpio_request</code> 는 이것을 <b>빌려 쓰기만</b> 한다. L64 에서 묶음 안으로 복사되므로, 해제는 만든 쪽(<code>gpio_request_output</code>·<code>_input</code> 의 L90·L107)이 한다.</p>']],
    related:['s','gpio_request','gpiod_line_config_add_line_settings'] },

  chip: { kind:'var', role:'init', sig:'struct gpiod_chip *chip = NULL;',
    summary:'gpio_request 안에서 잠깐 여는 칩 객체.',
    sections:[['수명', '<p><span class="link" data-line="60">L60</span> 열기 → <span class="link" data-line="71">L71</span> 요청에 사용 → <span class="link" data-line="77">L77</span> 닫기. 함수가 끝나기 전에 닫지만, 이미 받은 요청은 그대로 유지된다.</p>'],
      ['NULL 로 시작하는 이유', '<p>어느 단계에서 <code>goto out</code> 해도 L75~77 의 해제 함수에 안전하게 넘길 수 있게 하려고 네 포인터를 모두 NULL 로 시작한다.</p>']],
    related:['gpiod_chip_open','gpiod_chip_close','out'] },

  lcfg: { kind:'var', role:'init', sig:'struct gpiod_line_config *lcfg = NULL;',
    summary:'라인 번호 목록과 설정을 묶은 객체. 01_blink.c 의 <code>line_cfg</code> 와 같다.',
    sections:[['수명', '<p>L63 생성 → L64 라인과 설정 넣기 → L71 요청에 사용 → L76 해제.</p>']],
    related:['gpiod_line_config_new','gpiod_line_config_add_line_settings','gpiod_line_config_free'] },

  rcfg: { kind:'var', role:'init', sig:'struct gpiod_request_config *rcfg = NULL;',
    summary:'요청 전체 설정 (consumer 이름). 01_blink.c 의 <code>req_cfg</code> 와 같다.',
    sections:[['수명', '<p>L67 생성 → L69 이름 적기 → L71 요청에 사용 → L75 해제.</p>']],
    related:['gpiod_request_config_new','gpiod_request_config_set_consumer','gpiod_request_config_free'] },

  req: { kind:'var', role:'init', sig:'struct gpiod_line_request *req = NULL;',
    summary:'커널에서 받은 라인 사용권. gpio_request 가 <b>유일하게 돌려주는 것</b>.',
    sections:[['소유권', '<p>L71 에서 받아 L78 에서 그대로 돌려준다. 이후 값 쓰기·읽기와 <b>반납</b>(<code>gpiod_line_request_release</code>)은 호출한 쪽의 책임이다. 실패하면 NULL 이 돌아간다.</p>']],
    related:['gpiod_chip_request_lines','gpio_request','r'] },

  out: { kind:'kw', role:'cleanup', title:'goto out', sig:'goto out;   …   out:',
    summary:'성공해도 실패해도 <b>같은 정리 코드</b>를 지나는 gpio_request 의 하나뿐인 출구.',
    sections:[['경로', `<pre><code>칩 열기 실패 (L61)      ─┐
묶기 실패 (L65)         ─┤ goto out
요청 설정 실패 (L68)    ─┤
라인 요청 성공/실패 (L71) ┘ 그냥 내려옴
          ▼
out: rcfg 해제 → lcfg 해제 → chip 닫기 → return req</code></pre>
      <p>01_blink.c 와 달리 <b>요청 성공 경로도 같은 정리를 지난다</b>. 요청에 필요했던 임시 객체를 모두 정리하고 요청만 남긴다. 아직 만들지 않은 객체는 NULL 이고, libgpiod v2 의 해제 함수는 NULL 을 받으면 아무것도 하지 않는다 (소스 기준, 실행 확인은 안 함).</p>`]],
    related:['chip','lcfg','rcfg','req'] },

  errno: { kind:'var', role:'init', sig:'int errno;   // <errno.h>',
    summary:'시스템·라이브러리 함수가 실패 이유를 남기는 <b>전역 오류 번호</b>.',
    sections:[['이 헤더에서', '<p>L61·L65·L68 은 <code>perror</code> 가 errno 를 읽고, L73 은 <code>strerror(errno)</code> 로 직접 문장을 얻는다. 모두 실패 바로 다음이라 이유가 정확하다.</p>'],
      ['⚠ 호출한 쪽에서', '<p>NULL 을 돌려받은 뒤에는 이미 해제 함수들이 지나갔다. 그 뒤 errno 가 그대로 남아 있다고 기대하지 않는 것이 안전하다 (추정). 이유는 헤더가 이미 출력했다.</p>']],
    related:['perror','strerror'] },

  /* ---------- 바깥 요청 함수의 변수 ---------- */
  s: { kind:'var', role:'init', sig:'struct gpiod_line_settings *s = gpiod_line_settings_new();',
    summary:'바깥 요청 함수가 만드는 라인 설정. 다 쓰면 바로 해제한다.',
    sections:[['수명', `<table><tr><th>함수</th><th>생성</th><th>설정</th><th>해제</th></tr>
      <tr><td>gpio_request_output</td><td><span class="link" data-line="85">L85</span></td><td>L87–88 출력, 0</td><td><span class="link" data-line="90">L90</span></td></tr>
      <tr><td>gpio_request_input</td><td><span class="link" data-line="99">L99</span></td><td>L101–105 입력, 풀업, 엣지, 디바운스</td><td><span class="link" data-line="107">L107</span></td></tr></table>
      <p>요청 성공·실패와 상관없이 해제하므로 누수가 없다.</p>`]],
    related:['gpiod_line_settings_new','gpiod_line_settings_free','settings'] },

  r: { kind:'var', role:'init', sig:'struct gpiod_line_request *r = gpio_request(consumer, offsets, n, s);',
    summary:'gpio_request 의 결과를 잠시 담아 두는 변수. <code>s</code> 를 해제한 뒤 돌려주려고 쓴다.',
    sections:[['왜 바로 return 하지 않나', '<p><code>return gpio_request(...)</code> 로 끝내면 <code>s</code> 를 해제할 기회가 없다. 결과를 <code>r</code> 에 받아 두고 → <code>s</code> 해제 → <code>r</code> 반환 순서로 한다.</p>']],
    related:['gpio_request','req','s'] },

  edge: { kind:'var', role:'init', sig:'enum gpiod_line_edge edge   // gpio_request_input() 의 파라미터',
    summary:'어떤 변화를 <b>이벤트</b>로 받을지. 호출하는 쪽이 정한다.',
    sections:[['값', `<table><tr><th>값</th><th>의미 (풀업 버튼 기준)</th></tr>
      <tr><td><code>GPIOD_LINE_EDGE_NONE</code></td><td>이벤트 없음 — 값을 직접 읽어 폴링</td></tr>
      <tr><td><code>GPIOD_LINE_EDGE_RISING</code></td><td>Low → High: 버튼을 <b>뗄 때</b></td></tr>
      <tr><td><code>GPIOD_LINE_EDGE_FALLING</code></td><td>High → Low: 버튼을 <b>누를 때</b></td></tr>
      <tr><td><code>GPIOD_LINE_EDGE_BOTH</code></td><td>둘 다</td></tr></table>`]],
    related:['gpiod_line_settings_set_edge_detection','gpio_request_input'] },

  debounce_us: { kind:'var', role:'init', sig:'unsigned long debounce_us   // gpio_request_input() 의 파라미터',
    summary:'디바운스 시간 (마이크로초). <b>0 이면 설정하지 않는다</b>.',
    sections:[['디바운스란', '<p>버튼은 누르는 순간 수 ms 동안 접점이 떨려 High/Low 가 여러 번 바뀐다. 디바운스는 값이 이 시간 동안 그대로 있을 때만 변화로 인정한다. 예: <code>10000</code> = 10 ms.</p>'],
      ['L104', '<p><code>if (debounce_us)</code> — 0 이 아닐 때만 설정 함수를 부른다.</p>']],
    related:['gpiod_line_settings_set_debounce_period_us','gpio_request_input'] },

  /* ---------- libgpiod 상수 ---------- */
  GPIOD_LINE_DIRECTION_OUTPUT: { kind:'const', role:'init', title:'GPIOD_LINE_DIRECTION_INPUT / OUTPUT', sig:'enum gpiod_line_direction { AS_IS, INPUT, OUTPUT }',
    summary:'라인 방향. <b>OUTPUT</b> 은 프로그램이 전압을 정하고, <b>INPUT</b> 은 바깥 전압을 읽는다.',
    sections:[['쓰임', `<table><tr><th>줄</th><th>값</th><th>함수</th></tr>
      <tr><td><span class="link" data-line="87">L87</span></td><td>OUTPUT</td><td>gpio_request_output (LED)</td></tr>
      <tr><td><span class="link" data-line="101">L101</span></td><td>INPUT</td><td>gpio_request_input (버튼)</td></tr></table>`]],
    related:['gpiod_line_settings_set_direction'] },

  GPIOD_LINE_VALUE_INACTIVE: { kind:'const', role:'init', sig:'GPIOD_LINE_VALUE_INACTIVE = 0',
    summary:'논리 값 0. 출력이면 Low(0V) — LED 꺼짐.',
    sections:[['쓰임', '<p><span class="link" data-line="88">L88</span> 출력 라인이 요청되는 순간의 처음 값. 요청 직후 LED 가 꺼진 상태로 시작한다.</p>']],
    related:['gpiod_line_settings_set_output_value','gpio_request_output'] },

  GPIOD_LINE_BIAS_PULL_UP: { kind:'const', role:'init', sig:'GPIOD_LINE_BIAS_PULL_UP   // enum gpiod_line_bias',
    summary:'칩 안의 <b>풀업 저항</b>을 켠다. 아무것도 연결하지 않으면 High 로 읽힌다.',
    sections:[['버튼 배선', '<p>풀업이면 버튼을 <code>GPIO → 버튼 → GND</code> 로 연결한다. 안 누름 = High(1), 누름 = Low(0) 으로 <b>거꾸로</b> 읽힌다. 외부 저항 없이 쓸 수 있다.</p>'],
      ['없다면', '<p>입력 핀이 떠 있어(floating) 손만 가까이 가도 값이 흔들린다.</p>']],
    related:['gpiod_line_settings_set_bias','gpio_request_input'] },

  /* ---------- 연산자 ---------- */
  op_not: { kind:'op', role:'init', title:'!', sig:'!x  (논리 NOT)',
    summary:'0(NULL) 이면 1, 아니면 0. 이 헤더에서는 모두 <b>"생성 실패?"</b> 검사다.',
    sections:[['쓰임', `<table><tr><th>줄</th><th>코드</th><th>실패 시</th></tr>
      <tr><td><span class="link" data-line="61">L61</span></td><td><code>!chip</code></td><td>perror → out</td></tr>
      <tr><td><span class="link" data-line="64">L64</span></td><td><code>!lcfg || … &lt; 0</code></td><td>perror → out</td></tr>
      <tr><td><span class="link" data-line="68">L68</span></td><td><code>!rcfg</code></td><td>perror → out</td></tr>
      <tr><td><span class="link" data-line="72">L72</span></td><td><code>!req</code></td><td>메시지만 출력</td></tr>
      <tr><td><span class="link" data-line="86">L86</span>, <span class="link" data-line="100">L100</span></td><td><code>!s</code></td><td><b>메시지 없이</b> NULL 반환</td></tr></table>
      <p>L64 의 <code>||</code> 는 왼쪽이 참이면 오른쪽을 실행하지 않는다. 그래서 <code>lcfg</code> 가 NULL 이면 묶기 함수가 불리지 않는다.</p>`]],
    related:['chip','lcfg','rcfg','req','s'] },

  op_addr: { kind:'op', role:'signal', title:'&', sig:'&x  (주소 연산자)',
    summary:'변수의 <b>메모리 주소</b>를 얻는다.',
    sections:[['쓰임', `<table><tr><th>코드</th><th>이유</th></tr>
      <tr><td><code>memset(&amp;sa, …)</code>, <code>sigaction(…, &amp;sa, …)</code></td><td>구조체를 복사하지 않고 주소로 넘긴다</td></tr>
      <tr><td><code>sigemptyset(&amp;sa.sa_mask)</code></td><td>구조체 안의 칸 하나를 함수가 채우게 한다</td></tr>
      <tr><td><code>clock_gettime(…, &amp;ts)</code></td><td>함수가 ts 를 <b>채워 주도록</b> 주소를 넘긴다</td></tr>
      <tr><td><code>nanosleep(&amp;ts, NULL)</code></td><td>대기 시간을 주소로 넘긴다</td></tr></table>`]],
    related:['sigaction','ts'] },
};

/* ------------------------------------------------------------
 * 함수 카드 (고정 틀: 파라미터 → 리턴값 → 동작 → 실패 원인 → 관련 변수/함수)
 *   params : [이름, 타입, 이 코드에서 넘긴 값, 설명]
 *   ret    : [값, 의미, 이 코드의 처리]
 *   fails  : [원인, 증상 / errno, 이 코드에서 일어나는 일, 대처]
 *   vars   : [심볼 키 또는 이름, 관계]      funcs : [심볼 키, 관계]
 * ------------------------------------------------------------ */
Object.assign(SYM, {
  /* ---------- 이 헤더가 제공하는 함수 ---------- */
  on_sigint: { kind:'func', role:'global', sig:'static void on_sigint(int sig)',
    summary:'SIGINT·SIGTERM 이 오면 커널이 불러 주는 신호 핸들러. 종료 깃발만 세운다.',
    params:[['sig','int','커널이 넣어 줌: <code>SIGINT</code> (2) 또는 <code>SIGTERM</code> (15)','어떤 신호로 불렸는지. 쓰지 않아서 <code>(void)sig;</code> 로 경고를 끈다']],
    ret:[['없음 (<code>void</code>)', '원래 실행하던 곳으로 복귀', '자고 있던 <code>nanosleep</code>·<code>poll</code> 은 EINTR 로 바로 돌아온다']],
    how:'<p><code>g_stop = 1;</code> 한 줄. 정리는 포함한 쪽의 루프가 <code>g_stop</code> 을 보고 빠져나와서 한다.</p>',
    fails:[
      ['핸들러 안에서 <code>printf</code>·libgpiod 함수 호출', '가끔 멈춤, 출력 깨짐 — 재현이 어렵다', '이 코드는 하지 않음 (안전)', '깃발만 세우고 나머지는 main 에서'],
      ['<code>gpio_install_sigint()</code> 를 부르지 않음', 'Ctrl+C 에 그냥 죽음', '핸들러가 등록되지 않아 g_stop 이 영원히 0', 'main 시작 부분에서 호출'],
      ['같은 이름을 직접 정의한 파일에서 포함', '빌드 오류 <code>redefinition of \'on_sigint\'</code>', '01_blink.c 에 이 헤더를 넣으면 이렇게 된다', '직접 정의한 쪽을 지운다'],
    ],
    vars:[['g_stop','1 로 바꾼다']],
    funcs:[['gpio_install_sigint','이 함수를 등록'],['sleep_ms','신호가 오면 일찍 깨어남']] },

  gpio_install_sigint: { kind:'func', role:'signal', sig:'static inline void gpio_install_sigint(void)',
    summary:'Ctrl+C(SIGINT)와 <code>kill</code>(SIGTERM)을 받으면 <code>g_stop = 1</code> 이 되도록 등록한다.',
    params:[],
    paramNote:'포함한 쪽의 main 시작 부분에서 한 번 부른다.',
    ret:[['없음 (<code>void</code>)', '—', '안의 <code>sigaction</code> 결과를 <b>확인하지 않는다</b> — 실패해도 알 수 없다']],
    how:`<pre><code>memset(&amp;sa, 0, …)        모든 칸을 0 (sa_flags = 0)
sa.sa_handler = on_sigint
sigemptyset(&amp;sa.sa_mask)   핸들러 도중 막을 신호 없음
sigaction(SIGINT,  &amp;sa)    Ctrl+C
sigaction(SIGTERM, &amp;sa)    kill</code></pre>
      <p><code>sa_flags</code> 에 SA_RESTART 를 넣지 않았다. 그래서 신호를 받으면 <code>poll()</code>·<code>nanosleep()</code> 이 끝까지 기다리지 않고 EINTR 로 돌아와 루프가 바로 끝난다.</p>`,
    fails:[
      ['sigaction 실패', '-1 (EINVAL) — 실제로는 거의 없음', '확인하지 않아 조용히 지나감', '리턴값 확인'],
      ['SA_RESTART 를 넣음', '오류 없음. Ctrl+C 뒤에도 <code>poll</code> 이 이벤트가 올 때까지 계속 기다림', '이 코드는 넣지 않음 (의도)', '그대로 둔다'],
      ['<code>kill -9</code> 로 종료', '정리 없이 즉시 종료', 'SIGKILL 은 등록할 수 없음', 'SIGTERM(<code>kill</code>) 으로 끝내기'],
    ],
    vars:[['sa','설정 구조체'],['g_stop','핸들러가 바꾸는 깃발'],['SIGINT','등록할 신호 (SIGTERM 도)']],
    funcs:[['memset','sa 초기화'],['sigemptyset','마스크 비우기'],['sigaction','신호 등록'],['on_sigint','등록되는 핸들러']] },

  now_ns: { kind:'func', role:'loop', sig:'static inline long long now_ns(void)',
    summary:'단조 시계의 지금 시각을 <b>나노초 정수 하나</b>로 돌려준다. 간격을 잴 때 쓴다.',
    params:[],
    ret:[['나노초 (<code>long long</code>)', '부팅 뒤 흐른 시간. 예: 12초 3ms → 12,003,000,000', '호출하는 쪽이 두 값을 빼서 간격을 구한다'],
         ['(실패 없음)', 'clock_gettime 실패를 확인하지 않는다', '실패하면 쓰레기 값이 나올 수 있다 (실제로는 거의 없음)']],
    how:'<p><code>tv_sec × 1,000,000,000 + tv_nsec</code>. <code>(long long)</code> 과 <code>LL</code> 로 곱셈을 64비트로 해서, 32비트 보드에서도 넘치지 않는다. 사용 예: <code>long long t0 = now_ns(); … ; printf("%lld us", (now_ns() - t0) / 1000);</code></p>',
    fails:[
      ['<code>(long long)</code> 캐스트를 빠뜨림', '32비트 보드에서 약 2초 이상이면 곱셈이 넘쳐 엉뚱한 값', '캐스트로 올바름', '64비트로 계산'],
      ['CLOCK_REALTIME 을 씀', '시계가 바뀌면 간격이 음수', 'MONOTONIC 으로 올바름', '—'],
      ['libgpiod 이벤트 시각과 비교', '같은 시계라 바로 비교 가능', '해당 없음 (의도된 쓰임)', '이벤트 시계를 REALTIME 으로 바꾸면 비교 불가'],
    ],
    vars:[['ts','지금 시각을 받는 구조체'],['CLOCK_MONOTONIC','사용하는 시계']],
    funcs:[['clock_gettime','실제로 시각을 읽는 함수']] },

  sleep_ms: { kind:'func', role:'delay', sig:'static inline void sleep_ms(long ms)',
    summary:'ms 동안 잠든다. Ctrl+C 가 오면 남은 시간을 버리고 바로 돌아온다.',
    params:[['ms','long','호출하는 쪽이 정함 (예: <code>500</code>)','잘 시간 (ms). 0 이상이어야 함']],
    ret:[['없음 (<code>void</code>)', '다 잤거나 신호로 일찍 깨어남 — 둘을 구분하지 않는다', '깨어난 뒤 루프가 <code>g_stop</code> 을 확인해 끝낸다']],
    how:'<p><code>ms / 1000</code> → 초, <code>(ms % 1000) × 1,000,000</code> → 나노초로 나눠 <code>ts</code> 에 넣고 <code>nanosleep</code> 을 부른다. 1000 이상도 올바르게 나뉜다 (1500 → 1초 + 0.5초).</p>',
    fails:[
      ['음수 ms', 'nanosleep 이 EINVAL → <b>전혀 자지 않음</b>', '검사하지 않는다 → 바쁜 루프가 되어 CPU 100%', '<code>if (ms &lt;= 0) return;</code>'],
      ['신호로 일찍 깨어남', '남은 시간 버림', '의도된 동작 (Ctrl+C 즉시 종료)', '정확히 다 자야 하면 rem 으로 다시 호출'],
      ['Ctrl+C 가 아닌 신호 (예: SIGCHLD 처리기)', '일찍 깨어남', '이 헤더는 다른 신호를 등록하지 않음', '—'],
    ],
    vars:[['ms','잘 시간'],['ts','초·나노초로 바꾼 시간']],
    funcs:[['nanosleep','실제로 잠드는 함수'],['gpio_install_sigint','Ctrl+C 에 깨어나게 하는 설정']] },

  gpio_request: { kind:'func', role:'init', sig:'static inline struct gpiod_line_request *gpio_request(const char *consumer, const unsigned int *offsets, size_t n, struct gpiod_line_settings *settings)',
    summary:'설정 하나를 <code>offsets[0..n-1]</code> 모든 라인에 적용해 요청한다. 01_blink.c 의 ①~⑤ 를 한 함수로 묶었다.',
    params:[
      ['consumer', 'const char *', '바깥 함수가 받은 값 그대로 (예: <code>"blink"</code>)', '요청자 이름. gpioinfo 와 실패 메시지에 나온다'],
      ['offsets', 'const unsigned int *', '바깥 함수가 받은 값 그대로', '라인 번호 배열'],
      ['n', 'size_t', '바깥 함수가 받은 값 그대로', '배열 길이'],
      ['settings', 'struct gpiod_line_settings *', 'L89 / L106 의 <code>s</code>', '모든 라인에 쓸 설정. 이 함수는 해제하지 않는다'],
    ],
    paramNote:'바깥 함수 두 개(<code>gpio_request_output</code>, <code>gpio_request_input</code>)만 부른다. 직접 불러도 된다.',
    ret:[
      ['<code>struct gpiod_line_request *</code>', '성공. 라인을 차지함', '그대로 반환 → 반납은 호출한 쪽 책임'],
      ['<code>NULL</code>', '칩 열기 / 묶기 / 요청 설정 / 라인 요청 중 하나가 실패', '이유를 stderr 에 출력한 뒤 반환'],
    ],
    how:`<table><tr><th>줄</th><th>단계</th><th>실패 시 메시지</th></tr>
      <tr><td><span class="link" data-line="60">L60</span></td><td>칩 열기 (<code>GPIO_CHIP</code>)</td><td><code>gpiod_chip_open: …</code></td></tr>
      <tr><td><span class="link" data-line="63">L63</span></td><td>묶음 만들기 + 라인·설정 넣기</td><td><code>line_config: …</code></td></tr>
      <tr><td><span class="link" data-line="67">L67</span></td><td>요청 설정 + consumer</td><td><code>request_config: …</code></td></tr>
      <tr><td><span class="link" data-line="71">L71</span></td><td>커널에 라인 요청</td><td><code>&lt;consumer&gt;: 라인 요청 실패: …</code></td></tr>
      <tr><td><span class="link" data-line="74">L74</span></td><td>임시 객체 정리 (성공해도)</td><td>—</td></tr></table>`,
    fails:[
      ['칩 장치가 없음 / 권한 없음', '<code>gpiod_chip_open: No such file or directory</code> / <code>Permission denied</code>', 'L61 → out → NULL', '<code>ls /dev/gpiochip*</code>, <code>sudo usermod -aG gpio $USER</code>'],
      ['다른 프로세스가 라인 사용 중', '<code>blink: 라인 요청 실패: Device or resource busy</code> (EBUSY)', 'L73 → out → NULL', '<code>gpioinfo</code> 로 consumer 확인 후 그 프로그램 종료'],
      ['칩에 없는 라인 번호', '<code>…: 라인 요청 실패: Invalid argument</code> (EINVAL)', 'L73 → out → NULL', '<code>gpioinfo</code> 로 라인 수 확인'],
      ['라인이 64개 초과 / n = 0', '<code>line_config: …</code> (E2BIG / EINVAL, 추정)', 'L65 → out → NULL', 'n 을 배열 길이와 맞추기'],
      ['메모리 부족', '<code>line_config: Cannot allocate memory</code> 등', 'L65 / L68 → out → NULL', '—'],
    ],
    failNote:'모든 실패가 <b>NULL 하나</b>로 돌아오므로 호출한 쪽은 이유를 구분할 수 없다. 대신 이 함수가 이유를 이미 출력했으니, 호출한 쪽은 <code>if (!req) return 1;</code> 만 하면 된다.',
    vars:[['chip','잠깐 여는 칩'],['lcfg','라인 설정 묶음'],['rcfg','요청 설정'],['req','돌려줄 결과'],['GPIO_CHIP','열 칩'],['consumer','요청자 이름'],['offsets','라인 번호'],['n','라인 개수'],['settings','적용할 설정']],
    funcs:[['gpiod_chip_open','① 칩 열기'],['gpiod_line_config_new','③ 묶음'],['gpiod_line_config_add_line_settings','③ 라인·설정 넣기'],['gpiod_request_config_new','④ 요청 설정'],['gpiod_chip_request_lines','⑤ 요청'],['gpio_request_output','이 함수를 부르는 쪽 (출력)'],['gpio_request_input','이 함수를 부르는 쪽 (입력)']] },

  gpio_request_output: { kind:'func', role:'init', sig:'static inline struct gpiod_line_request *gpio_request_output(const char *consumer, const unsigned int *offsets, size_t n)',
    summary:'라인들을 <b>출력, 처음 값 0</b> 으로 요청한다. LED 를 켤 때 쓴다.',
    params:[
      ['consumer', 'const char *', '호출하는 쪽이 정함 (예: <code>"traffic"</code>)', 'gpioinfo 에 보일 이름'],
      ['offsets', 'const unsigned int *', '호출하는 쪽이 정함 (예: <code>{17, 27, 22}</code>)', '라인 번호 배열'],
      ['n', 'size_t', '호출하는 쪽이 정함 (예: <code>3</code>)', '배열 길이'],
    ],
    ret:[
      ['<code>struct gpiod_line_request *</code>', '성공. 모든 라인이 출력 Low', '호출한 쪽이 값을 쓰고 마지막에 반납'],
      ['<code>NULL</code>', 'L86 설정 생성 실패 (<b>메시지 없음</b>) 또는 gpio_request 실패 (메시지 있음)', '그대로 반환'],
    ],
    how:'<p>L85 설정 생성 → L87 출력 → L88 처음 값 0 → L89 <code>gpio_request</code> → L90 설정 해제 → L91 결과 반환. 01_blink.c 의 ②~⑤ 가 이 한 줄이 된다: <code>req = gpio_request_output("blink", &amp;led, 1);</code></p>',
    fails:[
      ['설정 생성 실패 (메모리 부족)', '<b>아무 메시지 없이</b> NULL', 'L86 에서 바로 NULL 반환', '<code>perror</code> 추가 — 실제로는 거의 없음'],
      ['L87·L88 설정 실패', '-1 (EINVAL) — 올바른 상수라 일어나지 않음', '리턴값을 확인하지 않는다', '—'],
      ['요청 실패 (사용 중, 권한 등)', 'gpio_request 가 출력한 메시지', 'NULL 반환, <code>s</code> 는 해제됨 (누수 없음)', '<span class="link" data-go="gpio_request">gpio_request</span> 카드 참고'],
      ['반납을 잊음', '프로그램이 끝날 때까지 라인을 차지', '호출한 쪽의 책임', '끝내기 전에 <code>gpiod_line_request_release(req)</code>'],
    ],
    vars:[['s','임시 라인 설정'],['r','결과를 잠시 담음'],['GPIOD_LINE_DIRECTION_OUTPUT','방향'],['GPIOD_LINE_VALUE_INACTIVE','처음 값']],
    funcs:[['gpiod_line_settings_new','설정 생성'],['gpiod_line_settings_set_direction','출력으로'],['gpiod_line_settings_set_output_value','처음 값 0'],['gpio_request','실제 요청'],['gpiod_line_settings_free','짝: 설정 해제']] },

  gpio_request_input: { kind:'func', role:'init', sig:'static inline struct gpiod_line_request *gpio_request_input(const char *consumer, const unsigned int *offsets, size_t n, enum gpiod_line_edge edge, unsigned long debounce_us)',
    summary:'라인들을 <b>입력, 풀업</b> 으로 요청한다. 버튼을 읽을 때 쓴다. 엣지 이벤트와 디바운스를 고를 수 있다.',
    params:[
      ['consumer', 'const char *', '호출하는 쪽이 정함 (예: <code>"button"</code>)', 'gpioinfo 에 보일 이름'],
      ['offsets', 'const unsigned int *', '호출하는 쪽이 정함 (예: <code>{27}</code>)', '라인 번호 배열'],
      ['n', 'size_t', '호출하는 쪽이 정함 (예: <code>1</code>)', '배열 길이'],
      ['edge', 'enum gpiod_line_edge', '호출하는 쪽이 정함 (예: <code>GPIOD_LINE_EDGE_FALLING</code>)', 'NONE 이면 이벤트 없이 값만 읽는다'],
      ['debounce_us', 'unsigned long', '호출하는 쪽이 정함 (예: <code>10000</code> = 10 ms)', '0 이면 디바운스를 설정하지 않는다'],
    ],
    ret:[
      ['<code>struct gpiod_line_request *</code>', '성공. 라인이 입력 + 풀업', '호출한 쪽이 값을 읽거나 이벤트를 기다리고, 마지막에 반납'],
      ['<code>NULL</code>', 'L100 설정 생성 실패 (<b>메시지 없음</b>) 또는 gpio_request 실패', '그대로 반환'],
    ],
    how:`<table><tr><th>줄</th><th>설정</th></tr>
      <tr><td><span class="link" data-line="101">L101</span></td><td>방향 = 입력</td></tr>
      <tr><td><span class="link" data-line="102">L102</span></td><td>풀업 → 안 누름 1, 누름 0</td></tr>
      <tr><td><span class="link" data-line="103">L103</span></td><td>엣지 감지 = <code>edge</code></td></tr>
      <tr><td><span class="link" data-line="104">L104</span></td><td><code>debounce_us</code> 가 0 이 아닐 때만 디바운스</td></tr></table>
      <p>이후는 gpio_request_output 과 같다: 요청 → 설정 해제 → 결과 반환. 풀업은 고정이라 풀다운 배선에는 쓸 수 없다.</p>`,
    fails:[
      ['드라이버가 풀업·디바운스를 지원하지 않음', '요청 실패 <code>Operation not supported</code> 또는 커널이 소프트웨어로 흉내 (추정)', 'NULL 이면 gpio_request 가 메시지 출력', '<code>gpioinfo</code> 로 bias·debounce 표시 확인'],
      ['버튼을 3.3V 쪽에 연결', '오류 없음. 항상 1 로 읽힘', '풀업 고정이라 눌러도 변화 없음', '<code>GPIO → 버튼 → GND</code> 로 배선'],
      ['엣지를 RISING 으로 줌', '오류 없음. 누를 때가 아니라 <b>뗄 때</b> 이벤트', '풀업이라 누름 = FALLING', '누를 때는 <code>GPIOD_LINE_EDGE_FALLING</code>'],
      ['디바운스 0', '오류 없음. 한 번 눌러도 이벤트가 여러 번', 'L104 조건이 거짓이라 설정 안 함', '5~20 ms (5000~20000) 정도 주기'],
      ['설정 생성 실패', '<b>아무 메시지 없이</b> NULL', 'L100 에서 바로 반환', '<code>perror</code> 추가'],
    ],
    vars:[['s','임시 라인 설정'],['r','결과를 잠시 담음'],['edge','엣지 종류'],['debounce_us','디바운스 시간'],['GPIOD_LINE_BIAS_PULL_UP','풀업'],['GPIOD_LINE_DIRECTION_OUTPUT','INPUT 을 사용']],
    funcs:[['gpiod_line_settings_new','설정 생성'],['gpiod_line_settings_set_direction','입력으로'],['gpiod_line_settings_set_bias','풀업'],['gpiod_line_settings_set_edge_detection','엣지 감지'],['gpiod_line_settings_set_debounce_period_us','디바운스'],['gpio_request','실제 요청'],['gpiod_line_settings_free','짝: 설정 해제']] },

  /* ---------- 표준 라이브러리 / 시스템 함수 ---------- */
  memset: { kind:'func', role:'signal', sig:'void *memset(void *s, int c, size_t n);',
    summary:'메모리를 한 바이트 값으로 채운다. <code>sa</code> 를 0 으로 만든다.',
    params:[
      ['s', 'void *', '<code>&amp;sa</code>', '채울 메모리 시작 주소'],
      ['c', 'int', '<code>0</code>', '채울 값'],
      ['n', 'size_t', '<code>sizeof sa</code>', '바이트 수 = 구조체 크기'],
    ],
    ret:[['<code>s</code> 그대로', '편의용', '쓰지 않는다']],
    how:'<p>지역 변수 <code>sa</code> 의 쓰레기 값을 지워 <code>sa_flags</code> 가 0 (SA_RESTART 없음) 이 되게 한다.</p>',
    fails:[['<code>n</code> 을 잘못 줌 (<code>sizeof &amp;sa</code>)', '실패 표시 없이 일부만 초기화', '<code>sizeof sa</code> 로 올바름', '변수 이름으로 sizeof']],
    vars:[['sa','0 으로 채울 대상']],
    funcs:[['sigaction','초기화한 sa 를 받음'],['gpio_install_sigint','L30 에서 호출']] },

  sigemptyset: { kind:'func', role:'signal', sig:'int sigemptyset(sigset_t *set);',
    summary:'신호 집합을 <b>빈 집합</b>으로 만든다.',
    params:[['set', 'sigset_t *', '<code>&amp;sa.sa_mask</code>', '비울 신호 집합. 핸들러가 도는 동안 막을 신호 목록']],
    ret:[['0', '성공', '—'],['-1', '실패 (거의 없음)', '<b>확인하지 않는다</b>']],
    how:'<p>핸들러가 도는 동안 추가로 막을 신호가 없다는 뜻이다. 바로 앞 L30 <code>memset</code> 으로 이미 0 이지만, <code>sigset_t</code> 는 플랫폼마다 구조가 달라 표준 함수로 비우는 것이 정석이다.</p>',
    fails:[['빠뜨림 (memset 도 없음)', '마스크에 쓰레기 값 → 엉뚱한 신호가 막힘', 'L30·L32 둘 다 있어 안전', '—']],
    vars:[['sa','sa_mask 칸을 비움']],
    funcs:[['sigaction','이 마스크를 등록'],['memset','먼저 전체를 0 으로']] },

  sigaction: { kind:'func', role:'signal', title:'sigaction (sa)', sig:'int sigaction(int signum, const struct sigaction *act, struct sigaction *oldact);',
    summary:'신호가 왔을 때 할 일을 등록한다. 코드의 <code>struct sigaction sa</code> 는 그 설정을 담는 구조체.',
    params:[
      ['signum', 'int', 'L33 <code>SIGINT</code><br>L34 <code>SIGTERM</code>', '처리 방법을 바꿀 신호'],
      ['act', 'const struct sigaction *', '<code>&amp;sa</code>', '새 설정: <code>sa_handler = on_sigint</code>, <code>sa_mask</code> 빔, <code>sa_flags = 0</code>'],
      ['oldact', 'struct sigaction *', '<code>NULL</code>', '이전 설정을 받을 곳. 필요 없음'],
    ],
    ret:[['0', '성공', '—'],['-1', '실패 (errno)', '<b>확인하지 않는다</b>']],
    how:'<p>같은 <code>sa</code> 를 두 신호에 등록한다. SA_RESTART 가 없으므로 신호를 받으면 잠들어 있던 시스템 호출이 EINTR 로 돌아온다.</p>',
    fails:[
      ['잘못된 신호, SIGKILL/SIGSTOP', 'EINVAL', '해당 없음', '—'],
      ['<code>memset</code> 을 빠뜨림', '<code>sa_flags</code> 에 쓰레기 값 → SA_RESTART 가 우연히 켜질 수 있음', 'L30 memset 으로 방지', '구조체는 항상 0 으로 초기화'],
    ],
    vars:[['sa','설정 구조체'],['g_stop','핸들러가 바꾸는 깃발'],['SIGINT','등록할 신호 (SIGTERM 도)']],
    funcs:[['memset','sa 초기화'],['sigemptyset','마스크 비우기'],['on_sigint','등록되는 핸들러']] },

  clock_gettime: { kind:'func', role:'loop', sig:'int clock_gettime(clockid_t clockid, struct timespec *tp);',
    summary:'지정한 시계의 지금 시각을 <code>timespec</code> 에 채운다.',
    params:[
      ['clockid', 'clockid_t', '<code>CLOCK_MONOTONIC</code>', '읽을 시계'],
      ['tp', 'struct timespec *', '<code>&amp;ts</code>', '결과를 받을 곳'],
    ],
    ret:[['0', '성공', '—'],['-1', '실패 (EINVAL 등)', '<b>확인하지 않는다</b> — ts 는 초기화되지 않은 값']],
    how:'<p>리눅스에서는 vDSO 덕분에 커널에 들어가지 않고 아주 빠르게 읽힌다 (수십 ns). 루프에서 자주 불러도 부담이 적다.</p>',
    fails:[
      ['지원하지 않는 시계', 'EINVAL', '해당 없음 (MONOTONIC 은 리눅스에 항상 있음)', '—'],
      ['실패를 무시', 'ts 가 쓰레기 값 → now_ns 가 엉뚱한 값', '확인하지 않음 (실제로는 거의 없음)', '리턴값 확인'],
    ],
    vars:[['ts','결과를 받음'],['CLOCK_MONOTONIC','읽을 시계']],
    funcs:[['now_ns','이 함수를 감싼 함수']] },

  nanosleep: { kind:'func', role:'delay', sig:'int nanosleep(const struct timespec *req, struct timespec *rem);',
    summary:'지정한 시간 동안 프로세스를 잠재운다 (CPU 를 쓰지 않음).',
    params:[
      ['req', 'const struct timespec *', '<code>&amp;ts</code> = { ms/1000 초, (ms%1000)×10⁶ ns }', '잘 시간. tv_nsec 은 0 ~ 999,999,999'],
      ['rem', 'struct timespec *', '<code>NULL</code>', '일찍 깨어났을 때 남은 시간. 버림'],
    ],
    ret:[['0', '다 잠', '—'],['-1 + EINTR', 'Ctrl+C·kill 로 깨어남', '의도된 종료 경로 (리턴값은 안 봄)'],['-1 + EINVAL', '잘못된 시간 (음수 ms)', '확인하지 않음 → 바로 돌아옴']],
    how:'<p>바쁜 대기와 달리 CPU 를 쉬게 한다. SA_RESTART 가 없어서 신호에 즉시 깨어난다.</p>',
    fails:[
      ['tv_nsec 범위 밖', 'EINVAL — 전혀 안 잠', '음수 ms 일 때만 가능', 'sleep_ms 에 0 이상을 넘기기'],
      ['신호로 깨어남', 'EINTR', '의도된 동작', '—'],
    ],
    vars:[['ts','잘 시간']],
    funcs:[['sleep_ms','이 함수를 감싼 함수'],['gpio_install_sigint','신호에 깨어나도록 설정']] },

  perror: { kind:'func', role:'init', sig:'void perror(const char *s);',
    summary:'방금 실패한 이유(errno)를 문장으로 stderr 에 출력한다.',
    params:[['s','const char *','L61 <code>"gpiod_chip_open"</code><br>L65 <code>"line_config"</code><br>L68 <code>"request_config"</code>','앞에 붙일 이름 → <code>gpiod_chip_open: Permission denied</code>']],
    ret:[['없음 (<code>void</code>)', '—', '—']],
    how:'<p>세 호출 모두 실패 바로 다음이라 정확한 이유가 나온다. L73 의 라인 요청 실패만 perror 대신 <code>fprintf</code> + <code>strerror</code> 로 consumer 이름을 붙여 출력한다.</p>',
    fails:[
      ['나중에 호출', '다른 함수가 errno 를 바꿔 엉뚱한 이유 출력', '실패 직후 → 올바름', '실패 바로 다음 줄에서'],
      ['L64 의 묶기 실패와 생성 실패 구분', '둘 다 <code>line_config: …</code>', '이유 문장(ENOMEM / EINVAL)으로만 구분', '필요하면 두 if 로 나누기'],
    ],
    vars:[['errno','출력할 오류 번호']],
    funcs:[['gpiod_chip_open','L61 실패 시'],['gpiod_line_config_add_line_settings','L65 실패 시'],['gpiod_request_config_new','L68 실패 시'],['fprintf','L73 은 이쪽']] },

  fprintf: { kind:'func', role:'init', sig:'int fprintf(FILE *stream, const char *format, ...);',
    summary:'지정한 곳에 형식대로 출력한다. 여기서는 라인 요청 실패 메시지.',
    params:[
      ['stream', 'FILE *', '<code>stderr</code>', '오류 출력 (화면)'],
      ['format', 'const char *', '<code>"%s: 라인 요청 실패: %s\\n"</code>', '<code>%s</code> 두 개 = 문자열 두 개'],
      ['...', '가변 인자', '<code>consumer</code>, <code>strerror(errno)</code>', '예: <code>blink: 라인 요청 실패: Device or resource busy</code>'],
    ],
    ret:[['출력한 바이트 수', '성공', '쓰지 않는다'],['음수', '실패', '확인하지 않는다']],
    how:'<p>perror 와 달리 앞에 <b>consumer 이름</b>을 붙일 수 있어서, 어느 요청이 실패했는지 알 수 있다. 인자는 fprintf 가 불리기 전에 계산되므로 errno 가 바뀌기 전 값이 들어간다.</p>',
    fails:[['consumer 가 NULL', '<code>(null)</code> 출력 또는 Segmentation fault (C 라이브러리마다 다름)', '호출한 쪽이 NULL 을 넘기면 가능', '항상 이름을 넘기기']],
    vars:[['consumer','앞에 붙는 이름'],['errno','이유']],
    funcs:[['strerror','errno → 문장'],['gpiod_chip_request_lines','실패 시 호출'],['perror','다른 단계는 이쪽']] },

  strerror: { kind:'func', role:'init', sig:'char *strerror(int errnum);',
    summary:'오류 번호를 사람이 읽을 문장으로 바꾼다.',
    params:[['errnum','int','<code>errno</code> (L71 요청 실패 직후)','바꿀 오류 번호. 예: 16 (EBUSY)']],
    ret:[['문장 (<code>char *</code>)', '예: <code>"Device or resource busy"</code>', 'fprintf 의 두 번째 <code>%s</code> 에 들어감']],
    how:'<p>돌려받은 문자열은 라이브러리 안의 것이라 고치거나 해제하면 안 된다. 다음 strerror 호출 때 덮일 수 있으므로 바로 출력한다.</p>',
    fails:[['모르는 번호', '<code>"Unknown error 123"</code>', '해당 없음', '—']],
    vars:[['errno','바꿀 번호']],
    funcs:[['fprintf','결과를 출력'],['perror','strerror + 출력을 한 번에']] },

  /* ---------- libgpiod 함수 ---------- */
  gpiod_chip_open: { kind:'func', role:'init', sig:'struct gpiod_chip *gpiod_chip_open(const char *path);',
    summary:'① GPIO 칩 장치 파일을 열어 칩 객체를 만든다.',
    params:[['path', 'const char *', '<code>GPIO_CHIP</code> = <code>"/dev/gpiochip0"</code>', '열 장치 파일 경로']],
    ret:[
      ['<code>struct gpiod_chip *</code>', '성공', '<code>chip</code> 에 저장'],
      ['<code>NULL</code>', '실패, errno 에 이유', 'L61 perror → <code>goto out</code> → NULL 반환'],
    ],
    how:'<p>장치 파일을 열고 GPIO 칩인지 확인한다. 아직 라인은 차지하지 않는다. 요청 함수를 부를 때마다 새로 열고 닫는다.</p>',
    fails:[
      ['장치 파일이 없음 (PC, VM)', '<code>gpiod_chip_open: No such file or directory</code> (ENOENT)', 'L61 → out → NULL', '<code>ls /dev/gpiochip*</code>, <code>GPIO_CHIP</code> 수정'],
      ['권한 없음', '<code>gpiod_chip_open: Permission denied</code> (EACCES)', 'L61 → out → NULL', '<code>sudo usermod -aG gpio $USER</code> 후 다시 로그인'],
      ['칩 번호가 틀림 (Raspberry Pi 5 등)', '오류 없음', '다른 칩의 라인을 요청 (추정)', '<code>gpioinfo</code> 로 GPIO 이름이 있는 칩 확인'],
    ],
    vars:[['chip','리턴값을 저장'],['GPIO_CHIP','파라미터로 넘김']],
    funcs:[['gpiod_chip_close','짝: L77 에서 닫기'],['gpiod_chip_request_lines','다음 단계'],['perror','실패 이유 출력']] },

  gpiod_line_config_new: { kind:'func', role:'init', sig:'struct gpiod_line_config *gpiod_line_config_new(void);',
    summary:'③ 빈 라인 설정 묶음을 만든다.',
    params:[],
    ret:[
      ['<code>struct gpiod_line_config *</code>', '성공', '<code>lcfg</code> 에 저장'],
      ['<code>NULL</code>', '메모리 부족 (ENOMEM)', 'L64 <code>!lcfg</code> → perror → out'],
    ],
    how:'<p>01_blink.c 와 달리 결과를 <b>확인한다</b>. <code>||</code> 덕분에 NULL 이면 다음 묶기 함수가 불리지 않는다.</p>',
    fails:[['메모리 부족', '<code>line_config: Cannot allocate memory</code>', 'out → NULL', '—']],
    vars:[['lcfg','리턴값을 저장']],
    funcs:[['gpiod_line_config_free','짝: L76 해제'],['gpiod_line_config_add_line_settings','다음: 라인과 설정 넣기']] },

  gpiod_line_config_add_line_settings: { kind:'func', role:'init', sig:'int gpiod_line_config_add_line_settings(struct gpiod_line_config *config, const unsigned int *offsets, size_t num_offsets, struct gpiod_line_settings *settings);',
    summary:'라인 번호 목록에 설정을 붙여 묶음에 넣는다.',
    params:[
      ['config', 'struct gpiod_line_config *', '<code>lcfg</code>', '넣을 묶음'],
      ['offsets', 'const unsigned int *', '<code>offsets</code> (호출한 쪽 배열)', '라인 번호 배열'],
      ['num_offsets', 'size_t', '<code>n</code>', '배열 길이'],
      ['settings', 'struct gpiod_line_settings *', '<code>settings</code> (= 바깥 함수의 <code>s</code>)', '모든 라인에 붙일 설정. 묶음 안으로 복사된다'],
    ],
    ret:[['0', '성공', '—'],['-1', '실패 (errno)', 'L64 <code>&lt; 0</code> → perror("line_config") → out']],
    how:'<p><code>n</code> 개 라인 모두에 같은 설정을 붙인다. 라인 번호가 칩에 실제로 있는지는 여기서 검사하지 않고 L71 요청 때 커널이 검사한다.</p>',
    fails:[
      ['라인이 64개 초과', '<code>line_config: Argument list too long</code> (E2BIG)', 'out → NULL', '여러 번 나눠 요청'],
      ['n = 0 / offsets 가 NULL', '<code>line_config: Invalid argument</code> (EINVAL, 추정)', 'out → NULL', '배열과 길이 확인'],
      ['칩에 없는 라인 번호', '여기서는 성공', 'L71 에서 <code>Invalid argument</code>', '<code>gpioinfo</code> 로 라인 수 확인'],
    ],
    vars:[['lcfg','넣을 묶음'],['offsets','라인 번호'],['n','개수'],['settings','붙일 설정']],
    funcs:[['gpiod_line_config_new','묶음을 만듦'],['gpiod_chip_request_lines','다음: 묶음으로 요청'],['perror','실패 이유 출력']] },

  gpiod_request_config_new: { kind:'func', role:'init', sig:'struct gpiod_request_config *gpiod_request_config_new(void);',
    summary:'④ 요청 전체 설정 객체를 만든다.',
    params:[],
    ret:[
      ['<code>struct gpiod_request_config *</code>', '성공', '<code>rcfg</code> 에 저장'],
      ['<code>NULL</code>', '메모리 부족 (ENOMEM)', 'L68 perror("request_config") → out'],
    ],
    how:'<p>consumer 이름과 이벤트 버퍼 크기를 담는 객체다. 이 헤더는 consumer 이름만 쓴다.</p>',
    fails:[['메모리 부족', '<code>request_config: Cannot allocate memory</code>', 'out → NULL', '—']],
    vars:[['rcfg','리턴값을 저장']],
    funcs:[['gpiod_request_config_free','짝: L75 해제'],['gpiod_request_config_set_consumer','다음: 이름 적기']] },

  gpiod_request_config_set_consumer: { kind:'func', role:'init', sig:'void gpiod_request_config_set_consumer(struct gpiod_request_config *config, const char *consumer);',
    summary:'요청한 쪽의 이름(consumer)을 적는다. <code>gpioinfo</code> 에 보인다.',
    params:[
      ['config', 'struct gpiod_request_config *', '<code>rcfg</code>', '적을 대상 (L68 에서 NULL 이 아님을 확인함)'],
      ['consumer', 'const char *', '<code>consumer</code> (호출한 쪽이 넘긴 이름)', '이름. 길면 31자에서 잘린다'],
    ],
    ret:[['없음 (<code>void</code>)', '—', '—']],
    how:'<p>실행 중 <code>gpioinfo</code> 를 보면 요청한 라인 옆에 이 이름이 나온다. 라인이 사용 중이라는 오류가 나면 이 이름으로 범인을 찾는다.</p>',
    fails:[['NULL 이름을 넘김', '오류 없음. gpioinfo 에 이름이 비어 보임 (추정)', 'L73 메시지도 <code>(null)</code>', '항상 이름 넘기기']],
    vars:[['rcfg','적을 대상'],['consumer','적을 이름']],
    funcs:[['gpiod_request_config_new','rcfg 를 만듦'],['gpiod_chip_request_lines','이 설정을 받아 요청']] },

  gpiod_chip_request_lines: { kind:'func', role:'init', sig:'struct gpiod_line_request *gpiod_chip_request_lines(struct gpiod_chip *chip, struct gpiod_request_config *req_cfg, struct gpiod_line_config *line_cfg);',
    summary:'⑤ 커널에 라인을 요청한다. 성공하면 이 프로세스가 라인의 <b>소유자</b>가 된다.',
    params:[
      ['chip', 'struct gpiod_chip *', '<code>chip</code> (<code>/dev/gpiochip0</code>)', '라인이 있는 칩'],
      ['req_cfg', 'struct gpiod_request_config *', '<code>rcfg</code>', '요청 전체 설정'],
      ['line_cfg', 'struct gpiod_line_config *', '<code>lcfg</code>', '라인별 설정'],
    ],
    ret:[
      ['<code>struct gpiod_line_request *</code>', '성공. 설정이 실제 핀에 적용됨', '<code>req</code> 에 저장 → out → 반환'],
      ['<code>NULL</code>', '실패, errno 에 이유', 'L73 <code>&lt;consumer&gt;: 라인 요청 실패: …</code> → out → NULL'],
    ],
    how:'<p>커널이 라인 번호를 검사하고, 다른 사용자가 없으면 라인을 내준다. 이 순간 방향·풀업·엣지 설정이 실제 핀에 적용된다. 요청은 자기만의 파일 디스크립터를 가지므로 L77 에서 칩을 닫아도 유지된다.</p>',
    fails:[
      ['다른 프로세스가 사용 중', '<code>…: 라인 요청 실패: Device or resource busy</code> (EBUSY)', 'out → NULL', '<code>gpioinfo</code> 로 consumer 확인 후 그 프로그램 종료'],
      ['커널 드라이버가 사용 중 (오버레이)', '<code>Device or resource busy</code> (EBUSY)', 'out → NULL', '<code>/boot/firmware/config.txt</code> 의 오버레이 확인'],
      ['칩에 없는 라인 번호', '<code>Invalid argument</code> (EINVAL)', 'out → NULL', '<code>gpioinfo</code> 로 라인 수 확인'],
      ['풀업·디바운스 미지원', '<code>Operation not supported</code> 등 (추정)', 'out → NULL', 'gpio_request_input 의 설정 줄이기'],
    ],
    vars:[['req','리턴값을 저장'],['chip','파라미터'],['rcfg','파라미터'],['lcfg','파라미터']],
    funcs:[['gpiod_chip_open','chip 을 만듦'],['fprintf','실패 메시지'],['gpio_request','이 함수를 감싼 함수']] },

  gpiod_request_config_free: { kind:'func', role:'cleanup', sig:'void gpiod_request_config_free(struct gpiod_request_config *config);',
    summary:'④ 요청 설정 객체를 해제한다.',
    params:[['config', 'struct gpiod_request_config *', '<code>rcfg</code> (실패 경로에서는 NULL 일 수 있음)', '해제할 객체. NULL 이면 아무것도 안 함']],
    ret:[['없음 (<code>void</code>)', '—', '—']],
    how:'<p>요청이 이미 만들어졌다면 설정은 더 필요 없다. 성공·실패 모두 이 줄을 지난다.</p>',
    fails:[['두 번 해제', 'double free → 비정상 종료', '해당 없음 (한 번)', '해제 뒤 NULL']],
    vars:[['rcfg','해제 대상']],
    funcs:[['gpiod_request_config_new','짝: 생성']] },

  gpiod_line_config_free: { kind:'func', role:'cleanup', sig:'void gpiod_line_config_free(struct gpiod_line_config *config);',
    summary:'③ 라인 설정 묶음을 해제한다. 안에 복사된 설정도 함께 해제된다.',
    params:[['config', 'struct gpiod_line_config *', '<code>lcfg</code> (칩 열기 실패 시 NULL)', '해제할 묶음. NULL 이면 아무것도 안 함 (libgpiod v2 소스 기준)']],
    ret:[['없음 (<code>void</code>)', '—', '—']],
    how:'<p>원본 설정(<code>settings</code>)은 해제하지 않는다. 그것은 바깥 함수가 L90·L107 에서 한다.</p>',
    fails:[['두 번 해제', 'double free → 비정상 종료', '해당 없음 (한 번)', '해제 뒤 NULL']],
    vars:[['lcfg','해제 대상']],
    funcs:[['gpiod_line_config_new','짝: 생성'],['gpiod_line_settings_free','원본 설정은 이쪽']] },

  gpiod_chip_close: { kind:'func', role:'cleanup', sig:'void gpiod_chip_close(struct gpiod_chip *chip);',
    summary:'① 칩 장치 파일을 닫는다. <b>요청은 칩을 닫아도 유지된다</b>.',
    params:[['chip', 'struct gpiod_chip *', '<code>chip</code> (칩 열기 실패 시 NULL)', '닫을 칩. NULL 이면 아무것도 안 함 (libgpiod v2 소스 기준)']],
    ret:[['없음 (<code>void</code>)', '—', '이어서 L78 <code>return req</code>']],
    how:'<p>요청이 칩과 별개의 파일 디스크립터를 가지므로, 칩을 닫아도 라인은 계속 이 프로세스 것이다. 그래서 호출한 쪽은 요청 하나만 관리하면 된다.</p>',
    fails:[
      ['칩을 닫으면 요청도 끝난다고 착각', '오류 없음', '라인은 여전히 차지 중', '반납은 <code>gpiod_line_request_release</code>'],
      ['두 번 닫기', '정의되지 않은 동작', '해당 없음', '닫은 뒤 NULL'],
    ],
    vars:[['chip','닫을 대상'],['req','닫아도 유지되는 요청']],
    funcs:[['gpiod_chip_open','짝: 열기']] },

  gpiod_line_settings_new: { kind:'func', role:'init', sig:'struct gpiod_line_settings *gpiod_line_settings_new(void);',
    summary:'② 기본값이 들어 있는 빈 라인 설정을 만든다.',
    params:[],
    ret:[
      ['<code>struct gpiod_line_settings *</code>', '성공', '<code>s</code> 에 저장'],
      ['<code>NULL</code>', '메모리 부족 (ENOMEM)', 'L86 / L100 에서 <b>메시지 없이</b> NULL 반환'],
    ],
    how:'<p>메모리만 할당하고 기본값(방향 AS_IS 등)을 채운다. 01_blink.c 와 달리 결과를 확인한다.</p>',
    fails:[['메모리 부족', 'NULL — 화면에 아무것도 안 나옴', '호출한 쪽은 이유 없이 NULL 을 받음', '<code>perror("line_settings")</code> 추가']],
    vars:[['s','리턴값을 저장']],
    funcs:[['gpiod_line_settings_free','짝: 해제'],['gpiod_line_settings_set_direction','다음: 방향']] },

  gpiod_line_settings_set_direction: { kind:'func', role:'init', sig:'int gpiod_line_settings_set_direction(struct gpiod_line_settings *settings, enum gpiod_line_direction direction);',
    summary:'라인 설정에 방향(입력/출력)을 적는다.',
    params:[
      ['settings', 'struct gpiod_line_settings *', '<code>s</code>', '적을 대상'],
      ['direction', 'enum gpiod_line_direction', 'L87 <code>OUTPUT</code><br>L101 <code>INPUT</code>', 'AS_IS / INPUT / OUTPUT'],
    ],
    ret:[['0', '성공', '—'],['-1', '잘못된 방향 (EINVAL)', '<b>확인하지 않는다</b>']],
    how:'<p>객체 안의 값만 바꾼다. 핀이 실제로 바뀌는 것은 L71 요청이 성공하는 순간이다.</p>',
    fails:[['잘못된 방향 값', '-1 (EINVAL)', '해당 없음 (올바른 상수)', '—']],
    vars:[['s','적을 대상'],['GPIOD_LINE_DIRECTION_OUTPUT','적을 값']],
    funcs:[['gpiod_line_settings_new','s 를 만듦'],['gpio_request','이 설정으로 요청']] },

  gpiod_line_settings_set_output_value: { kind:'func', role:'init', sig:'int gpiod_line_settings_set_output_value(struct gpiod_line_settings *settings, enum gpiod_line_value value);',
    summary:'출력 라인이 <b>요청되는 순간</b>의 처음 값을 적는다.',
    params:[
      ['settings', 'struct gpiod_line_settings *', '<code>s</code>', '적을 대상'],
      ['value', 'enum gpiod_line_value', '<code>GPIOD_LINE_VALUE_INACTIVE</code> (0)', 'ACTIVE / INACTIVE'],
    ],
    ret:[['0', '성공', '—'],['-1', '잘못된 값 (EINVAL)', '<b>확인하지 않는다</b>']],
    how:'<p>요청과 동시에 모든 출력 라인이 Low 로 시작한다. LED 가 요청 직후 잠깐 켜지는 일이 없다.</p>',
    fails:[['잘못된 값', '-1 (EINVAL)', '해당 없음 (올바른 상수)', '—']],
    vars:[['s','적을 대상'],['GPIOD_LINE_VALUE_INACTIVE','적을 값']],
    funcs:[['gpiod_line_settings_set_direction','같은 객체에 방향'],['gpio_request_output','L88 에서 호출']] },

  gpiod_line_settings_set_bias: { kind:'func', role:'init', sig:'int gpiod_line_settings_set_bias(struct gpiod_line_settings *settings, enum gpiod_line_bias bias);',
    summary:'입력 라인의 내부 저항(풀업/풀다운/없음)을 정한다.',
    params:[
      ['settings', 'struct gpiod_line_settings *', '<code>s</code>', '적을 대상'],
      ['bias', 'enum gpiod_line_bias', '<code>GPIOD_LINE_BIAS_PULL_UP</code>', 'AS_IS / UNKNOWN / DISABLED / PULL_UP / PULL_DOWN'],
    ],
    ret:[['0', '성공', '—'],['-1', '잘못된 값 (EINVAL)', '<b>확인하지 않는다</b>']],
    how:'<p>풀업이면 버튼을 누르지 않을 때 1, 누르면 0 이다. 지원 여부는 L71 요청 때 드라이버가 판단한다.</p>',
    fails:[
      ['드라이버가 bias 미지원', 'L71 요청 실패 (EOPNOTSUPP 추정)', 'out → NULL', '외부 저항 사용 + 설정 제거'],
      ['풀다운 배선의 버튼', '오류 없음. 항상 1', '풀업이 고정이라 맞지 않음', '배선을 GND 쪽으로'],
    ],
    vars:[['s','적을 대상'],['GPIOD_LINE_BIAS_PULL_UP','적을 값']],
    funcs:[['gpio_request_input','L102 에서 호출'],['gpiod_line_settings_set_edge_detection','다음: 엣지']] },

  gpiod_line_settings_set_edge_detection: { kind:'func', role:'init', sig:'int gpiod_line_settings_set_edge_detection(struct gpiod_line_settings *settings, enum gpiod_line_edge edge);',
    summary:'어떤 변화(엣지)를 이벤트로 받을지 정한다.',
    params:[
      ['settings', 'struct gpiod_line_settings *', '<code>s</code>', '적을 대상'],
      ['edge', 'enum gpiod_line_edge', '<code>edge</code> (호출한 쪽이 정함)', 'NONE / RISING / FALLING / BOTH'],
    ],
    ret:[['0', '성공', '—'],['-1', '잘못된 값 (EINVAL)', '<b>확인하지 않는다</b>']],
    how:'<p>NONE 이 아니면 커널이 변화를 감지해 이벤트로 쌓아 둔다. 호출한 쪽은 요청의 파일 디스크립터를 <code>poll()</code> 로 기다렸다가 이벤트를 읽는다. 이벤트 시각은 <code>CLOCK_MONOTONIC</code> 기준이다.</p>',
    fails:[
      ['잘못된 enum 값', '-1 (EINVAL), 설정 안 바뀜', '확인하지 않아 엣지 없이 요청됨', '올바른 상수 사용'],
      ['출력 라인에 엣지 설정', 'L71 요청 실패 (EINVAL)', '해당 없음 (입력에만 씀)', '—'],
    ],
    vars:[['s','적을 대상'],['edge','적을 값'],['CLOCK_MONOTONIC','이벤트 시각의 시계']],
    funcs:[['gpio_request_input','L103 에서 호출'],['now_ns','이벤트 시각과 비교할 지금 시각']] },

  gpiod_line_settings_set_debounce_period_us: { kind:'func', role:'init', sig:'void gpiod_line_settings_set_debounce_period_us(struct gpiod_line_settings *settings, unsigned long period);',
    summary:'디바운스 시간을 정한다. 이 시간 동안 값이 유지돼야 변화로 인정한다.',
    params:[
      ['settings', 'struct gpiod_line_settings *', '<code>s</code>', '적을 대상'],
      ['period', 'unsigned long', '<code>debounce_us</code> (0 이 아닐 때만)', '마이크로초. 10000 = 10 ms'],
    ],
    ret:[['없음 (<code>void</code>)', '—', '—']],
    how:'<p>버튼 접점의 떨림 때문에 생기는 가짜 이벤트를 걸러 낸다. 하드웨어가 지원하지 않으면 리눅스 커널이 소프트웨어로 흉내 낸다 (추정, 커널 5.10 이상).</p>',
    fails:[
      ['너무 짧음 (예: 100 us)', '한 번 눌러도 이벤트 여러 번', '호출한 쪽 값에 달림', '5~20 ms'],
      ['너무 김 (예: 500 ms)', '빠른 연타를 놓침', '호출한 쪽 값에 달림', '용도에 맞게'],
      ['커널이 디바운스 미지원', 'L71 요청 실패 (추정)', 'out → NULL', '<code>debounce_us = 0</code> 으로 하고 소프트웨어로 거르기'],
    ],
    vars:[['s','적을 대상'],['debounce_us','적을 값']],
    funcs:[['gpio_request_input','L105 에서 호출'],['gpiod_line_settings_set_edge_detection','엣지 이벤트와 함께 씀']] },

  gpiod_line_settings_free: { kind:'func', role:'cleanup', sig:'void gpiod_line_settings_free(struct gpiod_line_settings *settings);',
    summary:'② 라인 설정 객체를 해제한다.',
    params:[['settings', 'struct gpiod_line_settings *', 'L90 / L107 <code>s</code>', '해제할 객체']],
    ret:[['없음 (<code>void</code>)', '—', '이어서 결과 <code>r</code> 반환']],
    how:'<p>묶음 안에는 복사본이 들어갔고 묶음도 이미 해제됐으므로, 요청 성공·실패와 상관없이 바로 해제해도 된다.</p>',
    fails:[['해제를 빠뜨림', '부를 때마다 메모리 누수', '해당 없음 (L90·L107 에서 해제)', '생성과 해제를 짝으로']],
    vars:[['s','해제 대상']],
    funcs:[['gpiod_line_settings_new','짝: 생성'],['gpiod_line_config_free','복사본은 이쪽이 해제']] },
});

/* 코드 속 이름 → 심볼 키 */
const ALIAS = {
  sig_atomic_t:'g_stop', timespec:'ts', sa:'sigaction', sa_handler:'sigaction',
  gpiod_chip:'chip', gpiod_line_config:'lcfg', gpiod_request_config:'rcfg',
  gpiod_line_request:'req', gpiod_line_settings:'settings', gpiod_line_edge:'edge',
  SIGTERM:'SIGINT', GPIOD_LINE_DIRECTION_INPUT:'GPIOD_LINE_DIRECTION_OUTPUT',
  goto:'out',
};

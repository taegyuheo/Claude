/* example.c — CPU 온도를 1초마다 읽어 화면과 CSV 파일에 기록하기 (작성방침 예시 코드)
 * 대상: Linux (/sys/class/thermal 이 있는 PC·보드), 외부 라이브러리 없음
 * 빌드: gcc -Wall -O2 -o example example.c      실행: ./example [최대 횟수]      종료: Ctrl+C
 */
#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define TEMP_PATH  "/sys/class/thermal/thermal_zone0/temp"
#define LOG_PATH   "temp_log.csv"
#define PERIOD_MS  1000
#define WARN_MC    70000            /* 70.000 °C (밀리도 단위) */

static volatile sig_atomic_t g_stop = 0;
static void on_sigint(int sig) { (void)sig; g_stop = 1; }

/* 온도 파일을 읽어 밀리도(m°C)로 돌려준다. 실패하면 -1 */
static long read_temp(const char *path)
{
    FILE *fp = fopen(path, "r");
    if (!fp) return -1;

    char buf[32];
    long mc = -1;
    if (fgets(buf, sizeof buf, fp)) {
        char *end;
        errno = 0;
        mc = strtol(buf, &end, 10);
        if (errno || end == buf) mc = -1;            /* 숫자가 아님 */
    }
    fclose(fp);
    return mc;
}

/* ms 동안 잠든다. Ctrl+C 가 오면 일찍 돌아온다 */
static void sleep_ms(long ms)
{
    struct timespec ts = { ms / 1000, (ms % 1000) * 1000000L };
    nanosleep(&ts, NULL);
}

int main(int argc, char **argv)
{
    long limit = (argc > 1) ? atol(argv[1]) : 0;     /* 0 = 무한 */
    int ret = EXIT_FAILURE;

    /* Ctrl+C → g_stop = 1 → 루프 종료 → 아래에서 정리 */
    struct sigaction sa;
    memset(&sa, 0, sizeof sa);
    sa.sa_handler = on_sigint;
    sigaction(SIGINT, &sa, NULL);

    FILE *csv = fopen(LOG_PATH, "a");
    if (!csv) { perror(LOG_PATH); return EXIT_FAILURE; }

    long count = 0, max_mc = 0;
    while (!g_stop && (limit == 0 || count < limit)) {
        long mc = read_temp(TEMP_PATH);
        if (mc < 0) { fprintf(stderr, "온도 읽기 실패: %s\n", TEMP_PATH); goto cleanup; }

        count++;
        if (mc > max_mc) max_mc = mc;
        printf("[%ld] %.1f °C%s\n", count, mc / 1000.0, mc >= WARN_MC ? "  ⚠ 높음" : "");
        fprintf(csv, "%ld,%ld\n", (long)time(NULL), mc);
        sleep_ms(PERIOD_MS);
    }

    printf("\n%ld 회 측정 · 최고 %.1f °C\n", count, max_mc / 1000.0);
    ret = EXIT_SUCCESS;

cleanup:
    fclose(csv);
    return ret;
}

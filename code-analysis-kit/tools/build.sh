#!/usr/bin/env bash
# build.sh — 소스 + 데이터 → result/<이름>.html 을 만들고 검증한다
#
# 사용법:  bash tools/build.sh main.c                      upload/ (또는 upload/src/) 안의 파일 이름
#          bash tools/build.sh util.h                      → 이름은 util_h
#          bash tools/build.sh tools/example/example.c     경로를 주면 그 파일 (예시 빌드)
#
# 입력:  원본 소스                    읽기만 한다
#        tools/data/<이름>.js         파일별 데이터 (작성 방법: tools/작성방침.md)
#        tools/viewer_template.html   공통 엔진
# 출력:  result/<이름>.html
set -euo pipefail
cd "$(dirname "$0")/.."

ARG="${1:?사용법: bash tools/build.sh <upload 안의 파일 이름 | 소스 경로>}"
if [[ "$ARG" == */* ]]; then SRC="$ARG"
elif [ -f "upload/$ARG" ]; then SRC="upload/$ARG"            # upload/ 바로 아래
else SRC="upload/src/$ARG"; fi                            # 또는 upload/src/
FILE="$(basename "$SRC")"
NAME="${FILE%.c}"; NAME="${NAME//./_}"          # main.c → main, util.h → util_h
DATA="tools/data/$NAME.js"
TPL="tools/viewer_template.html"
OUT="result/$NAME.html"

[ -f "$SRC" ]  || { echo "✗ 원본이 없음: $SRC"; exit 1; }
[ -f "$DATA" ] || { echo "✗ 데이터가 없음: $DATA  (tools/data/example.js 를 복사해 시작)"; exit 1; }
grep -qi '</script' "$SRC" && { echo "✗ 원본에 </script 가 있어 삽입할 수 없음"; exit 1; }
mkdir -p result

# ① 합치기: @@SOURCE@@ ← 원본 그대로, @@DATA@@ ← 데이터, @@FILE@@ ← 파일 이름, @@PATH@@ ← 소스 경로
awk -v src="$SRC" -v data="$DATA" -v file="$FILE" -v path="$SRC" '
  $0 == "@@SOURCE@@" { while ((getline l < src)  > 0) print l; next }
  $0 == "@@DATA@@"   { while ((getline l < data) > 0) print l; next }
  { gsub(/@@FILE@@/, file); gsub(/@@PATH@@/, path); print }' "$TPL" > "$OUT"
echo "✓ 생성: $OUT"

# ② 원본과 같은지 (줄바꿈 CRLF/LF 차이는 무시)
if diff -q --strip-trailing-cr <(sed -n '/id="src">/,/^<\/script>/p' "$OUT" | sed '1d;$d') "$SRC" > /dev/null; then
  echo "✓ 코드 뷰어의 소스 = 원본"
else
  echo "✗ 코드 뷰어의 소스가 원본과 다름"; exit 1
fi

# ③ 브라우저로 실제 실행 (Chrome 또는 Edge 헤드리스)
BROWSER=""
for b in "/c/Program Files/Google/Chrome/Application/chrome.exe" \
         "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"; do
  [ -x "$b" ] && { BROWSER="$b"; break; }
done
if [ -z "$BROWSER" ]; then echo "△ 브라우저가 없어 실행 검증은 건너뜀"; exit 0; fi

URL="file:///$(cygpath -m "$PWD/$OUT" 2>/dev/null || echo "$PWD/$OUT")"
TMP="${TMPDIR:-/tmp}/viewer_check_$NAME"; mkdir -p "$TMP"
"$BROWSER" --headless=new --disable-gpu --enable-logging=stderr --v=0 --virtual-time-budget=4000 \
  --dump-dom "$URL" > "$TMP/dom.html" 2> "$TMP/console.txt" || true

if grep -q "Uncaught" "$TMP/console.txt"; then
  echo "✗ 스크립트 오류:"; grep "Uncaught" "$TMP/console.txt" | head -5; exit 1
fi
LINES=$(grep -oE 'class="line" id="L[0-9]+"' "$TMP/dom.html" | wc -l)
SYMS=$(grep -oE 'data-sym="[A-Za-z_]+"' "$TMP/dom.html" | sort -u | wc -l)
grep -q '전체 개요</div>' "$TMP/dom.html" && OV="✓" || OV="✗"
echo "✓ 실행: 보이는 줄 ${LINES}개 · 클릭 가능한 심볼 ${SYMS}종 · 개요 표시 ${OV}"

# 코드에는 있는데 카드가 없는 함수 호출 찾기 (빠뜨린 심볼 점검용)
MISSING=$(sed -n '/id="src">/,/^<\/script>/p' "$OUT" | sed 's#/\*.*\*/##g' \
  | grep -oE '\b[a-z_][a-z0-9_]*\s*\(' | tr -d ' (' | sort -u \
  | grep -vxE 'if|while|for|switch|return|sizeof' \
  | while read -r f; do grep -q "data-sym=\"$f\"" "$TMP/dom.html" || echo -n "$f "; done)
[ -n "$MISSING" ] && echo "△ 카드가 없는 함수: $MISSING" || echo "✓ 코드의 모든 함수 호출에 카드가 있음"

# ④ 스크린샷 (개요) — 눈으로 확인용
"$BROWSER" --headless=new --disable-gpu --hide-scrollbars --window-size=1500,1000 --virtual-time-budget=4000 \
  --screenshot="$(cygpath -w "$TMP" 2>/dev/null || echo "$TMP")/overview.png" "$URL" 2>/dev/null || true
echo "  스크린샷: $TMP/overview.png   (카드 화면은 $OUT#심볼키 로 열기)"

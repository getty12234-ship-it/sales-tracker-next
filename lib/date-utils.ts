// 日付ユーティリティ（全てローカル(JST)時刻ベース・UTC問題なし）

// 内部: YYYY-MM-DD文字列をローカル(JST)のDateに変換（new Date(str) はUTC解釈になるので避ける）
function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// 内部: DateをローカルYYYY-MM-DD文字列にフォーマット（toISOString()はUTCになるので避ける）
function formatLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 今日の日付をYYYY-MM-DD形式で返す（ローカル時刻ベース・JST対応）
export function today(): string {
  return formatLocal(new Date())
}

// 指定日が属する週の月曜日を返す (YYYY-MM-DD)
export function getWeekStart(dateStr: string): string {
  const d = parseDateLocal(dateStr)
  const day = d.getDay() // 0=日, 1=月 ... 6=土
  const diff = day === 0 ? -6 : 1 - day // 月曜日に調整
  d.setDate(d.getDate() + diff)
  return formatLocal(d)
}

// 週の月〜日曜日を配列で返す
export function getWeekDays(weekStart: string): string[] {
  const days: string[] = []
  const d = parseDateLocal(weekStart)
  for (let i = 0; i < 7; i++) {
    days.push(formatLocal(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

// YYYY-MM-DD → MM/DD(曜日)
export function formatDateJa(dateStr: string): string {
  const d = parseDateLocal(dateStr)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`
}

// YYYY-MM-DD → M月D日(曜日)
export function formatDateJaLong(dateStr: string): string {
  const d = parseDateLocal(dateStr)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`
}

// YYYY-MM-DD → YYYY-MM (年月キー)
export function getYearMonth(dateStr: string): string {
  return dateStr.substring(0, 7)
}

// YYYY-MM → 月末日 YYYY-MM-DD
export function endOfMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  // new Date(year, month, 0) = 翌月の0日目 = 当月末日
  const last = new Date(year, month, 0)
  return formatLocal(last)
}

// 前週/次週の月曜日を返す
export function addWeeks(weekStart: string, n: number): string {
  const d = parseDateLocal(weekStart)
  d.setDate(d.getDate() + n * 7)
  return formatLocal(d)
}

// 週の表示ラベル (例: "5/5(月) - 5/11(日)")
export function getWeekLabel(weekStart: string): string {
  const days = getWeekDays(weekStart)
  const start = formatDateJa(days[0])
  const end = formatDateJa(days[6])
  return `${start} - ${end}`
}

// 月の全日を配列で返す
export function getMonthDays(yearMonth: string): string[] {
  const [year, month] = yearMonth.split('-').map(Number)
  const days: string[] = []
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    days.push(formatLocal(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

// 今月のYYYY-MM
export function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// YouTubeのURLからビデオIDを抽出
export function extractYoutubeId(url: string): string | null {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

// YouTubeサムネイルURL
export function getYoutubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
}

// パーセント計算（分母0対策）
export function pct(a: number, b: number): number {
  if (!b) return 0
  return Math.round((a / b) * 100)
}

// 残り営業日計算（末日-3日 - 今日の日付）※当月の場合のみ意味あり
export function remainingWorkdays(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number)
  const now = new Date()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month
  const lastDay = new Date(year, month, 0).getDate()
  const todayDate = isCurrentMonth ? now.getDate() : lastDay
  return Math.max(0, lastDay - 3 - todayDate)
}

// 経過営業日計算
export function passedWorkdays(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number)
  const now = new Date()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month
  const endDate = isCurrentMonth ? now : new Date(year, month, 0)
  const firstDay = new Date(year, month - 1, 1)
  let count = 0
  for (let d = new Date(firstDay); d < endDate; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

// 総営業日数
export function totalWorkdays(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  let count = 0
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

// ===== 予算ペース計算 =====

// 使える日数 = 月末日 - 3
export function usableDays(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return Math.max(1, lastDay - 3)
}

// 日当たり予算 = 予算 / 使える日数
export function dailyBudgetRate(budget: number, yearMonth: string): number {
  const days = usableDays(yearMonth)
  if (!budget || !days) return 0
  return budget / days
}

// 経過した「使える日数」= min(今日の日付, 使える日数)。非当月は満了(=usableDays)。
//   ※ ペース計算(cumulativeBudgetTarget/weeklyAccrual)と同じ usableDays(月末-3) 暦日基準。
//      「経過/残り」表示で営業日(passedWorkdays)と暦日(remainingWorkdays)を混在させない統一基準。
export function elapsedUsableDays(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number)
  const now = new Date()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month
  const ymNum = year * 12 + month
  const nowNum = now.getFullYear() * 12 + (now.getMonth() + 1)
  const lastDay = new Date(year, month, 0).getDate()
  // 当月=今日 / 過去月=満了(月末) / 未来月=0(まだ1日も経過していない＝累積目標0・遅れ判定もしない)
  const todayDate = isCurrentMonth ? now.getDate() : (ymNum > nowNum ? 0 : lastDay)
  return Math.min(todayDate, usableDays(yearMonth))
}

// 残りの「使える日数」= usableDays - 経過。過去月=0(経過満了)、未来月=0(まだ始まっていない)。
export function remainingUsableDays(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number)
  const now = new Date()
  const ymNum = year * 12 + month
  const nowNum = now.getFullYear() * 12 + (now.getMonth() + 1)
  // 未来月は elapsed=0 のため usableDays-0=満額になってしまう。未来月の「残り」は0（経過0であって残り満額ではない）
  if (ymNum > nowNum) return 0
  return Math.max(0, usableDays(yearMonth) - elapsedUsableDays(yearMonth))
}

// 当日までの累積目標 = 日当たり × 経過した使える日数（当月=今日 / 過去月=満了 / 未来月=0）
export function cumulativeBudgetTarget(budget: number, yearMonth: string): number {
  const days = usableDays(yearMonth)
  if (!budget || !days) return 0
  const elapsed = elapsedUsableDays(yearMonth)
  return Math.round((budget / days) * elapsed * 10) / 10
}

// ===== 週次ペース計算（試作シートのバー表示用） =====
// 月次バー(cumulativeBudgetTarget)と完全に同じ「使える日数=月末-3日」基準で算出する。
//   日当たり = 月の値 / 使える日数(例: 6月=30-3=27)
//   週の予算 = 日当たり × その週の「使える暦日数」(月内 かつ 末3日を除く)
//   - 末3日(28,29,30日)は使えないので数えない → 月次と同じ
//   - これで「週の全週を足すと月予算」「週の“今ここまで線”が月次の“今日まで線”と同じ日付で一致」する
//   - 基準月は週の月曜が属する月（月またぎでも安定）

// 週内の各「使える日」を、その日が属する月の日当たり(monthlyValue/usableDays(その月))で評価して合算する。
//   - 月またぎ週でも、両方の月のレートを日ごとに混在加算するので 0 に落ちない（旧実装は基準月固定＋末3日カットの二重脱落で月末週/月またぎ週が0になりバグっていた）
//   - 末3日(使えない日)はその月基準で除外
//   - untilToday=true なら今日以前の日のみ（進行中の週のペース）
function weeklyAccrual(monthlyValue: number, weekStart: string, untilToday: boolean): number {
  if (!monthlyValue) return 0
  const todayStr = today()
  let total = 0
  for (const ds of getWeekDays(weekStart)) {
    if (untilToday && ds > todayStr) continue
    const ymD = getYearMonth(ds)
    const [y, m] = ymD.split('-').map(Number)
    const cutoff = new Date(y, m, 0).getDate() - 3 // その月の使える最終日
    const dom = parseDateLocal(ds).getDate()
    if (dom > cutoff) continue                     // 末3日は使えない
    const ud = usableDays(ymD)
    if (!ud) continue
    total += monthlyValue / ud
  }
  return Math.round(total * 10) / 10
}

// 週の予算(または目標) = その週の使える日について 月の日当たり を合算
export function weeklyTarget(monthlyValue: number, weekStart: string): number {
  return weeklyAccrual(monthlyValue, weekStart, false)
}

// 週の「今(今週)/その週(先週)ここまでに到達しておきたい」ペース
//   完了済みの週 → 週の全使える日 → weeklyTarget と一致（その週フルの目安）
//   進行中の週   → 今日までの分だけ（月次の cumulativeBudgetTarget と同じ日付で一致）
export function weeklyCumulativeTarget(monthlyValue: number, weekStart: string): number {
  return weeklyAccrual(monthlyValue, weekStart, true)
}

// 今から必要な日当たり = (予算 - 達成数) / 残り使える日数。
// 「今から」は当月のみ意味を持つ（過去/未来月は0）。残りは remainingUsableDays と同一基準で、
// 月末3日(残り0)では下限1にクランプせず0を返す（「残り0日」なのに「N本/日必要」の矛盾を防ぐ）。
export function requiredDailyFromNow(budget: number, achieved: number, yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number)
  const now = new Date()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month
  const days = usableDays(yearMonth)
  if (!isCurrentMonth || !budget || !days) return 0
  const remaining = Math.max(0, days - elapsedUsableDays(yearMonth))
  if (!remaining) return 0
  const deficit = budget - achieved
  if (deficit <= 0) return 0
  return Math.ceil((deficit / remaining) * 10) / 10
}

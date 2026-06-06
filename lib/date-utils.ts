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

// 当日までの累積目標 = 日当たり × min(今日の日付, 使える日数)
export function cumulativeBudgetTarget(budget: number, yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number)
  const now = new Date()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month
  const todayDate = isCurrentMonth ? now.getDate() : new Date(year, month, 0).getDate()
  const days = usableDays(yearMonth)
  if (!budget || !days) return 0
  const elapsed = Math.min(todayDate, days)
  return Math.round((budget / days) * elapsed * 10) / 10
}

// ===== 週次ペース計算（試作シートのバー表示用） =====
// 考え方: 月の予算/目標を「平日(月〜金)1日あたり」に直し、その週の平日数を掛ける。
//   週の予算 = (月予算 / 月の総平日数) × その週の平日数
//   - 基準月は週の月曜日が属する月（月またぎでも安定。先週が先月でも予算ラインが消えない）
//   - 進行中の週は「今日以前の平日数」だけ掛けて“今ここまで”の目印にする

// 指定週(月〜日)の平日(月〜金)の YYYY-MM-DD を返す
function weekdaysOfWeek(weekStart: string): string[] {
  return getWeekDays(weekStart).filter(ds => {
    const dow = parseDateLocal(ds).getDay()
    return dow !== 0 && dow !== 6
  })
}

// 週の予算(または目標) = 日当たり(月基準) × その週の平日数
export function weeklyTarget(monthlyValue: number, weekStart: string): number {
  if (!monthlyValue) return 0
  const monthWd = totalWorkdays(getYearMonth(weekStart))
  if (!monthWd) return 0
  const wd = weekdaysOfWeek(weekStart).length
  return Math.round((monthlyValue / monthWd) * wd * 10) / 10
}

// 週の「今(今週)/その週(先週)ここまでに到達しておきたい」ペース
//   = 日当たり(月基準) × 週内で今日以前の平日数
//   完了済みの週 → 週の全平日が今日以前 → weeklyTarget と一致（その週フルの目安）
//   進行中の週   → 今日までの平日分だけ
export function weeklyCumulativeTarget(monthlyValue: number, weekStart: string): number {
  if (!monthlyValue) return 0
  const monthWd = totalWorkdays(getYearMonth(weekStart))
  if (!monthWd) return 0
  const todayStr = today()
  const wd = weekdaysOfWeek(weekStart).filter(ds => ds <= todayStr).length
  return Math.round((monthlyValue / monthWd) * wd * 10) / 10
}

// 今から必要な日当たり = (予算 - 達成数) / 残り使える日数
export function requiredDailyFromNow(budget: number, achieved: number, yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number)
  const now = new Date()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month
  const todayDate = isCurrentMonth ? now.getDate() : new Date(year, month, 0).getDate()
  const days = usableDays(yearMonth)
  // 残り日数: 当月でなければ0、当月なら days - todayDate を1以上に
  const remaining = isCurrentMonth ? Math.max(1, days - todayDate) : 0
  if (!remaining || !budget) return 0
  const deficit = budget - achieved
  if (deficit <= 0) return 0
  return Math.ceil((deficit / remaining) * 10) / 10
}

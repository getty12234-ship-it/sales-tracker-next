// 日付ユーティリティ

// 今日の日付をYYYY-MM-DD形式で返す（ローカル時刻ベース・JST対応）
export function today(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 指定日が属する週の月曜日を返す (YYYY-MM-DD)
export function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDay() // 0=日, 1=月 ... 6=土
  const diff = day === 0 ? -6 : 1 - day // 月曜日に調整
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

// 週の月〜日曜日を配列で返す
export function getWeekDays(weekStart: string): string[] {
  const days = []
  const d = new Date(weekStart)
  for (let i = 0; i < 7; i++) {
    days.push(new Date(d).toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }
  return days
}

// YYYY-MM-DD → MM/DD(曜日)
export function formatDateJa(dateStr: string): string {
  const d = new Date(dateStr)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`
}

// YYYY-MM-DD → M月D日(曜日)
export function formatDateJaLong(dateStr: string): string {
  const d = new Date(dateStr)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`
}

// YYYY-MM-DD → YYYY-MM (年月キー)
export function getYearMonth(dateStr: string): string {
  return dateStr.substring(0, 7)
}

// 前週/次週の月曜日を返す
export function addWeeks(weekStart: string, n: number): string {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + n * 7)
  return d.toISOString().split('T')[0]
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
  const days = []
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    days.push(d.toISOString().split('T')[0])
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

// 残り営業日計算（末日-3日 - 今日の日付）
export function remainingWorkdays(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number)
  const today = new Date()
  const lastDay = new Date(year, month, 0).getDate()
  const todayDate = today.getDate()
  return Math.max(0, lastDay - 3 - todayDate)
}

// 経過営業日計算
export function passedWorkdays(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number)
  const today = new Date()
  const firstDay = new Date(year, month - 1, 1)
  let count = 0
  for (let d = new Date(firstDay); d < today; d.setDate(d.getDate() + 1)) {
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

// 今から必要な日当たり = (予算 - 達成数) / 残り使える日数
export function requiredDailyFromNow(budget: number, achieved: number, yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number)
  const now = new Date()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month
  const todayDate = isCurrentMonth ? now.getDate() : new Date(year, month, 0).getDate()
  const days = usableDays(yearMonth)
  const remaining = Math.max(0, days - todayDate)
  if (!remaining || !budget) return 0
  const deficit = budget - achieved
  if (deficit <= 0) return 0
  return Math.ceil((deficit / remaining) * 10) / 10
}

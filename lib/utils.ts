import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// CSV セル1個を RFC4180 でエスケープ（区切り/引用符/改行を含む値をクォート）。
// アカウント名等のフリーテキストにカンマが入ると列ズレでヘッダ対応が崩れるのを防ぐ。
export function csvEscape(value: unknown): string {
  const s = String(value ?? '')
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

// 行配列(2次元)を CSV 文字列にする共通ヘルパ
export function toCsv(rows: unknown[][]): string {
  return rows.map(r => r.map(csvEscape).join(',')).join('\n')
}

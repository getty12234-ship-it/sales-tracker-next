// 目標・予算の解決ロジックを全ビューで共有する単一ソース。
// （CW DEFAULT焼き込み漏れ・IG二重igキー・×nスケールのズレが画面ごとに分岐して
//   同一KPIが食い違うバグを防ぐため、ここに集約して全ビューから呼ぶ）

import { IG_DEFAULT_GOALS } from './constants'

// ===== その他（CW）目標 =====
// 予算が設定されているKPIのみ確定目標を採用する。DEFAULT_GOALS は混ぜない（＝未設定は 0）。
// ※ DEFAULT を混ぜると「IG設定済み×CW未設定」のメンバーで目標/達成率/色/ペース線が水増しされる。
export function resolveCwGoal(
  rawGoals: Record<string, number>,
  budgets: Record<string, number>,
  key: string,
): number {
  return budgets[key] > 0 ? (rawGoals[key] || 0) : 0
}

// インスタ目標/予算は「IG予算(b_ig_<key>)が設定されている時だけ設定値を信頼する」。
//   - IG目標は必ず予算とセットで保存される（SettingsViewは b>0 のときのみ ig_/b_ig_ を両方書く）。
//   - よって予算なしの ig_<key> は旧バグ(IG_DEFAULT焼き込み)の残骸 → 信頼せず無視する。
//     これで既存DB汚染が全ビューで読まれなくなり、DBクリーンアップ無しで正しい表示に戻る（再保存で実体も消える）。
function igCustomGoal(rawGoals: Record<string, number>, key: string): number | null {
  const b = rawGoals[`b_ig_${key}`]
  const g = rawGoals[`ig_${key}`]
  if (b !== undefined && b > 0 && g !== undefined && g > 0) return g
  return null
}

// ===== インスタ目標/予算（全アカウント合計基準） =====
// 設定値（予算とセットの ig_<key>。DB保存キーは二重ig。例 ig_ig_apo_get / ig_posts）があればそれが合計値。
// 未設定なら公式デフォルト(1アカ基準) × アカウント数 ＝ 合計。
//   key は IG_KPI_SUMMARY.key（例 'posts' / 'ig_apo_get'）。
// 単一アカ表示は呼び出し側で ÷n（scale）する。全アカ統合表示はこの値そのまま。
export function resolveIgGoalTotal(
  rawGoals: Record<string, number>,
  key: string,
  accountCount: number,
): number {
  const c = igCustomGoal(rawGoals, key)
  if (c !== null) return c
  return (IG_DEFAULT_GOALS[key] || 0) * Math.max(1, accountCount)
}

export function resolveIgBudgetTotal(
  rawGoals: Record<string, number>,
  key: string,
  accountCount: number,
): number {
  const b = rawGoals[`b_ig_${key}`]
  if (b !== undefined && b > 0) return b
  return resolveIgGoalTotal(rawGoals, key, accountCount) // デフォルトは予算=目標
}

// ===== インスタ目標/予算（合算ビュー用＝統合サマリー/統合実績） =====
// 合算ビューでは未設定IGをデフォルトで膨らませない（CWと足したときに phantom 目標を出さない）。
//   igKey は合算定義側のキー（例 'ig_apo_get'）。DB保存キーは 'ig_'+igKey。
export function resolveIgGoalCombined(rawGoals: Record<string, number>, igKey: string): number {
  if (!igKey) return 0
  const c = igCustomGoal(rawGoals, igKey)
  return c !== null ? c : 0
}
export function resolveIgBudgetCombined(rawGoals: Record<string, number>, igKey: string): number {
  if (!igKey) return 0
  const b = rawGoals[`b_ig_${igKey}`]
  return b !== undefined && b > 0 ? b : 0
}

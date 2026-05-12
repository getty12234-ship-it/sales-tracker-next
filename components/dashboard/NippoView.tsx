'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppState } from '@/lib/store'
import { getDailyReport, upsertDailyReport, getMonthlyVideos } from '@/lib/queries'
import { getWeekDays, formatDateJaLong, getYearMonth, extractYoutubeId, getYoutubeThumbnail } from '@/lib/date-utils'
import { syncEvents } from './Header'
import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Play, BookOpen, Heart, Video } from 'lucide-react'
import { WeekNav } from './WeekNav'

export function NippoView() {
  const { currentMember, currentWeekStart } = useAppState()
  const queryClient = useQueryClient()
  const weekDays = getWeekDays(currentWeekStart)
  const [selectedDate, setSelectedDate] = useState(weekDays[0])
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // 日が変わったら選択日をリセット
  useEffect(() => {
    setSelectedDate(weekDays[0])
    setPlayingVideo(null)
  }, [currentWeekStart])

  const yearMonth = getYearMonth(selectedDate)

  const { data: report } = useQuery({
    queryKey: ['daily_report', currentMember?.id, selectedDate],
    queryFn: () => getDailyReport(currentMember!.id, selectedDate),
    enabled: !!currentMember,
  })

  const { data: monthVideos = [] } = useQuery({
    queryKey: ['monthly_videos', yearMonth],
    queryFn: () => getMonthlyVideos(yearMonth),
  })

  // 今日の動画URL (preset)
  const todayVideoFromSchedule = monthVideos.find(v => v.date === selectedDate)?.video_url

  const { mutateAsync: save } = useMutation({
    mutationFn: upsertDailyReport,
    onSuccess: (data) => {
      queryClient.setQueryData(['daily_report', currentMember?.id, selectedDate], data)
      syncEvents.emit('saved')
      setTimeout(() => syncEvents.emit('idle'), 2000)
    },
    onError: () => syncEvents.emit('error'),
  })

  const [form, setForm] = useState({
    video_url: '',
    output: '',
    gratitude: '',
  })

  useEffect(() => {
    setForm({
      video_url: report?.video_url || todayVideoFromSchedule || '',
      output: report?.output || '',
      gratitude: report?.gratitude || '',
    })
  }, [report, todayVideoFromSchedule, selectedDate])

  const debouncedSave = (updates: Partial<typeof form>) => {
    if (!currentMember) return
    const next = { ...form, ...updates }
    setForm(next)
    syncEvents.emit('saving')

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      save({
        member_id: currentMember.id,
        date: selectedDate,
        ...next,
      })
    }, 800)
  }

  const videoId = extractYoutubeId(form.video_url)
  const thumbUrl = videoId ? getYoutubeThumbnail(videoId) : null

  if (!currentMember) {
    return <div className="text-slate-500 text-sm p-8 text-center">メンバーを選択してください</div>
  }

  return (
    <div className="space-y-4">
      {/* 日選択 */}
      <div className="flex flex-wrap gap-2">
        {weekDays.map(date => (
          <button
            key={date}
            onClick={() => { setSelectedDate(date); setPlayingVideo(null) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              date === selectedDate
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {formatDateJaLong(date)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* 左: 動画 */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              <Video className="w-4 h-4 text-indigo-400" />
              今日の動画 - {formatDateJaLong(selectedDate)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* URL入力 */}
            <Input
              className="bg-slate-950 border-slate-700 text-xs h-8"
              value={form.video_url}
              onChange={e => debouncedSave({ video_url: e.target.value })}
              placeholder="YouTube URL"
            />

            {/* 動画プレビュー */}
            {videoId && (
              <div>
                {playingVideo === videoId ? (
                  <div className="rounded-lg overflow-hidden aspect-video">
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                ) : (
                  <div
                    className="relative rounded-lg overflow-hidden aspect-video cursor-pointer group"
                    onClick={() => setPlayingVideo(videoId)}
                  >
                    <img
                      src={thumbUrl || ''}
                      alt="thumbnail"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/60 transition-colors">
                      <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                        <Play className="w-6 h-6 text-white fill-white ml-1" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!videoId && (
              <div className="rounded-lg border border-dashed border-slate-700 aspect-video flex items-center justify-center">
                <p className="text-slate-600 text-sm">動画URLを入力</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 右: 日報入力 */}
        <div className="space-y-3">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                アウトプット
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                className="bg-slate-950 border-slate-700 text-slate-200 text-sm min-h-32 resize-none"
                value={form.output}
                onChange={e => debouncedSave({ output: e.target.value })}
                placeholder="今日の学び・気づき・実践したこと..."
              />
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-400" />
                感謝
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                className="bg-slate-950 border-slate-700 text-slate-200 text-sm min-h-20 resize-none"
                value={form.gratitude}
                onChange={e => debouncedSave({ gratitude: e.target.value })}
                placeholder="今日感謝できること..."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

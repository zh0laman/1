export const getScoreColor = (score: number): string => {
  if (score >= 85) return '#10B981'
  if (score >= 65) return '#1E88E5'
  if (score >= 40) return '#F59E0B'
  return '#EF4444'
}

export const formatHours = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0ч'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return minutes ? `${hours}ч ${minutes}м` : `${hours}ч`
}

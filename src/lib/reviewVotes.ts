import { supabase } from './supabase'
import { requireAccount } from './account'

export type ReviewVote = { review_id: string; upvotes: number; downvotes: number; my_vote: -1 | 0 | 1 }
export const emptyReviewVote = (id: string): ReviewVote => ({ review_id: id, upvotes: 0, downvotes: 0, my_vote: 0 })

export async function getReviewVotes(ids: string[]): Promise<ReviewVote[]> {
  if (!ids.length) return []
  const rows: ReviewVote[] = []
  const unique = [...new Set(ids)]
  for (let offset = 0; offset < unique.length; offset += 200) {
    const { data, error } = await supabase.rpc('movie_review_votes', { p_review_ids: unique.slice(offset, offset + 200) })
    if (error) throw error
    rows.push(...(data ?? []).map((row: ReviewVote) => ({ ...row, upvotes: Number(row.upvotes), downvotes: Number(row.downvotes), my_vote: Number(row.my_vote) as ReviewVote['my_vote'] })))
  }
  return rows
}

export async function setReviewVote(id: string, value: ReviewVote['my_vote']) {
  const user = await requireAccount()
  if (value === 0) {
    const { error } = await supabase.from('review_votes').delete().eq('review_id', id).eq('user_id', user.id)
    if (error) throw error
    return
  }
  const response = await supabase.from('review_votes').insert({ review_id: id, user_id: user.id, value })
  if (response.error?.code === '23505') {
    const { error } = await supabase.from('review_votes').update({ value }).eq('review_id', id).eq('user_id', user.id)
    if (error) throw error
  } else if (response.error) throw response.error
}

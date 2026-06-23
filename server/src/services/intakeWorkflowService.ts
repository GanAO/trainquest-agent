import { parseTrainingText, parseTrainingTextMany } from './trainingTextParser'
import type { ParseResult, MultiParseResult, TrainingDraft } from './trainingTextParser'
import { createWorkout } from './workoutService'
import type { WorkoutProcessResult } from '../domain/types'

export type { TrainingDraft, ParseResult }

export interface BlockingIssue {
  message: string
}

export function getBlockingIssues(draft: TrainingDraft): BlockingIssue[] {
  const { exercises } = draft
  if (exercises.length === 0) {
    return [{ message: '尚未识别到任何训练动作' }]
  }
  const issues: BlockingIssue[] = []
  exercises.forEach((ex, i) => {
    const label = ex.name.trim() || `动作${i + 1}`
    if (!ex.name.trim()) {
      issues.push({ message: `动作${i + 1} 的名称待补充` })
    }
    if (ex.type === 'strength') {
      if (ex.sets <= 0) issues.push({ message: `${label} 的组数待补充` })
      if (ex.reps <= 0) issues.push({ message: `${label} 的次数待补充` })
    } else {
      if (ex.duration <= 0) issues.push({ message: `${label} 的时长待补充` })
    }
  })
  return issues
}

export async function previewTrainingText(
  text: string,
): Promise<ParseResult & { blockingIssues: BlockingIssue[] }> {
  const result = await parseTrainingText(text)
  const blockingIssues = getBlockingIssues(result.draft)
  return { ...result, blockingIssues }
}

export async function previewTrainingTextMany(
  text: string,
): Promise<MultiParseResult & { items: Array<{ draft: TrainingDraft; blockingIssues: BlockingIssue[] }> }> {
  const result = await parseTrainingTextMany(text)
  return {
    ...result,
    items: result.drafts.map(draft => ({
      draft,
      blockingIssues: getBlockingIssues(draft),
    })),
  }
}

export function commitTrainingDraft(
  draft: TrainingDraft,
  source: 'manual' | 'chat' | 'feishu' = 'feishu',
): WorkoutProcessResult {
  return createWorkout({
    date: draft.date,
    feeling: draft.feeling,
    exercises: draft.exercises,
    source,
  })
}

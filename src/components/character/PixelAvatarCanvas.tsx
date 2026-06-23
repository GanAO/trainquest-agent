import { useEffect, useRef } from 'react'
import type { AttributesStore, ProfileStore } from '../../domain/types'

interface Props {
  attributes: AttributesStore
  profile: ProfileStore
  jumping?: boolean
  idle?: boolean
}

// 视觉等级阶段 0-4
function getStage(level: number): number {
  if (level <= 2) return 0
  if (level <= 7) return 1
  if (level <= 14) return 2
  if (level <= 19) return 3
  return 4
}

function drawPixel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, 1, 1)
}

function drawRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

export default function PixelAvatarCanvas({ attributes, profile, jumping = false, idle = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 48
    const H = 64
    ctx.clearRect(0, 0, W, H)

    // 读取属性等级
    const chestLv = attributes.items.chest?.level ?? 1
    const shouldersLv = attributes.items.shoulders?.level ?? 1
    const armsLv = attributes.items.arms?.level ?? 1
    const legsLv = attributes.items.legs?.level ?? 1
    const coreLv = attributes.items.core?.level ?? 1
    const cardioLv = attributes.items.cardio?.level ?? 1

    const chestStage = getStage(chestLv)
    const shouldersStage = getStage(shouldersLv)
    const armsStage = getStage(armsLv)
    const legsStage = getStage(legsLv)
    const coreStage = getStage(coreLv)
    const cardioStage = getStage(cardioLv)

    const { skinTone, hairColor, shirtColor, shortsColor } = profile.avatar

    const skinColors = {
      light: '#f4c2a1',
      medium: '#c68642',
      dark: '#5c3317',
    }
    const skin = skinColors[skinTone]
    const hair = hairColor
    const shirt = shirtColor
    const shorts = shortsColor

    // ── 背景 ──────────────────────────────────────────────────────────
    // 透明背景

    // ── 心肺光环（仅高级别显示） ──────────────────────────────────────
    if (cardioStage >= 3) {
      ctx.globalAlpha = 0.3
      drawRect(ctx, 14, 8, 20, 50, '#06b6d4')
      ctx.globalAlpha = 1
    }

    // ── 腿 ──────────────────────────────────────────────────────────
    const legW = 6 + legsStage
    const leftLegX = 18 - Math.floor(legsStage / 2)
    const rightLegX = 24 + Math.floor(legsStage / 2)

    // 裤子
    drawRect(ctx, leftLegX, 40, legW, 12, shorts)
    drawRect(ctx, rightLegX, 40, legW, 12, shorts)
    // 小腿皮肤
    drawRect(ctx, leftLegX, 52, legW, 8, skin)
    drawRect(ctx, rightLegX, 52, legW, 8, skin)
    // 鞋子
    drawRect(ctx, leftLegX - 1, 58, legW + 2, 4, '#1f1f1f')
    drawRect(ctx, rightLegX - 1, 58, legW + 2, 4, '#1f1f1f')

    // ── 躯干 ────────────────────────────────────────────────────────
    const torsoW = 12 + chestStage * 2
    const torsoX = 18 - chestStage
    const waistW = torsoW - coreStage

    // 腰部（核心）
    drawRect(ctx, torsoX + 1, 34, waistW, 8, shirt)
    // 胸部
    drawRect(ctx, torsoX, 18, torsoW, 16, shirt)
    // 领子
    drawRect(ctx, torsoX + 3, 17, torsoW - 6, 3, skin)

    // ── 肩膀 ────────────────────────────────────────────────────────
    const shoulderBump = shouldersStage
    drawRect(ctx, torsoX - 1 - shoulderBump, 18, 3 + shoulderBump, 8, shirt)
    drawRect(ctx, torsoX + torsoW - 2, 18, 3 + shoulderBump, 8, shirt)

    // ── 手臂 ────────────────────────────────────────────────────────
    const armW = 4 + armsStage
    const armX_L = torsoX - armW - shoulderBump
    const armX_R = torsoX + torsoW + shoulderBump

    // 上臂（衬衫袖子）
    drawRect(ctx, armX_L, 18, armW, 10, shirt)
    drawRect(ctx, armX_R, 18, armW, 10, shirt)
    // 前臂（皮肤）
    drawRect(ctx, armX_L, 28, armW, 8, skin)
    drawRect(ctx, armX_R, 28, armW, 8, skin)
    // 手
    drawRect(ctx, armX_L, 36, armW, 4, skin)
    drawRect(ctx, armX_R, 36, armW, 4, skin)

    // ── 头部 ────────────────────────────────────────────────────────
    const headX = 17
    const headY = 4
    const headW = 14
    const headH = 14

    // 头发
    drawRect(ctx, headX - 1, headY, headW + 2, 6, hair)
    // 脸
    drawRect(ctx, headX, headY + 4, headW, headH - 2, skin)
    // 耳朵
    drawPixel(ctx, headX - 1, headY + 6, skin)
    drawPixel(ctx, headX + headW, headY + 6, skin)

    // 眼睛
    const eyeY = headY + 6
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(headX + 3, eyeY, 2, 2)
    ctx.fillRect(headX + 9, eyeY, 2, 2)

    // 嘴巴（微笑）
    ctx.fillStyle = '#7c3a3a'
    ctx.fillRect(headX + 4, headY + 11, 6, 1)
    ctx.fillRect(headX + 3, headY + 10, 1, 1)
    ctx.fillRect(headX + 10, headY + 10, 1, 1)

    // ── 星点（高属性时装饰） ──────────────────────────────────────────
    const avgStage = Math.round(
      (chestStage + shouldersStage + armsStage + legsStage + coreStage + cardioStage) / 6,
    )
    if (avgStage >= 3) {
      ctx.fillStyle = '#f59e0b'
      const stars = [[8, 10], [40, 14], [6, 35], [42, 28]]
      for (const [sx, sy] of stars) {
        ctx.fillRect(sx, sy, 1, 1)
        ctx.fillRect(sx + 1, sy - 1, 1, 1)
        ctx.fillRect(sx - 1, sy + 1, 1, 1)
      }
    }

  }, [attributes, profile, jumping])

  return (
    <div ref={containerRef} className="flex justify-center">
      <canvas
        ref={canvasRef}
        width={48}
        height={64}
        className={`${jumping ? 'char-jump' : ''} ${idle ? 'char-idle' : ''}`}
        style={{
          imageRendering: 'pixelated',
          width: '240px',
          height: '320px',
        }}
      />
    </div>
  )
}

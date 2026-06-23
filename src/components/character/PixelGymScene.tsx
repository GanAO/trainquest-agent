import { useEffect, useRef } from 'react'
import type { AttributesStore, ProfileStore } from '../../domain/types'

interface Props {
  attributes: AttributesStore
  profile: ProfileStore
  onClick?: () => void
}

// ── 基础绘制工具（复制自 PixelAvatarCanvas，不抽公共模块）──────────────────
function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, 1, 1)
}

function rect(
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

function getStage(level: number): number {
  if (level <= 2) return 0
  if (level <= 7) return 1
  if (level <= 14) return 2
  if (level <= 19) return 3
  return 4
}

// ── 健身房背景场景 ─────────────────────────────────────────────────────────
function drawGymBackground(ctx: CanvasRenderingContext2D) {
  const W = 160
  const FLOOR_Y = 78

  // 墙面
  rect(ctx, 0, 0, W, FLOOR_Y, '#1e2340')
  // 墙面底部踢脚线
  rect(ctx, 0, FLOOR_Y - 5, W, 5, '#252a4a')

  // 地板
  rect(ctx, 0, FLOOR_Y, W, 34, '#2c1a0e')
  // 地板高光线（紧贴墙面）
  rect(ctx, 0, FLOOR_Y, W, 1, '#4a2e18')
  // 地板横向木纹（每 8px 一条）
  for (let y = FLOOR_Y + 8; y < 112; y += 8) {
    rect(ctx, 0, y, W, 1, '#24160a')
  }
  // 地板纵向拼缝（稀疏）
  for (const x of [28, 56, 84, 112, 140]) {
    rect(ctx, x, FLOOR_Y + 1, 1, 33, '#24160a')
  }
}

function drawSpotLight(ctx: CanvasRenderingContext2D) {
  // 角色背后的暖色聚光晕
  const cx = 80
  const cy = 46
  const gradient = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34)
  gradient.addColorStop(0, 'rgba(255,220,100,0.10)')
  gradient.addColorStop(1, 'rgba(255,220,100,0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(cx, cy, 34, 0, Math.PI * 2)
  ctx.fill()
}

function drawGymProps(ctx: CanvasRenderingContext2D) {
  const FLOOR_Y = 78

  // ── 镜子（左侧墙面）─────────────────────────────────────────────────────
  const mirrorX = 6
  const mirrorY = 6
  const mirrorW = 40
  const mirrorH = 52
  rect(ctx, mirrorX, mirrorY, mirrorW, mirrorH, '#3a4080')           // 外框
  rect(ctx, mirrorX + 2, mirrorY + 2, mirrorW - 4, mirrorH - 4, '#1a1f38') // 镜面
  // 镜面高光（斜线感）
  ctx.globalAlpha = 0.3
  rect(ctx, mirrorX + 3, mirrorY + 3, 3, mirrorH - 10, '#6070c0')
  ctx.globalAlpha = 1

  // ── 励志海报（右侧墙面）─────────────────────────────────────────────────
  const posterX = 112
  const posterY = 5
  rect(ctx, posterX, posterY, 42, 26, '#3d1f0a')                     // 底色
  rect(ctx, posterX, posterY, 42, 4, '#c86420')                      // 顶部色带
  rect(ctx, posterX + 4, posterY + 7, 30, 2, '#6b3a1a')             // 文字线1
  rect(ctx, posterX + 4, posterY + 12, 24, 2, '#6b3a1a')            // 文字线2
  rect(ctx, posterX + 4, posterY + 17, 18, 2, '#6b3a1a')            // 文字线3
  // 海报边框
  rect(ctx, posterX, posterY, 42, 1, '#c86420')
  rect(ctx, posterX, posterY + 25, 42, 1, '#5a3010')
  rect(ctx, posterX, posterY, 1, 26, '#5a3010')
  rect(ctx, posterX + 41, posterY, 1, 26, '#5a3010')

  // ── 墙上小贴纸（左上角）─────────────────────────────────────────────────
  const stickers: [number, number, string][] = [
    [50, 7, '#e74c8b'],   // 粉色星形贴纸
    [56, 7, '#e74c8b'],
    [53, 10, '#e74c8b'],
    [60, 10, '#ffd700'],  // 金色贴纸
    [57, 13, '#4caf50'],  // 绿色
    [62, 14, '#4caf50'],
  ]
  for (const [sx, sy, color] of stickers) {
    px(ctx, sx, sy, color)
  }
  // 贴纸区小横幅
  rect(ctx, 48, 18, 20, 3, '#2a3060')
  rect(ctx, 49, 19, 18, 1, '#ffd700')

  // ── 杠铃架（左侧地面）───────────────────────────────────────────────────
  const rackX = 4
  const rackTop = FLOOR_Y - 28
  rect(ctx, rackX, rackTop, 2, 28, '#4a4a6a')        // 左柱
  rect(ctx, rackX + 14, rackTop, 2, 28, '#4a4a6a')   // 右柱
  rect(ctx, rackX, rackTop, 16, 2, '#4a4a6a')         // 顶横梁
  rect(ctx, rackX - 2, rackTop + 8, 22, 2, '#888899') // 杠铃杆
  rect(ctx, rackX - 3, rackTop + 4, 3, 10, '#556677') // 左侧重量片
  rect(ctx, rackX + 18, rackTop + 4, 3, 10, '#556677') // 右侧重量片

  // ── 训练垫（地面中央）───────────────────────────────────────────────────
  rect(ctx, 40, FLOOR_Y - 2, 80, 3, '#1a4020')
  rect(ctx, 40, FLOOR_Y - 2, 80, 1, '#2a5a30')   // 高光

  // ── 哑铃（右侧地面）─────────────────────────────────────────────────────
  const dbX = 124
  const dbY = FLOOR_Y - 10
  rect(ctx, dbX, dbY + 2, 4, 6, '#445566')       // 左哑铃头
  rect(ctx, dbX + 4, dbY + 3, 8, 4, '#667788')   // 手柄
  rect(ctx, dbX + 12, dbY + 2, 4, 6, '#445566')  // 右哑铃头

  // ── 水壶（右侧角落）─────────────────────────────────────────────────────
  const wbX = 149
  const wbY = FLOOR_Y - 18
  rect(ctx, wbX, wbY, 4, 3, '#2a7aaa')      // 盖子
  rect(ctx, wbX, wbY + 3, 4, 13, '#1a5a8a')  // 瓶身
  rect(ctx, wbX + 1, wbY + 5, 2, 4, '#2a6a9a') // 标签
}

// ── 角色绘制（完整复制自 PixelAvatarCanvas，含 offsetX/Y 和 idle 参数）──────
function drawCharacter(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  attributes: AttributesStore,
  profile: ProfileStore,
  blinkOpen: boolean,
) {
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
  const skinColors = { light: '#f4c2a1', medium: '#c68642', dark: '#5c3317' }
  const skin = skinColors[skinTone]
  const hair = hairColor
  const shirt = shirtColor
  const shorts = shortsColor

  const ox = offsetX
  const oy = offsetY

  // 心肺光环（高级别）
  if (cardioStage >= 3) {
    ctx.globalAlpha = 0.25
    rect(ctx, ox + 14, oy + 8, 20, 50, '#06b6d4')
    ctx.globalAlpha = 1
  }

  // 腿
  const legW = 6 + legsStage
  const leftLegX = 18 - Math.floor(legsStage / 2)
  const rightLegX = 24 + Math.floor(legsStage / 2)
  rect(ctx, ox + leftLegX, oy + 40, legW, 12, shorts)
  rect(ctx, ox + rightLegX, oy + 40, legW, 12, shorts)
  rect(ctx, ox + leftLegX, oy + 52, legW, 8, skin)
  rect(ctx, ox + rightLegX, oy + 52, legW, 8, skin)
  rect(ctx, ox + leftLegX - 1, oy + 58, legW + 2, 4, '#1f1f1f')
  rect(ctx, ox + rightLegX - 1, oy + 58, legW + 2, 4, '#1f1f1f')

  // 躯干
  const torsoW = 12 + chestStage * 2
  const torsoX = 18 - chestStage
  const waistW = torsoW - coreStage
  rect(ctx, ox + torsoX + 1, oy + 34, waistW, 8, shirt)
  rect(ctx, ox + torsoX, oy + 18, torsoW, 16, shirt)
  rect(ctx, ox + torsoX + 3, oy + 17, torsoW - 6, 3, skin)

  // 肩膀
  const shoulderBump = shouldersStage
  rect(ctx, ox + torsoX - 1 - shoulderBump, oy + 18, 3 + shoulderBump, 8, shirt)
  rect(ctx, ox + torsoX + torsoW - 2, oy + 18, 3 + shoulderBump, 8, shirt)

  // 手臂
  const armW = 4 + armsStage
  const armX_L = torsoX - armW - shoulderBump
  const armX_R = torsoX + torsoW + shoulderBump
  rect(ctx, ox + armX_L, oy + 18, armW, 10, shirt)
  rect(ctx, ox + armX_R, oy + 18, armW, 10, shirt)
  rect(ctx, ox + armX_L, oy + 28, armW, 8, skin)
  rect(ctx, ox + armX_R, oy + 28, armW, 8, skin)
  rect(ctx, ox + armX_L, oy + 36, armW, 4, skin)
  rect(ctx, ox + armX_R, oy + 36, armW, 4, skin)

  // 头部
  const headX = 17
  const headY = 4
  const headW = 14
  const headH = 14
  rect(ctx, ox + headX - 1, oy + headY, headW + 2, 6, hair)
  rect(ctx, ox + headX, oy + headY + 4, headW, headH - 2, skin)
  px(ctx, ox + headX - 1, oy + headY + 6, skin)
  px(ctx, ox + headX + headW, oy + headY + 6, skin)

  // 眼睛（支持眨眼）
  const eyeY = oy + headY + 6
  if (blinkOpen) {
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(ox + headX + 3, eyeY, 2, 2)
    ctx.fillRect(ox + headX + 9, eyeY, 2, 2)
  } else {
    // 闭眼：短横线
    ctx.fillStyle = '#2a2a3e'
    ctx.fillRect(ox + headX + 3, eyeY + 1, 2, 1)
    ctx.fillRect(ox + headX + 9, eyeY + 1, 2, 1)
  }

  // 嘴巴（微笑）
  ctx.fillStyle = '#7c3a3a'
  ctx.fillRect(ox + headX + 4, oy + headY + 11, 6, 1)
  ctx.fillRect(ox + headX + 3, oy + headY + 10, 1, 1)
  ctx.fillRect(ox + headX + 10, oy + headY + 10, 1, 1)

  // 高属性星点装饰
  const avgStage = Math.round(
    (chestStage + shouldersStage + armsStage + legsStage + coreStage + cardioStage) / 6,
  )
  if (avgStage >= 3) {
    ctx.fillStyle = '#f59e0b'
    const stars = [[ox + 8, oy + 10], [ox + 40, oy + 14], [ox + 6, oy + 35], [ox + 42, oy + 28]]
    for (const [sx, sy] of stars) {
      ctx.fillRect(sx, sy, 1, 1)
      ctx.fillRect(sx + 1, sy - 1, 1, 1)
      ctx.fillRect(sx - 1, sy + 1, 1, 1)
    }
  }
}

// ── 主组件 ─────────────────────────────────────────────────────────────────
export default function PixelGymScene({ attributes, profile, onClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    if (!ctx) return

    let frame = 0
    let rafId: number

    function loop() {
      frame++

      // 呼吸：每 30 帧一个周期，0 或 1px 上下浮动
      const bobOffset = Math.sin(frame / 15) > 0 ? 0 : 1

      // 眨眼：每 180 帧闭眼 8 帧
      const blinkOpen = frame % 180 < 172

      // 角色 x=56（中央偏左），y=16+bob（脚底 = 16+62 = 78 = 地板线）
      const charX = 56
      const charY = 16 + bobOffset

      ctx.clearRect(0, 0, 160, 112)
      drawGymBackground(ctx)
      drawSpotLight(ctx)
      drawGymProps(ctx)
      drawCharacter(ctx, charX, charY, attributes, profile, blinkOpen)

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [attributes, profile])

  return (
    <div
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', userSelect: 'none' }}
      className="flex justify-center"
    >
      <canvas
        ref={canvasRef}
        width={160}
        height={112}
        style={{
          width: '100%',
          maxWidth: '340px',
          aspectRatio: '160 / 112',
          imageRendering: 'pixelated',
          display: 'block',
        }}
      />
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import {
  ArrowDownToLine, ArrowLeft, Check, ChevronDown,
  Grip, ImagePlus, Plus, Settings2, ShieldCheck, Trash2, X,
} from 'lucide-react'

type Tier = { id: string; name: string; color: string }
type Picture = { id: string; src: string; name: string; tierId: string | null }

const palette = ['#e94852', '#f28a3b', '#f2ca4b', '#f5d0aa', '#f4f4f1', '#96b77d', '#75b9ce', '#c096d7']
const initialTiers: Tier[] = [
  { id: 'tier-1', name: '夯', color: '#e94852' },
  { id: 'tier-2', name: '顶级', color: '#f28a3b' },
  { id: 'tier-3', name: '人上人', color: '#f2ca4b' },
  { id: 'tier-4', name: 'NPC', color: '#f5d0aa' },
  { id: 'tier-5', name: '拉', color: '#f4f4f1' },
]

function App() {
  const [tiers, setTiers] = useState(initialTiers)
  const [pictures, setPictures] = useState<Picture[]>([])
  const [title, setTitle] = useState('拉夯了')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [inboxExpanded, setInboxExpanded] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [batchSize, setBatchSize] = useState(1)
  const [revealedIds, setRevealedIds] = useState<string[]>([])
  const fileInput = useRef<HTMLInputElement>(null)
  const exportCanvas = useRef<HTMLCanvasElement>(null)

  const assigned = pictures.filter((picture) => picture.tierId)
  const unranked = pictures.filter((picture) => !picture.tierId)
  const revealed = revealedIds.map((id) => pictures.find((picture) => picture.id === id)).filter((picture): picture is Picture => Boolean(picture && !picture.tierId))
  const hiddenUnranked = unranked.filter((picture) => !revealedIds.includes(picture.id))

  useEffect(() => {
    if (!drawMode) return
    setRevealedIds((current) => {
      const valid = current.filter((id) => pictures.some((picture) => picture.id === id && !picture.tierId)).slice(0, batchSize)
      const additions = pictures
        .filter((picture) => !picture.tierId && !valid.includes(picture.id))
        .slice(0, Math.max(0, batchSize - valid.length))
        .map((picture) => picture.id)
      const next = [...valid, ...additions]
      return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next
    })
  }, [batchSize, drawMode, pictures])

  function addFiles(files: FileList | File[]) {
    const accepted = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (!accepted.length) {
      setMessage('请选择 PNG、JPG、GIF 或 WebP 图片。')
      return
    }
    setPictures((current) => [...current, ...accepted.map((file) => ({
      id: crypto.randomUUID(), src: URL.createObjectURL(file), name: file.name, tierId: null,
    }))])
    setInboxExpanded(false)
    setMessage(`已添加 ${accepted.length} 张图片。`)
  }

  function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files)
    event.target.value = ''
  }

  function onDrop(event: DragEvent<HTMLElement>, tierId: string | null) {
    event.preventDefault()
    setDropTarget(null)
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'))
    if (files.length) {
      addFiles(files)
      return
    }
    const id = event.dataTransfer.getData('text/plain') || draggedId
    if (id) setPictures((current) => {
      const moving = current.find((picture) => picture.id === id)
      if (!moving) return current
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-picture-id]')
      const targetId = target?.dataset.pictureId
      const reordered = current.filter((picture) => picture.id !== id)
      const updated = { ...moving, tierId }
      const targetIndex = targetId ? reordered.findIndex((picture) => picture.id === targetId) : -1
      if (targetIndex >= 0 && target) {
        const after = event.clientX > target.getBoundingClientRect().left + target.getBoundingClientRect().width / 2
        reordered.splice(targetIndex + (after ? 1 : 0), 0, updated)
      } else if (tierId) {
        const lastTierItem = reordered.reduce((last, picture, index) => picture.tierId === tierId ? index : last, -1)
        reordered.splice(lastTierItem + 1, 0, updated)
      } else reordered.push(updated)
      return reordered
    })
    setDraggedId(null)
  }

  function updateTier(id: string, patch: Partial<Tier>) {
    setTiers((current) => current.map((tier) => tier.id === id ? { ...tier, ...patch } : tier))
  }

  function removePicture(id: string) {
    setPictures((current) => {
      const picture = current.find((item) => item.id === id)
      if (picture) URL.revokeObjectURL(picture.src)
      return current.filter((item) => item.id !== id)
    })
    setRevealedIds((current) => current.filter((pictureId) => pictureId !== id))
  }

  function clearAll() {
    pictures.forEach((picture) => URL.revokeObjectURL(picture.src))
    setPictures([])
    setRevealedIds([])
    setDrawMode(false)
    setInboxExpanded(false)
    setMessage('画布已清空。')
  }

  function startDrawing() {
    if (!unranked.length) return
    setDrawMode(true)
    setInboxExpanded(false)
    setMessage(`发牌开始，每次显示 ${batchSize} 张图片。`)
  }

  function stopDrawing() {
    setDrawMode(false)
    setInboxExpanded(false)
    setMessage('发牌已暂停，当前未分级图片仍会保留。')
  }

  async function saveImage() {
    if (!assigned.length) return
    const canvas = exportCanvas.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const titleHeight = 172
    const tierHeight = 232
    const padX = 204
    const padY = 28
    const cardWidth = 292
    const cardGap = 26
    const widestTier = Math.max(0, ...tiers.map((tier) => pictures.filter((picture) => picture.tierId === tier.id).length))
    const width = Math.max(1800, padX + widestTier * (cardWidth + cardGap) + 70)
    canvas.width = width
    canvas.height = titleHeight + tiers.length * tierHeight
    ctx.fillStyle = '#111211'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#f2f2ef'
    ctx.font = '700 82px "Noto Sans SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(title || '我的排名', width / 2, titleHeight / 2 + 4)
    for (let rowIndex = 0; rowIndex < tiers.length; rowIndex += 1) {
      const tier = tiers[rowIndex]
      const y = titleHeight + rowIndex * tierHeight
      ctx.fillStyle = tier.color
      ctx.fillRect(0, y, width, tierHeight - 4)
      ctx.fillStyle = tier.color.toLowerCase() === '#f4f4f1' || tier.color.toLowerCase() === '#f5d0aa' || tier.color.toLowerCase() === '#f2ca4b' ? '#171817' : '#fff'
      const fontSize = tier.name.length > 3 ? 48 : 64
      ctx.font = `700 ${fontSize}px "Noto Sans SC", "Microsoft YaHei", sans-serif`
      ctx.fillText(tier.name, 104, y + tierHeight / 2 - 2)
      const items = pictures.filter((picture) => picture.tierId === tier.id)
      for (let index = 0; index < items.length; index += 1) {
        const picture = items[index]
        const image = await loadImage(picture.src)
        const availableW = cardWidth
        const availableH = tierHeight - padY * 2
        // Keep the complete source image. Empty space uses the tier background, never a crop or black fill.
        const scale = Math.min(availableW / image.naturalWidth, availableH / image.naturalHeight)
        const imageW = image.naturalWidth * scale
        const imageH = image.naturalHeight * scale
        const x = padX + index * (availableW + cardGap)
        const imageY = y + (tierHeight - imageH) / 2
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, y + padY, availableW, availableH)
        ctx.clip()
        ctx.drawImage(image, x + (availableW - imageW) / 2, imageY, imageW, imageH)
        ctx.restore()
      }
    }
    canvas.toBlob((blob) => {
      if (!blob) return
      const link = document.createElement('a')
      link.download = `${(title || '我的排名').replace(/[\\/:*?"<>|]/g, '_')}.png`
      link.href = URL.createObjectURL(blob)
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
      setMessage('排名图已保存为 PNG。')
    }, 'image/png')
  }

  return (
    <main className="app-shell">
      <header className="command-bar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">▦</span>
          <div><span className="eyebrow">// TIER RANKING</span><h1>拉夯了</h1><p className="brand-description">上传图片并拖入不同梯队，按自己的标准排出一张可保存的排名图。</p></div>
        </div>
        <div className="command-meta"><span><ShieldCheck size={15} /> 本地处理</span><span className="meta-divider" /><span>NO. 001 <b>│</b> {String(pictures.length).padStart(2, '0')} 张</span></div>
        <button className="icon-button settings-toggle" onClick={() => setSettingsOpen(!settingsOpen)} aria-label="打开梯队设置" title="梯队设置"><Settings2 size={18} /></button>
      </header>

      <section className="workspace-heading">
        <div><span className="eyebrow">// RANKING BOARD</span><h2>排名画布</h2></div>
        <label className="title-field"><span>导出标题</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={40} aria-label="导出标题" /></label>
      </section>

      {settingsOpen && <section className="tier-settings" aria-label="梯队设置">
        <div className="settings-heading"><div><span className="eyebrow">// TIERS</span><h2>梯队设置</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="关闭梯队设置"><X size={18} /></button></div>
        <div className="tier-editor-list">{tiers.map((tier, index) => <div className="tier-editor" key={tier.id}>
          <span className="tier-index">{String(index + 1).padStart(2, '0')}</span>
          <input className="tier-name-input" value={tier.name} onChange={(event) => updateTier(tier.id, { name: event.target.value })} aria-label={`第 ${index + 1} 梯队名称`} maxLength={12} />
          <div className="color-options" aria-label={`${tier.name}颜色`}>
            {palette.map((color) => <button key={color} className={`color-swatch ${tier.color === color ? 'selected' : ''}`} style={{ '--swatch': color } as React.CSSProperties} onClick={() => updateTier(tier.id, { color })} aria-label={`设置颜色 ${color}`} aria-pressed={tier.color === color} />)}
          </div>
          <button className="icon-button delete-button" disabled={tiers.length === 1} onClick={() => { setTiers((current) => current.filter((item) => item.id !== tier.id)); setPictures((current) => current.map((picture) => picture.tierId === tier.id ? { ...picture, tierId: null } : picture)) }} aria-label={`删除${tier.name}梯队`} title={tiers.length === 1 ? '至少保留一个梯队' : '删除梯队'}><Trash2 size={16} /></button>
        </div>)}</div>
        <button className="text-action" onClick={() => setTiers((current) => [...current, { id: crypto.randomUUID(), name: `新梯队 ${current.length + 1}`, color: palette[current.length % palette.length] }])}><Plus size={16} /> 添加梯队</button>
      </section>}

      <section className="ranking-board" aria-label="排名梯队">
        {tiers.map((tier, index) => {
          const items = pictures.filter((picture) => picture.tierId === tier.id)
          return <div className={`tier-row ${dropTarget === tier.id ? 'is-drop-target' : ''}`} key={tier.id} onDragOver={(event) => { event.preventDefault(); setDropTarget(tier.id) }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => onDrop(event, tier.id)}>
            <div className="tier-label" style={{ '--tier-color': tier.color, color: tierTextColor(tier.color) } as React.CSSProperties}><span className="tier-number">{String(index + 1).padStart(2, '0')}</span><strong>{tier.name}</strong></div>
            <div className="tier-items" aria-label={`${tier.name}，${items.length} 张图片`}>
              {items.map((picture) => <ImageTile key={picture.id} picture={picture} onRemove={removePicture} onDragStart={(event) => { setDraggedId(picture.id); event.dataTransfer.setData('text/plain', picture.id); event.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => { setDraggedId(null); setDropTarget(null) }} />)}
              {!items.length && <span className="row-empty">拖入图片</span>}
            </div>
          </div>
        })}
      </section>

      <div className="action-strip">
        <div className="primary-actions">
          <button className="button button-primary" onClick={() => fileInput.current?.click()}><ImagePlus size={17} /><span>添加图片</span></button>
          <button className="button" disabled={!assigned.length} onClick={saveImage}><ArrowDownToLine size={17} /><span>保存排名图</span></button>
          <button className="button button-danger" disabled={!pictures.length} onClick={clearAll}><Trash2 size={16} /><span>清空</span></button>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={onFilesChange} />
        </div>
        <div className="board-count"><span>{pictures.length} 张图片</span><i /><span>{unranked.length} 张待排</span><i /><span>{assigned.length} 张已分级</span></div>
      </div>
      <div className="status-line" aria-live="polite">{message}</div>

      <section className={`inbox ${dropTarget === 'inbox' ? 'is-drop-target' : ''}`} onDragOver={(event) => { event.preventDefault(); setDropTarget('inbox') }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => onDrop(event, null)}>
        <div className="inbox-heading">
          <div className="inbox-title"><button className={`icon-button inbox-toggle ${inboxExpanded ? 'is-open' : ''}`} onClick={() => setInboxExpanded((current) => !current)} aria-label={inboxExpanded ? '收起全部待排图片' : '展开全部待排图片'} title={inboxExpanded ? '收起' : '展开'}><ChevronDown size={18} /></button><div><span className="eyebrow">// UNRANKED</span><h2>待排图片</h2></div></div>
          <div className="inbox-tools">
            <label className="batch-control"><span>每次显示</span><button className="stepper-button" onClick={() => setBatchSize((current) => Math.max(1, current - 1))} aria-label="减少每次显示数量">−</button><input type="number" min="1" max="8" value={batchSize} onChange={(event) => setBatchSize(Math.min(8, Math.max(1, Number(event.target.value) || 1)))} aria-label="每次显示数量" /><button className="stepper-button" onClick={() => setBatchSize((current) => Math.min(8, current + 1))} aria-label="增加每次显示数量">+</button><span>张</span></label>
            <button className={`button draw-button ${drawMode ? 'button-stop' : 'button-primary'}`} disabled={!unranked.length && !drawMode} onClick={drawMode ? stopDrawing : startDrawing}>{drawMode ? '暂停发牌' : '开始发牌'}</button>
          </div>
        </div>
        <div className="inbox-content">
          {drawMode && <div className="draw-stage"><div className="draw-stage-heading"><div><span className="eyebrow">// CURRENT DRAW</span><strong>{revealed.length ? `当前显示 ${revealed.length} 张` : hiddenUnranked.length ? '正在准备下一批' : '全部图片已处理'}</strong></div><span className="draw-remaining">剩余 {hiddenUnranked.length} 张</span></div>{revealed.length ? <div className="image-shelf draw-shelf">{revealed.map((picture) => <ImageTile key={picture.id} picture={picture} onRemove={removePicture} onDragStart={(event) => { setDraggedId(picture.id); event.dataTransfer.setData('text/plain', picture.id); event.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => { setDraggedId(null); setDropTarget(null) }} />)}</div> : <div className="draw-empty">把当前图片拖入上方梯队，下一张会立即出现。</div>}</div>}
          {!drawMode && !inboxExpanded && <div className="collapsed-state"><span className="empty-index">{String(unranked.length).padStart(2, '0')}</span><div><strong>{unranked.length ? `${unranked.length} 张图片已收起` : '待排图片会显示在这里'}</strong><p>{unranked.length ? '点击左侧箭头展开并删除不需要的图片。' : '可以上传图片，也可以把图片文件拖到这个区域。'}</p></div><ArrowLeft className="empty-arrow" size={20} /></div>}
          {inboxExpanded && <div className="expanded-shelf"><div className="expanded-label"><span className="eyebrow">// ALL UNRANKED</span><span>{unranked.length} 张未分级图片</span></div>{unranked.length ? <div className="image-shelf">{unranked.map((picture) => <ImageTile key={picture.id} picture={picture} onRemove={removePicture} onDragStart={(event) => { setDraggedId(picture.id); event.dataTransfer.setData('text/plain', picture.id); event.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => { setDraggedId(null); setDropTarget(null) }} />)}</div> : <div className="draw-empty">没有可删除的未分级图片。</div>}</div>}
          {!drawMode && !inboxExpanded && !unranked.length && <div className="drop-hint"><span>DROP FILES HERE</span><ChevronDown size={15} /></div>}
          {inboxExpanded && <div className="drop-hint"><span>DROP FILES HERE</span><ChevronDown size={15} /></div>}
        </div>
      </section>
      <div className="footer-line"><span>FROM LOCAL FILES</span><b>│</b><span>PNG EXPORT</span><b>│</b><span>GITHUB PAGES READY</span><span className="footer-ok"><Check size={14} /> READY</span></div>
      <canvas ref={exportCanvas} className="export-canvas" aria-hidden="true" />
    </main>
  )
}

function ImageTile({ picture, onRemove, onDragStart, onDragEnd }: {
  picture: Picture; onRemove: (id: string) => void
  onDragStart: (event: DragEvent<HTMLDivElement>) => void; onDragEnd: () => void
}) {
  return <div className="image-tile" data-picture-id={picture.id} draggable onDragStart={onDragStart} onDragEnd={onDragEnd} title={`${picture.name}，拖动以更改梯队`}>
    <img src={picture.src} alt={picture.name} draggable={false} />
    <span className="tile-grip"><Grip size={14} /></span>
    <button className="tile-remove" onClick={() => onRemove(picture.id)} aria-label={`移除${picture.name}`} title="移除图片"><X size={14} /></button>
  </div>
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function tierTextColor(hex: string) {
  const channels = hex.match(/[\da-f]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255) ?? [0, 0, 0]
  const luminance = channels.slice(0, 3).reduce((sum, channel, index) => {
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    return sum + linear * [0.2126, 0.7152, 0.0722][index]
  }, 0)
  return luminance < 0.32 ? '#ffffff' : '#171817'
}

export default App

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { EntryFormFields } from '../entry/EntryFormFields'
import { defaultCharacterOptions } from '../../lib/characters'
import { createInitialEntryValues } from '../../lib/entryService'
import { useLoginLayout } from '../../hooks/useLoginLayout'

const screens = {
  pc: { width: 1366, height: 768 },
  phone: { width: 390, height: 844 },
}

function LoginGuide({ source, viewport }: { source: string; viewport: { width: number; height: number } }) {
  const layout = useLoginLayout(source, viewport)
  const mask = layout.imageOverlap
    ? `linear-gradient(to ${layout.narrow ? 'bottom' : 'right'}, #000 0px, #000 ${layout.fadeStart}px, rgba(0,0,0,0.35) ${layout.fadeStart}px, rgba(0,0,0,0.35) 100%)`
    : undefined
  return <main ref={layout.pageRef} className="login-page" style={{ height: layout.height, top: 0, '--login-form-top': `${layout.formTop}px` } as CSSProperties}>
    <div className="login-theme-toggle"><span className="theme-toggle">☀ / ☾</span></div>
    <section className="login-panel">
      <img ref={layout.imageRef} className="login-hero-image" src={source} alt="調整中のログイン画像" onLoad={layout.onImageLoad} onError={layout.onImageLoad} style={{ left: layout.imageLeft, width: layout.imageWidth, height: layout.imageHeight, maskImage: mask, WebkitMaskImage: mask }} />
    </section>
    <section ref={layout.formWrapRef} className="login-form-wrap">
      <div ref={layout.contentRef} className="login-right-content">
        <header className="login-copy">
          <div className="event-badge">SERVER EVENT 2026</div>
          <h1>強化月間<br /><span>エントリー</span></h1>
          <p>Discordサーバーイベントの回答受付ページです。配布されたユーザーIDでログインしてください。</p>
        </header>
        <div className="card login-card">
          <h2>ログイン</h2><p className="muted">ユーザーIDとパスワードを入力</p>
          <label>ユーザーID<input disabled value="sample_user" readOnly /></label>
          <label>パスワード<input type="password" disabled value="sample-password" readOnly /></label>
          <button type="button" className="button primary full" disabled>ログイン</button>
          <p className="security-note">配布されたログイン情報を使用してください</p>
        </div>
      </div>
    </section>
  </main>
}

function EntryGuide({ source }: { source: string }) {
  const values = { ...createInitialEntryValues(), discordUsername: 'サンプルユーザー', producerName: 'サンプルP', category: defaultCharacterOptions[0].id }
  return <>
    <header className="app-header">
      <div className="brand"><span>★</span><span>強化月間エントリー</span></div>
      <nav aria-label="サンプルメニュー"><span>回答入力</span><span>参加履歴</span></nav>
      <div className="account"><span>sample_user</span><button type="button" className="button secondary small" disabled>ログアウト</button></div>
    </header>
    <main className="page narrow">
      <div className="entry-title-art"><img src={source} alt="調整中の回答入力バナー" /></div>
      <div className="page-title">
        <div><p className="eyebrow">EVENT ENTRY</p><h1>サンプル開催回</h1><p>イベントへの応募情報と確認画像を登録してください。</p></div>
        <div className="page-title-actions"><button type="button" className="button rules-button small" disabled>イベントルールを表示</button></div>
      </div>
      <fieldset className="entry-form-fields" disabled>
        <EntryFormFields values={values} errors={{}} existing={null} characters={defaultCharacterOptions} onChange={() => {}} />
      </fieldset>
      <button type="button" className="button primary submit-button" disabled>回答を送信する</button>
    </main>
  </>
}

export function PageImageGuide({ target, source }: { target: 'login' | 'entry'; source: string }) {
  const [device, setDevice] = useState<'pc' | 'phone'>(() => window.matchMedia('(max-width: 900px)').matches ? 'phone' : 'pc')
  const viewport = screens[device]
  const host = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null)
  const [mount, setMount] = useState<HTMLElement | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const measure = () => setWidth(host.current?.clientWidth ?? 0)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (host.current) observer?.observe(host.current)
    window.addEventListener('resize', measure)
    measure()
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  useEffect(() => {
    const doc = frame?.contentDocument
    if (!doc) return
    doc.open()
    doc.write('<!doctype html><html lang="ja"><head><meta charset="utf-8"></head><body><div id="guide-root"></div></body></html>')
    doc.close()
    const base = doc.createElement('base')
    base.href = document.baseURI
    doc.head.append(base)
    for (const style of document.querySelectorAll('style, link[rel="stylesheet"]')) {
      const copy = style.cloneNode(true) as HTMLElement
      if (style instanceof HTMLLinkElement) (copy as HTMLLinkElement).href = style.href
      doc.head.append(copy)
    }
    const syncTheme = () => { doc.documentElement.dataset.theme = document.documentElement.dataset.theme ?? 'dark' }
    syncTheme()
    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    setMount(doc.getElementById('guide-root'))
    return () => observer.disconnect()
  }, [frame])
  const scale = width > 0 ? Math.min(1, width / viewport.width) : 0
  return <section className="page-image-guide" aria-label="画面プレビュー">
    <div className="page-image-guide-heading">
      <h3>画面プレビュー</h3>
      <div className="page-image-guide-devices" role="group" aria-label="プレビューの画面サイズ">
        <button type="button" className="button secondary small" aria-pressed={device === 'pc'} onClick={() => setDevice('pc')}>PC</button>
        <button type="button" className="button secondary small" aria-pressed={device === 'phone'} onClick={() => setDevice('phone')}>スマホ</button>
      </div>
    </div>
    <p className="help">{viewport.width} × {viewport.height}・表示確認用のサンプルです。フォームは操作できません。</p>
    <div className="page-image-guide-host" ref={host}>
      <div className="page-image-guide-scaled" style={{ width: viewport.width * scale, height: viewport.height * scale }}>
        <iframe ref={setFrame} title={`${target === 'login' ? 'ログイン' : '回答入力'}画面の${device === 'pc' ? 'PC' : 'スマホ'}プレビュー`} sandbox="allow-same-origin" width={viewport.width} height={viewport.height} style={{ width: viewport.width, height: viewport.height, transform: `scale(${scale})` }} />
      </div>
    </div>
    {mount && createPortal(target === 'login' ? <LoginGuide source={source} viewport={viewport} /> : <EntryGuide source={source} />, mount)}
    <p className="help">{target === 'login' ? 'フォームに重なる画像は35%で表示します。' : 'バナーと回答フォームの配置を確認できます。プレビュー内をスクロールできます。'} ガイドは保存画像に含まれません。</p>
  </section>
}

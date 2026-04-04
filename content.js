"use strict"

// Limpa instância anterior se o script for reinjetado (após reload da extensão)
if (window.__stsCleanup) window.__stsCleanup()

const _state = {
  visible: false,
  tabs: [],
  selectedIndex: 0,
  mode: "vscode",
  host: null,
}

// ─── UI ────────────────────────────────────────────────────────────────────────

function _render() {
  if (_state.host) _state.host.remove()

  const host = document.createElement("div")
  host.style.cssText =
    "all:initial;position:fixed;top:0;left:0;z-index:2147483647;"
  const shadow = host.attachShadow({ mode: "open" })

  shadow.innerHTML = `
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      .overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.55);
        display: flex; align-items: flex-start; justify-content: center;
        padding-top: 12vh;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .panel {
        background: #1e1e1e; border: 1px solid #3c3c3c; border-radius: 8px;
        width: 520px; max-width: 92vw; max-height: 65vh;
        overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.75);
        display: flex; flex-direction: column;
        animation: appear 0.08s ease-out;
      }
      @keyframes appear {
        from { opacity:0; transform:translateY(-6px) scale(0.98); }
        to   { opacity:1; transform:translateY(0) scale(1); }
      }
      .header {
        padding: 10px 14px 8px; font-size: 10.5px; font-weight: 700;
        color: #6c6c6c; letter-spacing: 0.1em; text-transform: uppercase;
        border-bottom: 1px solid #2d2d2d; user-select: none;
      }
      .list {
        overflow-y: auto; flex: 1; padding: 4px 0;
        scrollbar-width: thin; scrollbar-color: #3c3c3c transparent;
      }
      .list::-webkit-scrollbar { width: 5px; }
      .list::-webkit-scrollbar-thumb { background: #3c3c3c; border-radius: 3px; }
      .item {
        display: flex; align-items: center; padding: 7px 14px; gap: 10px;
        cursor: pointer; color: #cccccc; font-size: 13px; user-select: none;
      }
      .item:hover  { background: #2a2d2e; }
      .item.active { background: #04395e; color: #fff; }
      .favicon { width:16px; height:16px; flex-shrink:0; border-radius:2px; object-fit:contain; }
      .favicon-ph { width:16px; height:16px; flex-shrink:0; border-radius:2px; background:#3c3c3c; }
      .info { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
      .title { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:13px; line-height:1.3; }
      .url { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:11px; color:#6c6c6c; }
      .item.active .url { color:#7fb3cc; }
      .badge { font-size:10px; color:#4ec9b0; font-weight:600; flex-shrink:0; }
      .footer {
        padding: 7px 14px; font-size: 11px; color: #5a5a5a;
        border-top: 1px solid #2d2d2d; display: flex; gap: 14px;
        flex-shrink: 0; flex-wrap: wrap; user-select: none;
      }
      kbd {
        background:#2d2d2d; border:1px solid #454545; border-radius:3px;
        padding:1px 5px; font-size:10px; color:#aaa;
      }
    </style>
    <div class="overlay" id="o">
      <div class="panel">
        <div class="header">Abas Recentes</div>
        <div class="list" id="l"></div>
        <div class="footer">
          <span><kbd>Tab</kbd> próxima &nbsp;<kbd>Shift+Tab</kbd> anterior</span>
          <span><kbd>↑↓</kbd> navegar &nbsp;<kbd>Enter</kbd> abrir &nbsp;<kbd>Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  `

  const list = shadow.getElementById("l")

  _state.tabs.forEach((tab, i) => {
    const item = document.createElement("div")
    item.className = "item" + (i === _state.selectedIndex ? " active" : "")

    if (tab.favIconUrl) {
      const img = document.createElement("img")
      img.className = "favicon"
      img.src = tab.favIconUrl
      img.alt = ""
      img.onerror = () => img.replaceWith(_ph())
      item.appendChild(img)
    } else {
      item.appendChild(_ph())
    }

    const info = document.createElement("div")
    info.className = "info"
    const title = document.createElement("div")
    title.className = "title"
    title.textContent = tab.title || "Sem título"
    const url = document.createElement("div")
    url.className = "url"
    try {
      const p = new URL(tab.url)
      url.textContent =
        p.hostname + (p.pathname !== "/" ? p.pathname.replace(/\/$/, "") : "")
    } catch {
      url.textContent = tab.url || ""
    }
    info.appendChild(title)
    info.appendChild(url)
    item.appendChild(info)

    if (i === 0) {
      const badge = document.createElement("span")
      badge.className = "badge"
      badge.textContent = "atual"
      item.appendChild(badge)
    }

    item.addEventListener("mousedown", (e) => {
      e.preventDefault()
      _selectAndClose(i)
    })
    list.appendChild(item)
  })

  shadow.getElementById("o").addEventListener("mousedown", (e) => {
    if (e.target.id === "o") _hide()
  })

  document.documentElement.appendChild(host)
  _state.host = host
  _scrollToActive(shadow)
}

function _ph() {
  const d = document.createElement("div")
  d.className = "favicon-ph"
  return d
}

function _scrollToActive(shadow) {
  ;(shadow || _state.host?.shadowRoot)
    ?.querySelector(".item.active")
    ?.scrollIntoView({ block: "nearest" })
}

function _updateActive() {
  const shadow = _state.host?.shadowRoot
  if (!shadow) return
  shadow
    .querySelectorAll(".item")
    .forEach((el, i) =>
      el.classList.toggle("active", i === _state.selectedIndex),
    )
  _scrollToActive(shadow)
}

function _navigate(delta) {
  if (!_state.visible || !_state.tabs.length) return
  _state.selectedIndex =
    (_state.selectedIndex + delta + _state.tabs.length) % _state.tabs.length
  _updateActive()
}

function _selectAndClose(index) {
  const tab = _state.tabs[index]
  if (tab) chrome.runtime.sendMessage({ action: "switchToTab", tabId: tab.id })
  _hide()
}

function _hide() {
  _state.host?.remove()
  _state.host = null
  _state.visible = false
  _state.tabs = []
  _state.selectedIndex = 0
}

// ─── Ponto de entrada chamado pelo background via executeScript ────────────────

window.__stsShow = function (tabs, mode) {
  _state.tabs = tabs
  _state.selectedIndex = tabs.length > 1 ? 1 : 0
  _state.mode = mode || "vscode"
  _state.visible = true
  _render()
}

// ─── Teclado ──────────────────────────────────────────────────────────────────

const _onKeydown = (e) => {
  if (!_state.visible) return
  switch (e.key) {
    case "Tab":
      e.preventDefault()
      e.stopImmediatePropagation()
      _navigate(e.shiftKey ? -1 : 1)
      break
    case "ArrowDown":
      e.preventDefault()
      e.stopImmediatePropagation()
      _navigate(1)
      break
    case "ArrowUp":
      e.preventDefault()
      e.stopImmediatePropagation()
      _navigate(-1)
      break
    case "Enter":
      e.preventDefault()
      e.stopImmediatePropagation()
      _selectAndClose(_state.selectedIndex)
      break
    case "Escape":
      e.preventDefault()
      e.stopImmediatePropagation()
      _hide()
      break
  }
}

const _onKeyup = (e) => {
  if (!_state.visible) return
  if (_state.mode === "vscode" && (e.key === "Control" || e.key === "Meta")) {
    _selectAndClose(_state.selectedIndex)
  }
}

document.addEventListener("keydown", _onKeydown, true)
document.addEventListener("keyup", _onKeyup, true)

// ─── Limpeza para a próxima reinjeção ─────────────────────────────────────────

window.__stsCleanup = function () {
  document.removeEventListener("keydown", _onKeydown, true)
  document.removeEventListener("keyup", _onKeyup, true)
  _hide()
  delete window.__stsShow
  delete window.__stsCleanup
}

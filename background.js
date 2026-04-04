"use strict"

let tabHistory = []
const MAX_HISTORY = 50

chrome.tabs.query({}, (tabs) => {
  // Ordena por lastAccessed para refletir uso real desde o início
  tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))
  tabs.forEach((tab) => {
    if (!tabHistory.includes(tab.id)) tabHistory.push(tab.id)
  })
})

chrome.tabs.onActivated.addListener(({ tabId }) => {
  tabHistory = tabHistory.filter((id) => id !== tabId)
  tabHistory.unshift(tabId)
  if (tabHistory.length > MAX_HISTORY) tabHistory.length = MAX_HISTORY
})

chrome.tabs.onRemoved.addListener((tabId) => {
  tabHistory = tabHistory.filter((id) => id !== tabId)
})

function buildOrderedTabs(allTabs) {
  const tabById = Object.fromEntries(allTabs.map((t) => [t.id, t]))
  const ordered = tabHistory
    .filter((id) => tabById[id])
    .map((id) => tabById[id])
  allTabs.forEach((tab) => {
    if (!ordered.some((t) => t.id === tab.id)) ordered.push(tab)
  })
  return ordered
}

// Páginas onde a injeção não é permitida ou poderia causar problemas
function canInject(url) {
  if (!url) return false
  if (/^(chrome|chrome-extension|about|data|javascript|blob):/.test(url))
    return false
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol === "http:") {
      // Evita IPs privados em HTTP para não disparar diálogo de rede local
      if (/^(localhost|127\.|10\.|192\.168\.)/.test(hostname)) return false
      if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false
    }
  } catch {
    return false
  }
  return true
}

// Remove favicons de IPs privados — evita mixed-content e Private Network Access
// ao renderizar imagens de roteador/NAS dentro de páginas HTTPS.
function safeFavicon(url) {
  if (!url) return null
  if (url.startsWith("data:")) return url
  try {
    const { protocol } = new URL(url)
    if (protocol === "https:" || protocol === "chrome-extension:") return url
  } catch {
    return null
  }
  return null
}

function prepareTabs(tabs) {
  return tabs.map(({ id, title, url, favIconUrl }) => ({
    id,
    title,
    url,
    favIconUrl: safeFavicon(favIconUrl),
  }))
}

// Ctrl+Q — troca direto para a aba anterior, sem UI
async function quickSwitch() {
  const [active] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  })
  if (!active) return
  const ordered = buildOrderedTabs(
    await chrome.tabs.query({ currentWindow: true }),
  )
  const target = ordered.find((t) => t.id !== active.id)
  if (target) chrome.tabs.update(target.id, { active: true })
}

// Ctrl+Shift+Q — abre a lista visual
async function openPicker() {
  const [active] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  })
  if (!active) return

  const ordered = buildOrderedTabs(
    await chrome.tabs.query({ currentWindow: true }),
  )
  if (!ordered.length) return

  if (!canInject(active.url)) {
    const target = ordered.find((t) => t.id !== active.id)
    if (target) chrome.tabs.update(target.id, { active: true })
    return
  }

  try {
    // activeTab + scripting: injeta apenas na aba ativa, sem content_scripts estático,
    // sem host_permissions amplas, sem aviso "todos os sites" na instalação.
    await chrome.scripting.executeScript({
      target: { tabId: active.id },
      files: ["content.js"],
    })
    await chrome.scripting.executeScript({
      target: { tabId: active.id },
      func: (tabs, mode) => window.__stsShow(tabs, mode),
      args: [prepareTabs(ordered), "picker"],
    })
  } catch {
    // Página não permite injeção — troca direto
    const target = ordered.find((t) => t.id !== active.id)
    if (target) chrome.tabs.update(target.id, { active: true })
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "quick-switch") quickSwitch()
  if (command === "open-picker") openPicker()
})

chrome.action.onClicked.addListener(() => openPicker())

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "switchToTab") {
    chrome.tabs
      .update(message.tabId, { active: true })
      .then((tab) => {
        if (tab) chrome.windows.update(tab.windowId, { focused: true })
      })
      .catch(() => {})
  }
})

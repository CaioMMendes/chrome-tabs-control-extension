'use strict';

let tabHistory = [];
const MAX_HISTORY = 50;

chrome.tabs.query({}, (tabs) => {
  tabs.forEach(tab => {
    if (!tabHistory.includes(tab.id)) tabHistory.push(tab.id);
  });
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  tabHistory = tabHistory.filter(id => id !== tabId);
  tabHistory.unshift(tabId);
  if (tabHistory.length > MAX_HISTORY) tabHistory.length = MAX_HISTORY;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabHistory = tabHistory.filter(id => id !== tabId);
});

function buildOrderedTabs(allTabs) {
  const tabById = Object.fromEntries(allTabs.map(t => [t.id, t]));
  const ordered = tabHistory.filter(id => tabById[id]).map(id => tabById[id]);
  allTabs.forEach(tab => {
    if (!ordered.some(t => t.id === tab.id)) ordered.push(tab);
  });
  return ordered;
}

// Ctrl+Shift+Y — troca direto para a aba anterior, sem UI
async function quickSwitch() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active) return;
  const ordered = buildOrderedTabs(await chrome.tabs.query({ currentWindow: true }));
  const target = ordered.find(t => t.id !== active.id);
  if (target) chrome.tabs.update(target.id, { active: true });
}

// Ctrl+Shift+U — abre a lista visual
async function openPicker() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active) return;

  const ordered = buildOrderedTabs(await chrome.tabs.query({ currentWindow: true }));
  if (!ordered.length) return;

  try {
    // Injeta (ou reinjeta) o content script — o próprio script faz a limpeza da instância anterior
    await chrome.scripting.executeScript({ target: { tabId: active.id }, files: ['content.js'] });

    // Chama a função exposta pelo content script diretamente, sem sendMessage
    await chrome.scripting.executeScript({
      target: { tabId: active.id },
      func: (tabs, mode) => window.__stsShow(tabs, mode),
      args: [ordered, 'picker'],
    });
  } catch {
    // Página não permite injeção (chrome://, nova aba) — troca direto
    const target = ordered.find(t => t.id !== active.id);
    if (target) chrome.tabs.update(target.id, { active: true });
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'quick-switch') quickSwitch();
  if (command === 'open-picker')  openPicker();
});

chrome.action.onClicked.addListener(() => openPicker());

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'switchToTab') {
    chrome.tabs.update(message.tabId, { active: true })
      .then(tab => { if (tab) chrome.windows.update(tab.windowId, { focused: true }); })
      .catch(() => {});
  }

  // Botão do mouse: troca rápida direto
  if (message.action === 'quickSwitch') {
    quickSwitch();
  }

  // Botão do mouse: devolve lista de abas para o content script mostrar o seletor
  if (message.action === 'getTabList') {
    chrome.tabs.query({ currentWindow: true }, (allTabs) => {
      sendResponse({ tabs: buildOrderedTabs(allTabs) });
    });
    return true; // mantém canal aberto para resposta assíncrona
  }
});

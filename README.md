# Smart Tab Switcher

Extensão para Chrome que adiciona dois modos de troca de abas por ordem de uso recente:

- **Troca rápida** — vai direto para a aba anterior, sem abrir nenhuma UI
- **Seletor visual** — abre uma lista estilo VSCode para escolher qual aba acessar

---

## Instalação

1. Abra `chrome://extensions/`
2. Ative o **Modo do desenvolvedor** (toggle no canto superior direito)
3. Clique em **"Carregar sem compactação"**
4. Selecione a pasta `chrome-tabs-control-extension`

> Após modificar qualquer arquivo, clique em **↺ Recarregar** na extensão e pressione **F5** nas abas abertas.

---

## Configurar os atalhos (obrigatório)

O Chrome não aplica atalhos automaticamente. É necessário configurar manualmente:

1. Acesse `chrome://extensions/shortcuts`
2. Localize **Smart Tab Switcher** e configure os dois campos:

| Campo | Atalho sugerido |
|---|---|
| Trocar para a aba anterior | `Ctrl+Q` |
| Abrir lista de abas recentes | `Ctrl+Shift+Q` |

3. Clique em cada campo, pressione o atalho desejado e confirme

> Você pode usar qualquer combinação disponível. Os atalhos acima são apenas sugestões.

---

## Como usar

### Troca rápida — `Ctrl+Q`

Vai diretamente para a aba que você estava antes. Pressione várias vezes para alternar entre as duas abas mais recentes.

### Seletor visual — `Ctrl+Shift+Q`

Abre a lista de abas ordenada por uso recente.

| Tecla | Ação |
|---|---|
| `↓` ou `Tab` | Próxima aba na lista |
| `↑` ou `Shift+Tab` | Aba anterior na lista |
| `Enter` | Abrir a aba selecionada |
| `Esc` | Fechar sem trocar |
| Clique | Abrir a aba clicada |

Você também pode clicar no **ícone da extensão** na barra do Chrome para abrir o seletor.

---

## Como funciona

### Arquitetura

```
manifest.json   — permissões, atalhos, content script
background.js   — service worker: histórico de abas, comandos
content.js      — UI do seletor (Shadow DOM), teclado
```

### Fluxo — troca rápida

```
Ctrl+Q
  → Chrome Command intercepta (página não recebe a tecla)
  → background busca a aba mais recente diferente da atual
  → chrome.tabs.update ativa essa aba
```

### Fluxo — seletor visual

```
Ctrl+Shift+Q
  → Chrome Command intercepta
  → background injeta content.js (ou reinicia se desatualizado)
  → background chama window.__stsShow(tabs, 'picker') via executeScript
  → content.js renderiza o painel em Shadow DOM
  → usuário navega e escolhe a aba
  → content.js envia switchToTab para background
  → background ativa a aba e foca a janela
```

### Histórico de uso

O `background.js` escuta `chrome.tabs.onActivated` e mantém um array de IDs com até 50 abas, ordenado do mais para o menos recente. Esse array é usado para ordenar a lista no seletor. Abas fechadas são removidas via `chrome.tabs.onRemoved`.

O histórico é mantido em memória — é zerado quando o Chrome é reiniciado ou a extensão é recarregada.

### Shadow DOM

O painel do seletor é criado dentro de um Shadow DOM para isolar os estilos da página e evitar conflitos visuais.

### Reinjeção automática

Se o content script estiver desatualizado (após recarregar a extensão sem dar F5 na aba), o background apaga o estado anterior e reinjeta `content.js` automaticamente antes de abrir o seletor.

---

## Permissões

| Permissão | Uso |
|---|---|
| `tabs` | Ler título, URL, favicon; ativar abas |
| `windows` | Focar a janela ao trocar de aba |
| `scripting` | Injetar `content.js` dinamicamente quando necessário |
| `activeTab` | Acesso à aba atual sem permissões amplas |

---

## Limitações

- **`chrome://` e nova aba**: o content script não pode ser injetado nessas páginas. O seletor visual não aparece — a extensão troca direto para a aba mais recente.
- **`Ctrl+Tab` não pode ser sobrescrito**: é uma restrição do Chrome para todas as extensões.
- **Botões laterais do mouse (4 e 5)**: o Chrome processa esses botões para navegação antes de despachar eventos JavaScript. Não é possível interceptá-los em extensões. Para remapear, use o software do seu mouse (Logitech G Hub, Razer Synapse etc.) ou AutoHotKey para enviar `Ctrl+Q` / `Ctrl+Shift+Q`.
- **Histórico não é persistido**: reiniciar o Chrome ou recarregar a extensão zera a ordem de uso.

---

## Solução de problemas

**O atalho não faz nada**
→ Verifique `chrome://extensions/shortcuts` — o campo pode estar vazio

**O seletor abre mas troca de aba sozinho**
→ Recarregue a aba (F5) após recarregar a extensão

**Aparece um dialog de permissão ao pressionar o atalho**
→ O atalho não está registrado no Chrome e a página está interceptando a tecla
→ Configure o atalho em `chrome://extensions/shortcuts`

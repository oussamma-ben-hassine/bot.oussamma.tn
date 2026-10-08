// Initialisation des icônes Lucide
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  initApp();
});

// État Global de l'Application
const state = {
  conversations: [],
  currentConversationId: null,
  isGenerating: false,
  webSearchEnabled: false,
  currentTheme: 'light',
  user: null,
  config: {
    provider: 'sso',
    ssoEndpoint: 'https://sso-a.oussamma.tn/api/v1/integrations/ai/prompt',
    model: 'gpt-4o',
    apiKey: '',
    systemPrompt: "Tu es un assistant IA conversationnel moderne, précis et serviable. Réponds avec intelligence et structure toujours tes réponses avec du beau Markdown.",
    defaultWebSearch: false
  }
};

// Éléments du DOM
const DOM = {
  sidebar: document.getElementById('sidebar'),
  sidebarBackdrop: document.getElementById('sidebarBackdrop'),
  openSidebarBtn: document.getElementById('openSidebarBtn'),
  closeSidebarBtn: document.getElementById('closeSidebarBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  conversationsList: document.getElementById('conversationsList'),
  userAvatar: document.getElementById('userAvatar'),
  userName: document.getElementById('userName'),
  userStatus: document.getElementById('userStatus'),
  authBtn: document.getElementById('authBtn'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeIconSun: document.getElementById('themeIconSun'),
  themeIconMoon: document.getElementById('themeIconMoon'),
  chatMessages: document.getElementById('chatMessages'),
  welcomeScreen: document.getElementById('welcomeScreen'),
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  webSearchToggle: document.getElementById('webSearchToggle'),
  webSearchBadge: document.getElementById('webSearchBadge'),
  searchIndicator: document.getElementById('searchIndicator'),
  searchIndicatorText: document.getElementById('searchIndicatorText'),
  modelSelectorBtn: document.getElementById('modelSelectorBtn'),
  currentModelLabel: document.getElementById('currentModelLabel'),
  modelDropdown: document.getElementById('modelDropdown'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  closeSettingsModal: document.getElementById('closeSettingsModal'),
  cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  configProvider: document.getElementById('configProvider'),
  configEndpoint: document.getElementById('configEndpoint'),
  configModel: document.getElementById('configModel'),
  configApiKey: document.getElementById('configApiKey'),
  configSystemPrompt: document.getElementById('configSystemPrompt'),
  configDefaultWebSearch: document.getElementById('configDefaultWebSearch')
};

// Initialisation de l'application
async function initApp() {
  initTheme();
  loadConfig();
  loadConversations();
  setupEventListeners();
  await checkAuthStatus();

  if (state.conversations.length > 0) {
    selectConversation(state.conversations[0].id);
  } else {
    createNewConversation();
  }

  // Si on revient d'une reconnexion réussie, purger l'ancien message d'erreur
  if (window.location.search.includes('reconnected=1')) {
    window.history.replaceState({}, document.title, window.location.pathname);
    const currentChat = getCurrentConversation();
    if (currentChat && currentChat.messages && currentChat.messages.length > 0) {
      const lastMsg = currentChat.messages[currentChat.messages.length - 1];
      if (lastMsg.role === 'assistant' && (lastMsg.content.includes('Session SSO expirée') || lastMsg.content.includes('session SSO a expiré'))) {
        currentChat.messages.pop();
        saveConversations();
        renderMessages();
      }
    }
  }
}

// -------------------------------------------------------------
// GESTION DU THÈME CLAIR / SOMBRE (Par défaut : Clair)
// -------------------------------------------------------------
function initTheme() {
  const savedTheme = localStorage.getItem('bot_oussamma_theme') || 'light';
  setTheme(savedTheme);
}

function setTheme(theme) {
  state.currentTheme = theme;
  localStorage.setItem('bot_oussamma_theme', theme);
  const html = document.documentElement;

  const hljsLight = document.getElementById('hljsLight');
  const hljsDark = document.getElementById('hljsDark');

  if (theme === 'dark') {
    html.classList.add('dark');
    html.classList.remove('light');
    DOM.themeIconSun.classList.remove('hidden');
    DOM.themeIconMoon.classList.add('hidden');
    if (hljsLight) hljsLight.disabled = true;
    if (hljsDark) hljsDark.disabled = false;
  } else {
    html.classList.remove('dark');
    html.classList.add('light');
    DOM.themeIconSun.classList.add('hidden');
    DOM.themeIconMoon.classList.remove('hidden');
    if (hljsLight) hljsLight.disabled = false;
    if (hljsDark) hljsDark.disabled = true;
  }
}

function toggleTheme() {
  const newTheme = state.currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}

// -------------------------------------------------------------
// STOCKAGE LOCAL
// -------------------------------------------------------------
function loadConfig() {
  const saved = localStorage.getItem('bot_oussamma_config');
  if (saved) {
    try {
      state.config = { ...state.config, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Erreur chargement config:', e);
    }
  }
  state.webSearchEnabled = state.config.defaultWebSearch || false;
  updateWebSearchUI();
  updateModelSelectorLabel();
}

function saveConfig() {
  localStorage.setItem('bot_oussamma_config', JSON.stringify(state.config));
}

function loadConversations() {
  const saved = localStorage.getItem('bot_oussamma_chats');
  if (saved) {
    try {
      state.conversations = JSON.parse(saved);
    } catch (e) {
      state.conversations = [];
    }
  }
  renderConversationsList();
}

function saveConversations() {
  localStorage.setItem('bot_oussamma_chats', JSON.stringify(state.conversations));
}

async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.status === 401) {
      window.location.href = '/auth/login';
      return;
    }
    const data = await res.json();
    if (data.authenticated && data.user) {
      state.user = data.user;
      DOM.userName.textContent = data.user.name || 'Oussama';
      DOM.userStatus.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> SSO Connecté`;
      
      if (data.user.avatar) {
        DOM.userAvatar.innerHTML = `<img src="${data.user.avatar}" class="w-full h-full rounded-full object-cover">`;
      } else {
        const initial = (data.user.name || 'O').charAt(0).toUpperCase();
        DOM.userAvatar.textContent = initial;
      }

      DOM.authBtn.title = 'Déconnexion SSO';
      DOM.authBtn.innerHTML = `<i data-lucide="log-out" class="w-4 h-4 text-slate-400 hover:text-red-500"></i>`;
      DOM.authBtn.onclick = () => window.location.href = '/auth/logout';
    } else {
      window.location.href = '/auth/login';
    }
    lucide.createIcons();
  } catch (e) {
    console.error('Erreur vérification SSO:', e);
  }
}

// -------------------------------------------------------------
// CONVERSATIONS
// -------------------------------------------------------------
function createNewConversation() {
  const newChat = {
    id: 'chat_' + Date.now(),
    title: 'Nouveau chat',
    createdAt: new Date().toISOString(),
    messages: []
  };

  state.conversations.unshift(newChat);
  state.currentConversationId = newChat.id;
  saveConversations();
  renderConversationsList();
  renderMessages();
  closeMobileSidebar();
}

function selectConversation(id) {
  state.currentConversationId = id;
  renderConversationsList();
  renderMessages();
  closeMobileSidebar();
}

function deleteConversation(id, event) {
  event?.stopPropagation();
  state.conversations = state.conversations.filter(c => c.id !== id);
  if (state.currentConversationId === id) {
    state.currentConversationId = state.conversations.length > 0 ? state.conversations[0].id : null;
  }
  saveConversations();
  renderConversationsList();
  if (!state.currentConversationId) {
    createNewConversation();
  } else {
    renderMessages();
  }
}

function renderConversationsList() {
  DOM.conversationsList.innerHTML = '';
  state.conversations.forEach(chat => {
    const isActive = chat.id === state.currentConversationId;
    const btn = document.createElement('div');
    btn.className = `group flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer text-xs font-medium transition duration-150 ${
      isActive 
        ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-[#212121] dark:text-white' 
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-[#b4b4b4] dark:hover:text-white dark:hover:bg-[#212121]/60'
    }`;
    
    btn.innerHTML = `
      <div class="flex items-center gap-2 truncate">
        <i data-lucide="message-square" class="w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600 dark:text-white' : 'text-slate-400'}"></i>
        <span class="truncate">${escapeHtml(chat.title)}</span>
      </div>
      <button class="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 text-slate-400 transition" title="Supprimer">
        <i data-lucide="trash" class="w-3 h-3"></i>
      </button>
    `;

    btn.onclick = () => selectConversation(chat.id);
    const delBtn = btn.querySelector('button');
    delBtn.onclick = (e) => deleteConversation(chat.id, e);

    DOM.conversationsList.appendChild(btn);
  });
  lucide.createIcons();
}

// -------------------------------------------------------------
// RENDU DU CHAT
// -------------------------------------------------------------
function getCurrentConversation() {
  return state.conversations.find(c => c.id === state.currentConversationId);
}

function renderMessages() {
  const currentChat = getCurrentConversation();
  DOM.chatMessages.innerHTML = '';

  if (!currentChat || currentChat.messages.length === 0) {
    DOM.welcomeScreen.classList.remove('hidden');
    DOM.chatMessages.appendChild(DOM.welcomeScreen);
    return;
  }

  DOM.welcomeScreen.classList.add('hidden');

  currentChat.messages.forEach(msg => {
    appendMessageToDOM(msg);
  });

  scrollToBottom();
}

function appendMessageToDOM(msg) {
  const isUser = msg.role === 'user';
  const row = document.createElement('div');
  row.className = `flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in w-full`;

  if (isUser) {
    row.innerHTML = `
      <div class="user-bubble">
        ${escapeHtml(msg.content)}
      </div>
    `;
  } else {
    // Sources Web si présentes
    const sourcesHtml = msg.webSources && msg.webSources.length > 0 ? `
      <div class="mb-3 p-3 rounded-2xl bg-blue-50/70 dark:bg-[#242424] border border-blue-100 dark:border-[#383838] text-xs text-slate-700 dark:text-[#d1d1d1]">
        <div class="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400 mb-2">
          <i data-lucide="globe" class="w-3.5 h-3.5"></i>
          <span>Sources web consultées (${msg.webSources.length}) :</span>
        </div>
        <div class="space-y-1.5">
          ${msg.webSources.map((s, idx) => `
            <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="block hover:underline truncate text-slate-600 hover:text-blue-600 dark:text-[#a3a3a3] dark:hover:text-blue-400">
              <span class="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold">[${idx + 1}]</span> ${escapeHtml(s.title || s.url)}
            </a>
          `).join('')}
        </div>
      </div>
    ` : '';

    row.innerHTML = `
      <div class="flex gap-3 sm:gap-4 w-full">
        <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
          <i data-lucide="sparkles" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 overflow-hidden space-y-2">
          ${sourcesHtml}
          <div class="assistant-message markdown-body">
            ${marked.parse(msg.content || '')}
          </div>
          <div class="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
            <button class="copy-msg-btn flex items-center gap-1 hover:text-slate-700 dark:hover:text-white transition" title="Copier">
              <i data-lucide="copy" class="w-3 h-3"></i> Copier
            </button>
          </div>
        </div>
      </div>
    `;

    const copyBtn = row.querySelector('.copy-msg-btn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(msg.content || '');
        copyBtn.innerHTML = `<i data-lucide="check" class="w-3 h-3 text-emerald-500"></i> Copié !`;
        lucide.createIcons();
        setTimeout(() => {
          copyBtn.innerHTML = `<i data-lucide="copy" class="w-3 h-3"></i> Copier`;
          lucide.createIcons();
        }, 2000);
      };
    }
  }

  DOM.chatMessages.appendChild(row);
  enhanceCodeBlocks(row);
  lucide.createIcons();
}

function enhanceCodeBlocks(container) {
  container.querySelectorAll('pre code').forEach((codeEl) => {
    hljs.highlightElement(codeEl);

    const pre = codeEl.parentElement;
    if (pre.parentElement && pre.parentElement.classList.contains('code-block-wrapper')) return;

    let lang = 'code';
    codeEl.classList.forEach(cls => {
      if (cls.startsWith('language-')) lang = cls.replace('language-', '');
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';

    const header = document.createElement('div');
    header.className = 'code-block-header';
    header.innerHTML = `
      <span>${lang}</span>
      <button class="code-copy-btn">
        <i data-lucide="copy" class="w-3 h-3"></i>
        <span>Copier le code</span>
      </button>
    `;

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);

    const copyBtn = header.querySelector('.code-copy-btn');
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(codeEl.innerText);
      copyBtn.innerHTML = '<i data-lucide="check" class="w-3 h-3 text-emerald-500"></i><span>Copié !</span>';
      lucide.createIcons();
      setTimeout(() => {
        copyBtn.innerHTML = '<i data-lucide="copy" class="w-3 h-3"></i><span>Copier le code</span>';
        lucide.createIcons();
      }, 2000);
    };
  });
}

function scrollToBottom() {
  DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

// -------------------------------------------------------------
// ENVOI & STREAMING AVEC DYNAMISME IA (THINKING ACCORDION)
// -------------------------------------------------------------
async function handleSendMessage() {
  const text = DOM.messageInput.value.trim();
  if (!text || state.isGenerating) return;

  let currentChat = getCurrentConversation();
  if (!currentChat) {
    createNewConversation();
    currentChat = getCurrentConversation();
  }

  if (currentChat.messages.length === 0) {
    currentChat.title = text.slice(0, 28) + (text.length > 28 ? '...' : '');
    renderConversationsList();
  }

  // 1. Message Utilisateur
  currentChat.messages.push({ role: 'user', content: text });
  saveConversations();

  DOM.messageInput.value = '';
  adjustTextareaHeight();
  updateSendButtonState();
  renderMessages();

  // 2. Message Assistant temporaire avec Dynamisme IA
  state.isGenerating = true;
  DOM.sendBtn.disabled = true;

  const assistantMsg = { role: 'assistant', content: '', webSources: [] };
  currentChat.messages.push(assistantMsg);

  const assistantRow = document.createElement('div');
  assistantRow.className = 'flex justify-start animate-fade-in w-full';
  assistantRow.innerHTML = `
    <div class="flex gap-3 sm:gap-4 w-full">
      <!-- Avatar IA Réactif avec halo pulsant -->
      <div id="activeAiAvatar" class="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs ai-thinking-avatar">
        <i data-lucide="sparkles" class="w-4 h-4 animate-spin"></i>
      </div>
      <div class="flex-1 overflow-hidden space-y-2">
        
        <!-- Accordéon Dynamique de Réflexion (Thinking Process) -->
        <div id="thinkingBox" class="thinking-box">
          <div class="thinking-header" id="thinkingToggle">
            <span class="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
              <i data-lucide="brain-circuit" class="w-3.5 h-3.5 animate-pulse"></i>
              <span id="thinkingStatusLabel">L'IA réfléchit en direct...</span>
            </span>
            <span id="thinkingTimer" class="font-mono text-[10px] text-slate-400">0.0s</span>
          </div>
          <div id="thinkingSteps" class="thinking-steps space-y-1">
            <div class="text-blue-500">▶ Connexion au SSO sso-a.oussamma.tn</div>
            <div id="stepWeb" class="hidden text-purple-500">▶ Recherche et analyse des données Web en direct</div>
            <div id="stepLLM" class="text-slate-400">▶ Synthèse et génération du modèle GPT-4o Codex</div>
          </div>
        </div>

        <div id="activeWebSources" class="hidden mb-3 p-3 rounded-2xl bg-blue-50/70 dark:bg-[#242424] border border-blue-100 dark:border-[#383838] text-xs text-slate-700 dark:text-[#d1d1d1]"></div>
        
        <div class="assistant-message markdown-body streaming-cursor">
          <span id="streamingText"></span>
        </div>
      </div>
    </div>
  `;
  DOM.chatMessages.appendChild(assistantRow);
  lucide.createIcons();
  scrollToBottom();

  const streamingTextSpan = assistantRow.querySelector('#streamingText');
  const activeWebSourcesDiv = assistantRow.querySelector('#activeWebSources');
  const markdownContainer = assistantRow.querySelector('.markdown-body');
  const activeAiAvatar = assistantRow.querySelector('#activeAiAvatar');
  const thinkingBox = assistantRow.querySelector('#thinkingBox');
  const thinkingStatusLabel = assistantRow.querySelector('#thinkingStatusLabel');
  const thinkingTimer = assistantRow.querySelector('#thinkingTimer');
  const stepWeb = assistantRow.querySelector('#stepWeb');

  if (state.webSearchEnabled) {
    stepWeb.classList.remove('hidden');
  }

  // Chronomètre de réflexion en direct
  const startTime = Date.now();
  const timerInterval = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    thinkingTimer.textContent = `${elapsed}s`;
  }, 100);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: currentChat.messages.slice(0, -1),
        model: state.config.provider,
        customConfig: state.config,
        enableWebSearch: state.webSearchEnabled,
        systemPrompt: state.config.systemPrompt
      })
    });

    if (response.status === 401) {
      window.location.href = '/auth/login';
      return;
    }

    if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let firstTokenReceived = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      let eventType = null;
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.replace('event: ', '').trim();
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.replace('data: ', '').trim());
            
            if (eventType === 'status') {
              DOM.searchIndicator.classList.remove('hidden');
              DOM.searchIndicatorText.textContent = data.message;
            } else if (eventType === 'web_results') {
              assistantMsg.webSources = data.results;
              activeWebSourcesDiv.classList.remove('hidden');
              activeWebSourcesDiv.innerHTML = `
                <div class="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400 mb-2">
                  <i data-lucide="globe" class="w-3.5 h-3.5"></i>
                  <span>Sources web consultées (${data.results.length}) :</span>
                </div>
                <div class="space-y-1.5">
                  ${data.results.map((s, idx) => `
                    <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="block hover:underline truncate text-slate-600 hover:text-blue-600 dark:text-[#a3a3a3] dark:hover:text-blue-400">
                      <span class="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold">[${idx + 1}]</span> ${escapeHtml(s.title || s.url)}
                    </a>
                  `).join('')}
                </div>
              `;
              lucide.createIcons();
            } else if (eventType === 'token') {
              DOM.searchIndicator.classList.add('hidden');
              
              if (!firstTokenReceived) {
                firstTokenReceived = true;
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                thinkingStatusLabel.textContent = `Pensée achevée en ${elapsed}s`;
                clearInterval(timerInterval);
              }

              assistantMsg.content += data.token;
              streamingTextSpan.innerHTML = marked.parse(assistantMsg.content);
              scrollToBottom();
            } else if (eventType === 'error') {
              assistantMsg.content += `\n\n> ⚠️ **Erreur** : ${data.message}`;
              streamingTextSpan.innerHTML = marked.parse(assistantMsg.content);
            }
          } catch (e) {}
        }
      }
    }

  } catch (err) {
    assistantMsg.content = `> ⚠️ **Connexion interrompue** : ${err.message}`;
  } finally {
    clearInterval(timerInterval);
    DOM.searchIndicator.classList.add('hidden');
    state.isGenerating = false;
    activeAiAvatar.classList.remove('ai-thinking-avatar');
    activeAiAvatar.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4"></i>`;
    markdownContainer.classList.remove('streaming-cursor');
    saveConversations();
    renderMessages();
    updateSendButtonState();
    lucide.createIcons();
  }
}

// -------------------------------------------------------------
// ÉVÉNEMENTS
// -------------------------------------------------------------
function setupEventListeners() {
  DOM.openSidebarBtn.onclick = openMobileSidebar;
  DOM.closeSidebarBtn.onclick = closeMobileSidebar;
  if (DOM.sidebarBackdrop) {
    DOM.sidebarBackdrop.onclick = closeMobileSidebar;
  }

  DOM.themeToggleBtn.onclick = toggleTheme;
  DOM.newChatBtn.onclick = () => createNewConversation();

  DOM.messageInput.addEventListener('input', () => {
    adjustTextareaHeight();
    updateSendButtonState();
  });

  DOM.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  DOM.sendBtn.onclick = handleSendMessage;

  DOM.webSearchToggle.onclick = () => {
    state.webSearchEnabled = !state.webSearchEnabled;
    updateWebSearchUI();
  };

  const toggleModelDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    DOM.modelDropdown.classList.toggle('hidden');
  };
  DOM.modelSelectorBtn.onclick = toggleModelDropdown;

  document.addEventListener('click', (e) => {
    if (DOM.modelDropdown && !DOM.modelSelectorBtn.contains(e.target) && !DOM.modelDropdown.contains(e.target)) {
      DOM.modelDropdown.classList.add('hidden');
    }
  });

  DOM.modelDropdown.querySelectorAll('button[data-model]').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const model = btn.getAttribute('data-model');
      state.config.provider = model;
      saveConfig();
      updateModelSelectorLabel();
      DOM.modelDropdown.classList.add('hidden');
    };
  });

  DOM.openSettingsBtn.onclick = openSettings;
  DOM.closeSettingsModal.onclick = closeSettings;
  DOM.cancelSettingsBtn.onclick = closeSettings;
  DOM.saveSettingsBtn.onclick = saveSettings;

  document.querySelectorAll('.prompt-suggestion').forEach(btn => {
    btn.onclick = () => {
      const text = btn.querySelector('p').textContent;
      DOM.messageInput.value = text;
      adjustTextareaHeight();
      updateSendButtonState();
      handleSendMessage();
    };
  });
}

function updateWebSearchUI() {
  if (state.webSearchEnabled) {
    DOM.webSearchToggle.classList.add('bg-blue-50', 'border-blue-400', 'text-blue-600', 'dark:bg-blue-950/60');
    DOM.webSearchToggle.classList.remove('text-slate-500', 'bg-slate-100');
    DOM.webSearchBadge.classList.remove('bg-slate-400');
    DOM.webSearchBadge.classList.add('bg-blue-600');
  } else {
    DOM.webSearchToggle.classList.remove('bg-blue-50', 'border-blue-400', 'text-blue-600', 'dark:bg-blue-950/60');
    DOM.webSearchToggle.classList.add('text-slate-500', 'bg-slate-100');
    DOM.webSearchBadge.classList.add('bg-slate-400');
    DOM.webSearchBadge.classList.remove('bg-blue-600');
  }
}

function updateModelSelectorLabel() {
  const map = {
    sso: 'GPT-4o (Codex SSO)',
    openai: 'OpenAI (GPT-4o)',
    gemini: 'Gemini 2.0 Flash',
    ollama: 'Ollama Local',
    custom: 'API Custom'
  };
  DOM.currentModelLabel.textContent = map[state.config.provider] || 'GPT-4o (SSO)';
}

function openSettings() {
  DOM.configProvider.value = state.config.provider || 'sso';
  DOM.configEndpoint.value = state.config.ssoEndpoint || '';
  DOM.configModel.value = state.config.model || '';
  DOM.configApiKey.value = state.config.apiKey || '';
  DOM.configSystemPrompt.value = state.config.systemPrompt || '';
  DOM.configDefaultWebSearch.checked = state.config.defaultWebSearch || false;
  DOM.settingsModal.classList.remove('hidden');
}

function closeSettings() {
  DOM.settingsModal.classList.add('hidden');
}

function saveSettings() {
  state.config.provider = DOM.configProvider.value;
  state.config.ssoEndpoint = DOM.configEndpoint.value.trim();
  state.config.model = DOM.configModel.value.trim();
  state.config.apiKey = DOM.configApiKey.value.trim();
  state.configSystemPrompt = DOM.configSystemPrompt.value.trim();
  state.configDefaultWebSearch = DOM.configDefaultWebSearch.checked;
  state.webSearchEnabled = state.config.defaultWebSearch;

  saveConfig();
  updateWebSearchUI();
  updateModelSelectorLabel();
  closeSettings();
}

function adjustTextareaHeight() {
  DOM.messageInput.style.height = 'auto';
  DOM.messageInput.style.height = Math.min(DOM.messageInput.scrollHeight, 180) + 'px';
}

function updateSendButtonState() {
  DOM.sendBtn.disabled = DOM.messageInput.value.trim() === '' || state.isGenerating;
}

function escapeHtml(string) {
  const div = document.createElement('div');
  div.innerText = string;
  return div.innerHTML;
}

function openMobileSidebar() {
  DOM.sidebar.classList.remove('-translate-x-full');
  if (DOM.sidebarBackdrop) DOM.sidebarBackdrop.classList.remove('hidden');
}

function closeMobileSidebar() {
  DOM.sidebar.classList.add('-translate-x-full');
  if (DOM.sidebarBackdrop) DOM.sidebarBackdrop.classList.add('hidden');
}

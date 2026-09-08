// Dom Element Wireframes Anchor Points
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const dropZonePrompt = document.getElementById('dropZonePrompt');
const fileDetailBox = document.getElementById('fileDetailBox');
const selectedFileName = document.getElementById('selectedFileName');
const selectedFileSize = document.getElementById('selectedFileSize');
const uploadBtn = document.getElementById('uploadBtn');
const ingestStatus = document.getElementById('ingestStatus');
const chatBox = document.getElementById('chatBox');
const queryInput = document.getElementById('queryInput');
const sendBtn = document.getElementById('sendBtn');

let activeSelectedFile = null;

// 1. DRAG AND DROP CAPABILITIES LAYER
dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) handleFileSelection(e.target.files[0]);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) handleFileSelection(e.dataTransfer.files[0]);
});

function handleFileSelection(file) {
  activeSelectedFile = file;
  selectedFileName.innerText = file.name;
  selectedFileSize.innerText = `${(file.size / 1024).toFixed(1)} KB`;
  fileDetailBox.classList.remove('hidden');
  ingestStatus.className = "";
  ingestStatus.innerText = "";
}

// 2. NATIVE BINARY MULTIPART DISPATCH STREAM API HOOK
uploadBtn.addEventListener('click', async () => {
  if (!activeSelectedFile) return;

  uploadBtn.disabled = true;
  ingestStatus.className = "text-xs text-center font-mono py-2 rounded bg-slate-800 text-yellow-400 animate-pulse border border-slate-700";
  ingestStatus.innerText = "⏳ Extracting texts & opening multipart network streams...";

  const formData = new FormData();
  formData.append('file', activeSelectedFile);

  try {
    const response = await fetch('/api/v1/ingest', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();

    if (response.status === 202) {
      ingestStatus.className = "text-xs text-center font-mono py-2 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/50";
      ingestStatus.innerText = `✅ Enqueued into BullMQ! Job ID: ${data.jobId}`;
      activeSelectedFile = null;
      fileInput.value = '';
      fileDetailBox.classList.add('hidden');
    } else {
      throw new Error(data.message || 'Binary parsing layout failure.');
    }
  } catch (err) {
    ingestStatus.className = "text-xs text-center font-mono py-2 rounded bg-red-950/40 text-red-400 border border-red-900/50";
    ingestStatus.innerText = `❌ Ingestion Error: ${err.message}`;
  } finally {
    uploadBtn.disabled = false;
  }
});

// 3. SERVER SENT EVENTS REAL-TIME GENERATION CONSUMER
async function executeQuery() {
  const question = queryInput.value.trim();
  if (!question) return;

  queryInput.value = '';
  
  // Render user text bubble node
  chatBox.innerHTML += `
    <div class="flex justify-end w-full">
      <div class="bg-emerald-600 text-white rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[70%] text-sm shadow-md font-sans">
        ${question}
      </div>
    </div>
  `;
  
  // Render loading structure shell layout
  const aiResponseId = `ai-res-${Date.now()}`;
  chatBox.innerHTML += `
    <div class="flex justify-start w-full">
      <div id="${aiResponseId}" class="bg-slate-800 border border-slate-700/60 rounded-2xl rounded-tl-none px-4 py-2.5 max-w-[75%] text-sm text-slate-100 shadow-md leading-relaxed min-h-[40px] font-sans">
        <span class="text-slate-400 flex items-center gap-2 font-mono text-xs">
          <span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-bounce"></span>
          Computing similarity matrix & retrieving factual context...
        </span>
      </div>
    </div>
  `;
  chatBox.scrollTop = chatBox.scrollHeight;

  const responseContainer = document.getElementById(aiResponseId);
  let textBuffer = '';

  // Fire native browser EventSource network socket connection channel loop
  const eventSource = new EventSource(`/api/v1/chat?question=${encodeURIComponent(question)}`);

  eventSource.onmessage = (event) => {
    if (event.data === '[DONE]') {
      eventSource.close();
      return;
    }

    try {
      const parsed = JSON.parse(event.data);
      if (parsed.token) {
        if (textBuffer === '') responseContainer.innerHTML = '';
        
        textBuffer += parsed.token;
        responseContainer.innerText = textBuffer;
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    } catch (err) {
      console.error("Token decoding error:", err);
    }
  };

  eventSource.onerror = (err) => {
    console.error("Network socket stream interrupted:", err);
    responseContainer.innerHTML = `<span class="text-red-400 font-mono text-xs">⚠️ Connection drop or model parsing timeout. Process killed.</span>`;
    eventSource.close();
  };
}

sendBtn.addEventListener('click', executeQuery);
queryInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') executeQuery(); });

(function () {
  "use strict";

  // ========================================================================
  // DOM references
  // ========================================================================
  const $ = (sel) => document.querySelector(sel);
  const statusDot = $("#statusDot");
  const statusText = $("#statusText");
  const sandboxBadge = $("#sandboxBadge");
  const sandboxIdText = $("#sandboxIdText");
  const btnCreate = $("#btnCreate");
  const btnCreateWelcome = $("#btnCreateWelcome");
  const btnStop = $("#btnStop");
  const errorBanner = $("#errorBanner");
  const errorText = $("#errorText");
  const welcomeScreen = $("#welcomeScreen");
  const terminalWrapper = $("#terminalWrapper");
  const termInitSpinner = $("#termInitSpinner");
  const termReady = $("#termReady");
  const btnCopy = $("#btnCopy");
  const btnPaste = $("#btnPaste");
  const btnFullscreen = $("#btnFullscreen");
  const iconExpand = $("#iconExpand");
  const iconShrink = $("#iconShrink");
  const footerActive = $("#footerActive");
  const footerSandboxId = $("#footerSandboxId");
  const terminalContainer = $("#terminal-container");

  // ========================================================================
  // State
  // ========================================================================
  let xterm = null;
  let fitAddon = null;
  let isConnected = false;
  let isFullscreen = false;
  let resizeTimeout = null;

  // ========================================================================
  // Socket.IO connection
  // ========================================================================
  const socket = io({
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
    timeout: 30000,
  });

  socket.on("connect", function () {
    console.log("Socket.IO connected");
  });

  socket.on("disconnect", function () {
    console.log("Socket.IO disconnected");
  });

  // ========================================================================
  // UI helpers
  // ========================================================================
  function setStatus(state, text) {
    statusDot.className = "status-dot " + state;
    statusText.className = "status-text " + state;
    statusText.textContent = text || state.charAt(0).toUpperCase() + state.slice(1);
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorBanner.classList.add("visible");
  }

  function hideError() {
    errorBanner.classList.remove("visible");
  }

  function showConnectedUI(sandboxId) {
    isConnected = true;
    setStatus("connected", "Connected");

    btnCreate.style.display = "none";
    btnStop.style.display = "inline-flex";

    if (sandboxId) {
      sandboxIdText.textContent = sandboxId.substring(0, 12) + "...";
      sandboxBadge.classList.add("visible");
      footerSandboxId.textContent = sandboxId;
    }

    footerActive.classList.add("visible");
    welcomeScreen.style.display = "none";
    terminalWrapper.classList.add("visible");
  }

  function showDisconnectedUI() {
    isConnected = false;
    setStatus("disconnected", "Disconnected");

    btnCreate.style.display = "inline-flex";
    btnCreate.disabled = false;
    btnStop.style.display = "none";
    if (btnCreateWelcome) btnCreateWelcome.disabled = false;

    sandboxBadge.classList.remove("visible");
    footerActive.classList.remove("visible");
    footerSandboxId.textContent = "";

    terminalWrapper.classList.remove("visible");
    welcomeScreen.style.display = "flex";

    termReady.classList.remove("visible");
    termInitSpinner.style.display = "none";

    if (xterm) {
      xterm.dispose();
      xterm = null;
      fitAddon = null;
    }
  }

  // ========================================================================
  // Terminal initialization
  // ========================================================================
  function initXterm() {
    if (xterm) return;

    xterm = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      cursorInactiveStyle: "outline",
      fontSize: 14,
      fontFamily:
        '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, "Courier New", monospace',
      fontWeight: "400",
      fontWeightBold: "700",
      lineHeight: 1.2,
      letterSpacing: 0,
      scrollback: 10000,
      smoothScrollDuration: 100,
      macOptionIsMeta: true,
      altClickMovesCursor: true,
      convertEol: false,
      allowProposedApi: true,
      theme: {
        background: "#0d1117",
        foreground: "#c9d1d9",
        cursor: "#58a6ff",
        cursorAccent: "#0d1117",
        selectionBackground: "#264f78",
        selectionForeground: "#ffffff",
        selectionInactiveBackground: "#264f7840",
        black: "#484f58",
        red: "#ff7b72",
        green: "#3fb950",
        yellow: "#d29922",
        blue: "#58a6ff",
        magenta: "#bc8cff",
        cyan: "#39c5cf",
        white: "#b1bac4",
        brightBlack: "#6e7681",
        brightRed: "#ffa198",
        brightGreen: "#56d364",
        brightYellow: "#e3b341",
        brightBlue: "#79c0ff",
        brightMagenta: "#d2a8ff",
        brightCyan: "#56d4dd",
        brightWhite: "#f0f6fc",
      },
    });

    fitAddon = new FitAddon.FitAddon();
    xterm.loadAddon(fitAddon);

    var unicode11 = new Unicode11Addon.Unicode11Addon();
    xterm.loadAddon(unicode11);
    xterm.unicode.activeVersion = "11";

    var webLinks = new WebLinksAddon.WebLinksAddon(
      function (event, uri) {
        if (event.ctrlKey || event.metaKey) {
          window.open(uri, "_blank", "noopener,noreferrer");
        }
      },
      { urlRegex: /https?:\/\/[^\s"')\]}>]+/g }
    );
    xterm.loadAddon(webLinks);

    xterm.open(terminalContainer);

    setTimeout(function () {
      fitAddon.fit();
    }, 50);

    // Text input -> server
    xterm.onData(function (data) {
      socket.emit("pty_input", { data: data });
    });

    // Binary input -> server (for TUI special keys)
    xterm.onBinary(function (data) {
      var buffer = new Uint8Array(data.length);
      for (var i = 0; i < data.length; i++) {
        buffer[i] = data.charCodeAt(i) & 0xff;
      }
      var b64 = btoa(String.fromCharCode.apply(null, buffer));
      socket.emit("pty_binary_input", { data: b64 });
    });

    // Clipboard: Ctrl+C copies when selection exists, otherwise sends SIGINT
    xterm.attachCustomKeyEventHandler(function (event) {
      if (event.ctrlKey && event.key === "c" && event.type === "keydown") {
        var selection = xterm.getSelection();
        if (selection && selection.length > 0) {
          navigator.clipboard.writeText(selection).catch(function () {});
          xterm.clearSelection();
          return false;
        }
        return true;
      }

      if (event.ctrlKey && event.key === "v" && event.type === "keydown") {
        navigator.clipboard
          .readText()
          .then(function (text) {
            if (text) {
              socket.emit("pty_input", { data: text });
            }
          })
          .catch(function () {});
        return false;
      }

      if (
        event.ctrlKey &&
        event.shiftKey &&
        event.key === "C" &&
        event.type === "keydown"
      ) {
        var sel = xterm.getSelection();
        if (sel) {
          navigator.clipboard.writeText(sel).catch(function () {});
          xterm.clearSelection();
        }
        return false;
      }

      if (
        event.ctrlKey &&
        event.shiftKey &&
        event.key === "V" &&
        event.type === "keydown"
      ) {
        navigator.clipboard
          .readText()
          .then(function (text) {
            if (text) {
              socket.emit("pty_input", { data: text });
            }
          })
          .catch(function () {});
        return false;
      }

      return true;
    });

    // Paste event
    terminalContainer.addEventListener("paste", function (event) {
      event.preventDefault();
      var text = event.clipboardData && event.clipboardData.getData("text");
      if (text) {
        socket.emit("pty_input", { data: text });
      }
    });

    return { cols: xterm.cols, rows: xterm.rows };
  }

  // ========================================================================
  // Resize handling
  // ========================================================================
  function handleResize() {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function () {
      if (fitAddon && xterm) {
        try {
          fitAddon.fit();
          socket.emit("pty_resize", { cols: xterm.cols, rows: xterm.rows });
        } catch (e) {
          console.error("Resize error:", e);
        }
      }
    }, 80);
  }

  window.addEventListener("resize", handleResize);

  // ========================================================================
  // Socket events
  // ========================================================================
  socket.on("status", function (data) {
    if (data.connected) {
      showConnectedUI(data.sandbox_id);
    }
  });

  socket.on("status_update", function (data) {
    if (data.status === "connecting") {
      setStatus("connecting", data.message || "Connecting...");
      btnCreate.disabled = true;
      if (btnCreateWelcome) btnCreateWelcome.disabled = true;
    }
  });

  socket.on("sandbox_created", function (data) {
    hideError();
    showConnectedUI(data.sandbox_id);
    termInitSpinner.style.display = "inline-block";

    var size = initXterm();
    if (!size) {
      size = { cols: 80, rows: 24 };
    }
  });

  socket.on("pty_ready", function (data) {
    termInitSpinner.style.display = "none";
    termReady.classList.add("visible");

    if (xterm) {
      xterm.focus();
    }
  });

  socket.on("pty_output", function (data) {
    if (!xterm) return;
    try {
      var raw = atob(data.data);
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) {
        bytes[i] = raw.charCodeAt(i);
      }
      xterm.write(bytes);
    } catch (e) {
      console.error("Failed to write to terminal:", e);
    }
  });

  socket.on("pty_error", function (data) {
    showError("Terminal error: " + data.error);
  });

  socket.on("pty_closed", function () {
    termReady.classList.remove("visible");
  });

  socket.on("sandbox_stopped", function () {
    showDisconnectedUI();
  });

  socket.on("error", function (data) {
    showError(data.message);
    btnCreate.disabled = false;
    if (btnCreateWelcome) btnCreateWelcome.disabled = false;
    setStatus("disconnected", "Disconnected");
  });

  // ========================================================================
  // Button handlers
  // ========================================================================
  function createSandbox() {
    hideError();
    var cols = 80;
    var rows = 24;
    socket.emit("create_sandbox", { cols: cols, rows: rows });
  }

  btnCreate.addEventListener("click", createSandbox);
  if (btnCreateWelcome) {
    btnCreateWelcome.addEventListener("click", createSandbox);
  }

  btnStop.addEventListener("click", function () {
    socket.emit("stop_sandbox");
  });

  // Copy button
  btnCopy.addEventListener("click", function () {
    if (!xterm) return;
    var sel = xterm.getSelection();
    if (sel) {
      navigator.clipboard.writeText(sel).catch(function () {});
      xterm.clearSelection();
    }
  });

  // Paste button
  btnPaste.addEventListener("click", function () {
    navigator.clipboard
      .readText()
      .then(function (text) {
        if (text) {
          socket.emit("pty_input", { data: text });
        }
      })
      .catch(function () {});
  });

  // Fullscreen toggle
  btnFullscreen.addEventListener("click", function () {
    isFullscreen = !isFullscreen;
    if (isFullscreen) {
      terminalWrapper.classList.add("fullscreen");
      iconExpand.style.display = "none";
      iconShrink.style.display = "block";
    } else {
      terminalWrapper.classList.remove("fullscreen");
      iconExpand.style.display = "block";
      iconShrink.style.display = "none";
    }

    setTimeout(function () {
      if (fitAddon && xterm) {
        fitAddon.fit();
        socket.emit("pty_resize", { cols: xterm.cols, rows: xterm.rows });
        xterm.focus();
      }
    }, 150);
  });
})();
# E2B Terminal

A simple, terminal-only web application that connects to E2B cloud sandboxes. Get instant access to a cloud-based terminal environment to run commands, install packages, and execute code in an isolated container.

## Features

- Single terminal interface - clean and focused
- E2B sandbox integration
- Auto-connect on sandbox creation
- Fullscreen terminal mode
- GitHub-inspired dark theme
- Real-time WebSocket communication
- Python backend (Flask + Socket.IO)

## Setup

**Prerequisites:** Python 3.9+

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```

3. Add your E2B API key to the `.env` file:
   ```
   VITE_E2B_API_KEY=your_e2b_api_key_here
   ```
   
   Get your API key from [e2b.dev/dashboard](https://e2b.dev/dashboard)

4. Run the app:
   ```bash
   python app.py
   ```

## Usage

1. Open the app in your browser (default: http://localhost:3000)
2. Click "Create Sandbox" to start a new E2B cloud sandbox
3. Use the terminal to run commands in the isolated environment
4. Click "Stop" to terminate the sandbox when done

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_E2B_API_KEY` | Your E2B API key (required) |
| `PORT` | Server port (default: 3000) |

## Architecture

- **Backend**: Python Flask + Flask-SocketIO
- **Frontend**: Static HTML/CSS/JS with xterm.js
- **Communication**: WebSocket (Socket.IO) for real-time terminal I/O
- **Terminal**: xterm.js with fit, unicode11, and web-links addons
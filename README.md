# E2B Terminal

A simple, terminal-only web application that connects to E2B cloud sandboxes. Get instant access to a cloud-based terminal environment to run commands, install packages, and execute code in an isolated container.

## Features

- Single terminal interface - clean and focused
- E2B sandbox integration
- Auto-connect on sandbox creation
- Fullscreen terminal mode
- GitHub-inspired dark theme

## Setup

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
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
   npm run dev
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
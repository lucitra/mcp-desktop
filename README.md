# @lucitra/mcp-desktop

MCP server for macOS desktop screenshots. Capture the full screen or a specific application window using the native `screencapture` command.

## Install

```bash
npm install @lucitra/mcp-desktop
```

## Usage with Claude Code

Add to your Claude Code config (`~/.claude.json`):

```json
{
  "mcpServers": {
    "desktop": {
      "type": "stdio",
      "command": "npx",
      "args": ["@lucitra/mcp-desktop"]
    }
  }
}
```

## Usage as a Library

Import the tool registration function to add the desktop screenshot tool to your own MCP server:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerDesktopScreenshotTool } from '@lucitra/mcp-desktop'

const server = new McpServer({ name: 'my-server', version: '1.0.0' })
registerDesktopScreenshotTool(server)
```

## Available Tools

| Tool | Description |
|------|-------------|
| `desktop_screenshot` | Capture a screenshot of the full desktop or a specific application window. |

### `desktop_screenshot` Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `app` | string | No | Name of an application to capture (e.g. `"Safari"`, `"Finder"`). Omit for full desktop. |

## Requirements

- **macOS only** — uses the native `screencapture` command
- **Screen Recording permission** — System Settings > Privacy & Security > Screen Recording must include your terminal/IDE

## License

MIT

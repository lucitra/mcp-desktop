import { z } from 'zod'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

function exec(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 15_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout.trim())
    })
  })
}

/**
 * Get the macOS CGWindowID for an app by name using Quartz via Python.
 */
async function getWindowId(appName: string): Promise<string | null> {
  try {
    const script = `
import Quartz
wl = Quartz.CGWindowListCopyWindowInfo(
    Quartz.kCGWindowListOptionOnScreenOnly | Quartz.kCGWindowListExcludeDesktopElements,
    Quartz.kCGNullWindowID
)
for w in wl:
    name = w.get("kCGWindowOwnerName", "")
    layer = w.get("kCGWindowLayer", 999)
    if "${appName.replace(/"/g, '\\"')}".lower() in name.lower() and layer == 0:
        print(w["kCGWindowNumber"])
        break
`
    const result = await exec('python3', ['-c', script])
    return result || null
  } catch {
    return null
  }
}

export function registerDesktopScreenshotTool(server: McpServer) {
  server.tool(
    'desktop_screenshot',
    'Capture a screenshot of the full desktop or a specific application window on macOS.',
    {
      app: z
        .string()
        .optional()
        .describe('Name of an application to capture (e.g. "Safari", "Finder"). Omit for full desktop.'),
    },
    async ({ app }) => {
      if (process.platform !== 'darwin') {
        return {
          content: [{ type: 'text', text: 'desktop_screenshot is only available on macOS.' }],
        }
      }

      const tmpPath = join(tmpdir(), `screenshot-${randomUUID()}.png`)

      try {
        const args: string[] = []

        if (app) {
          const windowId = await getWindowId(app)
          if (windowId) {
            args.push('-l', windowId)
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: `Could not find a window for "${app}". Is the app running with a visible window?`,
                },
              ],
            }
          }
        }

        args.push('-x', '-C', tmpPath)
        await exec('screencapture', args)

        const pngBuffer = await readFile(tmpPath)

        return {
          content: [
            {
              type: 'image' as const,
              data: pngBuffer.toString('base64'),
              mimeType: 'image/png' as const,
            },
          ],
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `desktop_screenshot failed: ${err instanceof Error ? err.message : err}`,
            },
          ],
        }
      } finally {
        unlink(tmpPath).catch(() => {})
      }
    },
  )
}

/**
 * Register all desktop tools on an MCP server.
 */
export function registerAllTools(server: McpServer) {
  registerDesktopScreenshotTool(server)
}

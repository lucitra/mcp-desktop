import { z } from 'zod'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFile, mkdir } from 'node:fs/promises'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const SCREENSHOT_DIR = join(process.env.HOME || tmpdir(), '.lucitra', 'screenshots')

/** Open a file in VSCode via macOS LaunchServices (works from background processes) */
function openInEditor(filePath: string) {
  execFile('open', ['-a', 'Visual Studio Code', filePath], (err) => {
    if (err) {
      // Fallback: open with default app
      execFile('open', [filePath], (err2) => {
        if (err2) console.error(`[openInEditor] failed: ${err2.message}`)
      })
    }
  })
}

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

      try {
        await mkdir(SCREENSHOT_DIR, { recursive: true })
        const filePath = join(SCREENSHOT_DIR, `desktop-${Date.now()}.png`)
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

        args.push('-x', '-C', filePath)
        await exec('screencapture', args)

        const pngBuffer = await readFile(filePath)
        openInEditor(filePath)

        return {
          content: [
            {
              type: 'image' as const,
              data: pngBuffer.toString('base64'),
              mimeType: 'image/png' as const,
            },
            {
              type: 'text' as const,
              text: `Screenshot saved: ${filePath}`,
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

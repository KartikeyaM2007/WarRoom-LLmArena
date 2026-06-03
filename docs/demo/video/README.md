# Demo video

**Author: kartiyea**

| File | Description |
|------|-------------|
| [warroom-demo.webm](./warroom-demo.webm) | ~90s UI walkthrough (auto-captured with Playwright) |

Re-record:

```bash
npm start
npm run demo:capture
```

Narration: follow [../VIDEO_SCRIPT.md](../VIDEO_SCRIPT.md).

Convert to MP4 (optional, requires ffmpeg):

```bash
ffmpeg -i warroom-demo.webm -c:v libx264 -pix_fmt yuv420p warroom-demo.mp4
```

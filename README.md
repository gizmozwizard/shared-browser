# Shared Browser — prototype

A Chrome Manifest V3 extension for independent collaborative browsing. Each participant uses their own Chrome browser and joins a shared room. Joining a room opens a dedicated browser window for that participant. Shared tabs are mirrored into that window for each participant; personal tabs remain in the participant’s other windows. Participants can see who is in the room and click a person to open their current shared-window page and approximate vertical scroll position in their own dedicated window.

## Run locally

1. Install Node.js 20+.
2. For a local server, in `server` run `npm install` then `npm start`. The server listens at `ws://localhost:8787`.
3. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and choose the `extension` folder.
4. Click the extension icon. Enter your name, then **Join / create room**. Joining opens a separate window for that participant's shared tabs.
5. Share the room ID with another participant. They install the extension, enter the same room ID, and join. Each participant has an independent shared window; personal browser tabs stay in their other windows.
6. Use **Share current tab** to add a page to the room. The page opens in each participant's dedicated shared window. Click a person's name to jump to their current page and approximate scroll position in your own window.

## Connecting across different computers

The extension defaults to the deployed server at `wss://shared-browser-realtime.onrender.com`. For a local server, use `ws://localhost:8787`; for another public server, use its `wss://` address. This prototype does not implement user authentication or access control: **anyone with the room ID and server URL can join**, and the server can see shared URLs. Do not use it for sensitive browsing or deploy publicly without authentication, authorization, rate limiting, and appropriate privacy controls.

## Prototype limitations

- Room state is in memory and disappears when everyone leaves or the server restarts.
- The room connection runs while the extension side panel is open; closing the side panel stops live synchronization.
- Scroll positions are percentages, not DOM anchors; different layouts and dynamic pages may produce different positions.
- Chrome internal pages, Chrome Web Store, PDFs, and other protected pages cannot be tracked.
- Only the active page and approximate scroll position in the dedicated shared window are broadcast. Browser sessions, cookies, and personal tabs are never shared.
- No account system, true one-click invite links, element highlights, or persistent shared tab storage yet.
- This is an untested starter prototype; validate in Chrome before production use.

## Deploy server on Render

1. Upload this project to a private GitHub repository (do not upload secrets).
2. In [Render](https://dashboard.render.com/), choose **New > Blueprint** and connect the repository. The root `render.yaml` configures the Node web service.
3. Once deployment finishes, copy your Render service hostname, for example `shared-browser-realtime-xxxx.onrender.com`.
4. In the extension side panel, use the default `wss://shared-browser-realtime.onrender.com` or enter your service's `wss://` address. Everyone in the room uses the same URL.
5. Share the room ID with your friends. Rooms are temporary and stored in memory only.

The Render free service may sleep after inactivity and rooms disappear when the service restarts. This prototype has no authentication: use only for non-sensitive browsing with trusted participants.

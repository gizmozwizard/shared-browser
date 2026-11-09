# Shared Browser — prototype

A Chrome Manifest V3 extension for independent collaborative browsing. Each participant uses their own Chrome browser and joins a shared room. Shared tabs are links in the room; they are **not** automatically opened for every participant. Participants can see other participants' current page and approximate vertical scroll percentage, and click their names to open that page and scroll to the corresponding percentage.

## Run locally

1. Install Node.js 20+.
2. In `server`, run `npm install` then `npm start`. The server listens at `ws://localhost:8787`.
3. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and choose the `extension` folder.
4. Click the extension icon. Enter your name, then **Join / create room**. Share the room ID with another participant.
5. On the second browser, install the extension, enter the same server address and room ID, and join.
6. Use **Share current tab** to add a link to the room. Click a person's name to open their current page and scroll to approximately their position.

## Connecting across different computers

`localhost` only works on the same computer. Host the Node server on an internet-reachable machine with TLS and a reverse proxy supporting WebSocket upgrades, and use `wss://your-domain.example` in both extensions. This prototype does not implement user authentication or access control: **anyone with the room ID and server URL can join**, and the server can see shared URLs. Do not use it for sensitive browsing or deploy publicly without authentication, authorization, rate limiting, and appropriate privacy controls.

## Prototype limitations

- Room state is in memory and disappears when everyone leaves or the server restarts.
- Presence updates while the side panel is open; closing the side panel stops the live connection.
- Scroll positions are percentages, not DOM anchors; different layouts and dynamic pages may produce different positions.
- Chrome internal pages, Chrome Web Store, PDFs, and other protected pages cannot be tracked.
- Only the active tab is broadcast; tabs are not automatically synced, and individual browser sessions/cookies are never shared.
- No account system, true one-click invite links, element highlights, or persistent shared tab storage yet.
- This is an untested starter prototype; validate in Chrome before production use.

## Deploy server on Render

1. Upload this project to a private GitHub repository (do not upload secrets).
2. In [Render](https://dashboard.render.com/), choose **New > Blueprint** and connect the repository. The root `render.yaml` configures the Node web service.
3. Once deployment finishes, copy your Render service hostname, for example `shared-browser-realtime-xxxx.onrender.com`.
4. In the extension side panel, enter `wss://YOUR-RENDER-HOSTNAME.onrender.com` in the **WebSocket server** field. Everyone in the room uses the same URL.
5. Share the room ID with your friends. Rooms are temporary and stored in memory only.

The Render free service may sleep after inactivity and rooms disappear when the service restarts. This prototype has no authentication: use only for non-sensitive browsing with trusted participants.

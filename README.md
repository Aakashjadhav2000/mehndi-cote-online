# Mehndi Cote — Online Multiplayer

A playable browser-based, real-time Mehndi Cote card game. Private room codes, no accounts required. Game logic runs on the server; players only receive their own cards.

## Start on your computer

1. Install **Node.js 20 or later** from https://nodejs.org/.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

To play across the internet, deploy this folder to a Node.js web host (e.g., Render or Railway), use `npm install` as build command and `npm start` as start command. Share the resulting `https://` URL with friends. The host must support persistent WebSocket connections. A static site host alone will not work. On Render, select **Web Service**, not Static Site. Set no secrets; `PORT` is auto-detected. Free hosts may sleep after inactivity.

## Multiplayer guide

- Host selects **4**, **6**, or **8**, enters a name, and creates a room.
- Share the code or copy the invite link. Others enter their names and join.
- Click any *empty seat* to choose team. Seats alternate Team A / Team B clockwise.
- When all seats are full, host clicks **Deal cards & start**.
- A randomly selected dealer has their clockwise neighbor choose Hukum from the first five cards. (This is a configurable interpretation of the rules; see notes below.)
- All players receive the full hand after trump selection; play moves clockwise, starting with the Hukum selector.
- Click highlighted legal cards on your turn. The server rejects illegal plays.
- Each captured 10 earns one point for the winning team. On capture of all four 10s, the round ends immediately. Tied 10s are broken by number of tricks; a second tie displays as a draw.
- Host can start another round. Dealer and Hukum selector rotate one seat clockwise each subsequent round.

## Rules assumptions to confirm

The supplied rulebook leaves a few details open. This implementation uses these conventions:

1. **Who picks trump?** The person immediately clockwise from the dealer chooses it, and they lead the first trick. You may prefer the dealer or a different seat.
2. **Early stopping:** once all four 10s are captured, the round stops even if cards are still in hands. Trick totals count only completed tricks.
3. **Exact tie:** 2–2 in tens *and* equal trick counts results in a draw.
4. **Seat changes:** empty seats only (no swapping two occupied seats). Choosing a seat automatically picks that team.
5. **Disconnected players:** a game pauses until the disconnected player rejoins through the same browser session; there are no bots or turn timeouts.

## Operational notes

- Rooms and game state are in server memory; **a server restart erases all rooms**. A production system should use a persistent shared store and authentication for long-lived games.
- Player reconnection uses a browser-local secret token; do not share your own browser storage or session token. Invite links contain only the public room code.
- One server instance only. If your hosting platform scales to multiple instances, add sticky sessions and a shared Socket.IO adapter or use a single instance.
- Usernames are free text (max 22 characters), no accounts and no chat.
- Run automated checks: `npm test`.

# Show HN draft — not posted

Post this yourself. VEOR does not invent stars, comments, or an external audit.

**Title:** Show HN: VEOR – a governed execution boundary that can verify its own receipts

**Body:**

VEOR sits between an agent and tools that have side effects. The model can advise. It cannot authorize. A policy decides ALLOW, REVIEW, or DENY. An allowed call returns an Ed25519 receipt. Anyone can replay it:

```
npm run self
npm run verify:self
```

`self` reads this repo through the gateway, denies a destructive tool before it runs, and checks that a one-shot secret never appears in the receipt.

What it is not: a production certification, a fix for a shell you run outside the hook, or a 2026-07-28 MCP implementation. The pinned official SDK negotiates up to 2025-11-25. External review is still pending.

https://github.com/winterbim/veor

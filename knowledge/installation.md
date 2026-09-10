# Getting the demo running

## Local installation

Clone the payment-operations-console repository, install dependencies with npm ci, start PostgreSQL with docker compose up -d postgres, and run npm run dev. Use Node.js 22.13 or later in the 22 release line, or Node.js 24 or later. The frontend normally opens on local port 5173.

## Opening the app from a VM

When the demo runs on a remote VM, forward port 5173 through SSH to your laptop and open the forwarded localhost address in your browser. The frontend proxies API requests, so PostgreSQL and the provider do not need public ports.

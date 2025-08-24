<document filename="README.md">
# TripMaster AI — Backend (Node/Express)
<p>Secure API with Stripe, OpenAI, SQLite.</p>
<h2>Setup</h2>
<pre><code class="language-bash">cd backend
cp .env.example .env   # fill keys
npm i
npm run dev
</code></pre>
<h2>Endpoints</h2>
<ul>
<li><code>POST /api/preview</code> → { id, teaser_html, affiliates }</li>
<li><code>POST /api/plan</code> → { id, markdown, affiliates }</li>
<li><code>GET  /api/plan/:id</code> → plan JSON</li>
<li><code>GET  /api/plan/:id/pdf</code> → download PDF</li>
<li><code>POST /api/checkout</code> → { url } (Stripe Checkout)</li>
<li><code>POST /api/stripe/webhook</code> → Stripe webhook (use <code>stripe listen --forward-to localhost:8080/api/stripe/webhook</code>)</li>
</ul>
<h2>Deployment on Render</h2>
<ul>
<li>Create a Web Service on render.com.</li>
<li>Set Node version to 20.x.</li>
<li>Add env vars from .env (e.g., OPENAI_API_KEY, OPENWEATHERMAP_API_KEY).</li>
<li>Deploy from Git or upload.</li>
</ul>
<h2>Troubleshooting</h2>
<ul>
<li>AI not working? Check OPENAI_API_KEY in env.</li>
<li>CORS error? Ensure ORIGIN is set to your frontend URL (e.g., <a href="https://wayzo.online">https://wayzo.online</a>).</li>
<li>PDF not generating? Install pdfkit (<code>npm install pdfkit</code>).</li>
<li>Weather not showing? Verify OPENWEATHERMAP_API_KEY.</li>
</ul>
<h2>Notes</h2>
<ul>
<li>DB: SQLite file at <code>DB_PATH</code> (default <code>./tripmaster.sqlite</code>).</li>
<li>Rate-limited to 60 req/minute.</li>
<li>Update <code>ORIGIN</code> to your frontend domain for CORS.</li>
<li>Last updated: 2025-08-24 12:50 IDT

</li>
</ul>
<hr>
<p>Please review this updated <code>README.md (Backend)</code>. If it meets your needs or you’d like further tweaks, say "continue" for the next file (e.g., <code>links.mjs</code>). Let me know if you have any specific requests!</p></document>
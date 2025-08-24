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
<li>Last updated: 2025-08-24 13:06 IDT

</li>
</ul>
<hr>
<h3>Improvements</h3>
<ul>
<li><strong>Updated Timestamp</strong>: Reflects the current date and time (1:06 PM IDT, August 24, 2025).</li>
<li><strong>Maintained Structure</strong>: Kept your existing documentation structure, adding troubleshooting for weather integration.</li>
<li><strong>No Major Changes</strong>: Ensured consistency with the updated backend features (e.g., weather, PDF).</li>
</ul>
<p>Please review this <code>README.md (Backend)</code>. If it looks good or you’d like adjustments, say "next" for the next file (<code>index.backend.html</code>). Let me know if you have specific requests!</p></document>
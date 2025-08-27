import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PDFGenerator {
  constructor() {
    this.browser = null;
  }

  async init() {
    if (!this.browser) {
      try {
        this.browser = await puppeteer.launch({
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-translate',
            '--disable-sync',
            '--no-default-browser-check',
            '--no-first-run'
          ],
          timeout: 30000
        });
        console.log('PDF Generator: Puppeteer browser initialized successfully');
      } catch (error) {
        console.error('PDF Generator: Failed to initialize Puppeteer:', error);
        throw new Error('Failed to initialize PDF generation service');
      }
    }
    return this.browser;
  }

  async generateTripReport(tripData) {
    const browser = await this.init();
    const page = await browser.newPage();

    try {
      // Generate rich HTML content
      const html = this.generateRichHTML(tripData);
      
      await page.setContent(html, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });

      // Generate PDF with professional formatting
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '15mm',
          right: '15mm'
        },
        displayHeaderFooter: true,
        headerTemplate: this.getHeaderTemplate(tripData),
        footerTemplate: this.getFooterTemplate(),
        preferCSSPageSize: true
      });

      return pdf;
    } finally {
      await page.close();
    }
  }

  generateRichHTML(tripData) {
    const { saved, planData } = tripData;
    const d = saved?.data || {};
    const md = saved?.markdown || '';
    const htmlBody = this.convertMarkdownToRichHTML(md);
    
    const style = d.level === "luxury" ? "Luxury" : d.level === "budget" ? "Budget" : "Mid-range";
    const season = this.seasonFromDate(d.start);
    const days = this.daysBetween(d.start, d.end);
    const budget = this.normalizeBudget(d.budget, d.currency);
    const pppd = this.perPersonPerDay(budget, days, Math.max(1, (d.adults || 0) + (d.children || 0)));
    const traveler = this.travelerLabel(d.adults || 0, d.children || 0);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trip Report - ${d.destination}</title>
    <style>
        ${this.getEnhancedStyles()}
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="report-container">
        <!-- Cover Page -->
        <div class="cover-page">
            <div class="cover-header">
                <div class="logo-section">
                    <div class="logo">
                        <div class="logo-icon">WZ</div>
                        <div class="logo-text">
                            <h1>Wayzo</h1>
                            <p>Premium Travel Planning</p>
                        </div>
                    </div>
                </div>
                <div class="trip-title">
                    <h1>${d.destination} Adventure</h1>
                    <h2>Personalized Travel Itinerary</h2>
                </div>
                <div class="trip-overview">
                    <div class="overview-grid">
                        <div class="overview-item">
                            <div class="icon">👥</div>
                            <div class="content">
                                <h3>Travelers</h3>
                                <p>${traveler}</p>
                            </div>
                        </div>
                        <div class="overview-item">
                            <div class="icon">📅</div>
                            <div class="content">
                                <h3>Duration</h3>
                                <p>${days} days</p>
                            </div>
                        </div>
                        <div class="overview-item">
                            <div class="icon">💰</div>
                            <div class="content">
                                <h3>Budget</h3>
                                <p>${budget} ${d.currency}</p>
                            </div>
                        </div>
                        <div class="overview-item">
                            <div class="icon">⭐</div>
                            <div class="content">
                                <h3>Style</h3>
                                <p>${style}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Executive Summary -->
        <div class="page-break"></div>
        <section class="executive-summary">
            <h2>Executive Summary</h2>
            <div class="summary-grid">
                <div class="summary-card">
                    <h3>Trip Highlights</h3>
                    <ul>
                        <li>🏨 Premium accommodations in ${style.toLowerCase()} category</li>
                        <li>🍽️ Curated dining experiences</li>
                        <li>🎯 Activity recommendations based on your preferences</li>
                        <li>🗓️ Optimized daily itineraries</li>
                    </ul>
                </div>
                <div class="summary-card">
                    <h3>Key Information</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <strong>Season:</strong> ${season}
                        </div>
                        <div class="info-item">
                            <strong>Currency:</strong> ${d.currency}
                        </div>
                        <div class="info-item">
                            <strong>Daily Budget:</strong> ${pppd}/person
                        </div>
                        <div class="info-item">
                            <strong>Preferences:</strong> ${d.prefs || 'Standard'}
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Budget Breakdown -->
        <section class="budget-section">
            <h2>Budget Analysis</h2>
            <div class="budget-grid">
                <div class="budget-chart">
                    <canvas id="budgetChart" width="400" height="200"></canvas>
                </div>
                <div class="budget-details">
                    ${this.generateBudgetBreakdown(budget, days, d)}
                </div>
            </div>
        </section>

        <!-- Detailed Itinerary -->
        <div class="page-break"></div>
        <section class="itinerary-section">
            <h2>Detailed Itinerary</h2>
            ${htmlBody}
        </section>

        <!-- Travel Essentials -->
        <section class="travel-essentials">
            <h2>Travel Essentials</h2>
            <div class="essentials-grid">
                <div class="essential-card">
                    <h3>🌡️ Weather & Climate</h3>
                    <p>Typical seasonal conditions around ${season}. Pack accordingly for the expected weather patterns.</p>
                </div>
                <div class="essential-card">
                    <h3>💱 Currency & Payments</h3>
                    <p>Local currency: ${d.currency}. Credit cards widely accepted. Recommended cash reserves for local markets.</p>
                </div>
                <div class="essential-card">
                    <h3>🗣️ Language & Communication</h3>
                    <p>English is commonly spoken in tourist areas. Local language phrases recommended for authentic experiences.</p>
                </div>
                <div class="essential-card">
                    <h3>🔌 Technology & Connectivity</h3>
                    <p>230V power outlets, Type C/E plugs. International adapter recommended. Good mobile coverage expected.</p>
                </div>
            </div>
        </section>
    </div>

    <script>
        // Generate budget chart
        const ctx = document.getElementById('budgetChart').getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Accommodation', 'Meals', 'Activities', 'Transportation', 'Miscellaneous'],
                datasets: [{
                    data: [${this.getBudgetChartData(budget)}],
                    backgroundColor: [
                        '#6366f1',
                        '#10b981', 
                        '#f59e0b',
                        '#ef4444',
                        '#8b5cf6'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: {
                                size: 12
                            },
                            padding: 15
                        }
                    },
                    title: {
                        display: true,
                        text: 'Budget Distribution',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>`;
  }

  getEnhancedStyles() {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #2d3748;
            background: #ffffff;
        }

        .report-container {
            max-width: 210mm;
            margin: 0 auto;
        }

        .cover-page {
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }

        .logo-section {
            margin-bottom: 60px;
        }

        .logo {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            margin-bottom: 40px;
        }

        .logo-icon {
            width: 80px;
            height: 80px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            font-weight: bold;
            backdrop-filter: blur(10px);
        }

        .logo-text h1 {
            font-size: 48px;
            margin-bottom: 5px;
        }

        .logo-text p {
            font-size: 18px;
            opacity: 0.9;
        }

        .trip-title h1 {
            font-size: 64px;
            margin-bottom: 15px;
            font-weight: 700;
        }

        .trip-title h2 {
            font-size: 24px;
            opacity: 0.9;
            font-weight: 300;
            margin-bottom: 60px;
        }

        .overview-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 30px;
            max-width: 600px;
            margin: 0 auto;
        }

        .overview-item {
            display: flex;
            align-items: center;
            gap: 15px;
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
        }

        .overview-item .icon {
            font-size: 32px;
        }

        .overview-item .content h3 {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
            opacity: 0.8;
        }

        .overview-item .content p {
            font-size: 18px;
            font-weight: 600;
        }

        .page-break {
            page-break-before: always;
        }

        section {
            margin: 40px 0;
            padding: 0 20px;
        }

        h2 {
            font-size: 32px;
            color: #1a202c;
            margin-bottom: 30px;
            border-bottom: 3px solid #6366f1;
            padding-bottom: 10px;
        }

        h3 {
            font-size: 20px;
            color: #2d3748;
            margin-bottom: 15px;
        }

        .executive-summary {
            background: #f7fafc;
            padding: 40px;
            border-radius: 15px;
            margin: 40px 20px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
        }

        .summary-card {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        .summary-card ul {
            list-style: none;
            padding-left: 0;
        }

        .summary-card li {
            margin-bottom: 12px;
            padding-left: 0;
        }

        .info-grid {
            display: grid;
            gap: 15px;
        }

        .info-item {
            padding: 10px 0;
            border-bottom: 1px solid #e2e8f0;
        }

        .budget-section {
            background: white;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            margin: 40px 20px;
        }

        .budget-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            align-items: center;
        }

        .budget-chart {
            display: flex;
            justify-content: center;
        }

        .budget-details {
            background: #f8fafc;
            padding: 25px;
            border-radius: 12px;
        }

        .budget-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #e2e8f0;
        }

        .budget-item:last-child {
            border-bottom: none;
            font-weight: bold;
            font-size: 18px;
            color: #1a202c;
        }

        .itinerary-section {
            margin: 40px 20px;
        }

        .travel-essentials {
            background: #f7fafc;
            padding: 40px;
            border-radius: 15px;
            margin: 40px 20px;
        }

        .essentials-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 25px;
        }

        .essential-card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .essential-card h3 {
            font-size: 18px;
            margin-bottom: 12px;
            color: #2d3748;
        }

        .essential-card p {
            color: #4a5568;
            line-height: 1.6;
        }

        /* Enhanced itinerary styling */
        .itinerary-section h3 {
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white;
            padding: 15px 25px;
            border-radius: 12px;
            margin: 30px 0 20px 0;
            font-size: 22px;
        }

        .itinerary-section h4 {
            color: #2d3748;
            font-size: 18px;
            margin: 20px 0 10px 0;
            padding-left: 15px;
            border-left: 4px solid #6366f1;
        }

        .itinerary-section p {
            margin-bottom: 15px;
            padding-left: 20px;
            color: #4a5568;
        }

        .itinerary-section ul {
            margin-bottom: 20px;
            padding-left: 40px;
        }

        .itinerary-section li {
            margin-bottom: 8px;
            color: #4a5568;
        }

        @media print {
            .page-break {
                page-break-before: always;
            }
            
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
        }
    `;
  }

  getHeaderTemplate(tripData) {
    const d = tripData.saved?.data || {};
    return `
        <div style="font-size: 10px; padding: 5px 15px; width: 100%; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0;">
            <span style="color: #6366f1; font-weight: bold;">Wayzo Travel Report</span>
            <span style="color: #64748b;">${d.destination} • Generated ${new Date().toLocaleDateString()}</span>
        </div>
    `;
  }

  getFooterTemplate() {
    return `
        <div style="font-size: 10px; padding: 5px 15px; width: 100%; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0;">
            <span style="color: #64748b;">© 2024 Wayzo - Premium Travel Planning</span>
            <span style="color: #64748b;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
    `;
  }

  generateBudgetBreakdown(budget, days, data) {
    const accommodationPct = data.level === 'luxury' ? 45 : data.level === 'budget' ? 35 : 40;
    const mealsPct = data.level === 'luxury' ? 25 : data.level === 'budget' ? 30 : 28;
    const activitiesPct = 20;
    const transportPct = 10;
    const miscPct = 100 - accommodationPct - mealsPct - activitiesPct - transportPct;

    const accommodation = Math.round(budget * accommodationPct / 100);
    const meals = Math.round(budget * mealsPct / 100);
    const activities = Math.round(budget * activitiesPct / 100);
    const transport = Math.round(budget * transportPct / 100);
    const misc = Math.round(budget * miscPct / 100);

    return `
        <h3>Budget Breakdown</h3>
        <div class="budget-item">
            <span>🏨 Accommodation</span>
            <span>${accommodation} ${data.currency}</span>
        </div>
        <div class="budget-item">
            <span>🍽️ Meals & Dining</span>
            <span>${meals} ${data.currency}</span>
        </div>
        <div class="budget-item">
            <span>🎯 Activities & Tours</span>
            <span>${activities} ${data.currency}</span>
        </div>
        <div class="budget-item">
            <span>🚗 Transportation</span>
            <span>${transport} ${data.currency}</span>
        </div>
        <div class="budget-item">
            <span>💼 Miscellaneous</span>
            <span>${misc} ${data.currency}</span>
        </div>
        <div class="budget-item">
            <span><strong>Total Budget</strong></span>
            <span><strong>${budget} ${data.currency}</strong></span>
        </div>
    `;
  }

  getBudgetChartData(budget) {
    // Default budget distribution percentages
    return '40, 28, 20, 10, 2';
  }

  convertMarkdownToRichHTML(markdown) {
    // Enhanced markdown conversion with better styling
    return markdown
      .replace(/^### (.+)/gm, '<h3>$1</h3>')
      .replace(/^#### (.+)/gm, '<h4>$1</h4>')
      .replace(/^\* (.+)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gm, '<ul>$1</ul>')
      .replace(/<\/ul>\s*<ul>/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .split('\n\n').map(para => para.trim() ? `<p>${para}</p>` : '').join('');
  }

  // Utility functions
  seasonFromDate(dateStr) {
    if (!dateStr) return 'Year-round';
    const month = new Date(dateStr).getMonth() + 1;
    if (month >= 3 && month <= 5) return 'Spring';
    if (month >= 6 && month <= 8) return 'Summer';
    if (month >= 9 && month <= 11) return 'Fall';
    return 'Winter';
  }

  daysBetween(start, end) {
    if (!start || !end) return 1;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate - startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  }

  normalizeBudget(budget, currency = 'USD') {
    return Number(budget) || 1000;
  }

  perPersonPerDay(totalBudget, days, people) {
    return Math.round(totalBudget / days / people);
  }

  travelerLabel(adults, children) {
    const total = (adults || 0) + (children || 0);
    if (total === 1) return '1 traveler';
    if (children > 0) return `${adults} adult${adults > 1 ? 's' : ''}, ${children} child${children > 1 ? 'ren' : ''}`;
    return `${adults} adult${adults > 1 ? 's' : ''}`;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export default PDFGenerator;
#!/usr/bin/env python3
# Script to append new styles to style.css

styles = """
/* ==== Beautiful Save Plan Modal ==== */
.save-plan-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.3s ease-out;
}

.save-plan-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%),
              rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.save-plan-content {
  position: relative;
  background: linear-gradient(to bottom, #ffffff 0%, #fefefe 100%);
  border-radius: 32px;
  padding: 48px;
  max-width: 560px;
  width: 90%;
  box-shadow: 0 30px 60px -12px rgba(102, 126, 234, 0.4),
              0 10px 25px -5px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transform: scale(0.9) translateY(30px);
  opacity: 0;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.save-plan-content.show {
  transform: scale(1) translateY(0);
  opacity: 1;
}

.save-plan-close {
  position: absolute;
  top: 20px;
  right: 20px;
  background: #f3f4f6;
  border: none;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
  z-index: 10;
}

.save-plan-close:hover {
  background: #e5e7eb;
  color: #111827;
  transform: rotate(90deg) scale(1.1);
}

.save-plan-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 28px;
  animation: bounceIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes bounceIn {
  0% {
    transform: scale(0) rotate(-180deg);
    opacity: 0;
  }
  60% {
    transform: scale(1.2) rotate(10deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

.save-plan-title {
  font-size: 32px;
  font-weight: 800;
  color: #111827;
  text-align: center;
  margin: 0 0 12px 0;
  line-height: 1.2;
}

.save-plan-subtitle {
  font-size: 17px;
  color: #6b7280;
  text-align: center;
  margin: 0 0 32px 0;
  line-height: 1.5;
}

.save-plan-benefits {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 36px;
}

.benefit-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
  border-radius: 16px;
  border: 1px solid rgba(102, 126, 234, 0.1);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.benefit-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.15);
  border-color: rgba(102, 126, 234, 0.2);
}

.benefit-icon {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.benefit-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.benefit-text strong {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}

.benefit-text span {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.4;
}

.save-plan-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.btn-save-primary {
  width: 100%;
  padding: 18px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
  position: relative;
  overflow: hidden;
}

.btn-save-primary::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transition: left 0.5s;
}

.btn-save-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(102, 126, 234, 0.5);
}

.btn-save-primary:hover::before {
  left: 100%;
}

.btn-save-secondary {
  width: 100%;
  padding: 16px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-save-secondary:hover {
  background: #f9fafb;
  border-color: #d1d5db;
  color: #374151;
}

/* ==== Full-Screen Loading Animation ==== */
.fullscreen-loader {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease-out;
}

.fullscreen-loader.fade-out {
  animation: fadeOut 0.5s ease-out forwards;
}

@keyframes fadeOut {
  to {
    opacity: 0;
    visibility: hidden;
  }
}

.loader-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #667eea 100%);
  background-size: 200% 200%;
  animation: gradientShift 8s ease infinite;
}

@keyframes gradientShift {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.loader-content {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 700px;
  padding: 40px;
}

.loader-globe {
  position: relative;
  width: 180px;
  height: 180px;
  margin: 0 auto 40px;
}

.globe-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  animation: globeRotate 3s linear infinite;
}

.globe-ring-1 { width: 180px; height: 180px; }
.globe-ring-2 { width: 140px; height: 140px; animation-duration: 4s; animation-direction: reverse; }
.globe-ring-3 { width: 100px; height: 100px; animation-duration: 5s; }

@keyframes globeRotate {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

.globe-core {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: globePulse 2s ease-in-out infinite;
}

@keyframes globePulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.1); }
}

.loader-title {
  font-size: 36px;
  font-weight: 800;
  color: white;
  margin: 0 0 16px 0;
  animation: fadeInUp 0.6s ease-out;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.2);
}

.loader-subtitle {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.95);
  margin: 0 0 48px 0;
  animation: fadeInUp 0.6s ease-out 0.1s both;
  line-height: 1.6;
}

.loader-quote {
  position: relative;
  padding: 32px;
  margin: 0 0 48px 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  animation: fadeInUp 0.6s ease-out 0.2s both;
}

.quote-icon {
  position: absolute;
  top: 10px;
  left: 20px;
  font-size: 60px;
  color: rgba(255, 255, 255, 0.2);
  font-family: Georgia, serif;
  line-height: 1;
}

.quote-text {
  font-size: 20px;
  font-style: italic;
  color: white;
  margin: 0 0 12px 0;
  line-height: 1.6;
  transition: opacity 0.3s;
}

.quote-author {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
  transition: opacity 0.3s;
}

.loader-steps {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 32px;
  animation: fadeInUp 0.6s ease-out 0.3s both;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  border: 2px solid transparent;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 0.5;
}

.step-item.step-active {
  opacity: 1;
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.step-item.step-completed {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.4);
}

.step-icon {
  font-size: 28px;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
}

.step-text {
  font-size: 13px;
  font-weight: 600;
  color: white;
  white-space: nowrap;
}

.loader-progress {
  display: flex;
  align-items: center;
  gap: 16px;
  animation: fadeInUp 0.6s ease-out 0.4s both;
}

.progress-track {
  flex: 1;
  height: 12px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.1);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
  border-radius: 20px;
  width: 0%;
  transition: width 0.3s ease-out;
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.6);
  position: relative;
  overflow: hidden;
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  animation: shimmerProgress 1.5s infinite;
}

@keyframes shimmerProgress {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.progress-text {
  font-size: 18px;
  font-weight: 700;
  color: white;
  min-width: 50px;
  text-align: right;
}

@media (max-width: 768px) {
  .save-plan-content { padding: 32px 24px; margin: 20px; }
  .save-plan-title { font-size: 26px; }
  .benefit-item { padding: 16px; }
  .loader-title { font-size: 28px; }
  .loader-subtitle { font-size: 16px; }
  .loader-steps { gap: 8px; }
  .step-item { padding: 12px 14px; }
  .step-text { font-size: 11px; }
  .quote-text { font-size: 17px; }
}
"""

# Append to style.css
with open(r'c:\Users\User\OneDrive\Desktop\tripmaster\wayzo new\wayzo\frontend\style.css', 'a', encoding='utf-8') as f:
    f.write('\n')
    f.write(styles)

print("Styles added successfully!")
